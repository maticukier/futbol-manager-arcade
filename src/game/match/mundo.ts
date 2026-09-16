/**
 * Medidas del partido, en metros. Se usan tanto en el motor como en el render 3D,
 * asi que hay una sola fuente de verdad para la geometria de la cancha.
 *
 * Ejes: X va de arco a arco (el usuario ataca hacia +X), Z cruza la cancha de
 * lateral a lateral, Y es la altura. El origen esta en el punto central.
 */

export const LARGO = 105;
export const ANCHO = 68;

export const ARCO_ANCHO = 7.32;
export const ARCO_ALTO = 2.44;
export const ARCO_PROFUNDIDAD = 2;

export const AREA_LARGO = 16.5;
export const AREA_ANCHO = 40.3;
export const AREA_CHICA_LARGO = 5.5;
export const AREA_CHICA_ANCHO = 18.32;
export const PENAL_DISTANCIA = 11;
export const CIRCULO_CENTRAL = 9.15;

export const RADIO_JUGADOR = 0.55;
export const ALTURA_JUGADOR = 1.8;
export const RADIO_PELOTA = 0.12;

export const GRAVEDAD = 9.81;
/** Cuanto conserva la pelota al picar contra el cesped. */
export const REBOTE = 0.55;
/** Rozamiento por segundo de la pelota rodando. */
export const ROCE_PISO = 0.55;
/** Rozamiento del aire, mucho menor. */
export const ROCE_AIRE = 0.05;

/** Duracion real de cada tiempo, en segundos. */
export const SEGUNDOS_POR_TIEMPO = 90;
export const MINUTOS_POR_TIEMPO = 45;

/** Velocidad de carrera: de 4 m/s con ritmo 0 a 8,4 m/s con ritmo 100. */
export const VELOCIDAD_MIN = 4;
export const VELOCIDAD_MAX = 8.4;

/**
 * Aceleracion en metros por segundo al cuadrado. Son tres valores distintos a
 * proposito: arrancar cuesta, frenar es rapido y girar en velocidad es lento.
 * De ahi sale que un jugador tenga peso y no cambie de direccion como un raton.
 */
export const ACELERACION = 9;
export const FRENADO = 15;
export const GIRO = 5.5;

/** A que altura llega un jugador de campo y un arquero para tocar la pelota. */
export const ALCANCE_ALTO = 2.2;
export const ALCANCE_ALTO_ARQUERO = 2.6;

export const X_ARCO_DERECHO = LARGO / 2;
export const X_ARCO_IZQUIERDO = -LARGO / 2;

export function dentroDelArco(z: number): boolean {
  return Math.abs(z) < ARCO_ANCHO / 2;
}

export function limitar(valor: number, min: number, max: number): number {
  return valor < min ? min : valor > max ? max : valor;
}

export function distancia2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
