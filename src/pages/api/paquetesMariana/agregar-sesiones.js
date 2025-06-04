import { createClient } from "@libsql/client";

export async function POST({ request }) {
    try {

        const { fecha, numeroSesion, abonoPago, idPaquete } = await request.json();

        const db = createClient({   url: import.meta.env.DATABASE_URL,
                                    authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                                });

        // validar que no esten vacios
        if (!fecha || !numeroSesion || !abonoPago || !idPaquete) {
            return new Response(JSON.stringify({ error: "Los campos no pueden estar vacios." }), { status: 400 });
        }

        await db.execute("INSERT INTO sesiones (fecha, numero_sesion, abono_pago, paquete_id) VALUES (?, ?, ?, ?)", [fecha, numeroSesion, abonoPago, idPaquete]);

        return new Response(JSON.stringify({ message: "Sesión agregada exitosamente" }), { status: 200 });
    
    } catch (error) {
        console.error("Error agregando paquete:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}