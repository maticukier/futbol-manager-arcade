/**
 * La nota de un jugador en un partido, tipo puntaje de diario.
 *
 * Existe por tres razones, y ninguna es decorativa:
 * - El potencial solo se alcanza si el jugador rinde, y esto es lo que mide
 *   "rendir".
 * - La reputacion sube y baja con los rendimientos.
 * - Es lo que le pone cara al partido cuando termina: sin la nota, un 2 a 1
 *   son dos numeros, y con la nota se sabe quien lo gano.
 *
 * Vive en `sim/` porque es parte de la identidad del jugador, no del render.
 */

export interface EstadisticasJugador {
  goles: number;
  asistencias: number;
  remates: number;
  pases: number;
  pasesCompletados: number;
  /** Pelotas recuperadas: barridas que llegaron y disputas ganadas. */
  quites: number;
  faltas: number;
  amarillas: number;
  rojas: number;
  /** Solo arqueros: remates que termino agarrando o desviando. */
  atajadas: number;
  /** Solo arqueros: goles que le hicieron mientras estaba en la cancha. */
  golesRecibidos: number;
  /** Minutos jugados, para que un suplente no cobre la nota del titular. */
  minutos: number;
}

export function estadisticasVacias(): EstadisticasJugador {
  return {
    goles: 0,
    asistencias: 0,
    remates: 0,
    pases: 0,
    pasesCompletados: 0,
    quites: 0,
    faltas: 0,
    amarillas: 0,
    rojas: 0,
    atajadas: 0,
    golesRecibidos: 0,
    minutos: 0,
  };
}

export interface NotaJugador {
  id: string;
  nombre: string;
  /** Uno a diez, con un decimal. */
  nota: number;
  stats: EstadisticasJugador;
}

/**
 * Calcula la nota. Arranca en un seis, que es el aprobado de cualquier diario,
 * y de ahi se mueve con lo que hizo.
 *
 * El dia que tuvo (`comoLeSalio`, que sale de su forma y de sus rasgos) pesa,
 * pero poco: la nota es sobre todo lo que paso en la cancha, no una tirada
 * escondida. Si no, el usuario deja de confiar en el numero.
 */
export function calcularNota(
  stats: EstadisticasJugador,
  esArquero: boolean,
  comoLeSalio: number,
): number {
  let nota = 6;

  nota += stats.goles * 0.95;
  nota += stats.asistencias * 0.65;
  // Rematar y recuperar suman, pero con techo: el que mete veinte quites no es
  // el doble de bueno que el que mete diez, y si no la nota la termina
  // decidiendo el que mas corre.
  nota += Math.min(stats.remates * 0.1, 0.8);
  nota += Math.min(stats.quites * 0.12, 1.2);

  // La precision de pase solo cuenta si toco la pelota lo suficiente: con un
  // pase, acertarlo no dice nada. El umbral es bajo porque un partido dura
  // noventa minutos de reloj pero tres de juego, y nadie da cien pases.
  if (stats.pases >= 3) {
    nota += (stats.pasesCompletados / stats.pases - 0.7) * 2.6;
  }

  nota -= stats.faltas * 0.12;
  nota -= stats.amarillas * 0.45;
  nota -= stats.rojas * 2.2;

  if (esArquero) {
    nota += stats.atajadas * 0.28;
    nota -= stats.golesRecibidos * 0.5;
  }

  // Su dia, con peso chico a proposito.
  nota += (comoLeSalio - 1) * 3;

  // Arriba de ocho cada decima cuesta el doble. Un diez tiene que ser una
  // hazana que se cuenta, no el premio automatico por hacer dos goles.
  if (nota > 8) nota = 8 + (nota - 8) * 0.5;

  // El que entro faltando diez minutos no puede sacar ni un diez ni un uno.
  if (stats.minutos < 25) {
    const parte = Math.max(0.25, stats.minutos / 25);
    nota = 6 + (nota - 6) * parte;
  }

  return Math.round(Math.max(1, Math.min(10, nota)) * 10) / 10;
}

/** La figura del partido: la nota mas alta, con un minimo de minutos jugados. */
export function figuraDelPartido(notas: readonly NotaJugador[]): NotaJugador | null {
  const elegibles = notas.filter((n) => n.stats.minutos >= 25);
  if (elegibles.length === 0) return null;
  return elegibles.reduce((mejor, actual) => (actual.nota > mejor.nota ? actual : mejor));
}
