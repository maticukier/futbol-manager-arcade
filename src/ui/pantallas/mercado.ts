import type { App } from '../app';
import { clubPorId, plantelDe } from '@/sim/juego';
import { comprar, listaDePases, vender } from '@/sim/mercado';
import { claseMedia, esc, plata } from '../formato';

type Vista = 'comprar' | 'vender';
let vista: Vista = 'comprar';

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

  const cuerpo = vista === 'comprar' ? renderComprar(app) : renderVender(app);

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
    ${cuerpo}
  `;
}

function renderComprar(app: App): string {
  const estado = app.exigirEstado();
  const club = clubPorId(estado, estado.clubUsuarioId);
  const ofertas = listaDePases(estado);

  if (ofertas.length === 0) {
    return '<div class="tarjeta"><p class="suave">No hay jugadores en el mercado esta fecha.</p></div>';
  }

  const filas = ofertas
    .map((o) => {
      const alcanza = club.dinero >= o.precio;
      const vendedor = o.clubVendedorId ? clubPorId(estado, o.clubVendedorId).abrev : 'Libre';
      return `
        <button class="jugador" data-comprar="${esc(o.jugador.id)}"${alcanza ? '' : ' disabled style="opacity:.5"'}>
          <span class="jugador__pos">${o.jugador.pos}</span>
          <span>
            <span class="jugador__nombre">${esc(o.jugador.nombre)}</span><br />
            <span class="jugador__datos">${o.jugador.edad} anos · ${esc(vendedor)} · ${plata(o.precio)}</span>
          </span>
          <span class="${claseMedia(o.jugador.media)}">${o.jugador.media}</span>
        </button>
      `;
    })
    .join('');

  return `<div class="tarjeta"><p class="tarjeta__titulo">En venta</p><div class="lista">${filas}</div></div>`;
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
