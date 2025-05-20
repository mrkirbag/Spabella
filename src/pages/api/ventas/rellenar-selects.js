import { createClient } from "@libsql/client";

export async function GET() {

    const db = createClient({   url: import.meta.env.DATABASE_URL,
                                authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                            });

    const empleados = await db.execute("SELECT id, nombre, cargo FROM empleados");
    const servicios = await db.execute("SELECT id, nombre, porcentaje_spabella, porcentaje_empleado FROM servicios");

    let empleadosEnvios = empleados.rows;
    let serviciosEnvios = servicios.rows;

    return new Response(JSON.stringify({empleadosEnvios, serviciosEnvios}), {
        headers: { "Content-Type": "application/json" }
    });
}