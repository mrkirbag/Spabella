import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function GET() {
    try {
        const db = await open({
            filename: './db/spabella.db', 
            driver: sqlite3.Database
        });

        const empleados = await db.all("SELECT * FROM empleados");

        // Si no hay registros, mostrar mensaje de error
        if (empleados.length === 0) {
            return new Response(JSON.stringify({ mensaje: "No hay empleados registrados." }), { status: 200 });
        }

        await db.close();
        return new Response(JSON.stringify(empleados), { status: 200 });

    } catch (error) {
        console.error("Error obteniendo empleados:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}

export async function POST({ request }) {
    try {

        const { nombre, cargo } = await request.json();

        const db = await open({
            filename: './db/spabella.db',
            driver: sqlite3.Database
        });

        await db.run("INSERT INTO empleados (nombre, cargo) VALUES (?, ?)", [nombre, cargo]);

        await db.close();

        return new Response(JSON.stringify({ message: "Empleado agregado exitosamente" }), { status: 200 });
    
    } catch (error) {
        console.error("Error agregando empleado:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}

// RESET DE IDS
// DELETE FROM sqlite_sequence WHERE name='empleados';