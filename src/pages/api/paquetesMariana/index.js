import { createClient } from "@libsql/client";

export async function POST({ request }) {
    try {

        const { descripcion, nroSesionesTotal, montoTotal, fecha, clienteId } = await request.json();

        const db = createClient({   url: import.meta.env.DATABASE_URL,
                                    authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                                });

        // validar que no esten vacios
        if (!descripcion || !montoTotal || !fecha || !clienteId || !nroSesionesTotal) {
            return new Response(JSON.stringify({ error: "Los campos no pueden estar vacios." }), { status: 400 });
        }

        const insertResult = await db.execute(
            "INSERT INTO paquetes (descripcion, numero_sesiones, monto_total, fecha_compra, cliente_id) VALUES (?, ?, ?, ?, ?)",
            [descripcion, nroSesionesTotal, montoTotal, fecha, clienteId]
        );

        let paqueteId = Number(insertResult.lastInsertRowid ?? 0);

        if (!paqueteId) {
            const ultimoPaquete = await db.execute("SELECT id FROM paquetes ORDER BY id DESC LIMIT 1");
            paqueteId = Number(ultimoPaquete.rows?.[0]?.id ?? 0);
        }

        return new Response(
            JSON.stringify({ message: "Paquete agregado exitosamente", paqueteId }),
            { status: 200 }
        );
    
    } catch (error) {
        console.error("Error agregando paquete:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}