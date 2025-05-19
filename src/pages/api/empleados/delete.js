import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function DELETE({ request }) {
    try {
        const { id } = await request.json(); 

        const db = await open({
            filename: './db/spabella.db',
            driver: sqlite3.Database
        });

        await db.run("DELETE FROM empleados WHERE id = ?", [id]);

        return new Response(JSON.stringify({ message: "Empleado eliminado correctamente" }), { status: 200 });

    } catch (error) {
        console.error("Error eliminando empleado:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}