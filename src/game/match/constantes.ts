/** Medidas del mundo del partido, en unidades de cancha (no pixeles de pantalla). */
export const ANCHO_CANCHA = 700;
export const ALTO_CANCHA = 1050;
export const MARGEN = 40;

export const ANCHO_ARCO = 160;
export const PROFUNDIDAD_ARCO = 34;

export const RADIO_JUGADOR = 15;
export const RADIO_PELOTA = 8;

/** Area grande, usada para el arquero y para decidir tiros. */
export const ANCHO_AREA = 400;
export const ALTO_AREA = 150;

/** Duracion real de cada tiempo, en segundos. 75 s = 45 minutos de juego. */
export const SEGUNDOS_POR_TIEMPO = 75;
export const MINUTOS_POR_TIEMPO = 45;

export const VELOCIDAD_BASE = 150;
export const FRICCION_PELOTA = 0.985;
export const VELOCIDAD_MAX_PELOTA = 900;

/** El usuario siempre ataca hacia arriba: arco rival en y = 0. */
export const Y_ARCO_RIVAL = 0;
export const Y_ARCO_PROPIO = ALTO_CANCHA;

export const COLOR_CESPED = 0x1f7a3d;
export const COLOR_CESPED_CLARO = 0x24894a;
export const COLOR_LINEA = 0xdff3e4;
