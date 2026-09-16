import type { Atributos, PosicionCodigo } from './types';
import type { Rng } from './rng';

/**
 * Rasgos: lo que hace que un jugador sea alguien y no una fila de numeros.
 *
 * Cada rasgo cambia como juega el jugador dentro del partido, no cuanto vale
 * en una tabla. La idea es que el usuario pueda decir "a Peralta daselo de
 * frente al arco que la clava" y que eso sea cierto en la cancha, no una
 * etiqueta decorativa.
 *
 * Cada jugador lleva hasta dos rasgos a la vista, para poder planificar, y uno
 * oculto que recien se destapa despues de verlo jugar varios partidos.
 */
export type RasgoId =
  | 'canonero'
  | 'gambeteador'
  | 'ultimoPase'
  | 'definidor'
  | 'pulmon'
  | 'explosivo'
  | 'aguerrido'
  | 'cabeceador'
  | 'achicador'
  | 'egoista'
  | 'blando'
  | 'intermitente'
  | 'creceConElPartido'
  | 'seApaga'
  | 'caradura';

/**
 * Como se traduce un rasgo dentro del partido. Todo es un multiplicador sobre
 * algo que el motor ya hacia, asi que un jugador sin rasgos juega exactamente
 * como antes: 1 en todo.
 */
export interface EfectosRasgos {
  /** Ganas de patear de lejos. */
  tiroLejano: number;
  /** Punteria del remate: cuanto mas alto, menos se le abre. */
  punteria: number;
  /** Con cuanta soltura conduce la pelota. */
  conduccion: number;
  /** Ganas de buscar el pase que rompe lineas en vez del de al lado. */
  paseFiltrado: number;
  /** Cuanto se cansa: menos de 1 es un pulmon. */
  desgaste: number;
  /** Aceleracion y frenada. */
  arranque: number;
  /** Ganas de tirarse al piso a robarla. */
  barrida: number;
  /** Alcance en la pelota que viene por arriba. */
  juegoAereo: number;
  /** Ganas del arquero de salir de su arco. */
  salidaArquero: number;
  /** Cuanto le cambia el rendimiento de un partido a otro. */
  irregularidad: number;
  /** Cuanto rinde en el segundo tiempo respecto del primero. */
  segundoTiempo: number;
  /** Ganas de patear en lugar de dar el pase. */
  egoismo: number;
}

export const EFECTOS_NEUTROS: EfectosRasgos = {
  tiroLejano: 1,
  punteria: 1,
  conduccion: 1,
  paseFiltrado: 1,
  desgaste: 1,
  arranque: 1,
  barrida: 1,
  juegoAereo: 1,
  salidaArquero: 1,
  irregularidad: 1,
  segundoTiempo: 1,
  egoismo: 1,
};

export interface Rasgo {
  id: RasgoId;
  nombre: string;
  /** Lo que se lee en la ficha del jugador. */
  descripcion: string;
  /** Los ocultos solo se destapan despues de verlo jugar. */
  oculto: boolean;
  /** Si juega en contra: sirve para que un rasgo no sea siempre un premio. */
  contra: boolean;
  puestos: PosicionCodigo[];
  /** Atributo que lo hace probable: un canonero nace de un tiro alto. */
  afin?: keyof Atributos;
  efectos: Partial<EfectosRasgos>;
}

export const RASGOS: Record<RasgoId, Rasgo> = {
  canonero: {
    id: 'canonero',
    nombre: 'Cañonero',
    descripcion: 'Se anima desde afuera del area y le pega fuerte.',
    oculto: false,
    contra: false,
    puestos: ['DEF', 'MED', 'DEL'],
    afin: 'tiro',
    efectos: { tiroLejano: 2.6, punteria: 1.15 },
  },
  gambeteador: {
    id: 'gambeteador',
    nombre: 'Gambeteador',
    descripcion: 'Se va del que lo marca con la pelota dominada.',
    oculto: false,
    contra: false,
    puestos: ['MED', 'DEL'],
    afin: 'regate',
    efectos: { conduccion: 1.12, arranque: 1.1 },
  },
  ultimoPase: {
    id: 'ultimoPase',
    nombre: 'Último pase',
    descripcion: 'Ve el pase que rompe lineas antes que el resto.',
    oculto: false,
    contra: false,
    puestos: ['MED', 'DEL'],
    afin: 'pase',
    efectos: { paseFiltrado: 2.2, egoismo: 0.7 },
  },
  definidor: {
    id: 'definidor',
    nombre: 'Definidor',
    descripcion: 'Dentro del area no perdona.',
    oculto: false,
    contra: false,
    puestos: ['MED', 'DEL'],
    afin: 'tiro',
    efectos: { punteria: 1.45 },
  },
  pulmon: {
    id: 'pulmon',
    nombre: 'Pulmón',
    descripcion: 'Corre los noventa minutos igual que los primeros diez.',
    oculto: false,
    contra: false,
    puestos: ['DEF', 'MED', 'DEL'],
    afin: 'fisico',
    efectos: { desgaste: 0.55 },
  },
  explosivo: {
    id: 'explosivo',
    nombre: 'Explosivo',
    descripcion: 'Arranca de cero y ya esta lanzado.',
    oculto: false,
    contra: false,
    puestos: ['DEF', 'MED', 'DEL'],
    afin: 'ritmo',
    efectos: { arranque: 1.28 },
  },
  aguerrido: {
    id: 'aguerrido',
    nombre: 'Aguerrido',
    descripcion: 'Va al piso sin pensarlo. A veces le sale caro.',
    oculto: false,
    contra: false,
    puestos: ['DEF', 'MED'],
    afin: 'quite',
    efectos: { barrida: 2.1 },
  },
  cabeceador: {
    id: 'cabeceador',
    nombre: 'Cabeceador',
    descripcion: 'Gana todas las que van por arriba.',
    oculto: false,
    contra: false,
    puestos: ['DEF', 'DEL'],
    afin: 'fisico',
    efectos: { juegoAereo: 1.6 },
  },
  achicador: {
    id: 'achicador',
    nombre: 'Achicador',
    descripcion: 'Sale de su arco a cortar antes de que sea tarde.',
    oculto: false,
    contra: false,
    puestos: ['ARQ'],
    afin: 'arquero',
    efectos: { salidaArquero: 1.7, juegoAereo: 1.25 },
  },
  egoista: {
    id: 'egoista',
    nombre: 'Egoísta',
    descripcion: 'Patea cuando tenia al companero solo.',
    oculto: false,
    contra: true,
    puestos: ['MED', 'DEL'],
    efectos: { egoismo: 2.4, paseFiltrado: 0.6 },
  },
  blando: {
    id: 'blando',
    nombre: 'Blando',
    descripcion: 'No mete el cuerpo y se cansa antes.',
    oculto: false,
    contra: true,
    puestos: ['DEF', 'MED', 'DEL'],
    efectos: { barrida: 0.35, desgaste: 1.4 },
  },
  intermitente: {
    id: 'intermitente',
    nombre: 'Intermitente',
    descripcion: 'Un dia es el mejor de la cancha y al otro no aparece.',
    oculto: true,
    contra: true,
    puestos: ['ARQ', 'DEF', 'MED', 'DEL'],
    efectos: { irregularidad: 3.2 },
  },
  creceConElPartido: {
    id: 'creceConElPartido',
    nombre: 'Crece con el partido',
    descripcion: 'En el segundo tiempo es otro.',
    oculto: true,
    contra: false,
    puestos: ['DEF', 'MED', 'DEL'],
    efectos: { segundoTiempo: 1.12, desgaste: 0.8 },
  },
  seApaga: {
    id: 'seApaga',
    nombre: 'Se apaga',
    descripcion: 'Arranca bien y despues del entretiempo desaparece.',
    oculto: true,
    contra: true,
    puestos: ['DEF', 'MED', 'DEL'],
    efectos: { segundoTiempo: 0.86, desgaste: 1.25 },
  },
  caradura: {
    id: 'caradura',
    nombre: 'Caradura',
    descripcion: 'De visitante juega igual que en su cancha.',
    oculto: true,
    contra: false,
    puestos: ['ARQ', 'DEF', 'MED', 'DEL'],
    efectos: {},
  },
};

const TODOS = Object.values(RASGOS);

export function rasgoPorId(id: string): Rasgo | null {
  return (RASGOS as Record<string, Rasgo>)[id] ?? null;
}

/**
 * Junta los efectos de una lista de rasgos. Se multiplican entre si, asi que
 * dos rasgos que empujan lo mismo se suman de verdad y no se pisan.
 */
export function efectosDe(rasgos: readonly string[]): EfectosRasgos {
  const total: EfectosRasgos = { ...EFECTOS_NEUTROS };
  for (const id of rasgos) {
    const rasgo = rasgoPorId(id);
    if (!rasgo) continue;
    for (const [clave, valor] of Object.entries(rasgo.efectos)) {
      const k = clave as keyof EfectosRasgos;
      total[k] *= valor;
    }
  }
  return total;
}

/**
 * Cuantos partidos hay que verlo jugar para que se destape el rasgo oculto.
 * Es a proposito mas de media temporada: la gracia es que aparezca cuando ya
 * te encarinaste con el, no en la ficha del primer dia.
 */
export const PARTIDOS_PARA_DESTAPAR = 12;

/** Si el rasgo oculto de un jugador ya se hizo evidente. */
export function rasgoOcultoVisible(partidosObservado: number): boolean {
  return partidosObservado >= PARTIDOS_PARA_DESTAPAR;
}

/**
 * Reparte rasgos a un jugador recien generado.
 *
 * Los rasgos no son gratis: los buenos salen de un atributo alto, asi que un
 * defensor de media 50 no nace definidor. Y siempre hay chance de que le toque
 * uno en contra, para que la ficha no sea una lista de virtudes.
 */
export function sortearRasgos(
  rng: Rng,
  pos: PosicionCodigo,
  attrs: Atributos,
  media: number,
): { rasgos: RasgoId[]; rasgoOculto: RasgoId | null } {
  const candidatos = TODOS.filter((r) => !r.oculto && r.puestos.includes(pos));

  const peso = (rasgo: Rasgo): number => {
    if (rasgo.contra) {
      // Cuanto peor el jugador, mas probable que tenga un defecto marcado.
      // Pesa poco a proposito: si los defectos son lo mas comun, la ficha de
      // cualquiera es una lista de quejas y el rasgo deja de ser una noticia.
      return 0.22 + Math.max(0, 62 - media) / 60;
    }
    if (!rasgo.afin) return 1;
    // Una virtud sale de un atributo alto: nadie nace definidor con 40 de tiro.
    return Math.max(0.06, (attrs[rasgo.afin] - 52) / 20);
  };

  const rasgos: RasgoId[] = [];
  // Casi todos tienen uno; tener dos es de unos pocos.
  const cuantos = rng.chance(0.18) ? 2 : rng.chance(0.72) ? 1 : 0;

  for (let i = 0; i < cuantos; i++) {
    const disponibles = candidatos.filter((r) => !rasgos.includes(r.id));
    const total = disponibles.reduce((suma, r) => suma + peso(r), 0);
    if (total <= 0) break;

    let tirada = rng.float(0, total);
    for (const rasgo of disponibles) {
      tirada -= peso(rasgo);
      if (tirada <= 0) {
        rasgos.push(rasgo.id);
        break;
      }
    }
  }

  const ocultos = TODOS.filter((r) => r.oculto && r.puestos.includes(pos));
  const rasgoOculto = rng.chance(0.55) ? rng.pick(ocultos).id : null;

  return { rasgos, rasgoOculto };
}
