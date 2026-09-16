import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nuevaPartida } from '@/sim/juego';
import { migrar } from '@/sim/migraciones';
import {
  EFECTOS_NEUTROS,
  PARTIDOS_PARA_DESTAPAR,
  RASGOS,
  efectosDe,
  rasgoOcultoVisible,
  sortearRasgos,
} from '@/sim/rasgos';
import { calcularNota, estadisticasVacias, figuraDelPartido } from '@/sim/rendimiento';
import { Rng } from '@/sim/rng';
import { MotorPartido } from '@/game/match/motor';
import { ENTRADA_VACIA } from '@/game/match/entidades';
import { configurarEquipo } from '@/game/match/armarPartido';
import { LARGO } from '@/game/match/mundo';
import { fijarAzar } from './ayuda';

const PASO = 1 / 60;

describe('rasgos', () => {
  it('sin rasgos, el jugador juega exactamente como antes', () => {
    expect(efectosDe([])).toEqual(EFECTOS_NEUTROS);
    expect(efectosDe(['inventado'])).toEqual(EFECTOS_NEUTROS);
  });

  it('dos rasgos que empujan lo mismo se suman', () => {
    // Canonero y definidor tocan los dos la punteria.
    const solo = efectosDe(['definidor']).punteria;
    const juntos = efectosDe(['canonero', 'definidor']).punteria;
    expect(juntos).toBeGreaterThan(solo);
    expect(juntos).toBeCloseTo(RASGOS.canonero.efectos.punteria! * RASGOS.definidor.efectos.punteria!);
  });

  it('una virtud sale de un atributo alto, no de la nada', () => {
    const rng = new Rng(1234);
    let conTiroAlto = 0;
    let conTiroBajo = 0;

    for (let i = 0; i < 400; i++) {
      const bueno = sortearRasgos(rng, 'DEL', attrs({ tiro: 92 }), 80);
      const malo = sortearRasgos(rng, 'DEL', attrs({ tiro: 40 }), 45);
      if (bueno.rasgos.includes('canonero') || bueno.rasgos.includes('definidor')) conTiroAlto += 1;
      if (malo.rasgos.includes('canonero') || malo.rasgos.includes('definidor')) conTiroBajo += 1;
    }

    expect(conTiroAlto).toBeGreaterThan(conTiroBajo * 3);
  });

  it('los defectos no son lo mas comun del plantel', () => {
    const restaurar = fijarAzar(55);
    const estado = nuevaPartida(2, 7777);
    restaurar();

    const conRasgo = estado.jugadores.filter((j) => j.rasgos.length > 0);
    const conDefecto = estado.jugadores.filter((j) =>
      j.rasgos.some((id) => RASGOS[id].contra),
    );

    expect(conRasgo.length).toBeGreaterThan(estado.jugadores.length * 0.5);
    // Si la mitad del mundo tiene un defecto marcado, la ficha deja de decir nada.
    expect(conDefecto.length).toBeLessThan(conRasgo.length * 0.4);
  });

  it('el rasgo oculto se destapa recien despues de verlo jugar', () => {
    expect(rasgoOcultoVisible(0)).toBe(false);
    expect(rasgoOcultoVisible(PARTIDOS_PARA_DESTAPAR - 1)).toBe(false);
    expect(rasgoOcultoVisible(PARTIDOS_PARA_DESTAPAR)).toBe(true);
  });

  it('una partida vieja sin rasgos los recibe sin perder la carrera', () => {
    const restaurar = fijarAzar(88);
    const estado = nuevaPartida(1, 2024);
    restaurar();

    const nombreOriginal = estado.jugadores[0].nombre;
    const golesOriginales = (estado.jugadores[0].golesTemporada = 7);
    for (const j of estado.jugadores) {
      delete (j as Partial<typeof j>).rasgos;
      delete (j as Partial<typeof j>).rasgoOculto;
      delete (j as Partial<typeof j>).partidosObservado;
    }

    const migrado = migrar(JSON.parse(JSON.stringify(estado)));
    expect(migrado).not.toBeNull();
    expect(migrado!.jugadores.every((j) => Array.isArray(j.rasgos))).toBe(true);
    expect(migrado!.jugadores.every((j) => j.partidosObservado === 0)).toBe(true);
    // Y el jugador sigue siendo el mismo, con lo que venia haciendo.
    expect(migrado!.jugadores[0].nombre).toBe(nombreOriginal);
    expect(migrado!.jugadores[0].golesTemporada).toBe(golesOriginales);
  });
});

describe('los rasgos llegan a la cancha', () => {
  let restaurar: () => void;
  beforeAll(() => {
    restaurar = fijarAzar(4321);
  });
  afterAll(() => restaurar());

  /** Cuantos pasos tarda en decidirse a patear desde esa distancia del arco. */
  function pasosHastaElRemate(rasgos: string[], distanciaAlArco: number): number {
    const estado = nuevaPartida(0, 12321);
    const [local, visitante] = estado.clubs.filter((c) => c.division === 1);
    const motor = new MotorPartido({
      usuario: configurarEquipo(estado, local.id, 'usuario'),
      rival: configurarEquipo(estado, visitante.id, 'rival'),
      usuarioEsLocal: true,
      estadio: 'x',
    });
    motor.iaTotal = true;
    for (let i = 0; i < 150; i++) motor.paso(PASO, ENTRADA_VACIA);

    const tirador = motor.jugadores.find((j) => j.bando === 'usuario' && !j.esArquero)!;
    tirador.efectos = efectosDe(rasgos);

    let pasos = 0;
    const antes = motor.resultado().remates.usuario;
    while (pasos < 4000 && motor.resultado().remates.usuario === antes) {
      // Lo mantengo parado con la pelota a esa distancia: lo unico que cambia
      // entre una medicion y la otra son sus rasgos.
      motor.fase = 'jugando';
      motor.aviso = null;
      Object.assign(tirador, { x: LARGO / 2 - distanciaAlArco, z: 0, vx: 0, vz: 0 });
      Object.assign(motor.pelota, {
        x: tirador.x, z: 0, y: 0.12, vx: 0, vy: 0, vz: 0,
        duenoId: tirador.id, ultimoToqueId: tirador.id,
      });
      motor.paso(PASO, ENTRADA_VACIA);
      pasos += 1;
    }
    return pasos;
  }

  it('un canonero se anima de lejos y uno comun no', () => {
    const canonero = pasosHastaElRemate(['canonero'], 28);
    const comun = pasosHastaElRemate([], 28);
    expect(canonero).toBeLessThan(comun);
  });

  it('un pulmon llega al final del partido con mas aire', () => {
    const estado = nuevaPartida(0, 555);
    const [local, visitante] = estado.clubs.filter((c) => c.division === 1);
    const motor = new MotorPartido({
      usuario: configurarEquipo(estado, local.id, 'usuario'),
      rival: configurarEquipo(estado, visitante.id, 'rival'),
      usuarioEsLocal: true,
      estadio: 'x',
    });
    motor.iaTotal = true;

    const [conPulmon, comun] = motor.jugadores.filter((j) => j.bando === 'usuario' && !j.esArquero);
    conPulmon.efectos = efectosDe(['pulmon']);
    comun.efectos = efectosDe([]);
    conPulmon.energia = 1;
    comun.energia = 1;

    for (let i = 0; i < 6000 && !motor.terminado; i++) motor.paso(PASO, ENTRADA_VACIA);

    expect(conPulmon.energia).toBeGreaterThan(comun.energia);
  });
});

describe('nota del partido', () => {
  it('el que hizo el gol saca mas que el que no hizo nada', () => {
    const goleador = { ...estadisticasVacias(), minutos: 90, goles: 1, remates: 3 };
    const nadie = { ...estadisticasVacias(), minutos: 90 };
    expect(calcularNota(goleador, false, 1)).toBeGreaterThan(calcularNota(nadie, false, 1));
  });

  it('la roja hunde la nota y nunca se sale de uno a diez', () => {
    const expulsado = { ...estadisticasVacias(), minutos: 60, rojas: 1, faltas: 4 };
    expect(calcularNota(expulsado, false, 1)).toBeLessThan(5);

    const imposible = { ...estadisticasVacias(), minutos: 90, goles: 9, asistencias: 6, quites: 30 };
    expect(calcularNota(imposible, false, 1.2)).toBeLessThanOrEqual(10);
    expect(calcularNota({ ...estadisticasVacias(), minutos: 90, rojas: 4 }, false, 0.7)).toBeGreaterThanOrEqual(1);
  });

  it('el que entro faltando cinco minutos no saca ni un diez ni un uno', () => {
    const entroTarde = { ...estadisticasVacias(), minutos: 5, goles: 1, remates: 2 };
    const jugoTodo = { ...estadisticasVacias(), minutos: 90, goles: 1, remates: 2 };
    expect(calcularNota(entroTarde, false, 1)).toBeLessThan(calcularNota(jugoTodo, false, 1));
    expect(calcularNota(entroTarde, false, 1)).toBeGreaterThan(6);
  });

  it('al arquero le pesan las atajadas y los goles que le hacen', () => {
    const atajador = { ...estadisticasVacias(), minutos: 90, atajadas: 6 };
    const colador = { ...estadisticasVacias(), minutos: 90, golesRecibidos: 4 };
    expect(calcularNota(atajador, true, 1)).toBeGreaterThan(calcularNota(colador, true, 1));
  });

  it('la figura tiene que haber jugado, no haber entrado al final', () => {
    const notas = [
      { id: 'a', nombre: 'Titular', nota: 7.5, stats: { ...estadisticasVacias(), minutos: 90 } },
      { id: 'b', nombre: 'Suplente', nota: 8.9, stats: { ...estadisticasVacias(), minutos: 8 } },
    ];
    expect(figuraDelPartido(notas)?.id).toBe('a');
    expect(figuraDelPartido([])).toBeNull();
  });

  it('un partido reparte notas y nadie queda sin puntaje', () => {
    const restaurar = fijarAzar(246);
    const estado = nuevaPartida(0, 1357);
    const [local, visitante] = estado.clubs.filter((c) => c.division === 1);
    const motor = new MotorPartido({
      usuario: configurarEquipo(estado, local.id, 'usuario'),
      rival: configurarEquipo(estado, visitante.id, 'rival'),
      usuarioEsLocal: true,
      estadio: 'x',
    });
    motor.iaTotal = true;
    for (let i = 0; i < 40_000 && !motor.terminado; i++) motor.paso(PASO, ENTRADA_VACIA);
    restaurar();

    const resultado = motor.resultado();
    const notas = resultado.notas;
    const expulsados = new Set(resultado.expulsados);
    expect(notas.usuario).toHaveLength(11);
    expect(notas.rival).toHaveLength(11);
    for (const n of [...notas.usuario, ...notas.rival]) {
      expect(n.nota).toBeGreaterThanOrEqual(1);
      expect(n.nota).toBeLessThanOrEqual(10);
      // Al expulsado se le cortan los minutos ahi mismo; el resto jugo todo.
      expect(n.stats.minutos).toBeGreaterThan(expulsados.has(n.id) ? 0 : 80);
    }
    // Vienen de mejor a peor, que es como se lee un puntaje.
    expect(notas.usuario[0].nota).toBeGreaterThanOrEqual(notas.usuario[10].nota);
  });
});

function attrs(cambios: Partial<Record<string, number>>) {
  return {
    ritmo: 60,
    regate: 60,
    pase: 60,
    tiro: 60,
    quite: 60,
    fisico: 60,
    arquero: 40,
    ...cambios,
  };
}
