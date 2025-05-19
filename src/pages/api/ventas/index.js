import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function POST({ request }) {
    try {

        const { fecha, descripcion, monto, empleadoId, servicioId } = await request.json();

        const db = await open({
            filename: './db/spabella.db',
            driver: sqlite3.Database
        });

        await db.run("INSERT INTO ventas (fecha, descripcion, monto, empleado_id, servicio_id) VALUES (?, ?, ?, ?, ?)", [fecha, descripcion, monto, empleadoId, servicioId]);

        await db.close();

        return new Response(JSON.stringify({ message: "Venta agregado exitosamente" }), { status: 200 });
    
    } catch (error) {
        console.error("Error agregando venta:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}

// RESET DE IDS
// DELETE FROM sqlite_sequence WHERE name='ventas';