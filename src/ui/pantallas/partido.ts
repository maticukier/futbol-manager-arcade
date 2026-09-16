import type { App } from '../app';
import { clubPorId, jugadorPorId } from '@/sim/juego';
import { esc, numero, plata } from '../formato';

export function render(app: App): string {
  const estado = app.exigirEstado();
  const resumen = app.ultimoResumen;
  if (!resumen) return '<div class="tarjeta"><p class="suave">No hay ningun partido para mostrar.</p></div>';

  const propio = resumen.partidoUsuario;
  const bloques: string[] = [];

  if (propio && propio.jugado) {
    const local = clubPorId(estado, propio.localId);
    const visitante = clubPorId(estado, propio.visitanteId);
    bloques.push(`
      <div class="tarjeta">
        <p class="tarjeta__titulo">Fecha ${propio.jornada}${propio.arcade ? ' · jugado por vos' : ' · simulado'}</p>
        <div class="fila fila--entre">
          <span style="flex:1;text-align:center">${esc(local.abrev)}</span>
          <span class="marcador-grande">${propio.golesLocal} - ${propio.golesVisitante}</span>
          <span style="flex:1;text-align:center">${esc(visitante.abrev)}</span>
        </div>
      </div>
    `);
  }

  const arcade = app.ultimoArcade;
  if (arcade) {
    const nombres = (ids: string[]) =>
      ids
        .map((id) => jugadorPorId(estado, id)?.nombre)
        .filter(Boolean)
        .join(', ') || '-';

    bloques.push(`
      <div class="tarjeta">
        <p class="tarjeta__titulo">Estadisticas</p>
        ${estadistica('Posesion', `${arcade.posesion.usuario}%`, `${arcade.posesion.rival}%`)}
        ${estadistica('Remates', String(arcade.remates.usuario), String(arcade.remates.rival))}
        <p class="suave" style="font-size:13px;margin-top:10px">
          Tus goles: ${esc(nombres(arcade.goleadoresUsuario))}
        </p>
      </div>
    `);
  }

  if (resumen.copa) {
    const c = resumen.copa;
    bloques.push(`
      <div class="tarjeta" style="border-color:var(--acento-2)">
        <p class="tarjeta__titulo">Copa</p>
        <div class="fila fila--entre">
          <span>vs ${esc(c.rival)}</span>
          <strong>${c.golesPropios} - ${c.golesRival}</strong>
        </div>
        <p class="suave" style="font-size:13px;margin:8px 0 0">
          ${c.porPenales ? 'Se definio por penales. ' : ''}${c.paso ? 'Pasamos de ronda.' : 'Quedamos afuera.'}
          ${c.premio > 0 ? ` Premio: ${plata(c.premio)}.` : ''}
        </p>
      </div>
    `);
  }

  if (resumen.ingresos.length > 0) {
    const filas = resumen.ingresos
      .map(
        (i) => `
          <div class="fila fila--entre" style="padding:5px 0;font-size:13px">
            <span class="suave">${esc(i.concepto)}</span>
            <span style="color:${i.monto >= 0 ? 'var(--acento)' : 'var(--peligro)'}">${plata(i.monto)}</span>
          </div>
        `,
      )
      .join('');

    bloques.push(`
      <div class="tarjeta">
        <p class="tarjeta__titulo">Balance de la semana</p>
        ${resumen.asistencia !== null ? `<p class="suave" style="font-size:13px">Fueron a la cancha ${numero(resumen.asistencia)} personas.</p>` : ''}
        ${filas}
      </div>
    `);
  }

  const otros = resumen.partidos
    .filter((p) => !propio || p.id !== propio.id)
    .map((p) => {
      const local = clubPorId(estado, p.localId);
      const visitante = clubPorId(estado, p.visitanteId);
      return `
        <div class="fila fila--entre" style="padding:7px 0;border-top:1px solid var(--borde);font-size:13px">
          <span style="flex:1">${esc(local.abrev)}</span>
          <span class="chip">${p.golesLocal} - ${p.golesVisitante}</span>
          <span style="flex:1;text-align:right">${esc(visitante.abrev)}</span>
        </div>
      `;
    })
    .join('');

  bloques.push(`<div class="tarjeta"><p class="tarjeta__titulo">Resto de la fecha</p>${otros}</div>`);

  const temporada = app.resumenTemporada;
  if (temporada) {
    bloques.push(`
      <div class="tarjeta" style="border-color:var(--acento-2)">
        <p class="tarjeta__titulo">Fin de temporada</p>
        <h2>${temporada.posicion}º con ${temporada.puntos} puntos</h2>
        <p class="suave">
          ${temporada.cumplioObjetivo ? 'El directorio esta conforme con la campana.' : 'El directorio esperaba mas.'}
          Premio por la posicion: ${plata(temporada.premio)}.
        </p>
        ${
          temporada.despedido
            ? '<p style="color:var(--peligro)"><strong>Te echaron del club.</strong></p>'
            : `<p class="suave">${temporada.juveniles.length} juvenil${temporada.juveniles.length === 1 ? '' : 'es'} de la cantera suben al plantel.</p>`
        }
      </div>
    `);
  }

  bloques.push('<button class="boton boton--primario" data-accion="seguir">Seguir</button>');
  return bloques.join('');
}

function estadistica(etiqueta: string, izquierda: string, derecha: string): string {
  return `
    <div class="fila fila--entre" style="padding:5px 0;font-size:13px">
      <strong style="flex:1">${izquierda}</strong>
      <span class="suave" style="flex:2;text-align:center">${etiqueta}</span>
      <strong style="flex:1;text-align:right">${derecha}</strong>
    </div>
  `;
}

export function montar(app: App, raiz: HTMLElement): void {
  raiz.querySelector<HTMLElement>('[data-accion="seguir"]')?.addEventListener('click', () => {
    app.ultimoArcade = null;
    app.resumenTemporada = null;
    app.ir('club');
  });
}
