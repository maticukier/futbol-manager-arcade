import { describe, expect, it } from 'vitest';
import { nuevaPartida, resolverJornada } from '@/sim/juego';
import { VERSION_PARTIDA, fixtureCompleto, migrar } from '@/sim/migraciones';
import { totalJornadas } from '@/sim/liga';
import type { EstadoJuego } from '@/sim/types';

/** Copia profunda, para no tocar el estado original al armar los casos. */
function copiar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

/** Borra campos de un objeto tipado, como si viniera de un guardado viejo. */
function quitar(objeto: unknown, ...claves: string[]): void {
  const suelto = objeto as Record<string, unknown>;
  for (const clave of claves) delete suelto[clave];
}

/**
 * Reconstruye como era un guardado de la version 2: una sola liga de doce
 * equipos, sin copa, sin entrenamiento y sin los campos nuevos del jugador.
 */
function guardadoViejo(): Record<string, unknown> {
  const estado = copiar(nuevaPartida(4, 4321)) as EstadoJuego & Record<string, unknown>;

  const primera = estado.clubs.filter((c) => c.division === 1).map((c) => c.id);
  estado.clubs = estado.clubs.filter((c) => primera.includes(c.id));
  estado.jugadores = estado.jugadores.filter((j) => j.clubId === null || primera.includes(j.clubId));
  estado.fixture = estado.fixture.filter((p) => p.division === 1);

  quitar(estado, 'copa');
  for (const club of estado.clubs) quitar(club, 'division', 'entrenamiento');
  for (const partido of estado.fixture) quitar(partido, 'division');
  for (const jugador of estado.jugadores) quitar(jugador, 'progreso', 'amarillasTemporada', 'sancionPartidos');
  estado.version = 2;
  return estado as unknown as Record<string, unknown>;
}

describe('migracion de guardados', () => {
  it('rechaza lo que no es una partida', () => {
    expect(migrar(null)).toBeNull();
    expect(migrar('hola')).toBeNull();
    expect(migrar({})).toBeNull();
    expect(migrar({ clubs: [], jugadores: [], fixture: [], clubUsuarioId: 'c0' })).toBeNull();
  });

  it('deja intacta una partida del formato actual', () => {
    const original = nuevaPartida(4, 10);
    const migrada = migrar(copiar(original))!;

    expect(migrada).not.toBeNull();
    expect(migrada.version).toBe(VERSION_PARTIDA);
    expect(migrada.clubs).toHaveLength(original.clubs.length);
    expect(migrada.jugadores).toHaveLength(original.jugadores.length);
    expect(migrada.clubUsuarioId).toBe(original.clubUsuarioId);
    expect(migrada.copa.llaves).toHaveLength(original.copa.llaves.length);
  });

  it('a una partida vieja le agrega la segunda division y la copa', () => {
    const viejo = guardadoViejo();
    const migrada = migrar(viejo)!;

    expect(migrada).not.toBeNull();
    expect(migrada.version).toBe(VERSION_PARTIDA);
    expect(migrada.clubs).toHaveLength(24);
    expect(migrada.clubs.filter((c) => c.division === 1)).toHaveLength(12);
    expect(migrada.clubs.filter((c) => c.division === 2)).toHaveLength(12);
    expect(fixtureCompleto(migrada.clubs, migrada.fixture, 2)).toBe(true);
    expect(migrada.copa.llaves.length).toBeGreaterThan(0);
    expect(migrada.copa.vivos.length).toBeGreaterThan(0);
  });

  it('conserva la carrera del jugador: club, plata, plantel e historial', () => {
    const viejo = guardadoViejo();
    const clubUsuario = (viejo.clubs as { id: string; dinero: number }[]).find(
      (c) => c.id === viejo.clubUsuarioId,
    )!;
    const planteles = (viejo.jugadores as { clubId: string | null }[]).filter(
      (j) => j.clubId === viejo.clubUsuarioId,
    ).length;

    const migrada = migrar(viejo)!;
    const club = migrada.clubs.find((c) => c.id === migrada.clubUsuarioId)!;

    expect(club.dinero).toBe(clubUsuario.dinero);
    expect(club.division).toBe(1);
    expect(migrada.jugadores.filter((j) => j.clubId === club.id)).toHaveLength(planteles);
    expect(migrada.temporada).toBe(1);
  });

  it('completa los campos que no existian en el formato viejo', () => {
    const migrada = migrar(guardadoViejo())!;

    for (const club of migrada.clubs) {
      expect(club.entrenamiento).toBeDefined();
      expect(club.entrenamiento.fisico + club.entrenamiento.tecnica + club.entrenamiento.tactica).toBeGreaterThan(0);
    }
    for (const jugador of migrada.jugadores) {
      expect(jugador.progreso).toBe(0);
      expect(jugador.amarillasTemporada).toBe(0);
      expect(jugador.sancionPartidos).toBe(0);
    }
  });

  it('la partida migrada se puede seguir jugando', () => {
    const migrada = migrar(guardadoViejo())!;
    const jornadas = totalJornadas(migrada.fixture);
    expect(jornadas).toBe(22);

    // La prueba de fuego: media temporada mas sobre el guardado viejo.
    for (let i = 0; i < 11; i++) {
      expect(() => resolverJornada(migrada, null)).not.toThrow();
    }

    expect(migrada.jornadaActual).toBe(12);
    expect(migrada.fixture.filter((p) => p.jugado && p.division === 2).length).toBeGreaterThan(0);
  });

  it('rearma la copa si quedo apuntando a clubes que ya no estan', () => {
    const estado = copiar(nuevaPartida(4, 20));
    estado.copa.vivos = ['club-fantasma'];
    const migrada = migrar(estado)!;

    expect(migrada.copa.vivos).not.toContain('club-fantasma');
    expect(migrada.copa.vivos.length).toBeGreaterThan(1);
  });
});
