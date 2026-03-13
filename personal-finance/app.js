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
        debts:    state.debts,
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

// ── i18n ───────────────────────────────────────────────────
const i18n = {
  pt: {
    nav_dashboard:'Dashboard', nav_income:'Rendimentos', nav_expenses:'Gastos',
    nav_goals:'Metas', nav_debts:'Dívidas', nav_learn:'Aprender',
    kpi_income:'Renda Mensal', kpi_expense:'Total de Gastos',
    kpi_debt_service:'Parcelas/Mês', kpi_balance:'Saldo Livre',
    kpi_savings:'Taxa de Poupança', kpi_savings_sub:'ideal: acima de 20%',
    debt_commit_title:'Endividamento Mensal', debt_commit_link:'Gerenciar dívidas →',
    learn_prev:'Introdução', learn_next:'Aprofundar',
  },
  en: {
    nav_dashboard:'Dashboard', nav_income:'Income', nav_expenses:'Expenses',
    nav_goals:'Goals', nav_debts:'Debts', nav_learn:'Learn',
    kpi_income:'Monthly Income', kpi_expense:'Total Expenses',
    kpi_debt_service:'Monthly Installments', kpi_balance:'Free Balance',
    kpi_savings:'Savings Rate', kpi_savings_sub:'ideal: above 20%',
    debt_commit_title:'Monthly Debt Exposure', debt_commit_link:'Manage debts →',
    learn_prev:'Overview', learn_next:'Deep Dive',
  },
};

function t(key) {
  return (i18n[state.lang] || i18n.pt)[key] || key;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = t(el.dataset.i18n);
    if (val) el.textContent = val;
  });
  document.documentElement.lang = state.lang === 'pt' ? 'pt-BR' : 'en';
  const btn = document.getElementById('langToggle');
  if (btn) {
    btn.textContent = state.lang === 'pt' ? 'EN' : 'PT';
    btn.title       = state.lang === 'pt' ? 'Switch to English' : 'Mudar para Português';
  }
  const titleMap = state.lang === 'pt'
    ? { dashboard:'Dashboard', income:'Rendimentos', expenses:'Gastos', goals:'Metas', debts:'Dívidas', learn:'Aprender' }
    : { dashboard:'Dashboard', income:'Income',      expenses:'Expenses', goals:'Goals', debts:'Debts',  learn:'Learn' };
  Object.assign(pageTitles, titleMap);
  const active = pages.find(p => document.getElementById(`page-${p}`)?.classList.contains('active'));
  if (active) document.getElementById('topbarTitle').textContent = pageTitles[active] || active;
}

// ── State ──────────────────────────────────────────────────
const state = {
  incomes: [],
  expenses: [],
  goals: [],
  debts: [],
  theme: 'light',
  lang: 'pt',
  expenseFilter: 'all',
  debtFilter: 'all',
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
  localStorage.setItem('fs_debts',    JSON.stringify(state.debts));
  localStorage.setItem('fs_theme',    state.theme);
  localStorage.setItem('fs_lang',     state.lang);
  scheduleSync();
}

function load() {
  state.incomes  = JSON.parse(localStorage.getItem('fs_incomes')  || '[]');
  state.expenses = JSON.parse(localStorage.getItem('fs_expenses') || '[]');
  state.goals    = JSON.parse(localStorage.getItem('fs_goals')    || '[]');
  state.debts    = JSON.parse(localStorage.getItem('fs_debts')    || '[]');
  state.theme    = localStorage.getItem('fs_theme') || 'light';
  state.lang     = localStorage.getItem('fs_lang')  || 'pt';
}

async function loadFromServer() {
  if (!auth.token || !auth.serverAvailable) return false;
  try {
    const data = await apiCall('GET', '/data');
    state.incomes  = data.incomes  || [];
    state.expenses = data.expenses || [];
    state.goals    = data.goals    || [];
    state.debts    = data.debts    || [];
    state.theme    = data.theme    || 'light';
    // Persist locally too
    localStorage.setItem('fs_incomes',  JSON.stringify(state.incomes));
    localStorage.setItem('fs_expenses', JSON.stringify(state.expenses));
    localStorage.setItem('fs_goals',    JSON.stringify(state.goals));
    localStorage.setItem('fs_debts',    JSON.stringify(state.debts));
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
  renderDashboard();
  renderMonthlyBreakdown('income');
  renderMonthlyBreakdown('expense');
});

document.getElementById('langToggle').addEventListener('click', () => {
  state.lang = state.lang === 'pt' ? 'en' : 'pt';
  save();
  applyTranslations();
  renderDashboard();
});

// ── Navigation ─────────────────────────────────────────────
const pages = ['dashboard', 'income', 'expenses', 'goals', 'debts', 'learn'];
const pageTitles = { dashboard: 'Dashboard', income: 'Rendimentos', expenses: 'Gastos', goals: 'Metas', debts: 'Dívidas', learn: 'Aprender' };

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
  if (page === 'debts')     renderDebts();
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
function getMonthlyDebtService() {
  return state.debts
    .filter(d => d.status === 'pagando' || d.status === 'em_atraso')
    .reduce((s, d) => s + (d.installmentValue || 0), 0);
}

function renderDashboard() {
  const income       = getMonthlyIncome();
  const expense      = getMonthlyExpense();
  const debtService  = getMonthlyDebtService();
  const balance      = income - expense - debtService;
  const totalCommit  = expense + debtService;
  const savingsRate  = income > 0 ? Math.max(0, (balance / income) * 100) : 0;
  const dti          = income > 0 ? (debtService / income) * 100 : 0;

  // KPI cards
  document.getElementById('kpiIncome').textContent  = fmt(income);
  document.getElementById('kpiExpense').textContent = fmt(expense);
  document.getElementById('kpiBalance').textContent = fmt(balance);
  document.getElementById('kpiSavings').textContent = savingsRate.toFixed(1) + '%';

  document.getElementById('kpiIncomeSub').textContent =
    state.incomes.length === 0 ? (state.lang === 'en' ? 'no entries' : 'nenhum lançamento') :
    `${state.incomes.length} fonte${state.incomes.length > 1 ? 's' : ''}`;
  document.getElementById('kpiExpenseSub').textContent =
    state.expenses.length === 0 ? (state.lang === 'en' ? 'no entries' : 'nenhum lançamento') :
    `${state.expenses.length} item${state.expenses.length > 1 ? 's' : ''}`;

  // Debt KPI
  const activeDebts = state.debts.filter(d => d.status !== 'quitado');
  const dsEl = document.getElementById('kpiDebtService');
  const dsSubEl = document.getElementById('kpiDebtServiceSub');
  if (dsEl) {
    dsEl.textContent = fmt(debtService);
    if (debtService > 0) {
      dsEl.style.color = dti > 35 ? 'var(--danger)' : dti > 20 ? 'var(--warning)' : 'var(--text)';
      dsSubEl.textContent = state.lang === 'en'
        ? `${dti.toFixed(1)}% of income · ${activeDebts.length} debt${activeDebts.length !== 1 ? 's' : ''}`
        : `${dti.toFixed(1)}% da renda · ${activeDebts.length} dívida${activeDebts.length !== 1 ? 's' : ''}`;
    } else {
      dsEl.style.color = '';
      dsSubEl.textContent = state.lang === 'en' ? 'no active debts' : 'sem dívidas ativas';
    }
  }

  // Balance sub-label
  const balSubEl = document.getElementById('kpiBalanceSub');
  if (balSubEl) {
    balSubEl.textContent = debtService > 0
      ? (state.lang === 'en' ? 'income − expenses − installments' : 'receita − gastos − parcelas')
      : (state.lang === 'en' ? 'income − expenses' : 'receita − gastos');
  }

  document.getElementById('kpiBalance').style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';

  renderHealthScore(savingsRate, income, expense, dti);
  renderMainAlert(income, expense, balance, savingsRate, debtService);
  renderDebtDashCard(income, debtService, dti, activeDebts);
  renderExpenseChart();
  renderBalanceChart(income, expense, debtService);
  renderDashMonthlyChart();
  renderInsights(income, expense, balance, savingsRate, debtService, dti);
  renderGoalsPreview();
}

function renderDebtDashCard(income, debtService, dti, activeDebts) {
  const card = document.getElementById('debtDashCard');
  if (!card) return;
  if (activeDebts.length === 0) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  const totalRemaining = activeDebts.reduce((s, d) => s + d.remainingAmount, 0);
  const overdueCount   = activeDebts.filter(d => d.overdueInstallments > 0).length;
  const lg             = state.lang;

  // Sort by interest rate desc for analyst insight
  const highest = [...activeDebts].sort((a, b) => b.interestRate - a.interestRate)[0];

  document.getElementById('debtDashContent').innerHTML = `
    <div class="debt-dash-grid">
      <div class="ddc-stat">
        <div class="ddc-label">${lg === 'en' ? 'Outstanding Balance' : 'Saldo Devedor Total'}</div>
        <div class="ddc-value" style="color:var(--danger)">${fmt(totalRemaining)}</div>
      </div>
      <div class="ddc-stat">
        <div class="ddc-label">${lg === 'en' ? 'Monthly Service' : 'Custo Mensal'}</div>
        <div class="ddc-value">${fmt(debtService)}</div>
        <div class="ddc-sub">${dti.toFixed(1)}% ${lg === 'en' ? 'of income (DTI)' : 'da renda (DTI)'}</div>
      </div>
      <div class="ddc-stat">
        <div class="ddc-label">${lg === 'en' ? 'Active Debts' : 'Dívidas Ativas'}</div>
        <div class="ddc-value">${activeDebts.length}</div>
        ${overdueCount > 0 ? `<div class="ddc-sub ddc-danger"><i class="fa-solid fa-triangle-exclamation"></i> ${overdueCount} ${lg === 'en' ? 'overdue' : 'em atraso'}</div>` : ''}
      </div>
      <div class="ddc-stat">
        <div class="ddc-label">${lg === 'en' ? 'Highest Rate' : 'Maior Taxa'}</div>
        <div class="ddc-value" style="color:${highest.interestRate > 5 ? 'var(--danger)' : 'var(--warning)'}">
          ${highest.interestRate > 0 ? `${highest.interestRate}% a.${highest.rateType === 'mensal' ? 'm' : 'a'}.` : '—'}
        </div>
        <div class="ddc-sub">${escHtml(highest.name)}</div>
      </div>
    </div>
    <div class="ddc-dti-bar">
      <div class="ddc-dti-label">
        <span>${lg === 'en' ? 'Debt-to-Income (DTI)' : 'Comprometimento com Dívidas (DTI)'}</span>
        <span class="ddc-dti-pct" style="color:${dti > 35 ? 'var(--danger)' : dti > 20 ? 'var(--warning)' : 'var(--success)'}">${dti.toFixed(1)}%</span>
      </div>
      <div class="ddc-bar-track">
        <div class="ddc-bar-fill" style="width:${Math.min(100, dti)}%;background:${dti > 35 ? 'var(--danger)' : dti > 20 ? 'var(--warning)' : 'var(--success)'}"></div>
        <div class="ddc-bar-marker" style="left:30%" title="${lg === 'en' ? 'Safe limit 30%' : 'Limite seguro 30%'}"></div>
      </div>
      <div class="ddc-dti-zones">
        <span style="color:var(--success)">${lg === 'en' ? '0–20% ideal' : '0–20% ideal'}</span>
        <span style="color:var(--warning)">${lg === 'en' ? '20–35% caution' : '20–35% atenção'}</span>
        <span style="color:var(--danger)">${lg === 'en' ? '>35% danger' : '>35% perigoso'}</span>
      </div>
    </div>
    ${highest.interestRate > 5 ? `
    <div class="ddc-tip">
      <i class="fa-solid fa-lightbulb"></i>
      ${lg === 'en'
        ? `<strong>Analyst tip:</strong> "${escHtml(highest.name)}" at ${highest.interestRate}%/month costs you ${fmt(highest.remainingAmount * (highest.interestRate/100))} in interest this month alone. Prioritize paying it off using the Avalanche method.`
        : `<strong>Dica analítica:</strong> "${escHtml(highest.name)}" a ${highest.interestRate}%/mês te custa ${fmt(highest.remainingAmount * (highest.interestRate/100))} só em juros este mês. Priorize quitar pelo método Avalanche.`
      }
    </div>` : ''}
  `;
}

function renderHealthScore(savingsRate, income, expense, dti = 0) {
  let score = 0;
  if (income > 0 && expense <= income) score += 30;
  if (savingsRate >= 20) score += 25;
  else if (savingsRate >= 10) score += 12;
  if (state.goals.length > 0) score += 10;
  const fixedRatio = state.expenses.filter(e => e.type === 'fixo')
    .reduce((s, e) => s + parseFloat(e.amount), 0) / (income || 1);
  if (fixedRatio <= 0.5) score += 15;
  // Debt health
  if (dti === 0) score += 20;
  else if (dti <= 20) score += 15;
  else if (dti <= 35) score += 5;
  const overdueDebts = state.debts.filter(d => d.overdueInstallments > 0).length;
  if (overdueDebts > 0) score = Math.max(0, score - 20);

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

function renderMainAlert(income, expense, balance, savingsRate, debtService = 0) {
  const box = document.getElementById('mainAlert');
  const lg  = state.lang;
  const overdueDebts = state.debts.filter(d => d.overdueInstallments > 0);
  if (income === 0 && expense === 0 && debtService === 0) { box.style.display = 'none'; return; }
  box.style.display = 'flex';

  // Overdue debts take highest priority
  if (overdueDebts.length > 0) {
    const totalOverdue = overdueDebts.reduce((s, d) => s + d.overdueInstallments, 0);
    box.className = 'alert-box alert-danger';
    box.innerHTML = lg === 'en'
      ? `<i class="fa-solid fa-triangle-exclamation"></i>
         <div><strong>Overdue debt alert!</strong> You have ${overdueDebts.length} debt(s) with ${totalOverdue} overdue installment(s). Each month of delay increases your balance via compound interest. Contact your creditor immediately to negotiate.</div>`
      : `<i class="fa-solid fa-triangle-exclamation"></i>
         <div><strong>Alerta de inadimplência!</strong> Você tem ${overdueDebts.length} dívida(s) com ${totalOverdue} parcela(s) em atraso. Cada mês de atraso aumenta o saldo via juros compostos. Entre em contato com o credor imediatamente para negociar.</div>`;
    return;
  }

  const totalCommit = expense + debtService;
  if (totalCommit > income) {
    box.className = 'alert-box alert-danger';
    box.innerHTML = lg === 'en'
      ? `<i class="fa-solid fa-triangle-exclamation"></i>
         <div><strong>Warning:</strong> Your total commitments (expenses + installments = ${fmt(totalCommit)}) exceed your income. You are going deeper into debt each month.</div>`
      : `<i class="fa-solid fa-triangle-exclamation"></i>
         <div><strong>Atenção:</strong> Seus compromissos totais (gastos + parcelas = ${fmt(totalCommit)}) superam sua renda. Você está se endividando mais a cada mês.</div>`;
  } else if (savingsRate < 10) {
    box.className = 'alert-box alert-warning';
    box.innerHTML = lg === 'en'
      ? `<i class="fa-solid fa-circle-info"></i>
         <div><strong>Almost there!</strong> Your savings rate is ${savingsRate.toFixed(1)}%. Aim for at least 20% of income.</div>`
      : `<i class="fa-solid fa-circle-info"></i>
         <div><strong>Quase lá!</strong> Sua taxa de poupança está em ${savingsRate.toFixed(1)}%. O ideal é guardar pelo menos 20% da sua renda.</div>`;
  } else if (savingsRate >= 20) {
    box.className = 'alert-box alert-success';
    box.innerHTML = lg === 'en'
      ? `<i class="fa-solid fa-circle-check"></i>
         <div><strong>Excellent!</strong> You are saving ${savingsRate.toFixed(1)}% of your income. Keep going — you are on the right track!</div>`
      : `<i class="fa-solid fa-circle-check"></i>
         <div><strong>Parabéns!</strong> Você está poupando ${savingsRate.toFixed(1)}% da renda. Continue assim — você está no caminho certo!</div>`;
  } else {
    box.className = 'alert-box alert-info';
    box.innerHTML = lg === 'en'
      ? `<i class="fa-solid fa-circle-info"></i>
         <div><strong>Good progress!</strong> You save ${savingsRate.toFixed(1)}%. Try to reach 20% to accelerate your financial goals.</div>`
      : `<i class="fa-solid fa-circle-info"></i>
         <div><strong>Bom progresso!</strong> Você poupa ${savingsRate.toFixed(1)}%. Tente chegar a 20% para acelerar seus sonhos financeiros.</div>`;
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

function renderBalanceChart(income, expense, debtService = 0) {
  const canvas    = document.getElementById('balanceChart');
  const gridColor = state.theme === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const textColor = state.theme === 'dark' ? '#94a3b8' : '#475569';
  const lg        = state.lang;
  const freeBalance = income - expense - debtService;

  const labels = debtService > 0
    ? [lg === 'en' ? 'Income' : 'Renda', lg === 'en' ? 'Expenses' : 'Gastos', lg === 'en' ? 'Installments' : 'Parcelas', lg === 'en' ? 'Free Balance' : 'Saldo Livre']
    : [lg === 'en' ? 'Income' : 'Rendimentos', lg === 'en' ? 'Expenses' : 'Gastos', lg === 'en' ? 'Balance' : 'Saldo'];
  const data = debtService > 0
    ? [income, expense, debtService, Math.abs(freeBalance)]
    : [income, expense, Math.abs(income - expense)];
  const colors = debtService > 0
    ? ['rgba(16,185,129,.8)', 'rgba(239,68,68,.8)', 'rgba(249,115,22,.8)',
        freeBalance >= 0 ? 'rgba(99,102,241,.8)' : 'rgba(239,68,68,.4)']
    : ['rgba(16,185,129,.8)', 'rgba(239,68,68,.8)',
        income >= expense ? 'rgba(99,102,241,.8)' : 'rgba(239,68,68,.4)'];

  if (balanceChart) balanceChart.destroy();
  balanceChart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 8, borderSkipped: false }] },
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
function renderInsights(income, expense, balance, savingsRate, debtService = 0, dti = 0) {
  const list     = document.getElementById('insightsList');
  const insights = [];
  const lg       = state.lang;
  const totalCommit = expense + debtService;

  if (income === 0) {
    list.innerHTML = `<div class="insight-empty">
      <i class="fa-solid fa-wand-magic-sparkles"></i>
      <p>${lg === 'en' ? 'Add your income and expenses to receive personalised tips!' : 'Adicione seus rendimentos e gastos para receber dicas personalizadas!'}</p>
    </div>`;
    return;
  }

  // ── Debt insights (from real state.debts data) ──────────
  const overdueDebts = state.debts.filter(d => d.overdueInstallments > 0);
  if (overdueDebts.length > 0) {
    const totalInst = overdueDebts.reduce((s, d) => s + d.overdueInstallments, 0);
    insights.push({ type:'danger', icon:'fa-triangle-exclamation',
      title: lg === 'en' ? 'Overdue installments — act now!' : 'Parcelas em atraso — aja agora!',
      desc: lg === 'en'
        ? `${overdueDebts.length} debt(s) with ${totalInst} overdue installment(s). Late fees and compound interest can double your debt in months. Negotiate immediately.`
        : `${overdueDebts.length} dívida(s) com ${totalInst} parcela(s) em atraso. Juros rotativos podem dobrar sua dívida em meses. Negocie imediatamente.`
    });
  }

  if (dti > 35 && debtService > 0) {
    const sorted = [...state.debts.filter(d => d.status !== 'quitado')].sort((a, b) => b.interestRate - a.interestRate);
    const worst  = sorted[0];
    insights.push({ type:'danger', icon:'fa-percent',
      title: lg === 'en' ? `High DTI ratio: ${dti.toFixed(1)}%` : `DTI elevado: ${dti.toFixed(1)}%`,
      desc: lg === 'en'
        ? `${dti.toFixed(1)}% of your income goes to debt service. Safe threshold is 30%. Focus on the Avalanche method — attack "${worst?.name}" first (highest rate: ${worst?.interestRate}%).`
        : `${dti.toFixed(1)}% da renda vai para parcelas. O limite saudável é 30%. Use o Método Avalanche — ataque "${worst?.name}" primeiro (maior taxa: ${worst?.interestRate}%).`
    });
  } else if (dti > 0 && dti <= 20) {
    insights.push({ type:'success', icon:'fa-check-circle',
      title: lg === 'en' ? `Healthy debt ratio: ${dti.toFixed(1)}%` : `DTI saudável: ${dti.toFixed(1)}%`,
      desc: lg === 'en'
        ? `Only ${dti.toFixed(1)}% of income goes to debt service — well below the 30% danger zone. Keep this ratio controlled as you grow income.`
        : `Apenas ${dti.toFixed(1)}% da renda vai para dívidas — bem abaixo do limite de 30%. Mantenha esse controle conforme a renda cresce.`
    });
  }

  // Check for high-interest debts (>5% am = credit card territory)
  const highRateDebts = state.debts.filter(d => d.status !== 'quitado' && d.rateType === 'mensal' && d.interestRate > 5);
  if (highRateDebts.length > 0) {
    const monthCost = highRateDebts.reduce((s, d) => s + d.remainingAmount * (d.interestRate / 100), 0);
    insights.push({ type:'danger', icon:'fa-fire',
      title: lg === 'en' ? 'Predatory interest rates detected!' : 'Juros predatórios detectados!',
      desc: lg === 'en'
        ? `${highRateDebts.length} debt(s) above 5%/month costing you ${fmt(monthCost)}/month in interest alone. Consider personal loan consolidation (2–3%/month) to cut costs immediately.`
        : `${highRateDebts.length} dívida(s) acima de 5%/mês custando ${fmt(monthCost)}/mês só em juros. Considere consolidar em empréstimo pessoal (2–3%/mês) para cortar esse custo imediatamente.`
    });
  }

  // ── Income / expense insights ───────────────────────────
  if (totalCommit > income) {
    insights.push({ type:'danger', icon:'fa-fire',
      title: lg === 'en' ? 'Total commitments exceed income!' : 'Compromissos totais excedem a renda!',
      desc: lg === 'en'
        ? `Expenses (${fmt(expense)}) + installments (${fmt(debtService)}) = ${fmt(totalCommit)} vs income ${fmt(income)}. You are accumulating debt every month.`
        : `Gastos (${fmt(expense)}) + parcelas (${fmt(debtService)}) = ${fmt(totalCommit)} vs renda ${fmt(income)}. Você acumula dívida a cada mês.`
    });
  }

  if (savingsRate < 10 && income > 0 && totalCommit <= income) {
    insights.push({ type:'warning', icon:'fa-piggy-bank',
      title: lg === 'en' ? 'Savings rate too low' : 'Taxa de poupança muito baixa',
      desc: lg === 'en'
        ? `You save ${savingsRate.toFixed(1)}% — target is 20%. Pay yourself first: transfer savings the day you get paid, before any other expense.`
        : `Você poupa ${savingsRate.toFixed(1)}% — ideal é 20%. Pague-se primeiro: transfira os 20% assim que receber, antes de qualquer gasto.`
    });
  } else if (savingsRate >= 20) {
    insights.push({ type:'success', icon:'fa-star',
      title: lg === 'en' ? 'Savings above target!' : 'Poupança acima do ideal!',
      desc: lg === 'en'
        ? `You save ${savingsRate.toFixed(1)}% — excellent! Now diversify: Tesouro Direto, CDB, equity funds.`
        : `Você poupa ${savingsRate.toFixed(1)}% — excelente! Pense agora em diversificar investimentos (Tesouro Direto, CDB, fundos).`
    });
  }

  const fixedTotal = state.expenses.filter(e => e.type === 'fixo').reduce((s,e) => s + parseFloat(e.amount), 0);
  const fixedRatio = income > 0 ? (fixedTotal + debtService) / income : 0;
  if (fixedRatio > 0.6) {
    insights.push({ type:'danger', icon:'fa-lock',
      title: lg === 'en' ? 'Fixed costs too high' : 'Custos fixos muito altos',
      desc: lg === 'en'
        ? `Fixed expenses + installments = ${(fixedRatio*100).toFixed(0)}% of income (target: ≤50%). Renegotiate contracts, downgrade plans, cancel unused services.`
        : `Fixos + parcelas representam ${(fixedRatio*100).toFixed(0)}% da renda (ideal: até 50%). Renegocie contratos, troque planos, cancele o que não usa.`
    });
  }

  const leisure = state.expenses.filter(e => e.category === 'lazer').reduce((s,e) => s + parseFloat(e.amount), 0);
  if (income > 0 && leisure / income > 0.3) {
    insights.push({ type:'warning', icon:'fa-masks-theater',
      title: lg === 'en' ? 'Leisure budget over limit' : 'Lazer comprometendo o orçamento',
      desc: lg === 'en'
        ? `Leisure is ${((leisure/income)*100).toFixed(0)}% of income. The 50-30-20 rule caps desires at 30%.`
        : `Lazer em ${((leisure/income)*100).toFixed(0)}% da renda. A regra 50-30-20 sugere máximo 30% para desejos.`
    });
  }

  const subs = state.expenses.filter(e => e.category === 'assinaturas').reduce((s,e) => s + parseFloat(e.amount), 0);
  if (subs > 0) {
    insights.push({ type:'info', icon:'fa-mobile-screen',
      title: lg === 'en' ? 'Review your subscriptions' : 'Revise suas assinaturas',
      desc: lg === 'en'
        ? `You spend ${fmt(subs)} on subscriptions. Cancel what you don't use — automatic charges are easy to forget.`
        : `Você gasta ${fmt(subs)} em assinaturas. Cancele o que não usa — é fácil esquecer de serviços que cobram automaticamente.`
    });
  }

  if (state.goals.length === 0) {
    insights.push({ type:'info', icon:'fa-bullseye',
      title: lg === 'en' ? 'Set a financial goal' : 'Defina uma meta financeira',
      desc: lg === 'en'
        ? 'People with clear goals save more consistently. Create your first goal in the Goals tab!'
        : 'Quem tem objetivos claros economiza mais. Crie sua primeira meta na aba Metas!'
    });
  }

  if (savingsRate > 0 && state.debts.filter(d => d.status !== 'quitado').length === 0) {
    insights.push({ type:'info', icon:'fa-shield-halved',
      title: lg === 'en' ? 'Build your emergency fund' : 'Crie uma reserva de emergência',
      desc: lg === 'en'
        ? `Have 3–6 months of expenses saved. With ${fmt(expense)}/month in expenses, you need at least ${fmt(expense * 4)} in a liquid, safe investment.`
        : `Tenha 3–6 meses de gastos guardados. Com ${fmt(expense)}/mês de gastos, você precisa de ${fmt(expense * 4)} como reserva mínima em investimento líquido.`
    });
  }

  if (insights.length === 0) {
    insights.push({ type:'success', icon:'fa-trophy',
      title: lg === 'en' ? 'Your finances look healthy!' : 'Suas finanças estão saudáveis!',
      desc: lg === 'en'
        ? 'Keep monitoring and consider diversifying investments to make your money work for you.'
        : 'Continue monitorando e pense em diversificar investimentos para o dinheiro trabalhar por você.'
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
let learnCurrentPage = 0;
let learnCurrentModule = null;

const learnContent = {
  regra50: {
    title: '📊 A Regra 50-30-20',
    pages: [
      `<p>Essa é a estratégia mais simples e eficaz para organizar o seu orçamento. Criada pela senadora americana Elizabeth Warren, divide sua renda líquida em três partes:</p>
      <div class="rule-visual">
        <div class="rule-block rule-50">50%<small>Necessidades</small></div>
        <div class="rule-block rule-30">30%<small>Desejos</small></div>
        <div class="rule-block rule-20">20%<small>Poupança</small></div>
      </div>
      <h4><i class="fa-solid fa-house"></i> 50% — Necessidades</h4>
      <p>Aluguel, mercado, transporte, luz, água, saúde e parcelas de dívidas. Se passar de 50%, você precisa cortar ou aumentar a renda.</p>
      <h4><i class="fa-solid fa-star"></i> 30% — Desejos</h4>
      <p>Restaurantes, viagens, roupas extras, streaming. Válidos, mas com limite claro.</p>
      <h4><i class="fa-solid fa-piggy-bank"></i> 20% — Poupança</h4>
      <p><strong>Pague-se primeiro:</strong> transfira os 20% assim que receber, antes de qualquer gasto. Automatize essa transferência.</p>`,

      `<h4><i class="fa-solid fa-sliders"></i> Adaptando para sua realidade</h4>
      <p>A regra 50-30-20 é um ponto de partida, não uma lei rígida. Se você tem dívidas com juros altos, redistribua temporariamente para <strong>50-20-30</strong> — mais para quitar dívidas, menos para desejos.</p>
      <h4><i class="fa-solid fa-calculator"></i> Exemplo prático com renda de R$ 5.000</h4>
      <ul>
        <li><strong>R$ 2.500 (50%)</strong> → Aluguel, mercado, transporte, plano de saúde, parcelas</li>
        <li><strong>R$ 1.500 (30%)</strong> → Restaurantes, Netflix, roupas, lazer</li>
        <li><strong>R$ 1.000 (20%)</strong> → Reserva de emergência, investimentos, metas</li>
      </ul>
      <h4><i class="fa-solid fa-triangle-exclamation"></i> Por que a maioria falha?</h4>
      <p>O erro mais comum é não classificar corretamente. Assinatura de academia é <em>necessidade</em> ou <em>desejo</em>? Se você vai 4x por semana, pode ser necessidade. Se vai 1x, é desejo. Seja honesto consigo.</p>
      <h4><i class="fa-solid fa-lightbulb"></i> Dica de analista</h4>
      <p>Revise sua alocação a cada 6 meses. À medida que a renda cresce, o ideal é manter os 50% de necessidades no valor absoluto (não deixar crescer junto) e direcionar o excedente para poupança.</p>`,
    ],
  },
  emergencia: {
    title: '🛡️ Reserva de Emergência',
    pages: [
      `<p>A base de toda vida financeira saudável. Sem ela, qualquer imprevisto — carro na oficina, demissão, problema de saúde — vira dívida de juros altos.</p>
      <h4><i class="fa-solid fa-calculator"></i> Quanto guardar?</h4>
      <ul>
        <li><strong>Mínimo:</strong> 3 meses de gastos essenciais (emprego CLT estável)</li>
        <li><strong>Ideal:</strong> 6 meses de todos os seus gastos mensais</li>
        <li><strong>Autônomos / PJ:</strong> 12 meses — sua renda é variável e o risco é maior</li>
      </ul>
      <h4><i class="fa-solid fa-bank"></i> Onde guardar? (liquidez imediata é obrigatória)</h4>
      <ul>
        <li><strong>Tesouro Selic</strong> — mais seguro do Brasil, resgate em D+1, rendimento próximo à Selic</li>
        <li><strong>CDB com liquidez diária acima de 100% CDI</strong> — bancos digitais oferecem isso</li>
        <li><strong>Conta remunerada</strong> de fintech (Nubank, Inter, C6) — prático e rende CDI</li>
      </ul>`,

      `<h4><i class="fa-solid fa-stairs"></i> Como construir do zero, passo a passo</h4>
      <p>Se você não tem reserva alguma, não entre em pânico. Construa em etapas:</p>
      <ul>
        <li><strong>Meta 1:</strong> R$ 1.000 — "para o extintor" (cobre imprevistos pequenos e evita cartão de crédito rotativo)</li>
        <li><strong>Meta 2:</strong> 1 mês de gastos — estabilidade básica</li>
        <li><strong>Meta 3:</strong> 3 meses — zona de conforto</li>
        <li><strong>Meta 4:</strong> 6 meses — independência financeira real</li>
      </ul>
      <h4><i class="fa-solid fa-circle-question"></i> Quando usar a reserva?</h4>
      <p>Use <strong>apenas</strong> para emergências reais: perda de emprego, problema de saúde urgente, carro essencial para trabalho. Viagem, eletrônico novo ou promoção <strong>não são emergências</strong>.</p>
      <h4><i class="fa-solid fa-arrows-rotate"></i> Depois de usar, reconstrua</h4>
      <p>Se precisou usar, priorize recompletar a reserva antes de qualquer outro investimento. É o seu escudo financeiro — sem ele, você está exposto.</p>
      <h4><i class="fa-solid fa-lightbulb"></i> Dica de analista</h4>
      <p>Mantenha a reserva em conta <em>separada</em> do banco do dia a dia. A fricção de precisar transferir ajuda a resistir ao impulso de usar o dinheiro para coisas não emergenciais.</p>`,
    ],
  },
  dividas: {
    title: '💳 Como Sair das Dívidas',
    pages: [
      `<p>Com a estratégia certa, é possível sair do vermelho mesmo com renda limitada. O segredo é método, não sorte.</p>
      <h4><i class="fa-solid fa-snowflake"></i> Método Bola de Neve (Snowball)</h4>
      <p>Quite a <strong>dívida de menor saldo</strong> primeiro, independente dos juros. A cada dívida quitada, redirecione o valor da parcela para a próxima. O benefício é psicológico: vitórias rápidas criam momentum e motivam a continuar.</p>
      <h4><i class="fa-solid fa-mountain"></i> Método Avalanche (matematicamente superior)</h4>
      <p>Quite a <strong>dívida com maior taxa de juros</strong> primeiro. Você paga menos juros no total e sai das dívidas mais rápido. Melhor para quem tem disciplina e foco no longo prazo.</p>
      <h4><i class="fa-solid fa-fire"></i> Cartão rotativo e cheque especial: emergência máxima</h4>
      <p>Juros de 12–18% ao <strong>mês</strong> (mais de 200% ao ano). Troque por empréstimo pessoal (2–4% ao mês) <strong>imediatamente</strong>. Essa troca sozinha pode economizar milhares de reais.</p>`,

      `<h4><i class="fa-solid fa-handshake"></i> Como negociar com credores</h4>
      <p>Bancos e credoras preferem receber menos do que não receber nada. Dicas para negociação:</p>
      <ul>
        <li>Acesse portais como <strong>Serasa Limpa Nome</strong> ou <strong>Acordo Certo</strong> — descontos de até 99% em dívidas antigas</li>
        <li>Ligue direto para o credor e pergunte sobre <em>proposta de quitação</em> — sempre há margem</li>
        <li>Priorize dívidas com garantia real (financiamento de carro, hipoteca) — o bem pode ser retomado</li>
      </ul>
      <h4><i class="fa-solid fa-chart-line"></i> Entendendo os juros compostos (seu inimigo)</h4>
      <p>Uma dívida de R$ 10.000 a 10% ao mês se torna R$ 31.384 em apenas 12 meses. Juros compostos trabalham <em>contra</em> você nas dívidas e <em>a favor</em> nos investimentos. Quanto mais tempo passa, pior fica.</p>
      <h4><i class="fa-solid fa-shield-halved"></i> Prevenção: os 3 princípios</h4>
      <ul>
        <li><strong>Nunca use o limite do cartão como extensão da renda</strong> — é crédito, não salário</li>
        <li><strong>Parcele apenas o que cabe no orçamento total</strong> — some todas as parcelas antes de comprar</li>
        <li><strong>Tenha reserva de emergência</strong> — ela evita que imprevistos virem dívidas</li>
      </ul>`,
    ],
  },
  orcamento: {
    title: '📋 Como Fazer um Orçamento Real',
    pages: [
      `<p>Orçamento não é restrição — é <strong>liberdade consciente</strong> para gastar no que realmente importa e parar de gastar no que não importa.</p>
      <h4><i class="fa-solid fa-1"></i> Liste todos os rendimentos com precisão</h4>
      <p>Salário líquido (depois do IR e INSS), freelas, aluguéis, dividendos. Use valores reais dos últimos 3 meses, não estimativas otimistas.</p>
      <h4><i class="fa-solid fa-2"></i> Mapeie <em>todos</em> os gastos — sem exceção</h4>
      <p>Abra os extratos bancários e de cartão dos últimos 3 meses. Categorize tudo, incluindo o cafezinho. Surpresa: a maioria das pessoas subestima seus gastos em 20–30%.</p>
      <h4><i class="fa-solid fa-3"></i> Separe fixos de variáveis</h4>
      <p><strong>Fixos:</strong> aluguel, prestações, planos, assinaturas. <strong>Variáveis:</strong> mercado, lazer, roupas, saúde. Fixos são difíceis de cortar no curto prazo; comece reduzindo variáveis.</p>
      <h4><i class="fa-solid fa-4"></i> Defina metas de gasto por categoria</h4>
      <p>Compare o real com o ideal (regra 50-30-20) e ajuste progressivamente. Cortes bruscos não sustentam — reduza 10–15% por mês.</p>`,

      `<h4><i class="fa-solid fa-box"></i> Método dos Envelopes (modernizado)</h4>
      <p>Crie contas separadas por categoria de gasto — ou use o recurso de "cofrinhos" de bancos digitais. Quando o envelope de lazer esvazia, acabou para o mês. Sem negociação.</p>
      <h4><i class="fa-solid fa-zero"></i> Orçamento Base Zero</h4>
      <p>Técnica usada por grandes empresas: cada centavo da renda tem destino definido. <strong>Renda − todos os gastos planejados = R$ 0,00</strong>. Nada "sobra" — o que iria sobrar já tem destino (investimento, meta, reserva).</p>
      <h4><i class="fa-solid fa-calendar-check"></i> Rituais que funcionam</h4>
      <ul>
        <li><strong>Revisão semanal (5 min):</strong> compare lançamentos reais com o planejado</li>
        <li><strong>Fechamento mensal (15 min):</strong> avalie o mês, ajuste o próximo</li>
        <li><strong>Planejamento anual (2h):</strong> metas grandes, gastos sazonais (IPTU, IPVA, férias, 13º)</li>
      </ul>
      <h4><i class="fa-solid fa-lightbulb"></i> O erro mais caro</h4>
      <p>Ignorar gastos sazonais no orçamento mensal. Divida despesas anuais por 12 e reserve mensalmente. Exemplo: IPVA de R$ 3.600/ano = reserve R$ 300/mês em conta separada.</p>`,
    ],
  },
  investir: {
    title: '📈 Começando a Investir do Zero',
    pages: [
      `<p><strong>Pré-requisitos obrigatórios:</strong> ✅ Reserva de emergência completa e ✅ dívidas de alto custo (acima de 10% a.m.) quitadas. Investir com dívida cara é como encher uma banheira com o ralo aberto.</p>
      <h4><i class="fa-solid fa-shield"></i> Renda fixa — onde começar (baixo risco)</h4>
      <ul>
        <li><strong>Tesouro Selic:</strong> o investimento mais seguro do Brasil. Rende a taxa Selic (hoje ~10-13% a.a.), mínimo R$ 30, liquidez D+1.</li>
        <li><strong>CDB de banco digital:</strong> busque 110–120% do CDI com liquidez diária. Garantia do FGC até R$ 250k por CPF por instituição.</li>
        <li><strong>LCI/LCA:</strong> isentos de Imposto de Renda para pessoa física. Geralmente requerem carência de 90 dias.</li>
      </ul>
      <h4><i class="fa-solid fa-building-columns"></i> A regra de ouro</h4>
      <p><strong>Consistência supera performance.</strong> R$ 500/mês investidos por 20 anos a 10% a.a. = R$ 378.000. Esperar "ter mais para investir" custa caro demais.</p>`,

      `<h4><i class="fa-solid fa-chart-pie"></i> Alocação de ativos — a jornada do investidor</h4>
      <p>À medida que constrói patrimônio, diversifique progressivamente:</p>
      <ul>
        <li><strong>Fase 1 (0–R$ 20k):</strong> 100% renda fixa (reserva + CDB/Tesouro)</li>
        <li><strong>Fase 2 (R$ 20k–R$ 100k):</strong> 70% renda fixa + 20% fundos de índice (IVVB11, BOVA11) + 10% FIIs</li>
        <li><strong>Fase 3 (>R$ 100k):</strong> comece a estudar ações individuais e diversificação internacional</li>
      </ul>
      <h4><i class="fa-solid fa-clock"></i> O poder dos juros compostos a favor</h4>
      <p>Albert Einstein chamou de "a oitava maravilha do mundo". R$ 10.000 a 10% a.a. se tornam:</p>
      <ul>
        <li>R$ 25.937 em 10 anos</li>
        <li>R$ 67.275 em 20 anos</li>
        <li>R$ 174.494 em 30 anos</li>
      </ul>
      <h4><i class="fa-solid fa-triangle-exclamation"></i> Armadilhas clássicas do iniciante</h4>
      <ul>
        <li><strong>Market timing:</strong> tentar "comprar na baixa, vender na alta" consistentemente é impossível até para profissionais</li>
        <li><strong>Perseguir rentabilidade passada:</strong> o fundo que rendeu 50% no ano passado raramente repete</li>
        <li><strong>Ignorar taxas:</strong> 2% de taxa de administração pode consumir 40% do seu patrimônio em 30 anos</li>
      </ul>`,
    ],
  },
  habitos: {
    title: '🧠 Hábitos Financeiros que Mudam Tudo',
    pages: [
      `<h4><i class="fa-solid fa-robot"></i> Automatize tudo que puder</h4>
      <p>Configure transferência automática para investimentos no <em>mesmo dia</em> do salário. O que sai antes de você ver, não é sentido como falta. Esse princípio é chamado de "poupança involuntária" e é responsável por 90% dos patrimônios construídos por assalariados.</p>
      <h4><i class="fa-solid fa-cart-shopping"></i> A regra das 24 horas</h4>
      <p>Antes de qualquer compra não planejada acima de R$ 150, espere 24 horas. Para compras acima de R$ 1.000, espere 7 dias. A maioria do impulso passa — estudos mostram que 60–70% das compras por impulso não são realizadas após o período de espera.</p>
      <h4><i class="fa-solid fa-sun"></i> Revise as finanças toda semana</h4>
      <p>5 minutos toda segunda-feira para conferir os lançamentos da semana anterior evita surpresas no fim do mês e mantém a consciência financeira ativa.</p>
      <h4><i class="fa-solid fa-heart"></i> O teste do "eu futuro"</h4>
      <p>Antes de cada gasto relevante, pergunte: <em>"Meu eu de daqui a 1 ano vai agradecer por essa compra?"</em> Se a resposta for não, provavelmente é impulso — não necessidade.</p>`,

      `<h4><i class="fa-solid fa-brain"></i> A psicologia do dinheiro (vieses que te sabotam)</h4>
      <ul>
        <li><strong>Aversão à perda:</strong> a dor de perder R$ 100 é 2x maior que o prazer de ganhar R$ 100. Por isso postergamos cortar gastos — parece uma "perda".</li>
        <li><strong>Desconto hiperbólico:</strong> preferimos R$ 100 hoje a R$ 150 em 1 mês, mesmo sendo irracional. Combata isso tornando o futuro mais "real" com metas concretas e visuais.</li>
        <li><strong>Comparação social:</strong> gastar para "manter aparências" é a maior fonte de endividamento da classe média. O vizinho com carro novo pode estar afundado em parcelas.</li>
      </ul>
      <h4><i class="fa-solid fa-trophy"></i> Construindo identidade financeira</h4>
      <p>O maior salto financeiro acontece quando você para de <em>fazer</em> coisas financeiras saudáveis e começa a <em>ser</em> uma pessoa financeiramente saudável. A identidade precede o comportamento.</p>
      <h4><i class="fa-solid fa-book"></i> Leituras recomendadas</h4>
      <ul>
        <li><strong>A Psicologia Financeira</strong> — Morgan Housel (o melhor livro sobre comportamento e dinheiro)</li>
        <li><strong>Pai Rico, Pai Pobre</strong> — Robert Kiyosaki (conceitos de ativos e passivos)</li>
        <li><strong>O Homem Mais Rico da Babilônia</strong> — George Clason (princípios atemporais)</li>
      </ul>`,
    ],
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

function openLearnModal(module, page = 0) {
  const content = learnContent[module];
  if (!content) return;
  learnCurrentModule = module;
  learnCurrentPage   = page;
  renderLearnPage();
  document.getElementById('learnModal').classList.add('show');
}

function renderLearnPage() {
  const content = learnContent[learnCurrentModule];
  if (!content) return;
  const pages   = content.pages;
  const page    = learnCurrentPage;
  const total   = pages.length;

  document.getElementById('modalTitle').textContent = content.title;
  document.getElementById('modalBody').innerHTML    = pages[page];

  // Pagination
  const prevBtn = document.getElementById('learnPrev');
  const nextBtn = document.getElementById('learnNext');
  const indEl   = document.getElementById('learnPageIndicator');
  const dotsEl  = document.getElementById('learnPageDots');
  const lg      = state.lang;

  indEl.textContent = `${page + 1} / ${total}`;
  prevBtn.style.visibility = page === 0 ? 'hidden' : 'visible';
  nextBtn.style.visibility = page >= total - 1 ? 'hidden' : 'visible';

  // Update dot labels
  const prevSpan = prevBtn.querySelector('[data-i18n]');
  const nextSpan = nextBtn.querySelector('[data-i18n]');
  if (prevSpan) prevSpan.textContent = lg === 'en' ? 'Overview' : 'Introdução';
  if (nextSpan) nextSpan.textContent = lg === 'en' ? 'Deep Dive' : 'Aprofundar';

  // Dots
  dotsEl.querySelectorAll('.page-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === page);
    dot.style.display = i < total ? '' : 'none';
  });

  // Scroll to top of body
  document.getElementById('modalBody').scrollTop = 0;
}

document.getElementById('learnPrev').addEventListener('click', () => {
  if (learnCurrentPage > 0) { learnCurrentPage--; renderLearnPage(); }
});
document.getElementById('learnNext').addEventListener('click', () => {
  const total = learnContent[learnCurrentModule]?.pages.length || 1;
  if (learnCurrentPage < total - 1) { learnCurrentPage++; renderLearnPage(); }
});
document.querySelectorAll('.page-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    learnCurrentPage = parseInt(dot.dataset.page);
    renderLearnPage();
  });
});

document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('learnModal').classList.remove('show');
});
document.getElementById('learnModal').addEventListener('click', e => {
  if (e.target === document.getElementById('learnModal')) {
    document.getElementById('learnModal').classList.remove('show');
  }
});

// ── DEBTS ───────────────────────────────────────────────────
const debtTypeInfo = {
  bancaria:  { icon: '🏦', label: 'Bancária' },
  hipoteca:  { icon: '🏠', label: 'Hipoteca / Imóvel' },
  carro:     { icon: '🚗', label: 'Financiamento Carro' },
  cartao:    { icon: '💳', label: 'Cartão de Crédito' },
  pessoal:   { icon: '👤', label: 'Empréstimo Pessoal' },
  consorcio: { icon: '🤝', label: 'Consórcio' },
  outros:    { icon: '✨', label: 'Outros' },
};
const debtStatusInfo = {
  pagando:   { label: 'Pagando',    cls: 'debt-status-pagando' },
  em_atraso: { label: 'Em atraso',  cls: 'debt-status-em_atraso' },
  pausado:   { label: 'Pausado',    cls: 'debt-status-pausado' },
  quitado:   { label: 'Quitado',    cls: 'debt-status-quitado' },
};

document.getElementById('debtForm').addEventListener('submit', e => {
  e.preventDefault();
  const remaining  = parseFloat(document.getElementById('debtRemaining').value);
  const installVal = parseFloat(document.getElementById('debtInstallmentValue').value);
  const name       = document.getElementById('debtName').value.trim();
  if (!name || isNaN(remaining) || remaining < 0 || isNaN(installVal) || installVal < 0) return;

  const debt = {
    id:                   uid(),
    name,
    type:                 document.getElementById('debtType').value,
    status:               document.getElementById('debtStatus').value,
    remainingAmount:      remaining,
    totalAmount:          parseFloat(document.getElementById('debtTotalAmount').value) || remaining,
    installmentValue:     installVal,
    dueDay:               parseInt(document.getElementById('debtDueDay').value) || null,
    paidInstallments:     parseInt(document.getElementById('debtPaidInstallments').value) || 0,
    totalInstallments:    parseInt(document.getElementById('debtTotalInstallments').value) || null,
    interestRate:         parseFloat(document.getElementById('debtRate').value) || 0,
    rateType:             document.getElementById('debtRateType').value,
    overdueInstallments:  parseInt(document.getElementById('debtOverdueInstallments').value) || 0,
  };

  state.debts.push(debt);
  save();
  renderDebts();
  e.target.reset();
  document.getElementById('debtOverdueInstallments').value = '0';
  document.getElementById('debtPaidInstallments').value    = '0';
  showToast('Dívida cadastrada! 📋');
});

// Debt filter tabs
document.querySelectorAll('#debtTabs .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#debtTabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.debtFilter = tab.dataset.debtFilter;
    renderDebtList();
  });
});

function renderDebts() {
  renderDebtKPIs();
  renderDebtList();
}

function renderDebtKPIs() {
  const active = state.debts.filter(d => d.status !== 'quitado');
  const total  = active.reduce((s, d) => s + d.remainingAmount, 0);
  const monthly = active
    .filter(d => d.status === 'pagando' || d.status === 'em_atraso')
    .reduce((s, d) => s + d.installmentValue, 0);
  const overdueCount = active.filter(d => d.overdueInstallments > 0).length;
  const income = getMonthlyIncome();
  const burdenPct = income > 0 ? (monthly / income) * 100 : 0;

  document.getElementById('kpiDebtTotal').textContent   = fmt(total);
  document.getElementById('kpiDebtCount').textContent   =
    state.debts.length === 0 ? 'nenhuma dívida' :
    `${active.length} ativa${active.length !== 1 ? 's' : ''}`;
  document.getElementById('kpiDebtMonthly').textContent = fmt(monthly);
  document.getElementById('kpiDebtOverdue').textContent = overdueCount;
  document.getElementById('kpiDebtBurden').textContent  = burdenPct.toFixed(1) + '%';

  const overdueCard = document.getElementById('kpiDebtOverdueCard');
  overdueCard.classList.toggle('has-overdue', overdueCount > 0);
  document.getElementById('kpiDebtOverdueSub').textContent =
    overdueCount > 0 ? `dívida${overdueCount > 1 ? 's' : ''} em atraso!` : 'sem atrasos';

  // Commitment sub-label
  const commitEl = document.getElementById('kpiDebtCommit');
  if (income > 0) {
    commitEl.textContent = `${burdenPct.toFixed(1)}% da renda mensal`;
  } else {
    commitEl.textContent = 'do orçamento mensal';
  }

  // Alert
  const alertEl = document.getElementById('debtAlert');
  if (overdueCount > 0) {
    alertEl.style.display = 'flex';
    alertEl.className = 'alert-box alert-danger';
    alertEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>
      <div><strong>Atenção:</strong> Você tem ${overdueCount} dívida${overdueCount > 1 ? 's' : ''} com parcelas em atraso. Regularize para evitar juros crescentes e negativação.</div>`;
  } else if (burdenPct > 35 && monthly > 0) {
    alertEl.style.display = 'flex';
    alertEl.className = 'alert-box alert-warning';
    alertEl.innerHTML = `<i class="fa-solid fa-circle-info"></i>
      <div><strong>Comprometimento alto:</strong> Suas parcelas consomem ${burdenPct.toFixed(1)}% da renda. O recomendado é até 30%. Considere renegociar prazos.</div>`;
  } else {
    alertEl.style.display = 'none';
  }
}

function renderDebtList() {
  const list = document.getElementById('debtList');
  const filtered = state.debtFilter === 'all'
    ? state.debts
    : state.debts.filter(d => d.status === state.debtFilter);

  if (filtered.length === 0) {
    list.innerHTML = `<div class="list-empty">
      <i class="fa-solid fa-hand-holding-dollar"></i>
      <p>${state.debts.length === 0 ? 'Nenhuma dívida cadastrada ainda.<br>Adicione para controlar seus compromissos.' : 'Nenhuma dívida nessa categoria.'}</p>
    </div>`;
    return;
  }

  list.innerHTML = [...filtered].reverse().map(d => debtCardHTML(d)).join('');
}

function debtCardHTML(d) {
  const typeInfo   = debtTypeInfo[d.type]   || { icon: '✨', label: d.type };
  const statusInfo = debtStatusInfo[d.status] || { label: d.status, cls: '' };

  const pct = d.totalInstallments > 0
    ? Math.min(100, Math.round((d.paidInstallments / d.totalInstallments) * 100))
    : (d.totalAmount > 0
        ? Math.min(100, Math.round(((d.totalAmount - d.remainingAmount) / d.totalAmount) * 100))
        : 0);

  const fillCls = pct >= 100 ? 'fill-done' : d.overdueInstallments > 0 ? 'fill-danger' : '';
  const cardCls = d.status === 'em_atraso' || d.overdueInstallments > 0
    ? 'debt-overdue-card'
    : d.status === 'quitado' ? 'debt-paid-card' : '';

  const rateStr = d.interestRate > 0
    ? `${d.interestRate}% a.${d.rateType === 'mensal' ? 'm' : 'a'}.`
    : '—';

  const installStr = d.totalInstallments
    ? `${d.paidInstallments}/${d.totalInstallments} parcelas`
    : d.paidInstallments > 0 ? `${d.paidInstallments} pagas` : '—';

  return `
    <div class="debt-card ${cardCls}" data-id="${d.id}">
      <div class="debt-card-header">
        <div class="debt-type-icon">${typeInfo.icon}</div>
        <div class="debt-header-info">
          <div class="debt-card-name">${escHtml(d.name)}</div>
          <div class="debt-card-type">${typeInfo.label}</div>
        </div>
        <span class="debt-status-badge ${statusInfo.cls}">${statusInfo.label}</span>
      </div>

      ${d.overdueInstallments > 0 ? `
        <div class="debt-overdue-banner">
          <i class="fa-solid fa-triangle-exclamation"></i>
          ${d.overdueInstallments} parcela${d.overdueInstallments > 1 ? 's' : ''} em atraso!
        </div>` : ''}

      ${d.totalInstallments || d.totalAmount > 0 ? `
        <div class="debt-progress-section">
          <div class="debt-progress-bar">
            <div class="debt-progress-fill ${fillCls}" style="width:${pct}%"></div>
          </div>
          <div class="debt-progress-labels">
            <strong>${installStr}</strong>
            <span>${pct}% quitado</span>
          </div>
        </div>` : ''}

      <div class="debt-details">
        <div class="debt-detail">
          <span class="debt-detail-label">Saldo devedor</span>
          <span class="debt-detail-value" style="color:var(--danger)">${fmt(d.remainingAmount)}</span>
        </div>
        <div class="debt-detail">
          <span class="debt-detail-label">Parcela mensal</span>
          <span class="debt-detail-value">${fmt(d.installmentValue)}</span>
        </div>
        <div class="debt-detail">
          <span class="debt-detail-label">Juros</span>
          <span class="debt-detail-value">${rateStr}</span>
        </div>
        <div class="debt-detail">
          <span class="debt-detail-label">Vencimento</span>
          <span class="debt-detail-value">${d.dueDay ? 'Dia ' + d.dueDay : '—'}</span>
        </div>
      </div>

      <div class="debt-card-actions">
        <button class="btn-debt-edit" onclick="openDebtEdit('${d.id}')">
          <i class="fa-solid fa-pen"></i> Editar
        </button>
        <button class="btn-debt-del" onclick="deleteDebt('${d.id}')" title="Excluir">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

function deleteDebt(id) {
  state.debts = state.debts.filter(d => d.id !== id);
  save();
  renderDebts();
  showToast('Dívida removida', 'danger');
}

function openDebtEdit(id) {
  const d = state.debts.find(x => x.id === id);
  if (!d) return;
  document.getElementById('debtEditId').value           = id;
  document.getElementById('debtEditName').value         = d.name;
  document.getElementById('debtEditType').value         = d.type;
  document.getElementById('debtEditStatus').value       = d.status;
  document.getElementById('debtEditRemaining').value    = d.remainingAmount;
  document.getElementById('debtEditTotalAmount').value  = d.totalAmount || '';
  document.getElementById('debtEditInstallment').value  = d.installmentValue;
  document.getElementById('debtEditDueDay').value       = d.dueDay || '';
  document.getElementById('debtEditPaid').value         = d.paidInstallments || 0;
  document.getElementById('debtEditTotalInst').value    = d.totalInstallments || '';
  document.getElementById('debtEditRate').value         = d.interestRate || '';
  document.getElementById('debtEditRateType').value     = d.rateType || 'mensal';
  document.getElementById('debtEditOverdue').value      = d.overdueInstallments || 0;
  document.getElementById('debtEditModal').classList.add('show');
}

function closeDebtEditModal() {
  document.getElementById('debtEditModal').classList.remove('show');
}

document.getElementById('debtEditClose').addEventListener('click', closeDebtEditModal);
document.getElementById('debtEditModal').addEventListener('click', e => {
  if (e.target === document.getElementById('debtEditModal')) closeDebtEditModal();
});

document.getElementById('debtEditForm').addEventListener('submit', e => {
  e.preventDefault();
  const id = document.getElementById('debtEditId').value;
  const d  = state.debts.find(x => x.id === id);
  if (!d) return;

  d.name                = document.getElementById('debtEditName').value.trim();
  d.type                = document.getElementById('debtEditType').value;
  d.status              = document.getElementById('debtEditStatus').value;
  d.remainingAmount     = parseFloat(document.getElementById('debtEditRemaining').value) || 0;
  d.totalAmount         = parseFloat(document.getElementById('debtEditTotalAmount').value) || d.remainingAmount;
  d.installmentValue    = parseFloat(document.getElementById('debtEditInstallment').value) || 0;
  d.dueDay              = parseInt(document.getElementById('debtEditDueDay').value) || null;
  d.paidInstallments    = parseInt(document.getElementById('debtEditPaid').value) || 0;
  d.totalInstallments   = parseInt(document.getElementById('debtEditTotalInst').value) || null;
  d.interestRate        = parseFloat(document.getElementById('debtEditRate').value) || 0;
  d.rateType            = document.getElementById('debtEditRateType').value;
  d.overdueInstallments = parseInt(document.getElementById('debtEditOverdue').value) || 0;

  save();
  renderDebts();
  closeDebtEditModal();
  showToast('Dívida atualizada! ✅');
});

// ── Expose globals for inline onclick ──────────────────────
window.deleteIncome  = deleteIncome;
window.deleteExpense = deleteExpense;
window.deleteGoal    = deleteGoal;
window.depositGoal   = depositGoal;
window.openEditModal = openEditModal;
window.deleteDebt    = deleteDebt;
window.openDebtEdit  = openDebtEdit;

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
      debts:    state.debts,
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
  applyTranslations();
  renderDashboard();
  renderIncomeList();
  renderExpenseList();
  renderGoalsList();
  renderDebts();
  renderMonthlyBreakdown('income');
  renderMonthlyBreakdown('expense');
}

// ── Init ───────────────────────────────────────────────────
async function init() {
  // 1. Load from localStorage first (instant)
  load();
  applyTheme();
  applyTranslations();

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
