import { createClient } from "@libsql/client";

const db = createClient({   url: import.meta.env.DATABASE_URL,
                            authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
});

export async function GET() {
    try {
        const clientes = await db.execute("SELECT * FROM clientes");

        console.log("Resultado de la consulta:", clientes); // Debug
        console.log("Empleados obtenidos:", clientes.rows); // Ver datos reales

        // Si no hay registros, mostrar mensaje de error
        if (!clientes.rows || clientes.rows.length === 0) {
            return new Response(JSON.stringify({ mensaje: "No hay clientes registrados." }), { status: 200 });
        }

        return new Response(JSON.stringify(clientes.rows), { status: 200 });

    } catch (error) {
        console.error("Error obteniendo clientes:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}

export async function POST({ request }) {
    try {
        const body = await request.json();
        const { nombre, numero } = body;

        // Validar que los datos no estén vacíos
        if (!nombre || !numero) {
            return new Response(JSON.stringify({ error: "Nombre y Numero de Teléfono son obligatorios" }), { status: 400 });
        }

        await db.execute("INSERT INTO clientes (nombre, celular) VALUES (?, ?)", [nombre, numero]);

        return new Response(JSON.stringify({ message: "Cliente agregado exitosamente" }), { status: 201 });

    } catch (error) {
        console.error("Error agregando cliente:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}