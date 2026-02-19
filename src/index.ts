import { Hono } from 'hono'
import { html } from 'hono/html'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

/* ================================
   BASE LAYOUT PROFESIONAL
================================ */

const layout = (title: string, content: any) => html`
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>

  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">

  <style>
    body {
      background: linear-gradient(135deg,#0f172a,#0d1117);
      color: #e2e8f0;
      font-family: system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
    }

    .card-modern {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,.4);
      transition: all .3s ease;
    }

    .card-modern:hover {
      transform: translateY(-4px);
    }

    .navbar-modern {
      background: rgba(15,23,42,.9);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid #334155;
    }

    .btn-primary {
      background: linear-gradient(135deg,#3b82f6,#6366f1);
      border: none;
    }

    .btn-primary:hover {
      opacity: .9;
    }
  </style>
</head>

<body>
  ${content}
</body>
</html>
`

/* ================================
   AUTH MIDDLEWARE
================================ */

const auth = async (c: any, next: () => Promise<void>) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer '))
    return c.redirect('/login')

  const token = authHeader.split(' ')[1]

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    c.set('userId', payload.userId)
    await next()
  } catch {
    return c.redirect('/login')
  }
}

/* ================================
   LOGIN PAGE
================================ */

app.get('/login', (c) => {
  return c.html(layout('Login',
    html`
    <div class="d-flex align-items-center min-vh-100">
      <div class="container">
        <div class="row justify-content-center">
          <div class="col-md-4">
            <div class="card-modern p-5">
              <h3 class="text-center mb-4">🔐 Iniciar Sesión</h3>

              <form action="/api/login" method="POST">
                <div class="mb-3">
                  <input name="username"
                    class="form-control bg-dark text-white border-secondary"
                    placeholder="Usuario"
                    required>
                </div>

                <div class="mb-4">
                  <input name="password"
                    type="password"
                    class="form-control bg-dark text-white border-secondary"
                    placeholder="Contraseña"
                    required>
                </div>

                <button class="btn btn-primary w-100 py-2">
                  Entrar
                </button>
              </form>

              <div class="text-center mt-3 small text-secondary">
                Sistema de Gestión de Alquiler
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `))
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
    const { username, password } = c.req.valid()

    const user = await c.env.DB.prepare(
      'SELECT id, password_hash FROM users WHERE username = ?'
    )
      .bind(username)
      .first<{ id: number; password_hash: string }>()

    if (!user || password !== user.password_hash)
      return c.html(layout('Error',
        html`
          <div class="container mt-5">
            <div class="alert alert-danger text-center">
              Credenciales inválidas
            </div>
            <div class="text-center">
              <a href="/login" class="btn btn-outline-light">Volver</a>
            </div>
          </div>
        `
      ), 401)

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

  return c.html(layout('Dashboard',
    html`
    <nav class="navbar navbar-modern navbar-expand-lg p-3">
      <div class="container-fluid">
        <span class="navbar-brand text-white fw-bold">
          🚤 Alquiler Botes & Jetskis
        </span>
        <a href="/login" class="btn btn-outline-light btn-sm">
          Cerrar sesión
        </a>
      </div>
    </nav>

    <div class="container mt-5 pt-4">

      <h2 class="mb-5 text-center fw-bold">
        Panel de Control
      </h2>

      <div class="row g-4">

        <div class="col-md-4">
          <div class="card-modern p-4 text-center">
            <h6 class="text-secondary">Reservas Totales</h6>
            <h1 class="fw-bold">${reservations?.count ?? 0}</h1>
          </div>
        </div>

        <div class="col-md-4">
          <div class="card-modern p-4 text-center">
            <h6 class="text-secondary">Ingresos Pagados</h6>
            <h1 class="fw-bold">
              $${Number(income?.total ?? 0).toFixed(2)}
            </h1>
          </div>
        </div>

        <div class="col-md-4">
          <div class="card-modern p-4 text-center">
            <h6 class="text-secondary">Botes Disponibles</h6>
            <h1 class="fw-bold">${availableBoats?.count ?? 0}</h1>
          </div>
        </div>

      </div>
    </div>
  `))
})

export default app
