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
    el.innerHTML = `<i class="fa-solid fa-hard-drive"></i> ${t('dropdown_local')}`;
    return;
  }
  if (status === 'ok')
    el.innerHTML = `<i class="fa-solid fa-cloud-arrow-up" style="color:var(--success)"></i> ${t('dropdown_synced')}`;
  else if (status === 'syncing')
    el.innerHTML = `<i class="fa-solid fa-rotate" style="color:var(--warning)"></i> ${t('dropdown_syncing')}`;
  else
    el.innerHTML = `<i class="fa-solid fa-cloud-slash" style="color:var(--danger)"></i> ${t('dropdown_error')}`;
}

// ── i18n ───────────────────────────────────────────────────
const i18n = {
  pt: {
    // Nav
    nav_dashboard:'Dashboard', nav_income:'Rendimentos', nav_expenses:'Gastos',
    nav_goals:'Metas', nav_debts:'Dívidas', nav_learn:'Aprender',
    // Sidebar
    health_label:'Saúde Financeira',
    // Topbar / user
    visitor:'Visitante', local_mode:'Modo local',
    sign_in:'Entrar / Criar conta', sign_out:'Sair',
    // KPIs
    kpi_income:'Renda Mensal', kpi_expense:'Total de Gastos',
    kpi_debt_service:'Parcelas/Mês', kpi_balance:'Saldo Livre',
    kpi_savings:'Taxa de Poupança', kpi_savings_sub:'ideal: acima de 20%',
    // Dashboard sections
    health_badge:'Saúde Financeira', badge_config:'Configure seus dados',
    hero_greeting:'Olá! Vamos cuidar do seu dinheiro? 👋',
    hero_sub:'Aqui você tem uma visão completa da sua saúde financeira — simples e sem complicação.',
    chart_expense_title:'Onde vai seu dinheiro?',
    chart_expense_empty:'Adicione seus gastos para ver o gráfico',
    chart_balance_title:'Este mês: Receita vs Gastos',
    chart_12m_title:'Evolução — Últimos 12 meses',
    chart_12m_empty:'Adicione lançamentos para ver a evolução mensal',
    insights_title:'Pontos de Melhora',
    insights_empty:'Adicione seus rendimentos e gastos para receber dicas personalizadas!',
    goals_preview_title:'Suas Metas', goals_view_all:'Ver todas',
    debt_commit_title:'Endividamento Mensal', debt_commit_link:'Gerenciar dívidas →',
    // Chart labels
    chart_income_label:'Receita', chart_expenses_label:'Gastos',
    chart_installments_label:'Parcelas', chart_incomes_bar:'Rendimentos',
    chart_expenses_bar:'Gastos', chart_accum:'Acumulado',
    // Income page
    income_page_h:'Meus Rendimentos',
    income_page_sub:'Tudo que entra no seu bolso — salário, freelas, aluguéis, dividendos…',
    income_form_h:'Adicionar Rendimento', income_list_h:'Rendimentos cadastrados',
    income_list_empty:'Nenhum rendimento cadastrado ainda.',
    income_12m_h:'Por mês — últimos 12 meses',
    income_btn:'Adicionar Rendimento', income_accum:'Acumulado:',
    avg_monthly:'Média mensal:', no_entries:'nenhum lançamento',
    // Expense page
    expenses_page_h:'Meus Gastos',
    expenses_page_sub:'Controle cada centavo — fixos (aluguel, escola) e variáveis (mercado, lazer…)',
    expense_form_h:'Adicionar Gasto', expense_list_h:'Gastos cadastrados',
    expense_list_empty:'Nenhum gasto aqui ainda.',
    expense_12m_h:'Por mês — últimos 12 meses',
    expense_btn:'Adicionar Gasto', expense_accum:'Acumulado:',
    // Goals page
    goals_page_h:'Minhas Metas',
    goals_page_sub:'Defina objetivos e acompanhe o progresso — viagem, carro, reserva de emergência…',
    goal_form_h:'Nova Meta', goal_empty:'Nenhuma meta criada ainda.',
    goal_empty_sub:'Comece definindo um objetivo!',
    goal_btn:'Criar Meta', goal_deposit_btn:'Adicionar',
    goal_stat_total:'Meta', goal_stat_saved:'Guardado', goal_stat_left:'Falta',
    goal_achieved:'🎉 Meta atingida! Parabéns!',
    days_left:'dias restantes', deadline_today:'Hoje!', deadline_over:'Prazo encerrado',
    // Goal priorities
    priority_high:'🔴 Alta', priority_med:'🟡 Média', priority_low:'🟢 Baixa',
    // Debts page
    debts_page_h:'Minhas Dívidas',
    debts_page_sub:'Controle total das suas dívidas — financiamentos, hipoteca, cartão e mais.',
    debt_form_h:'Adicionar Dívida', debt_list_h:'Dívidas cadastradas', debt_btn:'Adicionar Dívida',
    debt_kpi_total_lbl:'Saldo Devedor Total', debt_kpi_monthly_lbl:'Parcela Mensal Total',
    debt_kpi_overdue_lbl:'Em Atraso', debt_kpi_burden_lbl:'Comprometimento',
    debt_kpi_none:'nenhuma dívida', debt_kpi_no_overdue:'sem atrasos',
    debt_kpi_burden_sub:'da renda com parcelas', debt_kpi_budget:'do orçamento mensal',
    debt_empty:'Nenhuma dívida cadastrada ainda.',
    debt_empty_sub:'Adicione para controlar seus compromissos.',
    debt_cat_empty:'Nenhuma dívida nessa categoria.',
    // Debt card labels
    dc_balance:'Saldo devedor', dc_monthly:'Parcela mensal',
    dc_interest:'Juros', dc_due:'Vencimento', dc_due_day:'Dia ',
    dc_overdue_inst:'parcela em atraso!', dc_overdue_inst_pl:'parcelas em atraso!',
    dc_paid_pct:'% quitado', dc_edit:'Editar',
    // Debt type labels
    debt_type_bancaria:'Bancária', debt_type_hipoteca:'Hipoteca / Imóvel',
    debt_type_carro:'Financiamento Carro', debt_type_cartao:'Cartão de Crédito',
    debt_type_pessoal:'Empréstimo Pessoal', debt_type_consorcio:'Consórcio',
    debt_type_outros:'Outros',
    // Debt status labels
    debt_status_pagando:'Pagando', debt_status_atraso:'Em atraso',
    debt_status_pausado:'Pausado', debt_status_quitado:'Quitado',
    // Tabs
    tab_all:'Todos', tab_all_f:'Todas', tab_fixed:'Fixos', tab_variable:'Variáveis',
    tab_paying:'Pagando', tab_overdue:'Em atraso', tab_paid_off:'Quitadas',
    // Form labels
    lbl_desc:'Descrição', lbl_amount:'Valor (R$)', lbl_category:'Categoria',
    lbl_freq:'Frequência', lbl_month:'Mês de referência', lbl_type:'Tipo',
    lbl_icon:'Escolha um ícone', lbl_name:'Nome da meta',
    lbl_total_goal:'Valor total da meta (R$)', lbl_saved:'Já tenho guardado (R$)',
    lbl_deadline:'Prazo desejado', lbl_priority:'Prioridade',
    lbl_debt_name:'Nome / Descrição', lbl_status:'Status',
    lbl_remaining:'Saldo devedor atual (R$)', lbl_total_amount:'Valor total da dívida (R$)',
    lbl_installment:'Valor da parcela (R$)', lbl_due_day:'Dia de vencimento',
    lbl_paid_inst:'Parcelas pagas', lbl_total_inst:'Total de parcelas',
    lbl_interest_rate:'Taxa de juros (%)', lbl_rate_period:'Período da taxa',
    lbl_overdue_inst_lbl:'Parcelas em atraso',
    // Income categories
    cat_salario:'💼 Salário', cat_freela:'💻 Freela / Autônomo',
    cat_investimento:'📈 Investimentos', cat_aluguel:'🏠 Aluguel',
    cat_bonus:'🎁 Bônus / 13º', cat_pensao:'👨‍👩‍👧 Pensão / Benefício', cat_outros:'✨ Outros',
    // Frequencies
    freq_mensal:'Mensal', freq_semanal:'Semanal', freq_quinzenal:'Quinzenal',
    freq_anual:'Anual', freq_unico:'Único (não recorrente)',
    // Expense categories
    exp_moradia:'🏠 Moradia', exp_alimentacao:'🍽️ Alimentação',
    exp_transporte:'🚗 Transporte', exp_saude:'💊 Saúde', exp_educacao:'📚 Educação',
    exp_lazer:'🎉 Lazer', exp_vestuario:'👕 Vestuário',
    exp_assinaturas:'📱 Assinaturas', exp_dividas:'💳 Dívidas / Parcelas',
    // Expense / debt types
    type_fixed:'🔒 Fixo (todo mês)', type_variable:'🔄 Variável',
    rate_monthly:'Mensal (a.m.)', rate_annual:'Anual (a.a.)',
    debt_form_bancaria:'🏦 Bancária', debt_form_hipoteca:'🏠 Hipoteca / Imóvel',
    debt_form_carro:'🚗 Financiamento Carro', debt_form_cartao:'💳 Cartão de Crédito',
    debt_form_pessoal:'👤 Empréstimo Pessoal', debt_form_consorcio:'🤝 Consórcio',
    status_pagando:'✅ Pagando normalmente', status_atraso:'⚠️ Em atraso',
    status_pausado:'⏸️ Pausado / Negociando', status_quitado:'🎉 Quitado',
    // Learn page
    learn_page_h:'Aprenda sobre Finanças',
    learn_page_sub:'Conceitos simples para quem quer colocar as finanças em ordem — sem enrolação.',
    learn_prev:'Introdução', learn_next:'Aprofundar',
    learn_tag_method:'Método', learn_tag_premium:'Premium',
    learn_btn:'Aprender', learn_unlock_btn:'Desbloquear', learn_premium_unlocked:'Premium ✓',
    learn_regra50_title:'A Regra 50-30-20',
    learn_regra50_p:'A forma mais simples de distribuir o seu dinheiro e nunca passar sufoco no fim do mês.',
    learn_emergencia_tag:'Emergência', learn_emergencia_title:'Reserva de Emergência',
    learn_emergencia_p:'Por que você precisa de dinheiro parado no banco — e quanto guardar antes de investir.',
    learn_dividas_tag:'Dívidas', learn_dividas_title:'Como sair das dívidas',
    learn_dividas_p:'Estratégias práticas para quitar dívidas — do método bola de neve ao avalanche.',
    learn_orcamento_tag:'Orçamento', learn_orcamento_title:'Como fazer um orçamento',
    learn_orcamento_p:'Passo a passo para montar seu orçamento mensal e finalmente saber para onde vai seu dinheiro.',
    learn_investir_tag:'Investimentos', learn_investir_title:'Começando a investir',
    learn_investir_p:'Onde colocar o dinheiro sobrando — Tesouro Direto, CDB, ações: o que é melhor para iniciantes.',
    learn_habitos_tag:'Hábitos', learn_habitos_title:'Hábitos que mudam tudo',
    learn_habitos_p:'Os pequenos hábitos financeiros que, praticados todo dia, fazem uma diferença enorme a longo prazo.',
    // Paywall
    paywall_desc:'Desbloqueie todos os módulos de aprendizado e acelere sua jornada financeira',
    paywall_feat1:'Reserva de Emergência', paywall_feat2:'Como sair das dívidas',
    paywall_feat3:'Como fazer um orçamento', paywall_feat4:'Começando a investir',
    paywall_feat5:'Hábitos que mudam tudo',
    paywall_cta:'Assinar Pro agora', paywall_skip:'Continuar no plano gratuito',
    paywall_code_div:'ou já tenho um código de acesso',
    paywall_code_btn:'Desbloquear', paywall_login_hint:'Faça',
    // Auth
    auth_login_tab:'Entrar', auth_register_tab:'Criar conta',
    auth_login_desc:'Entre para sincronizar seus dados na nuvem e acessar de qualquer dispositivo.',
    auth_reg_desc:'Crie sua conta gratuita e salve seus dados com segurança na nuvem.',
    lbl_email:'E-mail', lbl_password:'Senha', lbl_name_auth:'Nome', lbl_confirm:'Confirmar senha',
    auth_btn_login:'Entrar', auth_btn_register:'Criar conta grátis',
    auth_no_account:'Não tem conta?', auth_create_free:'Criar gratuitamente',
    auth_has_account:'Já tem conta?', auth_sign_in:'Entrar',
    // Modals
    edit_modal_title:'Editar item', lbl_save_changes:'Salvar alterações',
    lbl_add_modal_income:'✏️ Editar Rendimento', lbl_add_modal_expense:'✏️ Editar Gasto',
    lbl_edit_debt:'✏️ Editar Dívida',
    // Monthly table
    lbl_month_col:'Mês', lbl_entries_col:'Lançamentos',
    lbl_total_col:'Total', lbl_accum_col:'Acumulado',
    // Toast messages
    toast_income_added:'Rendimento adicionado! 💰', toast_expense_added:'Gasto adicionado! 📝',
    toast_income_removed:'Rendimento removido', toast_expense_removed:'Gasto removido',
    toast_goal_created:'Meta criada! 🎯', toast_goal_removed:'Meta removida',
    toast_debt_added:'Dívida cadastrada! 📋', toast_debt_removed:'Dívida removida',
    toast_changes_saved:'Alterações salvas! ✅',
    toast_fill_fields:'Preencha todos os campos corretamente',
    toast_valid_value:'Digite um valor válido',
    toast_premium_unlocked:'🎉 Premium desbloqueado! Acesso total liberado.',
    // Dropdown sync
    dropdown_local:'Modo local (sem login)', dropdown_synced:'Sincronizado na nuvem',
    dropdown_syncing:'Sincronizando…', dropdown_error:'Erro ao sincronizar',
    // Edit modal extras
    lbl_freq_edit:'Frequência', lbl_type_edit:'Tipo',
    // Paywall price
    price_from:'de <s>R$ 29,90</s>', price_period:'/mês', price_sub:'ou R$ 99,90/ano — economize 44%',
    // Paywall login hint parts
    paywall_login_pre:'Faça', paywall_login_post:'para que o desbloqueio fique salvo na sua conta.',
    // Paywall code placeholder
    paywall_code_ph:'Digite seu código...',
    // Auth placeholders
    lbl_password_ph:'Sua senha', lbl_password_hint:'(mín. 6 caracteres)',
    reg_name_ph:'Seu nome', reg_pass_ph:'Crie uma senha forte', reg_confirm_ph:'Repita a senha',
    // Premium code errors
    err_code_empty:'Digite o código de acesso.', err_code_invalid:'Código inválido. Faça login para validar via servidor.',
    // Paywall CTA toast
    toast_paywall_cta:'Redirecionando para o pagamento... 🔐',
    // Form placeholders
    income_desc_ph:'ex: Salário, Freela, Aluguel…', expense_desc_ph:'ex: Aluguel, Supermercado, Netflix…',
    debt_name_ph:'ex: Financiamento do Carro, Cartão Nubank…', goal_name_ph:'ex: Viagem para Europa, Carro novo…',
    // Demo data toast
    toast_demo_loaded:'Dados de exemplo carregados! Edite à vontade 😊',
    // Auth dynamic states
    btn_login_loading:'Entrando…', btn_register_loading:'Criando conta…',
    toast_welcome:'Bem-vindo(a), {name}! ☁️', toast_account_created:'Conta criada! Dados sincronizados na nuvem ☁️',
    err_server_offline:'Servidor offline. Execute <code>npm start</code> na pasta personal-finance.',
    err_pass_mismatch:'As senhas não coincidem.',
  },
  en: {
    // Nav
    nav_dashboard:'Dashboard', nav_income:'Income', nav_expenses:'Expenses',
    nav_goals:'Goals', nav_debts:'Debts', nav_learn:'Learn',
    // Sidebar
    health_label:'Financial Health',
    // Topbar / user
    visitor:'Guest', local_mode:'Local mode',
    sign_in:'Sign In / Create Account', sign_out:'Sign Out',
    // KPIs
    kpi_income:'Monthly Income', kpi_expense:'Total Expenses',
    kpi_debt_service:'Monthly Installments', kpi_balance:'Free Balance',
    kpi_savings:'Savings Rate', kpi_savings_sub:'ideal: above 20%',
    // Dashboard sections
    health_badge:'Financial Health', badge_config:'Set up your data',
    hero_greeting:'Hello! Let\'s take care of your money? 👋',
    hero_sub:'Here you have a complete view of your financial health — simple and straightforward.',
    chart_expense_title:'Where does your money go?',
    chart_expense_empty:'Add expenses to see the chart',
    chart_balance_title:'This month: Income vs Expenses',
    chart_12m_title:'Evolution — Last 12 months',
    chart_12m_empty:'Add entries to see monthly evolution',
    insights_title:'Areas for Improvement',
    insights_empty:'Add your income and expenses to receive personalized tips!',
    goals_preview_title:'Your Goals', goals_view_all:'View all',
    debt_commit_title:'Monthly Debt Exposure', debt_commit_link:'Manage debts →',
    // Chart labels
    chart_income_label:'Income', chart_expenses_label:'Expenses',
    chart_installments_label:'Installments', chart_incomes_bar:'Income',
    chart_expenses_bar:'Expenses', chart_accum:'Accumulated',
    // Income page
    income_page_h:'My Income',
    income_page_sub:'Everything in your pocket — salary, freelance, rent, dividends…',
    income_form_h:'Add Income', income_list_h:'Registered Income',
    income_list_empty:'No income registered yet.',
    income_12m_h:'By month — last 12 months',
    income_btn:'Add Income', income_accum:'Accumulated:',
    avg_monthly:'Monthly average:', no_entries:'no entries',
    // Expense page
    expenses_page_h:'My Expenses',
    expenses_page_sub:'Track every cent — fixed (rent, school) and variable (groceries, leisure…)',
    expense_form_h:'Add Expense', expense_list_h:'Registered Expenses',
    expense_list_empty:'No expenses here yet.',
    expense_12m_h:'By month — last 12 months',
    expense_btn:'Add Expense', expense_accum:'Accumulated:',
    // Goals page
    goals_page_h:'My Goals',
    goals_page_sub:'Set goals and track progress — travel, car, emergency fund…',
    goal_form_h:'New Goal', goal_empty:'No goals created yet.',
    goal_empty_sub:'Start by setting an objective!',
    goal_btn:'Create Goal', goal_deposit_btn:'Add',
    goal_stat_total:'Goal', goal_stat_saved:'Saved', goal_stat_left:'Left',
    goal_achieved:'🎉 Goal reached! Congratulations!',
    days_left:'days remaining', deadline_today:'Today!', deadline_over:'Deadline passed',
    // Goal priorities
    priority_high:'🔴 High', priority_med:'🟡 Medium', priority_low:'🟢 Low',
    // Debts page
    debts_page_h:'My Debts',
    debts_page_sub:'Full control of your debts — loans, mortgage, cards and more.',
    debt_form_h:'Add Debt', debt_list_h:'Registered Debts', debt_btn:'Add Debt',
    debt_kpi_total_lbl:'Total Outstanding Balance', debt_kpi_monthly_lbl:'Total Monthly Payment',
    debt_kpi_overdue_lbl:'Overdue', debt_kpi_burden_lbl:'Debt Burden',
    debt_kpi_none:'no debts', debt_kpi_no_overdue:'no overdue',
    debt_kpi_burden_sub:'of income on installments', debt_kpi_budget:'of monthly budget',
    debt_empty:'No debts registered yet.',
    debt_empty_sub:'Add one to track your commitments.',
    debt_cat_empty:'No debts in this category.',
    // Debt card labels
    dc_balance:'Outstanding balance', dc_monthly:'Monthly installment',
    dc_interest:'Interest', dc_due:'Due date', dc_due_day:'Day ',
    dc_overdue_inst:'overdue installment!', dc_overdue_inst_pl:'overdue installments!',
    dc_paid_pct:'% paid off', dc_edit:'Edit',
    // Debt type labels
    debt_type_bancaria:'Bank Loan', debt_type_hipoteca:'Mortgage',
    debt_type_carro:'Car Financing', debt_type_cartao:'Credit Card',
    debt_type_pessoal:'Personal Loan', debt_type_consorcio:'Consortium',
    debt_type_outros:'Other',
    // Debt status labels
    debt_status_pagando:'Paying', debt_status_atraso:'Overdue',
    debt_status_pausado:'Paused', debt_status_quitado:'Paid off',
    // Tabs
    tab_all:'All', tab_all_f:'All', tab_fixed:'Fixed', tab_variable:'Variable',
    tab_paying:'Paying', tab_overdue:'Overdue', tab_paid_off:'Paid off',
    // Form labels
    lbl_desc:'Description', lbl_amount:'Amount (R$)', lbl_category:'Category',
    lbl_freq:'Frequency', lbl_month:'Reference month', lbl_type:'Type',
    lbl_icon:'Choose an icon', lbl_name:'Goal name',
    lbl_total_goal:'Total goal amount (R$)', lbl_saved:'Already saved (R$)',
    lbl_deadline:'Target date', lbl_priority:'Priority',
    lbl_debt_name:'Name / Description', lbl_status:'Status',
    lbl_remaining:'Current outstanding balance (R$)', lbl_total_amount:'Total debt amount (R$)',
    lbl_installment:'Installment value (R$)', lbl_due_day:'Due day',
    lbl_paid_inst:'Paid installments', lbl_total_inst:'Total installments',
    lbl_interest_rate:'Interest rate (%)', lbl_rate_period:'Rate period',
    lbl_overdue_inst_lbl:'Overdue installments',
    // Income categories
    cat_salario:'💼 Salary', cat_freela:'💻 Freelance',
    cat_investimento:'📈 Investments', cat_aluguel:'🏠 Rental Income',
    cat_bonus:'🎁 Bonus', cat_pensao:'👨‍👩‍👧 Pension / Benefit', cat_outros:'✨ Other',
    // Frequencies
    freq_mensal:'Monthly', freq_semanal:'Weekly', freq_quinzenal:'Bi-weekly',
    freq_anual:'Yearly', freq_unico:'One-time',
    // Expense categories
    exp_moradia:'🏠 Housing', exp_alimentacao:'🍽️ Food',
    exp_transporte:'🚗 Transport', exp_saude:'💊 Health', exp_educacao:'📚 Education',
    exp_lazer:'🎉 Leisure', exp_vestuario:'👕 Clothing',
    exp_assinaturas:'📱 Subscriptions', exp_dividas:'💳 Debts / Installments',
    // Expense / debt types
    type_fixed:'🔒 Fixed (every month)', type_variable:'🔄 Variable',
    rate_monthly:'Monthly', rate_annual:'Yearly',
    debt_form_bancaria:'🏦 Bank Loan', debt_form_hipoteca:'🏠 Mortgage',
    debt_form_carro:'🚗 Car Financing', debt_form_cartao:'💳 Credit Card',
    debt_form_pessoal:'👤 Personal Loan', debt_form_consorcio:'🤝 Consortium',
    status_pagando:'✅ Paying normally', status_atraso:'⚠️ Overdue',
    status_pausado:'⏸️ Paused / Negotiating', status_quitado:'🎉 Paid off',
    // Learn page
    learn_page_h:'Learn about Finance',
    learn_page_sub:'Simple concepts for those who want to get their finances in order — no fluff.',
    learn_prev:'Overview', learn_next:'Deep Dive',
    learn_tag_method:'Method', learn_tag_premium:'Premium',
    learn_btn:'Learn', learn_unlock_btn:'Unlock', learn_premium_unlocked:'Premium ✓',
    learn_regra50_title:'The 50-30-20 Rule',
    learn_regra50_p:'The simplest way to allocate your money and never struggle at month\'s end.',
    learn_emergencia_tag:'Emergency', learn_emergencia_title:'Emergency Fund',
    learn_emergencia_p:'Why you need money sitting in the bank — and how much to save before investing.',
    learn_dividas_tag:'Debt', learn_dividas_title:'How to Get Out of Debt',
    learn_dividas_p:'Practical strategies to pay off debt — from the snowball to the avalanche method.',
    learn_orcamento_tag:'Budget', learn_orcamento_title:'How to Budget',
    learn_orcamento_p:'Step-by-step guide to build your monthly budget and finally know where your money goes.',
    learn_investir_tag:'Investing', learn_investir_title:'Starting to Invest',
    learn_investir_p:'Where to put your savings — Treasury bonds, CDs, stocks: what\'s best for beginners.',
    learn_habitos_tag:'Habits', learn_habitos_title:'Habits That Change Everything',
    learn_habitos_p:'Small financial habits, practiced daily, make a huge difference in the long run.',
    // Paywall
    paywall_desc:'Unlock all learning modules and accelerate your financial journey',
    paywall_feat1:'Emergency Fund', paywall_feat2:'How to Get Out of Debt',
    paywall_feat3:'How to Budget', paywall_feat4:'Starting to Invest',
    paywall_feat5:'Habits That Change Everything',
    paywall_cta:'Subscribe Pro now', paywall_skip:'Continue on free plan',
    paywall_code_div:'or I already have an access code',
    paywall_code_btn:'Unlock', paywall_login_hint:'Log in',
    // Auth
    auth_login_tab:'Sign In', auth_register_tab:'Create Account',
    auth_login_desc:'Sign in to sync your data to the cloud and access from any device.',
    auth_reg_desc:'Create your free account and save your data securely in the cloud.',
    lbl_email:'Email', lbl_password:'Password', lbl_name_auth:'Name', lbl_confirm:'Confirm password',
    auth_btn_login:'Sign In', auth_btn_register:'Create free account',
    auth_no_account:'Don\'t have an account?', auth_create_free:'Create for free',
    auth_has_account:'Already have an account?', auth_sign_in:'Sign In',
    // Modals
    edit_modal_title:'Edit item', lbl_save_changes:'Save changes',
    lbl_add_modal_income:'✏️ Edit Income', lbl_add_modal_expense:'✏️ Edit Expense',
    lbl_edit_debt:'✏️ Edit Debt',
    // Monthly table
    lbl_month_col:'Month', lbl_entries_col:'Entries',
    lbl_total_col:'Total', lbl_accum_col:'Accumulated',
    // Toast messages
    toast_income_added:'Income added! 💰', toast_expense_added:'Expense added! 📝',
    toast_income_removed:'Income removed', toast_expense_removed:'Expense removed',
    toast_goal_created:'Goal created! 🎯', toast_goal_removed:'Goal removed',
    toast_debt_added:'Debt registered! 📋', toast_debt_removed:'Debt removed',
    toast_changes_saved:'Changes saved! ✅',
    toast_fill_fields:'Please fill all fields correctly',
    toast_valid_value:'Enter a valid value',
    toast_premium_unlocked:'🎉 Premium unlocked! Full access granted.',
    // Dropdown sync
    dropdown_local:'Local mode (not logged in)', dropdown_synced:'Synced to cloud',
    dropdown_syncing:'Syncing…', dropdown_error:'Sync error',
    // Edit modal extras
    lbl_freq_edit:'Frequency', lbl_type_edit:'Type',
    // Paywall price
    price_from:'from <s>$29.90</s>', price_period:'/month', price_sub:'or $99.90/year — save 44%',
    // Paywall login hint parts
    paywall_login_pre:'Log in', paywall_login_post:'to keep your premium access saved to your account.',
    // Paywall code placeholder
    paywall_code_ph:'Enter your code...',
    // Auth placeholders
    lbl_password_ph:'Your password', lbl_password_hint:'(min. 6 characters)',
    reg_name_ph:'Your name', reg_pass_ph:'Create a strong password', reg_confirm_ph:'Repeat password',
    // Premium code errors
    err_code_empty:'Enter the access code.', err_code_invalid:'Invalid code. Log in to validate via server.',
    // Paywall CTA toast
    toast_paywall_cta:'Redirecting to payment... 🔐',
    // Form placeholders
    income_desc_ph:'e.g.: Salary, Freelance, Rental…', expense_desc_ph:'e.g.: Rent, Groceries, Netflix…',
    debt_name_ph:'e.g.: Car Loan, Credit Card…', goal_name_ph:'e.g.: Trip to Europe, New Car…',
    // Demo data toast
    toast_demo_loaded:'Demo data loaded! Feel free to edit 😊',
    // Auth dynamic states
    btn_login_loading:'Signing in…', btn_register_loading:'Creating account…',
    toast_welcome:'Welcome, {name}! ☁️', toast_account_created:'Account created! Data synced to the cloud ☁️',
    err_server_offline:'Server offline. Run <code>npm start</code> in the personal-finance folder.',
    err_pass_mismatch:'Passwords do not match.',
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
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const val = t(el.dataset.i18nPh);
    if (val) el.placeholder = val;
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
  renderAll();
  updateAvatarUI();
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
  if (page === 'learn')     renderLearn();
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

function incomeCategories() {
  return [
    { value: 'salario',      label: t('cat_salario') },
    { value: 'freela',       label: t('cat_freela') },
    { value: 'investimento', label: t('cat_investimento') },
    { value: 'aluguel',      label: t('cat_aluguel') },
    { value: 'bonus',        label: t('cat_bonus') },
    { value: 'pensao',       label: t('cat_pensao') },
    { value: 'outros',       label: t('cat_outros') },
  ];
}
function expenseCategories() {
  return [
    { value: 'moradia',      label: t('exp_moradia') },
    { value: 'alimentacao',  label: t('exp_alimentacao') },
    { value: 'transporte',   label: t('exp_transporte') },
    { value: 'saude',        label: t('exp_saude') },
    { value: 'educacao',     label: t('exp_educacao') },
    { value: 'lazer',        label: t('exp_lazer') },
    { value: 'vestuario',    label: t('exp_vestuario') },
    { value: 'assinaturas',  label: t('exp_assinaturas') },
    { value: 'dividas',      label: t('exp_dividas') },
    { value: 'outros',       label: t('cat_outros') },
  ];
}

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
  const lg = state.lang;
  if      (score >= 80) { txt = lg === 'en' ? 'Excellent 🌟'         : 'Excelente 🌟';         color = 'var(--success)'; }
  else if (score >= 60) { txt = lg === 'en' ? 'Good 👍'              : 'Bom 👍';               color = '#84cc16'; }
  else if (score >= 40) { txt = lg === 'en' ? 'Fair ⚠️'             : 'Regular ⚠️';           color = 'var(--warning)'; }
  else                  { txt = lg === 'en' ? 'Needs attention 🚨'   : 'Precisa de atenção 🚨'; color = 'var(--danger)'; }

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
    ? [t('chart_income_label'), t('chart_expenses_label'), t('chart_installments_label'), t('kpi_balance')]
    : [t('chart_income_label'), t('chart_expenses_label'), state.lang === 'en' ? 'Balance' : 'Saldo'];
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
  const receivedLbl = state.lang === 'en' ? 'Received:' : 'Recebido:';
  const spentLbl    = state.lang === 'en' ? 'Spent:' : 'Gasto:';
  const balLbl      = state.lang === 'en' ? 'Balance:' : 'Saldo:';
  kpisEl.innerHTML = `
    <span class="month-kpi-pill pill-income">${receivedLbl} ${fmt(totalInc)}</span>
    <span class="month-kpi-pill pill-expense">${spentLbl} ${fmt(totalExp)}</span>
    <span class="month-kpi-pill pill-balance" style="color:${totalBal>=0?'var(--brand)':'var(--danger)'};background:${totalBal>=0?'#ede9fe':'var(--danger-light)'}">${balLbl} ${fmt(totalBal)}</span>
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
          label: t('chart_incomes_bar'),
          data: incData,
          backgroundColor: 'rgba(16,185,129,.75)',
          borderRadius: 6,
          borderSkipped: false,
          order: 2,
        },
        {
          type: 'bar',
          label: t('chart_expenses_bar'),
          data: expData,
          backgroundColor: 'rgba(239,68,68,.75)',
          borderRadius: 6,
          borderSkipped: false,
          order: 2,
        },
        {
          type: 'line',
          label: state.lang === 'en' ? 'Balance' : 'Saldo',
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
  document.getElementById(avgId).textContent   = `${t('avg_monthly')} ${fmt(average)}`;

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
          label: isIncome ? t('chart_incomes_bar') : t('chart_expenses_bar'),
          data: monthData.map(m => m.total),
          backgroundColor: barColor,
          borderRadius: 6,
          borderSkipped: false,
          order: 2,
        },
        {
          type: 'line',
          label: t('chart_accum'),
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
  const lbl12m  = state.lang === 'en' ? 'Accumulated 12m' : 'Acumulado 12m';
  const lblAvg  = state.lang === 'en' ? 'Monthly avg' : 'Média mensal';
  const lblWith = state.lang === 'en' ? 'in months with entries' : 'nos meses com lançamento';
  const lblAmt  = state.lang === 'en' ? 'Amount' : 'Valor';
  const lblItems = state.lang === 'en' ? 'Items' : 'Itens';
  tableEl.innerHTML = `
    <thead>
      <tr>
        <th>${t('lbl_month_col')}</th>
        <th style="text-align:right">${lblAmt}</th>
        <th style="text-align:center">${lblItems}</th>
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
        <td>${lbl12m}</td>
        <td style="text-align:right;color:${isIncome ? 'var(--success)' : 'var(--danger)'}">${fmt(accumulated)}</td>
        <td style="text-align:center"><span class="month-count">${items.length}</span></td>
        <td></td>
      </tr>
      <tr class="total-row">
        <td>${lblAvg}</td>
        <td style="text-align:right;color:var(--text-2)">${fmt(average)}</td>
        <td colspan="2" style="color:var(--text-3);font-size:11px">${lblWith}</td>
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
  showToast(t('toast_income_added'));
});

function renderIncomeList() {
  const list = document.getElementById('incomeList');
  const chip = document.getElementById('totalIncomeChip');
  const total = state.incomes.reduce((s, i) => s + parseFloat(i.amount), 0);
  chip.textContent = `Total: ${fmt(total)}`;

  if (state.incomes.length === 0) {
    list.innerHTML = `<div class="list-empty"><i class="fa-solid fa-inbox"></i><p>${t('income_list_empty')}</p></div>`;
    return;
  }

  const freqLabels = {
    mensal: t('freq_mensal'), semanal: t('freq_semanal'),
    quinzenal: t('freq_quinzenal'), anual: t('freq_anual'), unico: t('freq_unico'),
  };
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
      <button class="item-edit" onclick="openEditModal('income','${i.id}')" title="${t('dc_edit')}"><i class="fa-solid fa-pen"></i></button>
      <button class="item-del"  onclick="deleteIncome('${i.id}')"           title="${state.lang==='en'?'Delete':'Excluir'}"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join('');
}

function deleteIncome(id) {
  state.incomes = state.incomes.filter(i => i.id !== id);
  save();
  renderIncomeList();
  renderMonthlyBreakdown('income');
  renderDashboard();
  showToast(t('toast_income_removed'), 'danger');
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
  showToast(t('toast_expense_added'));
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
    list.innerHTML = `<div class="list-empty"><i class="fa-solid fa-inbox"></i><p>${t('expense_list_empty')}</p></div>`;
    return;
  }

  list.innerHTML = [...filtered].reverse().map(e => `
    <div class="finance-item" data-id="${e.id}">
      <div class="item-emoji">${categoryEmoji[e.category] || '✨'}</div>
      <div class="item-info">
        <div class="item-name">${escHtml(e.desc)}</div>
        <div class="item-meta">
          <span class="item-type-badge badge-${e.type}">${e.type === 'fixo' ? t('tab_fixed') : t('tab_variable')}</span>
          <span>${e.category}</span> · <span>${e.month}</span>
        </div>
      </div>
      <div class="item-amount expense-amount">${fmt(parseFloat(e.amount))}</div>
      <button class="item-edit" onclick="openEditModal('expense','${e.id}')" title="${t('dc_edit')}"><i class="fa-solid fa-pen"></i></button>
      <button class="item-del"  onclick="deleteExpense('${e.id}')"           title="${state.lang==='en'?'Delete':'Excluir'}"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join('');
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  save();
  renderExpenseList();
  renderMonthlyBreakdown('expense');
  renderDashboard();
  showToast(t('toast_expense_removed'), 'danger');
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
  const cats = isIncome ? incomeCategories() : expenseCategories();
  catSelect.innerHTML = cats.map(c => `<option value="${c.value}" ${item.category === c.value ? 'selected' : ''}>${c.label}</option>`).join('');

  // Show/hide type-specific fields
  document.getElementById('editFreqGroup').style.display    = isIncome   ? 'flex' : 'none';
  document.getElementById('editExpTypeGroup').style.display = !isIncome  ? 'flex' : 'none';

  if (isIncome) {
    document.getElementById('editFreq').value = item.freq || 'mensal';
  } else {
    document.getElementById('editExpenseType').value = item.type || 'variavel';
  }

  document.getElementById('editModalTitle').textContent = isIncome ? t('lbl_add_modal_income') : t('lbl_add_modal_expense');
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
    showToast(t('toast_fill_fields'), 'danger'); return;
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
  showToast(t('toast_changes_saved'));
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
  showToast(t('toast_goal_created'));
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
    deadlineStr = diff > 0 ? `${diff} ${t('days_left')}` : diff === 0 ? t('deadline_today') : t('deadline_over');
  }

  const monthsLeft = g.deadline
    ? Math.max(1, Math.ceil((new Date(g.deadline + 'T00:00:00') - new Date()) / (1000*60*60*24*30)))
    : null;
  const saveLbl = state.lang === 'en' ? 'Save' : 'Guarde';
  const monthLbl = state.lang === 'en' ? '/month' : '/mês';
  const toMeetLbl = state.lang === 'en' ? 'to meet your deadline.' : 'para chegar lá no prazo.';
  const suggestion = monthsLeft && remaining > 0
    ? `<div style="font-size:12px;color:var(--text-2);margin-top:6px;">
        ${saveLbl} <strong>${fmt(remaining / monthsLeft)}${monthLbl}</strong> ${toMeetLbl}
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
        <span class="goal-priority priority-${g.priority}">${g.priority === 'alta' ? t('priority_high') : g.priority === 'media' ? t('priority_med') : t('priority_low')}</span>
      </div>

      <div class="goal-stats">
        <div><div class="goal-stat-label">${t('goal_stat_total')}</div><div class="goal-stat-value">${fmt(g.total)}</div></div>
        <div><div class="goal-stat-label">${t('goal_stat_saved')}</div><div class="goal-stat-value" style="color:var(--success)">${fmt(g.saved)}</div></div>
        <div><div class="goal-stat-label">${t('goal_stat_left')}</div><div class="goal-stat-value" style="color:var(--danger)">${fmt(remaining)}</div></div>
      </div>

      <div class="goal-progress-bar">
        <div class="goal-progress-fill" style="width:${pct}%;background:${gradColor}"></div>
      </div>

      <div class="goal-footer">
        <div class="goal-percent" style="color:${pct>=100?'var(--success)':'var(--brand)'}">${pct.toFixed(0)}%</div>
        <div class="goal-actions">
          <div>
            <div class="deposit-row">
              <input type="number" placeholder="${state.lang==='en'?'Deposit R$':'Depositar R$'}" id="dep_${g.id}" min="0" step="0.01" />
              <button onclick="depositGoal('${g.id}')"><i class="fa-solid fa-plus"></i> ${t('goal_deposit_btn')}</button>
            </div>
          </div>
          <button class="goal-del-btn" onclick="deleteGoal('${g.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      ${suggestion}
      ${pct >= 100 ? `<div style="margin-top:12px;padding:10px;background:var(--success-light);border-radius:8px;color:var(--success);font-size:13px;font-weight:700;text-align:center;">${t('goal_achieved')}</div>` : ''}
    </div>
  `;
}

function depositGoal(id) {
  const input = document.getElementById('dep_' + id);
  const val   = parseFloat(input.value);
  if (isNaN(val) || val <= 0) { showToast(t('toast_valid_value'), 'danger'); return; }
  const goal = state.goals.find(g => g.id === id);
  if (!goal) return;
  goal.saved = Math.min(goal.total, goal.saved + val);
  save();
  renderGoalsList();
  renderDashboard();
  showToast(`${fmt(val)} ${state.lang === 'en' ? 'added to goal! 💪' : 'adicionado à meta! 💪'}`);
}

function deleteGoal(id) {
  state.goals = state.goals.filter(g => g.id !== id);
  save();
  renderGoalsList();
  renderDashboard();
  showToast(t('toast_goal_removed'), 'danger');
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

// ── LEARN CONTENT (English) ─────────────────────────────────
const learnContentEn = {
  regra50: {
    title: '📊 The 50-30-20 Rule',
    pages: [
      `<p>This is the simplest and most effective strategy to organize your budget. Created by U.S. Senator Elizabeth Warren, it divides your net income into three parts:</p>
      <div class="rule-visual">
        <div class="rule-block rule-50">50%<small>Needs</small></div>
        <div class="rule-block rule-30">30%<small>Wants</small></div>
        <div class="rule-block rule-20">20%<small>Savings</small></div>
      </div>
      <h4><i class="fa-solid fa-house"></i> 50% — Needs</h4>
      <p>Rent, groceries, transport, utilities, health, and debt installments. If this exceeds 50%, you need to cut costs or increase your income.</p>
      <h4><i class="fa-solid fa-star"></i> 30% — Wants</h4>
      <p>Restaurants, travel, extra clothing, streaming. Valid, but with a clear limit.</p>
      <h4><i class="fa-solid fa-piggy-bank"></i> 20% — Savings</h4>
      <p><strong>Pay yourself first:</strong> transfer the 20% as soon as you get paid, before any other expense. Automate this transfer.</p>`,

      `<h4><i class="fa-solid fa-sliders"></i> Adapting to your reality</h4>
      <p>The 50-30-20 rule is a starting point, not a rigid law. If you have high-interest debt, temporarily redistribute to <strong>50-20-30</strong> — more to pay off debt, less for wants.</p>
      <h4><i class="fa-solid fa-calculator"></i> Practical example with $5,000 income</h4>
      <ul>
        <li><strong>$2,500 (50%)</strong> → Rent, groceries, transport, health plan, installments</li>
        <li><strong>$1,500 (30%)</strong> → Restaurants, Netflix, clothing, leisure</li>
        <li><strong>$1,000 (20%)</strong> → Emergency fund, investments, goals</li>
      </ul>
      <h4><i class="fa-solid fa-triangle-exclamation"></i> Why most people fail</h4>
      <p>The most common mistake is misclassifying expenses. Is a gym membership a <em>need</em> or a <em>want</em>? If you go 4 times a week, it can be a need. If once, it's a want. Be honest with yourself.</p>
      <h4><i class="fa-solid fa-lightbulb"></i> Analyst tip</h4>
      <p>Review your allocation every 6 months. As your income grows, keep needs at the same absolute amount (don't let them grow proportionally) and direct the surplus toward savings.</p>`,
    ],
  },
  emergencia: {
    title: '🛡️ Emergency Fund',
    pages: [
      `<p>The foundation of every healthy financial life. Without it, any unexpected event — car repair, job loss, health issue — turns into high-interest debt.</p>
      <h4><i class="fa-solid fa-calculator"></i> How much to save?</h4>
      <ul>
        <li><strong>Minimum:</strong> 3 months of essential expenses (stable employment)</li>
        <li><strong>Ideal:</strong> 6 months of all your monthly expenses</li>
        <li><strong>Freelancers / Self-employed:</strong> 12 months — your income is variable and the risk is higher</li>
      </ul>
      <h4><i class="fa-solid fa-bank"></i> Where to keep it? (immediate liquidity is mandatory)</h4>
      <ul>
        <li><strong>High-yield savings account</strong> — easy access, earns interest above inflation</li>
        <li><strong>Money market fund</strong> — safe, liquid, low fees</li>
        <li><strong>Short-term Treasury bonds</strong> — government-backed, highly liquid</li>
      </ul>`,

      `<h4><i class="fa-solid fa-stairs"></i> How to build from scratch, step by step</h4>
      <p>If you have no savings at all, don't panic. Build it in stages:</p>
      <ul>
        <li><strong>Goal 1:</strong> $1,000 — "fire extinguisher" (covers small emergencies, prevents revolving credit card debt)</li>
        <li><strong>Goal 2:</strong> 1 month of expenses — basic stability</li>
        <li><strong>Goal 3:</strong> 3 months — comfort zone</li>
        <li><strong>Goal 4:</strong> 6 months — true financial independence</li>
      </ul>
      <h4><i class="fa-solid fa-circle-question"></i> When to use the fund?</h4>
      <p>Use it <strong>only</strong> for real emergencies: job loss, urgent health issue, car essential for work. A trip, new electronics, or a sale are <strong>not emergencies</strong>.</p>
      <h4><i class="fa-solid fa-arrows-rotate"></i> After using it, rebuild</h4>
      <p>If you had to use it, make refilling the fund your top priority before any other investment. It's your financial shield — without it, you're exposed.</p>
      <h4><i class="fa-solid fa-lightbulb"></i> Analyst tip</h4>
      <p>Keep the fund in a <em>separate</em> account from your everyday bank. The friction of needing to transfer helps you resist the impulse to use the money for non-emergencies.</p>`,
    ],
  },
  dividas: {
    title: '💳 How to Get Out of Debt',
    pages: [
      `<p>With the right strategy, it's possible to get out of the red even on a limited income. The secret is method, not luck.</p>
      <h4><i class="fa-solid fa-snowflake"></i> Snowball Method</h4>
      <p>Pay off the <strong>smallest balance debt</strong> first, regardless of interest rates. With each debt paid off, redirect that payment to the next one. The benefit is psychological: quick wins build momentum and motivation to continue.</p>
      <h4><i class="fa-solid fa-mountain"></i> Avalanche Method (mathematically superior)</h4>
      <p>Pay off the <strong>highest interest rate debt</strong> first. You pay less total interest and get out of debt faster. Best for those with discipline and a long-term focus.</p>
      <h4><i class="fa-solid fa-fire"></i> Credit card revolving & overdraft: maximum emergency</h4>
      <p>Interest rates of 20–30% per <strong>year</strong> (sometimes more). Refinance with a personal loan (5–15% per year) <strong>immediately</strong>. This single move can save you thousands.</p>`,

      `<h4><i class="fa-solid fa-handshake"></i> How to negotiate with creditors</h4>
      <p>Banks and creditors prefer to receive less than nothing at all. Tips for negotiation:</p>
      <ul>
        <li>Check debt settlement portals — discounts of up to 70–90% on old debts</li>
        <li>Call the creditor directly and ask about a <em>payoff proposal</em> — there's always room to negotiate</li>
        <li>Prioritize secured debts (car financing, mortgage) — the asset can be repossessed</li>
      </ul>
      <h4><i class="fa-solid fa-chart-line"></i> Understanding compound interest (your enemy)</h4>
      <p>A $10,000 debt at 20% per year becomes $12,000 in just 1 year, and $61,917 in 10 years. Compound interest works <em>against</em> you in debts and <em>for</em> you in investments. The longer you wait, the worse it gets.</p>
      <h4><i class="fa-solid fa-shield-halved"></i> Prevention: the 3 principles</h4>
      <ul>
        <li><strong>Never use your credit limit as an extension of your income</strong> — it's credit, not salary</li>
        <li><strong>Only finance what fits in your total budget</strong> — add up all installments before buying</li>
        <li><strong>Have an emergency fund</strong> — it prevents unexpected events from becoming debt</li>
      </ul>`,
    ],
  },
  orcamento: {
    title: '📋 How to Create a Real Budget',
    pages: [
      `<p>A budget isn't a restriction — it's <strong>conscious freedom</strong> to spend on what truly matters and stop spending on what doesn't.</p>
      <h4><i class="fa-solid fa-1"></i> List all your income accurately</h4>
      <p>Net salary (after taxes), freelance, rental income, dividends. Use real figures from the last 3 months, not optimistic estimates.</p>
      <h4><i class="fa-solid fa-2"></i> Map <em>all</em> expenses — without exception</h4>
      <p>Open your bank and card statements from the last 3 months. Categorize everything, including the daily coffee. Surprise: most people underestimate their spending by 20–30%.</p>
      <h4><i class="fa-solid fa-3"></i> Separate fixed from variable</h4>
      <p><strong>Fixed:</strong> rent, loan payments, insurance, subscriptions. <strong>Variable:</strong> groceries, leisure, clothing, health. Fixed costs are hard to cut short-term; start by reducing variable ones.</p>
      <h4><i class="fa-solid fa-4"></i> Set spending targets by category</h4>
      <p>Compare actual vs. ideal (50-30-20 rule) and adjust progressively. Drastic cuts don't stick — reduce 10–15% per month.</p>`,

      `<h4><i class="fa-solid fa-box"></i> Envelope Method (modernized)</h4>
      <p>Create separate accounts for each spending category — or use "piggy bank" features in digital banks. When the leisure envelope is empty, that's it for the month. No negotiation.</p>
      <h4><i class="fa-solid fa-zero"></i> Zero-Based Budget</h4>
      <p>A technique used by major corporations: every dollar of income has a defined destination. <strong>Income − all planned expenses = $0</strong>. Nothing "left over" — what would be left already has a purpose (investment, goal, reserve).</p>
      <h4><i class="fa-solid fa-calendar-check"></i> Rituals that work</h4>
      <ul>
        <li><strong>Weekly review (5 min):</strong> compare actual transactions with the plan</li>
        <li><strong>Monthly close (15 min):</strong> evaluate the month, adjust the next</li>
        <li><strong>Annual planning (2h):</strong> big goals, seasonal expenses (property tax, car registration, vacation)</li>
      </ul>
      <h4><i class="fa-solid fa-lightbulb"></i> The most costly mistake</h4>
      <p>Ignoring seasonal expenses in your monthly budget. Divide annual expenses by 12 and set aside monthly. Example: $3,600/year car insurance = save $300/month in a separate account.</p>`,
    ],
  },
  investir: {
    title: '📈 Starting to Invest from Zero',
    pages: [
      `<p><strong>Mandatory prerequisites:</strong> ✅ Complete emergency fund and ✅ high-cost debts paid off. Investing with expensive debt is like filling a bathtub with the drain open.</p>
      <h4><i class="fa-solid fa-shield"></i> Fixed income — where to start (low risk)</h4>
      <ul>
        <li><strong>Treasury Bonds (T-bills/T-notes):</strong> government-backed, very safe. Minimum investment is low, highly liquid.</li>
        <li><strong>High-yield savings accounts:</strong> look for competitive APY with daily liquidity. FDIC insured up to $250k.</li>
        <li><strong>CDs (Certificates of Deposit):</strong> typically higher rates, but require a fixed term (90 days to several years).</li>
      </ul>
      <h4><i class="fa-solid fa-building-columns"></i> The golden rule</h4>
      <p><strong>Consistency beats performance.</strong> $500/month invested for 20 years at 10% per year = $378,000. Waiting to "have more to invest" is too costly.</p>`,

      `<h4><i class="fa-solid fa-chart-pie"></i> Asset allocation — the investor journey</h4>
      <p>As you build wealth, diversify progressively:</p>
      <ul>
        <li><strong>Phase 1 ($0–$20k):</strong> 100% fixed income (emergency fund + savings/bonds)</li>
        <li><strong>Phase 2 ($20k–$100k):</strong> 70% fixed income + 20% index funds (S&P 500) + 10% REITs</li>
        <li><strong>Phase 3 (>$100k):</strong> start studying individual stocks and international diversification</li>
      </ul>
      <h4><i class="fa-solid fa-clock"></i> The power of compound interest working for you</h4>
      <p>Albert Einstein called it "the eighth wonder of the world." $10,000 at 10% per year becomes:</p>
      <ul>
        <li>$25,937 in 10 years</li>
        <li>$67,275 in 20 years</li>
        <li>$174,494 in 30 years</li>
      </ul>
      <h4><i class="fa-solid fa-triangle-exclamation"></i> Classic beginner traps</h4>
      <ul>
        <li><strong>Market timing:</strong> trying to "buy the dip, sell the top" consistently is impossible even for professionals</li>
        <li><strong>Chasing past performance:</strong> the fund that returned 50% last year rarely repeats it</li>
        <li><strong>Ignoring fees:</strong> a 2% management fee can consume 40% of your wealth over 30 years</li>
      </ul>`,
    ],
  },
  habitos: {
    title: '🧠 Financial Habits That Change Everything',
    pages: [
      `<h4><i class="fa-solid fa-robot"></i> Automate everything you can</h4>
      <p>Set up automatic transfers to investments on the <em>same day</em> you get paid. What leaves before you see it isn't felt as a loss. This principle is called "forced savings" and accounts for 90% of the wealth built by salaried workers.</p>
      <h4><i class="fa-solid fa-cart-shopping"></i> The 24-hour rule</h4>
      <p>Before any unplanned purchase over $150, wait 24 hours. For purchases over $1,000, wait 7 days. Most impulses pass — studies show 60–70% of impulse purchases aren't made after the waiting period.</p>
      <h4><i class="fa-solid fa-sun"></i> Review your finances every week</h4>
      <p>5 minutes every Monday to check the previous week's transactions prevents surprises at month-end and keeps your financial awareness active.</p>
      <h4><i class="fa-solid fa-heart"></i> The "future self" test</h4>
      <p>Before any significant purchase, ask: <em>"Will my self one year from now thank me for this?"</em> If the answer is no, it's probably an impulse — not a need.</p>`,

      `<h4><i class="fa-solid fa-brain"></i> The psychology of money (biases that sabotage you)</h4>
      <ul>
        <li><strong>Loss aversion:</strong> the pain of losing $100 is 2x greater than the pleasure of gaining $100. That's why we delay cutting expenses — it feels like a "loss."</li>
        <li><strong>Hyperbolic discounting:</strong> we prefer $100 today over $150 in a month, even if irrational. Combat this by making the future more "real" with concrete, visual goals.</li>
        <li><strong>Social comparison:</strong> spending to "keep up with the Joneses" is the biggest source of middle-class debt. Your neighbor with the new car may be drowning in installments.</li>
      </ul>
      <h4><i class="fa-solid fa-trophy"></i> Building financial identity</h4>
      <p>The biggest financial leap happens when you stop <em>doing</em> healthy financial things and start <em>being</em> a financially healthy person. Identity precedes behavior.</p>
      <h4><i class="fa-solid fa-book"></i> Recommended reading</h4>
      <ul>
        <li><strong>The Psychology of Money</strong> — Morgan Housel (the best book on behavior and money)</li>
        <li><strong>Rich Dad Poor Dad</strong> — Robert Kiyosaki (concepts of assets and liabilities)</li>
        <li><strong>The Richest Man in Babylon</strong> — George Clason (timeless principles)</li>
      </ul>`,
    ],
  },
};

// ── LEARN RENDER ────────────────────────────────────────────
const learnModules = [
  { key:'regra50',   gradient:'linear-gradient(135deg,#6366f1,#8b5cf6)', icon:'fa-percent',           tagKey:'learn_tag_method',   titleKey:'learn_regra50_title',   descKey:'learn_regra50_p',   premium:false },
  { key:'emergencia',gradient:'linear-gradient(135deg,#f59e0b,#ef4444)', icon:'fa-shield-halved',      tagKey:'learn_emergencia_tag',titleKey:'learn_emergencia_title',descKey:'learn_emergencia_p',premium:true  },
  { key:'dividas',   gradient:'linear-gradient(135deg,#ef4444,#f97316)', icon:'fa-hand-holding-dollar',tagKey:'learn_dividas_tag',   titleKey:'learn_dividas_title',   descKey:'learn_dividas_p',   premium:true  },
  { key:'orcamento', gradient:'linear-gradient(135deg,#10b981,#059669)', icon:'fa-file-invoice-dollar',tagKey:'learn_orcamento_tag', titleKey:'learn_orcamento_title', descKey:'learn_orcamento_p', premium:true  },
  { key:'investir',  gradient:'linear-gradient(135deg,#3b82f6,#1d4ed8)', icon:'fa-chart-line',         tagKey:'learn_investir_tag',  titleKey:'learn_investir_title',  descKey:'learn_investir_p',  premium:true  },
  { key:'habitos',   gradient:'linear-gradient(135deg,#ec4899,#8b5cf6)', icon:'fa-brain',              tagKey:'learn_habitos_tag',   titleKey:'learn_habitos_title',   descKey:'learn_habitos_p',   premium:true  },
];

function renderLearn() {
  const grid = document.getElementById('learnGrid');
  if (!grid) return;
  grid.innerHTML = learnModules.map(m => {
    const locked = m.premium && !auth.premium;
    const tagHTML = locked
      ? `<span class="learn-tag learn-tag-premium"><i class="fa-solid fa-crown"></i> ${t('learn_tag_premium')}</span>`
      : m.premium
        ? `<span class="learn-tag">${t('learn_premium_unlocked')}</span>`
        : `<span class="learn-tag">${t(m.tagKey)}</span>`;
    const btnHTML = locked
      ? `<button class="btn-premium-unlock">${t('learn_unlock_btn')} <i class="fa-solid fa-lock"></i></button>`
      : `<button class="btn-outline learn-btn">${t('learn_btn')} <i class="fa-solid fa-arrow-right"></i></button>`;
    const lockOverlay = locked
      ? `<div class="premium-lock-overlay"><div class="lock-badge"><i class="fa-solid fa-lock"></i> ${t('learn_tag_premium')}</div></div>`
      : '';
    return `
      <div class="learn-card${locked ? ' learn-card-premium' : ''}" data-module="${m.key}">
        <div class="learn-card-icon" style="background:${m.gradient}">
          <i class="fa-solid ${m.icon}"></i>
        </div>
        ${lockOverlay}
        <div class="learn-card-body">
          ${tagHTML}
          <h3>${t(m.titleKey)}</h3>
          <p>${t(m.descKey)}</p>
          ${btnHTML}
        </div>
      </div>
    `;
  }).join('');
}

// Event delegation on learn grid (works after re-renders)
document.getElementById('learnGrid').addEventListener('click', e => {
  const card = e.target.closest('.learn-card');
  if (!card) return;
  const module = card.dataset.module;
  if (card.classList.contains('learn-card-premium')) {
    openPaywallModal();
  } else {
    if (e.target.closest('.btn-premium-unlock')) return;
    openLearnModal(module);
  }
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
  showToast(t('toast_paywall_cta'));
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
  if (!code) { errEl.textContent = t('err_code_empty'); return; }
  errEl.textContent = '';

  // If logged in → validate on server
  if (auth.token && auth.serverAvailable) {
    try {
      await apiCall('POST', '/premium/unlock', { code });
      activatePremium();
    } catch (err) {
      errEl.textContent = err.message || t('err_code_invalid');
    }
    return;
  }

  // If not logged in → local check (PREMIUM_CODE_LOCAL is intentionally visible
  // as a fallback for demo; in production only server-side validation is used)
  const LOCAL_CODE = 'FINANCASPRO2026';
  if (code.toUpperCase() === LOCAL_CODE) {
    activatePremium();
  } else {
    errEl.textContent = t('err_code_invalid');
  }
}

function activatePremium(showMsg = true) {
  auth.premium = true;
  localStorage.setItem('fs_premium', 'true');
  renderLearn();
  closePaywallModal();
  if (showMsg) showToast(t('toast_premium_unlocked'));
  updateAvatarUI();
}

function getLearnContent() {
  return state.lang === 'en' ? learnContentEn : learnContent;
}

function openLearnModal(module, page = 0) {
  const content = getLearnContent()[module];
  if (!content) return;
  learnCurrentModule = module;
  learnCurrentPage   = page;
  renderLearnPage();
  document.getElementById('learnModal').classList.add('show');
}

function renderLearnPage() {
  const content = getLearnContent()[learnCurrentModule];
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

  indEl.textContent = `${page + 1} / ${total}`;
  prevBtn.style.visibility = page === 0 ? 'hidden' : 'visible';
  nextBtn.style.visibility = page >= total - 1 ? 'hidden' : 'visible';

  // Update dot labels
  const prevSpan = prevBtn.querySelector('[data-i18n]');
  const nextSpan = nextBtn.querySelector('[data-i18n]');
  if (prevSpan) prevSpan.textContent = t('learn_prev');
  if (nextSpan) nextSpan.textContent = t('learn_next');

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
  bancaria:  { icon: '🏦', labelKey: 'debt_type_bancaria' },
  hipoteca:  { icon: '🏠', labelKey: 'debt_type_hipoteca' },
  carro:     { icon: '🚗', labelKey: 'debt_type_carro' },
  cartao:    { icon: '💳', labelKey: 'debt_type_cartao' },
  pessoal:   { icon: '👤', labelKey: 'debt_type_pessoal' },
  consorcio: { icon: '🤝', labelKey: 'debt_type_consorcio' },
  outros:    { icon: '✨', labelKey: 'debt_type_outros' },
};
const debtStatusInfo = {
  pagando:   { labelKey: 'debt_status_pagando', cls: 'debt-status-pagando' },
  em_atraso: { labelKey: 'debt_status_atraso',  cls: 'debt-status-em_atraso' },
  pausado:   { labelKey: 'debt_status_pausado', cls: 'debt-status-pausado' },
  quitado:   { labelKey: 'debt_status_quitado', cls: 'debt-status-quitado' },
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
  showToast(t('toast_debt_added'));
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
    state.debts.length === 0 ? t('debt_kpi_none') :
    state.lang === 'en'
      ? `${active.length} active debt${active.length !== 1 ? 's' : ''}`
      : `${active.length} ativa${active.length !== 1 ? 's' : ''}`;
  document.getElementById('kpiDebtMonthly').textContent = fmt(monthly);
  document.getElementById('kpiDebtOverdue').textContent = overdueCount;
  document.getElementById('kpiDebtBurden').textContent  = burdenPct.toFixed(1) + '%';

  const overdueCard = document.getElementById('kpiDebtOverdueCard');
  overdueCard.classList.toggle('has-overdue', overdueCount > 0);
  document.getElementById('kpiDebtOverdueSub').textContent =
    overdueCount > 0
      ? (state.lang === 'en' ? `debt${overdueCount > 1 ? 's' : ''} overdue!` : `dívida${overdueCount > 1 ? 's' : ''} em atraso!`)
      : t('debt_kpi_no_overdue');

  // Commitment sub-label
  const commitEl = document.getElementById('kpiDebtCommit');
  if (income > 0) {
    commitEl.textContent = state.lang === 'en'
      ? `${burdenPct.toFixed(1)}% of monthly income`
      : `${burdenPct.toFixed(1)}% da renda mensal`;
  } else {
    commitEl.textContent = t('debt_kpi_budget');
  }

  // Alert
  const alertEl = document.getElementById('debtAlert');
  if (overdueCount > 0) {
    alertEl.style.display = 'flex';
    alertEl.className = 'alert-box alert-danger';
    alertEl.innerHTML = state.lang === 'en'
      ? `<i class="fa-solid fa-triangle-exclamation"></i><div><strong>Warning:</strong> You have ${overdueCount} debt${overdueCount > 1 ? 's' : ''} with overdue installments. Regularize to avoid growing interest and credit damage.</div>`
      : `<i class="fa-solid fa-triangle-exclamation"></i><div><strong>Atenção:</strong> Você tem ${overdueCount} dívida${overdueCount > 1 ? 's' : ''} com parcelas em atraso. Regularize para evitar juros crescentes e negativação.</div>`;
  } else if (burdenPct > 35 && monthly > 0) {
    alertEl.style.display = 'flex';
    alertEl.className = 'alert-box alert-warning';
    alertEl.innerHTML = state.lang === 'en'
      ? `<i class="fa-solid fa-circle-info"></i><div><strong>High debt burden:</strong> Your installments consume ${burdenPct.toFixed(1)}% of income. Recommended is up to 30%. Consider renegotiating terms.</div>`
      : `<i class="fa-solid fa-circle-info"></i><div><strong>Comprometimento alto:</strong> Suas parcelas consomem ${burdenPct.toFixed(1)}% da renda. O recomendado é até 30%. Considere renegociar prazos.</div>`;
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
      <p>${state.debts.length === 0 ? `${t('debt_empty')}<br>${t('debt_empty_sub')}` : t('debt_cat_empty')}</p>
    </div>`;
    return;
  }

  list.innerHTML = [...filtered].reverse().map(d => debtCardHTML(d)).join('');
}

function debtCardHTML(d) {
  const _ti = debtTypeInfo[d.type]   || { icon: '✨', labelKey: 'debt_type_outros' };
  const _si = debtStatusInfo[d.status] || { labelKey: 'debt_status_pagando', cls: '' };
  const typeInfo   = { icon: _ti.icon, label: t(_ti.labelKey) };
  const statusInfo = { label: t(_si.labelKey), cls: _si.cls };

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

  const instLbl = state.lang === 'en' ? 'installments' : 'parcelas';
  const paidLbl = state.lang === 'en' ? 'paid' : 'pagas';
  const installStr = d.totalInstallments
    ? `${d.paidInstallments}/${d.totalInstallments} ${instLbl}`
    : d.paidInstallments > 0 ? `${d.paidInstallments} ${paidLbl}` : '—';

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
          ${d.overdueInstallments} ${d.overdueInstallments > 1 ? t('dc_overdue_inst_pl') : t('dc_overdue_inst')}
        </div>` : ''}

      ${d.totalInstallments || d.totalAmount > 0 ? `
        <div class="debt-progress-section">
          <div class="debt-progress-bar">
            <div class="debt-progress-fill ${fillCls}" style="width:${pct}%"></div>
          </div>
          <div class="debt-progress-labels">
            <strong>${installStr}</strong>
            <span>${pct}${t('dc_paid_pct')}</span>
          </div>
        </div>` : ''}

      <div class="debt-details">
        <div class="debt-detail">
          <span class="debt-detail-label">${t('dc_balance')}</span>
          <span class="debt-detail-value" style="color:var(--danger)">${fmt(d.remainingAmount)}</span>
        </div>
        <div class="debt-detail">
          <span class="debt-detail-label">${t('dc_monthly')}</span>
          <span class="debt-detail-value">${fmt(d.installmentValue)}</span>
        </div>
        <div class="debt-detail">
          <span class="debt-detail-label">${t('dc_interest')}</span>
          <span class="debt-detail-value">${rateStr}</span>
        </div>
        <div class="debt-detail">
          <span class="debt-detail-label">${t('dc_due')}</span>
          <span class="debt-detail-value">${d.dueDay ? t('dc_due_day') + d.dueDay : '—'}</span>
        </div>
      </div>

      <div class="debt-card-actions">
        <button class="btn-debt-edit" onclick="openDebtEdit('${d.id}')">
          <i class="fa-solid fa-pen"></i> ${t('dc_edit')}
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
  showToast(t('toast_debt_removed'), 'danger');
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
  showToast(t('toast_changes_saved'));
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
    nameEl.textContent     = t('visitor');
    emailEl.textContent    = t('local_mode');
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
  btn.innerHTML = `<i class="fa-solid fa-rotate fa-spin"></i> ${t('btn_login_loading')}`;
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
    showToast(t('toast_welcome').replace('{name}', res.user.name.split(' ')[0]));
  } catch (err) {
    errEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escHtml(err.message)}`;
    errEl.style.display = 'flex';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> ${t('auth_btn_login')}`;
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
    errEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${t('err_server_offline')}`;
    errEl.style.display = 'flex';
    return;
  }
  if (password !== confirm) {
    errEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${t('err_pass_mismatch')}`;
    errEl.style.display = 'flex';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-rotate fa-spin"></i> ${t('btn_register_loading')}`;
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
    showToast(t('toast_account_created'));
  } catch (err) {
    errEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escHtml(err.message)}`;
    errEl.style.display = 'flex';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> ${t('auth_btn_register')}`;
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
  renderLearn();
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
  showToast(t('toast_demo_loaded'));
}

init();
