import type { Club, Copa, EstadoJuego, Jugador, Partido } from './types';
import { Rng, seedAleatoria } from './rng';
import { CLUBES_SEGUNDA } from './nombres';
import { crearClub } from './clubes';
import { generarPlantel } from './jugadores';
import { sortearRasgos } from './rasgos';
import { generarFixture, onceAutomatico } from './liga';
import { copaVacia, sortearCopa } from './copa';
import { ENTRENAMIENTO_POR_DEFECTO, TACTICAS_POR_DEFECTO } from './tacticas';

/**
 * Version del formato de guardado. Sube solo cuando hace falta una migracion
 * que no se resuelve con un valor por defecto.
 */
export const VERSION_PARTIDA = 4;

/**
 * Lleva una partida guardada al formato actual.
 *
 * La regla es no tirar la carrera del jugador salvo que el guardado este
 * realmente roto: todo campo que falte se completa con un valor razonable, y
 * los cambios grandes (como la aparicion de la segunda division) tienen su
 * paso propio.
 */
export function migrar(datos: unknown): EstadoJuego | null {
  if (!esObjeto(datos)) return null;

  const estado = datos as Partial<EstadoJuego> & Record<string, unknown>;
  if (!Array.isArray(estado.clubs) || !Array.isArray(estado.jugadores)) return null;
  if (!Array.isArray(estado.fixture) || typeof estado.clubUsuarioId !== 'string') return null;
  if (!estado.clubs.some((c: Club) => c?.id === estado.clubUsuarioId)) return null;

  const rng = new Rng(typeof estado.seed === 'number' ? estado.seed : seedAleatoria());

  const version = typeof estado.version === 'number' ? estado.version : 1;
  // Las partidas de la version 2 que se guardaron despues de sumar divisiones
  // ya traen el campo, asi que miro el dato y no el numero de version.
  if (version < 3 || !tieneSegundaDivision(estado as EstadoJuego)) {
    agregarSegundaDivision(estado as EstadoJuego, rng);
  }

  normalizar(estado as EstadoJuego, rng);
  (estado as EstadoJuego).version = VERSION_PARTIDA;
  return estado as EstadoJuego;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

function tieneSegundaDivision(estado: EstadoJuego): boolean {
  return estado.clubs.some((c) => c.division === 2);
}

/**
 * Las partidas viejas tenian una sola liga de doce equipos. Les agrego la
 * segunda division completa, con planteles y su propio fixture, y dejo al
 * resto en primera.
 */
function agregarSegundaDivision(estado: EstadoJuego, rng: Rng): void {
  for (const club of estado.clubs) club.division = 1;
  for (const partido of estado.fixture) partido.division = 1;

  const base = estado.clubs.length;
  const nuevos = CLUBES_SEGUNDA.map((plantilla, i) => crearClub(plantilla, `c${base + i}`, 2, rng));

  for (const club of nuevos) {
    const plantel = generarPlantel(rng, club.id, club.reputacion);
    estado.jugadores.push(...plantel);
    club.titulares = onceAutomatico(club, plantel).map((j) => j.id);
  }
  estado.clubs.push(...nuevos);

  // El fixture de segunda arranca desde la jornada en la que quedo la partida.
  estado.fixture.push(...generarFixture(nuevos.map((c) => c.id), rng, 2));
  for (const partido of estado.fixture) {
    if (partido.division !== 2) continue;
    if (partido.jornada < (estado.jornadaActual ?? 1)) partido.jugado = true;
    if (partido.jugado && partido.golesLocal === null) {
      partido.golesLocal = rng.int(0, 3);
      partido.golesVisitante = rng.int(0, 3);
    }
  }
}

/** Completa todo lo que pueda faltar. Es la red que evita futuras migraciones. */
function normalizar(estado: EstadoJuego, rng: Rng): void {
  estado.seed ??= seedAleatoria();
  estado.temporada ??= 1;
  estado.semana ??= 1;
  estado.jornadaActual ??= 1;
  estado.bandeja ??= [];
  estado.finanzas ??= [];
  estado.historial ??= [];
  estado.despedido ??= false;
  estado.mercadoExtranjero ??= [];

  if (!estado.directorio) {
    estado.directorio = { expectativaPosicion: 6, confianza: 60, presupuestoFichajes: 0 };
  }

  for (const club of estado.clubs) {
    club.division ??= 1;
    club.tacticas ??= { ...TACTICAS_POR_DEFECTO };
    club.entrenamiento ??= { ...ENTRENAMIENTO_POR_DEFECTO };
    club.titulares ??= [];
    club.cantera ??= 1;
  }

  for (const jugador of estado.jugadores) {
    completarJugador(jugador, rng);
  }

  for (const partido of estado.fixture) {
    partido.division ??= 1;
    partido.arcade ??= false;
  }

  estado.copa = migrarCopa(estado, rng);
}

function completarJugador(j: Jugador, rng: Rng): void {
  // Los rasgos aparecieron despues, asi que a los jugadores de una carrera ya
  // empezada se les sortean ahora. No se pierde la carrera por esto: el
  // jugador es el mismo, solo que ahora se le nota algo propio.
  if (!Array.isArray(j.rasgos) || j.rasgoOculto === undefined) {
    const sorteo = sortearRasgos(rng, j.pos, j.attrs, j.media);
    j.rasgos = Array.isArray(j.rasgos) ? j.rasgos : sorteo.rasgos;
    j.rasgoOculto = j.rasgoOculto ?? sorteo.rasgoOculto;
  }
  j.partidosObservado ??= 0;
  j.progreso ??= 0;
  j.amarillasTemporada ??= 0;
  j.sancionPartidos ??= 0;
  j.golesTemporada ??= 0;
  j.partidosTemporada ??= 0;
  j.lesionSemanas ??= 0;
  j.contratoSemanas ??= 100;
  j.moral ??= 65;
  j.forma ??= 90;
}

/** Si la copa no existia o quedo inconsistente, se sortea de nuevo. */
function migrarCopa(estado: EstadoJuego, rng: Rng): Copa {
  const copa = estado.copa as Copa | undefined;
  const sirve =
    copa &&
    Array.isArray(copa.llaves) &&
    Array.isArray(copa.vivos) &&
    copa.vivos.every((id) => estado.clubs.some((c) => c.id === id));

  if (sirve) return copa;

  estado.copa = copaVacia();
  sortearCopa(estado, rng);
  return estado.copa;
}

/** Comprueba que un fixture cubra a todos los clubes de su division. */
export function fixtureCompleto(clubs: Club[], fixture: Partido[], division: 1 | 2): boolean {
  const equipos = clubs.filter((c) => c.division === division).map((c) => c.id);
  if (equipos.length < 2) return false;
  const jugados = new Map(equipos.map((id) => [id, 0]));

  for (const p of fixture) {
    if (p.division !== division) continue;
    jugados.set(p.localId, (jugados.get(p.localId) ?? 0) + 1);
    jugados.set(p.visitanteId, (jugados.get(p.visitanteId) ?? 0) + 1);
  }

  const esperados = (equipos.length - 1) * 2;
  return [...jugados.values()].every((n) => n === esperados);
}
