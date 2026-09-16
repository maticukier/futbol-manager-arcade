import type { EstadoJuego, Jugador } from './types';
import { salarioSemanal } from './jugadores';
import { clubUsuario, registrar } from './finanzas';
import { crearMensaje, plantelDe } from './juego';

/**
 * Contratos: cada semana se descuenta una, y el que llega a cero se va libre.
 * Renovar cuesta una prima y sube el sueldo, asi que dejarlo para ultimo
 * momento es barato en el corto plazo y caro cuando el jugador se va gratis.
 */

export const SEMANAS_AVISO = 30;
export const SEMANAS_URGENTE = 10;
const SEMANAS_RENOVACION = 150;

/** Lo que pide para firmar de nuevo: mas que su sueldo actual. */
export function salarioPedido(j: Jugador): number {
  const base = salarioSemanal(j.valor, j.media);
  const margen = 1.08 + Math.max(0, j.potencial - j.media) / 90 + (j.edad <= 24 ? 0.12 : 0);
  return Math.round((base * margen) / 1000) * 1000;
}

/** Prima de firma: unas seis semanas del sueldo nuevo. */
export function primaDeRenovacion(j: Jugador): number {
  return Math.round((salarioPedido(j) * 6) / 100_000) * 100_000;
}

export function renovarContrato(estado: EstadoJuego, jugadorId: string): string {
  const club = clubUsuario(estado);
  const jugador = plantelDe(estado, club.id).find((j) => j.id === jugadorId);
  if (!jugador) return 'Ese jugador no es del club.';

  const prima = primaDeRenovacion(jugador);
  if (club.dinero < prima) return 'No te alcanza para la prima de firma.';

  // Un jugador que no juega y esta desmotivado puede negarse.
  if (jugador.moral < 35 && jugador.partidosTemporada < 3) {
    return `${jugador.nombre} no quiere renovar: casi no juega.`;
  }

  registrar(estado, `Prima de renovacion de ${jugador.nombre}`, -prima);
  jugador.salario = salarioPedido(jugador);
  jugador.contratoSemanas = SEMANAS_RENOVACION;
  jugador.moral = Math.min(100, jugador.moral + 12);

  return `${jugador.nombre} renovo por ${SEMANAS_RENOVACION} semanas.`;
}

/** Corre una semana de todos los contratos y deja irse a los que vencieron. */
export function avanzarContratos(estado: EstadoJuego): void {
  const club = clubUsuario(estado);

  for (const j of estado.jugadores) {
    if (!j.clubId || j.contratoSemanas <= 0) continue;
    j.contratoSemanas -= 1;
    const propio = j.clubId === club.id;

    if (j.contratoSemanas === SEMANAS_AVISO && propio) {
      crearMensaje(
        estado,
        'plantel',
        `A ${j.nombre} le quedan ${SEMANAS_AVISO} semanas`,
        `Pide $${salarioPedido(j).toLocaleString('es-AR')} por semana para renovar.`,
      );
    }

    if (j.contratoSemanas === SEMANAS_URGENTE && propio) {
      crearMensaje(
        estado,
        'plantel',
        `${j.nombre} esta por quedar libre`,
        'Si no renueva ahora, se va sin dejar un peso.',
      );
    }

    if (j.contratoSemanas > 0) continue;

    // Se le termino: queda libre y sale del plantel.
    const eraPropio = propio;
    j.clubId = null;
    j.ligaOrigen = j.ligaOrigen ?? 'Libre';
    if (!estado.mercadoExtranjero.includes(j.id)) estado.mercadoExtranjero.push(j.id);
    if (eraPropio) {
      club.titulares = club.titulares.filter((id) => id !== j.id);
      crearMensaje(estado, 'plantel', `${j.nombre} se fue libre`, 'Se le vencio el contrato y no lo renovaste.');
    }
  }
}
