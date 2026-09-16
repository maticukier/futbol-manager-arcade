import type { Atributos, Entrenamiento, Formacion, PosicionCodigo, Tacticas } from './types';

/**
 * Posicion base de cada puesto en la cancha, normalizada.
 * x: 0 (banda izquierda) a 1 (banda derecha).
 * y: 0 (arco propio) a 1 (arco rival).
 * El motor del partido usa esto para colocar a los 11 y para que vuelvan
 * a su sitio cuando no tienen la pelota.
 */
export interface Ranura {
  pos: PosicionCodigo;
  x: number;
  y: number;
  /** Etiqueta corta para la UI: LI, DFC, MC, EI, DC... */
  rol: string;
}

export const FORMACIONES: Record<Formacion, Ranura[]> = {
  '4-4-2': [
    { pos: 'ARQ', x: 0.5, y: 0.04, rol: 'ARQ' },
    { pos: 'DEF', x: 0.15, y: 0.22, rol: 'LI' },
    { pos: 'DEF', x: 0.38, y: 0.18, rol: 'DFC' },
    { pos: 'DEF', x: 0.62, y: 0.18, rol: 'DFC' },
    { pos: 'DEF', x: 0.85, y: 0.22, rol: 'LD' },
    { pos: 'MED', x: 0.14, y: 0.48, rol: 'MI' },
    { pos: 'MED', x: 0.38, y: 0.44, rol: 'MC' },
    { pos: 'MED', x: 0.62, y: 0.44, rol: 'MC' },
    { pos: 'MED', x: 0.86, y: 0.48, rol: 'MD' },
    { pos: 'DEL', x: 0.38, y: 0.74, rol: 'DC' },
    { pos: 'DEL', x: 0.62, y: 0.74, rol: 'DC' },
  ],
  '4-3-3': [
    { pos: 'ARQ', x: 0.5, y: 0.04, rol: 'ARQ' },
    { pos: 'DEF', x: 0.15, y: 0.24, rol: 'LI' },
    { pos: 'DEF', x: 0.38, y: 0.18, rol: 'DFC' },
    { pos: 'DEF', x: 0.62, y: 0.18, rol: 'DFC' },
    { pos: 'DEF', x: 0.85, y: 0.24, rol: 'LD' },
    { pos: 'MED', x: 0.5, y: 0.36, rol: 'MCD' },
    { pos: 'MED', x: 0.3, y: 0.5, rol: 'MC' },
    { pos: 'MED', x: 0.7, y: 0.5, rol: 'MC' },
    { pos: 'DEL', x: 0.14, y: 0.72, rol: 'EI' },
    { pos: 'DEL', x: 0.5, y: 0.78, rol: 'DC' },
    { pos: 'DEL', x: 0.86, y: 0.72, rol: 'ED' },
  ],
  '3-5-2': [
    { pos: 'ARQ', x: 0.5, y: 0.04, rol: 'ARQ' },
    { pos: 'DEF', x: 0.28, y: 0.18, rol: 'DFC' },
    { pos: 'DEF', x: 0.5, y: 0.15, rol: 'DFC' },
    { pos: 'DEF', x: 0.72, y: 0.18, rol: 'DFC' },
    { pos: 'MED', x: 0.1, y: 0.5, rol: 'CI' },
    { pos: 'MED', x: 0.35, y: 0.4, rol: 'MC' },
    { pos: 'MED', x: 0.5, y: 0.52, rol: 'MCO' },
    { pos: 'MED', x: 0.65, y: 0.4, rol: 'MC' },
    { pos: 'MED', x: 0.9, y: 0.5, rol: 'CD' },
    { pos: 'DEL', x: 0.38, y: 0.76, rol: 'DC' },
    { pos: 'DEL', x: 0.62, y: 0.76, rol: 'DC' },
  ],
  '5-3-2': [
    { pos: 'ARQ', x: 0.5, y: 0.04, rol: 'ARQ' },
    { pos: 'DEF', x: 0.1, y: 0.26, rol: 'LI' },
    { pos: 'DEF', x: 0.3, y: 0.15, rol: 'DFC' },
    { pos: 'DEF', x: 0.5, y: 0.12, rol: 'DFC' },
    { pos: 'DEF', x: 0.7, y: 0.15, rol: 'DFC' },
    { pos: 'DEF', x: 0.9, y: 0.26, rol: 'LD' },
    { pos: 'MED', x: 0.3, y: 0.44, rol: 'MC' },
    { pos: 'MED', x: 0.5, y: 0.4, rol: 'MC' },
    { pos: 'MED', x: 0.7, y: 0.44, rol: 'MC' },
    { pos: 'DEL', x: 0.38, y: 0.72, rol: 'DC' },
    { pos: 'DEL', x: 0.62, y: 0.72, rol: 'DC' },
  ],
  '4-2-3-1': [
    { pos: 'ARQ', x: 0.5, y: 0.04, rol: 'ARQ' },
    { pos: 'DEF', x: 0.15, y: 0.24, rol: 'LI' },
    { pos: 'DEF', x: 0.38, y: 0.18, rol: 'DFC' },
    { pos: 'DEF', x: 0.62, y: 0.18, rol: 'DFC' },
    { pos: 'DEF', x: 0.85, y: 0.24, rol: 'LD' },
    { pos: 'MED', x: 0.38, y: 0.36, rol: 'MCD' },
    { pos: 'MED', x: 0.62, y: 0.36, rol: 'MCD' },
    { pos: 'MED', x: 0.16, y: 0.6, rol: 'EI' },
    { pos: 'MED', x: 0.5, y: 0.58, rol: 'MCO' },
    { pos: 'MED', x: 0.84, y: 0.6, rol: 'ED' },
    { pos: 'DEL', x: 0.5, y: 0.8, rol: 'DC' },
  ],
};

export const TACTICAS_POR_DEFECTO: Tacticas = {
  formacion: '4-4-2',
  presion: 50,
  lineaDefensiva: 50,
  ritmo: 50,
  mentalidad: 50,
};

/** Cuantos jugadores de cada puesto pide una formacion. */
export function necesidades(formacion: Formacion): Record<PosicionCodigo, number> {
  const conteo: Record<PosicionCodigo, number> = { ARQ: 0, DEF: 0, MED: 0, DEL: 0 };
  for (const r of FORMACIONES[formacion]) conteo[r.pos] += 1;
  return conteo;
}

/**
 * Penalizacion por jugar fuera de puesto: un defensor de 9 rinde peor.
 * Devuelve un multiplicador sobre la media.
 */
export function ajustePorPuesto(natural: PosicionCodigo, usado: PosicionCodigo): number {
  if (natural === usado) return 1;
  if (natural === 'ARQ' || usado === 'ARQ') return 0.55;
  const orden: PosicionCodigo[] = ['DEF', 'MED', 'DEL'];
  const distancia = Math.abs(orden.indexOf(natural) - orden.indexOf(usado));
  return distancia === 1 ? 0.9 : 0.78;
}


export const ENTRENAMIENTO_POR_DEFECTO: Entrenamiento = { fisico: 34, tecnica: 33, tactica: 33 };

/**
 * A que atributos empuja cada foco del entrenamiento. La suma de pesos de
 * cada bloque es lo que define cuanto tira para ese lado.
 */
export const FOCOS: Record<keyof Entrenamiento, (keyof Atributos)[]> = {
  fisico: ['ritmo', 'fisico'],
  tecnica: ['regate', 'pase', 'tiro'],
  tactica: ['quite', 'arquero'],
};
