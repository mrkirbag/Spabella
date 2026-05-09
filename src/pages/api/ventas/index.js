import { createClient } from "@libsql/client";

const ensureTasasTable = async (db) => {
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
};

const ensureVentasColumns = async (db) => {
    const columns = await db.execute("PRAGMA table_info(ventas)");
    const columnNames = new Set((columns.rows || []).map((row) => String(row.name).toLowerCase()));

    if (!columnNames.has("monto_usd")) {
        await db.execute("ALTER TABLE ventas ADD COLUMN monto_usd REAL NOT NULL DEFAULT 0");
    }

    if (!columnNames.has("monto_bs")) {
        await db.execute("ALTER TABLE ventas ADD COLUMN monto_bs REAL NOT NULL DEFAULT 0");
    }

    // Registros historicos sin desglose: se asumen como cobrados en USD.
    await db.execute(`
        UPDATE ventas
        SET monto_usd = monto,
            monto_bs = 0
        WHERE COALESCE(monto_usd, 0) = 0
          AND COALESCE(monto_bs, 0) = 0
          AND COALESCE(monto, 0) > 0
    `);
};

export async function POST({ request }) {
    try {

        const { fecha, descripcion, montoTotalUsd, montoUsd, montoBs, empleadoId, servicioId } = await request.json();

        const db = createClient({   url: import.meta.env.DATABASE_URL,
                                    authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                                });

        await ensureTasasTable(db);
        await ensureVentasColumns(db);

        const montoTotalUsdValor = Number(montoTotalUsd ?? 0);
        const montoUsdValor = Number(montoUsd ?? 0);
        const montoBsValor = Number(montoBs ?? 0); // Monto ingresado en bolivares

        if (!fecha || !empleadoId || !servicioId) {
            return new Response(JSON.stringify({ error: "Los campos no pueden estar vacios." }), { status: 400 });
        }

        if (!Number.isFinite(montoTotalUsdValor) || montoTotalUsdValor <= 0 || !Number.isFinite(montoUsdValor) || montoUsdValor < 0 || !Number.isFinite(montoBsValor) || montoBsValor < 0) {
            return new Response(JSON.stringify({ error: "Los montos deben ser numeros mayores o iguales a cero." }), { status: 400 });
        }

        if (montoUsdValor <= 0 && montoBsValor <= 0) {
            return new Response(JSON.stringify({ error: "Debes registrar un pago en dolares, bolivares o ambos." }), { status: 400 });
        }

        const tasaResponse = await db.execute(
            "SELECT value FROM tasas WHERE LOWER(nombre) = 'bs' LIMIT 1"
        );
        const tasaBs = Number(tasaResponse.rows?.[0]?.value ?? 0);

        if (montoBsValor > 0 && (!Number.isFinite(tasaBs) || tasaBs <= 0)) {
            return new Response(
                JSON.stringify({ error: "La tasa BS no esta configurada correctamente en la base de datos." }),
                { status: 400 }
            );
        }

        const montoBsUsd = montoBsValor > 0 ? (montoBsValor / tasaBs) : 0; // Equivalente en USD del pago en BS
        const montoCubiertoUsd = montoUsdValor + montoBsUsd;
        const totalRedondeado = Number(montoTotalUsdValor.toFixed(2));
        const cubiertoRedondeado = Number(montoCubiertoUsd.toFixed(2));

        if (cubiertoRedondeado !== totalRedondeado) {
            return new Response(
                JSON.stringify({ error: "La suma del pago en dolares y bolivares no coincide con el monto total en USD." }),
                { status: 400 }
            );
        }

        let descripcionFinal = String(descripcion || "").trim();

        if (!descripcionFinal) {
            const servicioResponse = await db.execute(
                "SELECT nombre FROM servicios WHERE id = ? LIMIT 1",
                [servicioId]
            );

            descripcionFinal = String(servicioResponse.rows?.[0]?.nombre ?? "").trim();
        }

        if (!descripcionFinal) {
            return new Response(JSON.stringify({ error: "No se pudo determinar la descripcion de la venta." }), { status: 400 });
        }

        await db.execute(
            "INSERT INTO ventas (fecha, descripcion, monto, monto_usd, monto_bs, empleado_id, servicio_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [fecha, descripcionFinal, montoTotalUsdValor, montoUsdValor, montoBsUsd, empleadoId, servicioId]
        );

        return new Response(
            JSON.stringify({
                message: "Venta agregada exitosamente",
                montoTotalUsd: montoTotalUsdValor,
                montoUsd: montoUsdValor,
                montoBs: montoBsUsd,
                montoBsOriginal: montoBsValor,
                tasaBs
            }),
            { status: 200 }
        );
    
    } catch (error) {
        console.error("Error agregando venta:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}

// RESET DE IDS
// DELETE FROM sqlite_sequence WHERE name='ventas';