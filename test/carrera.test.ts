import { describe, expect, it } from 'vitest';
import { nuevaPartida, clubPorId, plantelDe } from '@/sim/juego';
import { migrar } from '@/sim/migraciones';
import { carreraDe, cerrarTemporadaDeJugador } from '@/sim/historial';
import { MotorPartido } from '@/game/match/motor';
import { ENTRADA_VACIA } from '@/game/match/entidades';
import { configurarEquipo } from '@/game/match/armarPartido';
import { correrTemporada, fijarAzar, promedio } from './ayuda';

function unJugador() {
  const restaurar = fijarAzar(11);
  const estado = nuevaPartida(0, 4040);
  restaurar();
  return { estado, j: estado.jugadores[0] };
}

describe('la carrera de un jugador', () => {
  it('guarda la temporada con la edad que tenia al jugarla', () => {
    const { j } = unJugador();
    Object.assign(j, {
      edad: 19,
      partidosTemporada: 22,
      golesTemporada: 8,
      asistenciasTemporada: 3,
      notaSumada: 22 * 6.8,
      media: 71,
    });

    cerrarTemporadaDeJugador(j, 4, 1);
    // Recien despues cumple anos, como pasa en el cierre de temporada.
    j.edad += 1;

    expect(j.historial).toHaveLength(1);
    expect(j.historial[0]).toMatchObject({
      temporada: 4,
      edad: 19,
      partidos: 22,
      goles: 8,
      asistencias: 3,
      media: 71,
    });
    expect(j.historial[0].nota).toBeCloseTo(6.8, 1);
  });

  it('el que no jugo ni un partido no deja fila', () => {
    const { j } = unJugador();
    j.partidosTemporada = 0;
    cerrarTemporadaDeJugador(j, 4, 1);
    expect(j.historial).toHaveLength(0);
  });

  it('una temporada no se guarda dos veces', () => {
    const { j } = unJugador();
    Object.assign(j, { partidosTemporada: 10, notaSumada: 62 });

    cerrarTemporadaDeJugador(j, 4, 1);
    // Si al usuario lo echan, el cierre no reinicia los contadores y se puede
    // volver a pasar por aca con la misma temporada.
    cerrarTemporadaDeJugador(j, 4, 1);

    expect(j.historial).toHaveLength(1);
  });

  it('la carrera suma lo guardado mas lo que va del ano', () => {
    const { j } = unJugador();
    j.historial = [
      { temporada: 1, clubId: 'c1', division: 1, edad: 18, partidos: 10, goles: 2, asistencias: 1, nota: 6.5, media: 60 },
      { temporada: 2, clubId: 'c2', division: 1, edad: 19, partidos: 20, goles: 9, asistencias: 4, nota: 7.5, media: 68 },
    ];
    Object.assign(j, { clubId: 'c2', partidosTemporada: 5, golesTemporada: 3, asistenciasTemporada: 0, notaSumada: 35 });

    const c = carreraDe(j);
    expect(c.temporadas).toBe(2);
    expect(c.partidos).toBe(35);
    expect(c.goles).toBe(14);
    expect(c.asistencias).toBe(5);
    expect(c.clubes).toBe(2);
    expect(c.mejor?.temporada).toBe(2);
    // Promedio ponderado por partidos, no promedio de promedios.
    expect(c.nota).toBeCloseTo((6.5 * 10 + 7.5 * 20 + 35) / 35, 1);
  });
});

describe('la temporada queda registrada al cerrarla', () => {
  it('despues de una temporada completa todos los que jugaron tienen su fila', () => {
    const restaurar = fijarAzar(707);
    const estado = nuevaPartida(2, 8080);
    correrTemporada(estado);
    restaurar();

    const conHistoria = estado.jugadores.filter((j) => j.historial.length > 0);
    expect(conHistoria.length).toBeGreaterThan(estado.jugadores.length * 0.5);

    for (const j of conHistoria) {
      const fila = j.historial[0];
      expect(fila.temporada).toBe(1);
      expect(fila.partidos).toBeGreaterThan(0);
      expect(fila.nota).toBeGreaterThanOrEqual(1);
      expect(fila.nota).toBeLessThanOrEqual(10);
      // Y los contadores del ano arrancaron de cero para el siguiente.
      expect(j.golesTemporada).toBe(0);
      expect(j.notaSumada).toBe(0);
    }
  });

  it('el partido simulado puntua en la misma escala que el jugado', () => {
    const restaurar = fijarAzar(313);
    const estado = nuevaPartida(2, 9090);
    correrTemporada(estado);

    const simuladas = estado.jugadores.flatMap((j) => j.historial.map((t) => t.nota));

    const primera = estado.clubs.filter((c) => c.division === 1);
    const jugadas: number[] = [];
    for (let i = 0; i < 4; i++) {
      const motor = new MotorPartido({
        usuario: configurarEquipo(estado, primera[i].id, 'usuario'),
        rival: configurarEquipo(estado, primera[i + 4].id, 'rival'),
        usuarioEsLocal: true,
        estadio: 'x',
      });
      motor.iaTotal = true;
      for (let p = 0; p < 40_000 && !motor.terminado; p++) motor.paso(1 / 60, ENTRADA_VACIA);
      const notas = motor.resultado().notas;
      jugadas.push(...[...notas.usuario, ...notas.rival].map((n) => n.nota));
    }
    restaurar();

    // Si las dos escalas se separan, una carrera que mezcla partidos jugados y
    // simulados deja de querer decir algo.
    expect(Math.abs(promedio(simuladas) - promedio(jugadas))).toBeLessThan(0.7);
  });

  it('se reparten asistencias en los partidos simulados', () => {
    const restaurar = fijarAzar(414);
    const estado = nuevaPartida(2, 1212);
    correrTemporada(estado);
    restaurar();

    const asistencias = estado.jugadores.reduce(
      (suma, j) => suma + j.historial.reduce((s, t) => s + t.asistencias, 0),
      0,
    );
    const goles = estado.jugadores.reduce(
      (suma, j) => suma + j.historial.reduce((s, t) => s + t.goles, 0),
      0,
    );

    expect(goles).toBeGreaterThan(0);
    // No todos los goles tienen asistencia, pero tampoco puede no haber ninguna.
    expect(asistencias).toBeGreaterThan(goles * 0.2);
    expect(asistencias).toBeLessThan(goles);
  });

  it('una partida vieja arranca con la carrera vacia y no pierde nada', () => {
    const restaurar = fijarAzar(515);
    const estado = nuevaPartida(1, 3131);
    restaurar();

    const club = clubPorId(estado, estado.clubUsuarioId);
    const antes = plantelDe(estado, club.id)[0];
    const nombre = antes.nombre;
    antes.golesTemporada = 5;

    for (const j of estado.jugadores) {
      delete (j as Partial<typeof j>).historial;
      delete (j as Partial<typeof j>).asistenciasTemporada;
      delete (j as Partial<typeof j>).notaSumada;
    }

    const migrado = migrar(JSON.parse(JSON.stringify(estado)));
    expect(migrado).not.toBeNull();
    expect(migrado!.jugadores.every((j) => Array.isArray(j.historial))).toBe(true);
    expect(migrado!.jugadores.every((j) => j.notaSumada === 0)).toBe(true);
    expect(migrado!.jugadores.find((j) => j.nombre === nombre)?.golesTemporada).toBe(5);
  });
});
