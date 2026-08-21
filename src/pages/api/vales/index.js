import { createClient } from "@libsql/client";
import {
    METODOS_PAGO_POR_MONEDA,
    MONEDAS_PAGO,
    normalizarMetodoPago,
    normalizarMoneda,
} from "../../../lib/ventas-schema.js";

const dbClient = () =>
    createClient({
        url: import.meta.env.DATABASE_URL,
        authToken: import.meta.env.DATABASE_AUTH_TOKEN,
    });

export async function GET({ request }) {
    try {
        const url = new URL(request.url);
        const fecha = url.searchParams.get("fecha");
        const db = dbClient();

        if (!fecha) {
            return new Response(
                JSON.stringify({ error: "La fecha es obligatoria." }),
                { status: 400 }
            );
        }

        const vales = await db.execute(
            `
            SELECT
                v.id,
                v.fecha,
                v.empleado_id,
                e.nombre AS empleada,
                v.moneda,
                v.monto,
                v.metodo_pago,
                v.nota
            FROM vales v
            JOIN empleados e ON v.empleado_id = e.id
            WHERE v.fecha = ?
            ORDER BY v.id ASC
            `,
            [fecha]
        );

        if (!vales.rows || vales.rows.length === 0) {
            return new Response(
                JSON.stringify({ mensaje: "No hay vales para esa fecha.", vales: [] }),
                { status: 200 }
            );
        }

        return new Response(JSON.stringify({ vales: vales.rows }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error listando vales:", error);
        return new Response(
            JSON.stringify({ error: "Error interno del servidor" }),
            { status: 500 }
        );
    }
}

export async function POST({ request }) {
    try {
        const body = await request.json();
        const fecha = String(body.fecha || "").trim();
        const empleadoId = Number(body.empleadoId);
        const moneda = normalizarMoneda(body.moneda);
        const monto = Number(body.monto);
        const metodoPago = normalizarMetodoPago(body.metodoPago, moneda);
        const nota = String(body.nota || "").trim();

        if (!fecha || !empleadoId || !moneda || !Number.isFinite(monto) || monto <= 0) {
            return new Response(
                JSON.stringify({
                    error: "Fecha, empleada, moneda y monto son obligatorios.",
                }),
                { status: 400 }
            );
        }

        if (!MONEDAS_PAGO.includes(moneda)) {
            return new Response(
                JSON.stringify({ error: "Moneda no válida." }),
                { status: 400 }
            );
        }

        const metodos = METODOS_PAGO_POR_MONEDA[moneda] || [];
        if (metodos.length && !metodoPago) {
            return new Response(
                JSON.stringify({ error: "Selecciona el método de pago del vale." }),
                { status: 400 }
            );
        }

        const db = dbClient();

        const empleado = await db.execute(
            "SELECT id FROM empleados WHERE id = ? AND estado = 'activo'",
            [empleadoId]
        );
        if (!empleado.rows?.length) {
            return new Response(
                JSON.stringify({ error: "Empleada no encontrada." }),
                { status: 404 }
            );
        }

        const result = await db.execute(
            `
            INSERT INTO vales (fecha, empleado_id, moneda, monto, metodo_pago, nota)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [fecha, empleadoId, moneda, Number(monto.toFixed(2)), metodoPago, nota]
        );

        return new Response(
            JSON.stringify({
                message: "Vale registrado.",
                id: Number(result.lastInsertRowid),
            }),
            { status: 201 }
        );
    } catch (error) {
        console.error("Error creando vale:", error);
        return new Response(
            JSON.stringify({ error: "Error interno del servidor" }),
            { status: 500 }
        );
    }
}
