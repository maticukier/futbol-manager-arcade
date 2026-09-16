/** Mide la textura del partido: no solo goles, sino que tanto pasa. */
import { nuevaPartida } from '@/sim/juego';
import { fijarAzar, promedio } from './ayuda';
import { configurarEquipo } from '@/game/match/armarPartido';
import { MotorPartido } from '@/game/match/motor';
import { ENTRADA_VACIA } from '@/game/match/entidades';

const PASO = 1 / 60;
const restaurar = fijarAzar(4242);
const estado = nuevaPartida(4, 31337);
const primera = estado.clubs.filter((c) => c.division === 1);

const goles: number[] = [];
const remates: number[] = [];
const faltas: number[] = [];
const amarillas: number[] = [];
const rojas: number[] = [];
const cambiosDePosesion: number[] = [];
const pasesDados: number[] = [];
const laterales: number[] = [];
const corners: number[] = [];
const precision: number[] = [];

for (let i = 0; i < 90; i++) {
  const local = primera[i % primera.length];
  const visitante = primera[(i + 1 + (i % 4)) % primera.length];
  if (local.id === visitante.id) continue;

  const motor = new MotorPartido({
    usuario: configurarEquipo(estado, local.id, 'usuario'),
    rival: configurarEquipo(estado, visitante.id, 'rival'),
    usuarioEsLocal: true,
    estadio: 'x',
  });
  motor.iaTotal = true;

  let libres = 0;
  let cambios = 0;
  let pases = 0;
  let lat = 0;
  let cor = 0;
  let faseAnterior = motor.fase;
  let duenoAnterior: string | null = null;
  let paseEnCurso: { bando: string } | null = null;
  let completos = 0;
  let fallados = 0;

  for (let paso = 0; paso < 40000 && !motor.terminado; paso++) {
    motor.paso(PASO, ENTRADA_VACIA);

    if (motor.fase === 'libre' && faseAnterior !== 'libre') libres += 1;
    faseAnterior = motor.fase;

    if (motor.aviso?.titulo === 'LATERAL') lat += 1;
    if (motor.aviso?.titulo === 'CORNER') cor += 1;

    const dueno = motor.jugadores.find((j) => j.id === motor.pelota.duenoId);
    if (dueno && dueno.id !== duenoAnterior) {
      const previo = motor.jugadores.find((j) => j.id === duenoAnterior);
      if (previo && previo.bando !== dueno.bando) cambios += 1;
      duenoAnterior = dueno.id;
    }
    for (const e of motor.eventos) {
      if (e.tipo !== 'pase') continue;
      pases += 1;
      const quien = motor.jugadores.find((j) => j.id === motor.pelota.ultimoToqueId);
      paseEnCurso = quien ? { bando: quien.bando } : null;
    }
    motor.eventos.length = 0;
    if (paseEnCurso && motor.pelota.duenoId) {
      const recibe = motor.jugadores.find((j) => j.id === motor.pelota.duenoId)!;
      if (recibe.bando === paseEnCurso.bando) completos += 1;
      else fallados += 1;
      paseEnCurso = null;
    }
  }

  const r = motor.resultado();
  goles.push(r.golesUsuario + r.golesRival);
  remates.push(r.remates.usuario + r.remates.rival);
  faltas.push(libres);
  amarillas.push(r.amarillas.usuario + r.amarillas.rival);
  rojas.push(r.rojas.usuario + r.rojas.rival);
  cambiosDePosesion.push(cambios);
  pasesDados.push(pases);
  precision.push(completos + fallados > 0 ? (completos / (completos + fallados)) * 100 : 0);
  laterales.push(lat);
  corners.push(cor);
}
restaurar();

const g = promedio(goles);
const rem = promedio(remates);
console.log(`goles ${g.toFixed(2)} | remates ${rem.toFixed(1)} | conversion ${((g / rem) * 100).toFixed(0)}%`);
console.log(`faltas ${promedio(faltas).toFixed(1)} | amarillas ${promedio(amarillas).toFixed(2)} | rojas ${promedio(rojas).toFixed(2)}`);
console.log(`pases ${promedio(pasesDados).toFixed(0)} | precision ${promedio(precision).toFixed(0)}% | robos ${promedio(cambiosDePosesion).toFixed(0)}`);
