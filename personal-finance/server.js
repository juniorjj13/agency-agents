/**
 * FinançasSim — Backend Server
 * Node.js + Express + SQLite + JWT + bcrypt
 *
 * Run: npm install && npm start
 * Opens at: http://localhost:3001
 */

const express  = require('express');
const path     = require('path');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const Database = require('better-sqlite3');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Config (override via env vars in production) ──────────
const JWT_SECRET    = process.env.JWT_SECRET    || 'fs-secret-key-2026-change-in-prod';
const PREMIUM_CODE  = process.env.PREMIUM_CODE  || 'FINANCASPRO2026';
const JWT_EXPIRES   = '30d';

// ── Database setup ─────────────────────────────────────────
const db = new Database(path.join(__dirname, 'financassim.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    premium       INTEGER DEFAULT 0,
    created_at    TEXT    DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_data (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER UNIQUE NOT NULL,
    incomes    TEXT DEFAULT '[]',
    expenses   TEXT DEFAULT '[]',
    goals      TEXT DEFAULT '[]',
    theme      TEXT DEFAULT 'light',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Migration: add debts column to existing databases
try { db.exec(`ALTER TABLE user_data ADD COLUMN debts TEXT DEFAULT '[]'`); } catch {} // already exists

// ── Middleware ─────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado. Faça login novamente.' });
  }
}

// ── Auth Routes ────────────────────────────────────────────

// POST /api/register
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password)
    return res.status(400).json({ error: 'Preencha todos os campos.' });

  if (password.length < 6)
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email))
    return res.status(400).json({ error: 'E-mail inválido.' });

  try {
    const hash   = bcrypt.hashSync(password.trim(), 10);
    const result = db.prepare(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
    ).run(name.trim(), email.trim().toLowerCase(), hash);

    db.prepare('INSERT INTO user_data (user_id) VALUES (?)').run(result.lastInsertRowid);

    const user  = { id: result.lastInsertRowid, name: name.trim(), email: email.trim().toLowerCase(), premium: 0 };
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE'))
      return res.status(400).json({ error: 'E-mail já cadastrado. Faça login.' });
    console.error('register error:', err);
    res.status(500).json({ error: 'Erro interno ao criar conta.' });
  }
});

// POST /api/login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Preencha todos os campos.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(
    (email || '').trim().toLowerCase()
  );
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, premium: user.premium } });
});

// GET /api/me
app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, premium FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  res.json(user);
});

// ── Data Routes ────────────────────────────────────────────

// GET /api/data
app.get('/api/data', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM user_data WHERE user_id = ?').get(req.user.id);
  if (!row) return res.json({ incomes: [], expenses: [], goals: [], debts: [], theme: 'light' });

  res.json({
    incomes:  safeJSON(row.incomes,  []),
    expenses: safeJSON(row.expenses, []),
    goals:    safeJSON(row.goals,    []),
    debts:    safeJSON(row.debts,    []),
    theme:    row.theme || 'light',
    updatedAt: row.updated_at,
  });
});

// PUT /api/data
app.put('/api/data', requireAuth, (req, res) => {
  const { incomes = [], expenses = [], goals = [], debts = [], theme = 'light' } = req.body || {};

  db.prepare(`
    INSERT INTO user_data (user_id, incomes, expenses, goals, debts, theme, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      incomes    = excluded.incomes,
      expenses   = excluded.expenses,
      goals      = excluded.goals,
      debts      = excluded.debts,
      theme      = excluded.theme,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    req.user.id,
    JSON.stringify(incomes),
    JSON.stringify(expenses),
    JSON.stringify(goals),
    JSON.stringify(debts),
    theme
  );

  res.json({ ok: true });
});

// ── Premium Routes ─────────────────────────────────────────

// POST /api/premium/unlock
app.post('/api/premium/unlock', requireAuth, (req, res) => {
  const { code } = req.body || {};
  if (!code || code.trim().toUpperCase() !== PREMIUM_CODE.toUpperCase())
    return res.status(400).json({ error: 'Código inválido. Verifique e tente novamente.' });

  db.prepare('UPDATE users SET premium = 1 WHERE id = ?').run(req.user.id);
  res.json({ ok: true, message: 'Premium ativado com sucesso! 🎉' });
});

// GET /api/ping  (health check)
app.get('/api/ping', (_, res) => res.json({ ok: true, version: '1.0.0' }));

// ── Catch-all: serve index.html ────────────────────────────
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║   FinançasSim — Servidor rodando     ║');
  console.log(`  ║   http://localhost:${PORT}              ║`);
  console.log('  ║                                      ║');
  console.log(`  ║   Código premium: ${PREMIUM_CODE.padEnd(16)}  ║`);
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
});

function safeJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}
