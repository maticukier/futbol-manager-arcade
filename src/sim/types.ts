/**
 * Modelo de datos del juego. Toda esta capa es TypeScript puro, sin Phaser:
 * la simulacion tiene que poder correr sin pantalla (partidos de la IA,
 * avance de temporada, tests).
 */

import type { RasgoId } from './rasgos';

export type PosicionCodigo = 'ARQ' | 'DEF' | 'MED' | 'DEL';

/** Atributos 1-99, al estilo de las medias clasicas de los juegos de futbol. */
export interface Atributos {
  ritmo: number;
  regate: number;
  pase: number;
  tiro: number;
  quite: number;
  fisico: number;
  arquero: number;
}

export interface Jugador {
  id: string;
  nombre: string;
  edad: number;
  pos: PosicionCodigo;
  attrs: Atributos;
  media: number;
  potencial: number;
  /** 0-100. Afecta rendimiento y pedidos de transferencia. */
  moral: number;
  /** 0-100. Baja con los partidos y sube descansando. */
  forma: number;
  lesionSemanas: number;
  /** Salario semanal en pesos del juego. */
  salario: number;
  valor: number;
  clubId: string | null;
  contratoSemanas: number;
  golesTemporada: number;
  partidosTemporada: number;
  amarillasTemporada: number;
  /** Fechas que le quedan de suspension. */
  sancionPartidos: number;
  /**
   * Puntos ocultos de evolucion. Suben jugando y con la edad a favor, bajan
   * pasados los treinta. Al llegar a 100 o a -100 se traducen en un punto de
   * atributo, asi que nadie mejora todas las semanas.
   */
  progreso: number;
  /** Liga de la que viene, si esta en el mercado internacional. */
  ligaOrigen?: string;
  /** Rasgos a la vista: lo que se puede planificar antes de ficharlo. */
  rasgos: RasgoId[];
  /** El que recien se nota despues de verlo jugar varios partidos. */
  rasgoOculto: RasgoId | null;
  /** Partidos que el usuario le vio jugar, para destapar el rasgo oculto. */
  partidosObservado: number;
}

export type Formacion = '4-4-2' | '4-3-3' | '3-5-2' | '5-3-2' | '4-2-3-1';

export interface Tacticas {
  formacion: Formacion;
  /** 0-100: que tan arriba presiona el equipo. */
  presion: number;
  /** 0-100: altura de la linea defensiva. */
  lineaDefensiva: number;
  /** 0-100: 0 = juego pausado y de posesion, 100 = vertical y directo. */
  ritmo: number;
  /** 0-100: 0 = todos atras, 100 = todos al ataque. */
  mentalidad: number;
}

export interface Estadio {
  nombre: string;
  capacidad: number;
  /** Nivel de comodidades: sube ingresos por hincha y reputacion. */
  nivel: number;
}

/** Reparto del foco del entrenamiento semanal. Los tres suman 100. */
export interface Entrenamiento {
  fisico: number;
  tecnica: number;
  tactica: number;
}

export type Division = 1 | 2;

export interface Club {
  id: string;
  division: Division;
  nombre: string;
  abrev: string;
  colorPrimario: string;
  colorSecundario: string;
  esUsuario: boolean;
  /** 1-100. Define calidad del plantel, sponsors y expectativas. */
  reputacion: number;
  dinero: number;
  estadio: Estadio;
  socios: number;
  precioEntrada: number;
  sponsorSemanal: number;
  /** Nivel de la cantera: mejora los juveniles que aparecen cada temporada. */
  cantera: number;
  tacticas: Tacticas;
  entrenamiento: Entrenamiento;
  /** ids de los 11 titulares elegidos por el usuario (o por la IA). */
  titulares: string[];
}

export interface Partido {
  id: string;
  division: Division;
  jornada: number;
  localId: string;
  visitanteId: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  jugado: boolean;
  /** true si lo jugo el usuario en modo arcade. */
  arcade: boolean;
}

export interface LlaveCopa {
  id: string;
  ronda: number;
  localId: string;
  visitanteId: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  jugado: boolean;
  /** Quien paso de ronda. */
  ganadorId: string | null;
}

export interface Copa {
  ronda: number;
  llaves: LlaveCopa[];
  /** Clubes que siguen vivos en la ronda actual. */
  vivos: string[];
  campeonId: string | null;
}

export interface FilaTabla {
  clubId: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  dif: number;
  pts: number;
}

export type TipoMensaje = 'directorio' | 'finanzas' | 'plantel' | 'liga' | 'mercado';

export interface Mensaje {
  id: string;
  semana: number;
  tipo: TipoMensaje;
  titulo: string;
  cuerpo: string;
  leido: boolean;
}

export interface Directorio {
  /** Posicion que el directorio espera al final de la temporada. */
  expectativaPosicion: number;
  /** 0-100. Si llega a 0 te echan. */
  confianza: number;
  /** Presupuesto de fichajes asignado para la temporada. */
  presupuestoFichajes: number;
}

export interface MovimientoFinanciero {
  semana: number;
  concepto: string;
  monto: number;
}

export interface EstadoJuego {
  version: number;
  seed: number;
  temporada: number;
  semana: number;
  clubUsuarioId: string;
  clubs: Club[];
  jugadores: Jugador[];
  fixture: Partido[];
  jornadaActual: number;
  /** Jugadores libres del exterior, ofrecidos en el mercado de pases. */
  mercadoExtranjero: string[];
  copa: Copa;
  directorio: Directorio;
  bandeja: Mensaje[];
  finanzas: MovimientoFinanciero[];
  /** Historial de temporadas cerradas: temporada -> posicion del usuario. */
  historial: { temporada: number; posicion: number; pts: number }[];
  despedido: boolean;
}
