import { createClient } from "@libsql/client";
import { ensureReservasColumns } from "../../../lib/reservas-schema.js";

export async function GET({ request }) {
    const url = new URL(request.url);
    const fecha = url.searchParams.get("fecha");
    const tipo = String(url.searchParams.get("tipo") || "todas").toLowerCase();

    const db = createClient({
        url: import.meta.env.DATABASE_URL,
        authToken: import.meta.env.DATABASE_AUTH_TOKEN,
    });

    try {
        await ensureReservasColumns(db);

        // laser = solo láser grande; todas/normal = todas (con flag para diferenciar en UI)
        const filtroLaser =
            tipo === "laser"
                ? "AND COALESCE(reservas.laser_largo, 0) = 1"
                : "";

        const reservas = fecha
            ? await db.execute(
                  `
                    SELECT
                        reservas.id,
                        reservas.fecha,
                        reservas.descripcion,
                        reservas.id_cliente,
                        COALESCE(reservas.laser_largo, 0) AS laser_largo,
                        clientes.nombre,
                        clientes.celular
                    FROM reservas
                    JOIN clientes ON reservas.id_cliente = clientes.id
                    WHERE reservas.fecha = ?
                      ${filtroLaser}
                    ORDER BY
                        COALESCE(reservas.laser_largo, 0) DESC,
                        reservas.fecha ASC,
                        reservas.id ASC
                  `,
                  [fecha]
              )
            : await db.execute(
                  `
                    SELECT
                        reservas.id,
                        reservas.fecha,
                        reservas.descripcion,
                        reservas.id_cliente,
                        COALESCE(reservas.laser_largo, 0) AS laser_largo,
                        clientes.nombre,
                        clientes.celular
                    FROM reservas
                    JOIN clientes ON reservas.id_cliente = clientes.id
                    WHERE reservas.fecha BETWEEN CURRENT_DATE AND DATE(CURRENT_DATE, '+5 days')
                      ${filtroLaser}
                    ORDER BY
                        COALESCE(reservas.laser_largo, 0) DESC,
                        reservas.fecha ASC,
                        reservas.id ASC
                  `
              );

        if (!reservas.rows || reservas.rows.length === 0) {
            const mensaje = fecha
                ? tipo === "laser"
                    ? "No hay citas de láser extendido para esa fecha."
                    : "No hay reservas para la fecha seleccionada."
                : tipo === "laser"
                  ? "No hay citas de láser extendido en los próximos 5 días."
                  : "No hay reservas en los próximos 5 días.";

            return new Response(JSON.stringify({ mensaje }), { status: 200 });
        }

        return new Response(JSON.stringify(reservas.rows), { status: 200 });
    } catch (error) {
        console.error("Error obteniendo reservas:", error);
        return new Response(
            JSON.stringify({ error: "Error interno del servidor" }),
            { status: 500 }
        );
    }
}
