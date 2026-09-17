import type { Atributos, Jugador, PosicionCodigo } from './types';
import { Rng } from './rng';
import { sortearRasgos } from './rasgos';
import {
  APELLIDOS,
  APELLIDOS_EXTRANJEROS,
  LIGAS_EXTRANJERAS,
  NOMBRES,
  NOMBRES_EXTRANJEROS,
} from './nombres';

/** Peso de cada atributo en la media, segun el puesto. */
const PESOS: Record<PosicionCodigo, Atributos> = {
  ARQ: { ritmo: 0.05, regate: 0.05, pase: 0.1, tiro: 0.0, quite: 0.05, fisico: 0.15, arquero: 0.6 },
  DEF: { ritmo: 0.18, regate: 0.1, pase: 0.14, tiro: 0.03, quite: 0.32, fisico: 0.23, arquero: 0.0 },
  MED: { ritmo: 0.14, regate: 0.2, pase: 0.3, tiro: 0.1, quite: 0.14, fisico: 0.12, arquero: 0.0 },
  DEL: { ritmo: 0.24, regate: 0.21, pase: 0.1, tiro: 0.32, quite: 0.03, fisico: 0.1, arquero: 0.0 },
};

/** Sesgo del generador: un delantero nace con mas tiro que quite. */
const SESGO: Record<PosicionCodigo, Partial<Atributos>> = {
  ARQ: { arquero: 18, tiro: -30, quite: -14, regate: -16 },
  DEF: { quite: 12, fisico: 8, tiro: -14, arquero: -40 },
  MED: { pase: 10, regate: 6, arquero: -40 },
  DEL: { tiro: 12, ritmo: 8, quite: -12, arquero: -40 },
};

export function calcularMedia(pos: PosicionCodigo, attrs: Atributos): number {
  const w = PESOS[pos];
  const total =
    attrs.ritmo * w.ritmo +
    attrs.regate * w.regate +
    attrs.pase * w.pase +
    attrs.tiro * w.tiro +
    attrs.quite * w.quite +
    attrs.fisico * w.fisico +
    attrs.arquero * w.arquero;
  return Math.max(1, Math.min(99, Math.round(total)));
}

/**
 * Valor de mercado. La curva es empinada a proposito: un jugador de media 60
 * sale unos 16 millones y uno de 90 pasa los 130, asi que armar un equipo de
 * cracks se siente caro incluso con la caja llena.
 */
export function valorDeMercado(media: number, edad: number, potencial: number): number {
  const base = Math.pow(Math.max(1, media - 30), 3.1) * 420;
  const factorEdad = edad <= 21 ? 1.5 : edad <= 25 ? 1.3 : edad <= 29 ? 1.0 : edad <= 32 ? 0.6 : 0.3;
  const factorPotencial = 1 + Math.max(0, potencial - media) / 60;
  return Math.round((base * factorEdad * factorPotencial) / 1000) * 1000;
}

/**
 * Sueldo semanal. Esta calibrado contra los ingresos del club: la masa salarial
 * de un plantel tiene que comerse casi toda la entrada fija de TV y sponsor,
 * asi que la taquilla es lo que deja margen.
 */
export function salarioSemanal(valor: number, media: number): number {
  return Math.round((valor * 0.018 + media * 4500) / 1000) * 1000;
}

let contadorId = 0;
function nuevoId(prefijo: string): string {
  contadorId += 1;
  return `${prefijo}${contadorId.toString(36)}`;
}

export interface OpcionesJugador {
  pos: PosicionCodigo;
  /** Media objetivo aproximada. */
  nivel: number;
  clubId: string | null;
  edadMin?: number;
  edadMax?: number;
}

export function generarJugador(rng: Rng, opciones: OpcionesJugador): Jugador {
  const { pos, nivel, clubId } = opciones;
  const edad = rng.int(opciones.edadMin ?? 17, opciones.edadMax ?? 35);
  const sesgo = SESGO[pos];

  const gen = (clave: keyof Atributos): number =>
    rng.normal(nivel + (sesgo[clave] ?? 0), 9, 15, 96);

  const attrs: Atributos = {
    ritmo: gen('ritmo'),
    regate: gen('regate'),
    pase: gen('pase'),
    tiro: gen('tiro'),
    quite: gen('quite'),
    fisico: gen('fisico'),
    arquero: gen('arquero'),
  };

  const media = calcularMedia(pos, attrs);
  const margen = edad <= 20 ? rng.int(8, 22) : edad <= 24 ? rng.int(3, 12) : rng.int(0, 4);
  const potencial = Math.min(99, media + margen);
  const valor = valorDeMercado(media, edad, potencial);
  const { rasgos, rasgoOculto } = sortearRasgos(rng, pos, attrs, media);

  return {
    id: nuevoId('j'),
    nombre: `${rng.pick(NOMBRES)} ${rng.pick(APELLIDOS)}`,
    edad,
    pos,
    attrs,
    media,
    potencial,
    moral: rng.int(55, 80),
    forma: rng.int(80, 100),
    lesionSemanas: 0,
    salario: salarioSemanal(valor, media),
    valor,
    clubId,
    contratoSemanas: rng.int(40, 160),
    golesTemporada: 0,
    asistenciasTemporada: 0,
    partidosTemporada: 0,
    amarillasTemporada: 0,
    notaSumada: 0,
    sancionPartidos: 0,
    progreso: 0,
    rasgos,
    rasgoOculto,
    partidosObservado: 0,
    historial: [],
  };
}

/** Jugador del mercado internacional: sin club, con la liga de la que viene. */
export function generarExtranjero(rng: Rng, indiceLiga?: number): Jugador {
  const liga = indiceLiga === undefined ? rng.pick(LIGAS_EXTRANJERAS) : LIGAS_EXTRANJERAS[indiceLiga];
  const puestos: PosicionCodigo[] = ['ARQ', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'DEL', 'DEL'];

  const jugador = generarJugador(rng, {
    pos: rng.pick(puestos),
    nivel: Math.max(28, Math.min(92, liga.nivel * 0.72 + rng.float(-9, 11))),
    clubId: null,
    edadMin: 18,
    edadMax: 33,
  });

  jugador.nombre = `${rng.pick(NOMBRES_EXTRANJEROS)} ${rng.pick(APELLIDOS_EXTRANJEROS)}`;
  jugador.ligaOrigen = liga.nombre;
  jugador.contratoSemanas = 0;
  return jugador;
}

/** Peso de cada atributo al repartir una mejora o una caida, segun el puesto. */
export function atributoAfectado(rng: Rng, pos: PosicionCodigo): keyof Atributos {
  const pesos = PESOS[pos];
  const claves = Object.keys(pesos) as (keyof Atributos)[];
  const total = claves.reduce((suma, clave) => suma + pesos[clave] + 0.05, 0);

  let tirada = rng.float(0, total);
  for (const clave of claves) {
    tirada -= pesos[clave] + 0.05;
    if (tirada <= 0) return clave;
  }
  return 'fisico';
}

/** Composicion de un plantel completo: arqueros, defensores, mediocampistas, delanteros. */
const COMPOSICION: PosicionCodigo[] = [
  'ARQ', 'ARQ', 'ARQ',
  'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF',
  'MED', 'MED', 'MED', 'MED', 'MED', 'MED', 'MED',
  'DEL', 'DEL', 'DEL', 'DEL', 'DEL',
];

/** El nivel del plantel sale de la reputacion del club, con dispersion interna. */
export function generarPlantel(rng: Rng, clubId: string, reputacion: number): Jugador[] {
  const nivelBase = 38 + reputacion * 0.42;
  return COMPOSICION.map((pos, i) => {
    // Los primeros de cada linea son los titulares: un poco mejores.
    const variacion = rng.float(-7, 7) + (i % 4 === 0 ? 4 : 0);
    return generarJugador(rng, {
      pos,
      nivel: Math.max(25, Math.min(90, nivelBase + variacion)),
      clubId,
      edadMin: 17,
      edadMax: 35,
    });
  });
}
