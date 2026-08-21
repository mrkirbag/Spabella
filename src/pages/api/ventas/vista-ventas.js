import { createClient } from "@libsql/client";
import { getTasas } from "../../../lib/ventas-schema.js";

const acumular = (mapa, clave, montos) => {
    if (!clave) return;
    if (!mapa[clave]) {
        mapa[clave] = { clave, usd: 0, cop: 0, bs: 0 };
    }
    mapa[clave].usd += montos.usd || 0;
    mapa[clave].cop += montos.cop || 0;
    mapa[clave].bs += montos.bs || 0;
};

const construirCaja = (pagos) => {
    const porMetodo = {};
    let totalUsd = 0;
    let totalCop = 0;
    let totalBs = 0;

    pagos.forEach((pago) => {
        const moneda = String(pago.moneda || "").toUpperCase();
        const monto = Number(pago.monto ?? 0);
        const metodo = String(pago.metodo_pago || "Sin metodo").trim() || "Sin metodo";

        if (moneda === "USD") {
            totalUsd += monto;
            acumular(porMetodo, metodo, { usd: monto });
        } else if (moneda === "COP") {
            totalCop += monto;
            acumular(porMetodo, metodo, { cop: monto });
        } else if (moneda === "BS") {
            totalBs += monto;
            acumular(porMetodo, metodo, { bs: monto });
        }
    });

    return {
        totalUsd: Number(totalUsd.toFixed(2)),
        totalCop: Number(totalCop.toFixed(2)),
        totalBs: Number(totalBs.toFixed(2)),
        porMetodo: Object.values(porMetodo)
            .map((item) => ({
                ...item,
                usd: Number(item.usd.toFixed(2)),
                cop: Number(item.cop.toFixed(2)),
                bs: Number(item.bs.toFixed(2)),
            }))
            .sort((a, b) => a.clave.localeCompare(b.clave, "es")),
    };
};

const pagosDesdeVentaLegacy = (venta) => {
    const pagos = [];
    const montoUsd = Number(venta.monto_usd ?? 0);
    const montoCop = Number(venta.monto_cop_raw ?? 0);
    const montoBs = Number(venta.monto_bs_raw ?? 0);

    if (montoUsd > 0) {
        pagos.push({
            moneda: "USD",
            monto: montoUsd,
            metodo_pago: venta.metodo_pago_usd || "Sin metodo",
        });
    }
    if (montoCop > 0) {
        pagos.push({
            moneda: "COP",
            monto: montoCop,
            metodo_pago: venta.metodo_pago_cop || "Sin metodo",
        });
    }
    if (montoBs > 0) {
        pagos.push({
            moneda: "BS",
            monto: montoBs,
            metodo_pago: venta.metodo_pago_bs || "Sin metodo",
        });
    }
    return pagos;
};

export async function GET({ request }) {
    const url = new URL(request.url);
    const fecha = url.searchParams.get("fecha");

    const db = createClient({
        url: import.meta.env.DATABASE_URL,
        authToken: import.meta.env.DATABASE_AUTH_TOKEN,
    });

    const tasas = await getTasas(db);

    const ventas = await db.execute(
        `
        SELECT
            v.id,
            v.fecha,
            s.porcentaje_spabella,
            s.porcentaje_empleado,
            v.descripcion,
            e.nombre AS empleado,
            v.monto,
            COALESCE(v.monto_usd, v.monto) AS monto_usd,
            COALESCE(v.monto_bs, 0) AS monto_bs_usd,
            COALESCE(v.monto_cop, 0) AS monto_cop_usd,
            CASE
                WHEN COALESCE(v.monto_bs_raw, 0) > 0 THEN v.monto_bs_raw
                WHEN COALESCE(v.tasa_bs, 0) > 0 THEN ROUND(COALESCE(v.monto_bs, 0) * v.tasa_bs, 2)
                WHEN ? > 0 THEN ROUND(COALESCE(v.monto_bs, 0) * ?, 2)
                ELSE 0
            END AS monto_bs_raw,
            CASE
                WHEN COALESCE(v.monto_cop_raw, 0) > 0 THEN v.monto_cop_raw
                WHEN COALESCE(v.tasa_cop, 0) > 0 THEN ROUND(COALESCE(v.monto_cop, 0) * v.tasa_cop, 2)
                WHEN ? > 0 THEN ROUND(COALESCE(v.monto_cop, 0) * ?, 2)
                ELSE 0
            END AS monto_cop_raw,
            COALESCE(v.tasa_bs, 0) AS tasa_bs_venta,
            COALESCE(v.tasa_cop, 0) AS tasa_cop_venta,
            COALESCE(v.metodo_pago_usd, '') AS metodo_pago_usd,
            COALESCE(v.metodo_pago_bs, '') AS metodo_pago_bs,
            COALESCE(v.metodo_pago_cop, '') AS metodo_pago_cop
        FROM ventas v
        JOIN empleados e ON v.empleado_id = e.id
        JOIN servicios s ON v.servicio_id = s.id
        WHERE v.fecha = ?
        ORDER BY v.id ASC
        `,
        [tasas.bs, tasas.bs, tasas.cop, tasas.cop, fecha]
    );

    if (!ventas.rows || ventas.rows.length === 0) {
        return new Response(
            JSON.stringify({
                mensaje: "No hay ventas para esa fecha.",
                caja: {
                    totalUsd: 0,
                    totalCop: 0,
                    totalBs: 0,
                    porMetodo: [],
                },
                tasas,
                tasaBs: tasas.bs,
                tasaCop: tasas.cop,
            }),
            { status: 200 }
        );
    }

    const ids = ventas.rows.map((venta) => venta.id);
    const placeholders = ids.map(() => "?").join(",");
    const pagosResponse = await db.execute(
        `SELECT venta_id, moneda, monto, monto_usd, metodo_pago, tasa
         FROM venta_pagos
         WHERE venta_id IN (${placeholders})
         ORDER BY id ASC`,
        ids
    );

    const pagosPorVenta = {};
    (pagosResponse.rows || []).forEach((pago) => {
        if (!pagosPorVenta[pago.venta_id]) pagosPorVenta[pago.venta_id] = [];
        pagosPorVenta[pago.venta_id].push(pago);
    });

    const ventasConPagos = ventas.rows.map((venta) => {
        const pagos =
            pagosPorVenta[venta.id]?.length > 0
                ? pagosPorVenta[venta.id]
                : pagosDesdeVentaLegacy(venta);
        return { ...venta, pagos };
    });

    const todosLosPagos = ventasConPagos.flatMap((venta) => venta.pagos);
    const caja = construirCaja(todosLosPagos);

    return new Response(
        JSON.stringify({
            ventas: ventasConPagos,
            caja,
            tasas,
            tasaBs: tasas.bs,
            tasaCop: tasas.cop,
        }),
        {
            headers: { "Content-Type": "application/json" },
        }
    );
}
