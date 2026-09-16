import type { EstadoJuego } from '@/sim/types';
import { clubPorId, plantelDe } from '@/sim/juego';
import { disponible, onceTitular } from '@/sim/liga';
import type { Bando, ConfiguracionEquipo, ConfiguracionPartido, JugadorDeEquipo } from './entidades';

/** Cuantos suplentes viajan al banco. */
const LUGARES_EN_EL_BANCO = 9;

/**
 * Arma la configuracion que necesita el motor a partir del estado de la
 * partida. Vive aparte de la interfaz para que los tests puedan simular
 * partidos sin abrir nada en pantalla.
 */
export function configurarEquipo(estado: EstadoJuego, clubId: string, bando: Bando): ConfiguracionEquipo {
  const club = clubPorId(estado, clubId);
  const plantel = plantelDe(estado, clubId);
  const once = onceTitular(club, plantel);
  const titulares = new Set(once.map((j) => j.id));

  const aFicha = (j: (typeof plantel)[number]): JugadorDeEquipo => ({
    id: j.id,
    nombre: j.nombre,
    attrs: j.attrs,
    pos: j.pos,
    media: j.media,
    forma: j.forma,
  });

  return {
    bando,
    nombre: club.nombre,
    abrev: club.abrev,
    colorPrimario: club.colorPrimario,
    colorSecundario: club.colorSecundario,
    tacticas: club.tacticas,
    jugadores: once.map(aFicha),
    // Al banco van los que estan disponibles y no son titulares.
    suplentes: plantel
      .filter((j) => !titulares.has(j.id) && disponible(j))
      .sort((a, b) => b.media - a.media)
      .slice(0, LUGARES_EN_EL_BANCO)
      .map(aFicha),
  };
}

export function configurarPartido(
  estado: EstadoJuego,
  rivalId: string,
  usuarioEsLocal: boolean,
  estadio: string,
): ConfiguracionPartido {
  return {
    usuario: configurarEquipo(estado, estado.clubUsuarioId, 'usuario'),
    rival: configurarEquipo(estado, rivalId, 'rival'),
    usuarioEsLocal,
    estadio,
  };
}
