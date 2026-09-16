import type { Club, EstadoJuego, Jugador, MovimientoFinanciero } from './types';
import { Rng } from './rng';

/**
 * Capa "presidente del club": entradas, socios, sponsors, estadio y cantera.
 * La idea es que subir el precio de la entrada gane plata hoy y espante gente
 * manana, para que la decision tenga costo.
 */

export const PRECIO_ENTRADA_MIN = 200;
export const PRECIO_ENTRADA_MAX = 4000;

export function precioEntradaSugerido(club: Club): number {
  return Math.round((600 + club.reputacion * 14) / 50) * 50;
}

export interface ResultadoTaquilla {
  asistencia: number;
  recaudacion: number;
  cambioSocios: number;
}

/**
 * Asistencia = socios disponibles, ajustada por precio, rival y racha.
 * Nunca supera la capacidad del estadio: por eso conviene ampliarlo.
 */
export function calcularTaquilla(
  club: Club,
  reputacionRival: number,
  animo: number,
  rng: Rng,
): ResultadoTaquilla {
  const justo = precioEntradaSugerido(club);
  const factorPrecio = Math.max(0.25, Math.min(1.25, 1.35 - (club.precioEntrada / justo) * 0.6));
  const factorRival = 0.85 + (reputacionRival / 100) * 0.35;
  const factorAnimo = 0.75 + (animo / 100) * 0.5;
  const factorEstadio = 1 + club.estadio.nivel * 0.04;

  const base = club.socios * factorPrecio * factorRival * factorAnimo * factorEstadio;
  const asistencia = Math.min(club.estadio.capacidad, Math.round(base * rng.float(0.92, 1.08)));

  const recaudacion = Math.round(asistencia * club.precioEntrada);

  // Si el precio es abusivo se pierden socios; si es accesible y el equipo anda bien, se ganan.
  const presionPrecio = (justo - club.precioEntrada) / justo;
  const cambioSocios = Math.round(club.socios * (presionPrecio * 0.012 + (animo - 50) / 6000));

  return { asistencia, recaudacion, cambioSocios };
}

export function masaSalarial(clubId: string, jugadores: Jugador[]): number {
  return jugadores.filter((j) => j.clubId === clubId).reduce((total, j) => total + j.salario, 0);
}

/** Ingreso semanal fijo por derechos de TV, segun reputacion. */
export function ingresoTv(club: Club): number {
  return Math.round(club.reputacion * 260_000);
}

/** Gasto fijo semanal: mantener el estadio y sostener las divisiones inferiores. */
export function gastoFijo(club: Club): number {
  return Math.round(club.estadio.capacidad * 220 + club.cantera * 900_000);
}

export function registrar(estado: EstadoJuego, concepto: string, monto: number): void {
  const club = clubUsuario(estado);
  club.dinero += monto;
  const mov: MovimientoFinanciero = { semana: estado.semana, concepto, monto };
  estado.finanzas.push(mov);
  // Guardo solo las ultimas 60 lineas: el resumen no necesita mas.
  if (estado.finanzas.length > 60) estado.finanzas.shift();
}

export function clubUsuario(estado: EstadoJuego): Club {
  const club = estado.clubs.find((c) => c.id === estado.clubUsuarioId);
  if (!club) throw new Error('No existe el club del usuario');
  return club;
}

export interface MejoraDisponible {
  clave: 'estadio' | 'cantera' | 'sponsor';
  titulo: string;
  detalle: string;
  costo: number;
  disponible: boolean;
}

export function costoAmpliarEstadio(club: Club): number {
  return Math.round((club.estadio.capacidad * 12_000 + club.estadio.nivel * 15_000_000) / 100_000) * 100_000;
}

export function costoMejorarCantera(club: Club): number {
  return Math.round((25_000_000 + club.cantera * 20_000_000) / 100_000) * 100_000;
}

export function costoRenegociarSponsor(club: Club): number {
  return Math.round((20_000_000 + club.sponsorSemanal * 4) / 100_000) * 100_000;
}

export function mejorasDisponibles(club: Club): MejoraDisponible[] {
  const ampliar = costoAmpliarEstadio(club);
  const cantera = costoMejorarCantera(club);
  const sponsor = costoRenegociarSponsor(club);
  return [
    {
      clave: 'estadio',
      titulo: `Ampliar ${club.estadio.nombre}`,
      detalle: `+5.000 lugares y +1 de comodidad (hoy: ${club.estadio.capacidad.toLocaleString('es-AR')} lugares, nivel ${club.estadio.nivel}).`,
      costo: ampliar,
      disponible: club.dinero >= ampliar && club.estadio.nivel < 10,
    },
    {
      clave: 'cantera',
      titulo: 'Invertir en la cantera',
      detalle: `Mejores juveniles cada temporada (nivel ${club.cantera} de 10).`,
      costo: cantera,
      disponible: club.dinero >= cantera && club.cantera < 10,
    },
    {
      clave: 'sponsor',
      titulo: 'Renegociar el sponsor',
      detalle: `Sube el ingreso semanal fijo (hoy $${club.sponsorSemanal.toLocaleString('es-AR')}).`,
      costo: sponsor,
      disponible: club.dinero >= sponsor,
    },
  ];
}

export function aplicarMejora(estado: EstadoJuego, clave: MejoraDisponible['clave']): string | null {
  const club = clubUsuario(estado);
  const opcion = mejorasDisponibles(club).find((m) => m.clave === clave);
  if (!opcion || !opcion.disponible) return 'No hay plata suficiente o ya llegaste al maximo.';

  registrar(estado, opcion.titulo, -opcion.costo);

  if (clave === 'estadio') {
    club.estadio.capacidad += 5000;
    club.estadio.nivel += 1;
    club.reputacion = Math.min(99, club.reputacion + 1);
    return `Estadio ampliado a ${club.estadio.capacidad.toLocaleString('es-AR')} lugares.`;
  }
  if (clave === 'cantera') {
    club.cantera += 1;
    return `Cantera nivel ${club.cantera}: los juveniles de la proxima temporada van a ser mejores.`;
  }
  const aumento = Math.round(club.sponsorSemanal * 0.25 + 2_000_000);
  club.sponsorSemanal += aumento;
  return `Nuevo contrato: +$${aumento.toLocaleString('es-AR')} por semana.`;
}
