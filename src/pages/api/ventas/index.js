import { createClient } from "@libsql/client";
import {
    getTasas,
    normalizarMetodoPago,
    normalizarMoneda,
    aUsd,
} from "../../../lib/ventas-schema.js";

export async function POST({ request }) {
    try {
        const {
            fecha,
            descripcion,
            montoTotalUsd,
            empleadoId,
            servicioId,
            pagos,
        } = await request.json();

        const db = createClient({
            url: import.meta.env.DATABASE_URL,
            authToken: import.meta.env.DATABASE_AUTH_TOKEN,
        });

        const montoTotalUsdValor = Number(montoTotalUsd ?? 0);
        const listaPagos = Array.isArray(pagos) ? pagos : [];

        if (!fecha || !empleadoId || !servicioId) {
            return new Response(
                JSON.stringify({
                    error: "Fecha, empleado y reparto son obligatorios.",
                }),
                { status: 400 }
            );
        }

        if (!Number.isFinite(montoTotalUsdValor) || montoTotalUsdValor <= 0) {
            return new Response(
                JSON.stringify({
                    error: "El monto total en USD debe ser mayor a cero.",
                }),
                { status: 400 }
            );
        }

        if (!listaPagos.length) {
            return new Response(
                JSON.stringify({
                    error: "Debes agregar al menos un pago.",
                }),
                { status: 400 }
            );
        }

        const tasas = await getTasas(db);
        const pagosNormalizados = [];

        for (const pago of listaPagos) {
            const moneda = normalizarMoneda(pago.moneda);
            const metodo = normalizarMetodoPago(pago.metodo, moneda);
            const monto = Number(pago.monto ?? 0);

            if (!moneda) {
                return new Response(
                    JSON.stringify({
                        error: "Cada pago debe tener una moneda valida (USD, COP o BS).",
                    }),
                    { status: 400 }
                );
            }

            if (!metodo) {
                return new Response(
                    JSON.stringify({
                        error: `Selecciona el metodo de pago para el monto en ${moneda}.`,
                    }),
                    { status: 400 }
                );
            }

            if (!Number.isFinite(monto) || monto <= 0) {
                return new Response(
                    JSON.stringify({
                        error: `El monto en ${moneda} debe ser mayor a cero.`,
                    }),
                    { status: 400 }
                );
            }

            if (moneda === "BS" && (!Number.isFinite(tasas.bs) || tasas.bs <= 0)) {
                return new Response(
                    JSON.stringify({
                        error: "Configura la tasa BS antes de registrar pagos en bolivares.",
                    }),
                    { status: 400 }
                );
            }

            if (moneda === "COP" && (!Number.isFinite(tasas.cop) || tasas.cop <= 0)) {
                return new Response(
                    JSON.stringify({
                        error: "Configura la tasa COP antes de registrar pagos en pesos.",
                    }),
                    { status: 400 }
                );
            }

            const montoUsd = aUsd(moneda, monto, tasas);
            if (!Number.isFinite(montoUsd) || montoUsd <= 0) {
                return new Response(
                    JSON.stringify({
                        error: `No se pudo convertir el pago en ${moneda} a USD.`,
                    }),
                    { status: 400 }
                );
            }

            pagosNormalizados.push({
                moneda,
                metodo,
                monto,
                montoUsd,
                tasa: moneda === "USD" ? 1 : moneda === "BS" ? tasas.bs : tasas.cop,
            });
        }

        const cubiertoUsd = pagosNormalizados.reduce(
            (acc, pago) => acc + pago.montoUsd,
            0
        );
        const totalRedondeado = Number(montoTotalUsdValor.toFixed(2));
        const cubiertoRedondeado = Number(cubiertoUsd.toFixed(2));

        if (cubiertoRedondeado !== totalRedondeado) {
            return new Response(
                JSON.stringify({
                    error: `La suma de pagos (${cubiertoRedondeado} USD) no coincide con el total (${totalRedondeado} USD).`,
                }),
                { status: 400 }
            );
        }

        let descripcionFinal = String(descripcion || "").trim();

        if (!descripcionFinal) {
            const servicioResponse = await db.execute(
                "SELECT nombre FROM servicios WHERE id = ? LIMIT 1",
                [servicioId]
            );
            descripcionFinal = String(
                servicioResponse.rows?.[0]?.nombre ?? ""
            ).trim();
        }

        if (!descripcionFinal) {
            return new Response(
                JSON.stringify({
                    error: "No se pudo determinar la descripcion de la venta.",
                }),
                { status: 400 }
            );
        }

        const sumar = (moneda) =>
            pagosNormalizados
                .filter((pago) => pago.moneda === moneda)
                .reduce(
                    (acc, pago) => ({
                        raw: acc.raw + pago.monto,
                        usd: acc.usd + pago.montoUsd,
                        metodos: [...acc.metodos, pago.metodo],
                        tasa: pago.tasa,
                    }),
                    { raw: 0, usd: 0, metodos: [], tasa: 0 }
                );

        const pagosUsd = sumar("USD");
        const pagosBs = sumar("BS");
        const pagosCop = sumar("COP");

        const insertVenta = await db.execute(
            `INSERT INTO ventas (
                fecha, descripcion, monto,
                monto_usd, monto_bs, monto_bs_raw, tasa_bs,
                monto_cop, monto_cop_raw, tasa_cop,
                metodo_pago_usd, metodo_pago_bs, metodo_pago_cop,
                empleado_id, servicio_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                fecha,
                descripcionFinal,
                montoTotalUsdValor,
                pagosUsd.usd,
                pagosBs.usd,
                pagosBs.raw,
                pagosBs.raw > 0 ? tasas.bs : 0,
                pagosCop.usd,
                pagosCop.raw,
                pagosCop.raw > 0 ? tasas.cop : 0,
                [...new Set(pagosUsd.metodos)].join(", "),
                [...new Set(pagosBs.metodos)].join(", "),
                [...new Set(pagosCop.metodos)].join(", "),
                empleadoId,
                servicioId,
            ]
        );

        const ventaId = Number(
            insertVenta.lastInsertRowid ??
                (
                    await db.execute(
                        "SELECT id FROM ventas ORDER BY id DESC LIMIT 1"
                    )
                ).rows?.[0]?.id ??
                0
        );

        if (!ventaId) {
            return new Response(
                JSON.stringify({
                    error: "La venta se creo pero no se pudo obtener su ID.",
                }),
                { status: 500 }
            );
        }

        for (const pago of pagosNormalizados) {
            await db.execute(
                `INSERT INTO venta_pagos (
                    venta_id, moneda, monto, monto_usd, metodo_pago, tasa
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    ventaId,
                    pago.moneda,
                    pago.monto,
                    pago.montoUsd,
                    pago.metodo,
                    pago.tasa,
                ]
            );
        }

        return new Response(
            JSON.stringify({
                message: "Venta agregada exitosamente",
                ventaId,
                montoTotalUsd: montoTotalUsdValor,
                pagos: pagosNormalizados,
                tasas,
            }),
            { status: 200 }
        );
    } catch (error) {
        console.error("Error agregando venta:", error);
        return new Response(
            JSON.stringify({ error: "Error interno del servidor" }),
            { status: 500 }
        );
    }
}
