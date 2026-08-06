export const ensureReservasColumns = async (db) => {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS reservas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT NOT NULL,
            descripcion TEXT NOT NULL,
            id_cliente INTEGER NOT NULL,
            laser_largo INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (id_cliente) REFERENCES clientes(id)
        )
    `);

    const columns = await db.execute("PRAGMA table_info(reservas)");
    const columnNames = new Set(
        (columns.rows || []).map((row) => String(row.name).toLowerCase())
    );

    if (!columnNames.has("laser_largo")) {
        await db.execute(
            "ALTER TABLE reservas ADD COLUMN laser_largo INTEGER NOT NULL DEFAULT 0"
        );
    }
};

export const normalizarLaserLargo = (valor) => {
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

/** Zonas típicas de depilación láser */
export const ZONAS_LASER = [
    "axilas",
    "axila",
    "piernas",
    "pierna",
    "media pierna",
    "medias piernas",
    "bikini",
    "diseno",
    "diseno de bikini",
    "brasileno",
    "brasilena",
    "cavado",
    "intergluteo",
    "gluteos",
    "gluteo",
    "abdomen",
    "espalda",
    "pecho",
    "rostro",
    "labio",
    "menton",
    "cuello",
    "brazos",
    "brazo",
    "antebrazos",
    "antebrazo",
    "muslos",
    "muslo",
    "entrepierna",
    "bozo",
    "patillas",
    "nuca",
    "hombros",
    "hombros",
    "linea alba",
];

/** Frases que casi siempre indican cita larga */
export const FRASES_LASER_LARGO = [
    "cuerpo completo",
    "cuerpo entero",
    "full body",
    "fullbody",
    "varias zonas",
    "varias partes",
    "muchas zonas",
    "todo el cuerpo",
    "media pierna y",
    "piernas y",
    "axilas y",
    "bikini y",
];

/**
 * Analiza la descripción libre y sugiere si parece láser largo.
 * No modifica la BD: solo propone.
 */
export const sugerirLaserLargo = (descripcion) => {
    const texto = normalizarTexto(descripcion);
    const razones = [];

    if (!texto) {
        return {
            sugerido: false,
            confianza: "baja",
            zonasDetectadas: [],
            razones: ["Sin descripción"],
            pareceLaser: false,
        };
    }

    const pareceLaser =
        /\blaser\b/.test(texto) ||
        /\bdepil/.test(texto) ||
        ZONAS_LASER.some((z) => texto.includes(z));

    const zonasDetectadas = ZONAS_LASER.filter((zona) => texto.includes(zona));
    // Evitar contar singular/plural duplicado burdo
    const zonasUnicas = [];
    zonasDetectadas.forEach((zona) => {
        const base = zona.replace(/s$/, "");
        if (!zonasUnicas.some((z) => z.replace(/s$/, "") === base || z.includes(base) || base.includes(z.replace(/s$/, "")))) {
            zonasUnicas.push(zona);
        }
    });

    let sugerido = false;
    let confianza = "baja";

    for (const frase of FRASES_LASER_LARGO) {
        if (texto.includes(frase)) {
            sugerido = true;
            confianza = "alta";
            razones.push(`Contiene “${frase}”`);
            break;
        }
    }

    // Varias zonas unidas por + / , / y
    const separadores = (texto.match(/\s+y\s+|\s*\+\s*|\s*,\s*/g) || []).length;
    if (!sugerido && zonasUnicas.length >= 2) {
        sugerido = true;
        confianza = zonasUnicas.length >= 3 ? "alta" : "media";
        razones.push(`Detectó ${zonasUnicas.length} zonas: ${zonasUnicas.join(", ")}`);
    } else if (!sugerido && zonasUnicas.length === 1 && separadores >= 1 && pareceLaser) {
        sugerido = true;
        confianza = "media";
        razones.push("Parece combinar más de una zona en el texto");
    } else if (sugerido && zonasUnicas.length) {
        razones.push(`Zonas: ${zonasUnicas.join(", ")}`);
    }

    if (!sugerido && pareceLaser && zonasUnicas.length <= 1) {
        razones.push(
            zonasUnicas.length === 1
                ? `Parece láser de una zona (${zonasUnicas[0]})`
                : "Menciona láser/depilación pero sin varias zonas claras"
        );
    }

    if (!razones.length) {
        razones.push("No se detectaron indicios claros de láser largo");
    }

    return {
        sugerido,
        confianza,
        zonasDetectadas: zonasUnicas,
        razones,
        pareceLaser,
    };
};
