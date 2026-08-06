import { createClient } from "@libsql/client";
import { ensureValesTable } from "../../../lib/ventas-schema.js";

export async function POST({ request }) {
    try {
        const { id } = await request.json();
        const valeId = Number(id);

        if (!valeId) {
            return new Response(
                JSON.stringify({ error: "ID de vale inválido." }),
                { status: 400 }
            );
        }

        const db = createClient({
            url: import.meta.env.DATABASE_URL,
            authToken: import.meta.env.DATABASE_AUTH_TOKEN,
        });

        await ensureValesTable(db);
        await db.execute("DELETE FROM vales WHERE id = ?", [valeId]);

        return new Response(
            JSON.stringify({ message: "Vale eliminado." }),
            { status: 200 }
        );
    } catch (error) {
        console.error("Error eliminando vale:", error);
        return new Response(
            JSON.stringify({ error: "Error interno del servidor" }),
            { status: 500 }
        );
    }
}
