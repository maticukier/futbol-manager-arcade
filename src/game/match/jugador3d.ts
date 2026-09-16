import * as THREE from 'three';
import type { JugadorPartido } from './entidades';

/**
 * Jugador de cancha armado con primitivas y animado por codigo: no hay modelos
 * que descargar ni licencias que mirar, y el paquete no crece.
 *
 * Las geometrias y los materiales se comparten entre los 22 jugadores; lo unico
 * propio de cada uno son las transformaciones.
 */

const ALTURA_CADERA = 0.88;
const ALTURA_HOMBRO = 1.42;

export interface PiezasJugador {
  raiz: THREE.Group;
  cuerpo: THREE.Group;
  piernaIzquierda: THREE.Group;
  piernaDerecha: THREE.Group;
  brazoIzquierdo: THREE.Group;
  brazoDerecho: THREE.Group;
  resalte: THREE.Mesh;
}

/** Geometrias compartidas: se crean una sola vez por partido. */
export class FabricaJugadores {
  private readonly geoTorso = new THREE.BoxGeometry(0.34, 0.62, 0.46);
  private readonly geoCabeza = new THREE.SphereGeometry(0.13, 12, 10);
  private readonly geoPierna = new THREE.BoxGeometry(0.15, 0.82, 0.18);
  private readonly geoBrazo = new THREE.BoxGeometry(0.12, 0.54, 0.14);
  private readonly geoSombra = new THREE.CircleGeometry(0.55, 16);
  private readonly geoResalte = new THREE.RingGeometry(0.62, 0.78, 20);

  private readonly matPiel = new THREE.MeshLambertMaterial({ color: 0xc98c5a });
  private readonly matSombra: THREE.MeshBasicMaterial;
  private readonly cache = new Map<string, { camiseta: THREE.Material; short: THREE.Material }>();

  constructor() {
    this.matSombra = new THREE.MeshBasicMaterial({
      map: texturaSombra(),
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
  }

  private materialesDe(color: string, secundario: string) {
    const clave = `${color}|${secundario}`;
    let materiales = this.cache.get(clave);
    if (!materiales) {
      materiales = {
        camiseta: new THREE.MeshLambertMaterial({ color: new THREE.Color(color) }),
        short: new THREE.MeshLambertMaterial({ color: new THREE.Color(secundario) }),
      };
      this.cache.set(clave, materiales);
    }
    return materiales;
  }

  crear(colorCamiseta: string, colorShort: string, esArquero: boolean): PiezasJugador {
    const { camiseta, short } = this.materialesDe(
      esArquero ? mezclar(colorCamiseta, '#f1c40f') : colorCamiseta,
      colorShort,
    );

    const raiz = new THREE.Group();
    const cuerpo = new THREE.Group();
    raiz.add(cuerpo);

    const torso = new THREE.Mesh(this.geoTorso, camiseta);
    torso.position.y = 1.2;
    cuerpo.add(torso);

    const cabeza = new THREE.Mesh(this.geoCabeza, this.matPiel);
    cabeza.position.y = 1.62;
    cuerpo.add(cabeza);

    const piernaIzquierda = this.crearMiembro(this.geoPierna, short, ALTURA_CADERA, 0.12, -0.41);
    const piernaDerecha = this.crearMiembro(this.geoPierna, short, ALTURA_CADERA, -0.12, -0.41);
    const brazoIzquierdo = this.crearMiembro(this.geoBrazo, this.matPiel, ALTURA_HOMBRO, 0.28, -0.27);
    const brazoDerecho = this.crearMiembro(this.geoBrazo, this.matPiel, ALTURA_HOMBRO, -0.28, -0.27);
    cuerpo.add(piernaIzquierda, piernaDerecha, brazoIzquierdo, brazoDerecho);

    const sombra = new THREE.Mesh(this.geoSombra, this.matSombra);
    sombra.rotation.x = -Math.PI / 2;
    sombra.position.y = 0.02;
    raiz.add(sombra);

    const resalte = new THREE.Mesh(
      this.geoResalte,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    resalte.rotation.x = -Math.PI / 2;
    resalte.position.y = 0.04;
    resalte.visible = false;
    raiz.add(resalte);

    return { raiz, cuerpo, piernaIzquierda, piernaDerecha, brazoIzquierdo, brazoDerecho, resalte };
  }

  /** Miembro colgado de un pivote, para que gire desde la cadera o el hombro. */
  private crearMiembro(
    geometria: THREE.BufferGeometry,
    material: THREE.Material,
    alturaPivote: number,
    desplazamientoZ: number,
    centro: number,
  ): THREE.Group {
    const pivote = new THREE.Group();
    pivote.position.set(0, alturaPivote, desplazamientoZ);
    const malla = new THREE.Mesh(geometria, material);
    malla.position.y = centro;
    pivote.add(malla);
    return pivote;
  }

  liberar(): void {
    for (const geo of [this.geoTorso, this.geoCabeza, this.geoPierna, this.geoBrazo, this.geoSombra, this.geoResalte]) {
      geo.dispose();
    }
    this.matPiel.dispose();
    this.matSombra.map?.dispose();
    this.matSombra.dispose();
    for (const { camiseta, short } of this.cache.values()) {
      camiseta.dispose();
      short.dispose();
    }
    this.cache.clear();
  }
}

/**
 * Lleva las piezas a la pose que corresponde al estado del jugador.
 * Correr, patear, barrerse y quedar en el piso son cuatro poses distintas.
 */
export function animarJugador(piezas: PiezasJugador, j: JugadorPartido, controlado: boolean): void {
  const { raiz, cuerpo } = piezas;
  raiz.position.set(j.x, 0, j.z);
  raiz.rotation.y = -j.rumbo;
  piezas.resalte.visible = controlado;

  const velocidad = Math.hypot(j.vx, j.vz);
  const intensidad = Math.min(1, velocidad / 6);
  const ciclo = Math.sin(j.paso * 3.4);
  const contraciclo = Math.cos(j.paso * 3.4);

  if (j.estado === 'barrida' || j.estado === 'caido') {
    // Tumbado hacia adelante, con una pierna estirada.
    cuerpo.rotation.z = -Math.PI / 2.3;
    cuerpo.position.y = 0.12;
    piezas.piernaIzquierda.rotation.x = -0.9;
    piezas.piernaDerecha.rotation.x = 0.35;
    piezas.brazoIzquierdo.rotation.x = 0.9;
    piezas.brazoDerecho.rotation.x = -0.4;
    return;
  }

  cuerpo.rotation.z = 0;
  cuerpo.position.y = 0;

  if (j.patada > 0) {
    // Golpe: una pierna va hacia adelante y el torso acompana.
    const avance = Math.sin((1 - j.patada / 0.3) * Math.PI);
    piezas.piernaDerecha.rotation.x = -1.5 * avance;
    piezas.piernaIzquierda.rotation.x = 0.4 * avance;
    piezas.brazoIzquierdo.rotation.x = -0.8 * avance;
    piezas.brazoDerecho.rotation.x = 0.5 * avance;
    cuerpo.rotation.x = 0.12 * avance;
    return;
  }

  cuerpo.rotation.x = intensidad * 0.14;
  piezas.piernaIzquierda.rotation.x = ciclo * 0.95 * intensidad;
  piezas.piernaDerecha.rotation.x = -ciclo * 0.95 * intensidad;
  piezas.brazoIzquierdo.rotation.x = -contraciclo * 0.7 * intensidad;
  piezas.brazoDerecho.rotation.x = contraciclo * 0.7 * intensidad;
  cuerpo.position.y = Math.abs(ciclo) * 0.05 * intensidad;
}

/** Mancha difusa que hace de sombra, mucho mas barata que un mapa de sombras. */
function texturaSombra(): THREE.Texture {
  const lienzo = document.createElement('canvas');
  lienzo.width = 64;
  lienzo.height = 64;
  const ctx = lienzo.getContext('2d')!;
  const degradado = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  degradado.addColorStop(0, 'rgba(0,0,0,0.85)');
  degradado.addColorStop(0.6, 'rgba(0,0,0,0.35)');
  degradado.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(lienzo);
}

/** Mezcla dos colores para que el arquero no se confunda con sus companeros. */
function mezclar(a: string, b: string): string {
  const colorA = new THREE.Color(a);
  const colorB = new THREE.Color(b);
  return `#${colorA.lerp(colorB, 0.65).getHexString()}`;
}
