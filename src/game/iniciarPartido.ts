import Phaser from 'phaser';
import { EscenaPartido, type DatosEscenaPartido } from './match/EscenaPartido';
import type { ConfiguracionPartido, ResultadoPartido } from './match/entidades';

/**
 * Arranca Phaser en el contenedor del partido y devuelve el resultado.
 * Resuelve en null si el usuario abandona antes del final.
 */
/**
 * Alto de las franjas que el sistema se reserva (notch arriba, barra de gestos
 * abajo). Phaser dibuja a pantalla completa, asi que el HUD tiene que esquivarlas.
 */
function areaSegura(): { arriba: number; abajo: number } {
  const sonda = document.createElement('div');
  sonda.style.cssText =
    'position:fixed;top:0;left:0;width:0;visibility:hidden;' +
    'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(sonda);
  const estilo = getComputedStyle(sonda);
  const arriba = parseFloat(estilo.paddingTop) || 0;
  const abajo = parseFloat(estilo.paddingBottom) || 0;
  sonda.remove();
  return { arriba, abajo };
}

export function jugarPartidoArcade(
  contenedor: HTMLElement,
  config: ConfiguracionPartido,
): Promise<ResultadoPartido | null> {
  return new Promise((resolver) => {
    let juego: Phaser.Game | null = null;
    let terminado = false;

    const cerrar = (resultado: ResultadoPartido | null) => {
      if (terminado) return;
      terminado = true;
      // Doy un frame para que Phaser termine el update actual antes de destruir.
      setTimeout(() => {
        juego?.destroy(true);
        juego = null;
        Reflect.deleteProperty(window, 'partido');
        contenedor.innerHTML = '';
        resolver(resultado);
      }, 0);
    };

    const datos: DatosEscenaPartido = {
      config,
      areaSegura: areaSegura(),
      alTerminar: (resultado) => cerrar(resultado),
      alSalir: () => cerrar(null),
    };

    juego = new Phaser.Game({
      type: Phaser.AUTO,
      parent: contenedor,
      backgroundColor: '#0b1220',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: contenedor.clientWidth || window.innerWidth,
        height: contenedor.clientHeight || window.innerHeight,
      },
      render: { antialias: true, powerPreference: 'high-performance' },
      scene: [EscenaPartido],
      audio: { noAudio: true },
    });

    juego.scene.start(EscenaPartido.CLAVE, datos);
    // Referencia para depurar desde la consola del navegador.
    Object.assign(window, { partido: juego });
  });
}
