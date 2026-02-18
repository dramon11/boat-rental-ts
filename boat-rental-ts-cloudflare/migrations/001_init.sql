-- 001_init.sql (copia este contenido al archivo que genera wrangler)
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
  type TEXT NOT NULL,
  capacity INTEGER,
  available INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  boat_id INTEGER,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT DEFAULT 'Pendiente'
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER,
  amount REAL NOT NULL,
  paid INTEGER DEFAULT 0,
  date TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER,
  amount REAL NOT NULL,
  method TEXT,
  date TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS maintenances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boat_id INTEGER,
  description TEXT NOT NULL,
  date TEXT DEFAULT (datetime('now')),
  completed INTEGER DEFAULT 0
);

-- Admin inicial (cambia password en producción con hashing)
INSERT OR IGNORE INTO users (username, password_hash) VALUES ('admin', 'admin');
