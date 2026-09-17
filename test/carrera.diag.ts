/** Corre varias temporadas y mira si la carrera de la gente quedo registrada. */
import { nuevaPartida, clubPorId } from '@/sim/juego';
import { carreraDe } from '@/sim/historial';
import { fijarAzar, correrTemporada, promedio } from './ayuda';

const restaurar = fijarAzar(2026);
const estado = nuevaPartida(4, 5150);
const pesar = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
const antes = pesar(estado);

for (let t = 0; t < 5; t++) correrTemporada(estado);
restaurar();

const despues = pesar(estado);
const conHistoria = estado.jugadores.filter((j) => j.historial.length > 0);
console.log(`temporada ${estado.temporada} | ${conHistoria.length}/${estado.jugadores.length} con historia`);
console.log(`guardado ${(antes / 1024).toFixed(0)} kB -> ${(despues / 1024).toFixed(0)} kB (+${((despues - antes) / 1024).toFixed(0)} kB por 5 temporadas)`);

const filas = conHistoria.flatMap((j) => j.historial);
console.log(`${filas.length} temporadas guardadas | nota media ${promedio(filas.map((f) => f.nota)).toFixed(2)} | goles por temporada ${promedio(filas.map((f) => f.goles)).toFixed(1)} | asistencias ${promedio(filas.map((f) => f.asistencias)).toFixed(1)}`);

// La escala simulada tiene que coincidir con la del partido jugado.
console.log('(la escala del partido jugado en 3D promedia 6.2: si esto se aleja, la carrera mezcla dos escalas)');

// La carrera mas larga, para ver como se lee.
const mejor = conHistoria.sort((a, b) => carreraDe(b).goles - carreraDe(a).goles)[0];
if (mejor) {
  const c = carreraDe(mejor);
  console.log(`\n${mejor.nombre}, ${mejor.edad} anos, ${mejor.pos}, media ${mejor.media}`);
  console.log(`  carrera: ${c.temporadas} temporadas, ${c.partidos} PJ, ${c.goles} goles, ${c.asistencias} asistencias, nota ${c.nota}, ${c.clubes} clubes`);
  for (const t of mejor.historial) {
    const club = t.clubId ? clubPorId(estado, t.clubId).abrev : 'libre';
    console.log(`  T${t.temporada}  ${String(t.edad).padStart(2)} anos  ${club}  div ${t.division}  ${String(t.partidos).padStart(2)} PJ  ${String(t.goles).padStart(2)}g ${t.asistencias}a  nota ${t.nota}  media ${t.media}`);
  }
}
