import type {
  Club,
  EstadoJuego,
  Jugador,
  Mensaje,
  Partido,
  PosicionCodigo,
  TipoMensaje,
} from './types';
import { Rng, seedAleatoria } from './rng';
import { CLUBES_LIGA } from './nombres';
import { generarJugador, generarPlantel, salarioSemanal, valorDeMercado, calcularMedia } from './jugadores';
import { TACTICAS_POR_DEFECTO } from './tacticas';
import {
  calcularTabla,
  fuerzaEquipo,
  generarFixture,
  onceAutomatico,
  onceTitular,
  partidosDeJornada,
  posicionEnTabla,
  simularPartido,
  totalJornadas,
} from './liga';
import {
  calcularTaquilla,
  clubUsuario,
  ingresoTv,
  masaSalarial,
  precioEntradaSugerido,
  registrar,
} from './finanzas';

export const VERSION_PARTIDA = 1;

let contadorMensaje = 0;
export function crearMensaje(
  estado: EstadoJuego,
  tipo: TipoMensaje,
  titulo: string,
  cuerpo: string,
): void {
  contadorMensaje += 1;
  const mensaje: Mensaje = {
    id: `m${Date.now().toString(36)}${contadorMensaje.toString(36)}`,
    semana: estado.semana,
    tipo,
    titulo,
    cuerpo,
    leido: false,
  };
  estado.bandeja.unshift(mensaje);
  if (estado.bandeja.length > 40) estado.bandeja.pop();
}

export function nuevaPartida(indiceClubUsuario: number, seed = seedAleatoria()): EstadoJuego {
  const rng = new Rng(seed);

  const clubs: Club[] = CLUBES_LIGA.map((plantilla, i) => ({
    id: `c${i}`,
    nombre: plantilla.nombre,
    abrev: plantilla.abrev,
    colorPrimario: plantilla.colorPrimario,
    colorSecundario: plantilla.colorSecundario,
    esUsuario: i === indiceClubUsuario,
    reputacion: plantilla.reputacion,
    dinero: Math.round(plantilla.reputacion * 420000 + rng.int(-2, 2) * 500000),
    estadio: { nombre: plantilla.estadio, capacidad: plantilla.capacidad, nivel: Math.round(plantilla.reputacion / 14) },
    socios: Math.round(plantilla.capacidad * rng.float(0.55, 0.85)),
    precioEntrada: 0,
    sponsorSemanal: Math.round(plantilla.reputacion * 5200),
    cantera: Math.max(1, Math.round(plantilla.reputacion / 12)),
    tacticas: { ...TACTICAS_POR_DEFECTO },
    titulares: [],
  }));

  for (const club of clubs) club.precioEntrada = precioEntradaSugerido(club);

  const jugadores: Jugador[] = [];
  for (const club of clubs) jugadores.push(...generarPlantel(rng, club.id, club.reputacion));

  for (const club of clubs) {
    const plantel = jugadores.filter((j) => j.clubId === club.id);
    club.titulares = onceAutomatico(club, plantel).map((j) => j.id);
  }

  const fixture = generarFixture(clubs.map((c) => c.id), rng);
  const club = clubs[indiceClubUsuario];
  const expectativa = expectativaSegunReputacion(clubs, club);

  const estado: EstadoJuego = {
    version: VERSION_PARTIDA,
    seed,
    temporada: 1,
    semana: 1,
    clubUsuarioId: club.id,
    clubs,
    jugadores,
    fixture,
    jornadaActual: 1,
    directorio: {
      expectativaPosicion: expectativa,
      confianza: 65,
      presupuestoFichajes: Math.round(club.dinero * 0.45),
    },
    bandeja: [],
    finanzas: [],
    historial: [],
    despedido: false,
  };

  crearMensaje(
    estado,
    'directorio',
    `Bienvenido a ${club.nombre}`,
    `El directorio te da la conduccion deportiva y tambien la caja. Para esta temporada esperan terminar entre los primeros ${expectativa} puestos. Manejas plantel, tacticas, entradas, estadio y cantera: si el club se funde, tambien es tu problema.`,
  );

  return estado;
}

function expectativaSegunReputacion(clubs: Club[], club: Club): number {
  const orden = [...clubs].sort((a, b) => b.reputacion - a.reputacion);
  const puesto = orden.findIndex((c) => c.id === club.id) + 1;
  return Math.max(1, Math.min(clubs.length, puesto + 1));
}

export function clubPorId(estado: EstadoJuego, id: string): Club {
  const club = estado.clubs.find((c) => c.id === id);
  if (!club) throw new Error(`Club inexistente: ${id}`);
  return club;
}

export function plantelDe(estado: EstadoJuego, clubId: string): Jugador[] {
  return estado.jugadores.filter((j) => j.clubId === clubId);
}

export function jugadorPorId(estado: EstadoJuego, id: string): Jugador | undefined {
  return estado.jugadores.find((j) => j.id === id);
}

export function partidoDelUsuario(estado: EstadoJuego): Partido | null {
  return (
    partidosDeJornada(estado.fixture, estado.jornadaActual).find(
      (p) => p.localId === estado.clubUsuarioId || p.visitanteId === estado.clubUsuarioId,
    ) ?? null
  );
}

export interface ResultadoArcade {
  golesLocal: number;
  golesVisitante: number;
  goleadoresLocal: string[];
  goleadoresVisitante: string[];
}

export interface ResumenJornada {
  partidos: Partido[];
  partidoUsuario: Partido | null;
  ingresos: { concepto: string; monto: number }[];
  asistencia: number | null;
  temporadaTerminada: boolean;
}

/**
 * Resuelve la jornada completa: el partido del usuario (con el resultado del
 * modo arcade si lo jugo) y todos los demas por simulacion.
 */
export function resolverJornada(estado: EstadoJuego, resultadoUsuario: ResultadoArcade | null): ResumenJornada {
  const rng = new Rng(estado.seed + estado.temporada * 1000 + estado.jornadaActual);
  const partidos = partidosDeJornada(estado.fixture, estado.jornadaActual);
  const propio = partidoDelUsuario(estado);

  const fuerzas = new Map<string, ReturnType<typeof fuerzaEquipo>>();
  for (const club of estado.clubs) fuerzas.set(club.id, fuerzaEquipo(club, estado.jugadores));

  for (const partido of partidos) {
    if (partido.jugado) continue;
    const esDelUsuario = propio !== null && partido.id === propio.id;

    if (esDelUsuario && resultadoUsuario) {
      aplicarResultado(estado, partido, resultadoUsuario, true);
      continue;
    }

    const local = clubPorId(estado, partido.localId);
    const visitante = clubPorId(estado, partido.visitanteId);
    const resultado = simularPartido(
      { club: local, fuerza: fuerzas.get(local.id)!, plantel: plantelDe(estado, local.id) },
      { club: visitante, fuerza: fuerzas.get(visitante.id)!, plantel: plantelDe(estado, visitante.id) },
      rng,
    );
    aplicarResultado(estado, partido, resultado, false);
  }

  const ingresos = procesarFinanzasSemana(estado, propio, rng);
  const asistencia = ultimaAsistencia;
  procesarPlantel(estado, propio, rng);
  actualizarDirectorio(estado);

  const jornadasTotales = totalJornadas(estado.fixture);
  const temporadaTerminada = estado.jornadaActual >= jornadasTotales;

  if (!temporadaTerminada) {
    estado.jornadaActual += 1;
    estado.semana += 1;
  }

  return { partidos, partidoUsuario: propio, ingresos, asistencia, temporadaTerminada };
}

function aplicarResultado(
  estado: EstadoJuego,
  partido: Partido,
  resultado: ResultadoArcade,
  arcade: boolean,
): void {
  partido.golesLocal = resultado.golesLocal;
  partido.golesVisitante = resultado.golesVisitante;
  partido.jugado = true;
  partido.arcade = arcade;

  for (const id of [...resultado.goleadoresLocal, ...resultado.goleadoresVisitante]) {
    const j = jugadorPorId(estado, id);
    if (j) j.golesTemporada += 1;
  }

  for (const clubId of [partido.localId, partido.visitanteId]) {
    const club = clubPorId(estado, clubId);
    for (const j of onceTitular(club, plantelDe(estado, clubId))) {
      j.partidosTemporada += 1;
    }
  }
}

let ultimaAsistencia: number | null = null;

function procesarFinanzasSemana(
  estado: EstadoJuego,
  propio: Partido | null,
  rng: Rng,
): { concepto: string; monto: number }[] {
  const club = clubUsuario(estado);
  const movimientos: { concepto: string; monto: number }[] = [];
  ultimaAsistencia = null;

  const tv = ingresoTv(club);
  registrar(estado, 'Derechos de TV', tv);
  movimientos.push({ concepto: 'Derechos de TV', monto: tv });

  registrar(estado, 'Sponsor', club.sponsorSemanal);
  movimientos.push({ concepto: 'Sponsor', monto: club.sponsorSemanal });

  const salarios = masaSalarial(club.id, estado.jugadores);
  registrar(estado, 'Salarios del plantel', -salarios);
  movimientos.push({ concepto: 'Salarios del plantel', monto: -salarios });

  const mantenimiento = Math.round(club.estadio.capacidad * 9 + club.cantera * 45000);
  registrar(estado, 'Mantenimiento y cantera', -mantenimiento);
  movimientos.push({ concepto: 'Mantenimiento y cantera', monto: -mantenimiento });

  if (propio && propio.localId === club.id) {
    const rival = clubPorId(estado, propio.visitanteId);
    const taquilla = calcularTaquilla(club, rival.reputacion, estado.directorio.confianza, rng);
    registrar(estado, `Taquilla vs ${rival.abrev}`, taquilla.recaudacion);
    movimientos.push({ concepto: `Taquilla vs ${rival.abrev}`, monto: taquilla.recaudacion });
    club.socios = Math.max(1000, Math.min(club.estadio.capacidad * 2, club.socios + taquilla.cambioSocios));
    ultimaAsistencia = taquilla.asistencia;
  }

  if (club.dinero < 0) {
    crearMensaje(
      estado,
      'finanzas',
      'El club esta en rojo',
      `La caja quedo en $${Math.round(club.dinero).toLocaleString('es-AR')}. Bajar la masa salarial, vender un jugador o revisar el precio de la entrada dejo de ser opcional.`,
    );
    estado.directorio.confianza = Math.max(0, estado.directorio.confianza - 4);
  }

  return movimientos;
}

function procesarPlantel(estado: EstadoJuego, propio: Partido | null, rng: Rng): void {
  const club = clubUsuario(estado);
  const plantel = plantelDe(estado, club.id);
  const jugaron = new Set(propio ? onceTitular(club, plantel).map((j) => j.id) : []);

  for (const j of estado.jugadores) {
    if (j.lesionSemanas > 0) {
      j.lesionSemanas -= 1;
      if (j.lesionSemanas === 0 && j.clubId === club.id) {
        crearMensaje(estado, 'plantel', `${j.nombre} se recupero`, 'Ya esta disponible para el proximo partido.');
      }
      continue;
    }

    if (jugaron.has(j.id)) {
      j.forma = Math.max(35, j.forma - rng.int(6, 14));
      const riesgo = 0.012 + (100 - j.attrs.fisico) / 4000;
      if (rng.chance(riesgo)) {
        j.lesionSemanas = rng.int(1, 6);
        if (j.clubId === club.id) {
          crearMensaje(
            estado,
            'plantel',
            `Se lesiono ${j.nombre}`,
            `Parte medico: ${j.lesionSemanas} ${j.lesionSemanas === 1 ? 'semana' : 'semanas'} afuera.`,
          );
        }
      }
    } else {
      j.forma = Math.min(100, j.forma + rng.int(4, 10));
    }

    if (j.contratoSemanas > 0) j.contratoSemanas -= 1;
  }

  // La moral sigue al ultimo resultado del equipo del usuario.
  if (propio) {
    const esLocal = propio.localId === club.id;
    const propios = esLocal ? propio.golesLocal ?? 0 : propio.golesVisitante ?? 0;
    const ajenos = esLocal ? propio.golesVisitante ?? 0 : propio.golesLocal ?? 0;
    const delta = propios > ajenos ? 6 : propios === ajenos ? 0 : -5;
    for (const j of plantel) j.moral = Math.max(10, Math.min(100, j.moral + delta));
  }
}

function actualizarDirectorio(estado: EstadoJuego): void {
  const tabla = calcularTabla(estado.clubs, estado.fixture);
  const posicion = posicionEnTabla(tabla, estado.clubUsuarioId);
  const objetivo = estado.directorio.expectativaPosicion;
  const desvio = objetivo - posicion;

  estado.directorio.confianza = Math.max(
    0,
    Math.min(100, estado.directorio.confianza + Math.sign(desvio) * Math.min(3, Math.abs(desvio))),
  );

  if (estado.directorio.confianza <= 12) {
    crearMensaje(
      estado,
      'directorio',
      'Ultimo aviso del directorio',
      `Vas ${posicion}. El objetivo era terminar entre los primeros ${objetivo}. Necesitan resultados ya.`,
    );
  }
}

/** Cierra la temporada: balance, juveniles, envejecer plantel y fixture nuevo. */
export interface ResumenTemporada {
  posicion: number;
  puntos: number;
  cumplioObjetivo: boolean;
  despedido: boolean;
  juveniles: Jugador[];
  premio: number;
}

export function cerrarTemporada(estado: EstadoJuego): ResumenTemporada {
  const rng = new Rng(estado.seed + estado.temporada * 7919);
  const tabla = calcularTabla(estado.clubs, estado.fixture);
  const posicion = posicionEnTabla(tabla, estado.clubUsuarioId);
  const fila = tabla.find((f) => f.clubId === estado.clubUsuarioId);
  const puntos = fila?.pts ?? 0;
  const cumplioObjetivo = posicion <= estado.directorio.expectativaPosicion;

  estado.historial.push({ temporada: estado.temporada, posicion, pts: puntos });

  const premio = Math.round((estado.clubs.length - posicion + 1) * 1_800_000);
  registrar(estado, `Premio por terminar ${posicion}`, premio);

  estado.directorio.confianza = Math.max(
    0,
    Math.min(100, estado.directorio.confianza + (cumplioObjetivo ? 18 : -22)),
  );
  // Te echan si el directorio perdio toda la confianza o si terminaste ultimo.
  const despedido = estado.directorio.confianza <= 0 || (!cumplioObjetivo && posicion === estado.clubs.length);
  estado.despedido = despedido;

  const juveniles = despedido ? [] : promoverJuveniles(estado, rng);

  if (!despedido) {
    envejecerPlantel(estado, rng);
    reiniciarTemporada(estado, rng, posicion);
  }

  return { posicion, puntos, cumplioObjetivo, despedido, juveniles, premio };
}

function promoverJuveniles(estado: EstadoJuego, rng: Rng): Jugador[] {
  const club = clubUsuario(estado);
  const cantidad = 1 + Math.floor(club.cantera / 4);
  const puestos: PosicionCodigo[] = ['ARQ', 'DEF', 'MED', 'DEL'];
  const nuevos: Jugador[] = [];

  for (let i = 0; i < cantidad; i++) {
    const juvenil = generarJugador(rng, {
      pos: rng.pick(puestos),
      nivel: 32 + club.cantera * 2.6 + rng.float(-4, 6),
      clubId: club.id,
      edadMin: 17,
      edadMax: 19,
    });
    juvenil.contratoSemanas = 120;
    nuevos.push(juvenil);
    estado.jugadores.push(juvenil);
  }

  if (nuevos.length > 0) {
    crearMensaje(
      estado,
      'plantel',
      'Suben juveniles de la cantera',
      nuevos.map((j) => `${j.nombre} (${j.pos}, ${j.edad} anos, media ${j.media}, potencial ${j.potencial})`).join('\n'),
    );
  }
  return nuevos;
}

function envejecerPlantel(estado: EstadoJuego, rng: Rng): void {
  const retirados: string[] = [];

  for (const j of estado.jugadores) {
    j.edad += 1;
    const claves = ['ritmo', 'regate', 'pase', 'tiro', 'quite', 'fisico', 'arquero'] as const;

    for (const clave of claves) {
      if (j.edad <= 24 && j.media < j.potencial) {
        j.attrs[clave] = Math.min(99, j.attrs[clave] + rng.int(0, 3));
      } else if (j.edad >= 30) {
        const caida = j.edad >= 34 ? rng.int(1, 4) : rng.int(0, 2);
        j.attrs[clave] = Math.max(10, j.attrs[clave] - caida);
      }
    }

    j.media = calcularMedia(j.pos, j.attrs);
    j.valor = valorDeMercado(j.media, j.edad, j.potencial);
    j.salario = salarioSemanal(j.valor, j.media);
    j.golesTemporada = 0;
    j.partidosTemporada = 0;
    j.forma = rng.int(85, 100);

    if (j.edad >= 36 || (j.edad >= 34 && j.media < 55)) retirados.push(j.id);
  }

  if (retirados.length > 0) {
    const club = clubUsuario(estado);
    const propios = estado.jugadores.filter((j) => retirados.includes(j.id) && j.clubId === club.id);
    if (propios.length > 0) {
      crearMensaje(
        estado,
        'plantel',
        'Se retiran del futbol',
        propios.map((j) => `${j.nombre} (${j.edad} anos) cuelga los botines.`).join('\n'),
      );
    }
    estado.jugadores = estado.jugadores.filter((j) => !retirados.includes(j.id));
  }

  // Cada club de la IA rellena su plantel hasta 20 jugadores.
  for (const club of estado.clubs) {
    const plantel = estado.jugadores.filter((j) => j.clubId === club.id);
    const faltan = Math.max(0, 20 - plantel.length);
    for (let i = 0; i < faltan; i++) {
      const puestos: PosicionCodigo[] = ['ARQ', 'DEF', 'MED', 'MED', 'DEL'];
      estado.jugadores.push(
        generarJugador(rng, {
          pos: rng.pick(puestos),
          nivel: 38 + club.reputacion * 0.4,
          clubId: club.id,
          edadMin: 18,
          edadMax: 30,
        }),
      );
    }
  }
}

function reiniciarTemporada(estado: EstadoJuego, rng: Rng, posicionFinal: number): void {
  estado.temporada += 1;
  estado.jornadaActual = 1;
  estado.semana += 1;
  estado.fixture = generarFixture(estado.clubs.map((c) => c.id), rng);

  const club = clubUsuario(estado);
  // La reputacion sigue a los resultados: terminar arriba te acerca a los grandes.
  const objetivoRep = 100 - (posicionFinal - 1) * (60 / estado.clubs.length);
  club.reputacion = Math.max(20, Math.min(99, Math.round(club.reputacion * 0.8 + objetivoRep * 0.2)));

  estado.directorio.expectativaPosicion = Math.max(1, Math.min(estado.clubs.length, posicionFinal <= 3 ? posicionFinal : posicionFinal - 1));
  estado.directorio.presupuestoFichajes = Math.round(Math.max(0, club.dinero) * 0.4);

  for (const otro of estado.clubs) {
    const plantel = estado.jugadores.filter((j) => j.clubId === otro.id);
    otro.titulares = onceAutomatico(otro, plantel).map((j) => j.id);
  }

  crearMensaje(
    estado,
    'directorio',
    `Arranca la temporada ${estado.temporada}`,
    `Objetivo del directorio: terminar entre los primeros ${estado.directorio.expectativaPosicion}. Presupuesto de fichajes: $${estado.directorio.presupuestoFichajes.toLocaleString('es-AR')}.`,
  );
}
