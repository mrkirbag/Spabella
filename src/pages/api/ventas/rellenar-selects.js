import sqlite3 from "sqlite3";
import { open } from "sqlite";

export async function GET() {
    const db = await open({ filename: "./db/spabella.db", driver: sqlite3.Database });

    const empleados = await db.all("SELECT id, nombre, cargo FROM empleados");
    const servicios = await db.all("SELECT id, nombre, porcentaje_spabella, porcentaje_empleado FROM servicios");

    await db.close();

    return new Response(JSON.stringify({ empleados, servicios }), {
        headers: { "Content-Type": "application/json" }
    });
}