import type { Club, Copa, EstadoJuego, Jugador, LlaveCopa } from './types';
import { Rng } from './rng';
import { fuerzaEquipo, onceTitular, simularPartido } from './liga';

/**
 * Copa nacional: eliminacion directa entre los 24 clubes de las dos
 * divisiones. Se juega en cinco fechas repartidas a lo largo de la temporada,
 * asi que un club de segunda puede cruzarse con uno grande.
 */

/** En que jornadas de liga se juega cada ronda de copa. */
export const JORNADAS_DE_COPA = [4, 8, 12, 16, 20];

export const NOMBRES_DE_RONDA = ['Primera ronda', 'Dieciseisavos', 'Cuartos', 'Semifinal', 'Final'];

/** Premio por llegar a cada ronda. La final paga de verdad. */
const PREMIOS = [8_000_000, 14_000_000, 25_000_000, 45_000_000, 90_000_000];

export function copaVacia(): Copa {
  return { ronda: 0, llaves: [], vivos: [], campeonId: null };
}

export function esJornadaDeCopa(jornada: number): boolean {
  return JORNADAS_DE_COPA.includes(jornada);
}

export function rondaDeJornada(jornada: number): number {
  return JORNADAS_DE_COPA.indexOf(jornada);
}

export function premioDeRonda(ronda: number): number {
  return PREMIOS[Math.min(ronda, PREMIOS.length - 1)];
}

let contador = 0;

/** Sortea la copa desde cero con todos los clubes. */
export function sortearCopa(estado: EstadoJuego, rng: Rng): void {
  const participantes = rng.shuffle(estado.clubs.map((c) => c.id));
  estado.copa = { ronda: 0, llaves: [], vivos: participantes, campeonId: null };
  armarRonda(estado, 0, rng);
}

/**
 * Cruza a los que siguen vivos. Si son impares, el que sobra pasa de largo:
 * con 24 clubes, la primera ronda tiene ocho cruces y ocho clubes libres.
 */
function armarRonda(estado: EstadoJuego, ronda: number, rng: Rng): void {
  const vivos = rng.shuffle([...estado.copa.vivos]);
  const cruces = ronda === 0 ? 8 : Math.floor(vivos.length / 2);
  const llaves: LlaveCopa[] = [];

  for (let i = 0; i < cruces; i++) {
    const local = vivos[i * 2];
    const visitante = vivos[i * 2 + 1];
    if (!local || !visitante) break;
    contador += 1;
    llaves.push({
      id: `k${contador.toString(36)}`,
      ronda,
      localId: local,
      visitanteId: visitante,
      golesLocal: null,
      golesVisitante: null,
      jugado: false,
      ganadorId: null,
    });
  }

  estado.copa.ronda = ronda;
  estado.copa.llaves.push(...llaves);
}

/** La llave del usuario en la ronda actual, si sigue vivo. */
export function llaveDelUsuario(estado: EstadoJuego): LlaveCopa | null {
  return (
    estado.copa.llaves.find(
      (k) =>
        k.ronda === estado.copa.ronda &&
        !k.jugado &&
        (k.localId === estado.clubUsuarioId || k.visitanteId === estado.clubUsuarioId),
    ) ?? null
  );
}

export interface ResultadoCopaUsuario {
  golesLocal: number;
  golesVisitante: number;
  goleadoresLocal: string[];
  goleadoresVisitante: string[];
  amonestados: string[];
  expulsados: string[];
}

export interface ResumenCopa {
  llaves: LlaveCopa[];
  rondaJugada: number;
  propia: LlaveCopa | null;
  sigueVivo: boolean;
  campeon: Club | null;
  premio: number;
}

/**
 * Resuelve la ronda que toca. Si el usuario jugo su llave en modo arcade, se
 * usa ese resultado; el resto se simula.
 */
export function resolverRondaDeCopa(
  estado: EstadoJuego,
  rng: Rng,
  resultadoUsuario: ResultadoCopaUsuario | null,
  aplicarResultado: (llave: LlaveCopa, resultado: ResultadoCopaUsuario) => void,
): ResumenCopa {
  const ronda = estado.copa.ronda;
  const llaves = estado.copa.llaves.filter((k) => k.ronda === ronda && !k.jugado);
  const propia = llaveDelUsuario(estado);

  for (const llave of llaves) {
    const esDelUsuario = propia !== null && llave.id === propia.id;
    const resultado =
      esDelUsuario && resultadoUsuario ? resultadoUsuario : simularLlave(estado, llave, rng);

    aplicarResultado(llave, resultado);

    llave.golesLocal = resultado.golesLocal;
    llave.golesVisitante = resultado.golesVisitante;
    llave.jugado = true;
    // En copa no hay empate: si iguala, lo define el rng como los penales.
    llave.ganadorId =
      resultado.golesLocal > resultado.golesVisitante
        ? llave.localId
        : resultado.golesVisitante > resultado.golesLocal
          ? llave.visitanteId
          : rng.chance(0.5)
            ? llave.localId
            : llave.visitanteId;
  }

  // Pasan los ganadores y los que quedaron libres esta ronda.
  const cruzaron = new Set(llaves.flatMap((k) => [k.localId, k.visitanteId]));
  const ganadores = llaves.map((k) => k.ganadorId!).filter(Boolean);
  const libres = estado.copa.vivos.filter((id) => !cruzaron.has(id));
  estado.copa.vivos = [...ganadores, ...libres];

  const sigueVivo = estado.copa.vivos.includes(estado.clubUsuarioId);
  let campeon: Club | null = null;

  if (estado.copa.vivos.length === 1) {
    estado.copa.campeonId = estado.copa.vivos[0];
    campeon = estado.clubs.find((c) => c.id === estado.copa.campeonId) ?? null;
  } else if (estado.copa.vivos.length > 1) {
    armarRonda(estado, ronda + 1, rng);
  }

  return {
    llaves,
    rondaJugada: ronda,
    propia,
    sigueVivo,
    campeon,
    premio: propia && sigueVivo ? premioDeRonda(ronda) : 0,
  };
}

function simularLlave(estado: EstadoJuego, llave: LlaveCopa, rng: Rng): ResultadoCopaUsuario {
  const porId = (id: string) => estado.clubs.find((c) => c.id === id)!;
  const plantelDe = (id: string) => estado.jugadores.filter((j) => j.clubId === id);

  const local = porId(llave.localId);
  const visitante = porId(llave.visitanteId);
  const planteles: [Jugador[], Jugador[]] = [plantelDe(local.id), plantelDe(visitante.id)];

  const resultado = simularPartido(
    { club: local, fuerza: fuerzaEquipo(local, estado.jugadores), plantel: planteles[0] },
    { club: visitante, fuerza: fuerzaEquipo(visitante, estado.jugadores), plantel: planteles[1] },
    rng,
  );

  // En copa los planteles rotan menos: sumo los partidos igual que en liga.
  for (const club of [local, visitante]) {
    for (const j of onceTitular(club, plantelDe(club.id))) j.partidosTemporada += 1;
  }

  return {
    golesLocal: resultado.golesLocal,
    golesVisitante: resultado.golesVisitante,
    goleadoresLocal: resultado.goleadoresLocal,
    goleadoresVisitante: resultado.goleadoresVisitante,
    amonestados: resultado.amonestados,
    expulsados: resultado.expulsados,
  };
}
