import { createClient } from "@libsql/client";

export async function POST({ request }) {
    try {

        const { fecha, numeroSesion, abonoPago, idPaquete } = await request.json();

        const db = createClient({   url: import.meta.env.DATABASE_URL,
                                    authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                                });

        // validar que no esten vacios
        if (!fecha || numeroSesion === undefined || abonoPago === undefined || !idPaquete) {
            return new Response(JSON.stringify({ error: "Los campos no pueden estar vacios." }), { status: 400 });
        }

        const numeroSesionValor = Number(numeroSesion);
        const abonoPagoValor = Number(abonoPago);

        if (!Number.isInteger(numeroSesionValor) || numeroSesionValor <= 0) {
            return new Response(JSON.stringify({ error: "El numero de sesion debe ser un entero mayor a cero." }), { status: 400 });
        }

        if (!Number.isFinite(abonoPagoValor) || abonoPagoValor < 0) {
            return new Response(JSON.stringify({ error: "El abono debe ser un numero mayor o igual a cero." }), { status: 400 });
        }

        const paquete = await db.execute(
            "SELECT numero_sesiones, monto_total FROM paquetes WHERE id = ?",
            [idPaquete]
        );

        if (!paquete.rows || paquete.rows.length === 0) {
            return new Response(JSON.stringify({ error: "El paquete no existe." }), { status: 404 });
        }

        const numeroSesionesPaquete = Number(paquete.rows[0].numero_sesiones ?? 0);
        const montoTotalPaquete = Number(paquete.rows[0].monto_total ?? 0);

        const sesionesRegistradas = await db.execute(
            "SELECT COUNT(*) AS total_sesiones FROM sesiones WHERE paquete_id = ?",
            [idPaquete]
        );
        const totalSesionesRegistradas = Number(sesionesRegistradas.rows[0]?.total_sesiones ?? 0);

        if (totalSesionesRegistradas >= numeroSesionesPaquete) {
            return new Response(JSON.stringify({ error: "No se pueden agregar mas sesiones para este paquete." }), { status: 400 });
        }

        const abonosAcumulados = await db.execute(
            "SELECT SUM(abono_pago) AS total_abonos FROM sesiones WHERE paquete_id = ?",
            [idPaquete]
        );
        const totalAbonado = Number(abonosAcumulados.rows[0]?.total_abonos ?? 0);
        const saldoPendiente = Math.max(0, montoTotalPaquete - totalAbonado);

        if (abonoPagoValor > saldoPendiente) {
            return new Response(
                JSON.stringify({ error: `El abono no puede ser mayor al saldo pendiente (${saldoPendiente} USD).` }),
                { status: 400 }
            );
        }

        await db.execute(
            "INSERT INTO sesiones (fecha, numero_sesion, abono_pago, paquete_id) VALUES (?, ?, ?, ?)",
            [fecha, numeroSesionValor, abonoPagoValor, idPaquete]
        );

        return new Response(JSON.stringify({ message: "Sesión agregada exitosamente" }), { status: 200 });
    
    } catch (error) {
        console.error("Error agregando paquete:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}