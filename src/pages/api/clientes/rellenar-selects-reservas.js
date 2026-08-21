import { createClient } from "@libsql/client";
import { esPaqueteLaserGrande } from "../../../lib/paquetes-schema.js";

export async function GET() {
    const db = createClient({
        url: import.meta.env.DATABASE_URL,
        authToken: import.meta.env.DATABASE_AUTH_TOKEN,
    });

    const clientes = await db.execute(
        "SELECT id, nombre, celular FROM clientes ORDER BY nombre ASC"
    );

    const paquetes = await db.execute(
        `
        SELECT
            p.id,
            p.cliente_id,
            p.descripcion,
            p.numero_sesiones,
            COALESCE(p.laser_grande, 0) AS laser_grande,
            COALESCE(s.sesiones_usadas, 0) AS sesiones_usadas
        FROM paquetes p
        LEFT JOIN (
            SELECT paquete_id, COUNT(*) AS sesiones_usadas
            FROM sesiones
            WHERE numero_sesion > 0
            GROUP BY paquete_id
        ) s ON s.paquete_id = p.id
        `
    );

    const laserPorCliente = {};

    (paquetes.rows || []).forEach((paquete) => {
        const usadas = Number(paquete.sesiones_usadas ?? 0);
        const total = Number(paquete.numero_sesiones ?? 0);
        const activo = usadas < total;
        if (!activo) return;
        if (!esPaqueteLaserGrande(paquete)) return;

        const clienteId = Number(paquete.cliente_id);
        if (!laserPorCliente[clienteId]) {
            laserPorCliente[clienteId] = {
                laserGrande: true,
                paqueteDescripcion: paquete.descripcion,
                sesionesRestantes: Math.max(0, total - usadas),
            };
        }
    });

    const clientesEnvios = (clientes.rows || []).map((cliente) => {
        const extra = laserPorCliente[Number(cliente.id)];
        return {
            id: cliente.id,
            nombre: cliente.nombre,
            celular: cliente.celular,
            laserGrande: Boolean(extra?.laserGrande),
            paqueteLaser: extra?.paqueteDescripcion || "",
            sesionesRestantes: extra?.sesionesRestantes ?? 0,
        };
    });

    // Láser grandes primero para que se vean al agendar
    clientesEnvios.sort((a, b) => {
        if (a.laserGrande !== b.laserGrande) return a.laserGrande ? -1 : 1;
        return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {
            sensitivity: "base",
        });
    });

    return new Response(JSON.stringify({ clientesEnvios }), {
        headers: { "Content-Type": "application/json" },
    });
}
