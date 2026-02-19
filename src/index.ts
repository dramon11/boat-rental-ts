import { Hono } from 'hono'
import { html } from 'hono/html'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

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
  } catch {
    deleteCookie(c, 'auth_token')
    return c.redirect('/login')
  }
}

/* ================================
   LOGIN PAGE
================================ */

app.get('/login', (c) => {

  const error = c.req.query('error')

  return c.html(html`
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Login</title>
<meta name="viewport" content="width=device-width, initial-scale=1">

<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">

<style>
body {
  background: linear-gradient(135deg,#0f172a,#111827);
  font-family: system-ui, -apple-system, sans-serif;
}

.login-card {
  background:#1e293b;
  border-radius:20px;
  padding:40px;
  box-shadow: 0 20px 50px rgba(0,0,0,.4);
  animation: fadeIn .6s ease;
}

@keyframes fadeIn {
  from {opacity:0; transform: translateY(10px);}
  to {opacity:1; transform: translateY(0);}
}

.form-control {
  background:#0f172a;
  border:1px solid #334155;
  color:white;
}

.form-control:focus {
  background:#0f172a;
  color:white;
  border-color:#3b82f6;
  box-shadow:none;
}

.btn-primary {
  background:#3b82f6;
  border:none;
}

.btn-primary:hover {
  background:#2563eb;
}

.error-box {
  margin-top:15px;
  padding:10px;
  border-radius:10px;
  background:#7f1d1d;
  color:#fecaca;
  font-size:14px;
  text-align:center;
  opacity:0;
  transition: opacity .5s ease;
}

.error-box.show {
  opacity:1;
}
</style>
</head>

<body class="d-flex align-items-center min-vh-100">

<div class="container">
  <div class="row justify-content-center">
    <div class="col-md-4">

      <div class="login-card">

        <h3 class="text-center mb-4 fw-bold text-white">
          🔐 Sistema Administrativo
        </h3>

        <form action="/api/login" method="POST">

          <input name="username"
            class="form-control mb-3"
            placeholder="Usuario"
            required>

          <input name="password"
            type="password"
            class="form-control mb-3"
            placeholder="Contraseña"
            required>

          <button class="btn btn-primary w-100">
            Iniciar Sesión
          </button>

        </form>

        ${error ? html`
          <div id="errorBox" class="error-box show">
            ${decodeURIComponent(error)}
          </div>
        ` : ''}

      </div>

    </div>
  </div>
</div>

<script>
const box = document.getElementById('errorBox')
if (box) {
  setTimeout(() => {
    box.classList.remove('show')
  }, 4000)
}
</script>

</body>
</html>
`)
})

/* ================================
   LOGIN API
================================ */

app.post('/api/login', async (c) => {

  const body = await c.req.parseBody()

  const username = body.username as string
  const password = body.password as string

  if (!username || !password) {
    return c.redirect('/login?error=' + encodeURIComponent('Debe completar todos los campos'))
  }

  const user = await c.env.DB.prepare(
    'SELECT id, password_hash FROM users WHERE username = ?'
  )
    .bind(username)
    .first<{ id: number; password_hash: string }>()

  if (!user) {
    return c.redirect('/login?error=' + encodeURIComponent('Usuario no encontrado'))
  }

  if (password !== user.password_hash) {
    return c.redirect('/login?error=' + encodeURIComponent('Contraseña incorrecta'))
  }

  const secret = new TextEncoder().encode(c.env.JWT_SECRET)

  const token = await new SignJWT({ userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secret)

  setCookie(c, 'auth_token', token, {
    httpOnly: true,
    secure: false, // en producción true
    sameSite: 'Strict',
    path: '/',
    maxAge: 60 * 60 * 24
  })

  return c.redirect('/')
})

/* ================================
   LOGOUT
================================ */

app.get('/logout', (c) => {
  deleteCookie(c, 'auth_token')
  return c.redirect('/login')
})

/* ================================
   DASHBOARD PROFESIONAL
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
<title>Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1">

<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">

<style>
body {
  background:#0f172a;
  color:white;
  font-family: system-ui, -apple-system, sans-serif;
}

.sidebar {
  width:220px;
  background:#111827;
  min-height:100vh;
  padding:20px;
  position:fixed;
}

.sidebar h5 {
  color:#3b82f6;
}

.sidebar a {
  display:block;
  color:#cbd5e1;
  padding:8px 0;
  text-decoration:none;
}

.sidebar a:hover {
  color:white;
}

.content {
  margin-left:240px;
  padding:40px;
}

.card {
  background:#1e293b;
  border-radius:16px;
  border:none;
  box-shadow:0 10px 30px rgba(0,0,0,.4);
}
</style>
</head>

<body>

<div class="sidebar">
  <h5>🚤 Sistema</h5>
  <hr>
  <a href="/">Dashboard</a>
  <a href="#">Reservas</a>
  <a href="#">Facturación</a>
  <a href="#">Inventario</a>
  <a href="/logout">Cerrar sesión</a>
</div>

<div class="content">

<h3 class="mb-4">Panel Principal</h3>

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
