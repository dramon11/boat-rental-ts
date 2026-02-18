// src/index.ts - Sistema completo con Hono + D1 + tema oscuro

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

// Auth middleware
const auth = async (c: any, next: any) => {
  const token = c.req.header('Authorization')?.split(' ')[1]
  if (!token) return c.html(html`<h1>401 - Inicia sesión</h1>`, 401)
  try {
    const payload = verify(token, c.env.JWT_SECRET) as { userId: number }
    c.set('userId', payload.userId)
    await next()
  } catch {
    return c.html(html`<h1>401 - Token inválido</h1>`, 401)
  }
}

// Login page
app.get('/login', c => c.html(html`
<!doctype html>
<html data-bs-theme="dark" lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>body{background:#0d1117;color:#c9d1d9;}</style>
</head>
<body class="d-flex align-items-center min-vh-100 bg-dark">
  <div class="container">
    <div class="row justify-content-center">
      <div class="col-md-4">
        <div class="card bg-gradient shadow-lg border-0">
          <div class="card-body p-5">
            <h2 class="text-center mb-4">Sistema Alquiler</h2>
            <form action="/api/login" method="post">
              <input name="username" class="form-control bg-dark text-white mb-3" placeholder="Usuario" required autofocus>
              <input name="password" type="password" class="form-control bg-dark text-white mb-3" placeholder="Contraseña" required>
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

// API Login (placeholder)
app.post('/api/login', zValidator('form', z.object({ username: z.string(), password: z.string() })), async c => {
  const { username, password } = c.req.valid('form')
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first()
  if (!user || password !== user.password_hash) {
    return c.json({ error: 'Credenciales inválidas' }, 401)
  }
  const token = sign({ userId: user.id }, c.env.JWT_SECRET, { expiresIn: '24h' })
  return c.json({ token })
})

// Dashboard protegido
app.get('/', auth, async c => {
  const [resCount, income, availBoats] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as c FROM reservations').first('c'),
    c.env.DB.prepare('SELECT SUM(amount) as s FROM invoices WHERE paid=1').first('s'),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM boats WHERE available=1').first('c')
  ])

  return c.html(html`
<!doctype html>
<html data-bs-theme="dark">
<head>
  <meta charset="utf-8">
  <title>Dashboard</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>body{background:#0d1117; color:#c9d1d9;}</style>
</head>
<body>
  <nav class="navbar navbar-expand-lg bg-dark border-bottom border-secondary">
    <div class="container">
      <a class="navbar-brand" href="/">Alquiler Botes</a>
      <div class="navbar-nav ms-auto">
        <a class="nav-link" href="/clients">Clientes</a>
        <a class="nav-link" href="/boats">Botes</a>
        <a class="nav-link" href="/reservations">Reservas</a>
        <a class="nav-link" href="/invoices">Facturas</a>
        <a class="nav-link" href="/reports">Reportes</a>
      </div>
    </div>
  </nav>
  <div class="container mt-5">
    <h1 class="mb-4">Dashboard</h1>
    <div class="row g-4">
      <div class="col-md-4"><div class="card bg-gradient shadow"><div class="card-body text-center"><h5>Reservas</h5><p class="fs-1">${resCount ?? 0}</p></div></div></div>
      <div class="col-md-4"><div class="card bg-gradient shadow"><div class="card-body text-center"><h5>Ingresos</h5><p class="fs-1">$${Number(income ?? 0).toFixed(2)}</p></div></div></div>
      <div class="col-md-4"><div class="card bg-gradient shadow"><div class="card-body text-center"><h5>Botes Disponibles</h5><p class="fs-1">${availBoats ?? 0}</p></div></div></div>
    </div>
  </div>
</body>
</html>
  `)
})

// Ejemplo: Clientes
app.get('/clients', auth, async c => {
  const clients = await c.env.DB.prepare('SELECT * FROM clients').all().then(r => r.results)
  return c.html(html`... (similar al ejemplo anterior, con tabla y form para agregar)`)
})

// Agrega las demás rutas de la misma forma para boats, reservations, etc.

export default app
