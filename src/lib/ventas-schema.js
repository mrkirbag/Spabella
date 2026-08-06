export const METODOS_PAGO_POR_MONEDA = {
    COP: ["Efectivo", "Bancolombia", "Nequi"],
    USD: ["Efectivo", "Zelle", "Binance"],
    BS: ["Pago móvil"],
};

export const MONEDAS_PAGO = ["USD", "COP", "BS"];

export const METODOS_PAGO = [
    ...new Set(Object.values(METODOS_PAGO_POR_MONEDA).flat()),
];

export const ensureTasasTable = async (db) => {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS tasas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            value REAL NOT NULL DEFAULT 0
        )
    `);

    await db.execute(
        "INSERT OR IGNORE INTO tasas (nombre, value) VALUES ('bs', 0)"
    );
    await db.execute(
        "INSERT OR IGNORE INTO tasas (nombre, value) VALUES ('cop', 0)"
    );
};

export const getTasas = async (db) => {
    await ensureTasasTable(db);
    const response = await db.execute(
        "SELECT LOWER(nombre) AS nombre, value FROM tasas WHERE LOWER(nombre) IN ('bs', 'cop')"
    );

    const tasas = { bs: 0, cop: 0 };
    (response.rows || []).forEach((row) => {
        const nombre = String(row.nombre || "").toLowerCase();
        if (nombre === "bs" || nombre === "cop") {
            tasas[nombre] = Number(row.value ?? 0);
        }
    });

    return tasas;
};

export const ensureVentasColumns = async (db) => {
    const columns = await db.execute("PRAGMA table_info(ventas)");
    const columnNames = new Set(
        (columns.rows || []).map((row) => String(row.name).toLowerCase())
    );

    const addColumn = async (name, ddl) => {
        if (!columnNames.has(name)) {
            await db.execute(`ALTER TABLE ventas ADD COLUMN ${ddl}`);
            columnNames.add(name);
        }
    };

    await addColumn("monto_usd", "monto_usd REAL NOT NULL DEFAULT 0");
    await addColumn("monto_bs", "monto_bs REAL NOT NULL DEFAULT 0");
    await addColumn("cliente_id", "cliente_id INTEGER");
    await addColumn("metodo_pago_usd", "metodo_pago_usd TEXT NOT NULL DEFAULT ''");
    await addColumn("metodo_pago_bs", "metodo_pago_bs TEXT NOT NULL DEFAULT ''");
    await addColumn("monto_bs_raw", "monto_bs_raw REAL NOT NULL DEFAULT 0");
    await addColumn("tasa_bs", "tasa_bs REAL NOT NULL DEFAULT 0");
    await addColumn("monto_cop", "monto_cop REAL NOT NULL DEFAULT 0");
    await addColumn("monto_cop_raw", "monto_cop_raw REAL NOT NULL DEFAULT 0");
    await addColumn("tasa_cop", "tasa_cop REAL NOT NULL DEFAULT 0");
    await addColumn("metodo_pago_cop", "metodo_pago_cop TEXT NOT NULL DEFAULT ''");

    await db.execute(`
        UPDATE ventas
        SET monto_usd = monto,
            monto_bs = 0
        WHERE COALESCE(monto_usd, 0) = 0
          AND COALESCE(monto_bs, 0) = 0
          AND COALESCE(monto_cop, 0) = 0
          AND COALESCE(monto, 0) > 0
    `);
};

export const ensureVentaPagosTable = async (db) => {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS venta_pagos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venta_id INTEGER NOT NULL,
            moneda TEXT NOT NULL,
            monto REAL NOT NULL,
            monto_usd REAL NOT NULL,
            metodo_pago TEXT NOT NULL DEFAULT '',
            tasa REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (venta_id) REFERENCES ventas(id)
        )
    `);
};

export const ensureValesTable = async (db) => {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS vales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT NOT NULL,
            empleado_id INTEGER NOT NULL,
            moneda TEXT NOT NULL,
            monto REAL NOT NULL,
            metodo_pago TEXT NOT NULL DEFAULT '',
            nota TEXT NOT NULL DEFAULT '',
            FOREIGN KEY (empleado_id) REFERENCES empleados(id)
        )
    `);
};

export const normalizarMetodoPago = (valor, moneda = "") => {
    const metodo = String(valor || "").trim();
    if (!metodo) return "";

    const monedaNormalizada = normalizarMoneda(moneda);
    const opciones = monedaNormalizada
        ? METODOS_PAGO_POR_MONEDA[monedaNormalizada] || []
        : METODOS_PAGO;

    const encontrado = opciones.find(
        (opcion) => opcion.toLowerCase() === metodo.toLowerCase()
    );
    return encontrado || "";
};

export const normalizarMoneda = (valor) => {
    const moneda = String(valor || "").trim().toUpperCase();
    return MONEDAS_PAGO.includes(moneda) ? moneda : "";
};

export const aUsd = (moneda, monto, tasas) => {
    const valor = Number(monto ?? 0);
    if (!Number.isFinite(valor) || valor <= 0) return 0;

    if (moneda === "USD") return valor;
    if (moneda === "BS") {
        const tasa = Number(tasas.bs ?? 0);
        return tasa > 0 ? valor / tasa : NaN;
    }
    if (moneda === "COP") {
        const tasa = Number(tasas.cop ?? 0);
        return tasa > 0 ? valor / tasa : NaN;
    }
    return NaN;
};
