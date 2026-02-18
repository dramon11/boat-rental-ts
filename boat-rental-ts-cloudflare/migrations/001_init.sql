-- migrations/001_init.sql
-- Ejecuta: wrangler d1 migrations create init
-- Luego copia este archivo y: wrangler d1 migrations apply boat_rental_db

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT
);

CREATE TABLE IF NOT EXISTS boats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'Bote' o 'Jetski'
    capacity INTEGER,
    available INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    boat_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT DEFAULT 'Pendiente'
);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    paid INTEGER DEFAULT 0,
    date TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cash_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT,
    date TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS maintenances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    boat_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    date TEXT DEFAULT (datetime('now')),
    completed INTEGER DEFAULT 0
);

-- Admin inicial (usa un hash real con bcrypt en prod)
INSERT OR IGNORE INTO users (username, password_hash) VALUES ('admin', 'hash-de-password-aqui');
