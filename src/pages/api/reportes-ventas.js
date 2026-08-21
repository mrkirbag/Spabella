import { createClient } from "@libsql/client";
import { getTasas } from "../../lib/ventas-schema.js";

const redondear = (valor) => Number(Number(valor || 0).toFixed(2));

const vacioMonedas = () => ({ usd: 0, cop: 0, bs: 0 });

const sumarMonedas = (destino, origen) => {
    destino.usd += Number(origen.usd || 0);
    destino.cop += Number(origen.cop || 0);
    destino.bs += Number(origen.bs || 0);
};

const fijarMonedas = (obj) => ({
    usd: redondear(obj.usd),
    cop: redondear(obj.cop),
    bs: redondear(obj.bs),
});

const pagosDesdeVentaLegacy = (venta, tasas) => {
    const pagos = [];
    const montoUsd = Number(venta.monto_usd ?? 0);
    const montoCop = Number(venta.monto_cop_raw ?? 0);
    const montoBs =
        Number(venta.monto_bs_raw ?? 0) > 0
            ? Number(venta.monto_bs_raw)
            : Number(venta.tasa_bs_venta || tasas.bs) > 0
              ? Number(venta.monto_bs_usd ?? 0) * Number(venta.tasa_bs_venta || tasas.bs)
              : 0;

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

const acumularCaja = (mapa, metodo, moneda, monto) => {
    const clave = String(metodo || "Sin metodo").trim() || "Sin metodo";
    if (!mapa[clave]) {
        mapa[clave] = { metodo: clave, ...vacioMonedas() };
    }
    if (moneda === "USD") mapa[clave].usd += monto;
    if (moneda === "COP") mapa[clave].cop += monto;
    if (moneda === "BS") mapa[clave].bs += monto;
};

export async function GET({ request }) {
    const url = new URL(request.url);
    const fechaDesde = url.searchParams.get("desde");
    const fechaHasta = url.searchParams.get("hasta");

    const db = createClient({
        url: import.meta.env.DATABASE_URL,
        authToken: import.meta.env.DATABASE_AUTH_TOKEN,
    });

    const tasas = await getTasas(db);

    const datos = await db.execute(
        `
        SELECT
            v.id,
            v.fecha,
            s.porcentaje_empleado,
            s.porcentaje_spabella,
            v.descripcion,
            e.nombre AS empleada,
            v.monto,
            COALESCE(v.monto_usd, v.monto) AS monto_usd,
            COALESCE(v.monto_bs, 0) AS monto_bs_usd,
            COALESCE(v.monto_cop, 0) AS monto_cop_usd,
            COALESCE(v.monto_bs_raw, 0) AS monto_bs_raw,
            COALESCE(v.monto_cop_raw, 0) AS monto_cop_raw,
            COALESCE(v.tasa_bs, 0) AS tasa_bs_venta,
            COALESCE(v.tasa_cop, 0) AS tasa_cop_venta,
            COALESCE(v.metodo_pago_usd, '') AS metodo_pago_usd,
            COALESCE(v.metodo_pago_bs, '') AS metodo_pago_bs,
            COALESCE(v.metodo_pago_cop, '') AS metodo_pago_cop
        FROM ventas v
        JOIN empleados e ON v.empleado_id = e.id
        JOIN servicios s ON v.servicio_id = s.id
        WHERE v.fecha BETWEEN ? AND ?
        ORDER BY e.nombre, v.fecha, v.id
        `,
        [fechaDesde, fechaHasta]
    );

    const ids = (datos.rows || []).map((venta) => venta.id);
    const pagosPorVenta = {};

    if (ids.length) {
        const placeholders = ids.map(() => "?").join(",");
        const pagosResponse = await db.execute(
            `SELECT venta_id, moneda, monto, monto_usd, metodo_pago, tasa
             FROM venta_pagos
             WHERE venta_id IN (${placeholders})
             ORDER BY id ASC`,
            ids
        );

        (pagosResponse.rows || []).forEach((pago) => {
            if (!pagosPorVenta[pago.venta_id]) pagosPorVenta[pago.venta_id] = [];
            pagosPorVenta[pago.venta_id].push({
                moneda: String(pago.moneda || "").toUpperCase(),
                monto: Number(pago.monto ?? 0),
                metodo_pago: String(pago.metodo_pago || "Sin metodo"),
            });
        });
    }

    const facturacion = {};
    const totalesGenerales = {
        empleado: vacioMonedas(),
        spa: vacioMonedas(),
        caja: vacioMonedas(),
    };
    const cajaPorMetodo = {};

    datos.rows?.forEach((venta) => {
        const porcentajeEmpleado = Number(venta.porcentaje_empleado ?? 0);
        const porcentajeSpa = Number(venta.porcentaje_spabella ?? 0);
        const pagos =
            pagosPorVenta[venta.id]?.length > 0
                ? pagosPorVenta[venta.id]
                : pagosDesdeVentaLegacy(venta, tasas);

        const producido = vacioMonedas();
        const empleado = vacioMonedas();
        const spa = vacioMonedas();

        pagos.forEach((pago) => {
            const moneda = String(pago.moneda || "").toUpperCase();
            const monto = Number(pago.monto ?? 0);
            if (monto <= 0) return;

            if (moneda === "USD") producido.usd += monto;
            if (moneda === "COP") producido.cop += monto;
            if (moneda === "BS") producido.bs += monto;

            const parteEmpleado = (monto * porcentajeEmpleado) / 100;
            const parteSpa = (monto * porcentajeSpa) / 100;

            if (moneda === "USD") {
                empleado.usd += parteEmpleado;
                spa.usd += parteSpa;
            }
            if (moneda === "COP") {
                empleado.cop += parteEmpleado;
                spa.cop += parteSpa;
            }
            if (moneda === "BS") {
                empleado.bs += parteEmpleado;
                spa.bs += parteSpa;
            }

            acumularCaja(cajaPorMetodo, pago.metodo_pago, moneda, monto);
            if (moneda === "USD") totalesGenerales.caja.usd += monto;
            if (moneda === "COP") totalesGenerales.caja.cop += monto;
            if (moneda === "BS") totalesGenerales.caja.bs += monto;
        });

        if (!facturacion[venta.empleada]) {
            facturacion[venta.empleada] = {
                nombre: venta.empleada,
                totales: {
                    producido: vacioMonedas(),
                    empleado: vacioMonedas(),
                    spa: vacioMonedas(),
                    vales: vacioMonedas(),
                    aPagar: vacioMonedas(),
                },
                servicios: [],
                vales: [],
            };
        }

        sumarMonedas(facturacion[venta.empleada].totales.producido, producido);
        sumarMonedas(facturacion[venta.empleada].totales.empleado, empleado);
        sumarMonedas(facturacion[venta.empleada].totales.spa, spa);
        sumarMonedas(totalesGenerales.empleado, empleado);
        sumarMonedas(totalesGenerales.spa, spa);

        facturacion[venta.empleada].servicios.push({
            fecha: venta.fecha,
            descripcion: venta.descripcion,
            porcentajeEmpleado,
            porcentajeSpa,
            montoTotalUsd: redondear(venta.monto),
            pagos: pagos.map((pago) => ({
                moneda: pago.moneda,
                monto: redondear(pago.monto),
                metodo: pago.metodo_pago,
            })),
            producido: fijarMonedas(producido),
            empleado: fijarMonedas(empleado),
            spa: fijarMonedas(spa),
        });
    });

    const valesResponse = await db.execute(
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
        WHERE v.fecha BETWEEN ? AND ?
        ORDER BY e.nombre, v.fecha, v.id
        `,
        [fechaDesde, fechaHasta]
    );

    const totalesVales = vacioMonedas();

    (valesResponse.rows || []).forEach((vale) => {
        const moneda = String(vale.moneda || "").toUpperCase();
        const monto = Number(vale.monto ?? 0);
        if (monto <= 0) return;

        if (!facturacion[vale.empleada]) {
            facturacion[vale.empleada] = {
                nombre: vale.empleada,
                totales: {
                    producido: vacioMonedas(),
                    empleado: vacioMonedas(),
                    spa: vacioMonedas(),
                    vales: vacioMonedas(),
                    aPagar: vacioMonedas(),
                },
                servicios: [],
                vales: [],
            };
        }

        if (moneda === "USD") {
            facturacion[vale.empleada].totales.vales.usd += monto;
            totalesVales.usd += monto;
        }
        if (moneda === "COP") {
            facturacion[vale.empleada].totales.vales.cop += monto;
            totalesVales.cop += monto;
        }
        if (moneda === "BS") {
            facturacion[vale.empleada].totales.vales.bs += monto;
            totalesVales.bs += monto;
        }

        facturacion[vale.empleada].vales.push({
            fecha: vale.fecha,
            monto: redondear(monto),
            moneda,
            metodo: vale.metodo_pago || "Sin metodo",
            nota: vale.nota || "",
        });
    });

    const empleadas = Object.values(facturacion).map((empleada) => {
        const aPagar = {
            usd: Number(empleada.totales.empleado.usd || 0) - Number(empleada.totales.vales.usd || 0),
            cop: Number(empleada.totales.empleado.cop || 0) - Number(empleada.totales.vales.cop || 0),
            bs: Number(empleada.totales.empleado.bs || 0) - Number(empleada.totales.vales.bs || 0),
        };

        return {
            ...empleada,
            totales: {
                producido: fijarMonedas(empleada.totales.producido),
                empleado: fijarMonedas(empleada.totales.empleado),
                spa: fijarMonedas(empleada.totales.spa),
                vales: fijarMonedas(empleada.totales.vales),
                aPagar: fijarMonedas(aPagar),
            },
        };
    });

    const aPagarGeneral = {
        usd: Number(totalesGenerales.empleado.usd || 0) - Number(totalesVales.usd || 0),
        cop: Number(totalesGenerales.empleado.cop || 0) - Number(totalesVales.cop || 0),
        bs: Number(totalesGenerales.empleado.bs || 0) - Number(totalesVales.bs || 0),
    };

    if (!empleadas.length) {
        return new Response(
            JSON.stringify({
                mensaje: "No hay registros en este rango de fechas.",
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response(
        JSON.stringify({
            empleadas,
            totalesGenerales: {
                empleado: fijarMonedas(totalesGenerales.empleado),
                spa: fijarMonedas(totalesGenerales.spa),
                caja: fijarMonedas(totalesGenerales.caja),
                vales: fijarMonedas(totalesVales),
                aPagar: fijarMonedas(aPagarGeneral),
                porMetodo: Object.values(cajaPorMetodo)
                    .map((item) => ({
                        metodo: item.metodo,
                        usd: redondear(item.usd),
                        cop: redondear(item.cop),
                        bs: redondear(item.bs),
                    }))
                    .sort((a, b) => a.metodo.localeCompare(b.metodo, "es")),
            },
            tasas,
            totalVentas: (datos.rows || []).length,
            totalVales: (valesResponse.rows || []).length,
        }),
        { headers: { "Content-Type": "application/json" } }
    );
}
