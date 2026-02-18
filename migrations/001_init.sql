-- 0001_init.sql

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
  type TEXT NOT NULL CHECK(type IN ('Bote', 'Jetski')),
  capacity INTEGER NOT NULL,
  available INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  boat_id INTEGER NOT NULL,
  start_date TEXT NOT NULL,   -- formato ISO: '2026-02-20 14:00'
  end_date TEXT NOT NULL,
  status TEXT DEFAULT 'Pendiente' CHECK(status IN ('Pendiente', 'Confirmada', 'Cancelada', 'Completada')),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (boat_id) REFERENCES boats(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount >= 0),
  paid INTEGER DEFAULT 0,
  date TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount >= 0),
  method TEXT CHECK(method IN ('Efectivo', 'Tarjeta', 'Transferencia', 'Otro')),
  date TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE TABLE IF NOT EXISTS maintenances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boat_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  date TEXT DEFAULT (datetime('now')),
  completed INTEGER DEFAULT 0,
  FOREIGN KEY (boat_id) REFERENCES boats(id)
);

-- Usuario admin inicial (cambia la contraseña después del primer login)
INSERT OR IGNORE INTO users (username, password_hash) VALUES ('admin', 'admin123');