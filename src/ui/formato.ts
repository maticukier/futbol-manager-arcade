import type { Club, Jugador } from '@/sim/types';

export function plata(monto: number): string {
  const signo = monto < 0 ? '-' : '';
  const n = Math.abs(monto);
  if (n >= 1_000_000) return `${signo}$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)} M`;
  if (n >= 1_000) return `${signo}$${Math.round(n / 1_000)} k`;
  return `${signo}$${Math.round(n)}`;
}

/** Monto exacto, para cifras chicas donde el formato compacto no sirve. */
export function pesos(monto: number): string {
  return `$${Math.round(monto).toLocaleString('es-AR')}`;
}

export function numero(n: number): string {
  return Math.round(n).toLocaleString('es-AR');
}

export function claseMedia(media: number): string {
  if (media >= 75) return 'media media--alta';
  if (media >= 62) return 'media media--media';
  if (media >= 50) return 'media';
  return 'media media--baja';
}

/** Escapa texto que viene de datos generados, por las dudas. */
export function esc(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escudo(club: Club): string {
  return `<div class="escudo" style="background:${esc(club.colorPrimario)};color:${esc(club.colorSecundario)}">${esc(club.abrev)}</div>`;
}

export function estadoJugador(j: Jugador): string {
  if (j.lesionSemanas > 0) {
    return `Lesionado · ${j.lesionSemanas} ${j.lesionSemanas === 1 ? 'semana' : 'semanas'}`;
  }
  return `${j.edad} anos · forma ${Math.round(j.forma)} · moral ${Math.round(j.moral)}`;
}

export function filaJugador(j: Jugador, opciones: { titular?: boolean; extra?: string; accion?: string } = {}): string {
  const clases = ['jugador'];
  if (opciones.titular) clases.push('jugador--titular');
  if (j.lesionSemanas > 0) clases.push('jugador--lesionado');

  return `
    <button class="${clases.join(' ')}" data-jugador="${esc(j.id)}"${opciones.accion ? ` data-accion="${opciones.accion}"` : ''}>
      <span class="jugador__pos">${j.pos}</span>
      <span>
        <span class="jugador__nombre">${esc(j.nombre)}</span><br />
        <span class="jugador__datos">${opciones.extra ?? estadoJugador(j)}</span>
      </span>
      <span class="${claseMedia(j.media)}">${j.media}</span>
    </button>
  `;
}
