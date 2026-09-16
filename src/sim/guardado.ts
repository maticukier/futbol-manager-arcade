import type { EstadoJuego } from './types';
import { migrar } from './migraciones';

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
    // No se descarta la carrera por un cambio de formato: se migra.
    return migrar(JSON.parse(crudo));
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
