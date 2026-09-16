import type { App } from '../app';
import type { Formacion } from '@/sim/types';
import { clubPorId, plantelDe } from '@/sim/juego';
import { FORMACIONES } from '@/sim/tacticas';
import { fuerzaEquipo, onceTitular } from '@/sim/liga';
import { esc } from '../formato';

const DESCRIPCIONES: Record<Formacion, string> = {
  '4-4-2': 'Equilibrio clasico: dos puntas y lineas ordenadas.',
  '4-3-3': 'Ataque por afuera con dos extremos abiertos.',
  '3-5-2': 'Mucha gente en el medio y carrileros que van y vienen.',
  '5-3-2': 'Defensiva: cinco atras y salida de contra.',
  '4-2-3-1': 'Doble cinco de contencion y un enganche libre.',
};

export function render(app: App): string {
  const estado = app.exigirEstado();
  const club = clubPorId(estado, estado.clubUsuarioId);
  const t = club.tacticas;
  const fuerza = fuerzaEquipo(club, estado.jugadores);
  const once = onceTitular(club, plantelDe(estado, club.id));

  const opciones = (Object.keys(FORMACIONES) as Formacion[])
    .map((f) => `<option value="${f}"${t.formacion === f ? ' selected' : ''}>${f}</option>`)
    .join('');

  return `
    <div class="tarjeta">
      <p class="tarjeta__titulo">Formacion</p>
      <select data-formacion>${opciones}</select>
      <p class="suave" style="font-size:13px;margin-top:10px">${esc(DESCRIPCIONES[t.formacion])}</p>
      ${renderCancha(app, once.map((j) => j.media))}
    </div>

    <div class="tarjeta">
      <p class="tarjeta__titulo">Actitud</p>
      ${deslizador('mentalidad', 'Mentalidad', t.mentalidad, 'Todos atras', 'Todos arriba')}
      ${deslizador('presion', 'Presion', t.presion, 'Esperar', 'Ir a buscarla')}
      ${deslizador('lineaDefensiva', 'Linea defensiva', t.lineaDefensiva, 'Retrasada', 'Adelantada')}
      ${deslizador('ritmo', 'Ritmo', t.ritmo, 'Pausado', 'Vertical')}
    </div>

    <div class="tarjeta">
      <p class="tarjeta__titulo">Entrenamiento de la semana</p>
      ${deslizadorEntrenamiento('fisico', 'Fisico', club.entrenamiento.fisico)}
      ${deslizadorEntrenamiento('tecnica', 'Tecnica', club.entrenamiento.tecnica)}
      ${deslizadorEntrenamiento('tactica', 'Tactica', club.entrenamiento.tactica)}
      <p class="suave" style="font-size:12.5px;margin-top:6px">
        Los tres se reparten el foco. Mas fisico acelera la recuperacion y empuja
        ritmo y aguante, pero aumenta el riesgo de lesion; tecnica trabaja regate,
        pase y tiro; tactica, el quite y los arqueros.
      </p>
    </div>

    <div class="tarjeta">
      <p class="tarjeta__titulo">Fuerza del once</p>
      ${barra('Ataque', fuerza.ataque)}
      ${barra('Medio', fuerza.medio)}
      ${barra('Defensa', fuerza.defensa)}
      <p class="suave" style="font-size:12.5px;margin-top:10px">
        La mentalidad mueve la balanza: mas ataque debilita la defensa. Estos numeros
        valen tanto para el partido arcade como para las fechas simuladas.
      </p>
    </div>
  `;
}

function deslizador(clave: string, etiqueta: string, valor: number, izquierda: string, derecha: string): string {
  return `
    <label class="campo">
      ${etiqueta} <strong>${valor}</strong>
      <input type="range" min="0" max="100" step="5" value="${valor}" data-tactica="${clave}" />
      <span style="display:flex;justify-content:space-between;font-size:11px">
        <span>${izquierda}</span><span>${derecha}</span>
      </span>
    </label>
  `;
}

function deslizadorEntrenamiento(clave: string, etiqueta: string, valor: number): string {
  return `
    <label class="campo">
      ${etiqueta} <strong>${valor}%</strong>
      <input type="range" min="0" max="100" step="5" value="${valor}" data-entrenamiento="${clave}" />
    </label>
  `;
}

function barra(etiqueta: string, valor: number): string {
  const porcentaje = Math.max(4, Math.min(100, Math.round(valor)));
  return `
    <div style="margin-bottom:10px">
      <div class="fila fila--entre" style="font-size:13px;margin-bottom:5px">
        <span>${etiqueta}</span><strong>${Math.round(valor)}</strong>
      </div>
      <div class="barra-progreso"><i style="width:${porcentaje}%"></i></div>
    </div>
  `;
}

function renderCancha(app: App, medias: number[]): string {
  const estado = app.exigirEstado();
  const club = clubPorId(estado, estado.clubUsuarioId);
  const ranuras = FORMACIONES[club.tacticas.formacion];

  const puntos = ranuras
    .map((r, i) => {
      // Dejo margen arriba y abajo para que ni el arquero ni los delanteros
      // queden cortados contra el borde de la miniatura.
      const izquierda = 6 + r.x * 88;
      const abajo = 6 + r.y * 86;
      const media = medias[i] ?? '';
      return `
        <div style="position:absolute;left:${izquierda}%;bottom:${abajo}%;transform:translate(-50%,50%);
                    width:26px;height:26px;border-radius:50%;display:grid;place-items:center;
                    background:${esc(club.colorPrimario)};color:#fff;font-size:10px;font-weight:700;
                    border:1.5px solid rgba(255,255,255,.6)">${media}</div>
      `;
    })
    .join('');

  return `
    <div style="position:relative;margin-top:12px;height:230px;border-radius:12px;
                background:linear-gradient(0deg,#1f7a3d,#24894a);border:1px solid rgba(255,255,255,.25);overflow:hidden">
      <div style="position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(255,255,255,.45)"></div>
      <div style="position:absolute;left:50%;top:50%;width:70px;height:70px;margin:-35px 0 0 -35px;
                  border:1px solid rgba(255,255,255,.45);border-radius:50%"></div>
      ${puntos}
    </div>
  `;
}

export function montar(app: App, raiz: HTMLElement): void {
  const estado = app.exigirEstado();
  const club = clubPorId(estado, estado.clubUsuarioId);

  raiz.querySelector<HTMLSelectElement>('[data-formacion]')?.addEventListener('change', (evento) => {
    club.tacticas.formacion = (evento.target as HTMLSelectElement).value as Formacion;
    // La formacion nueva reordena los puestos: rearmo el once.
    club.titulares = [];
    app.guardarPartida();
    app.refrescar();
  });

  raiz.querySelectorAll<HTMLInputElement>('[data-entrenamiento]').forEach((nodo) => {
    nodo.addEventListener('change', () => {
      const clave = nodo.dataset.entrenamiento as 'fisico' | 'tecnica' | 'tactica';
      club.entrenamiento[clave] = Number(nodo.value);
      // Reparto lo que sobra entre los otros dos para que siempre sumen 100.
      const otros = (['fisico', 'tecnica', 'tactica'] as const).filter((c) => c !== clave);
      const resto = Math.max(0, 100 - club.entrenamiento[clave]);
      const sumaOtros = otros.reduce((s, c) => s + club.entrenamiento[c], 0) || 1;
      for (const c of otros) club.entrenamiento[c] = Math.round((club.entrenamiento[c] / sumaOtros) * resto);
      app.guardarPartida();
      app.refrescar();
    });
  });

  raiz.querySelectorAll<HTMLInputElement>('[data-tactica]').forEach((nodo) => {
    nodo.addEventListener('change', () => {
      const clave = nodo.dataset.tactica as 'presion' | 'lineaDefensiva' | 'ritmo' | 'mentalidad';
      club.tacticas[clave] = Number(nodo.value);
      app.guardarPartida();
      app.refrescar();
    });
  });
}
