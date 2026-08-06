export const ensurePaquetesColumns = async (db) => {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS paquetes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descripcion TEXT NOT NULL,
            numero_sesiones INTEGER NOT NULL,
            monto_total REAL NOT NULL,
            fecha_compra TEXT NOT NULL,
            cliente_id INTEGER NOT NULL,
            laser_grande INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        )
    `);

    const columns = await db.execute("PRAGMA table_info(paquetes)");
    const columnNames = new Set(
        (columns.rows || []).map((row) => String(row.name).toLowerCase())
    );

    if (!columnNames.has("laser_grande")) {
        await db.execute(
            "ALTER TABLE paquetes ADD COLUMN laser_grande INTEGER NOT NULL DEFAULT 0"
        );
    }
};

export const normalizarLaserGrande = (valor) => {
    if (valor === true || valor === 1 || valor === "1" || valor === "true") {
        return 1;
    }
    return 0;
};

const normalizarTexto = (texto) =>
    String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s+/,.-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const ZONAS = [
    "axilas",
    "axila",
    "piernas",
    "pierna",
    "bikini",
    "brasileno",
    "brasilena",
    "gluteos",
    "abdomen",
    "espalda",
    "pecho",
    "rostro",
    "brazos",
    "brazo",
    "antebrazos",
    "muslos",
    "bozo",
    "menton",
    "cuello",
    "nuca",
    "hombros",
];

const FRASES_GRANDE = [
    "cuerpo completo",
    "cuerpo entero",
    "full body",
    "fullbody",
    "varias zonas",
    "varias partes",
    "todo el cuerpo",
    "media pierna",
    "piernas y",
    "axilas y",
    "bikini y",
];

/** Sugiere si un paquete (por su descripción) parece láser de varias zonas */
export const sugerirPaqueteLaserGrande = (descripcion, numeroSesiones = 0) => {
    const texto = normalizarTexto(descripcion);
    const razones = [];

    if (!texto) {
        return { sugerido: false, razones: ["Sin descripción"] };
    }

    const pareceLaser = /\blaser\b/.test(texto) || /\bdepil/.test(texto);
    const zonas = ZONAS.filter((z) => texto.includes(z));
    const zonasUnicas = [...new Set(zonas.map((z) => z.replace(/s$/, "")))];

    for (const frase of FRASES_GRANDE) {
        if (texto.includes(frase)) {
            return {
                sugerido: true,
                razones: [`Descripción del paquete: “${frase}”`],
            };
        }
    }

    if (zonasUnicas.length >= 2) {
        return {
            sugerido: true,
            razones: [`Paquete con varias zonas: ${zonasUnicas.join(", ")}`],
        };
    }

    // Paquetes muy grandes de sesiones suelen ser tratamientos extensos
    if (pareceLaser && Number(numeroSesiones) >= 8) {
        return {
            sugerido: true,
            razones: [`Paquete láser con ${numeroSesiones} sesiones`],
        };
    }

    if (pareceLaser) {
        razones.push("Paquete de láser de zona puntual / no marcado como grande");
    }

    return { sugerido: false, razones };
};

/**
 * Un paquete cuenta como "láser grande" si está marcado o la descripción lo sugiere.
 */
export const esPaqueteLaserGrande = (paquete) => {
    if (Number(paquete.laser_grande) === 1) return true;
    return sugerirPaqueteLaserGrande(
        paquete.descripcion,
        paquete.numero_sesiones
    ).sugerido;
};
