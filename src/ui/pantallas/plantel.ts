import type { App } from '../app';
import type { Jugador } from '@/sim/types';
import { clubPorId, plantelDe } from '@/sim/juego';
import { carreraDe } from '@/sim/historial';
import { onceTitular } from '@/sim/liga';
import { FORMACIONES, ajustePorPuesto } from '@/sim/tacticas';
import { SEMANAS_AVISO, primaDeRenovacion, renovarContrato, salarioPedido } from '@/sim/contratos';
import { chipsDeRasgos, claseMedia, claseNota, esc, estadoJugador, pistaDeRasgoOculto, plata } from '../formato';

let seleccionado: string | null = null;
let orden: 'media' | 'pos' | 'edad' = 'media';

export function render(app: App): string {
  const estado = app.exigirEstado();
  const club = clubPorId(estado, estado.clubUsuarioId);
  const plantel = plantelDe(estado, club.id);

  // Normalizo el once por si quedo invalido (ventas, lesiones, temporada nueva).
  const once = onceTitular(club, plantel);
  club.titulares = once.map((j) => j.id);

  const ranuras = FORMACIONES[club.tacticas.formacion];
  const idsTitulares = new Set(club.titulares);
  const suplentes = plantel.filter((j) => !idsTitulares.has(j.id));
  ordenar(suplentes);

  // La carrera se abre pegada a la fila del que tocaste: si fuera una tarjeta
  // al final de la pantalla, quedaria a dos mil pixeles de donde estas mirando.
  const conCarrera = (j: Jugador, fila: string) =>
    seleccionado === j.id ? fila + renderCarrera(estado, j) : fila;

  const filasTitulares = once
    .map((j, i) => {
      const ranura = ranuras[i];
      const ajuste = ajustePorPuesto(j.pos, ranura.pos);
      const nota = ajuste < 1 ? ` · fuera de puesto (-${Math.round((1 - ajuste) * 100)}%)` : '';
      return conCarrera(j, filaSeleccionable(j, `${ranura.rol}${nota}`, true));
    })
    .join('');

  const filasSuplentes = suplentes
    .map((j) => conCarrera(j, filaSeleccionable(j, estadoJugador(j), false)))
    .join('');

  return `
    <div class="tarjeta">
      <div class="fila fila--entre">
        <h2 style="margin:0">Once titular</h2>
        <span class="chip">${club.tacticas.formacion}</span>
      </div>
      <p class="suave" style="font-size:12.5px;margin:8px 0 12px">
        Toca un titular y despues otro jugador para cambiarlos de lugar.
      </p>
      <div class="lista">${filasTitulares}</div>
    </div>

    <div class="tarjeta">
      <div class="fila fila--entre" style="margin-bottom:10px">
        <h2 style="margin:0">Suplentes (${suplentes.length})</h2>
        <select data-orden style="width:auto;margin:0">
          <option value="media"${orden === 'media' ? ' selected' : ''}>Por media</option>
          <option value="pos"${orden === 'pos' ? ' selected' : ''}>Por puesto</option>
          <option value="edad"${orden === 'edad' ? ' selected' : ''}>Por edad</option>
        </select>
      </div>
      <div class="lista">${filasSuplentes || '<p class="suave">No hay suplentes disponibles.</p>'}</div>
    </div>

    ${renderContratos(plantel)}

    <button class="boton boton--fantasma" data-accion="auto">Alinear el mejor once automatico</button>
    <button class="boton boton--fantasma" data-accion="mercado">Mercado de pases</button>
  `;
}

/**
 * La carrera del jugador que esta seleccionado, temporada por temporada.
 *
 * Es el lugar donde el plantel deja de ser una lista de medias: aca se ve de
 * donde viene cada uno, con que edad jugo cada ano y como le fue.
 */
function renderCarrera(estado: ReturnType<App['exigirEstado']>, j: Jugador): string {
  const carrera = carreraDe(j);
  if (j.historial.length === 0) {
    return `
      <div class="carrera">
        <p class="suave" style="font-size:12px;margin:0">
          Todavia no cerro ninguna temporada. Su historia empieza ahora.
        </p>
      </div>
    `;
  }

  const filas = [...j.historial]
    .reverse()
    .map((t) => {
      const club = t.clubId ? clubPorId(estado, t.clubId).abrev : 'Libre';
      return `
        <div class="fila fila--entre" style="padding:6px 0;border-top:1px solid var(--borde)">
          <span style="flex:1;min-width:0">
            <strong style="font-size:12.5px">T${t.temporada} · ${esc(club)}</strong>
            <br /><span class="jugador__datos">
              ${t.edad} anos · ${t.partidos} PJ · ${t.goles}g ${t.asistencias}a · media ${t.media}
            </span>
          </span>
          <span class="${claseNota(t.nota)}">${t.nota.toFixed(1)}</span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="carrera">
      <p class="carrera__total">
        ${carrera.partidos} partidos · ${carrera.goles} goles · ${carrera.asistencias} asistencias
        · nota ${carrera.nota} · ${carrera.clubes} ${carrera.clubes === 1 ? 'club' : 'clubes'}
      </p>
      ${filas}
    </div>
  `;
}

/** Los contratos que se estan por vencer, para renovarlos a tiempo. */
function renderContratos(plantel: Jugador[]): string {
  const porVencer = plantel
    .filter((j) => j.contratoSemanas <= SEMANAS_AVISO)
    .sort((a, b) => a.contratoSemanas - b.contratoSemanas);

  if (porVencer.length === 0) return '';

  const filas = porVencer
    .map(
      (j) => `
        <div style="padding:9px 0;border-top:1px solid var(--borde)">
          <div class="fila fila--entre">
            <strong style="font-size:13.5px">${esc(j.nombre)}</strong>
            <span class="chip" style="${j.contratoSemanas <= 10 ? 'background:#7f2a22;color:#fff' : ''}">
              ${j.contratoSemanas} ${j.contratoSemanas === 1 ? 'semana' : 'semanas'}
            </span>
          </div>
          <p class="suave" style="font-size:12px;margin:5px 0 8px">
            Pide ${plata(salarioPedido(j))} por semana y ${plata(primaDeRenovacion(j))} de prima.
          </p>
          <button class="boton boton--chico boton--primario" data-renovar="${esc(j.id)}">Renovar</button>
        </div>
      `,
    )
    .join('');

  return `
    <div class="tarjeta" style="border-color:var(--acento-2)">
      <p class="tarjeta__titulo">Contratos por vencer</p>
      <p class="suave" style="font-size:12.5px;margin:0">
        Si llegan a cero se van libres y no entra un peso.
      </p>
      ${filas}
    </div>
  `;
}

function ordenar(jugadores: Jugador[]): void {
  const puestos = { ARQ: 0, DEF: 1, MED: 2, DEL: 3 };
  if (orden === 'media') jugadores.sort((a, b) => b.media - a.media);
  else if (orden === 'edad') jugadores.sort((a, b) => a.edad - b.edad);
  else jugadores.sort((a, b) => puestos[a.pos] - puestos[b.pos] || b.media - a.media);
}

function filaSeleccionable(j: Jugador, detalle: string, titular: boolean): string {
  const clases = ['jugador'];
  if (titular) clases.push('jugador--titular');
  if (j.lesionSemanas > 0) clases.push('jugador--lesionado');
  const resaltado = seleccionado === j.id ? 'outline:2px solid var(--acento-2);' : '';

  const rasgos = chipsDeRasgos(j);
  const pista = pistaDeRasgoOculto(j);
  const carrera = carreraDe(j);
  const trayectoria =
    carrera.temporadas > 0
      ? `${carrera.temporadas} ${carrera.temporadas === 1 ? 'temporada' : 'temporadas'} · ${carrera.goles} ${carrera.goles === 1 ? 'gol' : 'goles'} · nota ${carrera.nota}`
      : '';

  return `
    <button class="${clases.join(' ')}" style="${resaltado}" data-jugador="${esc(j.id)}">
      <span class="jugador__pos">${j.pos}</span>
      <span>
        <span class="jugador__nombre">${esc(j.nombre)}</span><br />
        <span class="jugador__datos">${esc(detalle)} · ${plata(j.valor)}</span>
        ${trayectoria ? `<br /><span class="jugador__datos">${esc(trayectoria)}</span>` : ''}
        ${rasgos || pista ? `<br />${rasgos}${pista}` : ''}
      </span>
      <span class="${claseMedia(j.media)}">${j.media}</span>
    </button>
  `;
}

export function montar(app: App, raiz: HTMLElement): void {
  const estado = app.exigirEstado();
  const club = clubPorId(estado, estado.clubUsuarioId);

  raiz.querySelectorAll<HTMLElement>('[data-jugador]').forEach((nodo) => {
    nodo.addEventListener('click', () => {
      const id = nodo.dataset.jugador!;
      if (!seleccionado) {
        seleccionado = id;
        app.refrescar();
        return;
      }
      if (seleccionado === id) {
        seleccionado = null;
        app.refrescar();
        return;
      }

      const titulares = club.titulares;
      const indiceA = titulares.indexOf(seleccionado);
      const indiceB = titulares.indexOf(id);

      if (indiceA >= 0 && indiceB >= 0) {
        [titulares[indiceA], titulares[indiceB]] = [titulares[indiceB], titulares[indiceA]];
      } else if (indiceA >= 0) {
        titulares[indiceA] = id;
      } else if (indiceB >= 0) {
        titulares[indiceB] = seleccionado;
      }

      seleccionado = null;
      app.guardarPartida();
      app.refrescar();
    });
  });

  raiz.querySelector<HTMLSelectElement>('[data-orden]')?.addEventListener('change', (evento) => {
    orden = (evento.target as HTMLSelectElement).value as typeof orden;
    app.refrescar();
  });

  raiz.querySelectorAll<HTMLElement>('[data-renovar]').forEach((nodo) => {
    nodo.addEventListener('click', (evento) => {
      evento.stopPropagation();
      app.aviso(renovarContrato(estado, nodo.dataset.renovar!));
      app.guardarPartida();
      app.refrescar();
    });
  });

  raiz.querySelectorAll<HTMLElement>('[data-accion]').forEach((nodo) => {
    nodo.addEventListener('click', () => {
      if (nodo.dataset.accion === 'auto') {
        club.titulares = [];
        seleccionado = null;
        app.guardarPartida();
        app.aviso('Once armado automaticamente.');
        app.refrescar();
      } else if (nodo.dataset.accion === 'mercado') {
        app.ir('mercado');
      }
    });
  });
}
