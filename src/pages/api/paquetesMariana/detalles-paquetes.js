import { createClient } from "@libsql/client";
import {
    ensurePaquetesColumns,
    esPaqueteLaserGrande,
    normalizarLaserGrande,
} from "../../../lib/paquetes-schema.js";

const dbClient = () =>
    createClient({
        url: import.meta.env.DATABASE_URL,
        authToken: import.meta.env.DATABASE_AUTH_TOKEN,
    });

export async function GET({ request }) {
    const url = new URL(request.url);
    const idPaquete = url.searchParams.get("id");

    const db = dbClient();
    await ensurePaquetesColumns(db);

    const detallesPaquete = await db.execute(
        `
        SELECT
            p.id,
            p.fecha_compra,
            p.descripcion,
            p.numero_sesiones,
            p.monto_total,
            COALESCE(p.laser_grande, 0) AS laser_grande,
            c.nombre AS cliente_nombre
        FROM paquetes p
        JOIN clientes c ON p.cliente_id = c.id
        WHERE p.id = ?
        `,
        [idPaquete]
    );

    if (!detallesPaquete.rows || detallesPaquete.rows.length === 0) {
        return new Response(
            JSON.stringify({ mensaje: "No hay registros para ese paquete." }),
            { status: 200 }
        );
    }

    const rows = detallesPaquete.rows.map((p) => ({
        ...p,
        laserGrandeEfectivo: esPaqueteLaserGrande(p),
    }));

    return new Response(JSON.stringify(rows), {
        headers: { "Content-Type": "application/json" },
    });
}

/** Marca / desmarca paquete como láser grande */
export async function POST({ request }) {
    try {
        const { id, laserGrande } = await request.json();
        const paqueteId = Number(id);
        if (!paqueteId) {
            return new Response(
                JSON.stringify({ error: "ID de paquete inválido." }),
                { status: 400 }
            );
        }

        const db = dbClient();
        await ensurePaquetesColumns(db);

        const laser = normalizarLaserGrande(laserGrande);
        await db.execute(
            "UPDATE paquetes SET laser_grande = ? WHERE id = ?",
            [laser, paqueteId]
        );

        return new Response(
            JSON.stringify({
                message: laser
                    ? "Paquete marcado como láser grande."
                    : "Paquete marcado como normal.",
                laserGrande: laser,
            }),
            { status: 200 }
        );
    } catch (error) {
        console.error("Error actualizando paquete láser:", error);
        return new Response(
            JSON.stringify({ error: "Error interno del servidor" }),
            { status: 500 }
        );
    }
}
