import { createClient } from "@libsql/client";

const ADMIN_KEY_NAME = "ventas_admin_delete_key";
const DEFAULT_ADMIN_KEY = "clavesecreta";

const getDb = () =>
    createClient({
        url: import.meta.env.DATABASE_URL,
        authToken: import.meta.env.DATABASE_AUTH_TOKEN,
    });

const ensureAdminKey = async (db) => {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    `);

    const existing = await db.execute(
        "SELECT value FROM app_settings WHERE key = ? LIMIT 1",
        [ADMIN_KEY_NAME]
    );

    if (!existing.rows || existing.rows.length === 0) {
        await db.execute(
            "INSERT INTO app_settings (key, value) VALUES (?, ?)",
            [ADMIN_KEY_NAME, DEFAULT_ADMIN_KEY]
        );
        return DEFAULT_ADMIN_KEY;
    }

    return String(existing.rows[0].value ?? DEFAULT_ADMIN_KEY);
};

export async function DELETE({ request }) {
    try {
        const { id, claveAdmin } = await request.json();

        if (!id || !claveAdmin) {
            return new Response(
                JSON.stringify({ error: "Id y clave admin son obligatorios." }),
                { status: 400 }
            );
        }

        const db = getDb();
        const currentKey = await ensureAdminKey(db);

        if (String(claveAdmin) !== currentKey) {
            return new Response(
                JSON.stringify({ error: "Clave admin incorrecta." }),
                { status: 401 }
            );
        }

        await db.execute("DELETE FROM venta_pagos WHERE venta_id = ?", [id]);

        const result = await db.execute("DELETE FROM ventas WHERE id = ?", [id]);

        if (!result.rowsAffected) {
            return new Response(
                JSON.stringify({ error: "La venta no existe." }),
                { status: 404 }
            );
        }

        return new Response(
            JSON.stringify({ message: "Venta eliminada exitosamente." }),
            { status: 200 }
        );
    } catch (error) {
        console.error("Error eliminando venta:", error);
        return new Response(
            JSON.stringify({ error: "Error interno del servidor" }),
            { status: 500 }
        );
    }
}
