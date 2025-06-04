export async function POST({ request }) {
    try {
        const ACCESS_KEY = "20123358";
        const body = await request.json();
        const { userKey } = body;

        // Validar que los datos no estén vacíos
        if (!userKey) {
            return new Response(JSON.stringify({ error: "La contraseña es obligatoria" }), { status: 400 });
        }

        // Validar clave
        if (userKey === ACCESS_KEY) {
            return new Response(null, {
                status: 302,
                headers: { "Location": "/paquetesMariana" }
            });
        } else {
            return new Response(JSON.stringify({ error: "Clave incorrecta" }), { status: 401 });
        }

    } catch (error) {

        console.error("Error agregando empleado:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });

    }
}