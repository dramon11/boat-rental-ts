// src/index.ts - Sistema completo con Hono + D1 + tema oscuro profesional (negro)

import { Hono } from 'hono'
import { html } from 'hono/html'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sign, verify } from 'jsonwebtoken'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Auth middleware (Bearer Token)
const auth = async (c: any, next: any) => {
  const token = c.req.header('Authorization')?.split(' ')[1]
  if (!token) {
    return c.html(html`<h1>401 - Inicia sesión</h1><p><a href="/login">Volver al login</a></p>`, 401)
  }
  try {
    const payload = verify(token, c.env.JWT_SECRET) as { userId: number }
    c.set('userId', payload.userId)
    await next()
  } catch (e) {
    return c.html(html`<h1>401 - Token inválido</h1><p><a href="/login">Volver al login</a></p>`, 401)
  }
}

// Página de Login (HTML directo con Bootstrap dark theme)
app.get('/login', (c) => c.html(html`
<!doctype html>
<html data-bs-theme="dark" lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login - Alquiler Botes & Jetskis</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { background: #0d1117; color: #c9d1d9; }
    .card { background: linear-gradient(135deg, #161b22, #0d1117); }
  </style>
</head>
<body class="d-flex align-items-center min-vh-100">
  <div class="container">
    <div class="row justify-content-center">
      <div class="col-md-4">
        <div class="card shadow-lg border-0">
          <div class="card-body p-5">
            <h2 class="text-center mb-4">Sistema de Alquiler</h2>
            <form action="/api/login" method="post">
              <div class="mb-3">
                <input name="username" class="form-control bg-dark text-white border-secondary" placeholder="Usuario" required autofocus>
              </div>
              <div class="mb-3">
                <input name="password" type="password" class="form-control bg-dark text-white border-secondary" placeholder="Contraseña" required>
              </div>
              <button type="submit" class="btn btn-primary w-100">Ingresar</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`))

// API Login (placeholder simple – en prod hashea password con bcrypt o similar)
app.post('/api/login', zValidator('form', z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})), async (c) => {
  const { username, password } = c.req.valid('form')
  const user = await c.env.DB.prepare('SELECT id, password_hash FROM users WHERE username = ?').bind(username).first()
  
  if (!user || password !== user.password_hash) {  // Placeholder: compara directo
    return c.json({ error: 'Credenciales inválidas' }, 401)
  }

  const token = sign({ userId: user.id }, c.env.JWT_SECRET, { expiresIn: '24h' })
  return c.json({ token })
})

// Dashboard protegido (raíz /)
app.get('/', auth, async (c) => {
  const [resCountRes, incomeRes, availBoatsRes] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as c FROM reservations').first(),
    c.env.DB.prepare('SELECT SUM(amount) as s FROM invoices WHERE paid = 1').first(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM boats WHERE available = 1').first()
  ])

  const resCount = resCountRes?.c ?? 0
  const income = Number(incomeRes?.s ?? 0).toFixed(2)
  const availBoats = availBoatsRes?.c ?? 0

  return c.html(html`
<!doctype html>
<html data-bs-theme="dark" lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dashboard - Alquiler Botes & Jetskis</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { background: #0d1117; color: #c9d1d9; }
    .card { background: linear-gradient(135deg, #161b22, #0d1117); border: none; }
  </style>
</head>
<body>
  <nav class="navbar navbar-expand-lg bg-dark border-bottom border-secondary">
    <div class="container-fluid">
      <a class="navbar-brand text-white" href="/">Alquiler Botes & Jetskis</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto">
          <li class="nav-item"><a class="nav-link" href="/clients">Clientes</a></li>
          <li class="nav-item"><a class="nav-link" href="/boats">Botes</a></li>
          <li class="nav-item"><a class="nav-link" href="/reservations">Reservas</a></li>
          <li class="nav-item"><a class="nav-link" href="/invoices">Facturas</a></li>
          <li class="nav-item"><a class="nav-link" href="/cash">Caja</a></li>
          <li class="nav-item"><a class="nav-link" href="/reports">Reportes</a></li>
          <li class="nav-item"><a class="nav-link" href="/maintenance">Mantenimiento</a></li>
        </ul>
      </div>
    </div>
  </nav>

  <div class="container mt-5">
    <h1 class="mb-4 text-center">Dashboard</h1>
    <div class="row g-4">
      <div class="col-md-4">
        <div class="card shadow-lg text-center">
          <div class="card-body">
            <h5 class="card-title">Reservas Totales</h5>
            <p class="display-4 fw-bold">${resCount}</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card shadow-lg text-center">
          <div class="card-body">
            <h5 class="card-title">Ingresos (Pagados)</h5>
            <p class="display-4 fw-bold">$${income}</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card shadow-lg text-center">
          <div class="card-body">
            <h5 class="card-title">Botes Disponibles</h5>
            <p class="display-4 fw-bold">${availBoats}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `)
})

// Ejemplo completo: Clientes (listar + agregar)
app.get('/clients', auth, async (c) => {
  const clients = await c.env.DB.prepare('SELECT * FROM clients ORDER BY name').all().then(r => r.results)

  return c.html(html`
<!doctype html>
<html data-bs-theme="dark" lang="es">
<head>
  <meta charset="utf-8">
  <title>Clientes</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>body { background: #0d1117; color: #c9d1d9; } .card { background: linear-gradient(135deg, #161b22, #0d1117); }</style>
</head>
<body>
  <nav class="navbar navbar-expand-lg bg-dark border-bottom border-secondary">
    <!-- misma nav que en dashboard -->
    <div class="container-fluid">
      <a class="navbar-brand" href="/">← Volver al Dashboard</a>
    </div>
  </nav>
  <div class="container mt-5">
    <h1>Gestión de Clientes</h1>
    <div class="card shadow-lg mt-4">
      <div class="card-body">
        <table class="table table-dark table-hover">
          <thead>
            <tr><th>ID</th><th>Nombre</th><th>Email</th><th>Teléfono</th></tr>
          </thead>
          <tbody>
            ${clients.map(client => html`
              <tr>
                <td>${client.id}</td>
                <td>${client.name}</td>
                <td>${client.email ?? '-'}</td>
                <td>${client.phone ?? '-'}</td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card shadow-lg mt-5">
      <div class="card-body">
        <h3>Agregar Cliente</h3>
        <form action="/api/clients" method="post">
          <div class="mb-3">
            <input name="name" class="form-control bg-dark text-white border-secondary" placeholder="Nombre completo" required>
          </div>
          <div class="mb-3">
            <input name="email" type="email" class="form-control bg-dark text-white border-secondary" placeholder="Email">
          </div>
          <div class="mb-3">
            <input name="phone" class="form-control bg-dark text-white border-secondary" placeholder="Teléfono">
          </div>
          <button type="submit" class="btn btn-primary">Agregar Cliente</button>
        </form>
      </div>
    </div>
  </div>
</body>
</html>
  `)
})

app.post('/api/clients', auth, zValidator('form', z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional()
})), async (c) => {
  const { name, email, phone } = c.req.valid('form')
  await c.env.DB.prepare('INSERT INTO clients (name, email, phone) VALUES (?, ?, ?)').bind(name, email ?? null, phone ?? null).run()
  return c.redirect('/clients')
})

// ... Agrega rutas similares para /boats, /reservations, /invoices, /cash, /reports, /maintenance
// Ejemplo rápido para reportes (simple)
app.get('/reports', auth, async (c) => {
  // Query ejemplo: ingresos por mes
  const reports = await c.env.DB.prepare(`
    SELECT strftime('%Y-%m', date) as mes, SUM(amount) as total
    FROM invoices WHERE paid = 1 GROUP BY mes ORDER BY mes DESC
  `).all().then(r => r.results)

  return c.html(html`... <table> con datos de reports ...`)
})

export default app