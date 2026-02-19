import { Hono } from 'hono'
import { html } from 'hono/html'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

/* =================================
   AUTH MIDDLEWARE
================================= */

const auth = async (c: any, next: () => Promise<void>) => {
  const token = getCookie(c, 'auth_token')

  if (!token) return c.redirect('/login')

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    await jwtVerify(token, secret)
    await next()
  } catch {
    deleteCookie(c, 'auth_token')
    return c.redirect('/login')
  }
}

/* =================================
   LOGIN PAGE
================================= */

app.get('/login', (c) => {
  const error = c.req.query('error')

  return c.html(html`
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Login</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        body {
          background: linear-gradient(135deg,#0f172a,#111827);
        }
        .card {
          background:#1e293b;
          border-radius:16px;
          border:none;
        }
      </style>
    </head>

    <body class="d-flex align-items-center min-vh-100">
      <div class="container">
        <div class="row justify-content-center">
          <div class="col-md-4">
            <div class="card p-5 shadow-lg">

              <h3 class="text-center mb-4 fw-bold text-white">
                🔐 Iniciar Sesión
              </h3>

              <form action="/api/login" method="POST">

                <input name="username"
                  class="form-control mb-3 bg-dark text-white border-secondary"
                  placeholder="Usuario"
                  required>

                <input name="password"
                  type="password"
                  class="form-control mb-3 bg-dark text-white border-secondary"
                  placeholder="Contraseña"
                  required>

                <button class="btn btn-primary w-100 fw-bold mb-3">
                  Entrar
                </button>

                ${
                  error
                    ? html`<div class="alert alert-danger text-center p-2">${error}</div>`
                    : ''
                }

              </form>

            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `)
})

/* =================================
   LOGIN API
================================= */

app.post(
  '/api/login',
  zValidator('form',
    z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    })
  ),
  async (c) => {

    const { username, password } = c.req.valid('form')

    const user = await c.env.DB.prepare(
      'SELECT id, password_hash FROM users WHERE username = ?'
    )
      .bind(username)
      .first<{ id: number; password_hash: string }>()

    if (!user) {
      return c.redirect('/login?error=Usuario no encontrado')
    }

    // Comparación directa (para que funcione ahora mismo)
    if (password !== user.password_hash) {
      return c.redirect('/login?error=Contraseña incorrecta')
    }

    const secret = new TextEncoder().encode(c.env.JWT_SECRET)

    const token = await new SignJWT({ userId: user.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(secret)

    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: false, // ⚠️ poner true en producción
      sameSite: 'Strict',
      path: '/',
      maxAge: 60 * 60 * 24
    })

    return c.redirect('/')
  }
)

/* =================================
   LOGOUT
================================= */

app.get('/logout', (c) => {
  deleteCookie(c, 'auth_token')
  return c.redirect('/login')
})

/* =================================
   DASHBOARD
================================= */

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
      <title>Dashboard</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        body {
          background: linear-gradient(135deg,#0f172a,#111827);
          color:white;
        }
        .card {
          background:#1e293b;
          border-radius:16px;
          border:none;
        }
      </style>
    </head>
    <body>

      <nav class="navbar navbar-dark bg-dark p-3">
        <div class="container-fluid">
          <span class="navbar-brand text-white fw-bold">
            🚤 Alquiler Botes & Jetskis
          </span>
          <a href="/logout" class="btn btn-outline-light btn-sm">
            Cerrar sesión
          </a>
        </div>
      </nav>

      <div class="container mt-5">
        <div class="row g-4">

          <div class="col-md-4">
            <div class="card p-4 text-center">
              <h6>Reservas Totales</h6>
              <h1>${reservations?.count ?? 0}</h1>
            </div>
          </div>

          <div class="col-md-4">
            <div class="card p-4 text-center">
              <h6>Ingresos</h6>
              <h1>$${Number(income?.total ?? 0).toFixed(2)}</h1>
            </div>
          </div>

          <div class="col-md-4">
            <div class="card p-4 text-center">
              <h6>Botes Disponibles</h6>
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
