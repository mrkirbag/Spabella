import { createClient } from "@libsql/client";

export async function GET() {

    const db = createClient({   url: import.meta.env.DATABASE_URL,
                                authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                            });

    const clientes = await db.execute("SELECT id, nombre, celular FROM clientes");

    let clientesEnvios = clientes.rows;

    return new Response(JSON.stringify({clientesEnvios}), {
        headers: { "Content-Type": "application/json" }
    });
}