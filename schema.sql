-- Usuarios y roles
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  rol TEXT CHECK(rol IN ('administrador', 'cajero', 'compras')) NOT NULL,
  activo INTEGER DEFAULT 1
);

-- Productos con código de barras
CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_barras TEXT UNIQUE NOT NULL,
  descripcion TEXT NOT NULL,
  costo REAL DEFAULT 0,
  stock_actual INTEGER DEFAULT 0
);

-- Control de caja
CREATE TABLE IF NOT EXISTS control_caja (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuarios(id),
  monto_apertura REAL NOT NULL,
  monto_cierre REAL,
  fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_cierre DATETIME,
  estado TEXT CHECK(estado IN ('abierta', 'cerrada')) DEFAULT 'abierta'
);

-- Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuarios(id),
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  estado TEXT DEFAULT 'pendiente'
);

CREATE TABLE IF NOT EXISTS detalle_pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER REFERENCES pedidos(id),
  producto_id INTEGER REFERENCES productos(id),
  cantidad INTEGER NOT NULL
);