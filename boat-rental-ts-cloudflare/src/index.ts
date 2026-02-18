// src/index.ts - App Hono para Cloudflare Workers con D1 y auth

import { Hono } from 'hono';
import { html } from 'hono/html';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import * as jwtPkg from 'jsonwebtoken';

const { sign, verify } = jwtPkg;

type Bindings = {
  DB: D1Database;
  SESSION_KV: KVNamespace;
  JWT_SECRET: string;
}

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

// Auth middleware para rutas protegidas
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.html(html`<h1>No autorizado</h1>`, 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verify(token, c.env.JWT_SECRET) as { userId: number };
    c.set('userId', payload.userId);
    await next();
  } catch (e) {
    return c.html(html`<h1>Token inválido</h1>`, 401);
  }
};

// Login
app.get('/login', (c) => c.html(html`
  <!doctype html>
  <html data-bs-theme="dark">
  <head><title>Login</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><style>body{background:#121212;color:#fff;}</style></head>
  <body class="container mt-5">
    <h2>Iniciar Sesión</h2>
    <form action="/api/login" method="post">
      <input type="text" name="username" placeholder="Usuario" class="form-control bg-dark text-light mb-3" required>
      <input type="password" name="password" placeholder="Contraseña" class="form-control bg-dark text-light mb-3" required>
      <button type="submit" class="btn btn-primary">Entrar</button>
    </form>
  </body>
  </html>
`));

app.post('/api/login', zValidator('form', z.object({ username: z.string(), password: z.string() })), async (c) => {
  const { username, password } = c.req.valid('form');
  const user = await c.env.DB.prepare('SELECT id, password_hash FROM users WHERE username = ?').bind(username).first();
  if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);
  // En prod: bcrypt.compare(password, user.password_hash)
  if (password !== 'password') return c.json({ error: 'Contraseña inválida' }, 401);  // Placeholder
  const token = sign({ userId: user.id }, c.env.JWT_SECRET, { expiresIn: '1h' });
  return c.json({ token });
});

// Dashboard (protegido)
app.get('/dashboard', authMiddleware, async (c) => {
  const totalRes = await c.env.DB.prepare('SELECT COUNT(*) as count FROM reservations').first<number>('count') ?? 0;
  const totalIncome = await c.env.DB.prepare('SELECT SUM(amount) as sum FROM invoices WHERE paid = 1').first<number>('sum') ?? 0;
  const availBoats = await c.env.DB.prepare('SELECT COUNT(*) as count FROM boats WHERE available = 1').first<number>('count') ?? 0;

  return c.html(html`
    <!doctype html>
    <html data-bs-theme="dark">
    <head><title>Dashboard</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><style>body{background:#121212;color:#fff;}</style></head>
    <body class="container mt-5">
      <h1 class="text-center mb-4">Dashboard - Alquiler de Botes y Jetskis</h1>
      <div class="row g-4">
        <div class="col-md-4"><div class="card bg-dark border-0 shadow-lg"><div class="card-body text-center"><h5>Reservas Totales</h5><p class="display-4">${totalRes}</p></div></div></div>
        <div class="col-md-4"><div class="card bg-dark border-0 shadow-lg"><div class="card-body text-center"><h5>Ingresos</h5><p class="display-4">$${totalIncome.toFixed(2)}</p></div></div></div>
        <div class="col-md-4"><div class="card bg-dark border-0 shadow-lg"><div class="card-body text-center"><h5>Botes Disponibles</h5><p class="display-4">${availBoats}</p></div></div></div>
      </div>
      <nav class="navbar navbar-expand-lg navbar-dark bg-dark mt-5 rounded shadow">
        <ul class="navbar-nav mx-auto">
          <li class="nav-item"><a class="nav-link px-3" href="/clients">Clientes</a></li>
          <li class="nav-item"><a class="nav-link px-3" href="/boats">Botes</a></li>
          <li class="nav-item"><a class="nav-link px-3" href="/reservations">Reservas</a></li>
          <li class="nav-item"><a class="nav-link px-3" href="/invoices">Facturas</a></li>
          <li class="nav-item"><a class="nav-link px-3" href="/cash">Caja</a></li>
          <li class="nav-item"><a class="nav-link px-3" href="/reports">Reportes</a></li>
          <li class="nav-item"><a class="nav-link px-3" href="/maintenance">Mantenimiento</a></li>
        </ul>
      </nav>
    </body>
    </html>
  `);
});

// Clientes (protegido, CRUD ejemplo)
app.get('/clients', authMiddleware, async (c) => {
  const clients = await c.env.DB.prepare('SELECT * FROM clients').all().then(r => r.results);
  return c.html(html`
    <html data-bs-theme="dark">
    <head><title>Clientes</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><style>body{background:#121212;color:#fff;}</style></head>
    <body class="container mt-5">
      <h1>Gestión de Clientes</h1>
      <table class="table table-dark table-striped shadow">
        <thead><tr><th>ID</th><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Acciones</th></tr></thead>
        <tbody>${clients.map(c => html`<tr><td>${c.id}</td><td>${c.name}</td><td>${c.email ?? '-'}</td><td>${c.phone ?? '-'}</td><td><a href="/clients/edit/${c.id}" class="btn btn-sm btn-outline-light">Editar</a> <button class="btn btn-sm btn-outline-danger">Eliminar</button></td></tr>`)}</tbody>
      </table>
      <form action="/api/clients" method="post" class="mt-4">
        <input type="text" name="name" placeholder="Nombre" class="form-control bg-dark text-light mb-3" required>
        <input type="email" name="email" placeholder="Email" class="form-control bg-dark text-light mb-3">
        <input type="text" name="phone" placeholder="Teléfono" class="form-control bg-dark text-light mb-3">
        <button type="submit" class="btn btn-primary">Agregar</button>
      </form>
    </body>
    </html>
  `);
});

app.post('/api/clients', zValidator('form', z.object({ name: z.string(), email: z.string().optional(), phone: z.string().optional() })), async (c) => {
  const { name, email, phone } = c.req.valid('form');
  await c.env.DB.prepare('INSERT INTO clients (name, email, phone) VALUES (?, ?, ?)').bind(name, email ?? null, phone ?? null).run();
  return c.redirect('/clients');
});

// Implementa similar para /boats, /reservations, /invoices, /cash, /reports, /maintenance
// Ej: Para Botes
app.get('/boats', authMiddleware, async (c) => {
  // Código similar a clients, ajusta campos: name, type, capacity, available
});

// Para Reportes: Query agregadas, e.g., ingresos por mes, ocupación
app.get('/reports', authMiddleware, async (c) => {
  const incomeByMonth = await c.env.DB.prepare('SELECT strftime("%Y-%m", date) as month, SUM(amount) as total FROM invoices WHERE paid = 1 GROUP BY month').all().then(r => r.results);
  // Render table con datos
});

// Ruta raíz
app.get('/', (c) => c.redirect('/login'));

export default app;
