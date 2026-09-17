import type { Jugador } from './types';
import type { Rng } from './rng';

/**
 * La carrera de un jugador, temporada por temporada.
 *
 * Existe porque los datos que no se registran no se pueden reconstruir
 * despues. Sin esto, al cerrar cada temporada los goles, los partidos y las
 * notas se ponian en cero y no quedaba nada: un pibe que subio de 48 a 61 en
 * dos anos se veia igual que uno que siempre estuvo en 61.
 *
 * De aca van a leer el potencial alcanzable (que depende de minutos y
 * rendimiento) y la reputacion (que sube y baja con los rendimientos). Y es lo
 * que permite decir "ese es Peralta, subio de la cantera a los 17".
 */
export interface TemporadaJugador {
  temporada: number;
  /** Donde la jugo. Null si estuvo libre. */
  clubId: string | null;
  division: number;
  /** La edad con la que la jugo, no la de ahora. */
  edad: number;
  partidos: number;
  goles: number;
  asistencias: number;
  /** Promedio de sus notas del ano, con un decimal. */
  nota: number;
  /** Con que media cerro la temporada. */
  media: number;
}

/**
 * Cierra el ano de un jugador y lo guarda en su carrera.
 *
 * Se llama antes de poner los contadores en cero y antes de sumarle el ano,
 * porque la fila tiene que decir con que edad jugo esa temporada.
 */
export function cerrarTemporadaDeJugador(
  j: Jugador,
  temporada: number,
  division: number,
): void {
  // El que no jugo un solo partido no deja fila: una carrera llena de ceros no
  // cuenta una historia, la tapa.
  if (j.partidosTemporada === 0) return;

  // Y una temporada se guarda una sola vez. Si al usuario lo echan, el cierre
  // de temporada no reinicia los contadores, asi que sin esto la misma
  // temporada podria entrar dos veces.
  if (j.historial.some((t) => t.temporada === temporada)) return;

  j.historial.push({
    temporada,
    clubId: j.clubId,
    division,
    edad: j.edad,
    partidos: j.partidosTemporada,
    goles: j.golesTemporada,
    asistencias: j.asistenciasTemporada,
    nota: Math.round((j.notaSumada / j.partidosTemporada) * 10) / 10,
    media: j.media,
  });
}

/** Lo que lleva hecho en toda su carrera, contando lo que va del ano. */
export interface Carrera {
  temporadas: number;
  partidos: number;
  goles: number;
  asistencias: number;
  /** Promedio de sus notas, ponderado por partidos jugados. */
  nota: number;
  /** Su mejor ano, por nota. Null si todavia no cerro ninguno. */
  mejor: TemporadaJugador | null;
  /** Cuantos clubes distintos lo tuvieron. */
  clubes: number;
}

export function carreraDe(j: Jugador): Carrera {
  let partidos = j.partidosTemporada;
  let goles = j.golesTemporada;
  let asistencias = j.asistenciasTemporada;
  let notaPorPartido = j.notaSumada;
  let mejor: TemporadaJugador | null = null;
  const clubes = new Set<string>();

  if (j.clubId) clubes.add(j.clubId);

  for (const t of j.historial) {
    partidos += t.partidos;
    goles += t.goles;
    asistencias += t.asistencias;
    notaPorPartido += t.nota * t.partidos;
    if (t.clubId) clubes.add(t.clubId);
    if (!mejor || t.nota > mejor.nota) mejor = t;
  }

  return {
    temporadas: j.historial.length,
    partidos,
    goles,
    asistencias,
    nota: partidos > 0 ? Math.round((notaPorPartido / partidos) * 10) / 10 : 0,
    mejor,
    clubes: clubes.size,
  };
}

/**
 * La nota de un jugador en un partido que no se jugo en 3D, sino que se
 * simulo.
 *
 * La mayoria de los partidos de una carrera son simulados, asi que si estos no
 * dieran nota, la historia de un jugador tendria un agujero del noventa por
 * ciento. Se arma con lo mismo que mira cualquiera al leer una cronica: como
 * salio el equipo, si convirtio, si lo amonestaron, y su estado de forma.
 */
export function notaSimulada(
  j: Jugador,
  opciones: { goles: number; asistencias: number; amarilla: boolean; roja: boolean; diferencia: number },
  rng: Rng,
): number {
  let nota = 6;

  nota += opciones.goles * 0.95;
  nota += opciones.asistencias * 0.65;

  // Al equipo le fue bien o mal, y eso arrastra a todos un poco.
  nota += Math.max(-0.7, Math.min(0.7, opciones.diferencia * 0.22));

  if (opciones.amarilla) nota -= 0.45;
  if (opciones.roja) nota -= 2.2;

  // Su nivel y su forma inclinan la cancha, pero no la deciden.
  //
  // Los dos numeros estan centrados en lo que de verdad tiene un titular a mitad
  // de temporada, no en lo que tiene el dia que arranca: la media de un titular
  // ronda 66 y la forma se le cae a 45 de tanto jugar. Centrarlos mal hacia que
  // la nota simulada promediara 5.3 contra 6.2 del partido jugado, y una
  // carrera que mezcla dos escalas distintas no dice nada.
  nota += (j.media - 66) / 45;
  nota += (j.forma - 55) / 120;

  // El trabajo comun del partido. En el partido jugado un titular suma decimas
  // por los pases que completa y las pelotas que recupera; en el simulado eso
  // no existe porque no se simula, asi que hay que reconocerlo igual. Sin este
  // termino el mismo partido vale medio punto menos por haberlo simulado, y una
  // carrera que mezcla las dos escalas no dice nada. Medido: 5,7 contra 6,2.
  nota += 0.45;

  // Y el dia, que es lo que hace que un partido no sea igual al anterior.
  nota += rng.float(-0.8, 0.8);

  if (nota > 8) nota = 8 + (nota - 8) * 0.5;
  return Math.round(Math.max(1, Math.min(10, nota)) * 10) / 10;
}

/**
 * Reparte asistencias entre los companeros del que convirtio.
 *
 * En un partido simulado no hay pases que mirar, asi que se elige a quien
 * pudo haberla dado: pesa el pase y no todos los goles tienen asistencia,
 * igual que en la cancha.
 */
export function elegirAsistentes(
  plantel: Jugador[],
  goleadores: readonly string[],
  rng: Rng,
): string[] {
  const asistentes: string[] = [];

  for (const goleadorId of goleadores) {
    if (!rng.chance(0.62)) continue;
    const candidatos = plantel.filter((j) => j.id !== goleadorId && j.pos !== 'ARQ');
    if (candidatos.length === 0) continue;

    const total = candidatos.reduce((suma, c) => suma + c.attrs.pase, 0);
    let tirada = rng.float(0, total);
    for (const c of candidatos) {
      tirada -= c.attrs.pase;
      if (tirada <= 0) {
        asistentes.push(c.id);
        break;
      }
    }
  }
  return asistentes;
}
