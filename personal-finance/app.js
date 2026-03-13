/* ============================================================
   FinançasSim — Application Logic
   ============================================================ */

// ── Auth state ─────────────────────────────────────────────
const auth = {
  token:   localStorage.getItem('fs_token') || null,
  user:    JSON.parse(localStorage.getItem('fs_user') || 'null'),
  premium: localStorage.getItem('fs_premium') === 'true',
  serverAvailable: false,
};

// Relative URL — works when opened via the Node server
const API = '/api';

// ── API helpers ────────────────────────────────────────────
async function apiCall(method, endpoint, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (auth.token) opts.headers['Authorization'] = `Bearer ${auth.token}`;
  if (body)       opts.body = JSON.stringify(body);
  const res  = await fetch(API + endpoint, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
  return data;
}

async function checkServerAvailable() {
  try {
    await fetch(API + '/ping', { method: 'GET', signal: AbortSignal.timeout(2000) });
    auth.serverAvailable = true;
  } catch {
    auth.serverAvailable = false;
  }
}

// ── Sync ───────────────────────────────────────────────────
let syncTimer = null;

function scheduleSync() {
  if (!auth.token || !auth.serverAvailable) return;
  setSyncStatus('syncing');
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      await apiCall('PUT', '/data', {
        incomes:  state.incomes,
        expenses: state.expenses,
        goals:    state.goals,
        theme:    state.theme,
      });
      setSyncStatus('ok');
      updateDropdownSync('ok');
    } catch {
      setSyncStatus('error');
      updateDropdownSync('error');
    }
  }, 1400);
}

function setSyncStatus(status) {
  const btn  = document.getElementById('syncBtn');
  const icon = btn?.querySelector('i');
  if (!btn || !icon) return;
  btn.className = 'btn-icon';
  if (!auth.token || !auth.serverAvailable) {
    icon.className = 'fa-solid fa-hard-drive';
    btn.title = 'Salvo localmente. Faça login para sincronizar na nuvem.';
    return;
  }
  if (status === 'ok') {
    icon.className = 'fa-solid fa-cloud-arrow-up';
    btn.title = 'Dados sincronizados na nuvem ✓';
    btn.classList.add('sync-ok');
  } else if (status === 'syncing') {
    icon.className = 'fa-solid fa-rotate';
    btn.title = 'Sincronizando…';
    btn.classList.add('sync-syncing');
  } else {
    icon.className = 'fa-solid fa-cloud-slash';
    btn.title = 'Erro ao sincronizar. Dados salvos localmente.';
    btn.classList.add('sync-error');
  }
}

function updateDropdownSync(status) {
  const el = document.getElementById('dropdownSync');
  if (!el) return;
  if (!auth.token || !auth.serverAvailable) {
    el.innerHTML = '<i class="fa-solid fa-hard-drive"></i> Modo local (sem login)';
    return;
  }
  if (status === 'ok')
    el.innerHTML = '<i class="fa-solid fa-cloud-arrow-up" style="color:var(--success)"></i> Sincronizado na nuvem';
  else if (status === 'syncing')
    el.innerHTML = '<i class="fa-solid fa-rotate" style="color:var(--warning)"></i> Sincronizando…';
  else
    el.innerHTML = '<i class="fa-solid fa-cloud-slash" style="color:var(--danger)"></i> Erro ao sincronizar';
}

// ── State ──────────────────────────────────────────────────
const state = {
  incomes: [],
  expenses: [],
  goals: [],
  theme: 'light',
  expenseFilter: 'all',
  selectedEmoji: '✈️',
};

// ── Chart instances ────────────────────────────────────────
let expenseChart       = null;
let balanceChart       = null;
let dashMonthlyChart   = null;
let incomeMonthChart   = null;
let expenseMonthChart  = null;

// ── Persistence ────────────────────────────────────────────
function save() {
  localStorage.setItem('fs_incomes',  JSON.stringify(state.incomes));
  localStorage.setItem('fs_expenses', JSON.stringify(state.expenses));
  localStorage.setItem('fs_goals',    JSON.stringify(state.goals));
  localStorage.setItem('fs_theme',    state.theme);
  scheduleSync();
}

function load() {
  state.incomes  = JSON.parse(localStorage.getItem('fs_incomes')  || '[]');
  state.expenses = JSON.parse(localStorage.getItem('fs_expenses') || '[]');
  state.goals    = JSON.parse(localStorage.getItem('fs_goals')    || '[]');
  state.theme    = localStorage.getItem('fs_theme') || 'light';
}

async function loadFromServer() {
  if (!auth.token || !auth.serverAvailable) return false;
  try {
    const data = await apiCall('GET', '/data');
    state.incomes  = data.incomes  || [];
    state.expenses = data.expenses || [];
    state.goals    = data.goals    || [];
    state.theme    = data.theme    || 'light';
    // Persist locally too
    localStorage.setItem('fs_incomes',  JSON.stringify(state.incomes));
    localStorage.setItem('fs_expenses', JSON.stringify(state.expenses));
    localStorage.setItem('fs_goals',    JSON.stringify(state.goals));
    localStorage.setItem('fs_theme',    state.theme);
    return true;
  } catch {
    return false;
  }
}

// ── Utils ──────────────────────────────────────────────────
const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const currentMonth = () => new Date().toISOString().slice(0, 7);

function escHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

// Last N months as array of { key: "2025-03", label: "Mar/25" }
function getLast12Months() {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
                   .replace('.', '').replace(' ', '/');
    months.push({ key, label });
  }
  return months;
}

function getMonthlyIncome() {
  return state.incomes.reduce((sum, i) => {
    const amount = parseFloat(i.amount);
    if (i.freq === 'semanal')   return sum + amount * 4.33;
    if (i.freq === 'quinzenal') return sum + amount * 2;
    if (i.freq === 'anual')     return sum + amount / 12;
    return sum + amount; // mensal + unico
  }, 0);
}

function getMonthlyExpense() {
  return state.expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
}

// Group items by month field → map { "2025-03": totalAmount }
function groupByMonth(items) {
  const map = {};
  items.forEach(item => {
    const m = item.month || currentMonth();
    map[m] = (map[m] || 0) + parseFloat(item.amount);
  });
  return map;
}

function countByMonth(items) {
  const map = {};
  items.forEach(item => {
    const m = item.month || currentMonth();
    map[m] = (map[m] || 0) + 1;
  });
  return map;
}

// ── Toast ──────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type} show`;
  setTimeout(() => { t.className = 'toast'; }, 3200);
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
  // Re-render charts to pick up new colors
  renderDashboard();
  renderMonthlyBreakdown('income');
  renderMonthlyBreakdown('expense');
});

// ── Navigation ─────────────────────────────────────────────
const pages = ['dashboard', 'income', 'expenses', 'goals', 'learn'];
const pageTitles = { dashboard: 'Dashboard', income: 'Rendimentos', expenses: 'Gastos', goals: 'Metas', learn: 'Aprender' };

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
  if (page === 'income')    renderMonthlyBreakdown('income');
  if (page === 'expenses')  renderMonthlyBreakdown('expense');
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

// ── Category helpers ───────────────────────────────────────
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

const incomeCategories = [
  { value: 'salario',      label: '💼 Salário' },
  { value: 'freela',       label: '💻 Freela / Autônomo' },
  { value: 'investimento', label: '📈 Investimentos' },
  { value: 'aluguel',      label: '🏠 Aluguel' },
  { value: 'bonus',        label: '🎁 Bônus / 13º' },
  { value: 'pensao',       label: '👨‍👩‍👧 Pensão / Benefício' },
  { value: 'outros',       label: '✨ Outros' },
];
const expenseCategories = [
  { value: 'moradia',      label: '🏠 Moradia' },
  { value: 'alimentacao',  label: '🍽️ Alimentação' },
  { value: 'transporte',   label: '🚗 Transporte' },
  { value: 'saude',        label: '💊 Saúde' },
  { value: 'educacao',     label: '📚 Educação' },
  { value: 'lazer',        label: '🎉 Lazer' },
  { value: 'vestuario',    label: '👕 Vestuário' },
  { value: 'assinaturas',  label: '📱 Assinaturas' },
  { value: 'dividas',      label: '💳 Dívidas / Parcelas' },
  { value: 'outros',       label: '✨ Outros' },
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

  document.getElementById('kpiBalance').style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';

  renderHealthScore(savingsRate, income, expense);
  renderMainAlert(income, expense, balance, savingsRate);
  renderExpenseChart();
  renderBalanceChart(income, expense);
  renderDashMonthlyChart();
  renderInsights(income, expense, balance, savingsRate);
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
  if      (score >= 80) { txt = 'Excelente 🌟';         color = 'var(--success)'; }
  else if (score >= 60) { txt = 'Bom 👍';               color = '#84cc16'; }
  else if (score >= 40) { txt = 'Regular ⚠️';           color = 'var(--warning)'; }
  else                  { txt = 'Precisa de atenção 🚨'; color = 'var(--danger)'; }

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
      <div><strong>Atenção:</strong> Você está gastando ${fmt(expense - income)} a mais do que ganha.
      Isso gera dívidas e compromete seu futuro. Veja os pontos de melhora abaixo.</div>`;
  } else if (savingsRate < 10) {
    box.className = 'alert-box alert-warning';
    box.innerHTML = `<i class="fa-solid fa-circle-info"></i>
      <div><strong>Quase lá!</strong> Sua taxa de poupança está em ${savingsRate.toFixed(1)}%.
      O ideal é guardar pelo menos 20% da sua renda.</div>`;
  } else if (savingsRate >= 20) {
    box.className = 'alert-box alert-success';
    box.innerHTML = `<i class="fa-solid fa-circle-check"></i>
      <div><strong>Parabéns!</strong> Você está poupando ${savingsRate.toFixed(1)}% da renda.
      Continue assim — você está no caminho certo!</div>`;
  } else {
    box.className = 'alert-box alert-info';
    box.innerHTML = `<i class="fa-solid fa-circle-info"></i>
      <div><strong>Bom progresso!</strong> Você poupa ${savingsRate.toFixed(1)}%.
      Tente chegar a 20% para acelerar seus sonhos financeiros.</div>`;
  }
}

function renderExpenseChart() {
  const canvas = document.getElementById('expenseChart');
  const empty  = document.getElementById('expenseChartEmpty');

  if (state.expenses.length === 0) {
    empty.style.display = 'flex'; canvas.style.display = 'none';
    if (expenseChart) { expenseChart.destroy(); expenseChart = null; }
    return;
  }
  empty.style.display = 'none'; canvas.style.display = 'block';

  const grouped = {};
  state.expenses.forEach(e => {
    const cat = e.category;
    grouped[cat] = (grouped[cat] || 0) + parseFloat(e.amount);
  });

  const labels = Object.keys(grouped).map(k => `${categoryEmoji[k] || '✨'} ${k.charAt(0).toUpperCase() + k.slice(1)}`);
  const data   = Object.values(grouped);
  const colors = categoryColors.slice(0, data.length);
  const textColor = state.theme === 'dark' ? '#94a3b8' : '#475569';

  if (expenseChart) expenseChart.destroy();
  expenseChart = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14, boxWidth: 12, font: { size: 12, family: 'Inter' }, color: textColor } },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed)}` } },
      },
      cutout: '65%',
    },
  });
}

function renderBalanceChart(income, expense) {
  const canvas    = document.getElementById('balanceChart');
  const gridColor = state.theme === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const textColor = state.theme === 'dark' ? '#94a3b8' : '#475569';

  if (balanceChart) balanceChart.destroy();
  balanceChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Rendimentos', 'Gastos', 'Saldo'],
      datasets: [{
        data: [income, expense, Math.abs(income - expense)],
        backgroundColor: ['rgba(16,185,129,.8)', 'rgba(239,68,68,.8)',
          income >= expense ? 'rgba(99,102,241,.8)' : 'rgba(239,68,68,.4)'],
        borderRadius: 8, borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed.y)}` } } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 12 } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 12 }, callback: v => 'R$' + (v/1000).toFixed(0) + 'k' }, beginAtZero: true },
      },
    },
  });
}

// ── DASHBOARD 12-month chart ───────────────────────────────
function renderDashMonthlyChart() {
  const months      = getLast12Months();
  const incomeMap   = groupByMonth(state.incomes);
  const expenseMap  = groupByMonth(state.expenses);

  const incData  = months.map(m => incomeMap[m.key]  || 0);
  const expData  = months.map(m => expenseMap[m.key] || 0);
  const balData  = months.map((m, i) => incData[i] - expData[i]);
  const labels   = months.map(m => m.label);

  const hasData  = [...incData, ...expData].some(v => v > 0);
  const canvas   = document.getElementById('dashMonthlyChart');
  const empty    = document.getElementById('dashMonthlyEmpty');
  const kpisEl   = document.getElementById('dashMonthKpis');

  if (!hasData) {
    empty.style.display = 'flex'; canvas.style.display = 'none'; kpisEl.innerHTML = ''; return;
  }
  empty.style.display = 'none'; canvas.style.display = 'block';

  // KPI pills
  const totalInc = incData.reduce((a, b) => a + b, 0);
  const totalExp = expData.reduce((a, b) => a + b, 0);
  const totalBal = totalInc - totalExp;
  kpisEl.innerHTML = `
    <span class="month-kpi-pill pill-income">Recebido: ${fmt(totalInc)}</span>
    <span class="month-kpi-pill pill-expense">Gasto: ${fmt(totalExp)}</span>
    <span class="month-kpi-pill pill-balance" style="color:${totalBal>=0?'var(--brand)':'var(--danger)'};background:${totalBal>=0?'#ede9fe':'var(--danger-light)'}">Saldo: ${fmt(totalBal)}</span>
  `;

  const gridColor = state.theme === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const textColor = state.theme === 'dark' ? '#94a3b8' : '#475569';

  if (dashMonthlyChart) dashMonthlyChart.destroy();
  dashMonthlyChart = new Chart(canvas, {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Rendimentos',
          data: incData,
          backgroundColor: 'rgba(16,185,129,.75)',
          borderRadius: 6,
          borderSkipped: false,
          order: 2,
        },
        {
          type: 'bar',
          label: 'Gastos',
          data: expData,
          backgroundColor: 'rgba(239,68,68,.75)',
          borderRadius: 6,
          borderSkipped: false,
          order: 2,
        },
        {
          type: 'line',
          label: 'Saldo',
          data: balData,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,.12)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: balData.map(v => v >= 0 ? '#6366f1' : '#ef4444'),
          fill: true,
          tension: .35,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { padding: 16, boxWidth: 12, font: { size: 12, family: 'Inter' }, color: textColor } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, callback: v => 'R$' + (v/1000).toFixed(0) + 'k' }, beginAtZero: true },
      },
    },
  });
}

// ── INSIGHTS ───────────────────────────────────────────────
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

  if (expense > income) {
    insights.push({ type:'danger', icon:'fa-fire', title:'Gastos maiores que a renda!',
      desc:`Você gasta ${fmt(expense - income)} a mais do que ganha. Corte gastos variáveis e opcionais primeiro.` });
  }
  if (savingsRate < 10 && income > 0) {
    insights.push({ type:'warning', icon:'fa-piggy-bank', title:'Taxa de poupança muito baixa',
      desc:`Você poupa ${savingsRate.toFixed(1)}% — ideal é 20%. Pague-se primeiro: ao receber, transfira 20% antes de qualquer gasto.` });
  } else if (savingsRate >= 20) {
    insights.push({ type:'success', icon:'fa-star', title:'Poupança acima do ideal!',
      desc:`Você poupa ${savingsRate.toFixed(1)}% — excelente! Agora pense em investir esse dinheiro (Tesouro Direto, CDB).` });
  }

  const fixedTotal = state.expenses.filter(e => e.type === 'fixo').reduce((s,e) => s + parseFloat(e.amount), 0);
  const fixedRatio = income > 0 ? fixedTotal / income : 0;
  if (fixedRatio > 0.6) {
    insights.push({ type:'danger', icon:'fa-lock', title:'Gastos fixos muito altos',
      desc:`Fixos representam ${(fixedRatio*100).toFixed(0)}% da renda (ideal: até 50%). Renegocie contratos, troque planos, cancele o que não usa.` });
  }

  const leisure = state.expenses.filter(e => e.category === 'lazer').reduce((s,e) => s + parseFloat(e.amount), 0);
  if (income > 0 && leisure / income > 0.3) {
    insights.push({ type:'warning', icon:'fa-masks-theater', title:'Lazer comprometendo o orçamento',
      desc:`Lazer em ${((leisure/income)*100).toFixed(0)}% da renda. Regra 50-30-20 sugere máximo 30% para desejos.` });
  }

  const subs = state.expenses.filter(e => e.category === 'assinaturas').reduce((s,e) => s + parseFloat(e.amount), 0);
  if (subs > 0) {
    insights.push({ type:'info', icon:'fa-mobile-screen', title:'Revise suas assinaturas',
      desc:`Você gasta ${fmt(subs)} em assinaturas. Cancele o que não usa — é fácil esquecer de serviços que cobram automaticamente.` });
  }

  const debt = state.expenses.filter(e => e.category === 'dividas').reduce((s,e) => s + parseFloat(e.amount), 0);
  if (debt > 0) {
    const dr = income > 0 ? debt / income : 0;
    insights.push({ type: dr > 0.3 ? 'danger' : 'warning', icon:'fa-credit-card', title:'Dívidas em andamento',
      desc:`Parcelas consomem ${fmt(debt)}/mês (${(dr*100).toFixed(0)}% da renda). Priorize quitar os de maiores juros primeiro.` });
  }

  if (state.goals.length === 0) {
    insights.push({ type:'info', icon:'fa-bullseye', title:'Defina uma meta financeira',
      desc:'Quem tem objetivos claros economiza mais. Crie sua primeira meta na aba Metas!' });
  }

  if (savingsRate > 0) {
    insights.push({ type:'info', icon:'fa-shield-halved', title:'Crie uma reserva de emergência',
      desc:`Tenha 3–6 meses de gastos guardados. Com ${fmt(expense)}/mês de gastos, você precisa de ${fmt(expense * 4)} como reserva mínima.` });
  }

  if (insights.length === 0) {
    insights.push({ type:'success', icon:'fa-trophy', title:'Suas finanças estão saudáveis!',
      desc:'Continue monitorando e pense em diversificar investimentos para o dinheiro trabalhar por você.' });
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
  list.innerHTML = state.goals.slice(0, 3).map(g => {
    const pct = Math.min(100, (g.saved / g.total) * 100);
    const color = pct >= 100 ? 'var(--success)' : pct >= 50 ? 'var(--brand)' : 'var(--warning)';
    return `
      <div class="goal-preview-item">
        <div class="goal-preview-emoji">${g.emoji}</div>
        <div class="goal-preview-info">
          <div class="goal-preview-name">${escHtml(g.name)}</div>
          <div class="goal-preview-bar-wrap">
            <div class="goal-preview-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>
        <div class="goal-preview-pct">${pct.toFixed(0)}%</div>
      </div>
    `;
  }).join('');
}

// ── MONTHLY BREAKDOWN (shared for income / expense) ────────
function renderMonthlyBreakdown(type) {
  const isIncome   = type === 'income';
  const items      = isIncome ? state.incomes : state.expenses;
  const cardEl     = document.getElementById(isIncome ? 'incomeMonthlyCard' : 'expenseMonthlyCard');
  const chartId    = isIncome ? 'incomeMonthlyChart' : 'expenseMonthlyChart';
  const tableId    = isIncome ? 'incomeMonthlyTable' : 'expenseMonthlyTable';
  const accumId    = isIncome ? 'incomeAccumulated' : 'expenseAccumulated';
  const avgId      = isIncome ? 'incomeMonthAvg' : 'expenseMonthAvg';
  const barColor   = isIncome ? 'rgba(16,185,129,.8)' : 'rgba(239,68,68,.8)';
  const lineColor  = isIncome ? '#10b981' : '#ef4444';

  if (items.length === 0) { cardEl.style.display = 'none'; return; }
  cardEl.style.display = 'block';

  const months      = getLast12Months();
  const amountMap   = groupByMonth(items);
  const countMap    = countByMonth(items);
  const monthData   = months.map(m => ({ ...m, total: amountMap[m.key] || 0, count: countMap[m.key] || 0 }));
  const accumulated = monthData.reduce((s, m) => s + m.total, 0);
  const nonZero     = monthData.filter(m => m.total > 0);
  const average     = nonZero.length > 0 ? accumulated / nonZero.length : 0;
  const maxVal      = Math.max(...monthData.map(m => m.total), 1);

  // Update chips
  document.getElementById(accumId).textContent = fmt(accumulated);
  document.getElementById(avgId).textContent   = `Média mensal: ${fmt(average)}`;

  // Chart
  const canvas    = document.getElementById(chartId);
  const gridColor = state.theme === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const textColor = state.theme === 'dark' ? '#94a3b8' : '#475569';

  const chartRef = isIncome ? incomeMonthChart : expenseMonthChart;
  if (chartRef) chartRef.destroy();

  const newChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: isIncome ? 'Rendimentos' : 'Gastos',
          data: monthData.map(m => m.total),
          backgroundColor: barColor,
          borderRadius: 6,
          borderSkipped: false,
          order: 2,
        },
        {
          type: 'line',
          label: 'Acumulado',
          data: monthData.reduce((acc, m, i) => { acc.push((acc[i-1] || 0) + m.total); return acc; }, []),
          borderColor: lineColor,
          borderWidth: 2,
          pointRadius: 3,
          fill: false,
          tension: .35,
          yAxisID: 'yAcc',
          order: 1,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { padding: 12, boxWidth: 10, font: { size: 11, family: 'Inter' }, color: textColor } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 11 }, callback: v => 'R$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v) },
          beginAtZero: true,
        },
        yAcc: {
          position: 'right',
          grid: { display: false },
          ticks: { color: lineColor, font: { size: 10 }, callback: v => 'R$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v) },
          beginAtZero: true,
        },
      },
    },
  });

  if (isIncome) incomeMonthChart = newChart;
  else          expenseMonthChart = newChart;

  // Table
  const tableEl = document.getElementById(tableId);
  tableEl.innerHTML = `
    <thead>
      <tr>
        <th>Mês</th>
        <th style="text-align:right">Valor</th>
        <th style="text-align:center">Itens</th>
        <th class="month-bar-cell"></th>
      </tr>
    </thead>
    <tbody>
      ${monthData.map(m => {
        const pct = maxVal > 0 ? (m.total / maxVal) * 100 : 0;
        return `
          <tr>
            <td style="font-weight:500">${m.label}</td>
            <td style="text-align:right;font-weight:${m.total > 0 ? 700 : 400}" class="${m.total === 0 ? 'month-zero' : ''}">
              ${m.total > 0 ? fmt(m.total) : '—'}
            </td>
            <td style="text-align:center">
              ${m.count > 0 ? `<span class="month-count">${m.count}</span>` : '—'}
            </td>
            <td class="month-bar-cell">
              <div class="month-bar-bg">
                <div class="month-bar-fill" style="width:${pct}%;background:${isIncome ? 'var(--success)' : 'var(--danger)'}"></div>
              </div>
            </td>
          </tr>
        `;
      }).join('')}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td>Acumulado 12m</td>
        <td style="text-align:right;color:${isIncome ? 'var(--success)' : 'var(--danger)'}">${fmt(accumulated)}</td>
        <td style="text-align:center"><span class="month-count">${items.length}</span></td>
        <td></td>
      </tr>
      <tr class="total-row">
        <td>Média mensal</td>
        <td style="text-align:right;color:var(--text-2)">${fmt(average)}</td>
        <td colspan="2" style="color:var(--text-3);font-size:11px">nos meses com lançamento</td>
      </tr>
    </tfoot>
  `;
}

// ── INCOME ─────────────────────────────────────────────────
document.getElementById('incomeForm').addEventListener('submit', e => {
  e.preventDefault();
  const income = {
    id: uid(),
    desc:     document.getElementById('incomeDesc').value.trim(),
    amount:   parseFloat(document.getElementById('incomeAmount').value),
    category: document.getElementById('incomeCategory').value,
    freq:     document.getElementById('incomeFreq').value,
    month:    document.getElementById('incomeMonth').value || currentMonth(),
  };
  if (!income.desc || isNaN(income.amount) || income.amount <= 0) return;
  state.incomes.push(income);
  save();
  renderIncomeList();
  renderMonthlyBreakdown('income');
  renderDashboard();
  e.target.reset();
  document.getElementById('incomeMonth').value = currentMonth();
  showToast('Rendimento adicionado! 💰');
});

function renderIncomeList() {
  const list = document.getElementById('incomeList');
  const chip = document.getElementById('totalIncomeChip');
  const total = state.incomes.reduce((s, i) => s + parseFloat(i.amount), 0);
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
      <button class="item-edit" onclick="openEditModal('income','${i.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
      <button class="item-del"  onclick="deleteIncome('${i.id}')"            title="Excluir"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join('');
}

function deleteIncome(id) {
  state.incomes = state.incomes.filter(i => i.id !== id);
  save();
  renderIncomeList();
  renderMonthlyBreakdown('income');
  renderDashboard();
  showToast('Rendimento removido', 'danger');
}

// ── EXPENSES ───────────────────────────────────────────────
document.getElementById('expenseForm').addEventListener('submit', e => {
  e.preventDefault();
  const expense = {
    id: uid(),
    desc:     document.getElementById('expenseDesc').value.trim(),
    amount:   parseFloat(document.getElementById('expenseAmount').value),
    type:     document.getElementById('expenseType').value,
    category: document.getElementById('expenseCategory').value,
    month:    document.getElementById('expenseMonth').value || currentMonth(),
  };
  if (!expense.desc || isNaN(expense.amount) || expense.amount <= 0) return;
  state.expenses.push(expense);
  save();
  renderExpenseList();
  renderMonthlyBreakdown('expense');
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
  const total = state.expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
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
      <button class="item-edit" onclick="openEditModal('expense','${e.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
      <button class="item-del"  onclick="deleteExpense('${e.id}')"            title="Excluir"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join('');
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  save();
  renderExpenseList();
  renderMonthlyBreakdown('expense');
  renderDashboard();
  showToast('Gasto removido', 'danger');
}

// ── EDIT MODAL ─────────────────────────────────────────────
function openEditModal(type, id) {
  const item = type === 'income'
    ? state.incomes.find(i => i.id === id)
    : state.expenses.find(e => e.id === id);
  if (!item) return;

  const isIncome = type === 'income';

  document.getElementById('editId').value   = id;
  document.getElementById('editType').value = type;
  document.getElementById('editDesc').value    = item.desc;
  document.getElementById('editAmount').value  = item.amount;
  document.getElementById('editMonth').value   = item.month || currentMonth();

  // Populate category select
  const catSelect = document.getElementById('editCategory');
  const cats = isIncome ? incomeCategories : expenseCategories;
  catSelect.innerHTML = cats.map(c => `<option value="${c.value}" ${item.category === c.value ? 'selected' : ''}>${c.label}</option>`).join('');

  // Show/hide type-specific fields
  document.getElementById('editFreqGroup').style.display    = isIncome   ? 'flex' : 'none';
  document.getElementById('editExpTypeGroup').style.display = !isIncome  ? 'flex' : 'none';

  if (isIncome) {
    document.getElementById('editFreq').value = item.freq || 'mensal';
  } else {
    document.getElementById('editExpenseType').value = item.type || 'variavel';
  }

  document.getElementById('editModalTitle').textContent = isIncome ? '✏️ Editar Rendimento' : '✏️ Editar Gasto';
  document.getElementById('editModal').classList.add('show');
  document.getElementById('editDesc').focus();
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('show');
}

document.getElementById('editModalClose').addEventListener('click', closeEditModal);
document.getElementById('editModal').addEventListener('click', e => {
  if (e.target === document.getElementById('editModal')) closeEditModal();
});

document.getElementById('editForm').addEventListener('submit', e => {
  e.preventDefault();

  const id     = document.getElementById('editId').value;
  const type   = document.getElementById('editType').value;
  const desc   = document.getElementById('editDesc').value.trim();
  const amount = parseFloat(document.getElementById('editAmount').value);
  const month  = document.getElementById('editMonth').value || currentMonth();
  const cat    = document.getElementById('editCategory').value;

  if (!desc || isNaN(amount) || amount <= 0) {
    showToast('Preencha todos os campos corretamente', 'danger'); return;
  }

  if (type === 'income') {
    const item = state.incomes.find(i => i.id === id);
    if (!item) return;
    item.desc     = desc;
    item.amount   = amount;
    item.month    = month;
    item.category = cat;
    item.freq     = document.getElementById('editFreq').value;
    renderIncomeList();
    renderMonthlyBreakdown('income');
  } else {
    const item = state.expenses.find(e => e.id === id);
    if (!item) return;
    item.desc     = desc;
    item.amount   = amount;
    item.month    = month;
    item.category = cat;
    item.type     = document.getElementById('editExpenseType').value;
    renderExpenseList();
    renderMonthlyBreakdown('expense');
  }

  save();
  renderDashboard();
  closeEditModal();
  showToast('Alterações salvas! ✅');
});

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
    name:     document.getElementById('goalName').value.trim(),
    emoji:    state.selectedEmoji,
    total:    parseFloat(document.getElementById('goalTotal').value),
    saved:    parseFloat(document.getElementById('goalSaved').value) || 0,
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
  const gradColor = pct >= 100
    ? 'linear-gradient(90deg,#10b981,#059669)'
    : pct >= 50
    ? 'linear-gradient(90deg,#6366f1,#8b5cf6)'
    : 'linear-gradient(90deg,#f59e0b,#ef4444)';

  let deadlineStr = '';
  if (g.deadline) {
    const dl   = new Date(g.deadline + 'T00:00:00');
    const diff = Math.ceil((dl - new Date()) / (1000*60*60*24));
    deadlineStr = diff > 0 ? `${diff} dias restantes` : diff === 0 ? 'Hoje!' : 'Prazo encerrado';
  }

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
  const val   = parseFloat(input.value);
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
      <h4><i class="fa-solid fa-house"></i> 50% — Necessidades</h4>
      <p>Aluguel, mercado, transporte, luz, água, saúde. Se passar de 50%, você precisa cortar ou aumentar a renda.</p>
      <h4><i class="fa-solid fa-star"></i> 30% — Desejos</h4>
      <p>Restaurantes, viagens, roupas extras, streaming. Válidos, mas com limite.</p>
      <h4><i class="fa-solid fa-piggy-bank"></i> 20% — Poupança</h4>
      <p><strong>Pague-se primeiro:</strong> transfira os 20% assim que receber, antes de qualquer gasto.</p>
    `,
  },
  emergencia: {
    title: '🛡️ Reserva de Emergência',
    body: `
      <p>A base de toda vida financeira saudável. Sem ela, qualquer imprevisto vira dívida.</p>
      <h4><i class="fa-solid fa-calculator"></i> Quanto guardar?</h4>
      <ul>
        <li><strong>Mínimo:</strong> 3 meses de gastos essenciais</li>
        <li><strong>Ideal:</strong> 6 meses de gastos totais</li>
        <li><strong>Autônomos:</strong> 12 meses</li>
      </ul>
      <h4><i class="fa-solid fa-bank"></i> Onde guardar?</h4>
      <ul>
        <li><strong>Tesouro Selic</strong> — seguro e resgata em 1 dia</li>
        <li><strong>CDB com liquidez diária</strong> — acima de 100% do CDI</li>
        <li><strong>Conta remunerada</strong> de fintech (Nubank, Inter…)</li>
      </ul>
    `,
  },
  dividas: {
    title: '💳 Como Sair das Dívidas',
    body: `
      <p>Com estratégia certa, é possível sair do vermelho mesmo com renda limitada.</p>
      <h4><i class="fa-solid fa-snowflake"></i> Método Bola de Neve</h4>
      <p>Quite a <strong>dívida de menor valor</strong> primeiro. A satisfação motiva a continuar.</p>
      <h4><i class="fa-solid fa-mountain"></i> Método Avalanche</h4>
      <p>Quite a <strong>dívida com maior juros</strong> primeiro. Economiza mais no longo prazo.</p>
      <h4><i class="fa-solid fa-fire"></i> Cartão e cheque especial: emergência!</h4>
      <p>Juros de 12–15% ao mês. Troque por empréstimo pessoal (2–5% ao mês) imediatamente.</p>
    `,
  },
  orcamento: {
    title: '📋 Como Fazer um Orçamento',
    body: `
      <p>Orçamento não é restrição — é liberdade para gastar no que importa.</p>
      <h4><i class="fa-solid fa-1"></i> Liste todos os rendimentos</h4>
      <p>Salário líquido, freelas, aluguéis. Use valores reais do banco.</p>
      <h4><i class="fa-solid fa-2"></i> Mapeie todos os gastos</h4>
      <p>Abra extratos dos últimos 3 meses. Categorize tudo — até o cafézinho.</p>
      <h4><i class="fa-solid fa-3"></i> Compare e ajuste</h4>
      <p>Gastos > renda: corte variáveis primeiro. Use a regra 50-30-20.</p>
      <h4><i class="fa-solid fa-4"></i> Revise todo mês</h4>
      <p>Lançamentos aqui no FinançasSim ajudam a manter o controle automático.</p>
    `,
  },
  investir: {
    title: '📈 Começando a Investir',
    body: `
      <p>Antes: ✅ reserva de emergência completa e ✅ dívidas de alto custo quitadas.</p>
      <h4><i class="fa-solid fa-shield"></i> Renda fixa (para começar)</h4>
      <ul>
        <li><strong>Tesouro Direto (Selic):</strong> mais seguro do país, mínimo R$ 30</li>
        <li><strong>CDB:</strong> garantia do FGC até R$ 250k — busque acima de 100% do CDI</li>
        <li><strong>LCI/LCA:</strong> isentos de IR para pessoa física</li>
      </ul>
      <h4><i class="fa-solid fa-calendar"></i> Regra mais importante</h4>
      <p><strong>Consistência bate performance.</strong> R$ 300/mês por 20 anos supera esperar ter R$ 100.000.</p>
    `,
  },
  habitos: {
    title: '🧠 Hábitos que Mudam Tudo',
    body: `
      <h4><i class="fa-solid fa-robot"></i> Automatize tudo</h4>
      <p>Configure transferência automática no dia do salário para poupança. O que sai antes de ver, não sente falta.</p>
      <h4><i class="fa-solid fa-cart-shopping"></i> Regra das 24 horas</h4>
      <p>Antes de qualquer compra não planejada acima de R$ 100, espere 24h. A maioria passa.</p>
      <h4><i class="fa-solid fa-sun"></i> Revise as finanças toda semana</h4>
      <p>5 minutos toda segunda-feira evitam surpresas no fim do mês.</p>
      <h4><i class="fa-solid fa-heart"></i> Desejo vs Necessidade</h4>
      <p>Pergunte: "Isso vai me deixar mais feliz daqui a 1 ano?" Se não, provavelmente é impulso.</p>
    `,
  },
};

// Free cards click
document.querySelectorAll('.learn-card:not(.learn-card-premium) .learn-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    const card = e.target.closest('.learn-card');
    if (card) openLearnModal(card.dataset.module);
  });
});
document.querySelectorAll('.learn-card:not(.learn-card-premium)').forEach(card => {
  card.addEventListener('click', () => openLearnModal(card.dataset.module));
});

// Premium cards → open paywall (only if not yet unlocked)
document.querySelectorAll('.learn-card-premium').forEach(card => {
  card.addEventListener('click', () => {
    if (auth.premium) { openLearnModal(card.dataset.module); return; }
    openPaywallModal();
  });
});
document.querySelectorAll('.btn-premium-unlock').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (auth.premium) {
      const card = btn.closest('.learn-card-premium');
      if (card) openLearnModal(card.dataset.module);
      return;
    }
    openPaywallModal();
  });
});

function openPaywallModal() {
  // Reset code field
  const inp = document.getElementById('premiumCodeInput');
  if (inp) inp.value = '';
  const errEl = document.getElementById('paywallCodeError');
  if (errEl) errEl.textContent = '';
  document.getElementById('paywallModal').classList.add('show');
}
function closePaywallModal() {
  document.getElementById('paywallModal').classList.remove('show');
}

document.getElementById('paywallClose').addEventListener('click', closePaywallModal);
document.getElementById('paywallSkip').addEventListener('click', closePaywallModal);
document.getElementById('paywallModal').addEventListener('click', e => {
  if (e.target === document.getElementById('paywallModal')) closePaywallModal();
});

document.getElementById('paywallCta').addEventListener('click', () => {
  showToast('Redirecionando para o pagamento... 🔐');
  setTimeout(() => closePaywallModal(), 1800);
});

// ── Premium code unlock ────────────────────────────────────
document.getElementById('premiumCodeBtn').addEventListener('click', handlePremiumCode);
document.getElementById('premiumCodeInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') handlePremiumCode();
});
document.getElementById('paywallLoginLink').addEventListener('click', () => {
  closePaywallModal();
  openAuthModal('login');
});

async function handlePremiumCode() {
  const code  = document.getElementById('premiumCodeInput').value.trim();
  const errEl = document.getElementById('paywallCodeError');
  if (!code) { errEl.textContent = 'Digite o código de acesso.'; return; }
  errEl.textContent = '';

  // If logged in → validate on server
  if (auth.token && auth.serverAvailable) {
    try {
      await apiCall('POST', '/premium/unlock', { code });
      activatePremium();
    } catch (err) {
      errEl.textContent = err.message || 'Código inválido.';
    }
    return;
  }

  // If not logged in → local check (PREMIUM_CODE_LOCAL is intentionally visible
  // as a fallback for demo; in production only server-side validation is used)
  const LOCAL_CODE = 'FINANCASPRO2026';
  if (code.toUpperCase() === LOCAL_CODE) {
    activatePremium();
  } else {
    errEl.textContent = 'Código inválido. Faça login para validar via servidor.';
  }
}

function activatePremium(showMsg = true) {
  auth.premium = true;
  localStorage.setItem('fs_premium', 'true');
  // Visually unlock all premium cards
  document.querySelectorAll('.learn-card-premium').forEach(card => {
    card.classList.remove('learn-card-premium');
    card.querySelector('.premium-lock-overlay')?.remove();
    const tag = card.querySelector('.learn-tag-premium');
    if (tag) { tag.className = 'learn-tag'; tag.innerHTML = 'Premium ✓'; }
    const btn = card.querySelector('.btn-premium-unlock');
    if (btn) { btn.className = 'btn-outline learn-btn'; btn.innerHTML = 'Aprender <i class="fa-solid fa-arrow-right"></i>'; }
    // Re-bind click
    card.addEventListener('click', () => openLearnModal(card.dataset.module));
  });
  closePaywallModal();
  if (showMsg) showToast('🎉 Premium desbloqueado! Acesso total liberado.');
  updateAvatarUI();
}

function openLearnModal(module) {
  const content = learnContent[module];
  if (!content) return;
  document.getElementById('modalTitle').textContent = content.title;
  document.getElementById('modalBody').innerHTML    = content.body;
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

// ── Expose globals for inline onclick ──────────────────────
window.deleteIncome  = deleteIncome;
window.deleteExpense = deleteExpense;
window.deleteGoal    = deleteGoal;
window.depositGoal   = depositGoal;
window.openEditModal = openEditModal;

// ── AUTH UI HELPERS ────────────────────────────────────────
function updateAvatarUI() {
  const user     = auth.user;
  const avatarEl = document.getElementById('avatarBtn');
  const nameEl   = document.getElementById('dropdownName');
  const emailEl  = document.getElementById('dropdownEmail');
  const dAvatar  = document.getElementById('dropdownAvatar');
  const authBtn  = document.getElementById('dropdownAuthBtn');
  const logoutEl = document.getElementById('dropdownLogout');

  if (user) {
    const initials = user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    avatarEl.textContent  = initials;
    dAvatar.textContent   = initials;
    nameEl.textContent    = user.name;
    emailEl.textContent   = user.email;
    authBtn.style.display = 'none';
    logoutEl.style.display = '';
    if (user.premium || auth.premium) avatarEl.classList.add('premium-user');
  } else {
    avatarEl.textContent   = '?';
    dAvatar.textContent    = '?';
    nameEl.textContent     = 'Visitante';
    emailEl.textContent    = 'Modo local';
    authBtn.style.display  = '';
    logoutEl.style.display = 'none';
  }

  setSyncStatus(auth.token && auth.serverAvailable ? 'ok' : 'local');
  updateDropdownSync(auth.token && auth.serverAvailable ? 'ok' : 'local');
}

// Avatar dropdown toggle
document.getElementById('avatarBtn').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('userDropdown').classList.toggle('open');
});
document.addEventListener('click', () => {
  document.getElementById('userDropdown').classList.remove('open');
});
document.getElementById('userDropdown').addEventListener('click', e => e.stopPropagation());

document.getElementById('dropdownAuthBtn').addEventListener('click', () => {
  document.getElementById('userDropdown').classList.remove('open');
  openAuthModal('login');
});

document.getElementById('dropdownLogout').addEventListener('click', () => {
  auth.token   = null;
  auth.user    = null;
  auth.premium = false;
  localStorage.removeItem('fs_token');
  localStorage.removeItem('fs_user');
  localStorage.removeItem('fs_premium');
  document.getElementById('userDropdown').classList.remove('open');
  updateAvatarUI();
  showToast('Você saiu da conta. Dados salvos localmente.');
});

// ── AUTH MODAL ─────────────────────────────────────────────
function openAuthModal(tab = 'login') {
  switchAuthTab(tab);
  document.getElementById('authModal').classList.add('show');
  setTimeout(() => {
    const f = tab === 'login'
      ? document.getElementById('loginEmail')
      : document.getElementById('regName');
    f?.focus();
  }, 100);
}
function closeAuthModal() {
  document.getElementById('authModal').classList.remove('show');
}

document.getElementById('authModalClose').addEventListener('click', closeAuthModal);
document.getElementById('authModal').addEventListener('click', e => {
  if (e.target === document.getElementById('authModal')) closeAuthModal();
});

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('loginForm').style.display    = isLogin ? 'flex' : 'none';
  document.getElementById('registerForm').style.display = isLogin ? 'none' : 'flex';
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', isLogin ? i === 0 : i === 1);
  });
}

document.getElementById('tabLogin').addEventListener('click',    () => switchAuthTab('login'));
document.getElementById('tabRegister').addEventListener('click', () => switchAuthTab('register'));
document.getElementById('goRegister').addEventListener('click',  () => switchAuthTab('register'));
document.getElementById('goLogin').addEventListener('click',     () => switchAuthTab('login'));

// Password visibility toggles
document.querySelectorAll('.input-eye').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.querySelector('i').className = isPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  });
});

// Login form
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('loginSubmit');
  errEl.style.display = 'none';

  if (!auth.serverAvailable) {
    errEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Servidor offline. Execute <code>npm start</code> na pasta personal-finance.';
    errEl.style.display = 'flex';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Entrando…';
  try {
    const res = await apiCall('POST', '/login', { email, password });
    auth.token = res.token;
    auth.user  = res.user;
    if (res.user.premium) auth.premium = true;
    localStorage.setItem('fs_token',   res.token);
    localStorage.setItem('fs_user',    JSON.stringify(res.user));
    if (res.user.premium) localStorage.setItem('fs_premium', 'true');

    // Load user data from server
    const loaded = await loadFromServer();
    if (loaded) {
      renderAll();
    }

    closeAuthModal();
    updateAvatarUI();
    if (auth.premium) activatePremium(false);
    showToast(`Bem-vindo(a), ${res.user.name.split(' ')[0]}! ☁️`);
  } catch (err) {
    errEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escHtml(err.message)}`;
    errEl.style.display = 'flex';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
  }
});

// Register form
document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm  = document.getElementById('regConfirm').value;
  const errEl    = document.getElementById('regError');
  const btn      = document.getElementById('regSubmit');
  errEl.style.display = 'none';

  if (!auth.serverAvailable) {
    errEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Servidor offline. Execute <code>npm start</code> na pasta personal-finance.';
    errEl.style.display = 'flex';
    return;
  }
  if (password !== confirm) {
    errEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> As senhas não coincidem.';
    errEl.style.display = 'flex';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Criando conta…';
  try {
    const res = await apiCall('POST', '/register', { name, email, password });
    auth.token = res.token;
    auth.user  = res.user;
    localStorage.setItem('fs_token', res.token);
    localStorage.setItem('fs_user',  JSON.stringify(res.user));

    // Push current local data to new account
    await apiCall('PUT', '/data', {
      incomes:  state.incomes,
      expenses: state.expenses,
      goals:    state.goals,
      theme:    state.theme,
    });

    closeAuthModal();
    updateAvatarUI();
    showToast(`Conta criada! Dados sincronizados na nuvem ☁️`);
  } catch (err) {
    errEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escHtml(err.message)}`;
    errEl.style.display = 'flex';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Criar conta grátis';
  }
});

// ── Render all views ───────────────────────────────────────
function renderAll() {
  applyTheme();
  renderDashboard();
  renderIncomeList();
  renderExpenseList();
  renderGoalsList();
  renderMonthlyBreakdown('income');
  renderMonthlyBreakdown('expense');
}

// ── Init ───────────────────────────────────────────────────
async function init() {
  // 1. Load from localStorage first (instant)
  load();
  applyTheme();

  const m = currentMonth();
  document.getElementById('incomeMonth').value  = m;
  document.getElementById('expenseMonth').value = m;

  // 2. Render immediately with local data
  renderAll();

  // 3. Check server availability in background
  await checkServerAvailable();
  updateAvatarUI();

  // 4. If logged in and server is up, load from server (may update UI)
  if (auth.token && auth.serverAvailable) {
    try {
      // Validate token is still good
      await apiCall('GET', '/me');
      const loaded = await loadFromServer();
      if (loaded) renderAll();
      setSyncStatus('ok');
      updateDropdownSync('ok');
    } catch {
      // Token expired — log out silently
      auth.token = null;
      auth.user  = null;
      localStorage.removeItem('fs_token');
      localStorage.removeItem('fs_user');
      updateAvatarUI();
    }
  }

  // 5. Restore premium state if previously unlocked
  if (auth.premium) activatePremium(false);

  // 6. Load demo data if brand new user with no data
  if (state.incomes.length === 0 && state.expenses.length === 0 && state.goals.length === 0) {
    loadDemoData();
  }
}

function loadDemoData() {
  const m = currentMonth();
  // Helper to create month key N months ago
  const prevMonth = (n) => {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  };

  state.incomes = [
    { id: uid(), desc: 'Salário CLT',   amount: 4500, category: 'salario',     freq: 'mensal', month: m },
    { id: uid(), desc: 'Salário CLT',   amount: 4500, category: 'salario',     freq: 'mensal', month: prevMonth(1) },
    { id: uid(), desc: 'Salário CLT',   amount: 4500, category: 'salario',     freq: 'mensal', month: prevMonth(2) },
    { id: uid(), desc: 'Freela Design', amount: 800,  category: 'freela',      freq: 'unico',  month: m },
    { id: uid(), desc: 'Freela Design', amount: 650,  category: 'freela',      freq: 'unico',  month: prevMonth(1) },
    { id: uid(), desc: '13º Salário',   amount: 4500, category: 'bonus',       freq: 'anual',  month: prevMonth(3) },
  ];
  state.expenses = [
    { id: uid(), desc: 'Aluguel',                   amount: 1200, type:'fixo',    category:'moradia',     month: m },
    { id: uid(), desc: 'Aluguel',                   amount: 1200, type:'fixo',    category:'moradia',     month: prevMonth(1) },
    { id: uid(), desc: 'Aluguel',                   amount: 1200, type:'fixo',    category:'moradia',     month: prevMonth(2) },
    { id: uid(), desc: 'Supermercado',               amount: 600,  type:'variavel',category:'alimentacao', month: m },
    { id: uid(), desc: 'Supermercado',               amount: 580,  type:'variavel',category:'alimentacao', month: prevMonth(1) },
    { id: uid(), desc: 'Transporte',                 amount: 350,  type:'fixo',    category:'transporte',  month: m },
    { id: uid(), desc: 'Transporte',                 amount: 350,  type:'fixo',    category:'transporte',  month: prevMonth(1) },
    { id: uid(), desc: 'Netflix + Spotify + Disney+',amount: 90,   type:'fixo',    category:'assinaturas', month: m },
    { id: uid(), desc: 'Netflix + Spotify + Disney+',amount: 90,   type:'fixo',    category:'assinaturas', month: prevMonth(1) },
    { id: uid(), desc: 'Academia',                   amount: 89,   type:'fixo',    category:'saude',       month: m },
    { id: uid(), desc: 'Restaurantes / delivery',    amount: 400,  type:'variavel',category:'alimentacao', month: m },
    { id: uid(), desc: 'Restaurantes / delivery',    amount: 320,  type:'variavel',category:'alimentacao', month: prevMonth(1) },
    { id: uid(), desc: 'Parcela cartão',             amount: 280,  type:'fixo',    category:'dividas',     month: m },
    { id: uid(), desc: 'Parcela cartão',             amount: 280,  type:'fixo',    category:'dividas',     month: prevMonth(1) },
    { id: uid(), desc: 'Compras de fim de ano',      amount: 1800, type:'variavel',category:'vestuario',   month: prevMonth(3) },
  ];
  state.goals = [
    { id: uid(), name: 'Viagem para Lisboa',   emoji:'✈️', total:12000, saved:3200, deadline:'2026-12-01', priority:'alta' },
    { id: uid(), name: 'Reserva de emergência',emoji:'🛡️', total:15000, saved:5000, deadline:'2026-08-01', priority:'alta' },
  ];
  save();
  renderDashboard();
  renderIncomeList();
  renderExpenseList();
  renderGoalsList();
  renderMonthlyBreakdown('income');
  renderMonthlyBreakdown('expense');
  showToast('Dados de exemplo carregados! Edite à vontade 😊');
}

init();
