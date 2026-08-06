import { createClient } from "@libsql/client";
import {
    ensureTasasTable,
    ensureValesTable,
    ensureVentaPagosTable,
    ensureVentasColumns,
    getTasas,
} from "../../../lib/ventas-schema.js";

const redondear = (n) => Number(Number(n || 0).toFixed(2));

const vacio = () => ({ usd: 0, cop: 0, bs: 0 });

const sumarMoneda = (totales, moneda, monto, signo = 1) => {
    const valor = Number(monto || 0) * signo;
    if (moneda === "USD") totales.usd += valor;
    if (moneda === "COP") totales.cop += valor;
    if (moneda === "BS") totales.bs += valor;
};

const fijar = (obj) => ({
    usd: redondear(obj.usd),
    cop: redondear(obj.cop),
    bs: redondear(obj.bs),
});

const pagosDesdeVentaLegacy = (venta) => {
    const pagos = [];
    const montoUsd = Number(venta.monto_usd ?? 0);
    const montoCop = Number(venta.monto_cop_raw ?? 0);
    const montoBs = Number(venta.monto_bs_raw ?? 0);

    if (montoUsd > 0) {
        pagos.push({
            moneda: "USD",
            monto: montoUsd,
            metodo_pago: venta.metodo_pago_usd || "Sin método",
        });
    }
    if (montoCop > 0) {
        pagos.push({
            moneda: "COP",
            monto: montoCop,
            metodo_pago: venta.metodo_pago_cop || "Sin método",
        });
    }
    if (montoBs > 0) {
        pagos.push({
            moneda: "BS",
            monto: montoBs,
            metodo_pago: venta.metodo_pago_bs || "Sin método",
        });
    }
    return pagos;
};

export async function GET({ request }) {
    try {
        const url = new URL(request.url);
        const fecha = url.searchParams.get("fecha");

        if (!fecha) {
            return new Response(
                JSON.stringify({ error: "La fecha es obligatoria." }),
                { status: 400 }
            );
        }

        const db = createClient({
            url: import.meta.env.DATABASE_URL,
            authToken: import.meta.env.DATABASE_AUTH_TOKEN,
        });

        await ensureTasasTable(db);
        await ensureVentasColumns(db);
        await ensureVentaPagosTable(db);
        await ensureValesTable(db);

        const tasas = await getTasas(db);

        const ventas = await db.execute(
            `
            SELECT
                v.id,
                v.fecha,
                v.descripcion,
                e.nombre AS empleada,
                COALESCE(v.monto_usd, v.monto) AS monto_usd,
                COALESCE(v.monto_bs_raw, 0) AS monto_bs_raw,
                COALESCE(v.monto_cop_raw, 0) AS monto_cop_raw,
                COALESCE(v.metodo_pago_usd, '') AS metodo_pago_usd,
                COALESCE(v.metodo_pago_bs, '') AS metodo_pago_bs,
                COALESCE(v.metodo_pago_cop, '') AS metodo_pago_cop
            FROM ventas v
            JOIN empleados e ON v.empleado_id = e.id
            WHERE v.fecha = ?
            ORDER BY v.id ASC
            `,
            [fecha]
        );

        const ids = (ventas.rows || []).map((v) => v.id);
        const pagosPorVenta = {};

        if (ids.length) {
            const placeholders = ids.map(() => "?").join(",");
            const pagosResponse = await db.execute(
                `SELECT venta_id, moneda, monto, metodo_pago
                 FROM venta_pagos
                 WHERE venta_id IN (${placeholders})
                 ORDER BY id ASC`,
                ids
            );
            (pagosResponse.rows || []).forEach((pago) => {
                if (!pagosPorVenta[pago.venta_id]) pagosPorVenta[pago.venta_id] = [];
                pagosPorVenta[pago.venta_id].push(pago);
            });
        }

        const vales = await db.execute(
            `
            SELECT
                v.id,
                v.fecha,
                e.nombre AS empleada,
                v.moneda,
                v.monto,
                v.metodo_pago,
                v.nota
            FROM vales v
            JOIN empleados e ON v.empleado_id = e.id
            WHERE v.fecha = ?
            ORDER BY v.id ASC
            `,
            [fecha]
        );

        const transacciones = [];
        const ingresos = vacio();
        const egresos = vacio();

        (ventas.rows || []).forEach((venta) => {
            const pagos =
                pagosPorVenta[venta.id]?.length > 0
                    ? pagosPorVenta[venta.id]
                    : pagosDesdeVentaLegacy(venta);

            pagos.forEach((pago, idx) => {
                const moneda = String(pago.moneda || "").toUpperCase();
                const monto = Number(pago.monto ?? 0);
                if (monto <= 0) return;

                sumarMoneda(ingresos, moneda, monto, 1);
                transacciones.push({
                    id: `venta-${venta.id}-${idx}`,
                    tipo: "ingreso",
                    origen: "venta",
                    origenId: venta.id,
                    fecha: venta.fecha,
                    descripcion: venta.descripcion,
                    empleada: venta.empleada,
                    moneda,
                    monto: redondear(monto),
                    metodo: pago.metodo_pago || "Sin método",
                });
            });
        });

        (vales.rows || []).forEach((vale) => {
            const moneda = String(vale.moneda || "").toUpperCase();
            const monto = Number(vale.monto ?? 0);
            if (monto <= 0) return;

            sumarMoneda(egresos, moneda, monto, 1);
            transacciones.push({
                id: `vale-${vale.id}`,
                tipo: "egreso",
                origen: "vale",
                origenId: vale.id,
                fecha: vale.fecha,
                descripcion: vale.nota || "Vale a empleada",
                empleada: vale.empleada,
                moneda,
                monto: redondear(monto),
                metodo: vale.metodo_pago || "Sin método",
            });
        });

        const neto = {
            usd: ingresos.usd - egresos.usd,
            cop: ingresos.cop - egresos.cop,
            bs: ingresos.bs - egresos.bs,
        };

        return new Response(
            JSON.stringify({
                fecha,
                tasas,
                transacciones,
                resumen: {
                    ingresos: fijar(ingresos),
                    egresos: fijar(egresos),
                    neto: fijar(neto),
                    totalTransacciones: transacciones.length,
                    totalVentas: (ventas.rows || []).length,
                    totalVales: (vales.rows || []).length,
                },
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error en flujo de caja:", error);
        return new Response(
            JSON.stringify({ error: "Error interno del servidor" }),
            { status: 500 }
        );
    }
}
