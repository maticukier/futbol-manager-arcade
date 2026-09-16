import type { Atributos, Formacion, PosicionCodigo } from '@/sim/types';
import { calcularMedia } from '@/sim/jugadores';
import { FORMACIONES } from '@/sim/tacticas';
import type { MotorPartido } from './motor';

type Pestana = 'resumen' | 'cambios' | 'tactica';

/**
 * Menu de pausa del partido: estadisticas, cambios y ajuste de tactica sin
 * salir del juego. Vive en DOM sobre el canvas, como el resto de la interfaz.
 */
export class MenuPausa {
  private readonly raiz: HTMLElement;
  private readonly motor: MotorPartido;
  private readonly alCerrar: () => void;
  private readonly alSalir: () => void;

  private pestana: Pestana = 'resumen';
  private seleccionado: string | null = null;
  abierto = false;

  constructor(contenedor: HTMLElement, motor: MotorPartido, alCerrar: () => void, alSalir: () => void) {
    this.motor = motor;
    this.alCerrar = alCerrar;
    this.alSalir = alSalir;

    this.raiz = document.createElement('div');
    this.raiz.className = 'pausa';
    this.raiz.hidden = true;
    contenedor.appendChild(this.raiz);
  }

  abrir(): void {
    this.abierto = true;
    this.raiz.hidden = false;
    this.pintar();
  }

  cerrar(): void {
    this.abierto = false;
    this.raiz.hidden = true;
    this.seleccionado = null;
  }

  destruir(): void {
    this.raiz.remove();
  }

  private pintar(): void {
    const m = this.motor;
    const pestanas = (
      [
        ['resumen', 'Resumen'],
        ['cambios', 'Cambios'],
        ['tactica', 'Tactica'],
      ] as [Pestana, string][]
    )
      .map(
        ([clave, texto]) =>
          `<button class="pausa__pestana ${this.pestana === clave ? 'activa' : ''}" data-pestana="${clave}">${texto}</button>`,
      )
      .join('');

    this.raiz.innerHTML = `
      <div class="pausa__panel">
        <div class="pausa__cabecera">
          <strong>${m.config.usuario.abrev} ${m.golesUsuario} - ${m.golesRival} ${m.config.rival.abrev}</strong>
          <span>${m.minuto}'  ·  ${m.tiempoActual === 1 ? '1er' : '2do'} tiempo</span>
        </div>
        <div class="pausa__pestanas">${pestanas}</div>
        <div class="pausa__cuerpo">${this.cuerpo()}</div>
        <div class="pausa__pie">
          <button class="boton boton--primario" data-accion="seguir">Seguir jugando</button>
          <button class="boton boton--fantasma" data-accion="salir">Abandonar</button>
        </div>
      </div>
    `;
    this.conectar();
  }

  private cuerpo(): string {
    if (this.pestana === 'resumen') return this.cuerpoResumen();
    if (this.pestana === 'cambios') return this.cuerpoCambios();
    return this.cuerpoTactica();
  }

  private cuerpoResumen(): string {
    const m = this.motor;
    const posesionTotal = Math.max(1, m.posesionDe('usuario') + m.posesionDe('rival'));
    const posesion = Math.round((m.posesionDe('usuario') / posesionTotal) * 100);

    const fila = (etiqueta: string, propio: string | number, ajeno: string | number) => `
      <div class="pausa__estadistica">
        <strong>${propio}</strong><span>${etiqueta}</span><strong>${ajeno}</strong>
      </div>
    `;

    return `
      ${fila('Posesion', `${posesion}%`, `${100 - posesion}%`)}
      ${fila('Remates', m.rematesDe('usuario'), m.rematesDe('rival'))}
      ${fila('Amarillas', m.amarillas.usuario, m.amarillas.rival)}
      ${fila('Rojas', m.rojas.usuario, m.rojas.rival)}
      ${fila('Cambios', `${m.cambiosUsados.usuario}/${m.cambiosMaximos}`, `${m.cambiosUsados.rival}/${m.cambiosMaximos}`)}
    `;
  }

  private cuerpoCambios(): string {
    const m = this.motor;
    const enCancha = m.jugadores.filter((j) => j.bando === 'usuario' && !j.expulsado);
    const banco = m.config.usuario.suplentes;

    const ficha = (id: string, nombre: string, detalle: string, energia: number | null, elegido: boolean) => `
      <button class="pausa__ficha ${elegido ? 'elegida' : ''}" data-jugador="${id}">
        <span>
          <strong>${nombre}</strong><br /><span class="suave">${detalle}</span>
        </span>
        ${energia === null ? '' : `<span class="pausa__aire"><i style="width:${Math.round(energia * 100)}%"></i></span>`}
      </button>
    `;

    const titulares = enCancha
      .map((j) => ficha(j.id, j.nombre, `${j.pos} · media ${mediaDe(j.attrs, j.pos)}`, j.energia, this.seleccionado === j.id))
      .join('');

    const suplentes = banco
      .map((j) => ficha(j.id, j.nombre, `${j.pos} · media ${j.media}`, null, this.seleccionado === j.id))
      .join('');

    const restantes = m.cambiosMaximos - m.cambiosUsados.usuario;

    return `
      <p class="suave" style="font-size:12.5px;margin:0 0 8px">
        Toca a uno de la cancha y despues a uno del banco. Te quedan ${restantes} cambios.
      </p>
      <div class="pausa__columnas">
        <div><p class="tarjeta__titulo">En cancha</p>${titulares}</div>
        <div><p class="tarjeta__titulo">Banco</p>${suplentes || '<p class="suave">Sin suplentes.</p>'}</div>
      </div>
    `;
  }

  private cuerpoTactica(): string {
    const t = this.motor.config.usuario.tacticas;
    const opciones = (Object.keys(FORMACIONES) as Formacion[])
      .map((f) => `<option value="${f}"${t.formacion === f ? ' selected' : ''}>${f}</option>`)
      .join('');

    const deslizador = (clave: string, etiqueta: string, valor: number) => `
      <label class="campo">${etiqueta} <strong>${valor}</strong>
        <input type="range" min="0" max="100" step="5" value="${valor}" data-tactica="${clave}" />
      </label>
    `;

    return `
      <label class="campo">Formacion<select data-formacion>${opciones}</select></label>
      ${deslizador('mentalidad', 'Mentalidad', t.mentalidad)}
      ${deslizador('presion', 'Presion', t.presion)}
      ${deslizador('lineaDefensiva', 'Linea defensiva', t.lineaDefensiva)}
      ${deslizador('ritmo', 'Ritmo', t.ritmo)}
    `;
  }

  private conectar(): void {
    this.raiz.querySelectorAll<HTMLElement>('[data-pestana]').forEach((nodo) => {
      nodo.addEventListener('click', () => {
        this.pestana = nodo.dataset.pestana as Pestana;
        this.seleccionado = null;
        this.pintar();
      });
    });

    this.raiz.querySelector('[data-accion="seguir"]')?.addEventListener('click', () => this.alCerrar());
    this.raiz.querySelector('[data-accion="salir"]')?.addEventListener('click', () => this.alSalir());

    this.raiz.querySelectorAll<HTMLElement>('[data-jugador]').forEach((nodo) => {
      nodo.addEventListener('click', () => {
        const id = nodo.dataset.jugador!;
        if (!this.seleccionado) {
          this.seleccionado = id;
          this.pintar();
          return;
        }
        if (this.seleccionado === id) {
          this.seleccionado = null;
          this.pintar();
          return;
        }
        const error = this.motor.sustituir(this.seleccionado, id) ?? this.motor.sustituir(id, this.seleccionado);
        this.seleccionado = null;
        this.pintar();
        if (error) this.avisar(error);
      });
    });

    this.raiz.querySelector<HTMLSelectElement>('[data-formacion]')?.addEventListener('change', (evento) => {
      this.motor.cambiarFormacion('usuario', (evento.target as HTMLSelectElement).value as Formacion);
      this.pintar();
    });

    this.raiz.querySelectorAll<HTMLInputElement>('[data-tactica]').forEach((nodo) => {
      nodo.addEventListener('change', () => {
        const clave = nodo.dataset.tactica as 'presion' | 'lineaDefensiva' | 'ritmo' | 'mentalidad';
        this.motor.config.usuario.tacticas[clave] = Number(nodo.value);
        this.pintar();
      });
    });
  }

  private avisar(texto: string): void {
    const nodo = document.createElement('div');
    nodo.className = 'pausa__error';
    nodo.textContent = texto;
    this.raiz.querySelector('.pausa__cuerpo')?.prepend(nodo);
    setTimeout(() => nodo.remove(), 2200);
  }
}

/** Media del jugador que esta en cancha, que puede haber cambiado con un cambio. */
function mediaDe(attrs: Atributos, pos: PosicionCodigo): number {
  return calcularMedia(pos, attrs);
}
