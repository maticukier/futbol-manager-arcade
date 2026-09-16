import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nuevaPartida } from '@/sim/juego';
import { LARGO } from '@/game/match/mundo';
import { MotorPartido } from '@/game/match/motor';
import { ENTRADA_VACIA } from '@/game/match/entidades';
import { configurarEquipo } from '@/game/match/armarPartido';
import { fijarAzar, jugarPartidoCompleto, promedio } from './ayuda';

// Leer a traves de una funcion evita que TypeScript fije el tipo con la ultima
// asignacion: en los tests cambiamos la fase a mano y despues la consultamos.
const faseDe = (m: MotorPartido) => m.fase;
const avisoDe = (m: MotorPartido) => m.aviso;

const PASO = 1 / 60;

function motorDePrueba(semilla = 2024) {
  const estado = nuevaPartida(0, semilla);
  const [local, visitante] = estado.clubs.filter((c) => c.division === 1);
  const motor = new MotorPartido({
    usuario: configurarEquipo(estado, local.id, 'usuario'),
    rival: configurarEquipo(estado, visitante.id, 'rival'),
    usuarioEsLocal: true,
    estadio: 'Cancha de prueba',
  });
  // Salgo de la pausa del saque inicial.
  for (let i = 0; i < 150; i++) motor.paso(PASO, ENTRADA_VACIA);
  return { estado, motor };
}

describe('reglas del partido', () => {
  it('no es gol si la pelota la lleva un jugador', () => {
    const { motor } = motorDePrueba();
    const dueno = motor.jugadores.find((j) => j.bando === 'usuario' && !j.esArquero)!;

    motor.fase = 'jugando';
    motor.pelota.duenoId = dueno.id;
    motor.pelota.x = LARGO / 2 + 1;
    motor.pelota.z = 0;
    motor.paso(PASO, ENTRADA_VACIA);

    expect(motor.golesUsuario).toBe(0);
    expect(motor.golesRival).toBe(0);
  });

  it('es gol cuando la pelota suelta cruza la linea entre los palos', () => {
    const { motor } = motorDePrueba();
    motor.fase = 'jugando';
    motor.aviso = null;
    motor.pelota.duenoId = null;
    Object.assign(motor.pelota, { x: LARGO / 2 - 2, z: 0, y: 0.5, vx: 30, vy: 0, vz: 0 });

    for (let i = 0; i < 20 && motor.golesUsuario === 0; i++) motor.paso(PASO, ENTRADA_VACIA);
    expect(motor.golesUsuario).toBe(1);
  });

  it('el expulsado sale de la cancha y el equipo queda con diez', () => {
    const { motor } = motorDePrueba();
    const atacante = motor.jugadores.find((j) => j.bando === 'usuario' && !j.esArquero)!;
    const defensor = motor.jugadores.find((j) => j.bando === 'rival' && !j.esArquero)!;

    // Barrida a toda velocidad por atras: roja segura.
    motor.fase = 'jugando';
    Object.assign(atacante, { x: 10, z: 2, rumbo: 0, estado: 'normal', bloqueo: 0 });
    Object.assign(defensor, { x: 9.2, z: 2, rumbo: 0, estado: 'barrida', temporizador: 0.4, vx: 14, vz: 0, bloqueo: 0 });
    Object.assign(motor.pelota, { x: 10.92, z: 2, y: 0.12, vx: 0, vy: 0, vz: 0, duenoId: atacante.id, ultimoToqueId: atacante.id });
    motor.paso(PASO, ENTRADA_VACIA);

    expect(defensor.expulsado).toBe(true);
    expect(motor.rojas.rival).toBe(1);
    expect(motor.jugadores.filter((j) => j.bando === 'rival' && !j.expulsado)).toHaveLength(10);
  });

  it('el cambio conserva el puesto y descuenta del cupo', () => {
    const { motor } = motorDePrueba();
    const sale = motor.jugadores.find((j) => j.bando === 'usuario' && !j.esArquero)!;
    const ranura = sale.ranura;
    const entra = motor.config.usuario.suplentes[0];

    expect(motor.sustituir(sale.id, entra.id)).toBeNull();
    expect(sale.id).toBe(entra.id);
    expect(sale.ranura).toBe(ranura);
    expect(motor.cambiosUsados.usuario).toBe(1);
  });

  it('no deja hacer mas cambios que el cupo', () => {
    const { motor } = motorDePrueba();
    const enCancha = motor.jugadores.filter((j) => j.bando === 'usuario' && !j.esArquero);

    for (let i = 0; i < motor.cambiosMaximos; i++) {
      const suplente = motor.config.usuario.suplentes[0];
      expect(motor.sustituir(enCancha[i].id, suplente.id)).toBeNull();
    }
    const ultimo = motor.config.usuario.suplentes[0];
    expect(motor.sustituir(enCancha[9].id, ultimo.id)).toMatch(/cinco cambios/);
  });

  it('el lateral sigue en juego, sin frenar el partido', () => {
    const { motor } = motorDePrueba();
    motor.fase = 'jugando';
    motor.aviso = null;
    motor.pelota.duenoId = null;
    Object.assign(motor.pelota, { x: 10, z: 40, y: 0.12, vx: 0, vy: 0, vz: 0 });
    motor.paso(PASO, ENTRADA_VACIA);

    expect(faseDe(motor)).toBe('jugando');
    expect(avisoDe(motor)?.titulo).toBe('LATERAL');
    expect(motor.pelota.duenoId).not.toBeNull();
  });

  it('el arquero no se queda en la linea con la pelota', () => {
    const { motor } = motorDePrueba();
    const arquero = motor.jugadores.find((j) => j.bando === 'rival' && j.esArquero)!;

    motor.fase = 'jugando';
    motor.aviso = null;
    arquero.x = LARGO / 2 - 0.5;
    arquero.z = 0;
    Object.assign(motor.pelota, { x: arquero.x, z: 0, y: 0.12, vx: 0, vy: 0, vz: 0, duenoId: arquero.id, ultimoToqueId: arquero.id });

    // Mido cuanto se aleja de la linea mientras todavia tiene la pelota.
    let salidaMaxima = 0;
    let pasosConLaPelota = 0;
    for (let i = 0; i < 240; i++) {
      motor.paso(PASO, ENTRADA_VACIA);
      if (motor.pelota.duenoId !== arquero.id) continue;
      pasosConLaPelota += 1;
      salidaMaxima = Math.max(salidaMaxima, LARGO / 2 - Math.abs(arquero.x));
    }

    expect(motor.pelota.duenoId).not.toBe(arquero.id);
    expect(salidaMaxima).toBeGreaterThan(4);
    // Y no se queda con ella para siempre.
    expect(pasosConLaPelota).toBeLessThan(180);
  });

  it('el penal se patea y devuelve el juego', () => {
    const { motor } = motorDePrueba();
    const atacante = motor.jugadores.find((j) => j.bando === 'usuario' && !j.esArquero)!;
    const defensor = motor.jugadores.find((j) => j.bando === 'rival' && !j.esArquero)!;

    motor.fase = 'jugando';
    Object.assign(atacante, { x: 45, z: 2, rumbo: 0, estado: 'normal', bloqueo: 0 });
    Object.assign(defensor, { x: 44.2, z: 2, rumbo: 0, estado: 'barrida', temporizador: 0.4, vx: 11, vz: 0, bloqueo: 0 });
    Object.assign(motor.pelota, { x: 45.92, z: 2, y: 0.12, vx: 0, vy: 0, vz: 0, duenoId: atacante.id, ultimoToqueId: atacante.id });
    motor.paso(PASO, ENTRADA_VACIA);
    expect(faseDe(motor)).toBe('penal');

    const rematesAntes = motor.rematesDe('usuario');
    for (let i = 0; i < 800 && faseDe(motor) === 'penal'; i++) motor.paso(PASO, ENTRADA_VACIA);

    expect(faseDe(motor)).not.toBe('penal');
    expect(motor.rematesDe('usuario')).toBe(rematesAntes + 1);
  });
});

describe('reloj', () => {
  it('arranca en cero y llega a los noventa al final del partido', () => {
    const estado = nuevaPartida(0, 606);
    const [local, visitante] = estado.clubs.filter((c) => c.division === 1);
    const { motor } = jugarPartidoCompleto(estado, local.id, visitante.id);

    expect(motor.terminado).toBe(true);
    expect(motor.tiempoActual).toBe(2);
    expect(motor.minuto).toBe(90);
  });

  it('avanza sin topes durante el primer tiempo', () => {
    const { motor } = motorDePrueba(707);
    const marcas: number[] = [];

    // Un tiempo dura noventa segundos reales: voy midiendo el minuto.
    for (let i = 0; i < 60 * 95; i++) {
      motor.paso(PASO, ENTRADA_VACIA);
      if (i % (60 * 10) === 0) marcas.push(motor.minuto);
    }

    // El minuto tiene que crecer, no quedarse clavado en ninguno.
    expect(new Set(marcas).size).toBeGreaterThan(4);
    expect(Math.max(...marcas)).toBeGreaterThan(40);
  });
});

describe('arquero', () => {
  it('sale a buscar una pelota suelta en su area', () => {
    const { motor } = motorDePrueba(808);
    const arquero = motor.jugadores.find((j) => j.bando === 'rival' && j.esArquero)!;

    motor.fase = 'jugando';
    motor.aviso = null;
    arquero.x = LARGO / 2 - 1;
    arquero.z = 0;
    // Pelota quieta dentro del area, sin dueno y sin nadie cerca.
    Object.assign(motor.pelota, { x: LARGO / 2 - 11, z: 4, y: 0.12, vx: 0, vy: 0, vz: 0, duenoId: null, ultimoToqueId: null });
    for (const j of motor.jugadores) {
      if (j === arquero) continue;
      j.x = -20;
      j.z = 0;
    }

    const distanciaInicial = Math.hypot(arquero.x - motor.pelota.x, arquero.z - motor.pelota.z);
    for (let i = 0; i < 180 && motor.pelota.duenoId !== arquero.id; i++) motor.paso(PASO, ENTRADA_VACIA);

    expect(motor.pelota.duenoId).toBe(arquero.id);
    expect(distanciaInicial).toBeGreaterThan(5);
  });

  it('no abandona el arco por una pelota lejos de su area', () => {
    const { motor } = motorDePrueba(909);
    const arquero = motor.jugadores.find((j) => j.bando === 'rival' && j.esArquero)!;

    motor.fase = 'jugando';
    motor.aviso = null;
    arquero.x = LARGO / 2 - 1;
    Object.assign(motor.pelota, { x: 0, z: 0, y: 0.12, vx: 0, vy: 0, vz: 0, duenoId: null, ultimoToqueId: null });

    for (let i = 0; i < 180; i++) motor.paso(PASO, ENTRADA_VACIA);

    expect(LARGO / 2 - arquero.x).toBeLessThan(22);
  });
});

describe('balance del partido', () => {
  let restaurar: () => void;

  beforeAll(() => {
    restaurar = fijarAzar(4242);
  });
  afterAll(() => restaurar());

  it('los numeros de un partido caen en el rango de un arcade de futbol', () => {
    const estado = nuevaPartida(4, 31337);
    const primera = estado.clubs.filter((c) => c.division === 1);
    const partidos = 24;

    const goles: number[] = [];
    const remates: number[] = [];

    for (let i = 0; i < partidos; i++) {
      const local = primera[i % primera.length];
      const visitante = primera[(i + 1 + (i % 4)) % primera.length];
      if (local.id === visitante.id) continue;

      const { resultado, motor } = jugarPartidoCompleto(estado, local.id, visitante.id);
      expect(motor.terminado).toBe(true);
      goles.push(resultado.golesUsuario + resultado.golesRival);
      remates.push(resultado.remates.usuario + resultado.remates.rival);
    }

    const golesPorPartido = promedio(goles);
    const rematesPorPartido = promedio(remates);
    const conversion = golesPorPartido / rematesPorPartido;

    expect(golesPorPartido).toBeGreaterThan(2);
    expect(golesPorPartido).toBeLessThan(5.5);
    expect(rematesPorPartido).toBeGreaterThan(8);
    expect(rematesPorPartido).toBeLessThan(24);
    expect(conversion).toBeGreaterThan(0.1);
    expect(conversion).toBeLessThan(0.4);
  });

  it('el equipo mejor armado gana mas seguido que el peor', () => {
    const estado = nuevaPartida(0, 8888);
    const primera = estado.clubs.filter((c) => c.division === 1);
    const grande = primera[0];
    const chico = primera[primera.length - 1];

    let golesGrande = 0;
    let golesChico = 0;
    for (let i = 0; i < 10; i++) {
      const { resultado } = jugarPartidoCompleto(estado, grande.id, chico.id);
      golesGrande += resultado.golesUsuario;
      golesChico += resultado.golesRival;
    }

    expect(golesGrande).toBeGreaterThan(golesChico);
  });
});
