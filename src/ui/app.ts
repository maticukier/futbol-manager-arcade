import type { EstadoJuego } from '@/sim/types';
import { cargar, guardar } from '@/sim/guardado';
import {
  cerrarTemporada,
  clubPorId,
  plantelDe,
  resolverJornada,
  type ResultadoArcade,
  type ResumenJornada,
  type ResumenTemporada,
  partidoDelUsuario,
} from '@/sim/juego';
import { disponible, onceTitular } from '@/sim/liga';
import type { ConfiguracionEquipo, ConfiguracionPartido, ResultadoPartido } from '@/game/match/entidades';
import { esc, escudo, plata } from './formato';

import * as pantallaInicio from './pantallas/inicio';
import * as pantallaClub from './pantallas/club';
import * as pantallaPlantel from './pantallas/plantel';
import * as pantallaTactica from './pantallas/tactica';
import * as pantallaLiga from './pantallas/liga';
import * as pantallaFinanzas from './pantallas/finanzas';
import * as pantallaMercado from './pantallas/mercado';
import * as pantallaPartido from './pantallas/partido';

export type Ruta = 'inicio' | 'club' | 'plantel' | 'tactica' | 'liga' | 'finanzas' | 'mercado' | 'partido';

export interface Pantalla {
  render(app: App): string;
  montar?(app: App, raiz: HTMLElement): void;
}

const PANTALLAS: Record<Ruta, Pantalla> = {
  inicio: pantallaInicio,
  club: pantallaClub,
  plantel: pantallaPlantel,
  tactica: pantallaTactica,
  liga: pantallaLiga,
  finanzas: pantallaFinanzas,
  mercado: pantallaMercado,
  partido: pantallaPartido,
};

const NAV: { ruta: Ruta; icono: string; texto: string }[] = [
  { ruta: 'club', icono: '🏟️', texto: 'Club' },
  { ruta: 'plantel', icono: '👥', texto: 'Plantel' },
  { ruta: 'tactica', icono: '📋', texto: 'Tactica' },
  { ruta: 'liga', icono: '🏆', texto: 'Liga' },
  { ruta: 'finanzas', icono: '💰', texto: 'Caja' },
];

export class App {
  estado: EstadoJuego | null = null;
  ruta: Ruta = 'inicio';

  /** Datos que la pantalla de partido necesita mostrar despues de jugar. */
  ultimoResumen: ResumenJornada | null = null;
  ultimoArcade: ResultadoPartido | null = null;
  resumenTemporada: ResumenTemporada | null = null;

  private raiz: HTMLElement;
  private contenedorPartido: HTMLElement;
  private temporizadorAviso: number | null = null;

  constructor(raiz: HTMLElement, contenedorPartido: HTMLElement) {
    this.raiz = raiz;
    this.contenedorPartido = contenedorPartido;

    const guardada = cargar();
    if (guardada) {
      this.estado = guardada;
      this.ruta = 'club';
    }
  }

  // ------------------------------------------------------------- navegacion

  ir(ruta: Ruta): void {
    this.ruta = ruta;
    this.refrescar();
    window.scrollTo({ top: 0 });
  }

  refrescar(): void {
    const pantalla = PANTALLAS[this.ruta];
    const conChrome = this.ruta !== 'inicio' && this.estado !== null;

    this.raiz.innerHTML = `
      ${conChrome ? this.renderBarra() : ''}
      <main>${pantalla.render(this)}</main>
      ${conChrome ? this.renderNav() : ''}
    `;

    if (conChrome) {
      this.raiz.querySelectorAll<HTMLButtonElement>('nav button[data-ruta]').forEach((boton) => {
        boton.addEventListener('click', () => this.ir(boton.dataset.ruta as Ruta));
      });
    }

    const main = this.raiz.querySelector('main');
    if (main && pantalla.montar) pantalla.montar(this, main as HTMLElement);
  }

  private renderBarra(): string {
    const estado = this.exigirEstado();
    const club = clubPorId(estado, estado.clubUsuarioId);
    return `
      <header class="barra">
        ${escudo(club)}
        <div>
          <div class="barra__club">${esc(club.nombre)}</div>
          <div class="barra__meta">Temporada ${estado.temporada} · Fecha ${estado.jornadaActual}</div>
        </div>
        <div class="barra__caja">
          <strong>${plata(club.dinero)}</strong>
          <span>en caja</span>
        </div>
      </header>
    `;
  }

  private renderNav(): string {
    const botones = NAV.map(
      (item) => `
        <button data-ruta="${item.ruta}" class="${this.ruta === item.ruta ? 'activo' : ''}">
          <span class="icono">${item.icono}</span>
          <span>${item.texto}</span>
        </button>
      `,
    ).join('');
    return `<nav>${botones}</nav>`;
  }

  aviso(texto: string): void {
    document.querySelector('.aviso')?.remove();
    const nodo = document.createElement('div');
    nodo.className = 'aviso';
    nodo.textContent = texto;
    document.body.appendChild(nodo);
    if (this.temporizadorAviso) window.clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = window.setTimeout(() => nodo.remove(), 2600);
  }

  // ------------------------------------------------------------- partida

  exigirEstado(): EstadoJuego {
    if (!this.estado) throw new Error('No hay partida en curso');
    return this.estado;
  }

  guardarPartida(): void {
    if (this.estado) guardar(this.estado);
  }

  // --------------------------------------------------------------- partido

  /** Simula la fecha completa sin jugar el partido del usuario. */
  simularFecha(): void {
    const estado = this.exigirEstado();
    this.ultimoArcade = null;
    this.ultimoResumen = resolverJornada(estado, null);
    this.despuesDeLaFecha();
  }

  async jugarFecha(): Promise<void> {
    const estado = this.exigirEstado();
    const partido = partidoDelUsuario(estado);
    if (!partido) {
      this.aviso('No hay partido para esta fecha.');
      return;
    }

    const usuarioEsLocal = partido.localId === estado.clubUsuarioId;
    const rivalId = usuarioEsLocal ? partido.visitanteId : partido.localId;

    const config: ConfiguracionPartido = {
      usuario: this.configurarEquipo(estado.clubUsuarioId, 'usuario'),
      rival: this.configurarEquipo(rivalId, 'rival'),
      usuarioEsLocal,
      estadio: clubPorId(estado, partido.localId).estadio.nombre,
    };

    this.contenedorPartido.hidden = false;
    document.body.style.overflow = 'hidden';

    // Phaser se carga recien cuando hace falta: la parte de gestion arranca liviana.
    const { jugarPartidoArcade } = await import('@/game/iniciarPartido');
    const resultado = await jugarPartidoArcade(this.contenedorPartido, config);

    this.contenedorPartido.hidden = true;
    document.body.style.overflow = '';

    if (!resultado) {
      this.aviso('Partido abandonado. Se juega cuando quieras.');
      this.refrescar();
      return;
    }

    const tarjetas = {
      amonestados: resultado.amonestados,
      expulsados: resultado.expulsados,
    };

    const arcade: ResultadoArcade = usuarioEsLocal
      ? {
          golesLocal: resultado.golesUsuario,
          golesVisitante: resultado.golesRival,
          goleadoresLocal: resultado.goleadoresUsuario,
          goleadoresVisitante: resultado.goleadoresRival,
          ...tarjetas,
        }
      : {
          golesLocal: resultado.golesRival,
          golesVisitante: resultado.golesUsuario,
          goleadoresLocal: resultado.goleadoresRival,
          goleadoresVisitante: resultado.goleadoresUsuario,
          ...tarjetas,
        };

    this.ultimoArcade = resultado;
    this.ultimoResumen = resolverJornada(estado, arcade);
    this.despuesDeLaFecha();
  }

  private despuesDeLaFecha(): void {
    const estado = this.exigirEstado();
    this.resumenTemporada = null;

    if (this.ultimoResumen?.temporadaTerminada) {
      this.resumenTemporada = cerrarTemporada(estado);
    }

    this.guardarPartida();
    this.ir('partido');
  }

  private configurarEquipo(clubId: string, bando: 'usuario' | 'rival'): ConfiguracionEquipo {
    const estado = this.exigirEstado();
    const club = clubPorId(estado, clubId);
    const plantel = plantelDe(estado, clubId);
    const once = onceTitular(club, plantel);
    const titulares = new Set(once.map((j) => j.id));

    const aFicha = (j: (typeof plantel)[number]) => ({
      id: j.id,
      nombre: j.nombre,
      attrs: j.attrs,
      pos: j.pos,
      media: j.media,
      forma: j.forma,
    });

    return {
      bando,
      nombre: club.nombre,
      abrev: club.abrev,
      colorPrimario: club.colorPrimario,
      colorSecundario: club.colorSecundario,
      tacticas: club.tacticas,
      jugadores: once.map(aFicha),
      // Al banco van los que estan disponibles y no son titulares.
      suplentes: plantel
        .filter((j) => !titulares.has(j.id) && disponible(j))
        .sort((a, b) => b.media - a.media)
        .slice(0, 9)
        .map(aFicha),
    };
  }
}
