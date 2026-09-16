import type { App } from '../app';
import { clubPorId } from '@/sim/juego';
import { calcularTabla, partidosDeJornada, totalJornadas } from '@/sim/liga';
import { JORNADAS_DE_COPA, NOMBRES_DE_RONDA } from '@/sim/copa';
import { esc } from '../formato';

type Vista = 'tabla' | 'fecha' | 'goleadores' | 'copa';
let vista: Vista = 'tabla';
let jornadaVista: number | null = null;
/** null = la division del usuario. */
let divisionVista: 1 | 2 | null = null;

export function render(app: App): string {
  const estado = app.exigirEstado();
  jornadaVista ??= estado.jornadaActual;
  divisionVista ??= clubPorId(estado, estado.clubUsuarioId).division;

  const pestanas = (
    [
      ['tabla', 'Tabla'],
      ['fecha', 'Fecha'],
      ['goleadores', 'Goleadores'],
      ['copa', 'Copa'],
    ] as [Vista, string][]
  )
    .map(
      ([clave, texto]) =>
        `<button class="boton boton--chico ${vista === clave ? 'boton--primario' : 'boton--fantasma'}" data-vista="${clave}">${texto}</button>`,
    )
    .join('');

  const divisiones = ([1, 2] as const)
    .map(
      (d) =>
        `<button class="boton boton--chico ${divisionVista === d ? 'boton--primario' : 'boton--fantasma'}" data-division="${d}">${d === 1 ? 'Primera' : 'Segunda'}</button>`,
    )
    .join('');

  return `
    <div class="fila" style="gap:8px">${pestanas}</div>
    ${vista === 'goleadores' || vista === 'copa' ? '' : `<div class="fila" style="gap:8px">${divisiones}</div>`}
    ${
      vista === 'tabla'
        ? renderTabla(app)
        : vista === 'fecha'
          ? renderFecha(app)
          : vista === 'copa'
            ? renderCopa(app)
            : renderGoleadores(app)
    }
  `;
}

function renderTabla(app: App): string {
  const estado = app.exigirEstado();
  const tabla = calcularTabla(estado.clubs, estado.fixture, divisionVista ?? 1);

  const filas = tabla
    .map((f, i) => {
      const club = clubPorId(estado, f.clubId);
      const zona =
        divisionVista === 1 && i >= tabla.length - 2
          ? ' zona-descenso'
          : divisionVista === 2 && i < 2
            ? ' zona-ascenso'
            : '';
      const propio = `${f.clubId === estado.clubUsuarioId ? ' propio' : ''}${zona}`;
      return `
        <tr class="${propio.trim()}">
          <td>${i + 1}</td>
          <td>${esc(club.abrev)}</td>
          <td>${f.pj}</td>
          <td>${f.g}</td>
          <td>${f.e}</td>
          <td>${f.p}</td>
          <td>${f.dif > 0 ? '+' : ''}${f.dif}</td>
          <td><strong>${f.pts}</strong></td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="tarjeta">
      <table>
        <thead>
          <tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>Dif</th><th>Pts</th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
}

function renderFecha(app: App): string {
  const estado = app.exigirEstado();
  const total = totalJornadas(estado.fixture);
  const jornada = Math.min(total, Math.max(1, jornadaVista ?? 1));
  const partidos = partidosDeJornada(estado.fixture, jornada, divisionVista ?? 1);

  const filas = partidos
    .map((p) => {
      const local = clubPorId(estado, p.localId);
      const visitante = clubPorId(estado, p.visitanteId);
      const propio = p.localId === estado.clubUsuarioId || p.visitanteId === estado.clubUsuarioId;
      const marcador = p.jugado ? `${p.golesLocal} - ${p.golesVisitante}` : 'vs';
      return `
        <div class="fila fila--entre" style="padding:9px 0;border-top:1px solid var(--borde);${propio ? 'font-weight:650' : ''}">
          <span style="flex:1">${esc(local.abrev)}</span>
          <span class="chip">${marcador}${p.arcade ? ' 🎮' : ''}</span>
          <span style="flex:1;text-align:right">${esc(visitante.abrev)}</span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="tarjeta">
      <div class="fila fila--entre" style="margin-bottom:6px">
        <button class="boton boton--chico boton--fantasma" data-jornada="${jornada - 1}"${jornada <= 1 ? ' disabled' : ''}>‹</button>
        <strong>Fecha ${jornada}</strong>
        <button class="boton boton--chico boton--fantasma" data-jornada="${jornada + 1}"${jornada >= total ? ' disabled' : ''}>›</button>
      </div>
      ${filas}
    </div>
  `;
}

function renderGoleadores(app: App): string {
  const estado = app.exigirEstado();
  const goleadores = estado.jugadores
    .filter((j) => j.golesTemporada > 0)
    .sort((a, b) => b.golesTemporada - a.golesTemporada)
    .slice(0, 15);

  if (goleadores.length === 0) {
    return '<div class="tarjeta"><p class="suave">Todavia no se convirtio ningun gol en la temporada.</p></div>';
  }

  const filas = goleadores
    .map((j, i) => {
      const club = j.clubId ? clubPorId(estado, j.clubId) : null;
      const propio = j.clubId === estado.clubUsuarioId ? ' class="propio"' : '';
      return `
        <tr${propio}>
          <td>${i + 1}</td>
          <td>${esc(j.nombre)}</td>
          <td>${club ? esc(club.abrev) : '-'}</td>
          <td><strong>${j.golesTemporada}</strong></td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="tarjeta">
      <table>
        <thead><tr><th>#</th><th>Jugador</th><th>Club</th><th>G</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
}

/** Cuadro de la copa, ronda por ronda. */
function renderCopa(app: App): string {
  const estado = app.exigirEstado();
  const copa = estado.copa;

  if (copa.campeonId) {
    const campeon = clubPorId(estado, copa.campeonId);
    return `
      <div class="tarjeta" style="text-align:center">
        <div style="font-size:42px">🏆</div>
        <h2>${esc(campeon.nombre)}</h2>
        <p class="suave">Campeon de la copa de esta temporada.</p>
      </div>
    `;
  }

  const rondas = [...new Set(copa.llaves.map((k) => k.ronda))].sort((a, b) => b - a);
  if (rondas.length === 0) return '<div class="tarjeta"><p class="suave">Todavia no se sorteo la copa.</p></div>';

  const bloques = rondas
    .map((ronda) => {
      const llaves = copa.llaves.filter((k) => k.ronda === ronda);
      const filas = llaves
        .map((k) => {
          const local = clubPorId(estado, k.localId);
          const visitante = clubPorId(estado, k.visitanteId);
          const propio = k.localId === estado.clubUsuarioId || k.visitanteId === estado.clubUsuarioId;
          const marcador = k.jugado ? `${k.golesLocal} - ${k.golesVisitante}` : 'vs';
          const ganador = k.ganadorId ? clubPorId(estado, k.ganadorId).abrev : null;
          return `
            <div class="fila fila--entre" style="padding:7px 0;border-top:1px solid var(--borde);font-size:13px;${propio ? 'font-weight:650' : ''}">
              <span style="flex:1">${esc(local.abrev)}</span>
              <span class="chip">${marcador}</span>
              <span style="flex:1;text-align:right">${esc(visitante.abrev)}</span>
              ${ganador ? `<span class="chip" style="margin-left:8px">pasa ${esc(ganador)}</span>` : ''}
            </div>
          `;
        })
        .join('');

      return `
        <div class="tarjeta">
          <p class="tarjeta__titulo">${esc(NOMBRES_DE_RONDA[ronda] ?? `Ronda ${ronda + 1}`)}</p>
          ${filas}
        </div>
      `;
    })
    .join('');

  const vivo = copa.vivos.includes(estado.clubUsuarioId);
  return `
    <div class="tarjeta">
      <p class="suave" style="margin:0;font-size:13px">
        ${vivo ? 'Seguis en carrera.' : 'Quedaste eliminado de la copa.'}
        Se juega en las fechas ${JORNADAS_DE_COPA.join(', ')}.
      </p>
    </div>
    ${bloques}
  `;
}

export function montar(app: App, raiz: HTMLElement): void {
  raiz.querySelectorAll<HTMLElement>('[data-vista]').forEach((nodo) => {
    nodo.addEventListener('click', () => {
      vista = nodo.dataset.vista as Vista;
      app.refrescar();
    });
  });

  raiz.querySelectorAll<HTMLElement>('[data-division]').forEach((nodo) => {
    nodo.addEventListener('click', () => {
      divisionVista = Number(nodo.dataset.division) as 1 | 2;
      app.refrescar();
    });
  });

  raiz.querySelectorAll<HTMLButtonElement>('[data-jornada]').forEach((nodo) => {
    nodo.addEventListener('click', () => {
      jornadaVista = Number(nodo.dataset.jornada);
      app.refrescar();
    });
  });
}
