import * as THREE from 'three';
import {
  ANCHO,
  AREA_ANCHO,
  AREA_CHICA_ANCHO,
  AREA_CHICA_LARGO,
  AREA_LARGO,
  ARCO_ALTO,
  ARCO_ANCHO,
  ARCO_PROFUNDIDAD,
  CIRCULO_CENTRAL,
  LARGO,
  PENAL_DISTANCIA,
  RADIO_PELOTA,
  limitar,
} from './mundo';
import { FabricaJugadores, animarJugador, type PiezasJugador } from './jugador3d';
import type { Instantanea, JugadorPartido } from './entidades';
import type { MotorPartido } from './motor';

/** Ancho de cancha que queremos ver en pantalla, en metros. Cuanto menos, mas
 * grandes se ven los jugadores; 42 deja la escala de un arcade de futbol. */
const CAMPO_VISIBLE = 52;
/** Cerca del area la camara se acerca un poco, como en una transmision. */
const CAMPO_VISIBLE_AREA = 42;
const ANGULO_CAMARA = (34 * Math.PI) / 180;
/** Color del cesped, para no vestir a un equipo de un verde que se camufle. */
const VERDE_CANCHA = '#1d7a3c';

/**
 * Render 3D del partido: cancha, arcos, tribunas, jugadores y pelota.
 * Solo lee el estado del motor, nunca lo modifica.
 */
export class Escena3D {
  private readonly motor: MotorPartido;
  private readonly contenedor: HTMLElement;
  private readonly escena = new THREE.Scene();
  private readonly camara: THREE.PerspectiveCamera;
  private readonly render: THREE.WebGLRenderer;
  private readonly fabrica = new FabricaJugadores();
  private readonly piezas = new Map<string, PiezasJugador>();
  private readonly pelota: THREE.Mesh;
  private readonly sombraPelota: THREE.Mesh;
  private readonly aDesechar: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

  private marcaPase: THREE.Mesh;
  private colorUsuario = '#ffffff';
  private colorRival = '#111111';
  private sacudida = 0;
  private posicionCamara = new THREE.Vector3(0, 20, 26);
  private campoVisible = CAMPO_VISIBLE;

  constructor(contenedor: HTMLElement, motor: MotorPartido) {
    this.contenedor = contenedor;
    this.motor = motor;

    this.render = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.render.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.render.setSize(contenedor.clientWidth, contenedor.clientHeight);
    contenedor.appendChild(this.render.domElement);

    this.escena.background = new THREE.Color(0x060d1a);
    this.escena.fog = new THREE.Fog(0x060d1a, 110, 230);

    this.camara = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
    this.escena.add(this.camara);

    this.armarLuces();
    this.armarCancha();
    this.armarArcos();
    this.armarTribunas();

    const { pelota, sombra } = this.armarPelota();
    this.pelota = pelota;
    this.sombraPelota = sombra;

    this.armarJugadores();
    this.marcaPase = this.armarMarcaDePase();
    this.redimensionar();
  }

  // ------------------------------------------------------------------ armado

  private armarLuces(): void {
    this.escena.add(new THREE.HemisphereLight(0x9fc4ff, 0x1d4a2a, 1.05));

    const focos = new THREE.DirectionalLight(0xffffff, 1.15);
    focos.position.set(40, 70, 30);
    this.escena.add(focos);

    const contraluz = new THREE.DirectionalLight(0x9ecbff, 0.35);
    contraluz.position.set(-50, 40, -30);
    this.escena.add(contraluz);
  }

  private armarCancha(): void {
    const textura = this.texturaDeCancha();
    const geometria = new THREE.PlaneGeometry(LARGO, ANCHO);
    const material = new THREE.MeshLambertMaterial({ map: textura });
    const cesped = new THREE.Mesh(geometria, material);
    cesped.rotation.x = -Math.PI / 2;
    this.escena.add(cesped);
    this.aDesechar.push(geometria, material, textura);

    // Franja de cesped fuera de las lineas, para que la cancha no termine seca.
    const bordeGeo = new THREE.PlaneGeometry(LARGO + 24, ANCHO + 20);
    const bordeMat = new THREE.MeshLambertMaterial({ color: 0x14532d });
    const borde = new THREE.Mesh(bordeGeo, bordeMat);
    borde.rotation.x = -Math.PI / 2;
    borde.position.y = -0.02;
    this.escena.add(borde);
    this.aDesechar.push(bordeGeo, bordeMat);
  }

  /** Dibuja el cesped rayado y todas las lineas en un lienzo y lo usa de textura. */
  private texturaDeCancha(): THREE.Texture {
    const escala = 18;
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(LARGO * escala);
    lienzo.height = Math.round(ANCHO * escala);
    const ctx = lienzo.getContext('2d')!;

    const aX = (x: number) => (x + LARGO / 2) * escala;
    const aZ = (z: number) => (z + ANCHO / 2) * escala;

    ctx.fillStyle = '#1d7a3c';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.fillStyle = '#22884a';
    const franjas = 14;
    for (let i = 0; i < franjas; i += 2) {
      ctx.fillRect((lienzo.width / franjas) * i, 0, lienzo.width / franjas, lienzo.height);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 0.13 * escala;

    ctx.strokeRect(aX(-LARGO / 2), aZ(-ANCHO / 2), LARGO * escala, ANCHO * escala);

    ctx.beginPath();
    ctx.moveTo(aX(0), aZ(-ANCHO / 2));
    ctx.lineTo(aX(0), aZ(ANCHO / 2));
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(aX(0), aZ(0), CIRCULO_CENTRAL * escala, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(aX(0), aZ(0), 0.2 * escala, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fill();

    for (const lado of [-1, 1]) {
      const xLinea = (LARGO / 2) * lado;
      const xArea = xLinea - AREA_LARGO * lado;
      ctx.strokeRect(
        aX(Math.min(xLinea, xArea)),
        aZ(-AREA_ANCHO / 2),
        AREA_LARGO * escala,
        AREA_ANCHO * escala,
      );

      const xChica = xLinea - AREA_CHICA_LARGO * lado;
      ctx.strokeRect(
        aX(Math.min(xLinea, xChica)),
        aZ(-AREA_CHICA_ANCHO / 2),
        AREA_CHICA_LARGO * escala,
        AREA_CHICA_ANCHO * escala,
      );

      const xPenal = xLinea - PENAL_DISTANCIA * lado;
      ctx.beginPath();
      ctx.arc(aX(xPenal), aZ(0), 0.2 * escala, 0, Math.PI * 2);
      ctx.fill();

      // Semicirculo del area, recortado a la parte de afuera.
      ctx.save();
      ctx.beginPath();
      ctx.rect(aX(lado < 0 ? xArea : xArea - 20), 0, 20 * escala, lienzo.height);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(aX(xPenal), aZ(0), CIRCULO_CENTRAL * escala, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Arcos de corner.
      for (const ladoZ of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(aX(xLinea), aZ((ANCHO / 2) * ladoZ), 1 * escala, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const textura = new THREE.CanvasTexture(lienzo);
    textura.anisotropy = Math.min(8, this.render.capabilities.getMaxAnisotropy());
    textura.colorSpace = THREE.SRGBColorSpace;
    return textura;
  }

  private armarArcos(): void {
    const palo = new THREE.CylinderGeometry(0.07, 0.07, ARCO_ALTO, 8);
    const travesano = new THREE.CylinderGeometry(0.07, 0.07, ARCO_ANCHO, 8);
    const blanco = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const redMat = new THREE.MeshBasicMaterial({
      map: this.texturaDeRed(),
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.aDesechar.push(palo, travesano, blanco, redMat, redMat.map!);

    for (const lado of [-1, 1]) {
      const arco = new THREE.Group();
      arco.position.x = (LARGO / 2) * lado;

      for (const ladoZ of [-1, 1]) {
        const poste = new THREE.Mesh(palo, blanco);
        poste.position.set(0, ARCO_ALTO / 2, (ARCO_ANCHO / 2) * ladoZ);
        arco.add(poste);
      }

      const barra = new THREE.Mesh(travesano, blanco);
      barra.rotation.x = Math.PI / 2;
      barra.position.y = ARCO_ALTO;
      arco.add(barra);

      const fondoGeo = new THREE.PlaneGeometry(ARCO_ANCHO, ARCO_ALTO);
      const fondo = new THREE.Mesh(fondoGeo, redMat);
      fondo.position.set(ARCO_PROFUNDIDAD * lado, ARCO_ALTO / 2, 0);
      fondo.rotation.y = Math.PI / 2;
      arco.add(fondo);
      this.aDesechar.push(fondoGeo);

      for (const ladoZ of [-1, 1]) {
        const costadoGeo = new THREE.PlaneGeometry(ARCO_PROFUNDIDAD, ARCO_ALTO);
        const costado = new THREE.Mesh(costadoGeo, redMat);
        costado.position.set((ARCO_PROFUNDIDAD / 2) * lado, ARCO_ALTO / 2, (ARCO_ANCHO / 2) * ladoZ);
        arco.add(costado);
        this.aDesechar.push(costadoGeo);
      }

      const techoGeo = new THREE.PlaneGeometry(ARCO_PROFUNDIDAD, ARCO_ANCHO);
      const techo = new THREE.Mesh(techoGeo, redMat);
      techo.rotation.x = Math.PI / 2;
      techo.position.set((ARCO_PROFUNDIDAD / 2) * lado, ARCO_ALTO, 0);
      arco.add(techo);
      this.aDesechar.push(techoGeo);

      this.escena.add(arco);
    }
  }

  private texturaDeRed(): THREE.Texture {
    const lienzo = document.createElement('canvas');
    lienzo.width = 64;
    lienzo.height = 64;
    const ctx = lienzo.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 64; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 64);
      ctx.moveTo(0, i);
      ctx.lineTo(64, i);
      ctx.stroke();
    }
    const textura = new THREE.CanvasTexture(lienzo);
    textura.wrapS = THREE.RepeatWrapping;
    textura.wrapT = THREE.RepeatWrapping;
    textura.repeat.set(6, 3);
    return textura;
  }

  /** Tribunas simples: dan encuadre y sensacion de estadio sin costar nada. */
  private armarTribunas(): void {
    const textura = this.texturaDeHinchada();
    const material = new THREE.MeshLambertMaterial({ map: textura });
    this.aDesechar.push(material, textura);

    const bloques: [number, number, number, number, number, number][] = [
      // ancho, alto, profundidad, x, y, z
      [LARGO + 30, 11, 16, 0, 5.5, ANCHO / 2 + 14],
      [LARGO + 30, 11, 16, 0, 5.5, -(ANCHO / 2 + 14)],
      [16, 11, ANCHO + 12, LARGO / 2 + 14, 5.5, 0],
      [16, 11, ANCHO + 12, -(LARGO / 2 + 14), 5.5, 0],
    ];

    for (const [ancho, alto, profundidad, x, y, z] of bloques) {
      const geo = new THREE.BoxGeometry(ancho, alto, profundidad);
      const malla = new THREE.Mesh(geo, material);
      malla.position.set(x, y, z);
      this.escena.add(malla);
      this.aDesechar.push(geo);
    }
  }

  private texturaDeHinchada(): THREE.Texture {
    const lienzo = document.createElement('canvas');
    lienzo.width = 256;
    lienzo.height = 64;
    const ctx = lienzo.getContext('2d')!;
    ctx.fillStyle = '#131c2e';
    ctx.fillRect(0, 0, 256, 64);
    const colores = ['#2b3b57', '#3d4f70', '#22304a', '#4a5d80', '#1c2a42'];
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = colores[(Math.random() * colores.length) | 0];
      ctx.fillRect(Math.random() * 256, Math.random() * 64, 2.4, 2.4);
    }
    const textura = new THREE.CanvasTexture(lienzo);
    textura.wrapS = THREE.RepeatWrapping;
    textura.repeat.set(4, 1);
    return textura;
  }

  private armarPelota(): { pelota: THREE.Mesh; sombra: THREE.Mesh } {
    const geo = new THREE.SphereGeometry(RADIO_PELOTA, 18, 14);
    const textura = this.texturaDePelota();
    const mat = new THREE.MeshLambertMaterial({ map: textura });
    const pelota = new THREE.Mesh(geo, mat);
    this.escena.add(pelota);

    const sombraGeo = new THREE.CircleGeometry(RADIO_PELOTA * 1.8, 12);
    const sombraMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const sombra = new THREE.Mesh(sombraGeo, sombraMat);
    sombra.rotation.x = -Math.PI / 2;
    sombra.position.y = 0.03;
    this.escena.add(sombra);

    this.aDesechar.push(geo, mat, textura, sombraGeo, sombraMat);
    return { pelota, sombra };
  }

  private texturaDePelota(): THREE.Texture {
    const lienzo = document.createElement('canvas');
    lienzo.width = 64;
    lienzo.height = 32;
    const ctx = lienzo.getContext('2d')!;
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = '#1b1b1b';
    for (const [x, y, r] of [
      [10, 8, 4],
      [32, 20, 5],
      [52, 9, 4],
      [20, 28, 3.5],
      [44, 30, 3],
    ] as [number, number, number][]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return new THREE.CanvasTexture(lienzo);
  }

  private armarJugadores(): void {
    // Los dos colores se resuelven juntos: el del rival se elige contra el que
    // le quedo al usuario, no contra el original.
    this.colorUsuario = separarDelCesped(this.motor.config.usuario.colorPrimario);
    this.colorRival = colorDeVisitante(this.motor.config.rival.colorPrimario, this.colorUsuario);

    for (const j of this.motor.jugadores) {
      const equipo = j.bando === 'usuario' ? this.motor.config.usuario : this.motor.config.rival;
      const color = j.bando === 'usuario' ? this.colorUsuario : this.colorRival;
      const piezas = this.fabrica.crear(color, equipo.colorSecundario, j.esArquero);
      this.escena.add(piezas.raiz);
      this.piezas.set(j.id, piezas);
    }
  }

  /** Anillo que marca a quien le llegaria el pase si apretas ahora. */
  private armarMarcaDePase(): THREE.Mesh {
    const geo = new THREE.RingGeometry(0.75, 1.05, 22);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2ecc71,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const malla = new THREE.Mesh(geo, mat);
    malla.rotation.x = -Math.PI / 2;
    malla.position.y = 0.05;
    malla.visible = false;
    this.escena.add(malla);
    this.aDesechar.push(geo, mat);
    return malla;
  }

  // ------------------------------------------------------------------ cuadro

  actualizar(dt: number, destinoPase: string | null = null, foto: Instantanea | null = null): void {
    this.sincronizarJugadores();

    if (foto) {
      this.pintarInstantanea(foto);
      this.marcaPase.visible = false;
      this.moverCamaraRepeticion(dt, foto);
      this.render.render(this.escena, this.camara);
      return;
    }

    for (const j of this.motor.jugadores) {
      const piezas = this.piezas.get(j.id);
      if (!piezas) continue;
      piezas.raiz.visible = !j.expulsado;
      animarJugador(piezas, j, j.id === this.motor.controladoId);
    }

    const destino = destinoPase ? this.motor.porId(destinoPase) : null;
    this.marcaPase.visible = !!destino;
    if (destino) this.marcaPase.position.set(destino.x, 0.05, destino.z);

    const p = this.motor.pelota;
    this.pelota.position.set(p.x, p.y, p.z);
    this.pelota.rotation.z -= p.vx * dt * 3;
    this.pelota.rotation.x += p.vz * dt * 3;
    this.sombraPelota.position.set(p.x, 0.03, p.z);
    const escalaSombra = limitar(1 - p.y / 14, 0.35, 1);
    this.sombraPelota.scale.setScalar(escalaSombra);

    this.moverCamara(dt);
    this.render.render(this.escena, this.camara);
  }

  /** Dibuja una foto guardada, para la repeticion del gol. */
  private pintarInstantanea(foto: Instantanea): void {
    for (const f of foto.jugadores) {
      const piezas = this.piezas.get(f.id);
      if (!piezas) continue;
      piezas.raiz.visible = true;
      animarJugador(piezas, f as unknown as JugadorPartido, false);
    }
    this.pelota.position.set(foto.pelota.x, foto.pelota.y, foto.pelota.z);
    this.sombraPelota.position.set(foto.pelota.x, 0.03, foto.pelota.z);
  }

  /** Camara de repeticion: mas baja y mas cerca, mirando hacia el arco. */
  private moverCamaraRepeticion(dt: number, foto: Instantanea): void {
    const lado = Math.sign(foto.pelota.x) || 1;
    const deseada = new THREE.Vector3(
      foto.pelota.x - lado * 16,
      9,
      foto.pelota.z + 20,
    );
    this.posicionCamara.lerp(deseada, 1 - Math.exp(-dt * 2.4));
    this.camara.position.copy(this.posicionCamara);
    this.camara.lookAt(foto.pelota.x, 1.2, foto.pelota.z);
  }

  /** Los cambios traen ids nuevos: creo y saco mallas segun quien este en cancha. */
  private sincronizarJugadores(): void {
    const presentes = new Set<string>();

    for (const j of this.motor.jugadores) {
      presentes.add(j.id);
      if (this.piezas.has(j.id)) continue;
      const equipo = j.bando === 'usuario' ? this.motor.config.usuario : this.motor.config.rival;
      const color = j.bando === 'usuario' ? this.colorUsuario : this.colorRival;
      const piezas = this.fabrica.crear(color, equipo.colorSecundario, j.esArquero);
      this.escena.add(piezas.raiz);
      this.piezas.set(j.id, piezas);
    }

    for (const [id, piezas] of this.piezas) {
      if (presentes.has(id)) continue;
      this.escena.remove(piezas.raiz);
      this.piezas.delete(id);
    }
  }

  private moverCamara(dt: number): void {
    const p = this.motor.pelota;
    const distancia = this.distanciaDeCamara(dt);

    // Le adelanto un poco la camara a la pelota: en las contras se agradece.
    const objetivoX = limitar((p.x + p.vx * 0.35) * 0.85, -(LARGO / 2 - 10), LARGO / 2 - 10);
    // Sigo mas a la pelota de lado a lado: con poco seguimiento, cuando la
    // jugada se va a la banda de abajo la linea se sale del cuadro. Mas que
    // esto tampoco, porque la camara se mete adentro de la tribuna.
    const objetivoZ = p.z * 0.62;

    const deseada = new THREE.Vector3(
      objetivoX,
      Math.sin(ANGULO_CAMARA) * distancia,
      objetivoZ + Math.cos(ANGULO_CAMARA) * distancia,
    );

    this.posicionCamara.lerp(deseada, 1 - Math.exp(-dt * 3.2));
    this.camara.position.copy(this.posicionCamara);

    if (this.sacudida > 0) {
      this.sacudida = Math.max(0, this.sacudida - dt * 2);
      this.camara.position.x += (Math.random() - 0.5) * this.sacudida;
      this.camara.position.y += (Math.random() - 0.5) * this.sacudida;
    }

    // Mirando un poco hacia este lado la camara baja la vista y entra la banda
    // de abajo. Mirando para el otro lado se comia justo esa linea.
    this.camara.lookAt(objetivoX, 1.1, objetivoZ + 3);
  }

  /** Distancia que hace falta para ver el ancho de cancha que buscamos. */
  private distanciaDeCamara(dt: number): number {
    const objetivo = this.motor.pelotaEnArea ? CAMPO_VISIBLE_AREA : CAMPO_VISIBLE;
    this.campoVisible += (objetivo - this.campoVisible) * (1 - Math.exp(-dt * 1.6));

    const aspecto = Math.max(0.5, this.camara.aspect);
    const mitadVertical = Math.tan((this.camara.fov * Math.PI) / 360);
    const cruda = this.campoVisible / (2 * mitadVertical * aspecto);
    return limitar(cruda, 20, 52);
  }

  sacudir(intensidad = 1.2): void {
    this.sacudida = intensidad;
  }

  redimensionar(): void {
    const ancho = this.contenedor.clientWidth || window.innerWidth;
    const alto = this.contenedor.clientHeight || window.innerHeight;
    this.camara.aspect = ancho / alto;
    this.camara.updateProjectionMatrix();
    this.render.setSize(ancho, alto);
  }

  destruir(): void {
    for (const piezas of this.piezas.values()) this.escena.remove(piezas.raiz);
    this.piezas.clear();
    this.fabrica.liberar();
    for (const recurso of this.aDesechar) recurso.dispose();
    this.render.dispose();
    this.render.domElement.remove();
  }
}

/**
 * La camiseta tiene que distinguirse de la del rival y tambien del cesped:
 * un equipo verde sobre una cancha verde no se ve.
 */
function separarDelCesped(color: string): string {
  return lejos(color, VERDE_CANCHA, 0.34) ? color : aclarar(color, 0.6);
}

function colorDeVisitante(propio: string, colorLocal: string): string {
  const base = separarDelCesped(propio);
  const opciones = [base, '#f2f2f2', '#16223a', '#e8b600', '#e2574c', '#8e44ad'];
  return (
    opciones.find((opcion) => lejos(opcion, colorLocal, 0.45) && lejos(opcion, VERDE_CANCHA, 0.34)) ?? '#16223a'
  );
}

function lejos(a: string, b: string, umbral: number): boolean {
  const x = new THREE.Color(a);
  const y = new THREE.Color(b);
  return Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b) > umbral;
}

function aclarar(color: string, cantidad: number): string {
  return `#${new THREE.Color(color).lerp(new THREE.Color('#ffffff'), cantidad).getHexString()}`;
}
