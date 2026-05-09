CREATE TABLE IF NOT EXISTS empleados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    cargo TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'activo'
);
CREATE TABLE IF NOT EXISTS servicios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    porcentaje_spabella INTEGER NOT NULL,
    porcentaje_empleado INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'activo'
);
CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    monto REAL NOT NULL,
    monto_usd REAL NOT NULL DEFAULT 0,
    monto_bs REAL NOT NULL DEFAULT 0,
    empleado_id INTEGER NOT NULL,
    servicio_id INTEGER NOT NULL,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id),
    FOREIGN KEY (servicio_id) REFERENCES servicios(id)
);
CREATE TABLE IF NOT EXISTS tasas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    value REAL NOT NULL DEFAULT 0
);