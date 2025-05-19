import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function GET() {
    try {
        const db = await open({
            filename: './db/spabella.db', 
            driver: sqlite3.Database
        });

        const servicios = await db.all("SELECT * FROM servicios");

        // Si no hay registros, mostrar mensaje de error
        if (servicios.length === 0) {
            return new Response(JSON.stringify({ mensaje: "No hay servicios registrados." }), { status: 200 });
        }

        return new Response(JSON.stringify(servicios), { status: 200 });

    } catch (error) {
        console.error("Error obteniendo servicios:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}

export async function POST({ request }) {
    try {
        const { descripcion, porcentajeSpa, porcentajeEmpleado } = await request.json();

        const db = await open({
            filename: './db/spabella.db',
            driver: sqlite3.Database
        });

        await db.run("INSERT INTO servicios (nombre, porcentaje_spabella, porcentaje_empleado) VALUES (?, ?, ?)", [descripcion, porcentajeSpa, porcentajeEmpleado]);

        await db.close();

        return new Response(JSON.stringify({ message: "Servicio agregado exitosamente" }), { status: 200 });
    
    } catch (error) {
        console.error("Error agregando servicio:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}

// RESET DE IDS
// DELETE FROM sqlite_sequence WHERE name='servicios';
