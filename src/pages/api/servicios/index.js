import { createClient } from "@libsql/client";

const db = createClient({   url: import.meta.env.DATABASE_URL,
                            authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                        });

export async function GET() {
    try {

        const servicios = await db.execute("SELECT * FROM servicios");

        // Si no hay registros, mostrar mensaje de error
        if (!servicios.rows || servicios.rows.length === 0) {
            return new Response(JSON.stringify({ mensaje: "No hay servicios registrados." }), { status: 200 });
        }

        return new Response(JSON.stringify(servicios.rows), { status: 200 });

    } catch (error) {
        console.error("Error obteniendo servicios:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}

export async function POST({ request }) {
    try {

        const { descripcion, porcentajeSpa, porcentajeEmpleado } = await request.json();

        // Validar que los datos no estén vacíos
        if (!descripcion || !porcentajeSpa || !porcentajeEmpleado) {
            return new Response(JSON.stringify({ error: "Los campos son obligatorios" }), { status: 400 });
        }

        await db.execute("INSERT INTO servicios (nombre, porcentaje_spabella, porcentaje_empleado) VALUES (?, ?, ?)", [descripcion, porcentajeSpa, porcentajeEmpleado]);

        return new Response(JSON.stringify({ message: "Servicio agregado exitosamente" }), { status: 200 });
    
    } catch (error) {
        console.error("Error agregando servicio:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}

// RESET DE IDS
// DELETE FROM sqlite_sequence WHERE name='servicios';
