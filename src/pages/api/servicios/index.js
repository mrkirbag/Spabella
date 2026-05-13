import { createClient } from "@libsql/client";

const db = createClient({   url: import.meta.env.DATABASE_URL,
                            authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                        });

export async function GET() {
    try {

        const servicios = await db.execute(`
            SELECT id, porcentaje_spabella, porcentaje_empleado, estado
            FROM servicios
            WHERE estado = 'activo'
            ORDER BY porcentaje_spabella DESC, porcentaje_empleado ASC, id ASC
        `);

        // Si no hay registros, mostrar mensaje de error
        if (!servicios.rows || servicios.rows.length === 0) {
            return new Response(JSON.stringify({ mensaje: "No hay porcentajes registrados." }), { status: 200 });
        }

        return new Response(JSON.stringify(servicios.rows), { status: 200 });

    } catch (error) {
        console.error("Error obteniendo servicios:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}

export async function POST({ request }) {
    try {

        const { porcentajeSpa, porcentajeEmpleado } = await request.json();
        const porcentajeSpaValor = Number(porcentajeSpa);
        const porcentajeEmpleadoValor = Number(porcentajeEmpleado);

        if (!Number.isFinite(porcentajeSpaValor) || !Number.isFinite(porcentajeEmpleadoValor)) {
            return new Response(JSON.stringify({ error: "Los porcentajes deben ser numeros validos." }), { status: 400 });
        }

        if (porcentajeSpaValor < 0 || porcentajeEmpleadoValor < 0) {
            return new Response(JSON.stringify({ error: "Los porcentajes deben ser mayores o iguales a cero." }), { status: 400 });
        }

        const totalPorcentajes = Number((porcentajeSpaValor + porcentajeEmpleadoValor).toFixed(2));
        if (totalPorcentajes !== 100) {
            return new Response(JSON.stringify({ error: "La suma de porcentajes debe ser 100." }), { status: 400 });
        }

        const servicioActivo = await db.execute(
            "SELECT id FROM servicios WHERE porcentaje_spabella = ? AND porcentaje_empleado = ? AND LOWER(estado) = 'activo' ORDER BY id ASC LIMIT 1",
            [porcentajeSpaValor, porcentajeEmpleadoValor]
        );

        if (servicioActivo.rows && servicioActivo.rows.length > 0) {
            return new Response(JSON.stringify({ message: "Este reparto ya existe y esta activo.", id: servicioActivo.rows[0].id }), { status: 200 });
        }

        const servicioInactivo = await db.execute(
            "SELECT id FROM servicios WHERE porcentaje_spabella = ? AND porcentaje_empleado = ? AND LOWER(estado) = 'inactivo' ORDER BY id ASC LIMIT 1",
            [porcentajeSpaValor, porcentajeEmpleadoValor]
        );

        if (servicioInactivo.rows && servicioInactivo.rows.length > 0) {
            const existente = servicioInactivo.rows[0];

            await db.execute(
                "UPDATE servicios SET estado = 'activo' WHERE id = ?",
                [existente.id]
            );

            return new Response(JSON.stringify({ message: "Porcentajes reactivados exitosamente.", id: existente.id }), { status: 200 });
        }

        const nombreGenerado = `REPARTO ${porcentajeSpaValor}/${porcentajeEmpleadoValor}`;

        await db.execute(
            "INSERT INTO servicios (nombre, porcentaje_spabella, porcentaje_empleado, estado) VALUES (?, ?, ?, 'activo')",
            [nombreGenerado, porcentajeSpaValor, porcentajeEmpleadoValor]
        );

        return new Response(JSON.stringify({ message: "Porcentajes agregados exitosamente" }), { status: 200 });
    
    } catch (error) {
        console.error("Error agregando servicio:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}

// RESET DE IDS
// DELETE FROM sqlite_sequence WHERE name='servicios';
