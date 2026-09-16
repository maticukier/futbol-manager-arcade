import { FORMACIONES } from '@/sim/tacticas';
import type { Formacion } from '@/sim/types';
import {
  ACELERACION,
  ALCANCE_ALTO,
  ALCANCE_ALTO_ARQUERO,
  ANCHO,
  AREA_ANCHO,
  AREA_LARGO,
  ARCO_ALTO,
  ARCO_ANCHO,
  FRENADO,
  GIRO,
  GRAVEDAD,
  LARGO,
  MINUTOS_POR_TIEMPO,
  PENAL_DISTANCIA,
  RADIO_JUGADOR,
  RADIO_PELOTA,
  REBOTE,
  ROCE_AIRE,
  ROCE_PISO,
  SEGUNDOS_POR_TIEMPO,
  VELOCIDAD_MAX,
  VELOCIDAD_MIN,
  dentroDelArco,
  distancia2,
  limitar,
} from './mundo';
import type {
  AvisoPartido,
  Bando,
  ConfiguracionEquipo,
  ConfiguracionPartido,
  EntradaPartido,
  FaseJuego,
  EventoPartido,
  Instantanea,
  JugadorPartido,
  Pelota,
  ResultadoPartido,
} from './entidades';

/** A que distancia se para el que marca, del lado del arco propio. */
const DISTANCIA_DE_MARCA = 2.1;

/** Desde que distancia el atacante sin pelota empieza a despegarse del que lo sigue. */
const DISTANCIA_DE_DESMARQUE = 7;

/**
 * Motor del partido: reglas, fisica e inteligencia artificial.
 *
 * No sabe nada de como se dibuja. El render 3D lee este estado cada cuadro y
 * el motor avanza con `paso`, asi que se puede simular sin pantalla.
 */
export class MotorPartido {
  readonly config: ConfiguracionPartido;
  readonly jugadores: JugadorPartido[] = [];
  readonly pelota: Pelota = {
    x: 0,
    y: RADIO_PELOTA,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    duenoId: null,
    ultimoToqueId: null,
    bloqueoPosesion: 0,
    giro: 0,
  };

  fase: FaseJuego = 'saque_inicial';
  /** Si esta en true, la IA maneja tambien al equipo del usuario. Sirve para medir el balance. */
  iaTotal = false;
  aviso: AvisoPartido | null = null;
  tiempoActual: 1 | 2 = 1;
  segundosJugados = 0;
  terminado = false;

  golesUsuario = 0;
  golesRival = 0;
  controladoId: string | null = null;

  readonly amarillas = { usuario: 0, rival: 0 };
  readonly rojas = { usuario: 0, rival: 0 };
  readonly cambiosUsados = { usuario: 0, rival: 0 };
  /** Maximo de cambios por equipo, como en el futbol de hoy. */
  readonly cambiosMaximos = 5;

  /** Cola de avisos para el sonido; el bucle la vacia en cada cuadro. */
  readonly eventos: EventoPartido[] = [];

  private amonestados: string[] = [];
  private expulsados: string[] = [];
  private goleadoresUsuario: string[] = [];
  private goleadoresRival: string[] = [];
  private remates = { usuario: 0, rival: 0 };
  private posesion = { usuario: 0, rival: 0 };

  private temporizadorFase = 0;
  /** El cartel puede quedar en pantalla sin frenar la jugada. */
  private temporizadorAviso = 0;
  private saqueDe: Bando = 'usuario';
  /** Mientras dure, un segundo jugador del usuario va a presionar la pelota. */
  private presionando = 0;
  private tiempoArqueroConPelota = 0;
  /** Hace cuanto que la pelota viaja suelta y rapido: da el tiempo de reaccion. */
  private vueloDeLaPelota = 0;
  /** Evita que el cambio de jugador se dispare varias veces de un toque. */
  private esperaCambio = 0;
  /** Quien patea el penal y cuanto le queda para decidirse. */
  private ejecutorPenal: string | null = null;
  private temporizadorPenal = 0;
  private punteriaPenal = 0;

  constructor(config: ConfiguracionPartido) {
    this.config = config;
    this.jugadores.push(...this.armarEquipo(config.usuario, 'usuario'));
    this.jugadores.push(...this.armarEquipo(config.rival, 'rival'));
    this.prepararSaqueInicial('usuario');
    this.anunciar('¡ARRANCA!', `${config.usuario.abrev} vs ${config.rival.abrev}`, 1.4);
  }

  // ------------------------------------------------------------------ armado

  private armarEquipo(equipo: ConfiguracionEquipo, bando: Bando): JugadorPartido[] {
    const ranuras = FORMACIONES[equipo.tacticas.formacion];
    return ranuras.map((ranura, i) => {
      const fuente = equipo.jugadores[i];
      const punto = this.aMundo(bando, ranura.x, ranura.y);
      return {
        id: fuente.id,
        nombre: fuente.nombre,
        dorsal: i + 1,
        bando,
        pos: ranura.pos,
        attrs: fuente.attrs,
        baseAncho: ranura.x,
        baseLargo: ranura.y,
        x: punto.x,
        z: punto.z,
        vx: 0,
        vz: 0,
        rumbo: bando === 'usuario' ? 0 : Math.PI,
        energia: 0.65 + (fuente.forma / 100) * 0.35,
        esArquero: ranura.pos === 'ARQ',
        estado: 'normal',
        bloqueo: 0,
        temporizador: 0,
        paso: Math.random() * Math.PI * 2,
        patada: 0,
        amarillas: 0,
        expulsado: false,
        marcaA: null,
        ranura: i,
      };
    });
  }

  /**
   * Pasa una posicion de formacion a coordenadas de cancha.
   * El usuario ataca hacia +X y el rival hacia -X, siempre, tambien en el
   * segundo tiempo: en un arcade marea menos que te cambien de lado.
   */
  private aMundo(bando: Bando, ancho: number, largo: number): { x: number; z: number } {
    if (bando === 'usuario') {
      return { x: (largo - 0.5) * LARGO, z: (ancho - 0.5) * ANCHO };
    }
    return { x: (0.5 - largo) * LARGO, z: (0.5 - ancho) * ANCHO };
  }

  private arcoRivalDe(bando: Bando): number {
    return bando === 'usuario' ? LARGO / 2 : -LARGO / 2;
  }

  private arcoPropioDe(bando: Bando): number {
    return bando === 'usuario' ? -LARGO / 2 : LARGO / 2;
  }

  private equipoDe(bando: Bando): ConfiguracionEquipo {
    return bando === 'usuario' ? this.config.usuario : this.config.rival;
  }

  // ------------------------------------------------------------------- bucle

  paso(dt: number, entrada: EntradaPartido): void {
    if (this.terminado) return;
    this.esperaCambio = Math.max(0, this.esperaCambio - dt);
    this.presionando = Math.max(0, this.presionando - dt);

    if (this.temporizadorAviso > 0) {
      this.temporizadorAviso -= dt;
      if (this.temporizadorAviso <= 0) this.aviso = null;
    }

    if (this.temporizadorFase > 0) {
      this.temporizadorFase -= dt;
      // En el penal nadie se mueve: ya estan todos acomodados.
      if (this.fase !== 'penal') {
        this.moverJugadores(dt, entrada, true);
        this.pegarPelotaAlDueno();
      }
      if (this.temporizadorFase <= 0) this.terminarFase();
      return;
    }

    if (this.fase === 'penal') {
      this.segundosJugados += dt;
      this.resolverPenal(dt, entrada);
      return;
    }

    if (this.fase !== 'jugando') return;

    this.segundosJugados += dt;
    this.registrarPosesion(dt);
    this.elegirControlado();
    this.moverJugadores(dt, entrada, false);
    this.separarCuerpos();
    this.aplicarAcciones(entrada);
    this.moverPelota(dt);
    this.revisarArqueroConPelota(dt);
    this.revisarLimites();
    this.revisarReloj();
  }

  /**
   * Muestra un cartel. Con `pausa` en false la jugada sigue: los laterales,
   * los corners y los saques de arco se reanudan sin cortar el partido.
   */
  private anunciar(titulo: string, detalle: string, segundos: number, pausa = true): void {
    this.aviso = { titulo, detalle };
    this.temporizadorAviso = segundos;
    if (pausa) this.temporizadorFase = segundos;
  }

  private terminarFase(): void {
    this.temporizadorFase = 0;

    switch (this.fase) {
      case 'entretiempo':
        this.tiempoActual = 2;
        this.segundosJugados = 0;
        this.prepararSaqueInicial(this.saqueDe === 'usuario' ? 'rival' : 'usuario');
        this.fase = 'jugando';
        break;
      case 'final':
        this.terminado = true;
        break;
      case 'penal':
        // El penal sigue despues del cartel: lo resuelve resolverPenal.
        break;
      default:
        this.fase = 'jugando';
        break;
    }
  }

  private registrarPosesion(dt: number): void {
    const dueno = this.porId(this.pelota.duenoId);
    if (!dueno) return;
    if (dueno.bando === 'usuario') this.posesion.usuario += dt;
    else this.posesion.rival += dt;
  }

  private revisarReloj(): void {
    if (this.segundosJugados < SEGUNDOS_POR_TIEMPO) return;
    this.eventos.push({ tipo: 'silbato', largo: 0.6 });
    if (this.tiempoActual === 1) {
      this.fase = 'entretiempo';
      this.anunciar('ENTRETIEMPO', `${this.golesUsuario} - ${this.golesRival}`, 2);
    } else {
      this.fase = 'final';
      this.anunciar('FINAL', `${this.golesUsuario} - ${this.golesRival}`, 2.4);
    }
  }

  /** Minuto de partido que se muestra en el marcador. */
  get minuto(): number {
    const parcial = Math.min(
      MINUTOS_POR_TIEMPO,
      Math.floor((this.segundosJugados / SEGUNDOS_POR_TIEMPO) * MINUTOS_POR_TIEMPO),
    );
    return this.tiempoActual === 1 ? parcial : MINUTOS_POR_TIEMPO + parcial;
  }

  get tieneLaPelotaElUsuario(): boolean {
    const dueno = this.porId(this.pelota.duenoId);
    return dueno?.bando === 'usuario';
  }

  // -------------------------------------------------------------- jugadores

  porId(id: string | null): JugadorPartido | null {
    if (!id) return null;
    return this.jugadores.find((j) => j.id === id) ?? null;
  }

  /** Los que siguen en cancha: sin los expulsados. */
  private activos(bando?: Bando): JugadorPartido[] {
    return this.jugadores.filter((j) => !j.expulsado && (bando === undefined || j.bando === bando));
  }

  private velocidadDe(j: JugadorPartido): number {
    const base = VELOCIDAD_MIN + (j.attrs.ritmo / 100) * (VELOCIDAD_MAX - VELOCIDAD_MIN);
    return base * (0.78 + j.energia * 0.22);
  }

  private masCercanoALaPelota(bando: Bando, incluirArquero: boolean): JugadorPartido | null {
    let mejor: JugadorPartido | null = null;
    let mejorDistancia = Infinity;
    for (const j of this.jugadores) {
      if (j.expulsado || j.bando !== bando || (j.esArquero && !incluirArquero)) continue;
      const d = distancia2(j.x, j.z, this.pelota.x, this.pelota.z);
      if (d < mejorDistancia) {
        mejorDistancia = d;
        mejor = j;
      }
    }
    return mejor;
  }

  private elegirControlado(): void {
    const dueno = this.porId(this.pelota.duenoId);
    if (dueno && dueno.bando === 'usuario') {
      this.controladoId = dueno.id;
      return;
    }
    const actual = this.porId(this.controladoId);
    // Mientras el jugador marcado siga siendo razonable, no se lo cambio al
    // usuario de prepo: el cambio automatico constante desorienta.
    if (actual && actual.bando === 'usuario' && actual.estado === 'normal') {
      const suya = distancia2(actual.x, actual.z, this.pelota.x, this.pelota.z);
      const cercano = this.masCercanoALaPelota('usuario', false);
      if (!cercano || suya < 14) return;
    }
    this.controladoId = this.masCercanoALaPelota('usuario', false)?.id ?? this.controladoId;
  }

  private moverJugadores(dt: number, entrada: EntradaPartido, detenido: boolean): void {
    const dueno = this.porId(this.pelota.duenoId);
    const bandoConPelota: Bando | null = dueno ? dueno.bando : null;
    const perseguidores = detenido ? new Set<string>() : this.elegirPerseguidores(bandoConPelota);
    if (!detenido) this.asignarMarcas(bandoConPelota);

    for (const j of this.jugadores) {
      if (j.expulsado) continue;
      j.bloqueo = Math.max(0, j.bloqueo - dt);
      j.patada = Math.max(0, j.patada - dt);
      // El aire se gasta corriendo y se recupera trotando o parado, nunca al reves.
      const velocidad = Math.hypot(j.vx, j.vz);
      const desgaste = dt * (0.0016 + velocidad * 0.0011) * (1.4 - j.attrs.fisico / 200);
      const recupera = velocidad < 2.2 ? dt * 0.012 : 0;
      j.energia = limitar(j.energia - desgaste + recupera, 0.35, 1);

      if (j.estado === 'barrida' || j.estado === 'caido') {
        this.avanzarBarrida(j, dt);
        continue;
      }
      if (j.patada <= 0 && j.estado === 'pateando') j.estado = 'normal';

      if (j.esArquero) {
        this.moverArquero(j, dt, detenido);
        continue;
      }

      if (!detenido && this.controladoId === j.id && !this.iaTotal) {
        this.moverControlado(j, dt, entrada);
        continue;
      }

      if (!detenido && this.pelota.duenoId === j.id && (this.iaTotal || this.controladoId !== j.id)) {
        this.moverConPelotaIa(j, dt);
        continue;
      }

      if (perseguidores.has(j.id)) {
        this.irHacia(j, this.pelota.x, this.pelota.z, dt, 1);
        continue;
      }

      const destino = this.destinoDeFormacion(j, bandoConPelota);
      this.irHacia(j, destino.x, destino.z, dt, detenido ? 0.55 : 0.85);
    }

    if (!detenido) this.resolverDisputa(dt);
  }

  private elegirPerseguidores(bandoConPelota: Bando | null): Set<string> {
    const perseguidores = new Set<string>();
    for (const bando of ['usuario', 'rival'] as Bando[]) {
      if (bandoConPelota === bando) continue;
      const candidatos = this.jugadores
        .filter(
          (j) =>
            j.bando === bando &&
            !j.esArquero &&
            !j.expulsado &&
            j.estado === 'normal' &&
            // Al que maneja el usuario no lo mando yo a buscarla: la va a buscar el.
            (this.iaTotal || j.id !== this.controladoId),
        )
        .sort(
          (a, b) =>
            distancia2(a.x, a.z, this.pelota.x, this.pelota.z) -
            distancia2(b.x, b.z, this.pelota.x, this.pelota.z),
        );

      if (candidatos[0]) perseguidores.add(candidatos[0].id);
      const presionAlta = this.equipoDe(bando).tacticas.presion > 60;
      const presionManual = bando === 'usuario' && this.presionando > 0;
      if ((presionAlta || presionManual) && candidatos[1]) perseguidores.add(candidatos[1].id);
    }
    return perseguidores;
  }

  /**
   * Reparte a quien marca cada uno del equipo que no tiene la pelota.
   *
   * Va por orden de peligro: primero el rival mas cerca del arco propio, y a
   * cada uno le asigna el defensor libre mas cercano. Sin esto los atacantes
   * quedan siempre solos y defender no se siente como nada.
   */
  private asignarMarcas(bandoConPelota: Bando | null): void {
    for (const j of this.jugadores) j.marcaA = null;
    if (bandoConPelota === null) return;

    const defiende: Bando = bandoConPelota === 'usuario' ? 'rival' : 'usuario';
    const arco = this.arcoPropioDe(defiende);

    // Solo marcan los de la mitad de atras de la formacion.
    const marcadores = this.activos(defiende).filter((j) => !j.esArquero && j.baseLargo <= 0.58);
    if (marcadores.length === 0) return;

    // Los rivales mas cerca de mi arco son los que mas urgen.
    const amenazas = this.activos(bandoConPelota)
      .filter((j) => !j.esArquero && Math.abs(j.x - arco) < 48)
      .sort((a, b) => Math.abs(a.x - arco) - Math.abs(b.x - arco));

    const libres = [...marcadores];
    for (const amenaza of amenazas) {
      if (libres.length === 0) break;
      // Al rival mas peligroso lo agarra el defensor libre que tenga mas cerca.
      let elegido = 0;
      for (let i = 1; i < libres.length; i++) {
        const actual = distancia2(libres[i].x, libres[i].z, amenaza.x, amenaza.z);
        const mejor = distancia2(libres[elegido].x, libres[elegido].z, amenaza.x, amenaza.z);
        if (actual < mejor) elegido = i;
      }
      libres[elegido].marcaA = amenaza.id;
      libres.splice(elegido, 1);
    }
  }

  /** Puesto de reposo, corrido hacia la pelota y segun lo que pida la tactica. */
  private destinoDeFormacion(j: JugadorPartido, bandoConPelota: Bando | null): { x: number; z: number } {
    const tacticas = this.equipoDe(j.bando).tacticas;
    const base = this.aMundo(j.bando, j.baseAncho, j.baseLargo);
    const direccion = j.bando === 'usuario' ? 1 : -1;

    const atacando = bandoConPelota === j.bando;
    const mentalidad = tacticas.mentalidad / 100;
    const linea = tacticas.lineaDefensiva / 100;

    const empuje = atacando ? 5 + mentalidad * 17 : -(4 + (1 - linea) * 14);
    const seguirPelota = (this.pelota.x - base.x) * 0.2;

    const puesto = {
      x: limitar(base.x + empuje * direccion + seguirPelota, -LARGO / 2 + 2, LARGO / 2 - 2),
      z: limitar(base.z + this.pelota.z * 0.32, -ANCHO / 2 + 1.5, ANCHO / 2 - 1.5),
    };

    if (atacando) return this.buscarEspacio(j, puesto, direccion);
    if (!j.marcaA) return puesto;

    const hombre = this.porId(j.marcaA);
    if (!hombre || hombre.expulsado) return puesto;

    // Marcar es pararse del lado del arco propio, entre el rival y el arco.
    const arco = this.arcoPropioDe(j.bando);
    // Un defensor flojo no se pega como uno bueno: se para mas lejos y suelta
    // mas la marca. De ahi sale que un equipo chico deje espacios.
    const oficio = 0.5 + (j.attrs.quite / 100) * 0.6;
    const dx = arco - hombre.x;
    const dz = -hombre.z * 0.35;
    const d = Math.hypot(dx, dz) || 1;
    const distancia = DISTANCIA_DE_MARCA + (1 - oficio) * 3;
    const marca = {
      x: hombre.x + (dx / d) * distancia,
      z: hombre.z + (dz / d) * distancia,
    };

    // Cuanto mas cerca del arco propio esta el hombre, mas me le pego. Lejos
    // se lo deja mas suelto para no romper la linea persiguiendo a uno solo.
    const distanciaAlArco = Math.abs(hombre.x - arco);
    const peso = limitar((1.05 - distanciaAlArco / 55) * oficio, 0.25, 0.85);
    return {
      x: limitar(puesto.x * (1 - peso) + marca.x * peso, -LARGO / 2 + 2, LARGO / 2 - 2),
      z: limitar(puesto.z * (1 - peso) + marca.z * peso, -ANCHO / 2 + 1.5, ANCHO / 2 - 1.5),
    };
  }

  /**
   * Desmarque. El que ataca sin la pelota no se queda parado en su casillero:
   * se despega del que lo sigue y, si esta por delante de la pelota, pica al
   * espacio. Sin esto la marca personal apaga el ataque, porque el defensor se
   * para encima de un rival que nunca se mueve.
   */
  private buscarEspacio(
    j: JugadorPartido,
    puesto: { x: number; z: number },
    direccion: number,
  ): { x: number; z: number } {
    if (this.pelota.duenoId === j.id) return puesto;

    let x = puesto.x;
    let z = puesto.z;

    const marcador = this.rivalMasCercano(j);
    if (marcador) {
      const d = distancia2(j.x, j.z, marcador.x, marcador.z);
      if (d < DISTANCIA_DE_DESMARQUE) {
        // Despegarse es abrirse al costado, nunca retroceder: el que marca se
        // para del lado del arco, asi que alejarse de el en linea recta es
        // justo lo que el defensor quiere.
        const fuerza = (1 - d / DISTANCIA_DE_DESMARQUE) * 6;
        z += (j.z - marcador.z >= 0 ? 1 : -1) * fuerza;
      }
    }

    // Delante de la pelota se pica al espacio; atras se ofrece para el apoyo.
    const adelante = (j.x - this.pelota.x) * direccion;
    x += direccion * (adelante > 0 ? 4 : -1.5);

    return {
      x: limitar(x, -LARGO / 2 + 2, LARGO / 2 - 2),
      z: limitar(z, -ANCHO / 2 + 1.5, ANCHO / 2 - 1.5),
    };
  }

  private irHacia(j: JugadorPartido, x: number, z: number, dt: number, factor: number): void {
    const dx = x - j.x;
    const dz = z - j.z;
    const d = Math.hypot(dx, dz);

    if (d < 0.35) {
      this.acelerarHacia(j, 0, 0, dt);
    } else {
      const velocidad = this.velocidadDe(j) * factor;
      this.acelerarHacia(j, (dx / d) * velocidad, (dz / d) * velocidad, dt);
    }
    this.integrar(j, dt);
  }

  /**
   * Lleva la velocidad hacia la que se quiere, pero de a poco y con distinto
   * costo segun el caso: acelerar derecho es medio, frenar es rapido y cambiar
   * de direccion en velocidad es lento. Eso es lo que le da peso al jugador.
   */
  private acelerarHacia(j: JugadorPartido, objetivoVx: number, objetivoVz: number, dt: number): void {
    const dvx = objetivoVx - j.vx;
    const dvz = objetivoVz - j.vz;
    const cambio = Math.hypot(dvx, dvz);
    if (cambio < 0.01) return;

    const velocidad = Math.hypot(j.vx, j.vz);
    // Cuanto se parece el cambio que pide a la direccion en la que ya va.
    const alineacion = velocidad > 0.5 ? (j.vx * dvx + j.vz * dvz) / (velocidad * cambio) : 1;
    const agilidad = 0.75 + (j.attrs.regate / 100) * 0.5;
    const tasa = (alineacion > 0.6 ? ACELERACION : alineacion < -0.6 ? FRENADO : GIRO) * agilidad;

    const paso = Math.min(cambio, tasa * dt);
    j.vx += (dvx / cambio) * paso;
    j.vz += (dvz / cambio) * paso;
  }

  private moverControlado(j: JugadorPartido, dt: number, entrada: EntradaPartido): void {
    const conPelota = this.pelota.duenoId === j.id;
    const puedeCorrer = entrada.correr && j.energia > 0.18;
    if (puedeCorrer) j.energia = Math.max(0, j.energia - dt * 0.075);
    // Corriendo se gana velocidad pero se pierde algo de control con la pelota.
    const esfuerzo = puedeCorrer ? (conPelota ? 1.24 : 1.35) : 1;
    const velocidad = this.velocidadDe(j) * (conPelota ? 0.9 : 1) * esfuerzo;
    this.acelerarHacia(j, entrada.moverX * velocidad, entrada.moverZ * velocidad, dt);
    this.integrar(j, dt);
  }

  /** IA del que lleva la pelota: encara, la suelta si lo aprietan, define si puede. */
  private moverConPelotaIa(j: JugadorPartido, dt: number): void {
    const arco = this.arcoRivalDe(j.bando);
    const distanciaArco = Math.abs(arco - j.x);
    const rival = this.rivalMasCercano(j);
    const presionado = rival ? distancia2(j.x, j.z, rival.x, rival.z) < 3.2 : false;

    if (distanciaArco < 32 && Math.abs(j.z) < 24) {
      const ganas = 0.55 + j.attrs.tiro / 220 - distanciaArco / 90;
      if (Math.random() < ganas * dt * 1.85) {
        this.patear(j, 0.85);
        return;
      }
    }

    if (presionado && Math.random() < dt * 2.2) {
      const direccion = j.bando === 'usuario' ? 1 : -1;
      this.pasar(j, direccion, 0, Math.random() < 0.25);
      return;
    }

    // Encarar no es correr derecho contra el defensor: se busca su lado flojo.
    // Pero eso vale lejos del arco. Cerca hay que ir a la boca del arco, si no
    // el que lleva la pelota termina gambeteando hasta el banderin del corner.
    const abrirse = limitar(distanciaArco / 30, 0, 1);
    let objetivoZ = j.z * 0.6 * abrirse;
    if (rival && presionado) {
      objetivoZ += (j.z - rival.z >= 0 ? 1 : -1) * 6 * abrirse;
    }
    this.irHacia(j, arco, limitar(objetivoZ, -ANCHO / 2 + 3, ANCHO / 2 - 3), dt, 0.98);
  }

  private rivalMasCercano(j: JugadorPartido): JugadorPartido | null {
    let mejor: JugadorPartido | null = null;
    let mejorDistancia = Infinity;
    for (const otro of this.jugadores) {
      if (otro.bando === j.bando || otro.estado === 'caido' || otro.expulsado) continue;
      const d = distancia2(j.x, j.z, otro.x, otro.z);
      if (d < mejorDistancia) {
        mejorDistancia = d;
        mejor = otro;
      }
    }
    return mejor;
  }

  private moverArquero(arquero: JugadorPartido, dt: number, detenido: boolean): void {
    const linea = this.arcoPropioDe(arquero.bando);
    const haciaAdentro = arquero.bando === 'usuario' ? 1 : -1;
    const dueno = this.porId(this.pelota.duenoId);

    let objetivoZ: number;
    let objetivoX: number;
    let factor = 1;

    if (this.pelota.duenoId === arquero.id) {
      // Con la pelota en la mano sale jugando: camina hasta el borde del area
      // en vez de quedarse plantado sobre la linea.
      objetivoX = linea + 10 * haciaAdentro;
      objetivoZ = limitar(arquero.z * 0.5, -12, 12);
      this.irHacia(arquero, objetivoX, objetivoZ, dt, 0.55);
      return;
    }

    // Pelota suelta en su area: sale a buscarla en vez de mirarla pasar.
    if (!detenido && this.deberiaSalirAbuscarla(arquero, linea)) {
      this.irHacia(arquero, this.pelota.x, this.pelota.z, dt, 1.2);
      return;
    }

    const cruce = this.cruceDelRemate(arquero);
    if (!detenido && cruce !== null) {
      // Se estira hacia donde va a cruzar la linea. Que llegue o no depende de
      // su velocidad y de lo que se equivoque al leer el remate.
      const error = (1.1 + ((100 - arquero.attrs.arquero) / 100) * 2.6) * (Math.random() - 0.5) * 2;
      objetivoZ = limitar(cruce + error, -ARCO_ANCHO / 2 - 1, ARCO_ANCHO / 2 + 1);
      objetivoX = linea + 0.8 * haciaAdentro;
      factor = 1.3;
    } else {
      const distanciaPelota = Math.abs(this.pelota.x - linea);
      const peligro = !detenido && distanciaPelota < AREA_LARGO + 6 && (!dueno || dueno.bando !== arquero.bando);
      const salida = peligro ? Math.min(9, AREA_LARGO + 6 - distanciaPelota) : 1.2;
      objetivoZ = limitar(this.pelota.z * 0.62, -ARCO_ANCHO / 2 - 0.6, ARCO_ANCHO / 2 + 0.6);
      objetivoX = linea + salida * haciaAdentro;
    }

    const velocidad = (2.8 + (arquero.attrs.arquero / 100) * 3.4) * factor;
    const dx = objetivoX - arquero.x;
    const dz = objetivoZ - arquero.z;
    const d = Math.hypot(dx, dz) || 1;
    const suave = Math.min(1, dt * 9);
    arquero.vx += ((dx / d) * velocidad - arquero.vx) * suave;
    arquero.vz += ((dz / d) * velocidad - arquero.vz) * suave;
    this.integrar(arquero, dt);
  }

  /**
   * Decide si el arquero tiene que salir a quedarse con una pelota suelta.
   * Solo dentro de su area y solo si llega antes que el rival mas cercano:
   * no queremos verlo corriendo hasta el medio de la cancha.
   */
  private deberiaSalirAbuscarla(arquero: JugadorPartido, linea: number): boolean {
    if (this.pelota.duenoId !== null) return false;
    if (this.pelota.y > ALCANCE_ALTO_ARQUERO) return false;

    // Una pelota rapida no se va a buscar corriendo: para eso esta la estirada.
    if (Math.hypot(this.pelota.vx, this.pelota.vz) > 8) return false;

    const dentroDelArea =
      Math.abs(this.pelota.x - linea) < AREA_LARGO && Math.abs(this.pelota.z) < AREA_ANCHO / 2;
    if (!dentroDelArea) return false;

    const suya = distancia2(arquero.x, arquero.z, this.pelota.x, this.pelota.z);
    if (suya > 12) return false;

    let rivalMasCerca = Infinity;
    for (const j of this.jugadores) {
      if (j.bando === arquero.bando || j.expulsado || j.estado === 'caido') continue;
      rivalMasCerca = Math.min(rivalMasCerca, distancia2(j.x, j.z, this.pelota.x, this.pelota.z));
    }

    // Sale solo si llega claramente primero: dejar el arco vacio cuesta un gol.
    return suya < rivalMasCerca - 0.5;
  }

  /**
   * En que Z va a cruzar la linea, si viene un remate a ese arco.
   * Devuelve null hasta que pasa el tiempo de reaccion: un arquero no sale
   * disparado en el mismo instante en que el otro le pega.
   */
  private cruceDelRemate(arquero: JugadorPartido): number | null {
    if (this.pelota.duenoId !== null) return null;
    const reaccion = 0.12 + ((100 - arquero.attrs.arquero) / 100) * 0.3;
    if (this.vueloDeLaPelota < reaccion) return null;
    const linea = this.arcoPropioDe(arquero.bando);
    const hacia = linea > 0 ? this.pelota.vx > 6 : this.pelota.vx < -6;
    if (!hacia) return null;
    const tiempo = (linea - this.pelota.x) / this.pelota.vx;
    if (tiempo <= 0 || tiempo > 1.6) return null;
    return this.pelota.z + this.pelota.vz * tiempo;
  }

  /**
   * Empuja a los que quedaron encimados. Sin esto los jugadores se atraviesan
   * y el partido se siente hecho de fantasmas: chocar es lo que hace que
   * proteger la pelota y meter el cuerpo signifiquen algo.
   */
  private separarCuerpos(): void {
    const enCancha = this.activos();
    const minimo = RADIO_JUGADOR * 2;

    for (let i = 0; i < enCancha.length; i++) {
      for (let k = i + 1; k < enCancha.length; k++) {
        const a = enCancha[i];
        const b = enCancha[k];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= minimo) continue;

        // Si quedaron exactamente encima, los separo en una direccion cualquiera.
        const nx = d > 0.001 ? dx / d : 1;
        const nz = d > 0.001 ? dz / d : 0;
        const invasion = minimo - Math.max(d, 0.001);

        // El que se esta barriendo empuja; el que esta en el piso se deja llevar.
        const pesoA = a.estado === 'barrida' ? 0.15 : a.estado === 'caido' ? 0.85 : 0.5;
        const pesoB = b.estado === 'barrida' ? 0.15 : b.estado === 'caido' ? 0.85 : 0.5;
        const total = pesoA + pesoB || 1;

        a.x -= nx * invasion * (pesoA / total);
        a.z -= nz * invasion * (pesoA / total);
        b.x += nx * invasion * (pesoB / total);
        b.z += nz * invasion * (pesoB / total);

        // Y les saco la parte de la velocidad con la que se venian metiendo uno
        // dentro del otro, para que no se queden empujandose eternamente.
        const acercamiento = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (acercamiento >= 0) continue;
        a.vx += nx * acercamiento * 0.5;
        a.vz += nz * acercamiento * 0.5;
        b.vx -= nx * acercamiento * 0.5;
        b.vz -= nz * acercamiento * 0.5;
      }
    }
  }

  private integrar(j: JugadorPartido, dt: number): void {
    j.x = limitar(j.x + j.vx * dt, -LARGO / 2 - 2, LARGO / 2 + 2);
    j.z = limitar(j.z + j.vz * dt, -ANCHO / 2 - 2, ANCHO / 2 + 2);

    const velocidad = Math.hypot(j.vx, j.vz);
    if (velocidad > 0.4) {
      const objetivo = Math.atan2(j.vz, j.vx);
      j.rumbo = anguloHacia(j.rumbo, objetivo, dt * 9);
      j.paso += velocidad * dt * 1.5;
    } else {
      j.paso += dt * 0.6;
    }
  }

  // ---------------------------------------------------------------- acciones

  private aplicarAcciones(entrada: EntradaPartido): void {
    if (this.iaTotal) return;
    const jugador = this.porId(this.controladoId);
    if (!jugador || jugador.estado === 'caido' || jugador.estado === 'barrida') return;

    const conPelota = this.pelota.duenoId === jugador.id;
    const direccionAtaque = jugador.bando === 'usuario' ? 1 : -1;

    if (conPelota) {
      if (entrada.a) this.pasar(jugador, entrada.moverX || direccionAtaque, entrada.moverZ, false);
      else if (entrada.b) this.patear(jugador, entrada.potencia);
      else if (entrada.c) this.pasar(jugador, entrada.moverX || direccionAtaque, entrada.moverZ, true);
      return;
    }

    if (entrada.a) this.cambiarJugador();
    else if (entrada.b) this.barrerse(jugador);
    else if (entrada.c) this.presionando = 2.2;
  }

  private cambiarJugador(): void {
    if (this.esperaCambio > 0) return;
    this.esperaCambio = 0.25;

    const candidatos = this.jugadores
      .filter((j) => j.bando === 'usuario' && !j.esArquero && j.estado === 'normal' && !j.expulsado)
      .sort(
        (a, b) =>
          distancia2(a.x, a.z, this.pelota.x, this.pelota.z) -
          distancia2(b.x, b.z, this.pelota.x, this.pelota.z),
      );
    if (candidatos.length === 0) return;

    const actual = candidatos.findIndex((j) => j.id === this.controladoId);
    this.controladoId = candidatos[(actual + 1) % candidatos.length].id;
  }

  /** Barrida: se tira al piso hacia adelante. Si llega a la pelota la saca. */
  private barrerse(j: JugadorPartido): void {
    if (j.estado !== 'normal') return;
    j.estado = 'barrida';
    j.temporizador = 0.55;
    const velocidad = this.velocidadDe(j) * 1.7;
    j.vx = Math.cos(j.rumbo) * velocidad;
    j.vz = Math.sin(j.rumbo) * velocidad;
  }

  private avanzarBarrida(j: JugadorPartido, dt: number): void {
    j.temporizador -= dt;

    if (j.estado === 'barrida') {
      j.vx *= Math.pow(0.22, dt);
      j.vz *= Math.pow(0.22, dt);
      this.integrar(j, dt);
      this.revisarContactoBarrida(j);
      if (j.temporizador <= 0) {
        j.estado = 'caido';
        j.temporizador = 0.95;
        j.vx = 0;
        j.vz = 0;
      }
      return;
    }

    j.vx = 0;
    j.vz = 0;
    if (j.temporizador <= 0) j.estado = 'normal';
  }

  private revisarContactoBarrida(j: JugadorPartido): void {
    const dueno = this.porId(this.pelota.duenoId);

    if (distancia2(j.x, j.z, this.pelota.x, this.pelota.z) < 1.4 && this.pelota.y < 1) {
      // Llego a la pelota: la despeja hacia adelante y el rival la pierde.
      this.pelota.duenoId = null;
      this.pelota.ultimoToqueId = j.id;
      const angulo = j.rumbo + (Math.random() - 0.5) * 0.7;
      const fuerza = 7 + j.attrs.quite / 12;
      this.pelota.vx = Math.cos(angulo) * fuerza;
      this.pelota.vz = Math.sin(angulo) * fuerza;
      this.pelota.vy = 1.2;
      this.pelota.bloqueoPosesion = 0.35;
      if (dueno) dueno.bloqueo = 0.6;
      j.temporizador = Math.min(j.temporizador, 0.12);
      return;
    }

    if (!dueno || dueno.bando === j.bando) return;
    if (distancia2(j.x, j.z, dueno.x, dueno.z) > 1.3) return;

    // Le pego al jugador sin tocar la pelota: falta.
    this.cobrarFalta(dueno, j);
  }

  private cobrarFalta(victima: JugadorPartido, infractor: JugadorPartido): void {
    infractor.estado = 'caido';
    infractor.temporizador = 1.4;
    victima.estado = 'caido';
    victima.temporizador = 0.7;

    const x = limitar(victima.x, -LARGO / 2 + 3, LARGO / 2 - 3);
    const z = limitar(victima.z, -ANCHO / 2 + 2, ANCHO / 2 - 2);
    this.eventos.push({ tipo: 'silbato' });
    const tarjeta = this.decidirTarjeta(victima, infractor);

    // Falta dentro del area propia del infractor: penal.
    const arcoDelInfractor = this.arcoPropioDe(infractor.bando);
    const enSuArea = Math.abs(x - arcoDelInfractor) < AREA_LARGO && Math.abs(z) < AREA_ANCHO / 2;

    if (enSuArea) {
      this.prepararPenal(victima.bando);
      this.anunciar('PENAL', `${this.equipoDe(victima.bando).abrev}${tarjeta}`, 1.6);
      return;
    }

    this.fase = 'libre';
    this.darLaPelotaA(victima.bando, x, z, null);
    this.armarBarrera(infractor.bando, x, z);
    this.anunciar('FALTA', `Tiro libre para ${this.equipoDe(victima.bando).abrev}${tarjeta}`, 1.1);
  }

  /**
   * El arbitro mira la velocidad de la barrida y si la jugada era clara.
   * Devuelve el texto que acompana al cartel, vacio si no hubo tarjeta.
   */
  private decidirTarjeta(victima: JugadorPartido, infractor: JugadorPartido): string {
    const violencia = Math.hypot(infractor.vx, infractor.vz) / 12;
    const arcoRival = this.arcoRivalDe(victima.bando);
    const jugadaClara = Math.abs(victima.x - arcoRival) < 35 && this.pelota.duenoId === victima.id;

    const roja = violencia > 0.92 || (jugadaClara && violencia > 0.75);
    const amarilla = !roja && (violencia > 0.45 || jugadaClara);

    if (roja) return ` · roja a ${this.expulsar(infractor)}`;
    if (amarilla) return ` · amarilla a ${this.amonestar(infractor)}`;
    return '';
  }

  private amonestar(j: JugadorPartido): string {
    j.amarillas += 1;
    this.amonestados.push(j.id);
    if (j.bando === 'usuario') this.amarillas.usuario += 1;
    else this.amarillas.rival += 1;
    if (j.amarillas >= 2) return `${j.nombre} (doble amarilla)${this.expulsar(j) ? '' : ''}`;
    return j.nombre;
  }

  private expulsar(j: JugadorPartido): string {
    if (j.expulsado) return j.nombre;
    j.expulsado = true;
    this.expulsados.push(j.id);
    if (j.bando === 'usuario') this.rojas.usuario += 1;
    else this.rojas.rival += 1;

    // Lo saco de la cancha para que no moleste ni intercepte.
    j.x = 0;
    j.z = (ANCHO / 2 + 8) * (j.bando === 'usuario' ? -1 : 1);
    j.vx = 0;
    j.vz = 0;
    if (this.controladoId === j.id) this.controladoId = null;
    return j.nombre;
  }

  /** Tres jugadores a nueve metros de la pelota, tapando el camino al arco. */
  private armarBarrera(bando: Bando, x: number, z: number): void {
    const arco = this.arcoPropioDe(bando);
    if (Math.abs(x - arco) > 32) return;

    const angulo = Math.atan2(0 - z, arco - x);
    const candidatos = this.activos(bando)
      .filter((j) => !j.esArquero)
      .sort((a, b) => distancia2(a.x, a.z, x, z) - distancia2(b.x, b.z, x, z))
      .slice(0, 3);

    candidatos.forEach((j, i) => {
      const lateral = (i - 1) * 0.8;
      j.x = x + Math.cos(angulo) * 9.15 - Math.sin(angulo) * lateral;
      j.z = z + Math.sin(angulo) * 9.15 + Math.cos(angulo) * lateral;
      j.vx = 0;
      j.vz = 0;
      j.rumbo = angulo + Math.PI;
      j.estado = 'normal';
    });
  }

  // ------------------------------------------------------------------ penales

  private prepararPenal(bando: Bando): void {
    const arco = this.arcoRivalDe(bando);
    const lado = Math.sign(arco);
    const puntoX = arco - PENAL_DISTANCIA * lado;

    this.fase = 'penal';
    this.pelota.x = puntoX;
    this.pelota.z = 0;
    this.pelota.y = RADIO_PELOTA;
    this.detenerPelota();
    this.pelota.duenoId = null;
    this.pelota.bloqueoPosesion = 99;

    const propios = this.activos(bando).filter((j) => !j.esArquero);
    const ejecutor = propios.sort((a, b) => b.attrs.tiro - a.attrs.tiro)[0];
    this.ejecutorPenal = ejecutor?.id ?? null;
    this.temporizadorPenal = 5;
    this.punteriaPenal = 0;
    if (bando === 'usuario' && ejecutor) this.controladoId = ejecutor.id;

    for (const j of this.activos()) {
      j.vx = 0;
      j.vz = 0;
      j.estado = 'normal';
      j.temporizador = 0;

      if (j.id === this.ejecutorPenal) {
        j.x = puntoX - 2.2 * lado;
        j.z = 0;
        j.rumbo = lado > 0 ? 0 : Math.PI;
        continue;
      }
      if (j.esArquero && Math.sign(this.arcoPropioDe(j.bando)) === lado) {
        j.x = arco - 0.4 * lado;
        j.z = 0;
        j.rumbo = lado > 0 ? Math.PI : 0;
        continue;
      }
      // El resto, fuera del area y detras de la pelota.
      const fila = this.activos().indexOf(j);
      j.x = puntoX - (6 + (fila % 5) * 2.2) * lado;
      j.z = ((fila % 9) - 4) * 3.4;
    }
  }

  /** Mientras dura el penal solo se puede apuntar y patear. */
  private resolverPenal(dt: number, entrada: EntradaPartido): void {
    const ejecutor = this.porId(this.ejecutorPenal);
    if (!ejecutor) {
      this.fase = 'jugando';
      return;
    }

    const esDelUsuario = ejecutor.bando === 'usuario' && !this.iaTotal;
    this.temporizadorPenal -= dt;

    if (esDelUsuario) {
      this.punteriaPenal = limitar(this.punteriaPenal + entrada.moverZ * dt * 2.5, -1, 1);
      if (!entrada.b && this.temporizadorPenal > 0) return;
    } else if (this.temporizadorPenal > 1.5) {
      return;
    } else {
      this.punteriaPenal = (Math.random() - 0.5) * 1.6;
    }

    this.patearPenal(ejecutor, esDelUsuario ? entrada.potencia : 0.75);
  }

  private patearPenal(ejecutor: JugadorPartido, potencia: number): void {
    const arco = this.arcoRivalDe(ejecutor.bando);
    const arquero = this.activos()
      .filter((j) => j.esArquero && j.bando !== ejecutor.bando)
      .at(0);

    const dispersion = ((100 - ejecutor.attrs.tiro) / 100) * 0.6;
    const objetivoZ = limitar(this.punteriaPenal * 3 + (Math.random() - 0.5) * dispersion * 2, -3.2, 3.2);

    if (arquero) {
      // El arquero elige un palo: le acierta mas seguido si es bueno.
      const leyo = Math.random() < 0.2 + arquero.attrs.arquero / 320;
      const salto = leyo ? Math.sign(objetivoZ) || 1 : -(Math.sign(objetivoZ) || 1);
      arquero.z = salto * 2.4;
      arquero.bloqueo = leyo ? 0 : 0.6;
    }

    this.pelota.bloqueoPosesion = 0.25;
    this.pelota.duenoId = null;
    this.pelota.ultimoToqueId = ejecutor.id;
    ejecutor.estado = 'pateando';
    ejecutor.patada = 0.3;

    const dx = arco - this.pelota.x;
    const dz = objetivoZ - this.pelota.z;
    const d = Math.hypot(dx, dz) || 1;
    const fuerza = 20 + potencia * 10;
    const vuelo = d / fuerza;
    const alturaObjetivo = limitar(0.3 + Math.random() * 1.6, 0.25, ARCO_ALTO - 0.2);

    this.pelota.vx = (dx / d) * fuerza;
    this.pelota.vz = (dz / d) * fuerza;
    this.pelota.vy = (alturaObjetivo - RADIO_PELOTA + 0.5 * GRAVEDAD * vuelo * vuelo) / vuelo;

    if (ejecutor.bando === 'usuario') this.remates.usuario += 1;
    else this.remates.rival += 1;

    this.ejecutorPenal = null;
    this.fase = 'jugando';
  }

  private pasar(j: JugadorPartido, intencionX: number, intencionZ: number, bombeado: boolean): void {
    const companeros = this.jugadores.filter(
      (o) => o.bando === j.bando && o.id !== j.id && !o.esArquero && o.estado !== 'caido' && !o.expulsado,
    );
    if (companeros.length === 0) return;

    const largo = Math.hypot(intencionX, intencionZ) || 1;
    const dirX = intencionX / largo;
    const dirZ = intencionZ / largo;
    const direccionAtaque = j.bando === 'usuario' ? 1 : -1;

    const mejor = this.elegirDestino(j, dirX, dirZ, bombeado, companeros, direccionAtaque);
    if (!mejor) return;

    // Le adelanto el pase a donde va a estar.
    const anticipo = bombeado ? 0.6 : 0.3;
    const destinoX = mejor.x + mejor.vx * anticipo;
    const destinoZ = mejor.z + mejor.vz * anticipo;
    const error = ((100 - j.attrs.pase) / 100) * (bombeado ? 3.2 : 2) * (Math.random() - 0.5) * 2;

    this.soltarPelota(j);
    j.estado = 'pateando';
    j.patada = 0.25;

    const dx = destinoX - j.x + error;
    const dz = destinoZ - j.z + error * 0.5;
    const d = Math.hypot(dx, dz) || 1;

    if (bombeado) {
      // Pase con altura: resuelvo la parabola para que caiga en el destino.
      const vuelo = limitar(d / 14 + 0.45, 0.6, 1.9);
      this.pelota.vx = dx / vuelo;
      this.pelota.vz = dz / vuelo;
      this.pelota.vy = (GRAVEDAD * vuelo) / 2;
    } else {
      const fuerza = limitar(d * 1.5, 9, 26);
      this.pelota.vx = (dx / d) * fuerza;
      this.pelota.vz = (dz / d) * fuerza;
      this.pelota.vy = 0;
    }
    this.eventos.push({ tipo: 'pase' });
  }

  /** El companero mejor ubicado para recibir, segun hacia donde apuntas. */
  private elegirDestino(
    j: JugadorPartido,
    dirX: number,
    dirZ: number,
    bombeado: boolean,
    companeros = this.jugadores.filter(
      (o) => o.bando === j.bando && o.id !== j.id && !o.esArquero && o.estado !== 'caido' && !o.expulsado,
    ),
    direccionAtaque = j.bando === 'usuario' ? 1 : -1,
  ): JugadorPartido | null {
    const largo = Math.hypot(dirX, dirZ) || 1;
    const nx = dirX / largo;
    const nz = dirZ / largo;

    let mejor: JugadorPartido | null = null;
    let mejorPuntaje = -Infinity;

    for (const c of companeros) {
      const dx = c.x - j.x;
      const dz = c.z - j.z;
      const d = Math.hypot(dx, dz);
      if (d < 3 || d > (bombeado ? 55 : 38)) continue;

      const alineacion = (dx / d) * nx + (dz / d) * nz;
      if (alineacion < -0.2) continue;

      const marca = this.rivalMasCercano(c);
      const libre = marca ? Math.min(1, distancia2(c.x, c.z, marca.x, marca.z) / 7) : 1;
      const avance = ((c.x - j.x) * direccionAtaque) / 30;

      // El que pasa mal tambien elige peor: ese ruido separa a un buen mediocampista.
      const ruido = (Math.random() - 0.5) * ((100 - j.attrs.pase) / 45);
      const puntaje = alineacion * 2.4 + libre * 1.2 + avance - d / 70 + ruido;
      if (puntaje > mejorPuntaje) {
        mejorPuntaje = puntaje;
        mejor = c;
      }
    }
    return mejor;
  }

  private patear(j: JugadorPartido, potencia: number): void {
    const arco = this.arcoRivalDe(j.bando);
    const dx = arco - j.x;
    const objetivoZ = limitar((Math.random() - 0.5) * ARCO_ANCHO * 0.85, -3.3, 3.3);
    const dz = objetivoZ - j.z;
    const d = Math.hypot(dx, dz) || 1;

    // La punteria empeora con la distancia y mejora con el atributo de tiro.
    const dispersion = ((100 - j.attrs.tiro) / 100) * 0.085 + (d / LARGO) * 0.12;
    const desvio = (Math.random() - 0.5) * 2 * dispersion;
    const angulo = Math.atan2(dz, dx) + desvio;

    const fuerza = limitar(19 + potencia * 12 + j.attrs.tiro * 0.06, 16, 34);
    const vuelo = d / fuerza;
    const alturaObjetivo = limitar(0.4 + Math.random() * (ARCO_ALTO - 0.6), 0.3, ARCO_ALTO - 0.15);

    this.soltarPelota(j);
    j.estado = 'pateando';
    j.patada = 0.3;

    this.pelota.vx = Math.cos(angulo) * fuerza;
    this.pelota.vz = Math.sin(angulo) * fuerza;
    this.pelota.vy = (alturaObjetivo - RADIO_PELOTA + 0.5 * GRAVEDAD * vuelo * vuelo) / vuelo;

    if (j.bando === 'usuario') this.remates.usuario += 1;
    else this.remates.rival += 1;
    this.eventos.push({ tipo: 'patada', fuerza: potencia });
  }

  private soltarPelota(j: JugadorPartido): void {
    this.pelota.duenoId = null;
    this.pelota.ultimoToqueId = j.id;
    this.pelota.bloqueoPosesion = 0.12;
    j.bloqueo = 0.15;
  }

  private detenerPelota(): void {
    this.pelota.vx = 0;
    this.pelota.vy = 0;
    this.pelota.vz = 0;
  }

  /**
   * Disputa cuerpo a cuerpo. Es lenta a proposito: sacarla es sobre todo cosa
   * de la barrida y de la presion, no de una moneda que se tira cada cuadro.
   */
  private resolverDisputa(dt: number): void {
    const dueno = this.porId(this.pelota.duenoId);
    // Al arquero con la pelota en la mano no se le entra: seria falta.
    if (!dueno || dueno.esArquero) return;

    for (const rival of this.jugadores) {
      if (rival.bando === dueno.bando || rival.bloqueo > 0 || rival.estado !== 'normal' || rival.expulsado) continue;
      if (distancia2(rival.x, rival.z, dueno.x, dueno.z) > RADIO_JUGADOR * 2 + 0.5) continue;

      const probabilidad = dt * 0.85 * (0.35 + rival.attrs.quite / 110) * (1 - dueno.attrs.regate / 160);
      if (Math.random() > probabilidad) continue;

      this.pelota.duenoId = null;
      this.pelota.ultimoToqueId = rival.id;
      const angulo = Math.atan2(this.pelota.z - dueno.z, this.pelota.x - dueno.x) + (Math.random() - 0.5);
      this.pelota.vx = Math.cos(angulo) * 5;
      this.pelota.vz = Math.sin(angulo) * 5;
      this.pelota.bloqueoPosesion = 0.2;
      dueno.bloqueo = 0.7;
      return;
    }
  }

  // ----------------------------------------------------------------- pelota

  private pegarPelotaAlDueno(): void {
    const dueno = this.porId(this.pelota.duenoId);
    if (!dueno) return;
    const separacion = RADIO_JUGADOR + RADIO_PELOTA + 0.25;
    this.pelota.x = limitar(dueno.x + Math.cos(dueno.rumbo) * separacion, -LARGO / 2, LARGO / 2);
    this.pelota.z = limitar(dueno.z + Math.sin(dueno.rumbo) * separacion, -ANCHO / 2, ANCHO / 2);
    this.pelota.y = RADIO_PELOTA;
    this.detenerPelota();
  }

  private moverPelota(dt: number): void {
    this.pelota.bloqueoPosesion = Math.max(0, this.pelota.bloqueoPosesion - dt);

    if (this.pelota.duenoId) {
      this.vueloDeLaPelota = 0;
      this.pegarPelotaAlDueno();
      this.pelota.giro += Math.hypot(this.porId(this.pelota.duenoId)!.vx, this.porId(this.pelota.duenoId)!.vz) * dt;
      return;
    }

    const velocidad = Math.hypot(this.pelota.vx, this.pelota.vz);
    this.vueloDeLaPelota = velocidad > 8 ? this.vueloDeLaPelota + dt : 0;
    const destinoX = this.pelota.x + this.pelota.vx * dt;
    const destinoZ = this.pelota.z + this.pelota.vz * dt;
    const destinoY = this.pelota.y + this.pelota.vy * dt;

    if (velocidad > 4) {
      const choque = this.buscarInterceptor(destinoX, destinoZ, Math.min(this.pelota.y, destinoY));
      if (choque) {
        this.resolverInterceptacion(choque.jugador, choque.x, choque.z, velocidad);
        return;
      }
    }

    this.pelota.x = destinoX;
    this.pelota.z = destinoZ;
    this.pelota.y = destinoY;
    this.pelota.vy -= GRAVEDAD * dt;

    if (this.pelota.y <= RADIO_PELOTA) {
      this.pelota.y = RADIO_PELOTA;
      if (this.pelota.vy < -0.5) {
        this.pelota.vy = -this.pelota.vy * REBOTE;
        this.pelota.vx *= 0.82;
        this.pelota.vz *= 0.82;
      } else {
        this.pelota.vy = 0;
      }
      const roce = Math.pow(1 - ROCE_PISO, dt);
      this.pelota.vx *= roce;
      this.pelota.vz *= roce;
    } else {
      const roce = Math.pow(1 - ROCE_AIRE, dt);
      this.pelota.vx *= roce;
      this.pelota.vz *= roce;
    }

    this.pelota.giro += velocidad * dt;
    if (Math.hypot(this.pelota.vx, this.pelota.vz) < 0.3 && this.pelota.y <= RADIO_PELOTA) {
      this.pelota.vx = 0;
      this.pelota.vz = 0;
    }

    this.intentarTomarPelota();
  }

  /** Primer jugador cuyo cuerpo cruza el tramo que recorrio la pelota. */
  private buscarInterceptor(
    destinoX: number,
    destinoZ: number,
    alturaMinima: number,
  ): { jugador: JugadorPartido; x: number; z: number } | null {
    const x0 = this.pelota.x;
    const z0 = this.pelota.z;
    const dx = destinoX - x0;
    const dz = destinoZ - z0;
    const largo2 = dx * dx + dz * dz;
    if (largo2 === 0) return null;

    let mejor: { jugador: JugadorPartido; x: number; z: number; t: number } | null = null;

    for (const j of this.jugadores) {
      if (j.bloqueo > 0 || j.estado === 'caido' || j.expulsado) continue;
      const alcance = j.esArquero ? ALCANCE_ALTO_ARQUERO : ALCANCE_ALTO;
      if (alturaMinima > alcance) continue;

      const radio = RADIO_JUGADOR + RADIO_PELOTA + (j.esArquero ? 0.45 : j.estado === 'barrida' ? 0.5 : 0.1);
      const t = limitar(((j.x - x0) * dx + (j.z - z0) * dz) / largo2, 0, 1);
      const px = x0 + dx * t;
      const pz = z0 + dz * t;
      if (distancia2(px, pz, j.x, j.z) > radio) continue;
      if (!mejor || t < mejor.t) mejor = { jugador: j, x: px, z: pz, t };
    }

    return mejor ? { jugador: mejor.jugador, x: mejor.x, z: mejor.z } : null;
  }

  private resolverInterceptacion(j: JugadorPartido, x: number, z: number, velocidad: number): void {
    this.pelota.x = x;
    this.pelota.z = z;

    if (j.esArquero) {
      const atajada = limitar(0.46 + j.attrs.arquero / 140 - velocidad / 62, 0.2, 0.92);
      if (Math.random() < atajada) {
        this.pelota.y = RADIO_PELOTA;
        this.detenerPelota();
        this.pelota.duenoId = j.id;
        this.pelota.ultimoToqueId = j.id;
        this.tiempoArqueroConPelota = 0;
        this.eventos.push({ tipo: 'atajada' });
        return;
      }
      // Manotazo: la saca del camino del arco.
      const angulo = Math.atan2(z, x - this.arcoPropioDe(j.bando)) + (Math.random() - 0.5) * 0.9;
      this.pelota.vx = Math.cos(angulo) * velocidad * 0.45;
      this.pelota.vz = Math.sin(angulo) * velocidad * 0.45;
      this.pelota.vy = 2;
      this.pelota.ultimoToqueId = j.id;
      this.pelota.bloqueoPosesion = 0.25;
      j.bloqueo = 0.2;
      return;
    }

    const control = limitar(0.25 + j.attrs.regate / 130 - velocidad / 45, 0.06, 0.88);
    if (Math.random() < control && this.pelota.y < 1.4) {
      this.pelota.y = RADIO_PELOTA;
      this.detenerPelota();
      this.pelota.duenoId = j.id;
      this.pelota.ultimoToqueId = j.id;
      return;
    }

    const angulo = Math.atan2(this.pelota.vz, this.pelota.vx) + (Math.random() - 0.5) * 1.3;
    this.pelota.vx = Math.cos(angulo) * velocidad * 0.35;
    this.pelota.vz = Math.sin(angulo) * velocidad * 0.35;
    this.pelota.ultimoToqueId = j.id;
    this.pelota.bloqueoPosesion = 0.2;
    j.bloqueo = 0.18;
  }

  private intentarTomarPelota(): void {
    if (this.pelota.duenoId || this.pelota.bloqueoPosesion > 0) return;
    if (this.pelota.y > ALCANCE_ALTO) return;

    let mejor: JugadorPartido | null = null;
    let mejorDistancia = Infinity;
    for (const j of this.jugadores) {
      if (j.bloqueo > 0 || j.estado === 'caido' || j.expulsado) continue;
      const d = distancia2(j.x, j.z, this.pelota.x, this.pelota.z);
      if (d < RADIO_JUGADOR + RADIO_PELOTA + 0.35 && d < mejorDistancia) {
        mejorDistancia = d;
        mejor = j;
      }
    }
    if (!mejor) return;

    const velocidad = Math.hypot(this.pelota.vx, this.pelota.vz);
    const control = mejor.esArquero ? mejor.attrs.arquero : mejor.attrs.regate;
    if (Math.random() > 0.45 + control / 150 - velocidad / 55) {
      this.pelota.vx *= 0.4;
      this.pelota.vz *= 0.4;
      this.pelota.bloqueoPosesion = 0.16;
      mejor.bloqueo = 0.18;
      return;
    }

    this.pelota.y = RADIO_PELOTA;
    this.detenerPelota();
    this.pelota.duenoId = mejor.id;
    this.pelota.ultimoToqueId = mejor.id;
    if (mejor.esArquero) this.tiempoArqueroConPelota = 0;
  }

  private revisarArqueroConPelota(dt: number): void {
    const dueno = this.porId(this.pelota.duenoId);
    if (!dueno || !dueno.esArquero) {
      this.tiempoArqueroConPelota = 0;
      return;
    }
    this.tiempoArqueroConPelota += dt;

    // Si el arquero lo maneja el usuario le doy tiempo para que la juegue el,
    // pero igual la saca sola: si no, el partido se queda congelado.
    const loJuegaElUsuario = !this.iaTotal && dueno.bando === 'usuario' && this.controladoId === dueno.id;
    const espera = loJuegaElUsuario ? 6 : 1.7;

    // Antes de la espera completa ya puede sacar, si llego al borde del area.
    const linea = this.arcoPropioDe(dueno.bando);
    const salio = Math.abs(dueno.x - linea) > AREA_LARGO - 4;
    if (this.tiempoArqueroConPelota < espera && !(salio && this.tiempoArqueroConPelota > 1.1)) return;

    this.tiempoArqueroConPelota = 0;
    this.pasar(dueno, dueno.bando === 'usuario' ? 1 : -1, 0, true);
  }

  // ------------------------------------------------------- limites y reinicios

  private revisarLimites(): void {
    const { x, z, y } = this.pelota;

    if (Math.abs(x) >= LARGO / 2 && dentroDelArco(z) && y < ARCO_ALTO && this.pelota.duenoId === null) {
      this.anotar(x > 0 ? 'usuario' : 'rival');
      return;
    }

    if (Math.abs(z) > ANCHO / 2) {
      const ultimo = this.porId(this.pelota.ultimoToqueId);
      const saca: Bando = ultimo?.bando === 'usuario' ? 'rival' : 'usuario';
      const zLinea = Math.sign(z) * (ANCHO / 2 - 0.3);
      this.pelota.x = limitar(x, -LARGO / 2 + 2, LARGO / 2 - 2);
      this.pelota.z = zLinea;
      this.darLaPelotaA(saca, this.pelota.x, zLinea, null);
      this.anunciar('LATERAL', `Saca ${this.equipoDe(saca).abrev}`, 1.1, false);
      return;
    }

    if (Math.abs(x) > LARGO / 2) {
      const defiende: Bando = x > 0 ? 'rival' : 'usuario';
      const ultimo = this.porId(this.pelota.ultimoToqueId);
      const fueCorner = ultimo !== null && ultimo.bando !== defiende;

      if (fueCorner) {
        const esquinaX = Math.sign(x) * (LARGO / 2 - 0.6);
        const esquinaZ = Math.sign(z || 1) * (ANCHO / 2 - 0.6);
        const ataca: Bando = defiende === 'usuario' ? 'rival' : 'usuario';
        this.darLaPelotaA(ataca, esquinaX, esquinaZ, null);
        this.anunciar('CORNER', `Para ${this.equipoDe(ataca).abrev}`, 1.2, false);
      } else {
        const arquero = this.jugadores.find((j) => j.bando === defiende && j.esArquero);
        const x6 = Math.sign(x) * (LARGO / 2 - 5.5);
        this.darLaPelotaA(defiende, x6, limitar(z, -8, 8), arquero?.id ?? null);
        this.anunciar('SAQUE DE ARCO', `Para ${this.equipoDe(defiende).abrev}`, 1.2, false);
      }
    }
  }

  /**
   * Deja la pelota quieta en un punto y se la da a alguien del bando que saca.
   * Nadie se teletransporta al medio del juego: el que saca camina hasta ahi
   * durante la pausa y recien despues arranca la jugada.
   */
  private darLaPelotaA(bando: Bando, x: number, z: number, jugadorId: string | null): void {
    this.pelota.x = x;
    this.pelota.z = z;
    this.pelota.y = RADIO_PELOTA;
    this.detenerPelota();
    this.pelota.bloqueoPosesion = 0;

    let ejecutor = jugadorId ? this.porId(jugadorId) : null;
    if (!ejecutor) {
      ejecutor =
        this.jugadores
          .filter((j) => j.bando === bando && !j.esArquero && j.estado === 'normal' && !j.expulsado)
          .sort((a, b) => distancia2(a.x, a.z, x, z) - distancia2(b.x, b.z, x, z))[0] ?? null;
    }
    if (!ejecutor) return;

    ejecutor.x = x - Math.sign(x || 1) * 0.6;
    ejecutor.z = z;
    ejecutor.vx = 0;
    ejecutor.vz = 0;
    ejecutor.estado = 'normal';
    ejecutor.bloqueo = 0;
    ejecutor.rumbo = bando === 'usuario' ? 0 : Math.PI;

    this.pelota.duenoId = ejecutor.id;
    this.pelota.ultimoToqueId = ejecutor.id;
    if (bando === 'usuario') this.controladoId = ejecutor.id;
  }

  private anotar(bando: Bando): void {
    const autor = this.porId(this.pelota.ultimoToqueId);
    const suyo = autor && autor.bando === bando;

    if (bando === 'usuario') {
      this.golesUsuario += 1;
      if (suyo && autor) this.goleadoresUsuario.push(autor.id);
    } else {
      this.golesRival += 1;
      if (suyo && autor) this.goleadoresRival.push(autor.id);
    }

    this.fase = 'gol';
    this.eventos.push({ tipo: 'gol' });
    this.prepararSaqueInicial(bando === 'usuario' ? 'rival' : 'usuario');
    this.anunciar('¡GOL!', suyo && autor ? autor.nombre : 'En contra', 1.3);
  }

  private prepararSaqueInicial(bando: Bando): void {
    this.saqueDe = bando;
    for (const j of this.jugadores) {
      if (j.expulsado) continue;
      const punto = this.aMundo(j.bando, j.baseAncho, j.baseLargo);
      j.x = punto.x;
      j.z = punto.z;
      j.vx = 0;
      j.vz = 0;
      j.estado = 'normal';
      j.temporizador = 0;
      j.bloqueo = 0;
      j.rumbo = j.bando === 'usuario' ? 0 : Math.PI;
    }

    this.pelota.x = 0;
    this.pelota.z = 0;
    this.pelota.y = RADIO_PELOTA;
    this.detenerPelota();
    this.pelota.bloqueoPosesion = 0;

    const sacador = this.jugadores
      .filter((j) => j.bando === bando && !j.esArquero && !j.expulsado)
      .sort((a, b) => distancia2(a.x, a.z, 0, 0) - distancia2(b.x, b.z, 0, 0))[0];

    if (sacador) {
      sacador.x = bando === 'usuario' ? -1.2 : 1.2;
      sacador.z = 0;
      this.pelota.duenoId = sacador.id;
      this.pelota.ultimoToqueId = sacador.id;
      if (bando === 'usuario') this.controladoId = sacador.id;
    }
  }

  // ---------------------------------------------------------------- salida

  resultado(): ResultadoPartido {
    const total = Math.max(0.001, this.posesion.usuario + this.posesion.rival);
    return {
      golesUsuario: this.golesUsuario,
      golesRival: this.golesRival,
      goleadoresUsuario: [...this.goleadoresUsuario],
      goleadoresRival: [...this.goleadoresRival],
      remates: { ...this.remates },
      posesion: {
        usuario: Math.round((this.posesion.usuario / total) * 100),
        rival: Math.round((this.posesion.rival / total) * 100),
      },
      amarillas: { ...this.amarillas },
      rojas: { ...this.rojas },
      amonestados: [...this.amonestados],
      expulsados: [...this.expulsados],
    };
  }

  // ---------------------------------------------------------------- cambios

  /** Mete a un suplente por uno que esta en cancha, conservando el puesto. */
  sustituir(idSale: string, idEntra: string): string | null {
    const sale = this.porId(idSale);
    if (!sale || sale.expulsado) return 'Ese jugador no esta en cancha.';

    const bando = sale.bando;
    if (this.cambiosUsados[bando] >= this.cambiosMaximos) return 'Ya usaste los cinco cambios.';

    const equipo = this.equipoDe(bando);
    const entra = equipo.suplentes.find((j) => j.id === idEntra);
    if (!entra) return 'Ese jugador no esta en el banco.';
    if (this.porId(idEntra)) return 'Ese jugador ya entro.';

    sale.id = entra.id;
    sale.nombre = entra.nombre;
    sale.attrs = entra.attrs;
    sale.pos = entra.pos;
    sale.energia = 0.7 + (entra.forma / 100) * 0.3;
    sale.estado = 'normal';
    sale.temporizador = 0;
    sale.bloqueo = 0;
    sale.amarillas = 0;
    sale.patada = 0;

    // El que sale se va al banco y queda disponible el que entro.
    equipo.suplentes = equipo.suplentes.filter((j) => j.id !== idEntra);
    equipo.suplentes.push({
      id: idSale,
      nombre: this.nombreOriginal(idSale, equipo),
      attrs: sale.attrs,
      pos: sale.pos,
      media: 0,
      forma: 0,
    });

    if (this.controladoId === idSale) this.controladoId = entra.id;
    if (this.pelota.duenoId === idSale) this.pelota.duenoId = entra.id;

    this.cambiosUsados[bando] += 1;
    return null;
  }

  private nombreOriginal(id: string, equipo: ConfiguracionEquipo): string {
    return equipo.jugadores.find((j) => j.id === id)?.nombre ?? 'Jugador';
  }

  /** Cambia el dibujo sin frenar el partido: reparte las ranuras nuevas. */
  cambiarFormacion(bando: Bando, formacion: Formacion): void {
    const equipo = this.equipoDe(bando);
    equipo.tacticas.formacion = formacion;
    const ranuras = FORMACIONES[formacion];

    const enCancha = this.jugadores.filter((j) => j.bando === bando && !j.expulsado);
    const arquero = enCancha.find((j) => j.esArquero);
    const resto = enCancha.filter((j) => !j.esArquero);

    if (arquero) {
      arquero.ranura = 0;
      arquero.baseAncho = ranuras[0].x;
      arquero.baseLargo = ranuras[0].y;
    }
    resto.forEach((j, i) => {
      const ranura = ranuras[i + 1] ?? ranuras[ranuras.length - 1];
      j.ranura = i + 1;
      j.baseAncho = ranura.x;
      j.baseLargo = ranura.y;
      j.esArquero = ranura.pos === 'ARQ';
    });
  }

  /** A quien le llegaria el pase si apretaras ahora, para marcarlo en pantalla. */
  destinoDePase(bombeado: boolean, dirX: number, dirZ: number): JugadorPartido | null {
    const j = this.porId(this.controladoId);
    if (!j || this.pelota.duenoId !== j.id) return null;
    const direccion = j.bando === 'usuario' ? 1 : -1;
    const largo = Math.hypot(dirX, dirZ);
    return this.elegirDestino(j, largo > 0.2 ? dirX : direccion, largo > 0.2 ? dirZ : 0, bombeado);
  }

  /** Foto del estado, para grabar la jugada del gol. */
  instantanea(): Instantanea {
    return {
      jugadores: this.jugadores.map((j) => ({
        id: j.id,
        x: j.x,
        z: j.z,
        vx: j.vx,
        vz: j.vz,
        rumbo: j.rumbo,
        paso: j.paso,
        estado: j.estado,
        patada: j.patada,
      })),
      pelota: { x: this.pelota.x, y: this.pelota.y, z: this.pelota.z },
    };
  }

  /** Posesion acumulada en segundos, para el menu de pausa. */
  posesionDe(bando: Bando): number {
    return this.posesion[bando];
  }

  rematesDe(bando: Bando): number {
    return this.remates[bando];
  }

  /** 0-1: que tan caliente esta la jugada, para el volumen de la hinchada. */
  get emocion(): number {
    const cercaDelArco = 1 - Math.min(1, (LARGO / 2 - Math.abs(this.pelota.x)) / 35);
    const velocidad = Math.min(1, Math.hypot(this.pelota.vx, this.pelota.vz) / 22);
    return limitar(cercaDelArco * 0.75 + velocidad * 0.35, 0, 1);
  }

  /** Para el render: si la pelota esta dentro del area, la camara se acerca. */
  get pelotaEnArea(): boolean {
    return Math.abs(this.pelota.x) > LARGO / 2 - AREA_LARGO && Math.abs(this.pelota.z) < AREA_ANCHO / 2;
  }
}

/** Interpola un angulo hacia otro por el camino corto. */
function anguloHacia(actual: number, objetivo: number, cantidad: number): number {
  let diferencia = objetivo - actual;
  while (diferencia > Math.PI) diferencia -= Math.PI * 2;
  while (diferencia < -Math.PI) diferencia += Math.PI * 2;
  return actual + diferencia * Math.min(1, cantidad);
}
