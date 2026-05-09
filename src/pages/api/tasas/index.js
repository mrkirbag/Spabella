import { createClient } from "@libsql/client";

const TASA_NOMBRE = "bs";

const getDb = () => createClient({
    url: import.meta.env.DATABASE_URL,
    authToken: import.meta.env.DATABASE_AUTH_TOKEN
});

const ensureTasasTable = async (db) => {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS tasas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            value REAL NOT NULL DEFAULT 0
        )
    `);

    await db.execute(
        "INSERT OR IGNORE INTO tasas (nombre, value) VALUES (?, ?)",
        [TASA_NOMBRE, 0]
    );
};

export async function GET() {
    try {
        const db = getDb();
        await ensureTasasTable(db);

        const tasaResponse = await db.execute(
            "SELECT id, nombre, value FROM tasas WHERE LOWER(nombre) = ? LIMIT 1",
            [TASA_NOMBRE]
        );

        return new Response(JSON.stringify({ tasa: tasaResponse.rows?.[0] ?? null }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        console.error("Error obteniendo tasa:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}

export async function PUT({ request }) {
    try {
        const { value } = await request.json();
        const tasaValor = Number(value);

        if (!Number.isFinite(tasaValor) || tasaValor <= 0) {
            return new Response(JSON.stringify({ error: "La tasa debe ser un numero mayor a cero." }), { status: 400 });
        }

        const db = getDb();
        await ensureTasasTable(db);

        await db.execute(
            "UPDATE tasas SET value = ? WHERE LOWER(nombre) = ?",
            [tasaValor, TASA_NOMBRE]
        );

        return new Response(JSON.stringify({ message: "Tasa BS actualizada exitosamente.", value: tasaValor }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        console.error("Error actualizando tasa:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}
