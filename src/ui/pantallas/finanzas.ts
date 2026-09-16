import type { App } from '../app';
import { clubPorId } from '@/sim/juego';
import {
  PRECIO_ENTRADA_MAX,
  PRECIO_ENTRADA_MIN,
  aplicarMejora,
  gastoFijo,
  ingresoTv,
  masaSalarial,
  mejorasDisponibles,
  precioEntradaSugerido,
  type MejoraDisponible,
} from '@/sim/finanzas';
import { esc, numero, pesos, plata } from '../formato';

export function render(app: App): string {
  const estado = app.exigirEstado();
  const club = clubPorId(estado, estado.clubUsuarioId);

  const salarios = masaSalarial(club.id, estado.jugadores);
  const tv = ingresoTv(club);
  const mantenimiento = gastoFijo(club);
  const balance = tv + club.sponsorSemanal - salarios - mantenimiento;
  const sugerido = precioEntradaSugerido(club);

  const movimientos = [...estado.finanzas]
    .reverse()
    .slice(0, 8)
    .map(
      (m) => `
        <div class="fila fila--entre" style="padding:7px 0;border-top:1px solid var(--borde);font-size:13px">
          <span class="suave">Sem ${m.semana} · ${esc(m.concepto)}</span>
          <strong style="color:${m.monto >= 0 ? 'var(--acento)' : 'var(--peligro)'}">${plata(m.monto)}</strong>
        </div>
      `,
    )
    .join('');

  return `
    <div class="tarjeta">
      <p class="tarjeta__titulo">Caja</p>
      <div style="font-size:30px;font-weight:800;color:${club.dinero >= 0 ? 'var(--texto)' : 'var(--peligro)'}">
        ${plata(club.dinero)}
      </div>
      <div class="fila fila--entre" style="margin-top:10px;font-size:13px">
        <span class="suave">Balance semanal</span>
        <strong style="color:${balance >= 0 ? 'var(--acento)' : 'var(--peligro)'}">${plata(balance)}</strong>
      </div>
      <div style="margin-top:12px;font-size:13px">
        ${linea('Derechos de TV', tv)}
        ${linea('Sponsor', club.sponsorSemanal)}
        ${linea('Salarios', -salarios)}
        ${linea('Mantenimiento y cantera', -mantenimiento)}
      </div>
    </div>

    <div class="tarjeta">
      <p class="tarjeta__titulo">Precio de la entrada</p>
      <label class="campo">
        Entrada <strong>${pesos(club.precioEntrada)}</strong>
        <input type="range" min="${PRECIO_ENTRADA_MIN}" max="${PRECIO_ENTRADA_MAX}" step="50"
               value="${club.precioEntrada}" data-precio />
        <span style="display:flex;justify-content:space-between;font-size:11px">
          <span>Popular</span><span>Carisima</span>
        </span>
      </label>
      <p class="suave" style="font-size:12.5px">
        Precio de referencia para un club como este: ${pesos(sugerido)}.
        Cobrar de mas llena la caja hoy y vacia la tribuna despues: hoy sos ${numero(club.socios)} socios
        y el estadio entra ${numero(club.estadio.capacidad)}.
      </p>
    </div>

    <div class="tarjeta">
      <p class="tarjeta__titulo">Inversiones</p>
      ${mejorasDisponibles(club).map(renderMejora).join('')}
    </div>

    <div class="tarjeta">
      <p class="tarjeta__titulo">Ultimos movimientos</p>
      ${movimientos || '<p class="suave">Todavia no hay movimientos.</p>'}
    </div>
  `;
}

function linea(concepto: string, monto: number): string {
  return `
    <div class="fila fila--entre" style="padding:4px 0">
      <span class="suave">${concepto}</span>
      <span style="color:${monto >= 0 ? 'var(--acento)' : 'var(--peligro)'}">${plata(monto)}</span>
    </div>
  `;
}

function renderMejora(mejora: MejoraDisponible): string {
  return `
    <div style="padding:11px 0;border-top:1px solid var(--borde)">
      <div class="fila fila--entre">
        <strong style="font-size:14px">${esc(mejora.titulo)}</strong>
        <span class="chip">${plata(mejora.costo)}</span>
      </div>
      <p class="suave" style="font-size:12.5px;margin:6px 0 9px">${esc(mejora.detalle)}</p>
      <button class="boton boton--chico ${mejora.disponible ? 'boton--primario' : ''}"
              data-mejora="${mejora.clave}"${mejora.disponible ? '' : ' disabled'}>Invertir</button>
    </div>
  `;
}

export function montar(app: App, raiz: HTMLElement): void {
  const estado = app.exigirEstado();
  const club = clubPorId(estado, estado.clubUsuarioId);

  const control = raiz.querySelector<HTMLInputElement>('[data-precio]');
  control?.addEventListener('change', () => {
    club.precioEntrada = Number(control.value);
    app.guardarPartida();
    app.refrescar();
  });

  raiz.querySelectorAll<HTMLButtonElement>('[data-mejora]').forEach((nodo) => {
    nodo.addEventListener('click', () => {
      const mensaje = aplicarMejora(estado, nodo.dataset.mejora as MejoraDisponible['clave']);
      if (mensaje) app.aviso(mensaje);
      app.guardarPartida();
      app.refrescar();
    });
  });
}
