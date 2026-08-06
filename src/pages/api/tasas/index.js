import { createClient } from "@libsql/client";
import { ensureTasasTable, getTasas } from "../../../lib/ventas-schema.js";

const getDb = () =>
    createClient({
        url: import.meta.env.DATABASE_URL,
        authToken: import.meta.env.DATABASE_AUTH_TOKEN,
    });

export async function GET() {
    try {
        const db = getDb();
        const tasas = await getTasas(db);

        return new Response(
            JSON.stringify({
                tasas,
                tasaBs: tasas.bs,
                tasaCop: tasas.cop,
                // compatibilidad con UI anterior
                tasa: { nombre: "bs", value: tasas.bs },
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error obteniendo tasas:", error);
        return new Response(
            JSON.stringify({ error: "Error interno del servidor" }),
            { status: 500 }
        );
    }
}

export async function PUT({ request }) {
    try {
        const body = await request.json();
        const db = getDb();
        await ensureTasasTable(db);

        // Nuevo formato: { bs, cop } o individual { moneda, value }
        let bs = body.bs ?? body.tasaBs;
        let cop = body.cop ?? body.tasaCop;

        if (body.moneda && body.value !== undefined) {
            const moneda = String(body.moneda).toLowerCase();
            if (moneda === "bs") bs = body.value;
            if (moneda === "cop") cop = body.value;
        }

        // Compatibilidad: solo { value } actualiza BS
        if (bs === undefined && cop === undefined && body.value !== undefined) {
            bs = body.value;
        }

        const updates = [];

        if (bs !== undefined) {
            const tasaBs = Number(bs);
            if (!Number.isFinite(tasaBs) || tasaBs <= 0) {
                return new Response(
                    JSON.stringify({
                        error: "La tasa BS debe ser un numero mayor a cero.",
                    }),
                    { status: 400 }
                );
            }
            await db.execute(
                "UPDATE tasas SET value = ? WHERE LOWER(nombre) = 'bs'",
                [tasaBs]
            );
            updates.push({ moneda: "bs", value: tasaBs });
        }

        if (cop !== undefined) {
            const tasaCop = Number(cop);
            if (!Number.isFinite(tasaCop) || tasaCop <= 0) {
                return new Response(
                    JSON.stringify({
                        error: "La tasa COP debe ser un numero mayor a cero.",
                    }),
                    { status: 400 }
                );
            }
            await db.execute(
                "UPDATE tasas SET value = ? WHERE LOWER(nombre) = 'cop'",
                [tasaCop]
            );
            updates.push({ moneda: "cop", value: tasaCop });
        }

        if (!updates.length) {
            return new Response(
                JSON.stringify({ error: "No se enviaron tasas para actualizar." }),
                { status: 400 }
            );
        }

        const tasas = await getTasas(db);

        return new Response(
            JSON.stringify({
                message: "Tasas actualizadas exitosamente.",
                tasas,
                updates,
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error actualizando tasas:", error);
        return new Response(
            JSON.stringify({ error: "Error interno del servidor" }),
            { status: 500 }
        );
    }
}
