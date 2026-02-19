import { Hono } from 'hono'
import { html } from 'hono/html'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
/*import { SignJWT, jwtVerify } from 'jose'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

/* ================================
   AUTH MIDDLEWARE (Workers Safe)
================================ */

const auth = async (c: any, next: () => Promise<void>) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.redirect('/login')
  }

  const token = authHeader.split(' ')[1]

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)

    const { payload } = await jwtVerify(token, secret)

    c.set('userId', payload.userId)
    await next()
  } catch (err) {
    return c.redirect('/login')
  }
}

/* ================================
   LOGIN PAGE
================================ */

app.get('/login', (c) => {
  return c.html(html`
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Login</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        body { background:#0d1117; color:#c9d1d9; }
        .card { background:#161b22; }
      </style>
    </head>
    <body class="d-flex align-items-center min-vh-100">
      <div class="container">
        <div class="row justify-content-center">
          <div class="col-md-4">
            <div class="card p-4 shadow">
              <h3 class="text-center mb-4">Iniciar Sesión</h3>
              <form action="/api/login" method="POST">
                <div class="mb-3">
                  <input name="username" class="form-control bg-dark text-white border-secondary" placeholder="Usuario" required>
                </div>
                <div class="mb-3">
                  <input name="password" type="password" class="form-control bg-dark text-white border-secondary" placeholder="Contraseña" required>
                </div>
                <button class="btn btn-primary w-100">Entrar</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `)
})

/* ================================
   LOGIN API
================================ */

app.post(
  '/api/login',
  zValidator(
    'form',
    z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    })
  ),
  async (c) => {
    const { username, password } = c.req.valid()

    const user = await c.env.DB.prepare(
      'SELECT id, password_hash FROM users WHERE username = ?'
    )
      .bind(username)
      .first<{ id: number; password_hash: string }>()

    if (!user || password !== user.password_hash) {
      return c.json({ error: 'Credenciales inválidas' }, 401)
    }

    const secret = new TextEncoder().encode(c.env.JWT_SECRET)

    const token = await new SignJWT({ userId: user.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(secret)

    return c.json({ token })
  }
)

/* ================================
   DASHBOARD
================================ */

app.get('/', auth, async (c) => {
  const [reservations, income, availableBoats] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM reservations')
      .first<{ count: number }>(),
    c.env.DB.prepare(
      'SELECT SUM(amount) as total FROM invoices WHERE paid = 1'
    ).first<{ total: number | null }>(),
    c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM boats WHERE available = 1'
    ).first<{ count: number }>(),
  ])

  return c.html(html`
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Dashboard</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        body { background:#0d1117; color:#c9d1d9; }
        .card { background:#161b22; border:none; }
      </style>
    </head>
    <body>
      <nav class="navbar navbar-dark bg-dark p-3">
        <div class="container-fluid">
          <span class="navbar-brand">Alquiler Botes & Jetskis</span>
          <a href="/login" class="btn btn-sm btn-outline-light">Cerrar sesión</a>
        </div>
      </nav>

      <div class="container mt-5">
        <div class="row g-4">
          <div class="col-md-4">
            <div class="card text-center p-4">
              <h5>Reservas</h5>
              <h1>${reservations?.count ?? 0}</h1>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card text-center p-4">
              <h5>Ingresos</h5>
              <h1>$${Number(income?.total ?? 0).toFixed(2)}</h1>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card text-center p-4">
              <h5>Botes Disponibles</h5>
              <h1>${availableBoats?.count ?? 0}</h1>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `)
})

export default app
