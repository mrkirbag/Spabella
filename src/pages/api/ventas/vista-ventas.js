import sqlite3 from "sqlite3";
import { open } from "sqlite";

export async function GET({ request }) {
    const url = new URL(request.url);
    const fecha = url.searchParams.get("fecha");

    const db = await open({ filename: "./db/spabella.db", driver: sqlite3.Database });

    const ventas = await db.all(`
                SELECT v.id, v.fecha, s.nombre AS servicio, v.descripcion, e.nombre AS empleado, v.monto
                FROM ventas v
                JOIN empleados e ON v.empleado_id = e.id
                JOIN servicios s ON v.servicio_id = s.id
                WHERE v.fecha = ?
            `, [fecha]);

    // Si no hay registros, mostrar mensaje de error
    if (ventas.length === 0) {
        return new Response(JSON.stringify({ mensaje: "No hay registros en esta fecha seleccionada." }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    return new Response(JSON.stringify(ventas), {
        headers: { "Content-Type": "application/json" }
    });
}

// RESET DE IDS
// DELETE FROM sqlite_sequence WHERE name='ventas';