import Phaser from 'phaser';

export interface EntradaJugador {
  dirX: number;
  dirY: number;
  /** Se activa un solo frame, en el momento del toque. */
  pase: boolean;
  tiro: boolean;
  /** 0-1: cuanto se mantuvo apretado el boton de tiro antes de soltarlo. */
  potenciaTiro: number;
}

const RADIO_BASE = 62;
const RADIO_PALANCA = 30;
const RADIO_BOTON = 44;
const CARGA_MAXIMA = 700;

/**
 * Joystick virtual a la izquierda y dos botones a la derecha, mas teclado
 * para poder probar en la compu. Todo dibujado con graficos: sin assets.
 */
export class Controles {
  private escena: Phaser.Scene;
  private capa: Phaser.GameObjects.Container;
  private base: Phaser.GameObjects.Arc;
  private palanca: Phaser.GameObjects.Arc;
  private botonPase: Phaser.GameObjects.Arc;
  private botonTiro: Phaser.GameObjects.Arc;
  private anillodeCarga: Phaser.GameObjects.Arc;

  private punteroJoystick: number | null = null;
  private origenX = 0;
  private origenY = 0;
  private dirX = 0;
  private dirY = 0;

  private pasePendiente = false;
  private tiroPendiente = false;
  private potenciaPendiente = 0;
  private tiroDesde = 0;
  private punteroTiro: number | null = null;

  private teclas: {
    arriba: Phaser.Input.Keyboard.Key;
    abajo: Phaser.Input.Keyboard.Key;
    izquierda: Phaser.Input.Keyboard.Key;
    derecha: Phaser.Input.Keyboard.Key;
    pase: Phaser.Input.Keyboard.Key;
    tiro: Phaser.Input.Keyboard.Key;
  } | null = null;

  constructor(escena: Phaser.Scene, margenInferior = 0) {
    this.escena = escena;
    const ancho = escena.scale.width;
    const alto = escena.scale.height - margenInferior;

    this.capa = escena.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    this.base = escena.add.circle(0, 0, RADIO_BASE, 0xffffff, 0.12).setStrokeStyle(2, 0xffffff, 0.3);
    this.palanca = escena.add.circle(0, 0, RADIO_PALANCA, 0xffffff, 0.45);
    this.base.setVisible(false);
    this.palanca.setVisible(false);

    const botonY = alto - 110;
    this.botonPase = escena.add.circle(ancho - 150, botonY, RADIO_BOTON, 0x27ae60, 0.82).setStrokeStyle(2, 0xffffff, 0.75);
    this.botonTiro = escena.add.circle(ancho - 60, botonY - 70, RADIO_BOTON, 0xc0392b, 0.82).setStrokeStyle(2, 0xffffff, 0.75);
    this.anillodeCarga = escena.add.circle(this.botonTiro.x, this.botonTiro.y, RADIO_BOTON + 8, 0xffffff, 0).setStrokeStyle(4, 0xf1c40f, 0);

    const etiqueta = (x: number, y: number, texto: string) =>
      escena.add
        .text(x, y, texto, { fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#ffffff' })
        .setOrigin(0.5)
        .setScrollFactor(0);

    this.capa.add([
      this.base,
      this.palanca,
      this.botonPase,
      this.botonTiro,
      this.anillodeCarga,
      etiqueta(this.botonPase.x, this.botonPase.y, 'PASE'),
      etiqueta(this.botonTiro.x, this.botonTiro.y, 'TIRO'),
    ]);

    for (const objeto of [this.base, this.palanca, this.botonPase, this.botonTiro, this.anillodeCarga]) {
      objeto.setScrollFactor(0);
    }

    escena.input.addPointer(2);
    escena.input.on(Phaser.Input.Events.POINTER_DOWN, this.alTocar, this);
    escena.input.on(Phaser.Input.Events.POINTER_MOVE, this.alMover, this);
    escena.input.on(Phaser.Input.Events.POINTER_UP, this.alSoltar, this);

    if (escena.input.keyboard) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.teclas = {
        arriba: escena.input.keyboard.addKey(K.W),
        abajo: escena.input.keyboard.addKey(K.S),
        izquierda: escena.input.keyboard.addKey(K.A),
        derecha: escena.input.keyboard.addKey(K.D),
        pase: escena.input.keyboard.addKey(K.J),
        tiro: escena.input.keyboard.addKey(K.K),
      };
      escena.input.keyboard.on('keydown-J', () => (this.pasePendiente = true));
      escena.input.keyboard.on('keydown-K', () => (this.tiroDesde = escena.time.now));
      escena.input.keyboard.on('keyup-K', () => {
        this.tiroPendiente = true;
        this.potenciaPendiente = this.calcularPotencia();
        this.tiroDesde = 0;
      });
      escena.input.keyboard.addCapture([K.W, K.A, K.S, K.D, K.J, K.K, K.UP, K.DOWN, K.LEFT, K.RIGHT, K.SPACE]);
    }
  }

  private dentroDe(boton: Phaser.GameObjects.Arc, x: number, y: number): boolean {
    return Phaser.Math.Distance.Between(boton.x, boton.y, x, y) <= RADIO_BOTON + 14;
  }

  private alTocar(puntero: Phaser.Input.Pointer): void {
    if (this.dentroDe(this.botonPase, puntero.x, puntero.y)) {
      this.pasePendiente = true;
      return;
    }
    if (this.dentroDe(this.botonTiro, puntero.x, puntero.y)) {
      this.punteroTiro = puntero.id;
      this.tiroDesde = this.escena.time.now;
      return;
    }
    if (this.punteroJoystick === null && puntero.x < this.escena.scale.width * 0.55) {
      this.punteroJoystick = puntero.id;
      this.origenX = puntero.x;
      this.origenY = puntero.y;
      this.base.setPosition(puntero.x, puntero.y).setVisible(true);
      this.palanca.setPosition(puntero.x, puntero.y).setVisible(true);
    }
  }

  private alMover(puntero: Phaser.Input.Pointer): void {
    if (puntero.id !== this.punteroJoystick) return;
    const dx = puntero.x - this.origenX;
    const dy = puntero.y - this.origenY;
    const distancia = Math.hypot(dx, dy);
    const limite = Math.min(distancia, RADIO_BASE);
    const angulo = Math.atan2(dy, dx);

    this.palanca.setPosition(this.origenX + Math.cos(angulo) * limite, this.origenY + Math.sin(angulo) * limite);

    const intensidad = Math.min(1, distancia / RADIO_BASE);
    if (intensidad < 0.15) {
      this.dirX = 0;
      this.dirY = 0;
    } else {
      this.dirX = Math.cos(angulo) * intensidad;
      this.dirY = Math.sin(angulo) * intensidad;
    }
  }

  private alSoltar(puntero: Phaser.Input.Pointer): void {
    if (puntero.id === this.punteroTiro) {
      this.tiroPendiente = true;
      this.potenciaPendiente = this.calcularPotencia();
      this.punteroTiro = null;
      this.tiroDesde = 0;
    }
    if (puntero.id !== this.punteroJoystick) return;
    this.punteroJoystick = null;
    this.dirX = 0;
    this.dirY = 0;
    this.base.setVisible(false);
    this.palanca.setVisible(false);
  }

  private calcularPotencia(): number {
    if (this.tiroDesde === 0) return 0.5;
    const mantenido = this.escena.time.now - this.tiroDesde;
    return Phaser.Math.Clamp(0.45 + (mantenido / CARGA_MAXIMA) * 0.55, 0.45, 1);
  }

  /** La capa de controles, para que la camara del mundo la ignore. */
  objetos(): Phaser.GameObjects.GameObject[] {
    return [this.capa];
  }

  /** Devuelve la entrada del frame y limpia los eventos de un solo uso. */
  leer(): EntradaJugador {
    let dirX = this.dirX;
    let dirY = this.dirY;

    if (this.teclas) {
      let tx = 0;
      let ty = 0;
      if (this.teclas.izquierda.isDown) tx -= 1;
      if (this.teclas.derecha.isDown) tx += 1;
      if (this.teclas.arriba.isDown) ty -= 1;
      if (this.teclas.abajo.isDown) ty += 1;
      if (tx !== 0 || ty !== 0) {
        const largo = Math.hypot(tx, ty);
        dirX = tx / largo;
        dirY = ty / largo;
      }
    }

    const cargando = this.tiroDesde !== 0;
    this.anillodeCarga.setStrokeStyle(4, 0xf1c40f, cargando ? this.calcularPotencia() : 0);

    const entrada: EntradaJugador = {
      dirX,
      dirY,
      pase: this.pasePendiente,
      tiro: this.tiroPendiente,
      potenciaTiro: this.potenciaPendiente || 0.6,
    };

    this.pasePendiente = false;
    this.tiroPendiente = false;
    this.potenciaPendiente = 0;
    return entrada;
  }

  destruir(): void {
    this.escena.input.off(Phaser.Input.Events.POINTER_DOWN, this.alTocar, this);
    this.escena.input.off(Phaser.Input.Events.POINTER_MOVE, this.alMover, this);
    this.escena.input.off(Phaser.Input.Events.POINTER_UP, this.alSoltar, this);
    this.capa.destroy(true);
  }
}
