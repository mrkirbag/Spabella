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
    monto_bs_raw REAL NOT NULL DEFAULT 0,
    tasa_bs REAL NOT NULL DEFAULT 0,
    monto_cop REAL NOT NULL DEFAULT 0,
    monto_cop_raw REAL NOT NULL DEFAULT 0,
    tasa_cop REAL NOT NULL DEFAULT 0,
    metodo_pago_usd TEXT NOT NULL DEFAULT '',
    metodo_pago_bs TEXT NOT NULL DEFAULT '',
    metodo_pago_cop TEXT NOT NULL DEFAULT '',
    empleado_id INTEGER NOT NULL,
    servicio_id INTEGER NOT NULL,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id),
    FOREIGN KEY (servicio_id) REFERENCES servicios(id)
);
CREATE TABLE IF NOT EXISTS venta_pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL,
    moneda TEXT NOT NULL,
    monto REAL NOT NULL,
    monto_usd REAL NOT NULL,
    metodo_pago TEXT NOT NULL DEFAULT '',
    tasa REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (venta_id) REFERENCES ventas(id)
);
CREATE TABLE IF NOT EXISTS tasas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    value REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS vales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    empleado_id INTEGER NOT NULL,
    moneda TEXT NOT NULL,
    monto REAL NOT NULL,
    metodo_pago TEXT NOT NULL DEFAULT '',
    nota TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (empleado_id) REFERENCES empleados(id)
);

CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_venta_pagos_venta_id ON venta_pagos(venta_id);
CREATE INDEX IF NOT EXISTS idx_vales_fecha ON vales(fecha);
CREATE INDEX IF NOT EXISTS idx_vales_empleado ON vales(empleado_id);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON reservas(fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_cliente ON reservas(id_cliente);
CREATE INDEX IF NOT EXISTS idx_paquetes_cliente ON paquetes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_paquete ON sesiones(paquete_id, numero_sesion);