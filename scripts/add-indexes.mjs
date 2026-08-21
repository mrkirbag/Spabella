import "dotenv/config";
import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const indexes = [
  "CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha)",
  "CREATE INDEX IF NOT EXISTS idx_venta_pagos_venta_id ON venta_pagos(venta_id)",
  "CREATE INDEX IF NOT EXISTS idx_vales_fecha ON vales(fecha)",
  "CREATE INDEX IF NOT EXISTS idx_vales_empleado ON vales(empleado_id)",
  "CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON reservas(fecha)",
  "CREATE INDEX IF NOT EXISTS idx_reservas_cliente ON reservas(id_cliente)",
  "CREATE INDEX IF NOT EXISTS idx_paquetes_cliente ON paquetes(cliente_id)",
  "CREATE INDEX IF NOT EXISTS idx_sesiones_paquete ON sesiones(paquete_id, numero_sesion)",
];

for (const sql of indexes) {
  await db.execute(sql);
  console.log(`OK: ${sql}`);
}

console.log("Índices listos.");
