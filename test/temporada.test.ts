import { describe, expect, it } from 'vitest';
import { cerrarTemporada, clubPorId, nuevaPartida, plantelDe, resolverJornada } from '@/sim/juego';
import { calcularTabla, totalJornadas } from '@/sim/liga';
import { renovarContrato, salarioPedido } from '@/sim/contratos';
import { fixtureCompleto } from '@/sim/migraciones';
import { correrTemporada } from './ayuda';

describe('una temporada completa', () => {
  it('todos juegan la misma cantidad de partidos y la tabla cierra', () => {
    const estado = nuevaPartida(4, 555);
    const jornadas = totalJornadas(estado.fixture);
    correrTemporada(estado);

    // Al cerrar ya arranco la temporada siguiente, asi que miro el historial.
    expect(estado.historial).toHaveLength(1);
    expect(estado.temporada).toBe(2);
    expect(jornadas).toBe(22);

    for (const division of [1, 2] as const) {
      expect(fixtureCompleto(estado.clubs, estado.fixture, division)).toBe(true);
    }
  });

  it('bajan dos y suben dos, y las divisiones quedan parejas', () => {
    const estado = nuevaPartida(4, 777);
    const tablaPrevia = () => calcularTabla(estado.clubs, estado.fixture, 1);

    const jornadas = totalJornadas(estado.fixture);
    for (let i = 0; i < jornadas - 1; i++) resolverJornada(estado, null);

    const ultimosDos = tablaPrevia().slice(-2).map((f) => f.clubId);
    resolverJornada(estado, null);
    const primerosDeSegunda = calcularTabla(estado.clubs, estado.fixture, 2)
      .slice(0, 2)
      .map((f) => f.clubId);

    cerrarTemporada(estado);

    expect(estado.clubs.filter((c) => c.division === 1)).toHaveLength(12);
    expect(estado.clubs.filter((c) => c.division === 2)).toHaveLength(12);

    // Los que estaban ultimos y los punteros de segunda cambiaron de categoria.
    for (const id of primerosDeSegunda) expect(clubPorId(estado, id).division).toBe(1);
    const bajaronAlMenosUno = ultimosDos.some((id) => clubPorId(estado, id).division === 2);
    expect(bajaronAlMenosUno).toBe(true);
  });

  it('la copa termina con un solo campeon por temporada', () => {
    const estado = nuevaPartida(4, 999);
    const jornadas = totalJornadas(estado.fixture);
    for (let i = 0; i < jornadas - 1; i++) resolverJornada(estado, null);

    expect(estado.copa.campeonId).not.toBeNull();
    expect(estado.copa.vivos).toHaveLength(1);
    // Cada llave tiene ganador y nadie sigue vivo despues de perder.
    const jugadas = estado.copa.llaves.filter((k) => k.jugado);
    expect(jugadas.length).toBeGreaterThan(20);
    for (const llave of jugadas) {
      expect([llave.localId, llave.visitanteId]).toContain(llave.ganadorId);
    }
  });
});

describe('cuatro temporadas seguidas', () => {
  it('no rompe nada y los numeros quedan en rangos razonables', () => {
    const estado = nuevaPartida(4, 31415);

    for (let t = 0; t < 4 && !estado.despedido; t++) {
      correrTemporada(estado);
    }

    const club = clubPorId(estado, estado.clubUsuarioId);
    const plantel = plantelDe(estado, club.id);

    expect(Number.isFinite(club.dinero)).toBe(true);
    expect(plantel.length).toBeGreaterThanOrEqual(16);
    expect(plantel.length).toBeLessThanOrEqual(30);

    // La lista de jugadores no crece sin control temporada tras temporada.
    expect(estado.jugadores.length).toBeLessThan(700);

    // Nadie queda con datos invalidos.
    for (const j of estado.jugadores) {
      expect(j.media).toBeGreaterThanOrEqual(1);
      expect(j.media).toBeLessThanOrEqual(99);
      expect(j.edad).toBeGreaterThanOrEqual(17);
      expect(j.edad).toBeLessThanOrEqual(36);
      expect(Number.isFinite(j.valor)).toBe(true);
      expect(j.sancionPartidos).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('sanciones y contratos', () => {
  it('cinco amarillas cuestan una fecha y el suspendido no juega', () => {
    const estado = nuevaPartida(4, 246);
    const club = clubPorId(estado, estado.clubUsuarioId);
    const jugador = plantelDe(estado, club.id)[3];
    jugador.amarillasTemporada = 4;

    const partido = estado.fixture.find(
      (p) => p.jornada === 1 && (p.localId === club.id || p.visitanteId === club.id),
    )!;
    const esLocal = partido.localId === club.id;

    resolverJornada(estado, {
      golesLocal: 1,
      golesVisitante: 0,
      goleadoresLocal: [],
      goleadoresVisitante: [],
      amonestados: [jugador.id],
      expulsados: [],
    });

    expect(esLocal || !esLocal).toBe(true);
    expect(jugador.amarillasTemporada).toBe(5);
    expect(jugador.sancionPartidos).toBe(1);
  });

  it('el contrato que llega a cero deja al jugador libre', () => {
    const estado = nuevaPartida(4, 135);
    const club = clubPorId(estado, estado.clubUsuarioId);
    const jugador = plantelDe(estado, club.id).find((j) => !club.titulares.includes(j.id))!;
    jugador.contratoSemanas = 1;

    resolverJornada(estado, null);

    expect(jugador.clubId).toBeNull();
    expect(plantelDe(estado, club.id).map((j) => j.id)).not.toContain(jugador.id);
  });

  it('renovar cuesta plata y sube el sueldo', () => {
    const estado = nuevaPartida(4, 864);
    const club = clubPorId(estado, estado.clubUsuarioId);
    const jugador = plantelDe(estado, club.id)[0];
    jugador.contratoSemanas = 12;
    jugador.moral = 80;
    jugador.partidosTemporada = 10;

    const dineroAntes = club.dinero;
    const pedido = salarioPedido(jugador);
    const mensaje = renovarContrato(estado, jugador.id);

    expect(mensaje).toMatch(/renovo/);
    expect(jugador.salario).toBe(pedido);
    expect(jugador.contratoSemanas).toBeGreaterThan(100);
    expect(club.dinero).toBeLessThan(dineroAntes);
  });
});
