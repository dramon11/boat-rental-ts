# Sistema de Alquiler de Botes y Jetskis - Cloudflare Workers (TypeScript + Hono + D1)

Sistema profesional con dashboard y módulos en modo oscuro.

## Instalación
- npm install
- Configura wrangler.toml con IDs de D1 y KV.
- wrangler d1 migrations apply boat_rental_db
- wrangler dev (para testing local)
- wrangler deploy

## Features
- Auth con JWT.
- Dark theme profesional con Bootstrap.
- CRUD para todos los módulos.
- Extiende con JS para interacciones dinámicas si necesitas.
