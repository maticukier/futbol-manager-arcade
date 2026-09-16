import type { Club, FilaTabla, Jugador, Partido } from './types';
import { Rng } from './rng';
import { ajustePorPuesto, FORMACIONES } from './tacticas';

/**
 * Fixture ida y vuelta por el metodo del circulo.
 * Con 12 equipos salen 22 jornadas.
 */
export function generarFixture(clubIds: string[], rng: Rng): Partido[] {
  const equipos = rng.shuffle([...clubIds]);
  if (equipos.length % 2 !== 0) equipos.push('LIBRE');

  const n = equipos.length;
  const rondas = n - 1;
  const mitad = n / 2;
  const partidos: Partido[] = [];
  let orden = [...equipos];

  for (let ronda = 0; ronda < rondas; ronda++) {
    for (let i = 0; i < mitad; i++) {
      const a = orden[i];
      const b = orden[n - 1 - i];
      if (a === 'LIBRE' || b === 'LIBRE') continue;
      // Alterno la localia por ronda para que no juegue siempre de local el mismo.
      const local = ronda % 2 === 0 ? a : b;
      const visitante = ronda % 2 === 0 ? b : a;
      partidos.push(crearPartido(ronda + 1, local, visitante));
      partidos.push(crearPartido(ronda + 1 + rondas, visitante, local));
    }
    // Roto todos menos el primero.
    orden = [orden[0], orden[n - 1], ...orden.slice(1, n - 1)];
  }

  return partidos.sort((a, b) => a.jornada - b.jornada);
}

let contador = 0;
function crearPartido(jornada: number, localId: string, visitanteId: string): Partido {
  contador += 1;
  return {
    id: `p${contador.toString(36)}`,
    jornada,
    localId,
    visitanteId,
    golesLocal: null,
    golesVisitante: null,
    jugado: false,
    arcade: false,
  };
}

export function totalJornadas(fixture: Partido[]): number {
  return fixture.reduce((max, p) => Math.max(max, p.jornada), 0);
}

export function partidosDeJornada(fixture: Partido[], jornada: number): Partido[] {
  return fixture.filter((p) => p.jornada === jornada);
}

export function proximoPartidoDe(fixture: Partido[], clubId: string, desdeJornada: number): Partido | null {
  return (
    fixture.find(
      (p) => p.jornada >= desdeJornada && !p.jugado && (p.localId === clubId || p.visitanteId === clubId),
    ) ?? null
  );
}

export function calcularTabla(clubs: Club[], fixture: Partido[]): FilaTabla[] {
  const filas = new Map<string, FilaTabla>();
  for (const c of clubs) {
    filas.set(c.id, { clubId: c.id, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dif: 0, pts: 0 });
  }

  for (const p of fixture) {
    if (!p.jugado || p.golesLocal === null || p.golesVisitante === null) continue;
    const local = filas.get(p.localId);
    const visita = filas.get(p.visitanteId);
    if (!local || !visita) continue;

    local.pj += 1;
    visita.pj += 1;
    local.gf += p.golesLocal;
    local.gc += p.golesVisitante;
    visita.gf += p.golesVisitante;
    visita.gc += p.golesLocal;

    if (p.golesLocal > p.golesVisitante) {
      local.g += 1;
      local.pts += 3;
      visita.p += 1;
    } else if (p.golesLocal < p.golesVisitante) {
      visita.g += 1;
      visita.pts += 3;
      local.p += 1;
    } else {
      local.e += 1;
      visita.e += 1;
      local.pts += 1;
      visita.pts += 1;
    }
  }

  const tabla = [...filas.values()];
  for (const f of tabla) f.dif = f.gf - f.gc;
  return tabla.sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf || a.clubId.localeCompare(b.clubId));
}

export function posicionEnTabla(tabla: FilaTabla[], clubId: string): number {
  return tabla.findIndex((f) => f.clubId === clubId) + 1;
}

export interface FuerzaEquipo {
  ataque: number;
  medio: number;
  defensa: number;
  global: number;
}

/** Fuerza del once titular, ponderada por forma, moral y tacticas. */
export function fuerzaEquipo(club: Club, jugadores: Jugador[]): FuerzaEquipo {
  const plantel = jugadores.filter((j) => j.clubId === club.id);
  const once = onceTitular(club, plantel);
  const ranuras = FORMACIONES[club.tacticas.formacion];

  let ataque = 0;
  let medio = 0;
  let defensa = 0;

  once.forEach((j, i) => {
    const ranura = ranuras[i];
    if (!j || !ranura) return;
    const estado = 0.7 + (j.forma / 100) * 0.2 + (j.moral / 100) * 0.1;
    const efectiva = j.media * ajustePorPuesto(j.pos, ranura.pos) * estado;
    if (ranura.pos === 'DEL') ataque += efectiva;
    else if (ranura.pos === 'MED') {
      medio += efectiva;
      ataque += efectiva * 0.35;
      defensa += efectiva * 0.35;
    } else {
      defensa += efectiva;
    }
  });

  const conteo = { DEL: 0, MED: 0, DEF: 0 };
  for (const r of ranuras) {
    if (r.pos === 'DEL') conteo.DEL += 1;
    else if (r.pos === 'MED') conteo.MED += 1;
    else if (r.pos === 'DEF') conteo.DEF += 1;
  }

  const mentalidad = club.tacticas.mentalidad / 100;
  const normAtaque = ataque / Math.max(1, conteo.DEL + conteo.MED * 0.35) * (0.85 + mentalidad * 0.3);
  const normMedio = medio / Math.max(1, conteo.MED);
  const normDefensa = defensa / Math.max(1, conteo.DEF + conteo.MED * 0.35) * (1.15 - mentalidad * 0.3);

  return {
    ataque: normAtaque,
    medio: normMedio,
    defensa: normDefensa,
    global: (normAtaque + normMedio + normDefensa) / 3,
  };
}

/** Once titular: el elegido por el usuario si es valido, si no el mejor automatico. */
export function onceTitular(club: Club, plantel: Jugador[]): Jugador[] {
  const porId = new Map(plantel.map((j) => [j.id, j]));
  const elegidos = club.titulares
    .map((id) => porId.get(id))
    .filter((j): j is Jugador => !!j && disponible(j));
  if (elegidos.length === 11) return elegidos;
  return onceAutomatico(club, plantel);
}

/**
 * Arma el mejor once posible para la formacion del club.
 *
 * Va por las mejores duplas jugador-puesto de todo el plantel, no puesto por
 * puesto: si se llenan las ranuras en orden, los mejores jugadores terminan
 * de defensores y el ataque queda con las sobras.
 */
/** Un jugador esta disponible si no esta lesionado ni suspendido. */
export function disponible(j: Jugador): boolean {
  return j.lesionSemanas === 0 && j.sancionPartidos === 0;
}

export function onceAutomatico(club: Club, plantel: Jugador[]): Jugador[] {
  const disponibles = plantel.filter(disponible);
  const ranuras = FORMACIONES[club.tacticas.formacion];

  const pares: { ranura: number; jugador: Jugador; puntaje: number }[] = [];
  ranuras.forEach((ranura, indice) => {
    for (const jugador of disponibles) {
      pares.push({
        ranura: indice,
        jugador,
        puntaje: jugador.media * ajustePorPuesto(jugador.pos, ranura.pos) * (0.8 + jugador.forma / 500),
      });
    }
  });
  pares.sort((a, b) => b.puntaje - a.puntaje || a.jugador.id.localeCompare(b.jugador.id));

  const once: (Jugador | undefined)[] = new Array(ranuras.length);
  const usados = new Set<string>();
  let llenas = 0;

  for (const par of pares) {
    if (llenas === ranuras.length) break;
    if (once[par.ranura] || usados.has(par.jugador.id)) continue;
    once[par.ranura] = par.jugador;
    usados.add(par.jugador.id);
    llenas += 1;
  }

  return once.filter((j): j is Jugador => !!j);
}

export interface ResultadoSimulado {
  golesLocal: number;
  golesVisitante: number;
  goleadoresLocal: string[];
  goleadoresVisitante: string[];
  amonestados: string[];
  expulsados: string[];
}

const VENTAJA_LOCAL = 1.12;

/**
 * Simulacion rapida de un partido que el usuario no juega.
 * Modelo de Poisson simple: la fuerza de ataque contra la defensa rival
 * define los goles esperados, y de ahi salen los goles.
 */
export function simularPartido(
  local: { club: Club; fuerza: FuerzaEquipo; plantel: Jugador[] },
  visitante: { club: Club; fuerza: FuerzaEquipo; plantel: Jugador[] },
  rng: Rng,
): ResultadoSimulado {
  const esperadosLocal = golesEsperados(local.fuerza, visitante.fuerza) * VENTAJA_LOCAL;
  const esperadosVisitante = golesEsperados(visitante.fuerza, local.fuerza);

  const golesLocal = poisson(rng, esperadosLocal);
  const golesVisitante = poisson(rng, esperadosVisitante);

  const tarjetasLocal = repartirTarjetas(local.club, local.plantel, rng);
  const tarjetasVisitante = repartirTarjetas(visitante.club, visitante.plantel, rng);

  return {
    golesLocal,
    golesVisitante,
    goleadoresLocal: elegirGoleadores(local.club, local.plantel, golesLocal, rng),
    goleadoresVisitante: elegirGoleadores(visitante.club, visitante.plantel, golesVisitante, rng),
    amonestados: [...tarjetasLocal.amarillas, ...tarjetasVisitante.amarillas],
    expulsados: [...tarjetasLocal.rojas, ...tarjetasVisitante.rojas],
  };
}

/**
 * Tarjetas de un partido simulado. Los que van fuerte al quite ven mas
 * amarillas, y la roja es poco frecuente.
 */
function repartirTarjetas(
  club: Club,
  plantel: Jugador[],
  rng: Rng,
): { amarillas: string[]; rojas: string[] } {
  const once = onceTitular(club, plantel).filter((j) => j.pos !== 'ARQ');
  const amarillas: string[] = [];
  const rojas: string[] = [];
  if (once.length === 0) return { amarillas, rojas };

  const cantidad = rng.int(0, 3);
  for (let i = 0; i < cantidad; i++) {
    const candidato = once[rng.int(0, once.length - 1)];
    if (rng.next() > 0.35 + candidato.attrs.quite / 200) continue;
    if (rng.chance(0.05)) rojas.push(candidato.id);
    else amarillas.push(candidato.id);
  }
  return { amarillas, rojas };
}

/**
 * Goles esperados de un equipo contra otro. La base y los divisores estan
 * calibrados para que la liga simulada de un promedio parecido al de los
 * partidos jugados en modo arcade: alrededor de 3 goles por partido.
 */
function golesEsperados(propia: FuerzaEquipo, rival: FuerzaEquipo): number {
  const dominio = (propia.medio - rival.medio) / 100;
  const filo = (propia.ataque - rival.defensa) / 34;
  return Math.max(0.2, 1.6 + filo + dominio * 0.6);
}

function poisson(rng: Rng, lambda: number): number {
  const limite = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng.next();
  } while (p > limite && k < 12);
  return k - 1;
}

/** Reparte los goles entre los titulares, con mucho mas peso a los delanteros. */
function elegirGoleadores(club: Club, plantel: Jugador[], goles: number, rng: Rng): string[] {
  if (goles === 0) return [];
  const once = onceTitular(club, plantel);
  const candidatos = once.filter((j) => j.pos !== 'ARQ');
  if (candidatos.length === 0) return [];

  const pesos = candidatos.map((j) => {
    const base = j.pos === 'DEL' ? 6 : j.pos === 'MED' ? 2.2 : 0.6;
    return base * (j.attrs.tiro / 60);
  });
  const total = pesos.reduce((a, b) => a + b, 0);

  const ids: string[] = [];
  for (let g = 0; g < goles; g++) {
    let tirada = rng.float(0, total);
    for (let i = 0; i < candidatos.length; i++) {
      tirada -= pesos[i];
      if (tirada <= 0) {
        ids.push(candidatos[i].id);
        break;
      }
    }
  }
  return ids;
}
