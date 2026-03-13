/* ============================================================
   FinançasSim — Application Logic
   ============================================================ */

// ── State ──────────────────────────────────────────────────
const state = {
  incomes: [],
  expenses: [],
  goals: [],
  theme: 'light',
  expenseFilter: 'all',
  selectedEmoji: '✈️',
};

// ── Persistence ────────────────────────────────────────────
function save() {
  localStorage.setItem('fs_incomes',  JSON.stringify(state.incomes));
  localStorage.setItem('fs_expenses', JSON.stringify(state.expenses));
  localStorage.setItem('fs_goals',    JSON.stringify(state.goals));
  localStorage.setItem('fs_theme',    state.theme);
}

function load() {
  state.incomes  = JSON.parse(localStorage.getItem('fs_incomes')  || '[]');
  state.expenses = JSON.parse(localStorage.getItem('fs_expenses') || '[]');
  state.goals    = JSON.parse(localStorage.getItem('fs_goals')    || '[]');
  state.theme    = localStorage.getItem('fs_theme') || 'light';
}

// ── Utils ──────────────────────────────────────────────────
const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const currentMonth = () => new Date().toISOString().slice(0, 7);

function getMonthlyIncome() {
  return state.incomes.reduce((sum, i) => {
    const amount = parseFloat(i.amount);
    if (i.freq === 'semanal')    return sum + amount * 4.33;
    if (i.freq === 'quinzenal')  return sum + amount * 2;
    if (i.freq === 'anual')      return sum + amount / 12;
    return sum + amount; // mensal + unico
  }, 0);
}

function getMonthlyExpense() {
  return state.expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
}

// ── Toast ──────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type} show`;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

// ── Theme ──────────────────────────────────────────────────
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const icon = document.querySelector('#themeToggle i');
  icon.className = state.theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

document.getElementById('themeToggle').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  save();
});

// ── Navigation ─────────────────────────────────────────────
const pages = ['dashboard', 'income', 'expenses', 'goals', 'learn'];
const pageTitles = {
  dashboard: 'Dashboard',
  income: 'Rendimentos',
  expenses: 'Gastos',
  goals: 'Metas',
  learn: 'Aprender',
};

function navigateTo(page) {
  pages.forEach(p => {
    document.getElementById(`page-${p}`).classList.toggle('active', p === page);
  });
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.getElementById('topbarTitle').textContent = pageTitles[page] || page;
  closeSidebar();
  if (page === 'dashboard') renderDashboard();
}

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => navigateTo(el.dataset.page));
});

document.querySelectorAll('[data-page]').forEach(el => {
  if (!el.classList.contains('nav-item')) {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  }
});

// ── Sidebar (mobile) ───────────────────────────────────────
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

function openSidebar()  { sidebar.classList.add('open'); overlay.classList.add('show'); }
function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('show'); }

document.getElementById('menuBtn').addEventListener('click', openSidebar);
document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

// ── Chart Instances ────────────────────────────────────────
let expenseChart = null;
let balanceChart = null;

// ── Category Helpers ───────────────────────────────────────
const categoryEmoji = {
  moradia: '🏠', alimentacao: '🍽️', transporte: '🚗', saude: '💊',
  educacao: '📚', lazer: '🎉', vestuario: '👕', assinaturas: '📱',
  dividas: '💳', outros: '✨',
  salario: '💼', freela: '💻', investimento: '📈', aluguel: '🏠',
  bonus: '🎁', pensao: '👨‍👩‍👧',
};
const categoryColors = [
  '#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#64748b',
];

// ── DASHBOARD ──────────────────────────────────────────────
function renderDashboard() {
  const income  = getMonthlyIncome();
  const expense = getMonthlyExpense();
  const balance = income - expense;
  const savingsRate = income > 0 ? Math.max(0, (balance / income) * 100) : 0;

  // KPI cards
  document.getElementById('kpiIncome').textContent  = fmt(income);
  document.getElementById('kpiExpense').textContent = fmt(expense);
  document.getElementById('kpiBalance').textContent = fmt(balance);
  document.getElementById('kpiSavings').textContent = savingsRate.toFixed(1) + '%';

  document.getElementById('kpiIncomeSub').textContent =
    state.incomes.length === 0 ? 'nenhum lançamento' :
    `${state.incomes.length} fonte${state.incomes.length > 1 ? 's' : ''}`;
  document.getElementById('kpiExpenseSub').textContent =
    state.expenses.length === 0 ? 'nenhum lançamento' :
    `${state.expenses.length} item${state.expenses.length > 1 ? 's' : ''}`;

  // Balance card color
  const balCard = document.getElementById('kpiBalanceCard');
  balCard.style.setProperty('--balance-color', balance >= 0 ? 'var(--success)' : 'var(--danger)');
  document.getElementById('kpiBalance').style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';

  // Health score
  renderHealthScore(savingsRate, income, expense);

  // Alert
  renderMainAlert(income, expense, balance, savingsRate);

  // Charts
  renderExpenseChart();
  renderBalanceChart(income, expense);

  // Insights
  renderInsights(income, expense, balance, savingsRate);

  // Goals preview
  renderGoalsPreview();
}

function renderHealthScore(savingsRate, income, expense) {
  let score = 0;
  if (income > 0 && expense <= income) score += 40;
  if (savingsRate >= 20) score += 30;
  else if (savingsRate >= 10) score += 15;
  if (state.goals.length > 0) score += 15;
  const fixedRatio = state.expenses.filter(e => e.type === 'fixo')
    .reduce((s, e) => s + parseFloat(e.amount), 0) / (income || 1);
  if (fixedRatio <= 0.5) score += 15;

  score = Math.min(100, Math.max(0, score));
  const fill  = document.getElementById('healthBarFill');
  const label = document.getElementById('healthScore');
  const badge = document.getElementById('badgeValue');

  let txt, color;
  if (score >= 80) { txt = 'Excelente 🌟'; color = 'var(--success)'; }
  else if (score >= 60) { txt = 'Bom 👍';  color = '#84cc16'; }
  else if (score >= 40) { txt = 'Regular ⚠️'; color = 'var(--warning)'; }
  else { txt = 'Precisa de atenção 🚨'; color = 'var(--danger)'; }

  fill.style.width  = score + '%';
  label.textContent = score + ' / 100';
  badge.textContent = txt;
  badge.style.color = color;
}

function renderMainAlert(income, expense, balance, savingsRate) {
  const box = document.getElementById('mainAlert');
  if (income === 0 && expense === 0) { box.style.display = 'none'; return; }
  box.style.display = 'flex';

  if (expense > income) {
    box.className = 'alert-box alert-danger';
    box.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>
      <div><strong>Atenção:</strong> Você está gastando ${fmt(expense - income)} a mais do que ganha por mês.
      Isso gera dívidas e compromete seu futuro. Veja os pontos de melhora abaixo.</div>`;
  } else if (savingsRate < 10) {
    box.className = 'alert-box alert-warning';
    box.innerHTML = `<i class="fa-solid fa-circle-info"></i>
      <div><strong>Quase lá!</strong> Sua taxa de poupança está em ${savingsRate.toFixed(1)}%.
      O ideal é guardar pelo menos 20% da sua renda. Pequenos cortes fazem uma grande diferença!</div>`;
  } else if (savingsRate >= 20) {
    box.className = 'alert-box alert-success';
    box.innerHTML = `<i class="fa-solid fa-circle-check"></i>
      <div><strong>Parabéns!</strong> Você está poupando ${savingsRate.toFixed(1)}% da sua renda.
      Continue assim — você está no caminho certo para a liberdade financeira!</div>`;
  } else {
    box.className = 'alert-box alert-info';
    box.innerHTML = `<i class="fa-solid fa-circle-info"></i>
      <div><strong>Bom progresso!</strong> Você poupa ${savingsRate.toFixed(1)}% da sua renda.
      Tente chegar a 20% para acelerar seus sonhos financeiros.</div>`;
  }
}

function renderExpenseChart() {
  const canvas = document.getElementById('expenseChart');
  const empty  = document.getElementById('expenseChartEmpty');

  if (state.expenses.length === 0) {
    empty.style.display = 'flex';
    canvas.style.display = 'none';
    if (expenseChart) { expenseChart.destroy(); expenseChart = null; }
    return;
  }
  empty.style.display = 'none';
  canvas.style.display = 'block';

  const grouped = {};
  state.expenses.forEach(e => {
    const cat = e.category;
    grouped[cat] = (grouped[cat] || 0) + parseFloat(e.amount);
  });

  const labels = Object.keys(grouped).map(k => `${categoryEmoji[k] || '✨'} ${k.charAt(0).toUpperCase() + k.slice(1)}`);
  const data   = Object.values(grouped);
  const colors = categoryColors.slice(0, data.length);

  if (expenseChart) expenseChart.destroy();
  expenseChart = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16, boxWidth: 12, font: { size: 12, family: 'Inter' },
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-2').trim() || '#475569',
          },
        },
        tooltip: {
          callbacks: { label: ctx => ` ${fmt(ctx.parsed)}` },
        },
      },
      cutout: '65%',
    },
  });
}

function renderBalanceChart(income, expense) {
  const canvas = document.getElementById('balanceChart');
  const isDark = state.theme === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const textColor = isDark ? '#94a3b8' : '#475569';

  if (balanceChart) balanceChart.destroy();
  balanceChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Rendimentos', 'Gastos', 'Saldo'],
      datasets: [{
        data: [income, expense, Math.abs(income - expense)],
        backgroundColor: ['rgba(16,185,129,.8)', 'rgba(239,68,68,.8)',
          income >= expense ? 'rgba(99,102,241,.8)' : 'rgba(239,68,68,.4)'],
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed.y)}` } },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 12 } } },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 12 }, callback: v => 'R$' + (v/1000).toFixed(0) + 'k' },
          beginAtZero: true,
        },
      },
    },
  });
}

function renderInsights(income, expense, balance, savingsRate) {
  const list = document.getElementById('insightsList');
  const insights = [];

  if (income === 0) {
    list.innerHTML = `<div class="insight-empty">
      <i class="fa-solid fa-wand-magic-sparkles"></i>
      <p>Adicione seus rendimentos e gastos para receber dicas personalizadas!</p>
    </div>`;
    return;
  }

  // Spending more than earning
  if (expense > income) {
    insights.push({
      type: 'danger', icon: 'fa-fire',
      title: 'Gastos maiores que a renda!',
      desc: `Você gasta ${fmt(expense - income)} a mais do que ganha. Cada mês assim gera dívidas. Comece cortando gastos variáveis e opcionais.`,
    });
  }

  // Savings rate
  if (savingsRate < 10 && income > 0) {
    insights.push({
      type: 'warning', icon: 'fa-piggy-bank',
      title: 'Taxa de poupança muito baixa',
      desc: `Você poupa apenas ${savingsRate.toFixed(1)}% da renda. O ideal é 20%. Experimente a regra: ao receber, pague-se primeiro — guarde 20% antes de gastar qualquer coisa.`,
    });
  } else if (savingsRate >= 20) {
    insights.push({
      type: 'success', icon: 'fa-star',
      title: 'Poupança acima do ideal!',
      desc: `Você poupa ${savingsRate.toFixed(1)}% da sua renda — excelente! Agora pense em investir esse dinheiro no Tesouro Direto ou CDB para ele crescer.`,
    });
  }

  // Fixed expenses ratio
  const fixedTotal = state.expenses.filter(e => e.type === 'fixo').reduce((s,e)=>s+parseFloat(e.amount),0);
  const fixedRatio = income > 0 ? fixedTotal / income : 0;
  if (fixedRatio > 0.6) {
    insights.push({
      type: 'danger', icon: 'fa-lock',
      title: 'Gastos fixos muito altos',
      desc: `Seus gastos fixos representam ${(fixedRatio*100).toFixed(0)}% da sua renda (ideal: até 50%). Avalie renegociar contratos, trocar de plano ou reduzir alguma assinatura.`,
    });
  }

  // Leisure check
  const leisure = state.expenses.filter(e => e.category === 'lazer').reduce((s,e)=>s+parseFloat(e.amount),0);
  const leisureRatio = income > 0 ? leisure / income : 0;
  if (leisureRatio > 0.3) {
    insights.push({
      type: 'warning', icon: 'fa-masks-theater',
      title: 'Lazer comprometendo o orçamento',
      desc: `Lazer e entretenimento estão em ${(leisureRatio*100).toFixed(0)}% da renda. A regra 50-30-20 sugere máximo 30% para desejos. Reveja se há excessos.`,
    });
  }

  // Subscriptions
  const subs = state.expenses.filter(e => e.category === 'assinaturas').reduce((s,e)=>s+parseFloat(e.amount),0);
  if (subs > 0) {
    insights.push({
      type: 'info', icon: 'fa-mobile-screen',
      title: 'Revise suas assinaturas',
      desc: `Você gasta ${fmt(subs)} em assinaturas. Anote quais usa de verdade — é comum pagar por serviços esquecidos. Cancele o que não usa.`,
    });
  }

  // Debt
  const debt = state.expenses.filter(e => e.category === 'dividas').reduce((s,e)=>s+parseFloat(e.amount),0);
  if (debt > 0) {
    const debtRatio = income > 0 ? debt / income : 0;
    insights.push({
      type: debtRatio > 0.3 ? 'danger' : 'warning', icon: 'fa-credit-card',
      title: 'Dívidas em andamento',
      desc: `Parcelas e dívidas consomem ${fmt(debt)}/mês (${(debtRatio*100).toFixed(0)}% da renda). Priorize quitar as de juros mais altos primeiro (método avalanche). Confira a aba "Aprender".`,
    });
  }

  // No goals
  if (state.goals.length === 0) {
    insights.push({
      type: 'info', icon: 'fa-bullseye',
      title: 'Defina uma meta financeira',
      desc: `Quem tem objetivos claros economiza mais. Crie sua primeira meta — uma viagem, reserva de emergência ou qualquer sonho — e veja o progresso crescer!`,
    });
  }

  // Emergency fund suggestion
  if (savingsRate > 0 && state.goals.filter(g => g.name.toLowerCase().includes('emergência') || g.name.toLowerCase().includes('reserva')).length === 0) {
    insights.push({
      type: 'info', icon: 'fa-shield-halved',
      title: 'Crie uma reserva de emergência',
      desc: `A primeira meta de todo mundo deveria ser ter 3 a 6 meses de gastos guardados. Com seus gastos de ${fmt(expense)}/mês, você precisa de ${fmt(expense * 4)} como reserva mínima.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: 'success', icon: 'fa-trophy',
      title: 'Suas finanças estão saudáveis!',
      desc: 'Continue monitorando mês a mês e pense em diversificar seus investimentos para fazer seu dinheiro trabalhar por você.',
    });
  }

  list.innerHTML = insights.map(i => `
    <div class="insight-item insight-${i.type}">
      <div class="insight-icon"><i class="fa-solid ${i.icon}"></i></div>
      <div>
        <div class="insight-title">${i.title}</div>
        <div class="insight-desc">${i.desc}</div>
      </div>
    </div>
  `).join('');
}

function renderGoalsPreview() {
  const card = document.getElementById('goalsPreviewCard');
  const list = document.getElementById('goalsPreviewList');
  if (state.goals.length === 0) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  list.innerHTML = state.goals.slice(0,3).map(g => {
    const pct = Math.min(100, (g.saved / g.total) * 100);
    const color = pct >= 100 ? 'var(--success)' : pct >= 50 ? 'var(--brand)' : 'var(--warning)';
    return `
      <div class="goal-preview-item">
        <div class="goal-preview-emoji">${g.emoji}</div>
        <div class="goal-preview-info">
          <div class="goal-preview-name">${g.name}</div>
          <div class="goal-preview-bar-wrap">
            <div class="goal-preview-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>
        <div class="goal-preview-pct">${pct.toFixed(0)}%</div>
      </div>
    `;
  }).join('');
}

// ── INCOME ─────────────────────────────────────────────────
document.getElementById('incomeForm').addEventListener('submit', e => {
  e.preventDefault();
  const income = {
    id: uid(),
    desc: document.getElementById('incomeDesc').value.trim(),
    amount: parseFloat(document.getElementById('incomeAmount').value),
    category: document.getElementById('incomeCategory').value,
    freq: document.getElementById('incomeFreq').value,
    month: document.getElementById('incomeMonth').value || currentMonth(),
  };
  if (!income.desc || isNaN(income.amount) || income.amount <= 0) return;
  state.incomes.push(income);
  save();
  renderIncomeList();
  renderDashboard();
  e.target.reset();
  document.getElementById('incomeMonth').value = currentMonth();
  showToast('Rendimento adicionado! 💰');
});

function renderIncomeList() {
  const list = document.getElementById('incomeList');
  const chip = document.getElementById('totalIncomeChip');
  const total = state.incomes.reduce((s,i) => s + parseFloat(i.amount), 0);
  chip.textContent = `Total: ${fmt(total)}`;

  if (state.incomes.length === 0) {
    list.innerHTML = `<div class="list-empty"><i class="fa-solid fa-inbox"></i><p>Nenhum rendimento cadastrado ainda.</p></div>`;
    return;
  }

  const freqLabels = { mensal:'Mensal', semanal:'Semanal', quinzenal:'Quinzenal', anual:'Anual', unico:'Único' };
  list.innerHTML = [...state.incomes].reverse().map(i => `
    <div class="finance-item" data-id="${i.id}">
      <div class="item-emoji">${categoryEmoji[i.category] || '✨'}</div>
      <div class="item-info">
        <div class="item-name">${escHtml(i.desc)}</div>
        <div class="item-meta">
          <span>${freqLabels[i.freq] || i.freq}</span> · <span>${i.month}</span>
        </div>
      </div>
      <div class="item-amount income-amount">${fmt(parseFloat(i.amount))}</div>
      <button class="item-del" onclick="deleteIncome('${i.id}')"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join('');
}

function deleteIncome(id) {
  state.incomes = state.incomes.filter(i => i.id !== id);
  save();
  renderIncomeList();
  renderDashboard();
  showToast('Rendimento removido', 'danger');
}

// ── EXPENSES ───────────────────────────────────────────────
document.getElementById('expenseForm').addEventListener('submit', e => {
  e.preventDefault();
  const expense = {
    id: uid(),
    desc: document.getElementById('expenseDesc').value.trim(),
    amount: parseFloat(document.getElementById('expenseAmount').value),
    type: document.getElementById('expenseType').value,
    category: document.getElementById('expenseCategory').value,
    month: document.getElementById('expenseMonth').value || currentMonth(),
  };
  if (!expense.desc || isNaN(expense.amount) || expense.amount <= 0) return;
  state.expenses.push(expense);
  save();
  renderExpenseList();
  renderDashboard();
  e.target.reset();
  document.getElementById('expenseMonth').value = currentMonth();
  showToast('Gasto adicionado! 📝');
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.expenseFilter = tab.dataset.filter;
    renderExpenseList();
  });
});

function renderExpenseList() {
  const list = document.getElementById('expenseList');
  const chip = document.getElementById('totalExpenseChip');
  const total = state.expenses.reduce((s,e) => s + parseFloat(e.amount), 0);
  chip.textContent = `Total: ${fmt(total)}`;

  const filtered = state.expenseFilter === 'all'
    ? state.expenses
    : state.expenses.filter(e => e.type === state.expenseFilter);

  if (filtered.length === 0) {
    list.innerHTML = `<div class="list-empty"><i class="fa-solid fa-inbox"></i><p>Nenhum gasto aqui ainda.</p></div>`;
    return;
  }

  list.innerHTML = [...filtered].reverse().map(e => `
    <div class="finance-item" data-id="${e.id}">
      <div class="item-emoji">${categoryEmoji[e.category] || '✨'}</div>
      <div class="item-info">
        <div class="item-name">${escHtml(e.desc)}</div>
        <div class="item-meta">
          <span class="item-type-badge badge-${e.type}">${e.type === 'fixo' ? 'Fixo' : 'Variável'}</span>
          <span>${e.category}</span> · <span>${e.month}</span>
        </div>
      </div>
      <div class="item-amount expense-amount">${fmt(parseFloat(e.amount))}</div>
      <button class="item-del" onclick="deleteExpense('${e.id}')"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join('');
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  save();
  renderExpenseList();
  renderDashboard();
  showToast('Gasto removido', 'danger');
}

// ── GOALS ──────────────────────────────────────────────────
document.querySelectorAll('.emoji-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.selectedEmoji = btn.dataset.emoji;
  });
});

document.getElementById('goalForm').addEventListener('submit', e => {
  e.preventDefault();
  const goal = {
    id: uid(),
    name: document.getElementById('goalName').value.trim(),
    emoji: state.selectedEmoji,
    total: parseFloat(document.getElementById('goalTotal').value),
    saved: parseFloat(document.getElementById('goalSaved').value) || 0,
    deadline: document.getElementById('goalDeadline').value,
    priority: document.getElementById('goalPriority').value,
  };
  if (!goal.name || isNaN(goal.total) || goal.total <= 0) return;
  state.goals.push(goal);
  save();
  renderGoalsList();
  e.target.reset();
  document.getElementById('goalSaved').value = '0';
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.emoji-btn[data-emoji="✈️"]').classList.add('active');
  state.selectedEmoji = '✈️';
  showToast('Meta criada! 🎯');
});

function renderGoalsList() {
  const list  = document.getElementById('goalsFullList');
  const empty = document.getElementById('goalsEmpty');

  if (state.goals.length === 0) {
    empty.style.display = 'flex';
    // Remove all goal cards
    list.querySelectorAll('.goal-card').forEach(c => c.remove());
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = `<div class="list-empty" id="goalsEmpty" style="display:none"></div>` +
    state.goals.map(g => goalCardHTML(g)).join('');
}

function goalCardHTML(g) {
  const pct = Math.min(100, (g.saved / g.total) * 100);
  const remaining = Math.max(0, g.total - g.saved);
  let gradColor = pct >= 100 ? 'linear-gradient(90deg,#10b981,#059669)'
    : pct >= 50 ? 'linear-gradient(90deg,#6366f1,#8b5cf6)'
    : 'linear-gradient(90deg,#f59e0b,#ef4444)';

  let deadlineStr = '';
  if (g.deadline) {
    const dl = new Date(g.deadline + 'T00:00:00');
    const now = new Date();
    const diff = Math.ceil((dl - now) / (1000*60*60*24));
    deadlineStr = diff > 0 ? `${diff} dias restantes` : diff === 0 ? 'Hoje!' : 'Prazo encerrado';
  }

  // Monthly suggestion
  const monthsLeft = g.deadline
    ? Math.max(1, Math.ceil((new Date(g.deadline + 'T00:00:00') - new Date()) / (1000*60*60*24*30)))
    : null;
  const suggestion = monthsLeft && remaining > 0
    ? `<div style="font-size:12px;color:var(--text-2);margin-top:6px;">
        Guarde <strong>${fmt(remaining / monthsLeft)}/mês</strong> para chegar lá no prazo.
       </div>`
    : '';

  return `
    <div class="goal-card" data-id="${g.id}">
      <div class="goal-card-header">
        <div class="goal-title-row">
          <div class="goal-emoji">${g.emoji}</div>
          <div>
            <div class="goal-name">${escHtml(g.name)}</div>
            ${deadlineStr ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px;">${deadlineStr}</div>` : ''}
          </div>
        </div>
        <span class="goal-priority priority-${g.priority}">${g.priority === 'alta' ? '🔴 Alta' : g.priority === 'media' ? '🟡 Média' : '🟢 Baixa'}</span>
      </div>

      <div class="goal-stats">
        <div><div class="goal-stat-label">Meta</div><div class="goal-stat-value">${fmt(g.total)}</div></div>
        <div><div class="goal-stat-label">Guardado</div><div class="goal-stat-value" style="color:var(--success)">${fmt(g.saved)}</div></div>
        <div><div class="goal-stat-label">Falta</div><div class="goal-stat-value" style="color:var(--danger)">${fmt(remaining)}</div></div>
      </div>

      <div class="goal-progress-bar">
        <div class="goal-progress-fill" style="width:${pct}%;background:${gradColor}"></div>
      </div>

      <div class="goal-footer">
        <div class="goal-percent" style="color:${pct>=100?'var(--success)':'var(--brand)'}">${pct.toFixed(0)}%</div>
        <div class="goal-actions">
          <div>
            <div class="deposit-row">
              <input type="number" placeholder="Depositar R$" id="dep_${g.id}" min="0" step="0.01" />
              <button onclick="depositGoal('${g.id}')"><i class="fa-solid fa-plus"></i> Adicionar</button>
            </div>
          </div>
          <button class="goal-del-btn" onclick="deleteGoal('${g.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      ${suggestion}
      ${pct >= 100 ? `<div style="margin-top:12px;padding:10px;background:var(--success-light);border-radius:8px;color:var(--success);font-size:13px;font-weight:700;text-align:center;">🎉 Meta atingida! Parabéns!</div>` : ''}
    </div>
  `;
}

function depositGoal(id) {
  const input = document.getElementById('dep_' + id);
  const val = parseFloat(input.value);
  if (isNaN(val) || val <= 0) { showToast('Digite um valor válido', 'danger'); return; }
  const goal = state.goals.find(g => g.id === id);
  if (!goal) return;
  goal.saved = Math.min(goal.total, goal.saved + val);
  save();
  renderGoalsList();
  renderDashboard();
  showToast(`${fmt(val)} adicionado à meta! 💪`);
}

function deleteGoal(id) {
  state.goals = state.goals.filter(g => g.id !== id);
  save();
  renderGoalsList();
  renderDashboard();
  showToast('Meta removida', 'danger');
}

// ── LEARN MODAL ────────────────────────────────────────────
const learnContent = {
  regra50: {
    title: '📊 A Regra 50-30-20',
    body: `
      <p>Essa é a estratégia mais simples e eficaz para organizar o seu orçamento. Divide sua renda em três partes:</p>
      <div class="rule-visual">
        <div class="rule-block rule-50">50%<small>Necessidades</small></div>
        <div class="rule-block rule-30">30%<small>Desejos</small></div>
        <div class="rule-block rule-20">20%<small>Poupança</small></div>
      </div>
      <h4><i class="fa-solid fa-house"></i> 50% — Necessidades (o que não pode faltar)</h4>
      <p>Aluguel/financiamento, mercado, transporte, luz, água, saúde. Se passar de 50%, você precisa cortar ou aumentar sua renda.</p>
      <h4><i class="fa-solid fa-star"></i> 30% — Desejos (o que você quer, mas não precisa)</h4>
      <p>Restaurantes, viagens, roupas extras, streaming, academia, lazer. Esses gastos são válidos, mas têm limite.</p>
      <h4><i class="fa-solid fa-piggy-bank"></i> 20% — Poupança e investimentos</h4>
      <p>Essa parte vai direto para sua reserva de emergência e investimentos. <strong>Pague-se primeiro:</strong> assim que receber, transfira os 20% antes de gastar qualquer coisa.</p>
      <h4><i class="fa-solid fa-lightbulb"></i> Como aplicar hoje</h4>
      <ul>
        <li>Calcule 50%, 30% e 20% da sua renda líquida</li>
        <li>Categorize cada gasto do mês</li>
        <li>Veja onde está estourando o limite</li>
        <li>Ajuste durante o mês seguinte</li>
      </ul>
    `,
  },
  emergencia: {
    title: '🛡️ Reserva de Emergência',
    body: `
      <p>A reserva de emergência é a <strong>base de toda vida financeira saudável</strong>. Sem ela, qualquer imprevisto — demissão, doença, carro quebrado — vira dívida.</p>
      <h4><i class="fa-solid fa-calculator"></i> Quanto guardar?</h4>
      <ul>
        <li><strong>Mínimo:</strong> 3 meses de gastos essenciais</li>
        <li><strong>Ideal:</strong> 6 meses de gastos totais</li>
        <li><strong>Para autônomos/MEI:</strong> 12 meses, pois a renda é menos previsível</li>
      </ul>
      <h4><i class="fa-solid fa-bank"></i> Onde guardar?</h4>
      <p>O dinheiro da reserva precisa ser <strong>líquido</strong> (resgatável na hora) e <strong>seguro</strong>. Boas opções:</p>
      <ul>
        <li><strong>Tesouro Selic:</strong> seguro, rende bem e resgata em 1 dia</li>
        <li><strong>CDB com liquidez diária</strong> de banco grande (acima de 100% do CDI)</li>
        <li><strong>Conta remunerada</strong> de fintechs (Nubank, Inter, C6…)</li>
      </ul>
      <h4><i class="fa-solid fa-triangle-exclamation"></i> O que NÃO fazer</h4>
      <ul>
        <li>❌ Deixar na poupança (rendimento abaixo da inflação)</li>
        <li>❌ Investir em ações (pode cair quando você mais precisar)</li>
        <li>❌ Gastar com oportunidades antes de completar a reserva</li>
      </ul>
      <h4><i class="fa-solid fa-rocket"></i> Como montar a reserva rapidinho</h4>
      <p>Separe <strong>um valor fixo todo mês</strong> antes de qualquer gasto. Mesmo que seja R$ 50 por mês — o hábito é mais importante que o valor no início.</p>
    `,
  },
  dividas: {
    title: '💳 Como Sair das Dívidas',
    body: `
      <p>Dívida gera dívida — os juros compostos trabalham contra você. Mas com estratégia, é possível sair do vermelho.</p>
      <h4><i class="fa-solid fa-list-ol"></i> Passo 1: Faça um inventário completo</h4>
      <p>Liste todas as dívidas: <strong>credor, valor total, juros mensais e parcela</strong>. Encarar a realidade é o primeiro passo.</p>
      <h4><i class="fa-solid fa-snowflake"></i> Método Bola de Neve</h4>
      <p>Quite primeiro a <strong>dívida de menor valor</strong>, independente dos juros. A satisfação de eliminar uma dívida motiva a continuar. Depois aplique o valor pago nela na próxima.</p>
      <h4><i class="fa-solid fa-mountain"></i> Método Avalanche</h4>
      <p>Quite primeiro a <strong>dívida com maior juros</strong> (normalmente cartão de crédito e cheque especial). Matematicamente economiza mais dinheiro a longo prazo.</p>
      <h4><i class="fa-solid fa-fire"></i> Cartão de crédito e cheque especial: emergência!</h4>
      <p>Juros de 12-15% ao mês. Se você não paga o total da fatura, troque por um empréstimo pessoal (2-5% ao mês) ou consignado. A diferença é enorme.</p>
      <h4><i class="fa-solid fa-handshake"></i> Negocie sempre</h4>
      <ul>
        <li>Ligue para os credores — muitos aceitam desconto para pagamento à vista</li>
        <li>Feirões de renegociação (Serasa Limpa Nome, feirões dos bancos) oferecem descontos de até 90%</li>
        <li>Nunca pegue empréstimo para pagar dívidas de menor juros</li>
      </ul>
    `,
  },
  orcamento: {
    title: '📋 Como Fazer um Orçamento',
    body: `
      <p>Orçamento não é restrição — é liberdade. Quem sabe para onde vai o dinheiro, consegue direcionar para o que realmente importa.</p>
      <h4><i class="fa-solid fa-1"></i> Liste todos os seus rendimentos</h4>
      <p>Salário líquido, freelas, aluguéis, dividendos. Use valores reais — não o que você espera ganhar, mas o que entra no banco.</p>
      <h4><i class="fa-solid fa-2"></i> Mapeie todos os gastos</h4>
      <p>Abra o extrato bancário e cartão dos últimos 3 meses. Categorize cada gasto. Inclua tudo — até o cafézinho.</p>
      <h4><i class="fa-solid fa-3"></i> Compare e identifique sobras ou faltas</h4>
      <p>Se gastos > renda: corte os variáveis primeiro. Reduza o que é desejo antes do que é necessidade.</p>
      <h4><i class="fa-solid fa-4"></i> Defina limites por categoria</h4>
      <p>Use a regra 50-30-20 como base. Alimente seus gastos aqui no FinançasSim todo mês.</p>
      <h4><i class="fa-solid fa-5"></i> Revise todo mês</h4>
      <p>Orçamento não é estático. Revise no começo de cada mês. Com o tempo, ficará automático e você terá total controle.</p>
      <h4><i class="fa-solid fa-lightbulb"></i> Dica de ouro</h4>
      <p>Registre os gastos <strong>na hora</strong>, não no fim do mês. Pequenas compras somam muito e são fáceis de esquecer.</p>
    `,
  },
  investir: {
    title: '📈 Começando a Investir',
    body: `
      <p>Antes de investir, você precisa de: ✅ reserva de emergência completa e ✅ dívidas de alto custo quitadas. Se tiver ambos, chegou a hora!</p>
      <h4><i class="fa-solid fa-shield"></i> Renda fixa: para iniciantes</h4>
      <ul>
        <li><strong>Tesouro Direto (Tesouro Selic):</strong> o mais seguro do país, rendimento bom, mínimo de R$ 30</li>
        <li><strong>CDB:</strong> emitido por bancos, com garantia do FGC até R$ 250k. Busque acima de 100% do CDI</li>
        <li><strong>LCI/LCA:</strong> isentos de IR para pessoa física — ótima opção</li>
      </ul>
      <h4><i class="fa-solid fa-chart-line"></i> Renda variável: para o médio/longo prazo</h4>
      <ul>
        <li><strong>Fundos de índice (ETFs):</strong> ex. BOVA11 (Ibovespa) — diversificação automática</li>
        <li><strong>FIIs (Fundos Imobiliários):</strong> pagam dividendos mensais, acessíveis a partir de ~R$ 10</li>
        <li><strong>Ações:</strong> maior potencial e maior risco. Só após entender o básico</li>
      </ul>
      <h4><i class="fa-solid fa-calendar"></i> A regra mais importante</h4>
      <p><strong>Consistência bate performance.</strong> Investir R$ 300/mês todo mês por 20 anos é muito melhor que esperar ter R$ 100.000 para começar. Os juros compostos precisam de tempo para funcionar.</p>
    `,
  },
  habitos: {
    title: '🧠 Hábitos que Mudam Tudo',
    body: `
      <p>A maioria dos problemas financeiros não é falta de dinheiro — é falta de hábito. Estas práticas simples transformam finanças em piloto automático.</p>
      <h4><i class="fa-solid fa-sun"></i> Hábito 1: Revise as finanças toda semana</h4>
      <p>5 minutos toda segunda-feira. Veja quanto gastou, quanto tem e se está no caminho. Isso evita surpresas no fim do mês.</p>
      <h4><i class="fa-solid fa-robot"></i> Hábito 2: Automatize tudo que puder</h4>
      <p>Configure transferência automática no dia do salário para poupança/investimento. O que sai antes de ver, não sente falta.</p>
      <h4><i class="fa-solid fa-cart-shopping"></i> Hábito 3: Regra das 24 horas</h4>
      <p>Antes de qualquer compra não planejada acima de R$ 100, espere 24 horas. A maioria das compras por impulso passa. Economize muito assim.</p>
      <h4><i class="fa-solid fa-tag"></i> Hábito 4: Compare antes de comprar</h4>
      <p>Pesquise em pelo menos 3 lugares. Use aplicativos de cashback. Compre à vista sempre que possível — e peça desconto.</p>
      <h4><i class="fa-solid fa-heart"></i> Hábito 5: Diferencie desejo de necessidade</h4>
      <p>Antes de gastar, pergunte: "Isso vai me deixar mais feliz daqui a 1 ano?" Se não, provavelmente é impulso.</p>
      <h4><i class="fa-solid fa-book"></i> Hábito 6: Leia sobre finanças</h4>
      <p>30 minutos por semana lendo sobre finanças pessoais muda a mentalidade completamente. Sugestões: "Pai Rico, Pai Pobre", "O Homem Mais Rico da Babilônia", "Me Poupe!" (Nathalia Arcuri).</p>
    `,
  },
};

document.querySelectorAll('.learn-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const card = e.target.closest('.learn-card');
    if (!card) return;
    const module = card.dataset.module;
    openLearnModal(module);
  });
});
document.querySelectorAll('.learn-card').forEach(card => {
  card.addEventListener('click', () => openLearnModal(card.dataset.module));
});

function openLearnModal(module) {
  const content = learnContent[module];
  if (!content) return;
  document.getElementById('modalTitle').textContent = content.title;
  document.getElementById('modalBody').innerHTML = content.body;
  document.getElementById('learnModal').classList.add('show');
}

document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('learnModal').classList.remove('show');
});
document.getElementById('learnModal').addEventListener('click', e => {
  if (e.target === document.getElementById('learnModal')) {
    document.getElementById('learnModal').classList.remove('show');
  }
});

// ── Security helper ────────────────────────────────────────
function escHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ── Expose globals for inline onclick ──────────────────────
window.deleteIncome  = deleteIncome;
window.deleteExpense = deleteExpense;
window.deleteGoal    = deleteGoal;
window.depositGoal   = depositGoal;

// ── Init ───────────────────────────────────────────────────
function init() {
  load();
  applyTheme();

  // Set default month
  const m = currentMonth();
  document.getElementById('incomeMonth').value  = m;
  document.getElementById('expenseMonth').value = m;

  renderDashboard();
  renderIncomeList();
  renderExpenseList();
  renderGoalsList();

  // Demo data for first-time users
  if (state.incomes.length === 0 && state.expenses.length === 0 && state.goals.length === 0) {
    loadDemoData();
  }
}

function loadDemoData() {
  state.incomes = [
    { id: uid(), desc: 'Salário CLT', amount: 4500, category: 'salario', freq: 'mensal', month: currentMonth() },
    { id: uid(), desc: 'Freela Design', amount: 800, category: 'freela', freq: 'unico', month: currentMonth() },
  ];
  state.expenses = [
    { id: uid(), desc: 'Aluguel', amount: 1200, type: 'fixo', category: 'moradia', month: currentMonth() },
    { id: uid(), desc: 'Supermercado', amount: 600, type: 'variavel', category: 'alimentacao', month: currentMonth() },
    { id: uid(), desc: 'Transporte (combustível)', amount: 350, type: 'fixo', category: 'transporte', month: currentMonth() },
    { id: uid(), desc: 'Netflix + Spotify + Disney+', amount: 90, type: 'fixo', category: 'assinaturas', month: currentMonth() },
    { id: uid(), desc: 'Academia', amount: 89, type: 'fixo', category: 'saude', month: currentMonth() },
    { id: uid(), desc: 'Restaurantes / delivery', amount: 400, type: 'variavel', category: 'alimentacao', month: currentMonth() },
    { id: uid(), desc: 'Parcela cartão de crédito', amount: 280, type: 'fixo', category: 'dividas', month: currentMonth() },
  ];
  state.goals = [
    { id: uid(), name: 'Viagem para Lisboa', emoji: '✈️', total: 12000, saved: 3200, deadline: '2026-12-01', priority: 'alta' },
    { id: uid(), name: 'Reserva de emergência', emoji: '🛡️', total: 15000, saved: 5000, deadline: '2026-08-01', priority: 'alta' },
  ];
  save();
  renderDashboard();
  renderIncomeList();
  renderExpenseList();
  renderGoalsList();
  showToast('Dados de exemplo carregados! Edite à vontade 😊');
}

init();
