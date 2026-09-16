/** Mira si las notas y los rasgos dicen algo, o si son un numero decorativo. */
import { nuevaPartida } from '@/sim/juego';
import { fijarAzar, jugarPartidoCompleto, promedio } from './ayuda';
import { figuraDelPartido, type NotaJugador } from '@/sim/rendimiento';
import { RASGOS, efectosDe } from '@/sim/rasgos';

const restaurar = fijarAzar(31);
const estado = nuevaPartida(4, 909);
const primera = estado.clubs.filter((c) => c.division === 1);

const todas: NotaJugador[] = [];
const figuras: NotaJugador[] = [];
const conGol: number[] = [];
const sinGol: number[] = [];

for (let i = 0; i < 24; i++) {
  const local = primera[i % primera.length];
  const visitante = primera[(i + 5) % primera.length];
  if (local.id === visitante.id) continue;
  const { resultado } = jugarPartidoCompleto(estado, local.id, visitante.id);
  const notas = [...resultado.notas.usuario, ...resultado.notas.rival];
  todas.push(...notas);
  const figura = figuraDelPartido(notas);
  if (figura) figuras.push(figura);
  for (const n of notas) (n.stats.goles > 0 ? conGol : sinGol).push(n.nota);
}
restaurar();

const valores = todas.map((n) => n.nota).sort((a, b) => a - b);
const pct = (p: number) => valores[Math.floor(valores.length * p)];
console.log(`notas: min ${valores[0]} | p25 ${pct(0.25)} | mediana ${pct(0.5)} | p75 ${pct(0.75)} | max ${valores[valores.length - 1]}`);
console.log(`promedio ${promedio(valores).toFixed(2)} | con gol ${promedio(conGol).toFixed(2)} | sin gol ${promedio(sinGol).toFixed(2)}`);
console.log(`figura promedio ${promedio(figuras.map((f) => f.nota)).toFixed(2)}`);
const ejemplo = figuras[0];
if (ejemplo) console.log(`ej: ${ejemplo.nombre} ${ejemplo.nota} (${ejemplo.stats.goles}g ${ejemplo.stats.asistencias}a ${ejemplo.stats.remates}rem ${ejemplo.stats.pasesCompletados}/${ejemplo.stats.pases}p ${ejemplo.stats.quites}q)`);

// Reparto de rasgos en el mundo.
const cuenta = new Map<string, number>();
let sinRasgo = 0;
for (const j of estado.jugadores) {
  if (j.rasgos.length === 0) sinRasgo += 1;
  for (const r of [...j.rasgos, ...(j.rasgoOculto ? [j.rasgoOculto] : [])]) {
    cuenta.set(r, (cuenta.get(r) ?? 0) + 1);
  }
}
const total = estado.jugadores.length;
console.log(`\n${total} jugadores, ${((sinRasgo / total) * 100).toFixed(0)}% sin rasgo visible`);
for (const [id, n] of [...cuenta.entries()].sort((a, b) => b[1] - a[1])) {
  const r = RASGOS[id as keyof typeof RASGOS];
  console.log(`  ${((n / total) * 100).toFixed(1).padStart(5)}%  ${r.oculto ? 'oculto ' : 'visible'}  ${r.nombre}`);
}
console.log('\nefectos de un canonero definidor:', JSON.stringify(efectosDe(['canonero', 'definidor'])));
