import Phaser from 'phaser';
import { FORMACIONES } from '@/sim/tacticas';
import {
  ALTO_AREA,
  ALTO_CANCHA,
  ANCHO_AREA,
  ANCHO_ARCO,
  ANCHO_CANCHA,
  COLOR_CESPED,
  COLOR_CESPED_CLARO,
  COLOR_LINEA,
  FRICCION_PELOTA,
  MARGEN,
  MINUTOS_POR_TIEMPO,
  PROFUNDIDAD_ARCO,
  RADIO_JUGADOR,
  RADIO_PELOTA,
  SEGUNDOS_POR_TIEMPO,
  VELOCIDAD_BASE,
  VELOCIDAD_MAX_PELOTA,
} from './constantes';
import { Controles, type EntradaJugador } from './controles';
import type {
  Bando,
  ConfiguracionEquipo,
  ConfiguracionPartido,
  JugadorPartido,
  Pelota,
  ResultadoPartido,
} from './entidades';

type FasePartido = 'saque' | 'jugando' | 'gol' | 'entretiempo' | 'final';

export interface DatosEscenaPartido {
  config: ConfiguracionPartido;
  alTerminar: (resultado: ResultadoPartido) => void;
  alSalir: () => void;
}

/**
 * Motor del partido arcade: 11 contra 11, camara que sigue la pelota,
 * control directo del jugador mas cercano y el resto manejado por la IA.
 * Toda la fisica es integracion manual, sin motor de fisica: es poca cosa
 * y asi el partido es determinista y barato en bateria.
 */
export class EscenaPartido extends Phaser.Scene {
  static readonly CLAVE = 'partido';

  private config!: ConfiguracionPartido;
  private alTerminar!: (resultado: ResultadoPartido) => void;
  private alSalir!: () => void;

  private jugadores: JugadorPartido[] = [];
  private pelota: Pelota = { x: 0, y: 0, vx: 0, vy: 0, duenoId: null, ultimoToqueId: null, bloqueoPosesion: 0 };

  private controles!: Controles;
  private capaCancha!: Phaser.GameObjects.Graphics;
  private capaJuego!: Phaser.GameObjects.Graphics;
  private objetivoCamara!: Phaser.GameObjects.Zone;

  private textoMarcador!: Phaser.GameObjects.Text;
  private textoReloj!: Phaser.GameObjects.Text;
  private textoAviso!: Phaser.GameObjects.Text;
  private botonSalir!: Phaser.GameObjects.Text;
  private camaraUi!: Phaser.Cameras.Scene2D.Camera;
  private objetosUi: Phaser.GameObjects.GameObject[] = [];

  private fase: FasePartido = 'saque';
  private tiempoActual = 1;
  private segundosJugados = 0;
  private esperaFase = 0;

  private golesUsuario = 0;
  private golesRival = 0;
  private goleadoresUsuario: string[] = [];
  private goleadoresRival: string[] = [];
  private remates = { usuario: 0, rival: 0 };
  private ticksPosesion = { usuario: 0, rival: 0 };

  private colorUsuario = 0xffffff;
  private colorRival = 0x000000;
  private controladoId: string | null = null;
  private saqueDe: Bando = 'usuario';
  /** Cuanto hace que un arquero tiene la pelota: la reparte solo. */
  private tiempoArqueroConPelota = 0;
  /** Si esta en true, la IA maneja tambien al equipo del usuario. */
  iaTotal = false;

  constructor() {
    super(EscenaPartido.CLAVE);
  }

  init(datos: DatosEscenaPartido): void {
    this.config = datos.config;
    this.alTerminar = datos.alTerminar;
    this.alSalir = datos.alSalir;
  }

  create(): void {
    this.armarEquipos();
    this.resolverColores();

    this.capaCancha = this.add.graphics().setDepth(0);
    this.dibujarCancha();
    this.capaJuego = this.add.graphics().setDepth(10);

    this.objetivoCamara = this.add.zone(ANCHO_CANCHA / 2, ALTO_CANCHA / 2, 1, 1);
    const camara = this.cameras.main;
    camara.setBounds(-MARGEN, -MARGEN, ANCHO_CANCHA + MARGEN * 2, ALTO_CANCHA + MARGEN * 2);
    camara.setZoom(this.zoomDeCamara());
    camara.startFollow(this.objetivoCamara, true, 0.08, 0.08);

    this.crearHud();
    this.controles = new Controles(this);
    this.objetosUi.push(...this.controles.objetos());

    // El HUD y los controles viven en su propia camara: si no, el zoom que
    // sigue a la pelota tambien les cambia el tamano y la posicion.
    this.camaraUi = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.camaraUi.setName('ui');
    this.camaraUi.ignore([this.capaCancha, this.capaJuego, this.objetivoCamara]);
    camara.ignore(this.objetosUi);

    this.prepararSaque('usuario');
    this.avisar('¡ARRANCA!', 1.2);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.alRedimensionar, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.alRedimensionar, this);
      this.controles.destruir();
    });
  }

  private alRedimensionar(): void {
    this.cameras.main.setZoom(this.zoomDeCamara());
    this.camaraUi?.setSize(this.scale.width, this.scale.height);
  }

  /** Zoom pensado para celular: se ve medio ancho de cancha y la camara acompana. */
  private zoomDeCamara(): number {
    return Phaser.Math.Clamp(this.scale.width / 430, 0.7, 1.9);
  }

  // ---------------------------------------------------------------- equipos

  private armarEquipos(): void {
    this.jugadores = [
      ...this.crearOnce(this.config.usuario, 'usuario'),
      ...this.crearOnce(this.config.rival, 'rival'),
    ];
  }

  /**
   * Si las dos camisetas se parecen demasiado no se entiende nada en la cancha,
   * asi que al visitante se le busca un color alternativo.
   */
  private resolverColores(): void {
    const aColor = (hex: string) => Phaser.Display.Color.HexStringToColor(hex);
    const lejos = (a: Phaser.Display.Color, b: Phaser.Display.Color) =>
      Math.hypot(a.red - b.red, a.green - b.green, a.blue - b.blue) >= 120;

    const usuario = aColor(this.config.usuario.colorPrimario);
    const opciones = [
      aColor(this.config.rival.colorPrimario),
      aColor(this.config.rival.colorSecundario),
      aColor('#ffffff'),
      aColor('#111111'),
    ];

    this.colorUsuario = usuario.color;
    this.colorRival = (opciones.find((c) => lejos(usuario, c)) ?? opciones[3]).color;
  }

  private crearOnce(equipo: ConfiguracionEquipo, bando: Bando): JugadorPartido[] {
    const ranuras = FORMACIONES[equipo.tacticas.formacion];
    return ranuras.map((ranura, i) => {
      const fuente = equipo.jugadores[i];
      const { x, y } = this.aMundo(bando, ranura.x, ranura.y);
      return {
        id: fuente.id,
        nombre: fuente.nombre,
        dorsal: i + 1,
        bando,
        pos: ranura.pos,
        attrs: fuente.attrs,
        baseX: ranura.x,
        baseY: ranura.y,
        x,
        y,
        vx: 0,
        vy: 0,
        energia: 0.6 + (fuente.forma / 100) * 0.4,
        esArquero: ranura.pos === 'ARQ',
        bloqueo: 0,
      };
    });
  }

  /**
   * Pasa coordenadas normalizadas de formacion a coordenadas de cancha.
   * El usuario siempre ataca hacia arriba (y = 0), asi que su arco propio
   * esta abajo y el del rival arriba.
   */
  private aMundo(bando: Bando, nx: number, ny: number): { x: number; y: number } {
    if (bando === 'usuario') {
      return { x: ANCHO_CANCHA * nx, y: ALTO_CANCHA * (1 - ny) };
    }
    return { x: ANCHO_CANCHA * (1 - nx), y: ALTO_CANCHA * ny };
  }

  private arcoRivalDe(bando: Bando): number {
    return bando === 'usuario' ? 0 : ALTO_CANCHA;
  }

  private arcoPropioDe(bando: Bando): number {
    return bando === 'usuario' ? ALTO_CANCHA : 0;
  }

  // ------------------------------------------------------------------- hud

  private crearHud(): void {
    const estilo = { fontFamily: 'system-ui, sans-serif', color: '#ffffff' };

    const fondoBarra = this.add
      .rectangle(0, 0, this.scale.width, 64, 0x0b1220, 0.75)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(900);

    this.textoMarcador = this.add
      .text(this.scale.width / 2, 18, '', { ...estilo, fontSize: '20px', fontStyle: 'bold' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(901);

    this.textoReloj = this.add
      .text(this.scale.width / 2, 42, '', { ...estilo, fontSize: '14px', color: '#9fb3c8' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(901);

    this.textoAviso = this.add
      .text(this.scale.width / 2, this.scale.height / 2, '', {
        ...estilo,
        fontSize: '34px',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(950);

    this.botonSalir = this.add
      .text(12, 18, 'Salir', { ...estilo, fontSize: '14px', backgroundColor: '#33415560', padding: { x: 8, y: 4 } })
      .setScrollFactor(0)
      .setDepth(901)
      .setInteractive({ useHandCursor: true });
    this.botonSalir.on('pointerup', () => this.alSalir());

    this.objetosUi.push(fondoBarra, this.textoMarcador, this.textoReloj, this.textoAviso, this.botonSalir);
  }

  private actualizarHud(): void {
    const u = this.config.usuario.abrev;
    const r = this.config.rival.abrev;
    this.textoMarcador.setText(`${u} ${this.golesUsuario} - ${this.golesRival} ${r}`);

    const minuto = Math.min(
      MINUTOS_POR_TIEMPO,
      Math.floor((this.segundosJugados / SEGUNDOS_POR_TIEMPO) * MINUTOS_POR_TIEMPO),
    );
    const total = this.tiempoActual === 1 ? minuto : MINUTOS_POR_TIEMPO + minuto;
    this.textoReloj.setText(`${total}'  ·  ${this.tiempoActual === 1 ? '1er' : '2do'} tiempo`);
  }

  private avisar(texto: string, segundos: number): void {
    this.textoAviso.setText(texto);
    this.esperaFase = segundos;
  }

  // ------------------------------------------------------------------ bucle

  override update(_tiempo: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    const entrada = this.controles.leer();

    if (this.esperaFase > 0) {
      this.esperaFase -= dt;
      if (this.esperaFase <= 0) {
        this.textoAviso.setText('');
        this.resolverFinDeEspera();
      }
      this.dibujar();
      this.actualizarHud();
      return;
    }

    if (this.fase === 'jugando') {
      this.segundosJugados += dt;
      this.registrarPosesion();
      this.elegirControlado();
      this.actualizarJugadores(dt, entrada);
      this.actualizarPelota(dt);
      this.revisarSaqueDeArquero(dt);
      this.revisarLimites();
      this.revisarFinDeTiempo();
    }

    this.objetivoCamara.setPosition(this.pelota.x, this.pelota.y);
    this.dibujar();
    this.actualizarHud();
  }

  private resolverFinDeEspera(): void {
    if (this.fase === 'gol') {
      this.fase = 'jugando';
    } else if (this.fase === 'entretiempo') {
      this.tiempoActual = 2;
      this.segundosJugados = 0;
      this.prepararSaque(this.saqueDe === 'usuario' ? 'rival' : 'usuario');
      this.fase = 'jugando';
    } else if (this.fase === 'final') {
      this.terminar();
    } else if (this.fase === 'saque') {
      this.fase = 'jugando';
    }
  }

  private registrarPosesion(): void {
    const dueno = this.jugadorPorId(this.pelota.duenoId);
    if (!dueno) return;
    if (dueno.bando === 'usuario') this.ticksPosesion.usuario += 1;
    else this.ticksPosesion.rival += 1;
  }

  private revisarFinDeTiempo(): void {
    if (this.segundosJugados < SEGUNDOS_POR_TIEMPO) return;
    if (this.tiempoActual === 1) {
      this.fase = 'entretiempo';
      this.avisar('ENTRETIEMPO', 1.8);
    } else {
      this.fase = 'final';
      this.avisar(`FINAL\n${this.golesUsuario} - ${this.golesRival}`, 2.2);
    }
  }

  // -------------------------------------------------------------- jugadores

  private jugadorPorId(id: string | null): JugadorPartido | null {
    if (!id) return null;
    return this.jugadores.find((j) => j.id === id) ?? null;
  }

  private velocidadDe(j: JugadorPartido): number {
    return VELOCIDAD_BASE * (0.72 + (j.attrs.ritmo / 100) * 0.62) * (0.72 + j.energia * 0.28);
  }

  /** El usuario maneja al que tiene la pelota, o al mas cercano a ella. */
  private elegirControlado(): void {
    const dueno = this.jugadorPorId(this.pelota.duenoId);
    if (dueno && dueno.bando === 'usuario') {
      this.controladoId = dueno.id;
      return;
    }
    if (dueno && dueno.bando === 'rival') {
      this.controladoId = this.masCercanoALaPelota('usuario', false)?.id ?? this.controladoId;
      return;
    }
    this.controladoId = this.masCercanoALaPelota('usuario', false)?.id ?? this.controladoId;
  }

  private masCercanoALaPelota(bando: Bando, incluirArquero: boolean): JugadorPartido | null {
    let mejor: JugadorPartido | null = null;
    let mejorDistancia = Infinity;
    for (const j of this.jugadores) {
      if (j.bando !== bando) continue;
      if (j.esArquero && !incluirArquero) continue;
      const d = Phaser.Math.Distance.Between(j.x, j.y, this.pelota.x, this.pelota.y);
      if (d < mejorDistancia) {
        mejorDistancia = d;
        mejor = j;
      }
    }
    return mejor;
  }

  private actualizarJugadores(dt: number, entrada: EntradaJugador): void {
    const dueno = this.jugadorPorId(this.pelota.duenoId);
    const bandoConPelota: Bando | null = dueno ? dueno.bando : null;

    // Por bando, marco a los dos mas cercanos para que vayan a presionar.
    const perseguidores = new Set<string>();
    for (const bando of ['usuario', 'rival'] as Bando[]) {
      if (bandoConPelota === bando) continue;
      const primero = this.masCercanoALaPelota(bando, false);
      if (primero) perseguidores.add(primero.id);
      const equipo = this.config[bando === 'usuario' ? 'usuario' : 'rival'];
      if (equipo.tacticas.presion > 60) {
        const segundo = this.jugadores
          .filter((j) => j.bando === bando && !j.esArquero && j.id !== primero?.id)
          .sort(
            (a, b) =>
              Phaser.Math.Distance.Between(a.x, a.y, this.pelota.x, this.pelota.y) -
              Phaser.Math.Distance.Between(b.x, b.y, this.pelota.x, this.pelota.y),
          )[0];
        if (segundo) perseguidores.add(segundo.id);
      }
    }

    for (const j of this.jugadores) {
      j.bloqueo = Math.max(0, j.bloqueo - dt);
      j.energia = Math.max(0.45, j.energia - dt * 0.0035 * (1.4 - j.attrs.fisico / 200));

      if (j.esArquero) {
        this.moverArquero(j, dt);
        continue;
      }

      if (this.controladoId === j.id && !this.iaTotal) {
        this.moverControlado(j, dt, entrada);
        continue;
      }

      if (this.pelota.duenoId === j.id) {
        this.moverConPelotaIa(j, dt);
        continue;
      }

      if (perseguidores.has(j.id)) {
        this.moverHacia(j, this.pelota.x, this.pelota.y, dt, 1);
        continue;
      }

      const destino = this.destinoDeFormacion(j, bandoConPelota);
      this.moverHacia(j, destino.x, destino.y, dt, 0.82);
    }

    if (this.controladoId && !this.iaTotal) {
      const controlado = this.jugadorPorId(this.controladoId);
      if (controlado && this.pelota.duenoId === controlado.id) {
        if (entrada.pase) this.pasar(controlado, entrada);
        else if (entrada.tiro) this.patear(controlado, entrada.potenciaTiro);
      }
    }

    this.resolverDisputas(dt);
  }

  /** Posicion de reposo: su puesto, corrido hacia la pelota y segun la tactica. */
  private destinoDeFormacion(j: JugadorPartido, bandoConPelota: Bando | null): { x: number; y: number } {
    const equipo = this.config[j.bando === 'usuario' ? 'usuario' : 'rival'];
    const base = this.aMundo(j.bando, j.baseX, j.baseY);

    const corrimientoX = (this.pelota.x - ANCHO_CANCHA / 2) * 0.32;

    const atacando = bandoConPelota === j.bando;
    const mentalidad = equipo.tacticas.mentalidad / 100;
    const linea = equipo.tacticas.lineaDefensiva / 100;

    const direccion = j.bando === 'usuario' ? -1 : 1;
    const empuje = atacando ? 60 + mentalidad * 150 : -(40 + (1 - linea) * 120);
    const seguirPelota = (this.pelota.y - base.y) * 0.22;

    return {
      x: Phaser.Math.Clamp(base.x + corrimientoX, 20, ANCHO_CANCHA - 20),
      y: Phaser.Math.Clamp(base.y + empuje * direccion + seguirPelota, 30, ALTO_CANCHA - 30),
    };
  }

  private moverHacia(j: JugadorPartido, x: number, y: number, dt: number, factor: number): void {
    const dx = x - j.x;
    const dy = y - j.y;
    const distancia = Math.hypot(dx, dy);
    if (distancia < 4) {
      j.vx *= 0.8;
      j.vy *= 0.8;
    } else {
      const velocidad = this.velocidadDe(j) * factor;
      const objetivoVx = (dx / distancia) * velocidad;
      const objetivoVy = (dy / distancia) * velocidad;
      const suavizado = Math.min(1, dt * 8);
      j.vx += (objetivoVx - j.vx) * suavizado;
      j.vy += (objetivoVy - j.vy) * suavizado;
    }
    this.integrar(j, dt);
  }

  private moverControlado(j: JugadorPartido, dt: number, entrada: EntradaJugador): void {
    const velocidad = this.velocidadDe(j) * (this.pelota.duenoId === j.id ? 0.92 : 1);
    const objetivoVx = entrada.dirX * velocidad;
    const objetivoVy = entrada.dirY * velocidad;
    const suavizado = Math.min(1, dt * 11);
    j.vx += (objetivoVx - j.vx) * suavizado;
    j.vy += (objetivoVy - j.vy) * suavizado;
    if (entrada.dirX === 0 && entrada.dirY === 0) {
      j.vx *= 0.85;
      j.vy *= 0.85;
    }
    this.integrar(j, dt);
  }

  /** IA del que lleva la pelota: encara, la suelta si lo aprietan, define si esta cerca. */
  private moverConPelotaIa(j: JugadorPartido, dt: number): void {
    const arco = this.arcoRivalDe(j.bando);
    const distanciaArco = Math.abs(arco - j.y);
    const rivalCerca = this.rivalMasCercano(j);
    const presionado = rivalCerca ? Phaser.Math.Distance.Between(j.x, j.y, rivalCerca.x, rivalCerca.y) < 48 : false;

    if (distanciaArco < 300 && Math.abs(j.x - ANCHO_CANCHA / 2) < 240) {
      const ganas = 0.5 + j.attrs.tiro / 240 - distanciaArco / 850;
      if (Math.random() < ganas * dt * 1.6) {
        this.patear(j, 0.85);
        return;
      }
    }

    if (presionado && Math.random() < dt * 2.0) {
      this.pasar(j, { dirX: 0, dirY: j.bando === 'usuario' ? -1 : 1, pase: true, tiro: false, potenciaTiro: 0.6 });
      return;
    }

    const objetivoX = ANCHO_CANCHA / 2 + (j.x - ANCHO_CANCHA / 2) * 0.7;
    this.moverHacia(j, objetivoX, arco, dt, 0.95);
  }

  private rivalMasCercano(j: JugadorPartido): JugadorPartido | null {
    let mejor: JugadorPartido | null = null;
    let mejorDistancia = Infinity;
    for (const otro of this.jugadores) {
      if (otro.bando === j.bando) continue;
      const d = Phaser.Math.Distance.Between(j.x, j.y, otro.x, otro.y);
      if (d < mejorDistancia) {
        mejorDistancia = d;
        mejor = otro;
      }
    }
    return mejor;
  }

  private moverArquero(arquero: JugadorPartido, dt: number): void {
    const linea = this.arcoPropioDe(arquero.bando);
    const direccion = arquero.bando === 'usuario' ? -1 : 1;
    const distanciaPelota = Math.abs(this.pelota.y - linea);
    const centro = ANCHO_CANCHA / 2;

    let objetivoX: number;
    let objetivoY: number;
    let velocidad = VELOCIDAD_BASE * (0.6 + (arquero.attrs.arquero / 100) * 0.7);

    const cruce = this.cruceDelRemate(arquero);
    if (cruce !== null) {
      // Se estira hacia donde va a cruzar la pelota. Que llegue o no depende
      // de su velocidad y del error de lectura: ahi pesa el atributo.
      const error = ((100 - arquero.attrs.arquero) / 100) * 46 * (Math.random() - 0.5) * 2;
      objetivoX = Phaser.Math.Clamp(cruce + error, centro - ANCHO_ARCO / 2 - 24, centro + ANCHO_ARCO / 2 + 24);
      objetivoY = linea + 12 * direccion;
      velocidad = VELOCIDAD_BASE * (1.25 + (arquero.attrs.arquero / 100) * 0.9);
    } else {
      // Sale a achicar si la pelota entro al area y no la tiene un companero.
      const dueno = this.jugadorPorId(this.pelota.duenoId);
      const peligro = distanciaPelota < ALTO_AREA && (!dueno || dueno.bando !== arquero.bando);
      const salida = peligro ? Math.min(70, ALTO_AREA - distanciaPelota) : 14;
      objetivoX = Phaser.Math.Clamp(
        centro + (this.pelota.x - centro) * 0.7,
        centro - ANCHO_ARCO / 2,
        centro + ANCHO_ARCO / 2,
      );
      objetivoY = linea + salida * direccion;
    }

    const dx = objetivoX - arquero.x;
    const dy = objetivoY - arquero.y;
    const distancia = Math.hypot(dx, dy) || 1;
    const suavizado = Math.min(1, dt * 12);
    arquero.vx += ((dx / distancia) * velocidad - arquero.vx) * suavizado;
    arquero.vy += ((dy / distancia) * velocidad - arquero.vy) * suavizado;
    this.integrar(arquero, dt);
  }

  /** Donde va a cruzar la linea la pelota, si es que viene un remate al arco. */
  private cruceDelRemate(arquero: JugadorPartido): number | null {
    if (this.pelota.duenoId !== null) return null;
    const linea = this.arcoPropioDe(arquero.bando);
    const hacia = linea === 0 ? this.pelota.vy < -80 : this.pelota.vy > 80;
    if (!hacia) return null;

    const tiempo = (linea - this.pelota.y) / this.pelota.vy;
    if (tiempo <= 0 || tiempo > 2) return null;
    return this.pelota.x + this.pelota.vx * tiempo;
  }

  private integrar(j: JugadorPartido, dt: number): void {
    j.x = Phaser.Math.Clamp(j.x + j.vx * dt, RADIO_JUGADOR, ANCHO_CANCHA - RADIO_JUGADOR);
    j.y = Phaser.Math.Clamp(j.y + j.vy * dt, RADIO_JUGADOR, ALTO_CANCHA - RADIO_JUGADOR);
  }

  // ---------------------------------------------------------------- pelota

  private actualizarPelota(dt: number): void {
    this.pelota.bloqueoPosesion = Math.max(0, this.pelota.bloqueoPosesion - dt);
    const dueno = this.jugadorPorId(this.pelota.duenoId);

    if (dueno) {
      const velocidad = Math.hypot(dueno.vx, dueno.vy) || 1;
      const frenteX = dueno.vx / velocidad;
      const frenteY = dueno.vy / velocidad;
      const separacion = RADIO_JUGADOR + RADIO_PELOTA + 2;
      this.pelota.x = Phaser.Math.Clamp(dueno.x + frenteX * separacion, RADIO_PELOTA, ANCHO_CANCHA - RADIO_PELOTA);
      this.pelota.y = Phaser.Math.Clamp(dueno.y + frenteY * separacion, RADIO_PELOTA, ALTO_CANCHA - RADIO_PELOTA);
      this.pelota.vx = 0;
      this.pelota.vy = 0;
      return;
    }

    const velocidad = Math.hypot(this.pelota.vx, this.pelota.vy);
    const destinoX = this.pelota.x + this.pelota.vx * dt;
    const destinoY = this.pelota.y + this.pelota.vy * dt;

    // Con la pelota rapida hay que barrer el tramo recorrido: si solo miro la
    // posicion final, un tiro fuerte atraviesa al arquero sin tocarlo.
    if (velocidad > 60) {
      const choque = this.buscarInterceptor(this.pelota.x, this.pelota.y, destinoX, destinoY);
      if (choque) {
        this.resolverInterceptacion(choque.jugador, choque.x, choque.y, velocidad);
        return;
      }
    }

    this.pelota.x = destinoX;
    this.pelota.y = destinoY;

    const roce = Math.pow(FRICCION_PELOTA, dt * 60);
    this.pelota.vx *= roce;
    this.pelota.vy *= roce;

    if (Math.hypot(this.pelota.vx, this.pelota.vy) < 12) {
      this.pelota.vx = 0;
      this.pelota.vy = 0;
    }

    this.intentarTomarPelota();
  }

  /** Primer jugador cuyo cuerpo cruza el tramo que recorrio la pelota. */
  private buscarInterceptor(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): { jugador: JugadorPartido; x: number; y: number } | null {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const largo2 = dx * dx + dy * dy;
    if (largo2 === 0) return null;

    let mejor: { jugador: JugadorPartido; x: number; y: number; t: number } | null = null;

    for (const j of this.jugadores) {
      if (j.bloqueo > 0) continue;
      const alcance = RADIO_JUGADOR + RADIO_PELOTA + (j.esArquero ? 10 : 0);
      const t = Phaser.Math.Clamp(((j.x - x0) * dx + (j.y - y0) * dy) / largo2, 0, 1);
      const px = x0 + dx * t;
      const py = y0 + dy * t;
      if (Phaser.Math.Distance.Between(px, py, j.x, j.y) > alcance) continue;
      if (!mejor || t < mejor.t) mejor = { jugador: j, x: px, y: py, t };
    }

    return mejor ? { jugador: mejor.jugador, x: mejor.x, y: mejor.y } : null;
  }

  /** Atajada, corte limpio o rebote, segun quien sea y como venga la pelota. */
  private resolverInterceptacion(j: JugadorPartido, x: number, y: number, velocidad: number): void {
    this.pelota.x = x;
    this.pelota.y = y;

    if (j.esArquero) {
      const atajada = Phaser.Math.Clamp(0.56 + j.attrs.arquero / 120 - velocidad / 2800, 0.3, 0.96);
      if (Math.random() < atajada) {
        this.pelota.vx = 0;
        this.pelota.vy = 0;
        this.pelota.duenoId = j.id;
        this.pelota.ultimoToqueId = j.id;
        this.tiempoArqueroConPelota = 0;
        return;
      }
      // Rechaza hacia afuera del arco.
      const angulo = Math.atan2(y - this.arcoPropioDe(j.bando), x - ANCHO_CANCHA / 2) + (Math.random() - 0.5) * 0.8;
      const fuerza = velocidad * 0.5;
      this.pelota.vx = Math.cos(angulo) * fuerza;
      this.pelota.vy = Math.sin(angulo) * fuerza;
      this.pelota.ultimoToqueId = j.id;
      this.pelota.bloqueoPosesion = 0.12;
      j.bloqueo = 0.1;
      return;
    }

    const control = Phaser.Math.Clamp(0.3 + j.attrs.regate / 190 - velocidad / 1300, 0.05, 0.85);
    if (Math.random() < control) {
      this.pelota.vx = 0;
      this.pelota.vy = 0;
      this.pelota.duenoId = j.id;
      this.pelota.ultimoToqueId = j.id;
      return;
    }

    // Rebote: sigue mas o menos derecho pero pierde casi toda la fuerza.
    const angulo = Math.atan2(this.pelota.vy, this.pelota.vx) + (Math.random() - 0.5) * 1.2;
    this.pelota.vx = Math.cos(angulo) * velocidad * 0.38;
    this.pelota.vy = Math.sin(angulo) * velocidad * 0.38;
    this.pelota.ultimoToqueId = j.id;
    this.pelota.bloqueoPosesion = 0.14;
    j.bloqueo = 0.12;
  }

  private intentarTomarPelota(): void {
    if (this.pelota.duenoId || this.pelota.bloqueoPosesion > 0) return;
    const velocidadPelota = Math.hypot(this.pelota.vx, this.pelota.vy);

    let mejor: JugadorPartido | null = null;
    let mejorDistancia = Infinity;
    for (const j of this.jugadores) {
      if (j.bloqueo > 0) continue;
      const d = Phaser.Math.Distance.Between(j.x, j.y, this.pelota.x, this.pelota.y);
      if (d < RADIO_JUGADOR + RADIO_PELOTA + 8 && d < mejorDistancia) {
        mejorDistancia = d;
        mejor = j;
      }
    }
    if (!mejor) return;

    // Una pelota rapida se puede escapar: ahi pesan el control y el arquero.
    const control = mejor.esArquero ? mejor.attrs.arquero : mejor.attrs.regate;
    const exito = 0.35 + control / 140 - velocidadPelota / 1600;
    if (Math.random() > exito) {
      this.pelota.vx *= 0.45;
      this.pelota.vy *= 0.45;
      this.pelota.bloqueoPosesion = 0.12;
      mejor.bloqueo = 0.15;
      return;
    }

    this.pelota.duenoId = mejor.id;
    this.pelota.ultimoToqueId = mejor.id;
    if (mejor.esArquero) this.tiempoArqueroConPelota = 0;
  }

  /** El arquero no se queda con la pelota: despues de un momento la reparte. */
  private revisarSaqueDeArquero(dt: number): void {
    const dueno = this.jugadorPorId(this.pelota.duenoId);
    if (!dueno || !dueno.esArquero) {
      this.tiempoArqueroConPelota = 0;
      return;
    }
    this.tiempoArqueroConPelota += dt;
    if (this.tiempoArqueroConPelota < 0.7) return;
    this.tiempoArqueroConPelota = 0;
    this.pasar(dueno, {
      dirX: 0,
      dirY: dueno.bando === 'usuario' ? -1 : 1,
      pase: true,
      tiro: false,
      potenciaTiro: 0.7,
    });
  }

  private resolverDisputas(dt: number): void {
    const dueno = this.jugadorPorId(this.pelota.duenoId);
    if (!dueno) return;

    for (const rival of this.jugadores) {
      if (rival.bando === dueno.bando || rival.bloqueo > 0) continue;
      const d = Phaser.Math.Distance.Between(rival.x, rival.y, dueno.x, dueno.y);
      if (d > RADIO_JUGADOR * 2 + 6) continue;

      const probabilidad = dt * 1.6 * (0.4 + rival.attrs.quite / 130) * (1 - dueno.attrs.regate / 260);
      if (Math.random() > probabilidad) continue;

      this.pelota.duenoId = null;
      this.pelota.ultimoToqueId = rival.id;
      const angulo = Math.atan2(this.pelota.y - dueno.y, this.pelota.x - dueno.x) + (Math.random() - 0.5);
      this.pelota.vx = Math.cos(angulo) * 190;
      this.pelota.vy = Math.sin(angulo) * 190;
      this.pelota.bloqueoPosesion = 0.1;
      dueno.bloqueo = 0.45;
      rival.bloqueo = 0.08;
      return;
    }
  }

  private pasar(j: JugadorPartido, entrada: EntradaJugador): void {
    const companeros = this.jugadores.filter((o) => o.bando === j.bando && o.id !== j.id && !o.esArquero);
    if (companeros.length === 0) return;

    const direccionAtaque = j.bando === 'usuario' ? -1 : 1;
    const hayIntencion = Math.hypot(entrada.dirX, entrada.dirY) > 0.2;
    const intencionX = hayIntencion ? entrada.dirX : 0;
    const intencionY = hayIntencion ? entrada.dirY : direccionAtaque;

    let mejor: JugadorPartido | null = null;
    let mejorPuntaje = -Infinity;

    for (const c of companeros) {
      const dx = c.x - j.x;
      const dy = c.y - j.y;
      const distancia = Math.hypot(dx, dy);
      if (distancia < 30 || distancia > 460) continue;

      const alineacion = (dx / distancia) * intencionX + (dy / distancia) * intencionY;
      const marcaje = this.rivalMasCercano(c);
      const libre = marcaje ? Math.min(1, Phaser.Math.Distance.Between(c.x, c.y, marcaje.x, marcaje.y) / 90) : 1;
      const avance = ((j.y - c.y) * direccionAtaque * -1) / 300;

      const puntaje = alineacion * 2.2 + libre * 1.1 + avance - distancia / 900;
      if (puntaje > mejorPuntaje) {
        mejorPuntaje = puntaje;
        mejor = c;
      }
    }

    if (!mejor) return;

    // Adelanto el pase a donde va a estar el companero.
    const destinoX = mejor.x + mejor.vx * 0.25;
    const destinoY = mejor.y + mejor.vy * 0.25;
    const distancia = Phaser.Math.Distance.Between(j.x, j.y, destinoX, destinoY);
    const error = ((100 - j.attrs.pase) / 100) * 0.32 * (Math.random() - 0.5) * 2;
    const angulo = Math.atan2(destinoY - j.y, destinoX - j.x) + error;
    const potencia = Phaser.Math.Clamp(distancia * 2.1, 240, 620);

    this.pelota.duenoId = null;
    this.pelota.ultimoToqueId = j.id;
    this.pelota.vx = Math.cos(angulo) * potencia;
    this.pelota.vy = Math.sin(angulo) * potencia;
    this.pelota.bloqueoPosesion = 0.1;
    j.bloqueo = 0.12;
  }

  private patear(j: JugadorPartido, potencia: number): void {
    const arco = this.arcoRivalDe(j.bando);
    const distancia = Math.abs(arco - j.y);

    // La punteria cae con la distancia y sube con el atributo de tiro.
    const dispersion = ((100 - j.attrs.tiro) / 100) * 0.26 + (distancia / ALTO_CANCHA) * 0.26;
    const objetivoX = ANCHO_CANCHA / 2 + (Math.random() - 0.5) * ANCHO_ARCO * 0.7;
    const angulo = Math.atan2(arco - j.y, objetivoX - j.x) + (Math.random() - 0.5) * dispersion * 2;
    const fuerza = Phaser.Math.Clamp(430 + potencia * 420 + j.attrs.tiro * 1.4, 380, VELOCIDAD_MAX_PELOTA);

    this.pelota.duenoId = null;
    this.pelota.ultimoToqueId = j.id;
    this.pelota.vx = Math.cos(angulo) * fuerza;
    this.pelota.vy = Math.sin(angulo) * fuerza;
    this.pelota.bloqueoPosesion = 0.14;
    j.bloqueo = 0.1;

    if (j.bando === 'usuario') this.remates.usuario += 1;
    else this.remates.rival += 1;
  }

  // -------------------------------------------------------- limites y goles

  private revisarLimites(): void {
    const { x, y } = this.pelota;
    if (this.pelota.duenoId !== null) return;
    const dentroDelArco = Math.abs(x - ANCHO_CANCHA / 2) < ANCHO_ARCO / 2;

    if (y <= 0 && dentroDelArco) {
      this.anotar('usuario');
      return;
    }
    if (y >= ALTO_CANCHA && dentroDelArco) {
      this.anotar('rival');
      return;
    }

    if (x < 0 || x > ANCHO_CANCHA) {
      const ultimo = this.jugadorPorId(this.pelota.ultimoToqueId);
      const bandoSaque: Bando = ultimo?.bando === 'usuario' ? 'rival' : 'usuario';
      this.reponer(Phaser.Math.Clamp(x, 12, ANCHO_CANCHA - 12), Phaser.Math.Clamp(y, 40, ALTO_CANCHA - 40), bandoSaque);
      return;
    }

    if (y < 0 || y > ALTO_CANCHA) {
      const defiende: Bando = y < 0 ? 'rival' : 'usuario';
      const ultimo = this.jugadorPorId(this.pelota.ultimoToqueId);
      const fueCorner = ultimo?.bando !== defiende;
      if (fueCorner) {
        const esquinaX = x < ANCHO_CANCHA / 2 ? 16 : ANCHO_CANCHA - 16;
        const esquinaY = y < 0 ? 16 : ALTO_CANCHA - 16;
        this.reponer(esquinaX, esquinaY, defiende === 'usuario' ? 'rival' : 'usuario');
      } else {
        const arquero = this.jugadores.find((j) => j.bando === defiende && j.esArquero);
        if (arquero) {
          this.pelota.x = arquero.x;
          this.pelota.y = arquero.y;
          this.pelota.vx = 0;
          this.pelota.vy = 0;
          this.pelota.duenoId = arquero.id;
          this.pelota.ultimoToqueId = arquero.id;
          this.tiempoArqueroConPelota = 0;
        }
      }
    }
  }

  private reponer(x: number, y: number, bando: Bando): void {
    this.pelota.x = x;
    this.pelota.y = y;
    this.pelota.vx = 0;
    this.pelota.vy = 0;
    this.pelota.duenoId = null;
    this.pelota.bloqueoPosesion = 0.2;

    const cercano = this.jugadores
      .filter((j) => j.bando === bando && !j.esArquero)
      .sort(
        (a, b) => Phaser.Math.Distance.Between(a.x, a.y, x, y) - Phaser.Math.Distance.Between(b.x, b.y, x, y),
      )[0];
    if (cercano) {
      cercano.x = x;
      cercano.y = y;
      this.pelota.duenoId = cercano.id;
      this.pelota.ultimoToqueId = cercano.id;
    }
  }

  private anotar(bando: Bando): void {
    const autor = this.jugadorPorId(this.pelota.ultimoToqueId);
    const nombreAutor = autor && autor.bando === bando ? autor.nombre : 'en contra';

    if (bando === 'usuario') {
      this.golesUsuario += 1;
      if (autor && autor.bando === 'usuario') this.goleadoresUsuario.push(autor.id);
    } else {
      this.golesRival += 1;
      if (autor && autor.bando === 'rival') this.goleadoresRival.push(autor.id);
    }

    this.cameras.main.shake(200, 0.006);
    this.fase = 'gol';
    this.avisar(`GOL\n${nombreAutor}`, 1.6);
    this.prepararSaque(bando === 'usuario' ? 'rival' : 'usuario');
  }

  private prepararSaque(bando: Bando): void {
    this.saqueDe = bando;
    for (const j of this.jugadores) {
      const { x, y } = this.aMundo(j.bando, j.baseX, j.baseY);
      j.x = x;
      j.y = y;
      j.vx = 0;
      j.vy = 0;
      j.bloqueo = 0;
    }

    this.pelota.x = ANCHO_CANCHA / 2;
    this.pelota.y = ALTO_CANCHA / 2;
    this.pelota.vx = 0;
    this.pelota.vy = 0;
    this.pelota.bloqueoPosesion = 0;

    const sacador = this.jugadores
      .filter((j) => j.bando === bando && !j.esArquero)
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(a.x, a.y, ANCHO_CANCHA / 2, ALTO_CANCHA / 2) -
          Phaser.Math.Distance.Between(b.x, b.y, ANCHO_CANCHA / 2, ALTO_CANCHA / 2),
      )[0];

    if (sacador) {
      sacador.x = ANCHO_CANCHA / 2;
      sacador.y = ALTO_CANCHA / 2 + (bando === 'usuario' ? 18 : -18);
      this.pelota.duenoId = sacador.id;
      this.pelota.ultimoToqueId = sacador.id;
    }
  }

  private terminar(): void {
    const total = Math.max(1, this.ticksPosesion.usuario + this.ticksPosesion.rival);
    const resultado: ResultadoPartido = {
      golesUsuario: this.golesUsuario,
      golesRival: this.golesRival,
      goleadoresUsuario: this.goleadoresUsuario,
      goleadoresRival: this.goleadoresRival,
      remates: { ...this.remates },
      posesion: {
        usuario: Math.round((this.ticksPosesion.usuario / total) * 100),
        rival: Math.round((this.ticksPosesion.rival / total) * 100),
      },
    };
    this.alTerminar(resultado);
  }

  // ---------------------------------------------------------------- dibujo

  private dibujarCancha(): void {
    const g = this.capaCancha;
    g.clear();
    g.fillStyle(COLOR_CESPED, 1);
    g.fillRect(-MARGEN, -MARGEN, ANCHO_CANCHA + MARGEN * 2, ALTO_CANCHA + MARGEN * 2);

    // Franjas de cesped cortado.
    g.fillStyle(COLOR_CESPED_CLARO, 1);
    const franja = ALTO_CANCHA / 10;
    for (let i = 0; i < 10; i += 2) {
      g.fillRect(-MARGEN, i * franja, ANCHO_CANCHA + MARGEN * 2, franja);
    }

    g.lineStyle(3, COLOR_LINEA, 0.85);
    g.strokeRect(0, 0, ANCHO_CANCHA, ALTO_CANCHA);
    g.lineBetween(0, ALTO_CANCHA / 2, ANCHO_CANCHA, ALTO_CANCHA / 2);
    g.strokeCircle(ANCHO_CANCHA / 2, ALTO_CANCHA / 2, 90);
    g.fillStyle(COLOR_LINEA, 0.85);
    g.fillCircle(ANCHO_CANCHA / 2, ALTO_CANCHA / 2, 5);

    for (const arriba of [true, false]) {
      const yArea = arriba ? 0 : ALTO_CANCHA - ALTO_AREA;
      g.lineStyle(3, COLOR_LINEA, 0.85);
      g.strokeRect((ANCHO_CANCHA - ANCHO_AREA) / 2, yArea, ANCHO_AREA, ALTO_AREA);

      const yChica = arriba ? 0 : ALTO_CANCHA - ALTO_AREA / 2.6;
      g.strokeRect((ANCHO_CANCHA - ANCHO_AREA / 2) / 2, yChica, ANCHO_AREA / 2, ALTO_AREA / 2.6);

      const yArco = arriba ? -PROFUNDIDAD_ARCO : ALTO_CANCHA;
      g.fillStyle(0xffffff, 0.28);
      g.fillRect((ANCHO_CANCHA - ANCHO_ARCO) / 2, yArco, ANCHO_ARCO, PROFUNDIDAD_ARCO);
      g.lineStyle(4, 0xffffff, 0.95);
      g.strokeRect((ANCHO_CANCHA - ANCHO_ARCO) / 2, yArco, ANCHO_ARCO, PROFUNDIDAD_ARCO);
    }
  }

  private dibujar(): void {
    const g = this.capaJuego;
    g.clear();

    for (const j of this.jugadores) {
      const color = j.bando === 'usuario' ? this.colorUsuario : this.colorRival;

      g.fillStyle(0x000000, 0.25);
      g.fillEllipse(j.x, j.y + RADIO_JUGADOR * 0.8, RADIO_JUGADOR * 1.6, RADIO_JUGADOR * 0.7);

      g.fillStyle(color, 1);
      g.fillCircle(j.x, j.y, RADIO_JUGADOR);
      g.lineStyle(2, j.esArquero ? 0xf1c40f : 0x0b1220, 0.9);
      g.strokeCircle(j.x, j.y, RADIO_JUGADOR);

      if (j.id === this.controladoId) {
        g.lineStyle(3, 0xffffff, 0.95);
        g.strokeCircle(j.x, j.y, RADIO_JUGADOR + 7);
      }
      if (this.pelota.duenoId === j.id) {
        g.lineStyle(2, 0xf1c40f, 0.9);
        g.strokeCircle(j.x, j.y, RADIO_JUGADOR + 3);
      }
    }

    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(this.pelota.x, this.pelota.y + 6, RADIO_PELOTA * 2, RADIO_PELOTA);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(this.pelota.x, this.pelota.y, RADIO_PELOTA);
    g.lineStyle(2, 0x111111, 0.8);
    g.strokeCircle(this.pelota.x, this.pelota.y, RADIO_PELOTA);
  }
}
