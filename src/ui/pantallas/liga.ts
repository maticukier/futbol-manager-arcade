import type { App } from '../app';
import { clubPorId } from '@/sim/juego';
import { calcularTabla, partidosDeJornada, totalJornadas } from '@/sim/liga';
import { esc } from '../formato';

type Vista = 'tabla' | 'fecha' | 'goleadores';
let vista: Vista = 'tabla';
let jornadaVista: number | null = null;

export function render(app: App): string {
  const estado = app.exigirEstado();
  jornadaVista ??= estado.jornadaActual;

  const pestanas = (
    [
      ['tabla', 'Tabla'],
      ['fecha', 'Fecha'],
      ['goleadores', 'Goleadores'],
    ] as [Vista, string][]
  )
    .map(
      ([clave, texto]) =>
        `<button class="boton boton--chico ${vista === clave ? 'boton--primario' : 'boton--fantasma'}" data-vista="${clave}">${texto}</button>`,
    )
    .join('');

  return `
    <div class="fila" style="gap:8px">${pestanas}</div>
    ${vista === 'tabla' ? renderTabla(app) : vista === 'fecha' ? renderFecha(app) : renderGoleadores(app)}
  `;
}

function renderTabla(app: App): string {
  const estado = app.exigirEstado();
  const tabla = calcularTabla(estado.clubs, estado.fixture);

  const filas = tabla
    .map((f, i) => {
      const club = clubPorId(estado, f.clubId);
      const propio = f.clubId === estado.clubUsuarioId ? ' class="propio"' : '';
      return `
        <tr${propio}>
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
  const partidos = partidosDeJornada(estado.fixture, jornada);

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

export function montar(app: App, raiz: HTMLElement): void {
  raiz.querySelectorAll<HTMLElement>('[data-vista]').forEach((nodo) => {
    nodo.addEventListener('click', () => {
      vista = nodo.dataset.vista as Vista;
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
