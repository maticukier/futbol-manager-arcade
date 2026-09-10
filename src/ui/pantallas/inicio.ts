import type { App } from '../app';
import { CLUBES_LIGA } from '@/sim/nombres';
import { nuevaPartida } from '@/sim/juego';
import { borrar, hayPartidaGuardada } from '@/sim/guardado';
import { esc, numero } from '../formato';

let eligiendoClub = false;

export function render(app: App): string {
  if (eligiendoClub) return renderEleccion();

  const hayGuardada = hayPartidaGuardada() || app.estado !== null;

  return `
    <div style="text-align:center;padding:28px 0 8px">
      <div style="font-size:56px;line-height:1">⚽</div>
      <h1>Futbol Manager Arcade</h1>
      <p class="suave">Dirigi el equipo, jugala vos y manejale la caja al club.</p>
    </div>

    <div class="tarjeta">
      <p class="tarjeta__titulo">Como funciona</p>
      <p><strong>Cancha.</strong> Jugas cada fecha en modo arcade con joystick, pase y tiro.</p>
      <p><strong>Vestuario.</strong> Elegis el once, la formacion y la actitud del equipo.</p>
      <p><strong>Despacho.</strong> Precio de la entrada, estadio, cantera y pases: la plata es tuya.</p>
    </div>

    <button class="boton boton--primario" data-accion="nueva">Empezar carrera</button>
    ${hayGuardada ? '<button class="boton" data-accion="continuar">Continuar partida</button>' : ''}
    ${hayGuardada ? '<button class="boton boton--fantasma" data-accion="borrar">Borrar partida guardada</button>' : ''}
  `;
}

function renderEleccion(): string {
  const tarjetas = CLUBES_LIGA.map((club, i) => {
    const dificultad = club.reputacion >= 70 ? 'Facil' : club.reputacion >= 50 ? 'Normal' : 'Dificil';
    return `
      <button class="jugador" data-club="${i}">
        <span class="escudo" style="background:${esc(club.colorPrimario)};color:${esc(club.colorSecundario)}">${esc(club.abrev)}</span>
        <span>
          <span class="jugador__nombre">${esc(club.nombre)}</span><br />
          <span class="jugador__datos">${esc(club.estadio)} · ${numero(club.capacidad)} lugares · ${dificultad}</span>
        </span>
        <span class="media">${club.reputacion}</span>
      </button>
    `;
  }).join('');

  return `
    <h1>Elegi tu club</h1>
    <p class="suave">Cuanto mas chico el club, mas dificil la carrera: menos plata, peor plantel y un directorio mas impaciente.</p>
    <div class="elegir-club">${tarjetas}</div>
    <button class="boton boton--fantasma" data-accion="volver">Volver</button>
  `;
}

export function montar(app: App, raiz: HTMLElement): void {
  raiz.querySelectorAll<HTMLElement>('[data-accion]').forEach((nodo) => {
    nodo.addEventListener('click', () => {
      const accion = nodo.dataset.accion;
      if (accion === 'nueva') {
        eligiendoClub = true;
        app.refrescar();
      } else if (accion === 'continuar') {
        app.ir('club');
      } else if (accion === 'borrar') {
        borrar();
        app.estado = null;
        app.aviso('Partida borrada.');
        app.refrescar();
      } else if (accion === 'volver') {
        eligiendoClub = false;
        app.refrescar();
      }
    });
  });

  raiz.querySelectorAll<HTMLElement>('[data-club]').forEach((nodo) => {
    nodo.addEventListener('click', () => {
      const indice = Number(nodo.dataset.club);
      app.estado = nuevaPartida(indice);
      app.guardarPartida();
      eligiendoClub = false;
      app.ir('club');
    });
  });
}
