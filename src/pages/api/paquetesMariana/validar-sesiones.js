import { createClient } from "@libsql/client";

export async function GET({ request }) {

    const url = new URL(request.url);
    const paqueteId = url.searchParams.get("id");

    const db = createClient({   
                                url: import.meta.env.DATABASE_URL,
                                authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                            });

    try {


        // VALIDAR SESIONES AGREGADAS

        // Sesiones totales del paquete seleccionado
        const sesiones = await db.execute(`SELECT numero_sesiones FROM paquetes WHERE id = ?`, [paqueteId]);
        const numeroSesiones = sesiones.rows[0]?.numero_sesiones ?? 0;

        // Cantidad de registros de sesiones registradas del paquete seleccionado
        const resultado = await db.execute(`SELECT COUNT(*) AS total_sesiones FROM sesiones WHERE paquete_id = ?`, [paqueteId]);
        const totalSesiones = resultado.rows[0]?.total_sesiones ?? 0;

        // Calculo de Sesiones Restantes
        const validacionSesiones = numeroSesiones - totalSesiones;

        // VALIDAR MONTO RESTANTE

        // Calculo del monto total del paquete
        const montoRestante = await db.execute(`SELECT monto_total FROM paquetes WHERE id = ?`, [paqueteId]);
        const totalMonto = montoRestante.rows[0]?.monto_total ?? 0;

        // Calculo de todos los abonos realizados
        const abonosTotales = await db.execute(`SELECT SUM(abono_pago) AS total_abonos FROM sesiones WHERE paquete_id = ?`, [paqueteId]);
        const totalAbonos = abonosTotales.rows[0]?.total_abonos ?? 0;

        // Saldo pendiente
        const validacionMonto = totalMonto - totalAbonos;

        // Creo un objeto con el saldo y sesiones pendientes
        const validacionTotal = {
            monto: validacionMonto,
            sesiones: validacionSesiones
        }

        return new Response(JSON.stringify({ validacionTotal }), { status: 200 });

    } catch (error) {
        console.error("Error obteniendo sesiones:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor"  }), { status: 500 });
    }
}