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

/* ================================
   UTIL: HASH PASSWORD (SHA-256)
================================ */

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/* ================================
   AUTH MIDDLEWARE
================================ */

const auth = async (c: any, next: () => Promise<void>) => {

  const token = getCookie(c, 'auth_token')
  if (!token) return c.redirect('/login')

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    c.set('userId', payload.userId)
    await next()
  } catch (err) {
    deleteCookie(c, 'auth_token')
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
        h3, label {
          color:#ffffff !important;
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
                  class="form-control mb-4 bg-dark text-white border-secondary"
                  placeholder="Contraseña"
                  required>

                <button class="btn btn-primary w-100 fw-bold">
                  Entrar
                </button>

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
  zValidator('form',
    z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    })
  ),
  async (c) => {

    try {

      //const { username, password } = c.req.valid()
      const { username, password } = c.req.valid('form')

      const user = await c.env.DB.prepare(
        'SELECT id, password_hash FROM users WHERE username = ?'
      )
        .bind(username)
        .first<{ id: number; password_hash: string }>()

      if (!user) {
        return c.html('<h4 class="text-center text-white mt-5">Usuario no encontrado</h4>', 401)
      }

      const hashedPassword = await sha256(password)

      if (hashedPassword !== user.password_hash) {
        return c.html('<h4 class="text-center text-white mt-5">Contraseña incorrecta</h4>', hashedPassword,401)
      }

      const secret = new TextEncoder().encode(c.env.JWT_SECRET)

      const token = await new SignJWT({ userId: user.id })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('24h')
        .sign(secret)

      setCookie(c, 'auth_token', token, {
        httpOnly: true,
        secure: false, // 👉 en producción pon true
        sameSite: 'Strict',
        path: '/',
        maxAge: 60 * 60 * 24
      })

      return c.redirect('/')

    } catch (err) {
      return c.text('Internal Server Error: ' + err, 500)
    }
  }
)

/* ================================
   LOGOUT
================================ */

app.get('/logout', (c) => {
  deleteCookie(c, 'auth_token')
  return c.redirect('/login')
})

/* ================================
   DASHBOARD
================================ */

app.get('/', auth, async (c) => {

  try {

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

  } catch (err) {
    return c.text('Error cargando dashboard: ' + err, 500)
  }
})

export default app
