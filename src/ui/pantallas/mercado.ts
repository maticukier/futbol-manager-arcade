import type { App } from '../app';
import type { PosicionCodigo } from '@/sim/types';
import { clubPorId, plantelDe } from '@/sim/juego';
import { FILTRO_INICIAL, comprar, listaDePases, vender, type FiltroMercado } from '@/sim/mercado';
import { claseMedia, esc, plata } from '../formato';

type Vista = 'comprar' | 'vender';
let vista: Vista = 'comprar';
let filtro: FiltroMercado = { ...FILTRO_INICIAL };

export function render(app: App): string {
  const estado = app.exigirEstado();
  const club = clubPorId(estado, estado.clubUsuarioId);

  const pestanas = (
    [
      ['comprar', 'Fichar'],
      ['vender', 'Vender'],
    ] as [Vista, string][]
  )
    .map(
      ([clave, texto]) =>
        `<button class="boton boton--chico ${vista === clave ? 'boton--primario' : 'boton--fantasma'}" data-vista="${clave}">${texto}</button>`,
    )
    .join('');

  return `
    <div class="fila" style="gap:8px">${pestanas}</div>
    <div class="tarjeta">
      <div class="fila fila--entre">
        <span class="suave">Disponible</span>
        <strong>${plata(club.dinero)}</strong>
      </div>
      <div class="fila fila--entre" style="margin-top:4px;font-size:13px">
        <span class="suave">Presupuesto sugerido por el directorio</span>
        <span>${plata(estado.directorio.presupuestoFichajes)}</span>
      </div>
    </div>
    ${vista === 'comprar' ? renderComprar(app) : renderVender(app)}
  `;
}

function renderFiltros(): string {
  const puestos: (PosicionCodigo | 'TODOS')[] = ['TODOS', 'ARQ', 'DEF', 'MED', 'DEL'];
  const medias = [0, 55, 62, 68, 74, 80];
  const precios = [0, 5_000_000, 15_000_000, 40_000_000, 100_000_000];

  const opciones = <T extends string | number>(valores: T[], actual: T, etiqueta: (v: T) => string) =>
    valores
      .map((v) => `<option value="${v}"${v === actual ? ' selected' : ''}>${etiqueta(v)}</option>`)
      .join('');

  return `
    <div class="tarjeta">
      <p class="tarjeta__titulo">Filtros</p>
      <input class="campo-texto" type="search" placeholder="Buscar por nombre" data-filtro="texto"
             value="${esc(filtro.texto)}" />
      <div class="grilla-filtros">
        <label>Puesto
          <select data-filtro="puesto">
            ${opciones(puestos, filtro.puesto, (v) => (v === 'TODOS' ? 'Todos' : v))}
          </select>
        </label>
        <label>Procedencia
          <select data-filtro="origen">
            ${opciones(['todos', 'local', 'exterior'] as const, filtro.origen, (v) =>
              v === 'todos' ? 'Todas' : v === 'local' ? 'Liga local' : 'Exterior',
            )}
          </select>
        </label>
        <label>Media minima
          <select data-filtro="mediaMinima">
            ${opciones(medias, filtro.mediaMinima, (v) => (v === 0 ? 'Cualquiera' : `${v}+`))}
          </select>
        </label>
        <label>Precio maximo
          <select data-filtro="precioMaximo">
            ${opciones(precios, filtro.precioMaximo, (v) => (v === 0 ? 'Sin tope' : `hasta ${plata(v)}`))}
          </select>
        </label>
      </div>
    </div>
  `;
}

function renderComprar(app: App): string {
  const estado = app.exigirEstado();
  const club = clubPorId(estado, estado.clubUsuarioId);
  const ofertas = listaDePases(estado, filtro);

  const lista =
    ofertas.length === 0
      ? '<p class="suave">Ningun jugador coincide con esos filtros.</p>'
      : ofertas
          .map((o) => {
            const alcanza = club.dinero >= o.precio;
            const procedencia = o.ligaOrigen
              ? `<span class="chip chip--exterior">${esc(o.ligaOrigen)}</span>`
              : esc(clubPorId(estado, o.clubVendedorId!).abrev);
            return `
              <button class="jugador" data-comprar="${esc(o.jugador.id)}"${alcanza ? '' : ' disabled style="opacity:.5"'}>
                <span class="jugador__pos">${o.jugador.pos}</span>
                <span>
                  <span class="jugador__nombre">${esc(o.jugador.nombre)}</span><br />
                  <span class="jugador__datos">${o.jugador.edad} anos · ${procedencia} · ${plata(o.precio)}</span>
                </span>
                <span class="${claseMedia(o.jugador.media)}">${o.jugador.media}</span>
              </button>
            `;
          })
          .join('');

  return `
    ${renderFiltros()}
    <div class="tarjeta">
      <p class="tarjeta__titulo">En venta (${ofertas.length})</p>
      <div class="lista">${lista}</div>
    </div>
  `;
}

function renderVender(app: App): string {
  const estado = app.exigirEstado();
  const plantel = plantelDe(estado, estado.clubUsuarioId).sort((a, b) => b.valor - a.valor);

  const filas = plantel
    .map(
      (j) => `
        <button class="jugador" data-vender="${esc(j.id)}">
          <span class="jugador__pos">${j.pos}</span>
          <span>
            <span class="jugador__nombre">${esc(j.nombre)}</span><br />
            <span class="jugador__datos">${j.edad} anos · salario ${plata(j.salario)}/sem · te pagan ${plata(Math.round(j.valor * 0.85))}</span>
          </span>
          <span class="${claseMedia(j.media)}">${j.media}</span>
        </button>
      `,
    )
    .join('');

  return `<div class="tarjeta"><p class="tarjeta__titulo">Tu plantel</p><div class="lista">${filas}</div></div>`;
}

export function montar(app: App, raiz: HTMLElement): void {
  const estado = app.exigirEstado();

  raiz.querySelectorAll<HTMLElement>('[data-vista]').forEach((nodo) => {
    nodo.addEventListener('click', () => {
      vista = nodo.dataset.vista as Vista;
      app.refrescar();
    });
  });

  raiz.querySelectorAll<HTMLSelectElement>('select[data-filtro]').forEach((nodo) => {
    nodo.addEventListener('change', () => {
      const clave = nodo.dataset.filtro as keyof FiltroMercado;
      const valor = clave === 'mediaMinima' || clave === 'precioMaximo' ? Number(nodo.value) : nodo.value;
      filtro = { ...filtro, [clave]: valor } as FiltroMercado;
      app.refrescar();
    });
  });

  const busqueda = raiz.querySelector<HTMLInputElement>('input[data-filtro="texto"]');
  busqueda?.addEventListener('input', () => {
    filtro = { ...filtro, texto: busqueda.value };
    // Vuelvo a pintar y devuelvo el foco para no cortar la escritura.
    app.refrescar();
    const nuevo = document.querySelector<HTMLInputElement>('input[data-filtro="texto"]');
    nuevo?.focus();
    nuevo?.setSelectionRange(nuevo.value.length, nuevo.value.length);
  });

  raiz.querySelectorAll<HTMLElement>('[data-comprar]').forEach((nodo) => {
    nodo.addEventListener('click', () => {
      app.aviso(comprar(estado, nodo.dataset.comprar!));
      app.guardarPartida();
      app.refrescar();
    });
  });

  raiz.querySelectorAll<HTMLElement>('[data-vender]').forEach((nodo) => {
    nodo.addEventListener('click', () => {
      app.aviso(vender(estado, nodo.dataset.vender!));
      app.guardarPartida();
      app.refrescar();
    });
  });
}
