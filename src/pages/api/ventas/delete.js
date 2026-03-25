export async function DELETE() {
    return new Response(
        JSON.stringify({ error: "La eliminacion de ventas esta deshabilitada por seguridad" }),
        { status: 403 }
    );
}