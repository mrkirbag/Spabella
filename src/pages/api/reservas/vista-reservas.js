import { createClient } from "@libsql/client";

export async function GET({ request }) {

    const url = new URL(request.url);
    const fecha = url.searchParams.get("fecha");

    const db = createClient({   url: import.meta.env.DATABASE_URL,
                                        authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                                    });
    try {

        const reservas = fecha
            ? await db.execute(
                `
                    SELECT reservas.*, clientes.nombre, clientes.celular
                    FROM reservas
                    JOIN clientes ON reservas.id_cliente = clientes.id
                    WHERE reservas.fecha = ?
                    ORDER BY reservas.fecha ASC;
                `,
                [fecha]
            )
            : await db.execute(`

                    SELECT reservas.*, 
                    clientes.nombre, clientes.celular FROM reservas 
                    JOIN clientes ON reservas.id_cliente = clientes.id
                    WHERE reservas.fecha BETWEEN CURRENT_DATE AND DATE(CURRENT_DATE, '+5 days')
                    ORDER BY reservas.fecha ASC;

                `);

        // Si no hay registros, mostrar mensaje de error
        if (!reservas.rows || reservas.rows.length === 0) {
            const mensaje = fecha
                ? "No hay reservas para la fecha seleccionada."
                : "No hay reservas en los próximos 5 días.";

            return new Response(JSON.stringify({ mensaje }), { status: 200 });
        }

        return new Response(JSON.stringify(reservas.rows), { status: 200 });

    } catch (error) {
        console.error("Error obteniendo reservas:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}