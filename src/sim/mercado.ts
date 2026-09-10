import type { EstadoJuego, Jugador } from './types';
import { Rng } from './rng';
import { clubPorId, crearMensaje, plantelDe } from './juego';
import { clubUsuario, registrar } from './finanzas';
import { onceAutomatico } from './liga';

/**
 * Mercado de pases simplificado: cada club de la IA pone en lista a los
 * jugadores que le sobran, y el usuario compra o vende con recargo.
 */

export interface OfertaMercado {
  jugador: Jugador;
  clubVendedorId: string | null;
  precio: number;
}

const RECARGO_COMPRA = 1.2;
const CASTIGO_VENTA = 0.85;

export function listaDePases(estado: EstadoJuego, jornadaSemilla = estado.jornadaActual): OfertaMercado[] {
  const rng = new Rng(estado.seed + estado.temporada * 31 + jornadaSemilla);
  const ofertas: OfertaMercado[] = [];

  for (const club of estado.clubs) {
    if (club.id === estado.clubUsuarioId) continue;
    const plantel = plantelDe(estado, club.id);
    const titulares = new Set(onceAutomatico(club, plantel).map((j) => j.id));
    const suplentes = plantel.filter((j) => !titulares.has(j.id) && j.lesionSemanas === 0);

    for (const j of suplentes) {
      // No todos los suplentes estan en venta: eso mantiene el mercado escaso.
      if (!rng.chance(0.35)) continue;
      ofertas.push({
        jugador: j,
        clubVendedorId: club.id,
        precio: Math.round((j.valor * RECARGO_COMPRA) / 1000) * 1000,
      });
    }
  }

  return ofertas.sort((a, b) => b.jugador.media - a.jugador.media).slice(0, 24);
}

export function comprar(estado: EstadoJuego, jugadorId: string): string {
  const club = clubUsuario(estado);
  const oferta = listaDePases(estado).find((o) => o.jugador.id === jugadorId);
  if (!oferta) return 'Ese jugador ya no esta disponible.';
  if (plantelDe(estado, club.id).length >= 28) return 'El plantel esta completo (28 jugadores).';
  if (club.dinero < oferta.precio) return 'No te alcanza la plata.';

  registrar(estado, `Fichaje de ${oferta.jugador.nombre}`, -oferta.precio);
  if (oferta.clubVendedorId) {
    clubPorId(estado, oferta.clubVendedorId).dinero += oferta.precio;
  }
  oferta.jugador.clubId = club.id;
  oferta.jugador.moral = 75;
  oferta.jugador.contratoSemanas = 120;

  crearMensaje(
    estado,
    'mercado',
    `Fichaje cerrado: ${oferta.jugador.nombre}`,
    `Llega por $${oferta.precio.toLocaleString('es-AR')}. Media ${oferta.jugador.media}, ${oferta.jugador.edad} anos, ${oferta.jugador.pos}.`,
  );
  return `Fichaste a ${oferta.jugador.nombre}.`;
}

export function vender(estado: EstadoJuego, jugadorId: string): string {
  const club = clubUsuario(estado);
  const plantel = plantelDe(estado, club.id);
  if (plantel.length <= 16) return 'Necesitas al menos 16 jugadores en el plantel.';

  const jugador = plantel.find((j) => j.id === jugadorId);
  if (!jugador) return 'Ese jugador no es del club.';

  const precio = Math.round((jugador.valor * CASTIGO_VENTA) / 1000) * 1000;
  const comprador = estado.clubs
    .filter((c) => c.id !== club.id && c.dinero > precio)
    .sort((a, b) => b.reputacion - a.reputacion)[0];

  if (!comprador) return 'Ningun club puede pagar ese precio ahora.';

  comprador.dinero -= precio;
  jugador.clubId = comprador.id;
  registrar(estado, `Venta de ${jugador.nombre}`, precio);
  club.titulares = club.titulares.filter((id) => id !== jugador.id);

  crearMensaje(
    estado,
    'mercado',
    `Vendiste a ${jugador.nombre}`,
    `${comprador.nombre} paga $${precio.toLocaleString('es-AR')}.`,
  );
  return `${jugador.nombre} se va a ${comprador.nombre} por $${precio.toLocaleString('es-AR')}.`;
}
