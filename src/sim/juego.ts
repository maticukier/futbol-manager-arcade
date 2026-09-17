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
import { CLUBES_LIGA, CLUBES_SEGUNDA } from './nombres';
import {
  atributoAfectado,
  calcularMedia,
  generarExtranjero,
  generarJugador,
  generarPlantel,
  salarioSemanal,
  valorDeMercado,
} from './jugadores';
import { FOCOS } from './tacticas';
import { crearClub } from './clubes';
import { VERSION_PARTIDA } from './migraciones';
import { cerrarTemporadaDeJugador, elegirAsistentes, notaSimulada } from './historial';
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
import { avanzarContratos } from './contratos';
import {
  copaVacia,
  esJornadaDeCopa,
  llaveDelUsuario,
  premioDeRonda,
  resolverRondaDeCopa,
  sortearCopa,
  NOMBRES_DE_RONDA,
  type ResultadoCopaUsuario,
} from './copa';
import {
  calcularTaquilla,
  clubUsuario,
  gastoFijo,
  ingresoTv,
  masaSalarial,
  registrar,
} from './finanzas';

export { VERSION_PARTIDA } from './migraciones';

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

  const plantillas = [
    ...CLUBES_LIGA.map((p) => ({ ...p, division: 1 as const })),
    ...CLUBES_SEGUNDA.map((p) => ({ ...p, division: 2 as const })),
  ];

  const clubs: Club[] = plantillas.map((plantilla, i) => {
    const club = crearClub(plantilla, `c${i}`, plantilla.division, rng);
    club.esUsuario = i === indiceClubUsuario;
    return club;
  });

  const jugadores: Jugador[] = [];
  for (const club of clubs) jugadores.push(...generarPlantel(rng, club.id, club.reputacion));

  for (const club of clubs) {
    const plantel = jugadores.filter((j) => j.clubId === club.id);
    club.titulares = onceAutomatico(club, plantel).map((j) => j.id);
  }

  const fixture = [
    ...generarFixture(clubs.filter((c) => c.division === 1).map((c) => c.id), rng, 1),
    ...generarFixture(clubs.filter((c) => c.division === 2).map((c) => c.id), rng, 2),
  ];
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
    mercadoExtranjero: [],
    copa: copaVacia(),
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

  renovarMercadoExtranjero(estado, rng);
  sortearCopa(estado, rng);

  crearMensaje(
    estado,
    'directorio',
    `Bienvenido a ${club.nombre}`,
    `El directorio te da la conduccion deportiva y tambien la caja. Para esta temporada esperan terminar entre los primeros ${expectativa} puestos. Manejas plantel, tacticas, entradas, estadio y cantera: si el club se funde, tambien es tu problema.`,
  );

  return estado;
}

/**
 * Rehace la lista de jugadores libres del exterior. Los que nadie compro se
 * van, y entran caras nuevas: el mercado no puede ser el mismo para siempre.
 */
export function renovarMercadoExtranjero(estado: EstadoJuego, rng: Rng): void {
  // Todos los que quedaron sin club se van del juego: si no, la lista crece sola.
  estado.jugadores = estado.jugadores.filter((j) => j.clubId !== null);

  const nuevos: Jugador[] = [];
  for (let i = 0; i < 40; i++) {
    const jugador = generarExtranjero(rng);
    nuevos.push(jugador);
    estado.jugadores.push(jugador);
  }
  estado.mercadoExtranjero = nuevos.map((j) => j.id);
}

/**
 * Si el plantel del usuario queda por debajo del minimo, el club sale a firmar
 * jugadores libres de urgencia. Es una red de seguridad, no un regalo: son los
 * que estaban sueltos en el mercado.
 */
function completarPlantelDelUsuario(estado: EstadoJuego, rng: Rng): void {
  const club = clubUsuario(estado);
  const plantel = plantelDe(estado, club.id);
  const faltan = Math.max(0, 16 - plantel.length);
  if (faltan === 0) return;

  const fichados: Jugador[] = [];
  const libres = estado.jugadores
    .filter((j) => j.clubId === null)
    .sort((a, b) => b.media - a.media)
    .slice(0, faltan);

  for (const j of libres) {
    j.clubId = club.id;
    j.contratoSemanas = 80;
    j.moral = 60;
    fichados.push(j);
  }

  while (fichados.length < faltan) {
    const puestos: PosicionCodigo[] = ['ARQ', 'DEF', 'MED', 'DEL'];
    const nuevo = generarJugador(rng, {
      pos: rng.pick(puestos),
      nivel: 34 + club.reputacion * 0.3,
      clubId: club.id,
      edadMin: 18,
      edadMax: 31,
    });
    estado.jugadores.push(nuevo);
    fichados.push(nuevo);
  }

  estado.mercadoExtranjero = estado.mercadoExtranjero.filter((id) => !fichados.some((j) => j.id === id));

  crearMensaje(
    estado,
    'plantel',
    'El club firmo de urgencia',
    `Quedabas con ${plantel.length} jugadores. Entraron ${fichados.map((j) => j.nombre).join(', ')}.`,
  );
}

function expectativaSegunReputacion(clubs: Club[], club: Club): number {
  const mismos = clubs.filter((c) => c.division === club.division);
  const orden = [...mismos].sort((a, b) => b.reputacion - a.reputacion);
  const puesto = orden.findIndex((c) => c.id === club.id) + 1;
  return Math.max(1, Math.min(mismos.length, puesto + 1));
}

/** Cuantos clubes hay en la division del usuario. */
export function clubesDeLaDivision(estado: EstadoJuego): Club[] {
  const propia = clubUsuario(estado).division;
  return estado.clubs.filter((c) => c.division === propia);
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
  amonestados: string[];
  expulsados: string[];
  /**
   * Notas y asistencias de verdad, del partido que se jugo en 3D. Si no
   * vienen, el partido fue simulado y las notas se estiman.
   */
  notas?: { id: string; nota: number; asistencias: number }[];
}

/** Amarillas que hay que juntar para perderse la fecha siguiente. */
const AMARILLAS_PARA_SANCION = 5;
const FECHAS_POR_ROJA = 2;

export interface ResumenJornada {
  partidos: Partido[];
  partidoUsuario: Partido | null;
  ingresos: { concepto: string; monto: number }[];
  asistencia: number | null;
  temporadaTerminada: boolean;
  /** Resultado de la llave de copa del usuario, si esta fecha hubo copa. */
  copa: {
    rival: string;
    golesPropios: number;
    golesRival: number;
    paso: boolean;
    premio: number;
    porPenales: boolean;
  } | null;
}

/** La llave de copa que le toca al usuario esta fecha, si es que hay. */
export function partidoDeCopaDelUsuario(estado: EstadoJuego) {
  if (!esJornadaDeCopa(estado.jornadaActual) || estado.copa.campeonId) return null;
  return llaveDelUsuario(estado);
}

/**
 * Resuelve la jornada completa: el partido del usuario (con el resultado del
 * modo arcade si lo jugo) y todos los demas por simulacion.
 */
export function resolverJornada(
  estado: EstadoJuego,
  resultadoUsuario: ResultadoArcade | null,
  resultadoCopa: ResultadoCopaUsuario | null = null,
): ResumenJornada {
  const rng = new Rng(estado.seed + estado.temporada * 1000 + estado.jornadaActual);
  const partidos = partidosDeJornada(estado.fixture, estado.jornadaActual);
  const divisionUsuario = clubPorId(estado, estado.clubUsuarioId).division;
  const propio = partidoDelUsuario(estado);

  // Guardo quien ya venia suspendido: son los unicos que descuentan hoy.
  const veniaSuspendido = new Set(estado.jugadores.filter((j) => j.sancionPartidos > 0).map((j) => j.id));

  const fuerzas = new Map<string, ReturnType<typeof fuerzaEquipo>>();
  for (const club of estado.clubs) fuerzas.set(club.id, fuerzaEquipo(club, estado.jugadores));

  for (const partido of partidos) {
    if (partido.jugado) continue;
    const esDelUsuario = propio !== null && partido.id === propio.id;

    if (esDelUsuario && resultadoUsuario) {
      aplicarResultado(estado, partido, resultadoUsuario, true, rng);
      continue;
    }

    const local = clubPorId(estado, partido.localId);
    const visitante = clubPorId(estado, partido.visitanteId);
    const resultado = simularPartido(
      { club: local, fuerza: fuerzas.get(local.id)!, plantel: plantelDe(estado, local.id) },
      { club: visitante, fuerza: fuerzas.get(visitante.id)!, plantel: plantelDe(estado, visitante.id) },
      rng,
    );
    aplicarResultado(estado, partido, resultado, false, rng);
  }

  const copa = resolverCopaSiCorresponde(estado, rng, resultadoCopa);
  completarPlantelDelUsuario(estado, rng);
  descontarSanciones(estado, veniaSuspendido);
  avanzarContratos(estado);
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

  return {
    partidos: partidos.filter((p) => p.division === divisionUsuario),
    partidoUsuario: propio,
    ingresos,
    asistencia,
    temporadaTerminada,
    copa,
  };
}

/** Juega la ronda de copa de esta fecha y devuelve como le fue al usuario. */
function resolverCopaSiCorresponde(
  estado: EstadoJuego,
  rng: Rng,
  resultadoUsuario: ResultadoCopaUsuario | null,
): ResumenJornada['copa'] {
  if (!esJornadaDeCopa(estado.jornadaActual) || estado.copa.campeonId) return null;

  const propiaAntes = llaveDelUsuario(estado);
  const resumen = resolverRondaDeCopa(estado, rng, resultadoUsuario, (llave, resultado) => {
    for (const id of [...resultado.goleadoresLocal, ...resultado.goleadoresVisitante]) {
      const j = jugadorPorId(estado, id);
      if (j) j.golesTemporada += 1;
    }
    aplicarTarjetas(estado, resultado.amonestados, resultado.expulsados);
    void llave;
  });

  if (resumen.campeon) {
    const campeon = resumen.campeon;
    crearMensaje(
      estado,
      'liga',
      `${campeon.nombre} gano la copa`,
      campeon.id === estado.clubUsuarioId ? '¡La copa es nuestra!' : 'Se termino la copa de esta temporada.',
    );
    if (campeon.id === estado.clubUsuarioId) {
      registrar(estado, 'Premio por ganar la copa', premioDeRonda(NOMBRES_DE_RONDA.length - 1));
      estado.directorio.confianza = Math.min(100, estado.directorio.confianza + 15);
    }
  }

  if (!propiaAntes) return null;

  const esLocal = propiaAntes.localId === estado.clubUsuarioId;
  const golesPropios = (esLocal ? propiaAntes.golesLocal : propiaAntes.golesVisitante) ?? 0;
  const golesRival = (esLocal ? propiaAntes.golesVisitante : propiaAntes.golesLocal) ?? 0;
  const rival = clubPorId(estado, esLocal ? propiaAntes.visitanteId : propiaAntes.localId);

  if (resumen.premio > 0) registrar(estado, `Premio de copa (${NOMBRES_DE_RONDA[resumen.rondaJugada]})`, resumen.premio);

  const porPenales = golesPropios === golesRival;
  const cierre = resumen.sigueVivo
    ? `Pasa de ronda: ${NOMBRES_DE_RONDA[resumen.rondaJugada + 1] ?? 'Final'}.`
    : 'Quedamos eliminados.';

  crearMensaje(
    estado,
    'liga',
    `Copa: ${golesPropios}-${golesRival} con ${rival.abrev}`,
    porPenales ? `Se definio por penales. ${cierre}` : cierre,
  );

  return {
    rival: rival.abrev,
    golesPropios,
    golesRival,
    paso: resumen.sigueVivo,
    premio: resumen.premio,
    porPenales,
  };
}

function aplicarResultado(
  estado: EstadoJuego,
  partido: Partido,
  resultado: ResultadoArcade,
  arcade: boolean,
  rng: Rng,
): void {
  partido.golesLocal = resultado.golesLocal;
  partido.golesVisitante = resultado.golesVisitante;
  partido.jugado = true;
  partido.arcade = arcade;

  for (const id of [...resultado.goleadoresLocal, ...resultado.goleadoresVisitante]) {
    const j = jugadorPorId(estado, id);
    if (j) j.golesTemporada += 1;
  }

  // Del partido jugado en 3D vienen las notas y las asistencias de verdad. Del
  // simulado no viene nada, asi que hay que estimarlas: si no, la carrera de un
  // jugador tendria un agujero del noventa por ciento de los partidos.
  const reales = new Map((resultado.notas ?? []).map((n) => [n.id, n]));
  const amonestados = new Set(resultado.amonestados);
  const expulsados = new Set(resultado.expulsados);

  const lados = [
    { clubId: partido.localId, goleadores: resultado.goleadoresLocal, diferencia: resultado.golesLocal - resultado.golesVisitante },
    { clubId: partido.visitanteId, goleadores: resultado.goleadoresVisitante, diferencia: resultado.golesVisitante - resultado.golesLocal },
  ];

  for (const lado of lados) {
    const club = clubPorId(estado, lado.clubId);
    const plantel = plantelDe(estado, lado.clubId);

    const asistencias = new Map<string, number>();
    if (reales.size === 0) {
      for (const id of elegirAsistentes(plantel, lado.goleadores, rng)) {
        asistencias.set(id, (asistencias.get(id) ?? 0) + 1);
      }
    }

    for (const j of onceTitular(club, plantel)) {
      j.partidosTemporada += 1;
      // A los propios se los va conociendo: de aca sale que despues de varios
      // partidos se destape el rasgo que no venia en la ficha.
      if (lado.clubId === estado.clubUsuarioId) j.partidosObservado += 1;

      const real = reales.get(j.id);
      if (real) {
        j.notaSumada += real.nota;
        j.asistenciasTemporada += real.asistencias;
        continue;
      }

      const suyas = asistencias.get(j.id) ?? 0;
      j.asistenciasTemporada += suyas;
      j.notaSumada += notaSimulada(
        j,
        {
          goles: lado.goleadores.filter((id) => id === j.id).length,
          asistencias: suyas,
          amarilla: amonestados.has(j.id),
          roja: expulsados.has(j.id),
          diferencia: lado.diferencia,
        },
        rng,
      );
    }
  }

  aplicarTarjetas(estado, resultado.amonestados, resultado.expulsados);
}

/** Suma amarillas, cierra ciclos de cinco y aplica las rojas. */
function aplicarTarjetas(estado: EstadoJuego, amonestados: string[], expulsados: string[]): void {
  for (const id of amonestados) {
    const j = jugadorPorId(estado, id);
    if (!j) continue;
    j.amarillasTemporada += 1;
    if (j.amarillasTemporada % AMARILLAS_PARA_SANCION !== 0) continue;
    j.sancionPartidos = Math.max(j.sancionPartidos, 1);
    if (j.clubId === estado.clubUsuarioId) {
      crearMensaje(
        estado,
        'plantel',
        `${j.nombre} llego a ${j.amarillasTemporada} amarillas`,
        'Se pierde la proxima fecha por acumulacion.',
      );
    }
  }

  for (const id of expulsados) {
    const j = jugadorPorId(estado, id);
    if (!j) continue;
    j.sancionPartidos = Math.max(j.sancionPartidos, FECHAS_POR_ROJA);
    if (j.clubId === estado.clubUsuarioId) {
      crearMensaje(
        estado,
        'plantel',
        `Expulsaron a ${j.nombre}`,
        `Se pierde las proximas ${FECHAS_POR_ROJA} fechas.`,
      );
    }
  }
}

/** Los suspendidos cumplen una fecha cada vez que su club juega. */
function descontarSanciones(estado: EstadoJuego, veniaSuspendido: Set<string>): void {
  const clubesQueJugaron = new Set<string>();
  for (const p of estado.fixture) {
    if (p.jornada !== estado.jornadaActual || !p.jugado) continue;
    clubesQueJugaron.add(p.localId);
    clubesQueJugaron.add(p.visitanteId);
  }

  for (const j of estado.jugadores) {
    if (!veniaSuspendido.has(j.id) || j.sancionPartidos <= 0) continue;
    if (!j.clubId || !clubesQueJugaron.has(j.clubId)) continue;
    j.sancionPartidos -= 1;
    if (j.sancionPartidos === 0 && j.clubId === estado.clubUsuarioId) {
      crearMensaje(estado, 'plantel', `${j.nombre} cumplio la sancion`, 'Vuelve a estar disponible.');
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

  const mantenimiento = gastoFijo(club);
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

  // Todos los que fueron titulares en la fecha, no solo los del usuario.
  const jugaron = new Set<string>();
  for (const otro of estado.clubs) {
    const jugoEstaFecha = estado.fixture.some(
      (p) => p.jornada === estado.jornadaActual && p.jugado && (p.localId === otro.id || p.visitanteId === otro.id),
    );
    if (!jugoEstaFecha) continue;
    for (const j of onceTitular(otro, plantelDe(estado, otro.id))) jugaron.add(j.id);
  }

  for (const j of estado.jugadores) {
    if (j.lesionSemanas > 0) {
      j.lesionSemanas -= 1;
      if (j.lesionSemanas === 0 && j.clubId === club.id) {
        crearMensaje(estado, 'plantel', `${j.nombre} se recupero`, 'Ya esta disponible para el proximo partido.');
      }
      continue;
    }

    const esDelUsuario = j.clubId === club.id;
    const focoFisico = esDelUsuario ? club.entrenamiento.fisico / 33 : 1;

    if (jugaron.has(j.id)) {
      j.forma = Math.max(35, j.forma - rng.int(6, 14) / Math.max(0.6, focoFisico));
      const riesgo = (0.012 + (100 - j.attrs.fisico) / 4000) * (0.8 + focoFisico * 0.25);
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
      j.forma = Math.min(100, j.forma + rng.int(4, 10) * focoFisico);
    }

  }

  evolucionarJugadores(estado, jugaron, rng);

  // La moral sigue al ultimo resultado del equipo del usuario.
  if (propio) {
    const esLocal = propio.localId === club.id;
    const propios = esLocal ? propio.golesLocal ?? 0 : propio.golesVisitante ?? 0;
    const ajenos = esLocal ? propio.golesVisitante ?? 0 : propio.golesLocal ?? 0;
    const delta = propios > ajenos ? 6 : propios === ajenos ? 0 : -5;
    for (const j of plantel) j.moral = Math.max(10, Math.min(100, j.moral + delta));
  }
}

/**
 * Evolucion semanal de todos los jugadores de la liga.
 *
 * No sube nadie todas las semanas: se acumulan puntos invisibles y recien al
 * llegar a cien se traducen en un punto de atributo. Los pibes con margen de
 * potencial suman rapido si juegan, los treintones empiezan a restar.
 */
function evolucionarJugadores(estado: EstadoJuego, jugaron: Set<string>, rng: Rng): void {
  const club = clubUsuario(estado);

  for (const j of estado.jugadores) {
    if (j.lesionSemanas > 0) continue;

    const margen = j.potencial - j.media;
    const jugo = jugaron.has(j.id);

    // Curva de carrera: hasta los 24 se crece, despues se sostiene y a los 30 se cae.
    let puntos: number;
    if (j.edad <= 24) puntos = (jugo ? 9 : 3) * Math.min(1.4, margen / 8);
    else if (j.edad <= 29) puntos = (jugo ? 5 : 1.5) * Math.min(1, margen / 10);
    else puntos = -(j.edad - 29) * (jugo ? 2.4 : 1.6);

    if (margen <= 0 && j.edad <= 29) puntos = Math.min(puntos, 0.5);
    puntos *= rng.float(0.5, 1.5) * (0.85 + j.moral / 400);
    j.progreso += puntos;

    if (j.progreso >= 100) {
      j.progreso = 0;
      aplicarCambioDeAtributo(estado, j, 1, rng, club.id);
    } else if (j.progreso <= -100) {
      j.progreso = 0;
      aplicarCambioDeAtributo(estado, j, -1, rng, club.id);
    }
  }
}

function aplicarCambioDeAtributo(
  estado: EstadoJuego,
  j: Jugador,
  delta: number,
  rng: Rng,
  clubUsuarioId: string,
): void {
  const clave =
    j.clubId === clubUsuarioId && delta > 0
      ? atributoSegunEntrenamiento(estado, rng, j)
      : atributoAfectado(rng, j.pos);
  const anterior = j.media;
  j.attrs[clave] = Math.max(10, Math.min(99, j.attrs[clave] + delta));
  j.media = calcularMedia(j.pos, j.attrs);
  j.valor = valorDeMercado(j.media, j.edad, j.potencial);
  j.salario = salarioSemanal(j.valor, j.media);

  if (j.media === anterior || j.clubId !== clubUsuarioId) return;
  crearMensaje(
    estado,
    'plantel',
    delta > 0 ? `${j.nombre} mejoro` : `${j.nombre} bajo`,
    `Su media pasa de ${anterior} a ${j.media}. Cambio ${clave}.`,
  );
}

/**
 * Con el entrenamiento inclinado hacia un bloque, la mejora cae mas seguido en
 * los atributos de ese bloque. No lo garantiza: sigue pesando el puesto.
 */
function atributoSegunEntrenamiento(estado: EstadoJuego, rng: Rng, j: Jugador) {
  const foco = clubUsuario(estado).entrenamiento;
  const total = foco.fisico + foco.tecnica + foco.tactica || 1;

  let tirada = rng.float(0, total);
  for (const bloque of ['fisico', 'tecnica', 'tactica'] as const) {
    tirada -= foco[bloque];
    if (tirada > 0) continue;
    const opciones = FOCOS[bloque];
    // El arquero solo crece como arquero si el bloque se lo permite.
    const validas = opciones.filter((clave) => (clave === 'arquero') === (j.pos === 'ARQ'));
    if (validas.length > 0) return rng.pick(validas);
    break;
  }
  return atributoAfectado(rng, j.pos);
}

function actualizarDirectorio(estado: EstadoJuego): void {
  const division = clubPorId(estado, estado.clubUsuarioId).division;
  const tabla = calcularTabla(estado.clubs, estado.fixture, division);
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

/**
 * Bajan los dos ultimos de primera y suben los dos primeros de segunda.
 * Devuelve el texto para la bandeja, o null si algo salio mal.
 */
function aplicarAscensosYDescensos(estado: EstadoJuego): string | null {
  const primera = calcularTabla(estado.clubs, estado.fixture, 1);
  const segunda = calcularTabla(estado.clubs, estado.fixture, 2);
  if (primera.length < 4 || segunda.length < 4) return null;

  const descienden = primera.slice(-2).map((f) => clubPorId(estado, f.clubId));
  const ascienden = segunda.slice(0, 2).map((f) => clubPorId(estado, f.clubId));

  for (const club of descienden) {
    club.division = 2;
    club.reputacion = Math.max(18, club.reputacion - 8);
  }
  for (const club of ascienden) {
    club.division = 1;
    club.reputacion = Math.min(99, club.reputacion + 10);
  }

  const propio = clubUsuario(estado);
  if (descienden.some((c) => c.id === propio.id)) {
    crearMensaje(
      estado,
      'directorio',
      'El club se fue al descenso',
      'Se cobra menos de television y el objetivo ahora es volver a primera.',
    );
    estado.directorio.confianza = Math.max(0, estado.directorio.confianza - 10);
  }
  if (ascienden.some((c) => c.id === propio.id)) {
    crearMensaje(estado, 'directorio', '¡Ascenso a primera!', 'El directorio esta feliz y sube el presupuesto.');
    estado.directorio.confianza = Math.min(100, estado.directorio.confianza + 25);
  }

  return `Bajan ${descienden.map((c) => c.abrev).join(' y ')}. Suben ${ascienden.map((c) => c.abrev).join(' y ')}.`;
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
  const division = clubPorId(estado, estado.clubUsuarioId).division;
  const tabla = calcularTabla(estado.clubs, estado.fixture, division);
  const posicion = posicionEnTabla(tabla, estado.clubUsuarioId);
  const fila = tabla.find((f) => f.clubId === estado.clubUsuarioId);
  const puntos = fila?.pts ?? 0;
  const cumplioObjetivo = posicion <= estado.directorio.expectativaPosicion;

  estado.historial.push({ temporada: estado.temporada, posicion, pts: puntos });

  const equipos = estado.clubs.filter((c) => c.division === division).length;
  // En segunda se reparte bastante menos: subir es el premio.
  const premio = Math.round((equipos - posicion + 1) * (division === 1 ? 20_000_000 : 6_000_000));
  registrar(estado, `Premio por terminar ${posicion}`, premio);

  estado.directorio.confianza = Math.max(
    0,
    Math.min(100, estado.directorio.confianza + (cumplioObjetivo ? 18 : -15)),
  );
  // Te echan si el directorio perdio toda la confianza o si terminaste ultimo.
  const despedido = estado.directorio.confianza <= 0 || (!cumplioObjetivo && posicion === equipos);
  estado.despedido = despedido;

  // La temporada de cada jugador se guarda siempre, aunque al usuario lo echen:
  // el mundo sigue y esa historia no se puede reconstruir despues.
  guardarLaTemporadaDeCadaUno(estado);

  const juveniles = despedido ? [] : promoverJuveniles(estado, rng);

  if (!despedido) {
    envejecerPlantel(estado, rng);
    reiniciarTemporada(estado, rng, posicion);
  }

  return { posicion, puntos, cumplioObjetivo, despedido, juveniles, premio };
}

/**
 * Cierra el ano de todos y lo escribe en su carrera, antes de que los
 * contadores vuelvan a cero. Es el unico momento en que ese dato existe.
 */
function guardarLaTemporadaDeCadaUno(estado: EstadoJuego): void {
  const divisionDe = new Map(estado.clubs.map((c) => [c.id, c.division]));
  for (const j of estado.jugadores) {
    cerrarTemporadaDeJugador(j, estado.temporada, (j.clubId && divisionDe.get(j.clubId)) || 1);
  }
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
    // La evolucion fuerte pasa semana a semana; el cambio de temporada solo
    // recalcula valores y le pega un empujon extra a los veteranos.
    if (j.edad >= 33) {
      const clave = atributoAfectado(rng, j.pos);
      j.attrs[clave] = Math.max(10, j.attrs[clave] - rng.int(1, 3));
    }

    j.media = calcularMedia(j.pos, j.attrs);
    j.valor = valorDeMercado(j.media, j.edad, j.potencial);
    j.salario = salarioSemanal(j.valor, j.media);
    j.golesTemporada = 0;
    j.asistenciasTemporada = 0;
    j.partidosTemporada = 0;
    j.amarillasTemporada = 0;
    j.notaSumada = 0;
    j.sancionPartidos = 0;
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

  // Los clubes de la IA rellenan su plantel hasta 20 jugadores.
  for (const club of estado.clubs) {
    if (club.id === estado.clubUsuarioId) continue;
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
  const movimientos = aplicarAscensosYDescensos(estado);

  estado.temporada += 1;
  estado.jornadaActual = 1;
  estado.semana += 1;
  estado.fixture = [
    ...generarFixture(estado.clubs.filter((c) => c.division === 1).map((c) => c.id), rng, 1),
    ...generarFixture(estado.clubs.filter((c) => c.division === 2).map((c) => c.id), rng, 2),
  ];

  const club = clubUsuario(estado);
  // La reputacion sigue a los resultados: terminar arriba te acerca a los grandes.
  const objetivoRep = (club.division === 1 ? 100 : 55) - (posicionFinal - 1) * 3.5;
  club.reputacion = Math.max(20, Math.min(99, Math.round(club.reputacion * 0.8 + objetivoRep * 0.2)));

  const equipos = estado.clubs.filter((c) => c.division === club.division).length;
  estado.directorio.expectativaPosicion = Math.max(
    1,
    Math.min(equipos, posicionFinal <= 3 ? posicionFinal : posicionFinal - 1),
  );
  estado.directorio.presupuestoFichajes = Math.round(Math.max(0, club.dinero) * 0.4);

  for (const otro of estado.clubs) {
    const plantel = estado.jugadores.filter((j) => j.clubId === otro.id);
    otro.titulares = onceAutomatico(otro, plantel).map((j) => j.id);
  }

  renovarMercadoExtranjero(estado, rng);
  sortearCopa(estado, rng);

  if (movimientos) crearMensaje(estado, 'liga', 'Ascensos y descensos', movimientos);

  crearMensaje(
    estado,
    'directorio',
    `Arranca la temporada ${estado.temporada}`,
    `Objetivo del directorio: terminar entre los primeros ${estado.directorio.expectativaPosicion}. Presupuesto de fichajes: $${estado.directorio.presupuestoFichajes.toLocaleString('es-AR')}.`,
  );
}
