import Phaser from 'phaser';
import { EscenaPartido, type DatosEscenaPartido } from './match/EscenaPartido';
import type { ConfiguracionPartido, ResultadoPartido } from './match/entidades';

/**
 * Arranca Phaser en el contenedor del partido y devuelve el resultado.
 * Resuelve en null si el usuario abandona antes del final.
 */
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
