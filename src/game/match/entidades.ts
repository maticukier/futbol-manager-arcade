import type { Atributos, PosicionCodigo, Tacticas } from '@/sim/types';

export type Bando = 'usuario' | 'rival';

export interface JugadorPartido {
  id: string;
  nombre: string;
  dorsal: number;
  bando: Bando;
  pos: PosicionCodigo;
  attrs: Atributos;
  /** Posicion base normalizada de su puesto en la formacion. */
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Cansancio 0-1: reduce velocidad a medida que avanza el partido. */
  energia: number;
  esArquero: boolean;
  /** Bloquea el robo inmediato despues de perder o tocar la pelota. */
  bloqueo: number;
}

export interface Pelota {
  x: number;
  y: number;
  vx: number;
  vy: number;
  duenoId: string | null;
  /** Impide que el que acaba de pasar la recupere en el mismo toque. */
  ultimoToqueId: string | null;
  bloqueoPosesion: number;
}

export interface ConfiguracionEquipo {
  bando: Bando;
  nombre: string;
  abrev: string;
  colorPrimario: string;
  colorSecundario: string;
  tacticas: Tacticas;
  jugadores: {
    id: string;
    nombre: string;
    attrs: Atributos;
    pos: PosicionCodigo;
    media: number;
    forma: number;
  }[];
}

export interface ConfiguracionPartido {
  usuario: ConfiguracionEquipo;
  rival: ConfiguracionEquipo;
  /** true si el club del usuario juega de local (afecta el marcador final). */
  usuarioEsLocal: boolean;
  estadio: string;
}

export interface ResultadoPartido {
  golesUsuario: number;
  golesRival: number;
  goleadoresUsuario: string[];
  goleadoresRival: string[];
  /** Estadisticas para la pantalla de resumen. */
  remates: { usuario: number; rival: number };
  posesion: { usuario: number; rival: number };
}
