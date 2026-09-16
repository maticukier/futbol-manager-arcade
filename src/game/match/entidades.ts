import type { Atributos, PosicionCodigo, Tacticas } from '@/sim/types';

export type Bando = 'usuario' | 'rival';

/** Lo que esta haciendo el jugador, para decidir el movimiento y la animacion. */
export type EstadoJugador = 'normal' | 'barrida' | 'caido' | 'pateando';

export interface JugadorPartido {
  id: string;
  nombre: string;
  dorsal: number;
  bando: Bando;
  pos: PosicionCodigo;
  attrs: Atributos;
  /** Puesto en la formacion, normalizado: ancho 0-1, largo 0 (arco propio) a 1. */
  baseAncho: number;
  baseLargo: number;

  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Hacia donde mira, en radianes sobre el plano de la cancha. */
  rumbo: number;

  energia: number;
  esArquero: boolean;
  estado: EstadoJugador;
  /** Mientras sea mayor que cero, no puede tocar la pelota. */
  bloqueo: number;
  /** Tiempo que le queda a la barrida o a la caida. */
  temporizador: number;
  /** Fase del ciclo de carrera, para animar piernas y brazos. */
  paso: number;
  /** Cuenta regresiva de la animacion de patear. */
  patada: number;
}

export interface Pelota {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  duenoId: string | null;
  ultimoToqueId: string | null;
  bloqueoPosesion: number;
  /** Giro acumulado, solo para que la esfera ruede en el render. */
  giro: number;
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
  usuarioEsLocal: boolean;
  estadio: string;
}

export interface ResultadoPartido {
  golesUsuario: number;
  golesRival: number;
  goleadoresUsuario: string[];
  goleadoresRival: string[];
  remates: { usuario: number; rival: number };
  posesion: { usuario: number; rival: number };
}

/** Los tres botones cambian de funcion segun tengas o no la pelota. */
export interface EntradaPartido {
  moverX: number;
  moverZ: number;
  /** Pase al ras, o cambio de jugador marcado. */
  a: boolean;
  /** Tiro al arco, o barrida. */
  b: boolean;
  /** Pase bombeado y centros, o presion en bloque. */
  c: boolean;
  /** 0-1: cuanto se mantuvo apretado el boton antes de soltarlo. */
  potencia: number;
}

export const ENTRADA_VACIA: EntradaPartido = {
  moverX: 0,
  moverZ: 0,
  a: false,
  b: false,
  c: false,
  potencia: 0.6,
};

export type FaseJuego =
  | 'saque_inicial'
  | 'jugando'
  | 'gol'
  | 'lateral'
  | 'saque_arco'
  | 'corner'
  | 'libre'
  | 'entretiempo'
  | 'final';

/** Aviso corto para mostrar en pantalla mientras el juego esta detenido. */
export interface AvisoPartido {
  titulo: string;
  detalle: string;
}
