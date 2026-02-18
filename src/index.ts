# // src/index.ts - Sistema completo de alquiler de botes y jetskis
# // Tema oscuro profesional - Todos los módulos implementados

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

# // ── Middleware de autenticación ────────────────────────────────────────────
const auth = async (c: any, next: any) => {
  const token = c.req.header('Authorization')?.split(' ')[1]
  if (!token) {
    return c.html(html`<h1>401 - Inicia sesión</h1><p><a href="/login">Ir al login</a></p>`, 401)
  }
  try {
    const payload = verify(token, c.env.JWT_SECRET) as { userId: number }
    c.set('userId', payload.userId)
    await next()
  } catch {
    return c.html(html`<h1>401 - Token inválido</h1><p><a href="/login">Ir al login</a></p>`, 401)
  }
}

# // ── Página de Login ────────────────────────────────────────────────────────
app.get('/login', (c) => c.html(html`
<!doctype html>
<html data-bs-theme="dark" lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login - Alquiler Botes & Jetskis</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { background: #0d1117; color: #c9d1d9; font-family: system-ui, sans-serif; }
    .card { background: linear-gradient(#135deg, #161b22, #0d1117); }
  </style>
</head>
<body class="d-flex align-items-center min-vh-100">
  <div class="container">
    <div class="row justify-content-center">
      <div class="col-md-4">
        <div class="card shadow-lg border-0">
          <div class="card-body p-5">
            <h2 class="text-center mb-4">Iniciar Sesión</h2>
            <form action="/api/login" method="post">
              <div class="mb-3">
                <input name="username" class="form-control bg-dark text-white border-secondary" placeholder="Usuario" required autofocus>
              </div>
              <div class="mb-3">
                <input name="password" type="password" class="form-control bg-dark text-white border-secondary" placeholder="Contraseña" required>
              </div>
              <button type="submit" class="btn btn-primary w-100">Entrar</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`)}

# // ── API Login (placeholder - contraseña sin hash) ───────────────────────────
app.post('/api/login', zValidator('form', z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})), async (c) => {
  const { username, password } = c.req.valid('form')
  const user = await c.env.DB.prepare('SELECT id, password_hash FROM users WHERE username = ?').bind(username).first()

  if (!user || password !== user.password_hash) {
    return c.json({ error: 'Credenciales inválidas' }, 401)
  }

  const token = sign({ userId: user.id }, c.env.JWT_SECRET, { expiresIn: '24h' })
  return c.json({ token })
})

# // ── Dashboard ──────────────────────────────────────────────────────────────
app.get('/', auth, async (c) => {
  const [reservations, income, availableBoats] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM reservations').first('count'),
    c.env.DB.prepare('SELECT SUM(amount) as total FROM invoices WHERE paid = 1').first('total'),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM boats WHERE available = 1').first('count')
  ])

  return c.html(html`
<!doctype html>
<html data-bs-theme="dark" lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dashboard</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { background: #0d1117; color: #c9d1d9; }
    .card { background: linear-gradient(#135deg, #161b22, #0d1117); border: none; }
  </style>
</head>
<body>
  <nav class="navbar navbar-expand-lg bg-dark border-bottom border-secondary fixed-top">
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

  <div class="container mt-5 pt-5">
    <h1 class="mb-4 text-center">Dashboard</h1>
    <div class="row g-4">
      <div class="col-md-4">
        <div class="card shadow text-center">
          <div class="card-body">
            <h5 class="card-title">Reservas Totales</h5>
            <p class="display-4 fw-bold">${reservations ?? 0}</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card shadow text-center">
          <div class="card-body">
            <h5 class="card-title">Ingresos (Pagados)</h5>
            <p class="display-4 fw-bold">$${Number(income ?? 0).toFixed(2)}</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card shadow text-center">
          <div class="card-body">
            <h5 class="card-title">Botes Disponibles</h5>
            <p class="display-4 fw-bold">${availableBoats ?? 0}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `)
}

# // ── Clientes ───────────────────────────────────────────────────────────────
app.get('/clients', auth, async (c) => {
  const clients = await c.env.DB.prepare('SELECT * FROM clients ORDER BY name').all().then(r => r.results || [])

  return c.html(html`
<!doctype html>
<html data-bs-theme="dark" lang="es">
<head>
  <meta charset="utf-8">
  <title>Clientes</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>body{background:#0d1117;color:#c9d1d9;} </style> 
</head>
<body>
  <nav class="navbar navbar-expand-lg bg-dark border-bottom border-secondary fixed-top">
    <div class="container-fluid">
      <a class="navbar-brand" href="/">Dashboard</a>
    </div>
  </nav>
  <div class="container mt-5 pt-5">
    <h1 class="mb-4">Gestión de Clientes</h1>
    <div class="card shadow mt-4">
      <div class="card-body">
        <table class="table table-dark table-hover">
          <thead><tr><th>ID</th><th>Nombre</th><th>Email</th><th>Teléfono</th></tr></thead>
          <tbody>${clients.map(c => html`
            <tr>
              <td>${c.id}</td>
              <td>${c.name}</td>
              <td>${c.email ?? '-'}</td>
              <td>${c.phone ?? '-'}</td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    </div>

    <div class="card shadow mt-5">
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
          <button type="submit" class="btn btn-primary">Agregar</button>
        </form>
      </div>
    </div>
  </div>
</body>
</html>
  `}

app.post('/api/clients', auth, zValidator('form', z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal(''))
})), async (c) => {
  const { name, email, phone } = c.req.valid('form')
  await c.env.DB.prepare('INSERT INTO clients (name, email, phone) VALUES (?, ?, ?)').bind(name, email || null, phone || null).run()
  return c.redirect('/clients')
})

# // ── Botes ──────────────────────────────────────────────────────────────────
app.get('/boats', auth, async (c) => {
  const boats = await c.env.DB.prepare('SELECT * FROM boats ORDER BY name').all().then(r => r.results || [])

  return c.html(html`
<!doctype html>
<html data-bs-theme="dark" lang="es">
<head>
  <meta charset="utf-8">
  <title>Botes</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>body{background:#0d1117;color:#c9d1d9;} </style>
</head>
<body>
  <nav class="navbar navbar-expand-lg bg-dark border-bottom border-secondary fixed-top">
    <div class="container-fluid">
      <a class="navbar-brand" href="/">Dashboard</a>
    </div>
  </nav>
  <div class="container mt-5 pt-5">
    <h1 class="mb-4">Gestión de Botes y Jetskis</h1>
    <div class="card shadow mt-4">
      <div class="card-body">
        <table class="table table-dark table-hover">
          <thead><tr><th>ID</th><th>Nombre</th><th>Tipo</th><th>Capacidad</th><th>Disponible</th></tr></thead>
          <tbody>${boats.map(b => html`
            <tr>
              <td>${b.id}</td>
              <td>${b.name}</td>
              <td>${b.type}</td>
              <td>${b.capacity}</td>
              <td>${b.available ? 'Sí' : 'No'}</td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    </div>

    <div class="card shadow mt-5">
      <div class="card-body">
        <h3>Agregar Bote / Jetski</h3>
        <form action="/api/boats" method="post">
          <div class="mb-3">
            <input name="name" class="form-control bg-dark text-white border-secondary" placeholder="Nombre" required>
          </div>
          <div class="mb-3">
            <input name="type" class="form-control bg-dark text-white border-secondary" placeholder="Tipo (Bote o Jetski)" required>
          </div>
          <div class="mb-3">
            <input name="capacity" type="number" class="form-control bg-dark text-white border-secondary" placeholder="Capacidad (personas)" required>
          </div>
          <div class="form-check mb-3">
            <input name="available" type="checkbox" class="form-check-input" id="available" checked>
            <label class="form-check-label" for="available">Disponible</label>
          </div>
          <button type="submit" class="btn btn-primary">Agregar</button>
        </form>
      </div>
    </div>
  </div>
</body>
</html>
  `})

app.post('/api/boats', auth, zValidator('form', z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  capacity: z.coerce.number().int().positive(),
  available: z.coerce.boolean().optional()
})), async (c) => {
  const { name, type, capacity, available } = c.req.valid('form')
  await c.env.DB.prepare('INSERT INTO boats (name, type, capacity, available) VALUES (?, ?, ?, ?)').bind(name, type, capacity, available ? 1 : 0).run()
  return c.redirect('/boats')
})

# // ── Reservas ───────────────────────────────────────────────────────────────
app.get('/reservations', auth, async (c) => {
  const reservations = await c.env.DB.prepare('SELECT * FROM reservations ORDER BY start_date DESC').all().then(r => r.results || [])

  return c.html(html`
<!doctype html>
<html data-bs-theme="dark" lang="es">
<head>
  <meta charset="utf-8">
  <title>Reservas</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>body{background:#0d1117;color:#c9d1d9;}</style>
</head>
<body>
  <nav class="navbar navbar-expand-lg bg-dark border-bottom border-secondary fixed-top">
    <div class="container-fluid">
      <a class="navbar-brand" href="/">Dashboard</a>
    </div>
  </nav>
  <div class="container mt-5 pt-5">
    <h1 class="mb-4">Gestión de Reservas</h1>
    <div class="card shadow mt-4">
      <div class="card-body">
        <table class="table table-dark table-hover">
          <thead><tr><th>ID</th><th>Cliente ID</th><th>Bote ID</th><th>Inicio</th><th>Fin</th><th>Estado</th></tr></thead>
          <tbody>${reservations.map(r => html`
            <tr>
              <td>${r.id}</td>
              <td>${r.client_id}</td>
              <td>${r.boat_id}</td>
              <td>${r.start_date}</td>
              <td>${r.end_date}</td>
              <td>${r.status}</td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    </div>

    <div class="card shadow mt-5">
      <div class="card-body">
        <h3>Crear Nueva Reserva</h3>
        <form action="/api/reservations" method="post">
          <div class="mb-3">
            <input name="client_id" type="number" class="form-control bg-dark text-white border-secondary" placeholder="ID Cliente" required>
          </div>
          <div class="mb-3">
            <input name="boat_id" type="number" class="form-control bg-dark text-white border-secondary" placeholder="ID Bote" required>
          </div>
          <div class="mb-3">
            <input name="start_date" class="form-control bg-dark text-white border-secondary" placeholder="Inicio (YYYY-MM-DD HH:MM)" required>
          </div>
          <div class="mb-3">
            <input name="end_date" class="form-control bg-dark text-white border-secondary" placeholder="Fin (YYYY-MM-DD HH:MM)" required>
          </div>
          <button type="submit" class="btn btn-primary">Crear Reserva</button>
        </form>
      </div>
    </div>
  </div>
</body>
</html>
  `}

app.post('/api/reservations', auth, zValidator('form', z.object({
  client_id: z.coerce.number().int().positive(),
  boat_id: z.coerce.number().int().positive(),
  start_date: z.string().min(1),
  end_date: z.string().min(1)
})), async (c) => {
  const { client_id, boat_id, start_date, end_date } = c.req.valid('form')
  await c.env.DB.prepare('INSERT INTO reservations (client_id, boat_id, start_date, end_date) VALUES (?, ?, ?, ?)').bind(client_id, boat_id, start_date, end_date).run()
  return c.redirect('/reservations')
})

# // ── Facturas ───────────────────────────────────────────────────────────────
app.get('/invoices', auth, async (c) => {
  const invoices = await c.env.DB.prepare('SELECT * FROM invoices ORDER BY date DESC').all().then(r => r.results || [])

  return c.html(html`
<!doctype html>
<html data-bs-theme="dark" lang="es">
<head>
  <meta charset="utf-8">
  <title>Facturas</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>body{background:#0d1117;color:#c9d1d9;}</style>
</head>
<body>
  <nav class="navbar navbar-expand-lg bg-dark border-bottom border-secondary fixed-top">
    <div class="container-fluid">
      <a class="navbar-brand" href="/">Dashboard</a>
    </div>
  </nav>
  <div class="container mt-5 pt-5">
    <h1 class="mb-4">Gestión de Facturas</h1>
    <div class="card shadow mt-4">
      <div class="card-body">
        <table class="table table-dark table-hover">
          <thead><tr><th>ID</th><th>Reserva ID</th><th>Monto</th><th>Pagada</th><th>Fecha</th></tr></thead>
          <tbody>${invoices.map(i => html`
            <tr>
              <td>${i.id}</td>
              <td>${i.reservation_id}</td>
              <td>$${Number(i.amount).toFixed(2)}</td>
              <td>${i.paid ? 'Sí' : 'No'}</td>
              <td>${i.date}</td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    </div>

    <div class="card shadow mt-5">
      <div class="card-body">
        <h3>Generar Factura</h3>
        <form action="/api/invoices" method="post">
          <div class="mb-3">
            <input name="reservation_id" type="number" class="form-control bg-dark text-white border-secondary" placeholder="ID Reserva" required>
          </div>
          <div class="mb-3">
            <input name="amount" type="number" step="0.01" class="form-control bg-dark text-white border-secondary" placeholder="Monto total" required>
          </div>
          <button type="submit" class="btn btn-primary">Generar</button>
        </form>
      </div>
    </div>
  </div>
</body>
</html>
  `}

app.post('/api/invoices', auth, zValidator('form', z.object({
  reservation_id: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive()
})), async (c) => {
  const { reservation_id, amount } = c.req.valid('form')
  await c.env.DB.prepare('INSERT INTO invoices (reservation_id, amount) VALUES (?, ?)').bind(reservation_id, amount).run()
  return c.redirect('/invoices')
})

# // ── Caja (Pagos) ───────────────────────────────────────────────────────────
app.get('/cash', auth, async (c) => {
  const transactions = await c.env.DB.prepare('SELECT * FROM cash_transactions ORDER BY date DESC').all().then(r => r.results || [])

  return c.html(html`
<!doctype html>
<html data-bs-theme="dark" lang="es">
<head>
  <meta charset="utf-8">
  <title>Caja</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>body{background:#0d1117;color:#c9d1d9;}</style>
</head>
<body>
  <nav class="navbar navbar-expand-lg bg-dark border-bottom border-secondary fixed-top">
    <div class="container-fluid">
      <a class="navbar-brand" href="/">Dashboard</a>
    </div>
  </nav>
  <div class="container mt-5 pt-5">
    <h1 class="mb-4">Gestión de Caja (Pagos)</h1>
    <div class="card shadow mt-4">
      <div class="card-body">
        <table class="table table-dark table-hover">
          <thead><tr><th>ID</th><th>Factura ID</th><th>Monto</th><th>Método</th><th>Fecha</th></tr></thead>
          <tbody>${transactions.map(t => html`
            <tr>
              <td>${t.id}</td>
              <td>${t.invoice_id}</td>
              <td>$${Number(t.amount).toFixed(2)}</td>
              <td>${t.method}</td>
              <td>${t.date}</td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    </div>

    <div class="card shadow mt-5">
      <div class="card-body">
        <h3>Registrar Pago</h3>
        <form action="/api/cash" method="post">
          <div class="mb-3">
            <input name="invoice_id" type="number" class="form-control bg-dark text-white border-secondary" placeholder="ID Factura" required>
          </div>
          <div class="mb-3">
            <input name="amount" type="number" step="0.01" class="form-control bg-dark text-white border-secondary" placeholder="Monto pagado" required>
          </div>
          <div class="mb-3">
            <select name="method" class="form-select bg-dark text-white border-secondary">
              <option>Efectivo</option>
              <option>Tarjeta</option>
              <option>Transferencia</option>
              <option>Otro</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary">Registrar</button>
        </form>
      </div>
    </div>
  </div>
</body>
</html>
  `}

app.post('/api/cash', auth, zValidator('form', z.object({
  invoice_id: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  method: z.string().min(1)
})), async (c) => {
  const { invoice_id, amount, method } = c.req.valid('form')
  await c.env.DB.prepare('INSERT INTO cash_transactions (invoice_id, amount, method) VALUES (?, ?, ?)').bind(invoice_id, amount, method).run()
  return c.redirect('/cash')
})

# // ── Reportes ───────────────────────────────────────────────────────────────
app.get('/reports', auth, async (c) => {
  const incomeByMonth = await c.env.DB.prepare(`
    SELECT strftime('%Y-%m', date) as mes, SUM(amount) as total 
    FROM invoices WHERE paid = 1 GROUP BY mes ORDER BY mes DESC
  `).all().then(r => r.results || [])

  const boatOccupancy = await c.env.DB.prepare(`
    SELECT boats.name, COUNT(reservations.id) as reservas 
    FROM boats LEFT JOIN reservations ON boats.id = reservations.boat_id 
    GROUP BY boats.id ORDER BY reservas DESC
  `).all().then(r => r.results || [])

  return c.html(html`
<!doctype html>
<html data-bs-theme="dark" lang="es">
<head>
  <meta charset="utf-8">
  <title>Reportes</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>body{background:#0d1117;color:#c9d1d9;}</style>
</head>
<body>
  <nav class="navbar navbar-expand-lg bg-dark border-bottom border-secondary fixed-top">
    <div class="container-fluid">
      <a class="navbar-brand" href="/">Dashboard</a>
    </div>
  </nav>
  <div class="container mt-5 pt-5">
    <h1 class="mb-4">Reportes</h1>

    <div class="card shadow mt-4">
      <div class="card-header">Ingresos por Mes</div>
      <div class="card-body">
        <table class="table table-dark table-hover">
          <thead><tr><th>Mes</th><th>Total</th></tr></thead>
          <tbody>${incomeByMonth.map(i => html`
            <tr>
              <td>${i.mes}</td>
              <td>$${Number(i.total ?? 0).toFixed(2)}</td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    </div>

    <div class="card shadow mt-4">
      <div class="card-header">Ocupación de Botes</div>
      <div class="card-body">
        <table class="table table-dark table-hover">
          <thead><tr><th>Bote</th><th>Número de Reservas</th></tr></thead>
          <tbody>${boatOccupancy.map(o => html`
            <tr>
              <td>${o.name}</td>
              <td>${o.reservas}</td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>
  `}

# // ── Mantenimiento ──────────────────────────────────────────────────────────
app.get('/maintenance', auth, async (c) => {
  const maintenances = await c.env.DB.prepare('SELECT * FROM maintenances ORDER BY date DESC').all().then(r => r.results || [])

  return c.html(html`
<!doctype html>
<html data-bs-theme="dark" lang="es">
<head>
  <meta charset="utf-8">
  <title>Mantenimiento</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>body{background:#0d1117;color:#c9d1d9;}</style>
</head>
<body>
  <nav class="navbar navbar-expand-lg bg-dark border-bottom border-secondary fixed-top">
    <div class="container-fluid">
      <a class="navbar-brand" href="/">Dashboard</a>
    </div>
  </nav>
  <div class="container mt-5 pt-5">
    <h1 class="mb-4">Gestión de Mantenimiento</h1>
    <div class="card shadow mt-4">
      <div class="card-body">
        <table class="table table-dark table-hover">
          <thead><tr><th>ID</th><th>Bote ID</th><th>Descripción</th><th>Fecha</th><th>Completado</th></tr></thead>
          <tbody>${maintenances.map(m => html`
            <tr>
              <td>${m.id}</td>
              <td>${m.boat_id}</td>
              <td>${m.description}</td>
              <td>${m.date}</td>
              <td>${m.completed ? 'Sí' : 'No'}</td>
            </tr>
          `)}</tbody>
        </table>
      </div>
    </div>

    <div class="card shadow mt-5">
      <div class="card-body">
        <h3>Registrar Mantenimiento</h3>
        <form action="/api/maintenance" method="post">
          <div class="mb-3">
            <input name="boat_id" type="number" class="form-control bg-dark text-white border-secondary" placeholder="ID Bote" required>
          </div>
          <div class="mb-3">
            <textarea name="description" class="form-control bg-dark text-white border-secondary" placeholder="Descripción del mantenimiento" rows="3" required></textarea>
          </div>
          <div class="form-check mb-3">
            <input name="completed" type="checkbox" class="form-check-input" id="completed">
            <label class="form-check-label" for="completed">Completado</label>
          </div>
          <button type="submit" class="btn btn-primary">Registrar</button>
        </form>
      </div>
    </div>
  </div>
</body>
</html>
  `}

app.post('/api/maintenance', auth, zValidator('form', z.object({
  boat_id: z.coerce.number().int().positive(),
  description: z.string().min(1),
  completed: z.coerce.boolean().optional()
})), async (c) => {
  const { boat_id, description, completed } = c.req.valid('form')
  await c.env.DB.prepare('INSERT INTO maintenances (boat_id, description, completed) VALUES (?, ?, ?)').bind(boat_id, description, completed ? 1 : 0).run()
  return c.redirect('/maintenance')
})

export default app