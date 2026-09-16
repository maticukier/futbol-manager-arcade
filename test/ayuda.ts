import { Rng } from '@/sim/rng';
import { cerrarTemporada, resolverJornada, type ResumenTemporada } from '@/sim/juego';
import { totalJornadas } from '@/sim/liga';
import type { EstadoJuego } from '@/sim/types';
import { configurarEquipo } from '@/game/match/armarPartido';
import { MotorPartido } from '@/game/match/motor';
import { ENTRADA_VACIA, type ResultadoPartido } from '@/game/match/entidades';

/**
 * El motor del partido usa Math.random. Para que los tests de balance den lo
 * mismo en cada corrida, se reemplaza por un generador con semilla.
 */
export function fijarAzar(semilla: number): () => void {
  const rng = new Rng(semilla);
  const original = Math.random;
  Math.random = () => rng.next();
  return () => {
    Math.random = original;
  };
}

/** Juega un partido completo con los dos equipos manejados por la IA. */
export function jugarPartidoCompleto(
  estado: EstadoJuego,
  localId: string,
  visitanteId: string,
): { motor: MotorPartido; resultado: ResultadoPartido } {
  const motor = new MotorPartido({
    usuario: configurarEquipo(estado, localId, 'usuario'),
    rival: configurarEquipo(estado, visitanteId, 'rival'),
    usuarioEsLocal: true,
    estadio: 'Cancha de prueba',
  });
  motor.iaTotal = true;

  // Tope de pasos por si algo se traba: un partido son unos 11.000.
  for (let i = 0; i < 40_000 && !motor.terminado; i++) {
    motor.paso(1 / 60, ENTRADA_VACIA);
  }

  return { motor, resultado: motor.resultado() };
}

/** Simula una temporada entera de liga y devuelve su cierre. */
export function correrTemporada(estado: EstadoJuego): ResumenTemporada | null {
  const jornadas = totalJornadas(estado.fixture);
  for (let i = 0; i < jornadas + 2; i++) {
    const resumen = resolverJornada(estado, null);
    if (resumen.temporadaTerminada) return cerrarTemporada(estado);
  }
  return null;
}

/** Promedio de una lista, o cero si esta vacia. */
export function promedio(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}
