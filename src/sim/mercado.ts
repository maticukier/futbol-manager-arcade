import type { EstadoJuego, Jugador, PosicionCodigo } from './types';
import { Rng } from './rng';
import { clubPorId, crearMensaje, plantelDe } from './juego';
import { clubUsuario, registrar } from './finanzas';
import { onceAutomatico } from './liga';

/**
 * Mercado de pases: lo que sobra en los planteles de la liga local mas una
 * bolsa de jugadores libres del exterior que se renueva cada temporada.
 */

export interface OfertaMercado {
  jugador: Jugador;
  clubVendedorId: string | null;
  /** Nombre de la liga de origen, o null si es de la liga local. */
  ligaOrigen: string | null;
  precio: number;
}

export interface FiltroMercado {
  puesto: PosicionCodigo | 'TODOS';
  mediaMinima: number;
  /** 0 significa sin tope. */
  precioMaximo: number;
  origen: 'todos' | 'local' | 'exterior';
  texto: string;
}

export const FILTRO_INICIAL: FiltroMercado = {
  puesto: 'TODOS',
  mediaMinima: 0,
  precioMaximo: 0,
  origen: 'todos',
  texto: '',
};

const RECARGO_COMPRA = 1.2;
/** Traer a alguien de afuera sale mas caro: pase, intermediarios y mudanza. */
const RECARGO_EXTERIOR = 1.4;
const CASTIGO_VENTA = 0.85;

/** Todas las ofertas disponibles, sin filtrar. */
function ofertasCompletas(estado: EstadoJuego): OfertaMercado[] {
  const rng = new Rng(estado.seed + estado.temporada * 31 + estado.jornadaActual);
  const ofertas: OfertaMercado[] = [];

  for (const club of estado.clubs) {
    if (club.id === estado.clubUsuarioId) continue;
    const plantel = plantelDe(estado, club.id);
    const titulares = new Set(onceAutomatico(club, plantel).map((j) => j.id));

    for (const j of plantel) {
      if (titulares.has(j.id) || j.lesionSemanas > 0) continue;
      // No todos los suplentes estan en venta: eso mantiene el mercado escaso.
      if (!rng.chance(0.4)) continue;
      ofertas.push({
        jugador: j,
        clubVendedorId: club.id,
        ligaOrigen: null,
        precio: Math.round((j.valor * RECARGO_COMPRA) / 1000) * 1000,
      });
    }
  }

  const disponibles = new Set(estado.mercadoExtranjero);
  for (const j of estado.jugadores) {
    if (!disponibles.has(j.id) || j.clubId !== null) continue;
    ofertas.push({
      jugador: j,
      clubVendedorId: null,
      ligaOrigen: j.ligaOrigen ?? 'Exterior',
      precio: Math.round((j.valor * RECARGO_EXTERIOR) / 1000) * 1000,
    });
  }

  return ofertas;
}

export function listaDePases(estado: EstadoJuego, filtro: FiltroMercado = FILTRO_INICIAL): OfertaMercado[] {
  const texto = filtro.texto.trim().toLowerCase();

  return ofertasCompletas(estado)
    .filter((o) => {
      if (filtro.puesto !== 'TODOS' && o.jugador.pos !== filtro.puesto) return false;
      if (o.jugador.media < filtro.mediaMinima) return false;
      if (filtro.precioMaximo > 0 && o.precio > filtro.precioMaximo) return false;
      if (filtro.origen === 'local' && o.ligaOrigen !== null) return false;
      if (filtro.origen === 'exterior' && o.ligaOrigen === null) return false;
      if (texto && !o.jugador.nombre.toLowerCase().includes(texto)) return false;
      return true;
    })
    .sort((a, b) => b.jugador.media - a.jugador.media)
    .slice(0, 40);
}

/** Ligas que aparecen en las ofertas de hoy, para armar el desplegable. */
export function ligasEnElMercado(estado: EstadoJuego): string[] {
  const ligas = new Set<string>();
  for (const oferta of ofertasCompletas(estado)) {
    if (oferta.ligaOrigen) ligas.add(oferta.ligaOrigen);
  }
  return [...ligas].sort();
}

export function comprar(estado: EstadoJuego, jugadorId: string): string {
  const club = clubUsuario(estado);
  const oferta = ofertasCompletas(estado).find((o) => o.jugador.id === jugadorId);
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
  estado.mercadoExtranjero = estado.mercadoExtranjero.filter((id) => id !== oferta.jugador.id);

  const procedencia = oferta.ligaOrigen ? ` Llega de la ${oferta.ligaOrigen}.` : '';
  crearMensaje(
    estado,
    'mercado',
    `Fichaje cerrado: ${oferta.jugador.nombre}`,
    `Cuesta $${oferta.precio.toLocaleString('es-AR')}. Media ${oferta.jugador.media}, ${oferta.jugador.edad} anos, ${oferta.jugador.pos}.${procedencia}`,
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
