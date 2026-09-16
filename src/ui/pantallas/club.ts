import type { App } from '../app';
import { clubPorId, partidoDeCopaDelUsuario, partidoDelUsuario, plantelDe } from '@/sim/juego';
import { NOMBRES_DE_RONDA } from '@/sim/copa';
import { calcularTabla, posicionEnTabla, totalJornadas } from '@/sim/liga';
import { borrar } from '@/sim/guardado';
import { esc, escudo, numero, pesos } from '../formato';

export function render(app: App): string {
  const estado = app.exigirEstado();

  if (estado.despedido) return renderDespedido(app);

  const club = clubPorId(estado, estado.clubUsuarioId);
  const partido = partidoDelUsuario(estado);
  const tabla = calcularTabla(estado.clubs, estado.fixture, club.division);
  const posicion = posicionEnTabla(tabla, club.id);
  const fila = tabla.find((f) => f.clubId === club.id);
  const plantel = plantelDe(estado, club.id);
  const lesionados = plantel.filter((j) => j.lesionSemanas > 0).length;

  return `
    ${partido ? renderProximoPartido(app, partido.localId, partido.visitanteId, partido.localId === club.id) : ''}
    ${renderCopa(app)}

    <div class="grilla-2">
      <div class="tarjeta">
        <p class="tarjeta__titulo">Posicion</p>
        <div style="font-size:26px;font-weight:800">${posicion}º</div>
        <div class="suave" style="font-size:12px">${fila?.pts ?? 0} pts · ${club.division === 1 ? 'primera' : 'segunda'} · fecha ${estado.jornadaActual} de ${totalJornadas(estado.fixture)}</div>
      </div>
      <div class="tarjeta">
        <p class="tarjeta__titulo">Plantel</p>
        <div style="font-size:26px;font-weight:800">${plantel.length}</div>
        <div class="suave" style="font-size:12px">${lesionados} lesionado${lesionados === 1 ? '' : 's'}</div>
      </div>
    </div>

    <div class="tarjeta">
      <p class="tarjeta__titulo">Directorio</p>
      <div class="fila fila--entre" style="margin-bottom:8px">
        <span>Confianza</span>
        <strong>${Math.round(estado.directorio.confianza)}%</strong>
      </div>
      <div class="barra-progreso"><i style="width:${Math.round(estado.directorio.confianza)}%;background:${colorConfianza(estado.directorio.confianza)}"></i></div>
      <p class="suave" style="margin-top:10px;font-size:13px">
        Objetivo de la temporada: terminar entre los primeros ${estado.directorio.expectativaPosicion}.
        Socios: ${numero(club.socios)}. Entrada: ${pesos(club.precioEntrada)}.
      </p>
    </div>

    ${renderBandeja(app)}

    <button class="boton boton--fantasma" data-accion="mercado">Ir al mercado de pases</button>
    <button class="boton boton--fantasma" data-accion="abandonar">Abandonar carrera</button>
  `;
}

function colorConfianza(valor: number): string {
  if (valor >= 60) return '#2ecc71';
  if (valor >= 30) return '#f1c40f';
  return '#e74c3c';
}

function renderProximoPartido(app: App, localId: string, visitanteId: string, esLocal: boolean): string {
  const estado = app.exigirEstado();
  const local = clubPorId(estado, localId);
  const visitante = clubPorId(estado, visitanteId);

  return `
    <div class="tarjeta">
      <p class="tarjeta__titulo">Fecha ${estado.jornadaActual} · ${esLocal ? 'De local' : 'De visitante'}</p>
      <div class="fila fila--entre" style="margin-bottom:14px">
        ${escudo(local)}
        <div style="text-align:center;flex:1">
          <div style="font-weight:650;font-size:14px">${esc(local.abrev)} vs ${esc(visitante.abrev)}</div>
          <div class="suave" style="font-size:12px">${esc(local.estadio.nombre)}</div>
        </div>
        ${escudo(visitante)}
      </div>
      <button class="boton boton--primario" data-accion="jugar">Jugar el partido</button>
      <button class="boton boton--fantasma" style="margin-top:8px" data-accion="simular">Simular la fecha</button>
    </div>
  `;
}

/** La llave de copa de esta fecha, cuando toca. */
function renderCopa(app: App): string {
  const estado = app.exigirEstado();
  const llave = partidoDeCopaDelUsuario(estado);
  if (!llave) return '';

  const local = clubPorId(estado, llave.localId);
  const visitante = clubPorId(estado, llave.visitanteId);
  const esLocal = llave.localId === estado.clubUsuarioId;

  return `
    <div class="tarjeta" style="border-color:var(--acento-2)">
      <p class="tarjeta__titulo">Copa · ${esc(NOMBRES_DE_RONDA[llave.ronda] ?? 'Ronda')} · ${esLocal ? 'de local' : 'de visitante'}</p>
      <div class="fila fila--entre" style="margin-bottom:12px">
        ${escudo(local)}
        <div style="text-align:center;flex:1">
          <div style="font-weight:650;font-size:14px">${esc(local.abrev)} vs ${esc(visitante.abrev)}</div>
          <div class="suave" style="font-size:12px">Eliminacion directa</div>
        </div>
        ${escudo(visitante)}
      </div>
      <button class="boton" data-accion="jugar-copa">Jugar la copa en vez de la liga</button>
      <p class="suave" style="font-size:12px;margin:8px 0 0">
        Si jugas uno, el otro se simula. Las dos cosas pasan en la misma fecha.
      </p>
    </div>
  `;
}

function renderBandeja(app: App): string {
  const estado = app.exigirEstado();
  const mensajes = estado.bandeja.slice(0, 4);
  if (mensajes.length === 0) return '';

  const items = mensajes
    .map(
      (m) => `
        <div class="mensaje">
          <h4>${esc(m.titulo)}</h4>
          <span class="suave">${esc(m.cuerpo)}</span>
        </div>
      `,
    )
    .join('');

  return `
    <div class="tarjeta">
      <p class="tarjeta__titulo">Novedades</p>
      ${items}
    </div>
  `;
}

function renderDespedido(app: App): string {
  const estado = app.exigirEstado();
  const club = clubPorId(estado, estado.clubUsuarioId);
  const ultima = estado.historial[estado.historial.length - 1];

  return `
    <div class="tarjeta" style="text-align:center">
      <div style="font-size:48px">📄</div>
      <h1>Te echaron</h1>
      <p class="suave">
        ${esc(club.nombre)} decidio terminar el ciclo despues de la temporada ${estado.temporada}${
          ultima ? `, con el equipo ${ultima.posicion}º y ${ultima.pts} puntos` : ''
        }.
      </p>
      <button class="boton boton--primario" style="margin-top:12px" data-accion="reiniciar">Empezar de nuevo</button>
    </div>
  `;
}

export function montar(app: App, raiz: HTMLElement): void {
  raiz.querySelectorAll<HTMLElement>('[data-accion]').forEach((nodo) => {
    nodo.addEventListener('click', () => {
      const accion = nodo.dataset.accion;
      if (accion === 'jugar') {
        void app.jugarFecha('liga');
      } else if (accion === 'jugar-copa') {
        void app.jugarFecha('copa');
      } else if (accion === 'simular') {
        app.simularFecha();
      } else if (accion === 'mercado') {
        app.ir('mercado');
      } else if (accion === 'abandonar' || accion === 'reiniciar') {
        if (accion === 'abandonar' && !window.confirm('Se borra la partida guardada. Seguro?')) return;
        borrar();
        app.estado = null;
        app.ir('inicio');
      }
    });
  });
}
