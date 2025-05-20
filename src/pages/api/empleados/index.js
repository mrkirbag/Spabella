import { createClient } from "@libsql/client";

const db = createClient({   url: import.meta.env.DATABASE_URL,
                            authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
});

export async function GET() {
    try {
        const empleados = await db.execute("SELECT * FROM empleados");

        console.log("Resultado de la consulta:", empleados); // Debug
        console.log("Empleados obtenidos:", empleados.rows); // Ver datos reales

        // Si no hay registros, mostrar mensaje de error
        if (!empleados.rows || empleados.rows.length === 0) {
            return new Response(JSON.stringify({ mensaje: "No hay empleados registrados." }), { status: 200 });
        }

        return new Response(JSON.stringify(empleados.rows), { status: 200 });

    } catch (error) {
        console.error("Error obteniendo empleados:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}

export async function POST({ request }) {
    try {
        const body = await request.json();
        const { nombre, cargo } = body;

        // Validar que los datos no estén vacíos
        if (!nombre || !cargo) {
            return new Response(JSON.stringify({ error: "Nombre y cargo son obligatorios" }), { status: 400 });
        }

        await db.execute("INSERT INTO empleados (nombre, cargo) VALUES (?, ?)", [nombre, cargo]);

        return new Response(JSON.stringify({ message: "Empleado agregado exitosamente" }), { status: 201 });

    } catch (error) {
        console.error("Error agregando empleado:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}