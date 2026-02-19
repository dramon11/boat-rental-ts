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

/* ===============================
   AUTH
================================ */

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

/* ===============================
   LOGIN PAGE (AJAX PROFESIONAL)
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
        border:none;
        border-radius:16px;
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

            <form id="loginForm">

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

              <div id="errorBox"></div>

            </form>

          </div>
        </div>
      </div>
    </div>

    <script>
      const form = document.getElementById('loginForm')
      const errorBox = document.getElementById('errorBox')

      form.addEventListener('submit', async (e) => {
        e.preventDefault()

        const formData = new FormData(form)

        const res = await fetch('/api/login', {
          method: 'POST',
          body: formData
        })

        if (res.ok) {
          window.location.href = '/'
        } else {
          const data = await res.json()

          errorBox.innerHTML = 
            '<div class="alert alert-danger text-center p-2">' + data.error + '</div>'

          setTimeout(() => {
            errorBox.innerHTML = ''
          }, 3000)
        }
      })
    </script>

  </body>
  </html>
  `)
})

/* ===============================
   LOGIN API
================================ */

app.post(
  '/api/login',
  zValidator('form',
    z.object({
      username: z.string(),
      password: z.string(),
    })
  ),
  async (c) => {

    const { username, password } = c.req.valid('form')

    const user = await c.env.DB.prepare(
      'SELECT id, password_hash FROM users WHERE username = ?'
    )
      .bind(username)
      .first<{ id: number; password_hash: string }>()

    if (!user || password !== user.password_hash) {
      return c.json({ error: 'Credenciales incorrectas' }, 401)
    }

    const secret = new TextEncoder().encode(c.env.JWT_SECRET)

    const token = await new SignJWT({ userId: user.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(secret)

    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
      path: '/',
      maxAge: 60 * 60 * 24
    })

    return c.json({ success: true })
  }
)

/* ===============================
   LAYOUT PROFESIONAL REUTILIZABLE
================================ */

function layout(title: string, content: any) {
  return html`
  <!doctype html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
      body {
        background:#0f172a;
        color:white;
      }
      .sidebar {
        width:240px;
        height:100vh;
        position:fixed;
        background:#111827;
        padding-top:20px;
      }
      .sidebar a {
        display:block;
        padding:12px 20px;
        color:#cbd5e1;
        text-decoration:none;
      }
      .sidebar a:hover {
        background:#1f2937;
        color:white;
      }
      .content {
        margin-left:240px;
        padding:30px;
      }
      .card {
        background:#1e293b;
        border:none;
        border-radius:14px;
      }
    </style>
  </head>
  <body>

    <div class="sidebar">
      <h5 class="text-center text-white mb-4">🚤 Admin</h5>
      <a href="/">Dashboard</a>
      <a href="#">Clientes</a>
      <a href="#">Reservas</a>
      <a href="#">Facturas</a>
      <a href="/logout">Cerrar sesión</a>
    </div>

    <div class="content">
      ${content}
    </div>

  </body>
  </html>
  `
}

/* ===============================
   DASHBOARD
================================ */

app.get('/', auth, async (c) => {

  const reservations = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM reservations'
  ).first<{ count: number }>()

  return c.html(layout("Dashboard", html`
    <h2 class="mb-4">Dashboard</h2>

    <div class="row">
      <div class="col-md-4">
        <div class="card p-4 text-center">
          <h6>Reservas Totales</h6>
          <h1>${reservations?.count ?? 0}</h1>
        </div>
      </div>
    </div>
  `))
})

/* ===============================
   LOGOUT
================================ */

app.get('/logout', (c) => {
  deleteCookie(c, 'auth_token')
  return c.redirect('/login')
})

export default app
