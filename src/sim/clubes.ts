import type { Club, Division } from './types';
import type { PlantillaClub } from './nombres';
import { Rng } from './rng';
import { ENTRENAMIENTO_POR_DEFECTO, TACTICAS_POR_DEFECTO } from './tacticas';
import { precioEntradaSugerido } from './finanzas';

/**
 * Creacion de clubes a partir de una plantilla. Vive aparte de `juego.ts`
 * porque lo necesitan tanto la partida nueva como las migraciones de guardado.
 */
export function crearClub(plantilla: PlantillaClub, id: string, division: Division, rng: Rng): Club {
  const club: Club = {
    id,
    division,
    nombre: plantilla.nombre,
    abrev: plantilla.abrev,
    colorPrimario: plantilla.colorPrimario,
    colorSecundario: plantilla.colorSecundario,
    esUsuario: false,
    reputacion: plantilla.reputacion,
    dinero: Math.round(plantilla.reputacion * 2_500_000 + rng.int(-2, 2) * 8_000_000),
    estadio: {
      nombre: plantilla.estadio,
      capacidad: plantilla.capacidad,
      nivel: Math.round(plantilla.reputacion / 14),
    },
    socios: Math.round(plantilla.capacidad * rng.float(0.55, 0.85)),
    precioEntrada: 0,
    sponsorSemanal: Math.round(plantilla.reputacion * 130_000),
    cantera: Math.max(1, Math.round(plantilla.reputacion / 12)),
    tacticas: { ...TACTICAS_POR_DEFECTO },
    entrenamiento: { ...ENTRENAMIENTO_POR_DEFECTO },
    titulares: [],
  };

  club.precioEntrada = precioEntradaSugerido(club);
  return club;
}
