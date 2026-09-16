import { MotorPartido } from './match/motor';
import { Escena3D } from './match/escena3d';
import { InterfazPartido } from './match/interfaz';
import { Sonido } from './match/sonido';
import type { ConfiguracionPartido, Instantanea, ResultadoPartido } from './match/entidades';

/** Cuadros por segundo que se graban para la repeticion, y cuanto se guarda. */
const GRABACION_HZ = 20;
const SEGUNDOS_GRABADOS = 4;
const DURACION_REPETICION = 3.2;

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

    const sonido = new Sonido();
    sonido.encender();

    let cerrado = false;
    let pausado = false;
    let cuadro = 0;
    let ultimoInstante = performance.now();
    let golesPrevios = 0;

    // Anillo de fotos del partido, para repetir el gol.
    const historial: Instantanea[] = [];
    let desdeUltimaFoto = 0;
    let repeticion: Instantanea[] | null = null;
    let tiempoRepeticion = 0;

    const interfaz = new InterfazPartido(
      contenedor,
      motor,
      () => cerrar(null),
      (valor) => {
        pausado = valor;
      },
      (silenciar) => {
        sonido.encender();
        sonido.silenciar(silenciar);
        return sonido.estaSilenciado;
      },
    );

    const cerrar = (resultado: ResultadoPartido | null) => {
      if (cerrado) return;
      cerrado = true;
      cancelAnimationFrame(cuadro);
      window.removeEventListener('resize', alRedimensionar);
      window.removeEventListener('orientationchange', alRedimensionar);
      interfaz.destruir();
      escena.destruir();
      sonido.destruir();
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

      // Voy guardando fotos para poder repetir la jugada del gol.
      desdeUltimaFoto += dt;
      if (!pausado && desdeUltimaFoto >= 1 / GRABACION_HZ) {
        desdeUltimaFoto = 0;
        historial.push(motor.instantanea());
        if (historial.length > GRABACION_HZ * SEGUNDOS_GRABADOS) historial.shift();
      }

      for (const evento of motor.eventos.splice(0)) {
        if (evento.tipo === 'patada') sonido.patada(evento.fuerza);
        else if (evento.tipo === 'pase') sonido.patada(0.12);
        else if (evento.tipo === 'atajada') sonido.atajada();
        else if (evento.tipo === 'silbato') sonido.silbato(evento.largo);
        else if (evento.tipo === 'gol') sonido.gol();
      }
      sonido.ambiente(dt, motor.emocion);

      const goles = motor.golesUsuario + motor.golesRival;
      if (goles !== golesPrevios) {
        golesPrevios = goles;
        escena.sacudir();
        repeticion = historial.slice();
        tiempoRepeticion = 0;
      }

      let foto: Instantanea | null = null;
      if (repeticion && repeticion.length > 4) {
        tiempoRepeticion += dt;
        // Se repite un poco mas lenta que el juego, como en la tele.
        const indice = Math.floor(tiempoRepeticion * GRABACION_HZ * 0.7);
        if (tiempoRepeticion > DURACION_REPETICION || indice >= repeticion.length) repeticion = null;
        else foto = repeticion[indice];
      }

      const destino = motor.destinoDePase(false, entrada.moverX, entrada.moverZ);
      escena.actualizar(dt, destino?.id ?? null, foto);
      interfaz.actualizar(foto !== null);

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
