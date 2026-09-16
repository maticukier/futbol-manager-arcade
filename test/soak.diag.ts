/**
 * Cazador de bugs. Corre muchos partidos de IA contra IA y grita cada vez que
 * el motor rompe una regla que nunca deberia romper. No mide balance: busca
 * cosas rotas.
 */
import { nuevaPartida } from '@/sim/juego';
import { fijarAzar } from './ayuda';
import { configurarEquipo } from '@/game/match/armarPartido';
import { MotorPartido } from '@/game/match/motor';
import { ENTRADA_VACIA } from '@/game/match/entidades';
import { ANCHO, LARGO, VELOCIDAD_MAX } from '@/game/match/mundo';

const PASO = 1 / 60;
const PARTIDOS = 40;

const fallas = new Map<string, { veces: number; ejemplo: string }>();
function anotar(clave: string, ejemplo: string): void {
  const previo = fallas.get(clave);
  if (previo) previo.veces += 1;
  else fallas.set(clave, { veces: 1, ejemplo });
}

const restaurar = fijarAzar(9001);
const estado = nuevaPartida(4, 555);
const primera = estado.clubs.filter((c) => c.division === 1);

for (let p = 0; p < PARTIDOS; p++) {
  const local = primera[p % primera.length];
  const visitante = primera[(p * 7 + 3) % primera.length];
  if (local.id === visitante.id) continue;

  const motor = new MotorPartido({
    usuario: configurarEquipo(estado, local.id, 'usuario'),
    rival: configurarEquipo(estado, visitante.id, 'rival'),
    usuarioEsLocal: true,
    estadio: 'soak',
  });
  motor.iaTotal = true;

  let faseAnterior = motor.fase;
  let faseDesde = 0;
  let relojAnterior = motor.segundosJugados;
  let relojQuieto = 0;
  let pelotaQuieta = 0;
  let pasos = 0;

  for (; pasos < 60000 && !motor.terminado; pasos++) {
    motor.paso(PASO, ENTRADA_VACIA);
    const donde = `${local.abrev}-${visitante.abrev} paso ${pasos}`;

    // --- numeros rotos ---
    const malo = (v: number) => !Number.isFinite(v);
    if (malo(motor.pelota.x) || malo(motor.pelota.z) || malo(motor.pelota.y)) {
      anotar('pelota con NaN', donde);
      break;
    }
    for (const j of motor.jugadores) {
      if (malo(j.x) || malo(j.z) || malo(j.vx) || malo(j.vz)) {
        anotar('jugador con NaN', `${donde} ${j.nombre}`);
        break;
      }
    }

    // --- fuera de escala ---
    for (const j of motor.jugadores) {
      if (j.expulsado) continue;
      if (Math.abs(j.x) > LARGO / 2 + 4 || Math.abs(j.z) > ANCHO / 2 + 4) {
        anotar('jugador fuera de la cancha', `${donde} ${j.nombre} en ${j.x.toFixed(0)},${j.z.toFixed(0)}`);
      }
      const v = Math.hypot(j.vx, j.vz);
      if (v > VELOCIDAD_MAX * 1.7) {
        anotar('jugador a velocidad imposible', `${donde} ${j.nombre} a ${v.toFixed(1)} m/s`);
      }
    }
    if (motor.pelota.y < -0.1 || motor.pelota.y > 40) {
      anotar('pelota a altura imposible', `${donde} y=${motor.pelota.y.toFixed(1)}`);
    }

    // --- la pelota y su dueno ---
    const dueno = motor.jugadores.find((j) => j.id === motor.pelota.duenoId);
    if (motor.pelota.duenoId && !dueno) {
      anotar('la pelota tiene un dueno que no existe', donde);
    }
    if (dueno) {
      if (dueno.expulsado) anotar('la pelota la lleva un expulsado', `${donde} ${dueno.nombre}`);
      const d = Math.hypot(dueno.x - motor.pelota.x, dueno.z - motor.pelota.z);
      if (d > 2.5) anotar('la pelota esta lejos de su dueno', `${donde} ${d.toFixed(1)} m fase ${motor.fase}`);
    }

    // --- fases que se cuelgan ---
    if (motor.fase !== faseAnterior) {
      faseAnterior = motor.fase;
      faseDesde = pasos;
    } else if (motor.fase !== 'jugando' && motor.fase !== 'final' && pasos - faseDesde > 60 * 25) {
      anotar(`la fase "${motor.fase}" se colgo`, donde);
      faseDesde = pasos;
    }

    // --- el reloj ---
    if (motor.fase === 'jugando') {
      if (motor.segundosJugados <= relojAnterior) relojQuieto += 1;
      else relojQuieto = 0;
      relojAnterior = motor.segundosJugados;
      if (relojQuieto > 60 * 3) {
        anotar('el reloj no avanza jugando', donde);
        relojQuieto = 0;
      }

      // --- la pelota abandonada ---
      const quieta = !motor.pelota.duenoId && Math.hypot(motor.pelota.vx, motor.pelota.vz) < 0.4;
      pelotaQuieta = quieta ? pelotaQuieta + 1 : 0;
      if (pelotaQuieta > 60 * 6) {
        anotar('nadie va a buscar la pelota', `${donde} en ${motor.pelota.x.toFixed(0)},${motor.pelota.z.toFixed(0)}`);
        pelotaQuieta = 0;
      }

      // --- la pelota afuera y el juego sigue ---
      if (Math.abs(motor.pelota.x) > LARGO / 2 + 3 || Math.abs(motor.pelota.z) > ANCHO / 2 + 3) {
        anotar('se juega con la pelota afuera', `${donde} en ${motor.pelota.x.toFixed(0)},${motor.pelota.z.toFixed(0)}`);
      }
    }
  }

  if (!motor.terminado) anotar('el partido nunca termina', `${local.abrev}-${visitante.abrev}`);

  const r = motor.resultado();
  const tiros = r.remates.usuario + r.remates.rival;
  if (tiros === 0) anotar('partido sin un solo remate', `${local.abrev}-${visitante.abrev}`);
  if (Math.max(r.posesion.usuario, r.posesion.rival) > 78) {
    anotar('posesion absurda', `${local.abrev}-${visitante.abrev} ${r.posesion.usuario}/${r.posesion.rival}`);
  }
  if (r.golesUsuario + r.golesRival > 12) {
    anotar('goleada imposible', `${local.abrev}-${visitante.abrev} ${r.golesUsuario}-${r.golesRival}`);
  }
}
restaurar();

if (fallas.size === 0) {
  console.log(`${PARTIDOS} partidos sin una sola falla.`);
} else {
  console.log(`${PARTIDOS} partidos. Fallas encontradas:\n`);
  const orden = [...fallas.entries()].sort((a, b) => b[1].veces - a[1].veces);
  for (const [clave, { veces, ejemplo }] of orden) {
    console.log(`  ${String(veces).padStart(7)} x  ${clave}`);
    console.log(`              ej: ${ejemplo}`);
  }
}
