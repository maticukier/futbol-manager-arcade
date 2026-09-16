import { MotorPartido } from './match/motor';
import { Escena3D } from './match/escena3d';
import { InterfazPartido } from './match/interfaz';
import type { ConfiguracionPartido, ResultadoPartido } from './match/entidades';

/**
 * Arma el partido (motor, render 3D e interfaz), lo corre y devuelve el
 * resultado. Resuelve en null si el usuario abandona antes del final.
 */
export function jugarPartidoArcade(
  contenedor: HTMLElement,
  config: ConfiguracionPartido,
): Promise<ResultadoPartido | null> {
  return new Promise((resolver) => {
    const motor = new MotorPartido(config);
    const escena = new Escena3D(contenedor, motor);

    let cerrado = false;
    let pausado = false;
    let cuadro = 0;
    let ultimoInstante = performance.now();
    let golesPrevios = 0;

    const interfaz = new InterfazPartido(contenedor, motor, () => cerrar(null));

    const cerrar = (resultado: ResultadoPartido | null) => {
      if (cerrado) return;
      cerrado = true;
      cancelAnimationFrame(cuadro);
      window.removeEventListener('resize', alRedimensionar);
      window.removeEventListener('orientationchange', alRedimensionar);
      interfaz.destruir();
      escena.destruir();
      contenedor.innerHTML = '';
      Reflect.deleteProperty(window, 'partido');
      salirDePantallaCompleta();
      resolver(resultado);
    };

    const alRedimensionar = () => escena.redimensionar();
    window.addEventListener('resize', alRedimensionar);
    window.addEventListener('orientationchange', alRedimensionar);

    const bucle = (instante: number) => {
      cuadro = requestAnimationFrame(bucle);
      // Con pestanas en segundo plano el delta se dispara: lo recorto para que
      // la fisica no pegue saltos.
      const dt = Math.min(0.05, (instante - ultimoInstante) / 1000);
      ultimoInstante = instante;

      const entrada = interfaz.leer();
      if (!pausado) motor.paso(dt, entrada);

      const goles = motor.golesUsuario + motor.golesRival;
      if (goles !== golesPrevios) {
        golesPrevios = goles;
        escena.sacudir();
      }

      escena.actualizar(dt);
      interfaz.actualizar();

      if (motor.terminado) cerrar(motor.resultado());
    };

    pedirApaisado(contenedor);
    escena.redimensionar();
    cuadro = requestAnimationFrame(bucle);

    // Referencia para depurar desde la consola del navegador.
    Object.assign(window, {
      partido: {
        motor,
        escena,
        interfaz,
        pausar: (valor = true) => {
          pausado = valor;
        },
      },
    });
  });
}

/** Intenta poner el telefono en horizontal. Si el navegador no deja, no pasa nada. */
function pedirApaisado(contenedor: HTMLElement): void {
  const pantalla = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  const bloquear = () => pantalla?.lock?.('landscape').catch(() => undefined);

  if (!document.fullscreenElement && contenedor.requestFullscreen) {
    contenedor
      .requestFullscreen()
      .then(bloquear)
      .catch(() => bloquear());
    return;
  }
  bloquear();
}

function salirDePantallaCompleta(): void {
  const pantalla = screen.orientation as ScreenOrientation & { unlock?: () => void };
  try {
    pantalla?.unlock?.();
  } catch {
    // Algunos navegadores no lo soportan; no es grave.
  }
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
}
