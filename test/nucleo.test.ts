import { describe, expect, it } from 'vitest';
import { Rng } from '@/sim/rng';
import { calcularMedia, generarJugador, generarPlantel, valorDeMercado } from '@/sim/jugadores';
import { calcularTabla, generarFixture, onceAutomatico, totalJornadas } from '@/sim/liga';
import { FORMACIONES, ajustePorPuesto } from '@/sim/tacticas';
import { nuevaPartida } from '@/sim/juego';
import { crearClub } from '@/sim/clubes';
import { CLUBES_LIGA } from '@/sim/nombres';

describe('generador con semilla', () => {
  it('da la misma secuencia con la misma semilla', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    const serieA = Array.from({ length: 20 }, () => a.next());
    const serieB = Array.from({ length: 20 }, () => b.next());
    expect(serieA).toEqual(serieB);
  });

  it('respeta los limites de int y float', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const entero = rng.int(3, 9);
      expect(entero).toBeGreaterThanOrEqual(3);
      expect(entero).toBeLessThanOrEqual(9);
      const flotante = rng.float(-2, 2);
      expect(flotante).toBeGreaterThanOrEqual(-2);
      expect(flotante).toBeLessThanOrEqual(2);
    }
  });
});

describe('jugadores', () => {
  it('la media queda en el rango valido', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 200; i++) {
      const j = generarJugador(rng, { pos: 'MED', nivel: 60, clubId: null });
      expect(j.media).toBeGreaterThanOrEqual(1);
      expect(j.media).toBeLessThanOrEqual(99);
      expect(j.potencial).toBeGreaterThanOrEqual(j.media);
    }
  });

  it('un delantero rinde mejor de delantero que de arquero', () => {
    expect(ajustePorPuesto('DEL', 'DEL')).toBe(1);
    expect(ajustePorPuesto('DEL', 'ARQ')).toBeLessThan(0.7);
  });

  it('el valor de mercado crece con la media', () => {
    const valores = [50, 60, 70, 80, 90].map((media) => valorDeMercado(media, 25, media + 5));
    for (let i = 1; i < valores.length; i++) {
      expect(valores[i]).toBeGreaterThan(valores[i - 1]);
    }
    // Un crack tiene que costar bastante mas que un jugador comun.
    expect(valores[4]).toBeGreaterThan(valores[1] * 5);
  });

  it('la media del arquero depende sobre todo del atributo de arquero', () => {
    const base = { ritmo: 50, regate: 50, pase: 50, tiro: 50, quite: 50, fisico: 50, arquero: 50 };
    const conManos = { ...base, arquero: 90 };
    expect(calcularMedia('ARQ', conManos)).toBeGreaterThan(calcularMedia('ARQ', base) + 15);
  });
});

describe('once automatico', () => {
  it('llena las once ranuras sin repetir jugadores', () => {
    const rng = new Rng(5);
    const club = crearClub(CLUBES_LIGA[0], 'c0', 1, rng);
    const plantel = generarPlantel(rng, club.id, club.reputacion);

    for (const formacion of Object.keys(FORMACIONES) as (keyof typeof FORMACIONES)[]) {
      club.tacticas.formacion = formacion;
      const once = onceAutomatico(club, plantel);
      expect(once).toHaveLength(11);
      expect(new Set(once.map((j) => j.id)).size).toBe(11);
    }
  });

  it('deja afuera a lesionados y suspendidos', () => {
    const rng = new Rng(6);
    const club = crearClub(CLUBES_LIGA[0], 'c0', 1, rng);
    const plantel = generarPlantel(rng, club.id, club.reputacion);
    plantel[0].lesionSemanas = 3;
    plantel[1].sancionPartidos = 1;

    const once = onceAutomatico(club, plantel);
    expect(once.map((j) => j.id)).not.toContain(plantel[0].id);
    expect(once.map((j) => j.id)).not.toContain(plantel[1].id);
  });
});

describe('fixture y tabla', () => {
  it('cada equipo juega contra todos, de local y de visitante', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `c${i}`);
    const fixture = generarFixture(ids, new Rng(11), 1);

    expect(totalJornadas(fixture)).toBe(22);
    expect(fixture).toHaveLength(132);

    for (const id of ids) {
      const local = fixture.filter((p) => p.localId === id);
      const visita = fixture.filter((p) => p.visitanteId === id);
      expect(local).toHaveLength(11);
      expect(visita).toHaveLength(11);
      // Ningun rival repetido en la misma condicion.
      expect(new Set(local.map((p) => p.visitanteId)).size).toBe(11);
    }
  });

  it('nadie juega dos veces la misma jornada', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `c${i}`);
    const fixture = generarFixture(ids, new Rng(12), 1);

    for (let jornada = 1; jornada <= 22; jornada++) {
      const dia = fixture.filter((p) => p.jornada === jornada);
      const participantes = dia.flatMap((p) => [p.localId, p.visitanteId]);
      expect(new Set(participantes).size).toBe(participantes.length);
    }
  });

  it('la tabla suma tres por ganar y uno por empatar', () => {
    const estado = nuevaPartida(0, 2024);
    const fixture = estado.fixture.filter((p) => p.division === 1).slice(0, 3);
    fixture[0].jugado = true;
    fixture[0].golesLocal = 2;
    fixture[0].golesVisitante = 0;
    fixture[1].jugado = true;
    fixture[1].golesLocal = 1;
    fixture[1].golesVisitante = 1;

    const tabla = calcularTabla(estado.clubs, fixture, 1);
    const ganador = tabla.find((f) => f.clubId === fixture[0].localId)!;
    const empatado = tabla.find((f) => f.clubId === fixture[1].localId)!;

    expect(ganador.pts).toBe(3);
    expect(ganador.dif).toBe(2);
    expect(empatado.pts).toBe(1);
  });

  it('solo mezcla equipos de la misma division', () => {
    const estado = nuevaPartida(0, 77);
    const porId = new Map(estado.clubs.map((c) => [c.id, c]));
    for (const p of estado.fixture) {
      expect(porId.get(p.localId)!.division).toBe(p.division);
      expect(porId.get(p.visitanteId)!.division).toBe(p.division);
    }
  });
});
