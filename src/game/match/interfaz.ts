import type { EntradaPartido } from './entidades';
import type { MotorPartido } from './motor';

const CARGA_MAXIMA = 800;
const RADIO_JOYSTICK = 58;

/** Que dice cada boton segun tengas o no la pelota. */
const ETIQUETAS = {
  conPelota: { a: 'PASE', b: 'TIRO', c: 'BOMBEADO' },
  sinPelota: { a: 'CAMBIO', b: 'BARRIDA', c: 'PRESION' },
};

/**
 * Interfaz del partido en DOM sobre el canvas 3D: marcador, avisos, joystick
 * y los tres botones. En HTML el texto se lee nitido en cualquier pantalla y
 * el area tactil es mas facil de ajustar que dibujandolos adentro del juego.
 */
export class InterfazPartido {
  private readonly raiz: HTMLElement;
  private readonly motor: MotorPartido;

  private readonly marcador: HTMLElement;
  private readonly reloj: HTMLElement;
  private readonly aviso: HTMLElement;
  private readonly joystick: HTMLElement;
  private readonly palanca: HTMLElement;
  private readonly botones: Record<'a' | 'b' | 'c', HTMLButtonElement>;
  private readonly botonCorrer: HTMLButtonElement;
  private readonly girar: HTMLElement;

  private punteroJoystick: number | null = null;
  private origen = { x: 0, y: 0 };
  private direccion = { x: 0, y: 0 };

  private pendientes = { a: false, b: false, c: false };
  private potencia = 0.6;
  private cargaDesde = 0;
  private punteroCarga: number | null = null;
  private punteroCorrer: number | null = null;
  private corriendo = false;
  private teclas = new Set<string>();
  private conPelotaPrevio: boolean | null = null;

  constructor(contenedor: HTMLElement, motor: MotorPartido, alSalir: () => void) {
    this.motor = motor;

    this.raiz = document.createElement('div');
    this.raiz.className = 'partido';
    this.raiz.innerHTML = `
      <div class="partido__hud">
        <button class="partido__salir" type="button">Salir</button>
        <div class="partido__centro">
          <div class="partido__marcador"></div>
          <div class="partido__reloj"></div>
        </div>
      </div>
      <div class="partido__aviso" hidden><strong></strong><span></span></div>
      <div class="partido__joystick" hidden><i></i></div>
      <div class="partido__botones">
        <button class="partido__boton partido__boton--c" type="button" data-boton="c"></button>
        <button class="partido__boton partido__boton--b" type="button" data-boton="b"></button>
        <button class="partido__boton partido__boton--a" type="button" data-boton="a"></button>
        <button class="partido__boton partido__boton--correr" type="button" data-boton="correr">CORRER</button>
      </div>
      <div class="partido__girar" hidden>
        <div class="partido__girar-icono">📱</div>
        <strong>Gira el telefono</strong>
        <span>El partido se juega apaisado.</span>
      </div>
    `;
    contenedor.appendChild(this.raiz);

    this.marcador = this.raiz.querySelector('.partido__marcador')!;
    this.reloj = this.raiz.querySelector('.partido__reloj')!;
    this.aviso = this.raiz.querySelector('.partido__aviso')!;
    this.joystick = this.raiz.querySelector('.partido__joystick')!;
    this.palanca = this.joystick.querySelector('i')!;
    this.girar = this.raiz.querySelector('.partido__girar')!;
    this.botones = {
      a: this.raiz.querySelector('[data-boton="a"]')!,
      b: this.raiz.querySelector('[data-boton="b"]')!,
      c: this.raiz.querySelector('[data-boton="c"]')!,
    };
    this.botonCorrer = this.raiz.querySelector('[data-boton="correr"]')!;

    this.raiz.querySelector('.partido__salir')!.addEventListener('click', alSalir);
    this.conectarBotones();
    this.conectarJoystick();
    this.conectarTeclado();
    this.refrescarEtiquetas(true);
  }

  // ---------------------------------------------------------------- entradas

  private conectarBotones(): void {
    // Correr es un boton que se mantiene apretado, no un toque.
    this.botonCorrer.addEventListener('pointerdown', (evento) => {
      evento.preventDefault();
      this.botonCorrer.setPointerCapture(evento.pointerId);
      this.punteroCorrer = evento.pointerId;
      this.corriendo = true;
      this.botonCorrer.classList.add('apretado');
    });
    const soltarCorrer = (evento: PointerEvent) => {
      if (this.punteroCorrer !== evento.pointerId) return;
      this.punteroCorrer = null;
      this.corriendo = false;
      this.botonCorrer.classList.remove('apretado');
    };
    this.botonCorrer.addEventListener('pointerup', soltarCorrer);
    this.botonCorrer.addEventListener('pointercancel', soltarCorrer);

    for (const clave of ['a', 'b', 'c'] as const) {
      const boton = this.botones[clave];
      boton.addEventListener('pointerdown', (evento) => {
        evento.preventDefault();
        boton.setPointerCapture(evento.pointerId);
        boton.classList.add('apretado');
        if (clave === 'b') {
          this.punteroCarga = evento.pointerId;
          this.cargaDesde = performance.now();
        } else {
          this.pendientes[clave] = true;
        }
      });

      const soltar = (evento: PointerEvent) => {
        boton.classList.remove('apretado');
        if (clave !== 'b' || this.punteroCarga !== evento.pointerId) return;
        this.potencia = this.calcularPotencia();
        this.pendientes.b = true;
        this.punteroCarga = null;
        this.cargaDesde = 0;
      };
      boton.addEventListener('pointerup', soltar);
      boton.addEventListener('pointercancel', soltar);
    }
  }

  private calcularPotencia(): number {
    if (this.cargaDesde === 0) return 0.55;
    const mantenido = performance.now() - this.cargaDesde;
    return Math.min(1, 0.45 + (mantenido / CARGA_MAXIMA) * 0.55);
  }

  private conectarJoystick(): void {
    const zona = this.raiz;

    zona.addEventListener('pointerdown', (evento) => {
      if ((evento.target as HTMLElement).closest('.partido__botones, .partido__salir')) return;
      if (this.punteroJoystick !== null) return;
      if (evento.clientX > window.innerWidth * 0.55) return;

      this.punteroJoystick = evento.pointerId;
      this.origen = { x: evento.clientX, y: evento.clientY };
      this.joystick.hidden = false;
      this.joystick.style.left = `${evento.clientX}px`;
      this.joystick.style.top = `${evento.clientY}px`;
      this.palanca.style.transform = 'translate(-50%, -50%)';
    });

    zona.addEventListener('pointermove', (evento) => {
      if (evento.pointerId !== this.punteroJoystick) return;
      const dx = evento.clientX - this.origen.x;
      const dy = evento.clientY - this.origen.y;
      const distancia = Math.hypot(dx, dy);
      const angulo = Math.atan2(dy, dx);
      const limite = Math.min(distancia, RADIO_JOYSTICK);

      this.palanca.style.transform = `translate(calc(-50% + ${Math.cos(angulo) * limite}px), calc(-50% + ${
        Math.sin(angulo) * limite
      }px))`;

      const intensidad = Math.min(1, distancia / RADIO_JOYSTICK);
      if (intensidad < 0.18) {
        this.direccion = { x: 0, y: 0 };
      } else {
        this.direccion = { x: Math.cos(angulo) * intensidad, y: Math.sin(angulo) * intensidad };
      }
    });

    const soltar = (evento: PointerEvent) => {
      if (evento.pointerId !== this.punteroJoystick) return;
      this.punteroJoystick = null;
      this.direccion = { x: 0, y: 0 };
      this.joystick.hidden = true;
    };
    zona.addEventListener('pointerup', soltar);
    zona.addEventListener('pointercancel', soltar);
  }

  private conectarTeclado(): void {
    window.addEventListener('keydown', this.alBajarTecla);
    window.addEventListener('keyup', this.alSubirTecla);
  }

  private alBajarTecla = (evento: KeyboardEvent): void => {
    const tecla = evento.key.toLowerCase();
    if (this.teclas.has(tecla)) return;
    this.teclas.add(tecla);
    if (tecla === 'j') this.pendientes.a = true;
    if (tecla === 'k') this.cargaDesde = performance.now();
    if (tecla === 'l') this.pendientes.c = true;
  };

  private alSubirTecla = (evento: KeyboardEvent): void => {
    const tecla = evento.key.toLowerCase();
    this.teclas.delete(tecla);
    if (tecla === 'k') {
      this.potencia = this.calcularPotencia();
      this.pendientes.b = true;
      this.cargaDesde = 0;
    }
  };

  /** Devuelve lo que se apreto en este cuadro y limpia los eventos de un uso. */
  leer(): EntradaPartido {
    let moverX = this.direccion.x;
    let moverZ = this.direccion.y;

    let tx = 0;
    let tz = 0;
    if (this.teclas.has('a') || this.teclas.has('arrowleft')) tx -= 1;
    if (this.teclas.has('d') || this.teclas.has('arrowright')) tx += 1;
    if (this.teclas.has('w') || this.teclas.has('arrowup')) tz -= 1;
    if (this.teclas.has('s') || this.teclas.has('arrowdown')) tz += 1;
    if (tx !== 0 || tz !== 0) {
      const largo = Math.hypot(tx, tz);
      moverX = tx / largo;
      moverZ = tz / largo;
    }

    const entrada: EntradaPartido = {
      moverX,
      moverZ,
      a: this.pendientes.a,
      b: this.pendientes.b,
      c: this.pendientes.c,
      correr: this.corriendo || this.teclas.has('shift'),
      potencia: this.potencia,
    };

    this.pendientes = { a: false, b: false, c: false };
    return entrada;
  }

  // ----------------------------------------------------------------- pintado

  actualizar(): void {
    const { usuario, rival } = this.motor.config;
    this.marcador.innerHTML = `
      <span>${usuario.abrev}</span>
      <strong>${this.motor.golesUsuario} - ${this.motor.golesRival}</strong>
      <span>${rival.abrev}</span>
    `;
    this.reloj.textContent = `${this.motor.minuto}'  ·  ${this.motor.tiempoActual === 1 ? '1er' : '2do'} tiempo`;

    const aviso = this.motor.aviso;
    if (aviso) {
      this.aviso.hidden = false;
      this.aviso.querySelector('strong')!.textContent = aviso.titulo;
      this.aviso.querySelector('span')!.textContent = aviso.detalle;
    } else {
      this.aviso.hidden = true;
    }

    this.refrescarEtiquetas(false);

    const controlado = this.motor.porId(this.motor.controladoId);
    this.botonCorrer.style.setProperty('--energia', String(controlado ? controlado.energia : 1));
    this.botonCorrer.classList.toggle('sin-aire', !!controlado && controlado.energia < 0.2);

    if (this.cargaDesde > 0) {
      this.botones.b.style.setProperty('--carga', String(this.calcularPotencia()));
    } else {
      this.botones.b.style.setProperty('--carga', '0');
    }

    this.girar.hidden = window.innerWidth >= window.innerHeight;
  }

  private refrescarEtiquetas(forzar: boolean): void {
    const conPelota = this.motor.tieneLaPelotaElUsuario;
    if (!forzar && conPelota === this.conPelotaPrevio) return;
    this.conPelotaPrevio = conPelota;

    const etiquetas = conPelota ? ETIQUETAS.conPelota : ETIQUETAS.sinPelota;
    for (const clave of ['a', 'b', 'c'] as const) {
      this.botones[clave].textContent = etiquetas[clave];
    }
    this.raiz.classList.toggle('partido--con-pelota', conPelota);
  }

  destruir(): void {
    window.removeEventListener('keydown', this.alBajarTecla);
    window.removeEventListener('keyup', this.alSubirTecla);
    this.raiz.remove();
  }
}
