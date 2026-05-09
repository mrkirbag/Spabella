import { createClient } from "@libsql/client";

export async function GET() {
    const db = createClient({
        url: import.meta.env.DATABASE_URL,
        authToken: import.meta.env.DATABASE_AUTH_TOKEN
    });

    try {
        const deudores = await db.execute(`
            SELECT
                p.id AS paquete_id,
                c.id AS cliente_id,
                c.nombre,
                c.celular,
                p.descripcion AS paquete,
                p.fecha_compra,
                p.monto_total,
                COALESCE(SUM(s.abono_pago), 0) AS total_abonado,
                (p.monto_total - COALESCE(SUM(s.abono_pago), 0)) AS saldo_pendiente,
                MAX(s.fecha) AS ultima_fecha_abono
            FROM paquetes p
            JOIN clientes c ON p.cliente_id = c.id
            LEFT JOIN sesiones s ON s.paquete_id = p.id
            GROUP BY
                p.id,
                c.id,
                c.nombre,
                c.celular,
                p.descripcion,
                p.fecha_compra,
                p.monto_total
            HAVING (p.monto_total - COALESCE(SUM(s.abono_pago), 0)) > 0
            ORDER BY p.fecha_compra ASC
        `);

        if (!deudores.rows || deudores.rows.length === 0) {
            return new Response(JSON.stringify({ mensaje: "No hay pacientes con saldo pendiente." }), { status: 200 });
        }

        return new Response(JSON.stringify(deudores.rows), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        console.error("Error obteniendo deudores:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}
