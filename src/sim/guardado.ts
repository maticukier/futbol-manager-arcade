import type { EstadoJuego } from './types';
import { VERSION_PARTIDA } from './juego';

const CLAVE = 'fma:partida';

export function guardar(estado: EstadoJuego): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena): la partida sigue en memoria.
  }
}

export function cargar(): EstadoJuego | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const estado = JSON.parse(crudo) as EstadoJuego;
    if (estado.version !== VERSION_PARTIDA) return null;
    return estado;
  } catch {
    return null;
  }
}

export function borrar(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que hacer.
  }
}

export function hayPartidaGuardada(): boolean {
  return cargar() !== null;
}
