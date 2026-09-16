/**
 * Sonido del partido sintetizado con WebAudio: no hay archivos que descargar.
 * La hinchada es ruido filtrado que sube y baja segun lo que pasa, y los
 * golpes, el silbato y el grito de gol se arman con osciladores.
 */
export class Sonido {
  private contexto: AudioContext | null = null;
  private maestro: GainNode | null = null;
  private hinchada: GainNode | null = null;
  private ruido: AudioBuffer | null = null;
  private intensidad = 0;
  private silenciado = false;

  /** Hay que llamarlo desde un gesto del usuario: los navegadores lo exigen. */
  encender(): void {
    if (this.contexto) {
      void this.contexto.resume().catch(() => undefined);
      return;
    }

    try {
      this.contexto = new AudioContext();
    } catch {
      return; // Sin audio disponible: el juego sigue igual.
    }

    this.maestro = this.contexto.createGain();
    this.maestro.gain.value = this.silenciado ? 0 : 0.85;
    this.maestro.connect(this.contexto.destination);

    this.ruido = this.crearRuido(this.contexto, 2);
    this.hinchada = this.contexto.createGain();
    this.hinchada.gain.value = 0.05;

    const filtro = this.contexto.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 760;

    const fuente = this.contexto.createBufferSource();
    fuente.buffer = this.ruido;
    fuente.loop = true;
    fuente.connect(filtro);
    filtro.connect(this.hinchada);
    this.hinchada.connect(this.maestro);
    fuente.start();
  }

  private crearRuido(contexto: AudioContext, segundos: number): AudioBuffer {
    const muestras = contexto.sampleRate * segundos;
    const buffer = contexto.createBuffer(1, muestras, contexto.sampleRate);
    const datos = buffer.getChannelData(0);
    let anterior = 0;
    for (let i = 0; i < muestras; i++) {
      // Ruido rosa barato: suaviza el blanco para que suene a murmullo.
      anterior = (anterior + (Math.random() * 2 - 1) * 0.12) * 0.985;
      datos[i] = anterior;
    }
    return buffer;
  }

  silenciar(valor: boolean): void {
    this.silenciado = valor;
    if (this.maestro) this.maestro.gain.value = valor ? 0 : 0.85;
  }

  get estaSilenciado(): boolean {
    return this.silenciado;
  }

  /** Sube el murmullo cuando la jugada se pone caliente y lo baja de a poco. */
  ambiente(dt: number, emocion: number): void {
    if (!this.hinchada || !this.contexto) return;
    this.intensidad += (emocion - this.intensidad) * Math.min(1, dt * (emocion > this.intensidad ? 6 : 0.6));
    this.hinchada.gain.setTargetAtTime(0.04 + this.intensidad * 0.3, this.contexto.currentTime, 0.12);
  }

  patada(fuerza: number): void {
    const ctx = this.contexto;
    if (!ctx || !this.maestro) return;
    const ahora = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, ahora);
    osc.frequency.exponentialRampToValueAtTime(60, ahora + 0.09);

    const ganancia = ctx.createGain();
    ganancia.gain.setValueAtTime(Math.min(0.5, 0.18 + fuerza * 0.3), ahora);
    ganancia.gain.exponentialRampToValueAtTime(0.001, ahora + 0.14);

    osc.connect(ganancia);
    ganancia.connect(this.maestro);
    osc.start(ahora);
    osc.stop(ahora + 0.16);
  }

  silbato(largo = 0.28): void {
    const ctx = this.contexto;
    if (!ctx || !this.maestro) return;
    const ahora = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2350, ahora);

    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 26;
    const profundidad = ctx.createGain();
    profundidad.gain.value = 70;
    vibrato.connect(profundidad);
    profundidad.connect(osc.frequency);

    const ganancia = ctx.createGain();
    ganancia.gain.setValueAtTime(0, ahora);
    ganancia.gain.linearRampToValueAtTime(0.16, ahora + 0.02);
    ganancia.gain.setValueAtTime(0.16, ahora + largo - 0.05);
    ganancia.gain.exponentialRampToValueAtTime(0.001, ahora + largo);

    osc.connect(ganancia);
    ganancia.connect(this.maestro);
    osc.start(ahora);
    vibrato.start(ahora);
    osc.stop(ahora + largo + 0.02);
    vibrato.stop(ahora + largo + 0.02);
  }

  gol(): void {
    const ctx = this.contexto;
    if (!ctx || !this.maestro || !this.ruido) return;
    const ahora = ctx.currentTime;

    const fuente = ctx.createBufferSource();
    fuente.buffer = this.ruido;
    fuente.loop = true;

    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.setValueAtTime(420, ahora);
    filtro.frequency.linearRampToValueAtTime(900, ahora + 0.5);
    filtro.Q.value = 0.8;

    const ganancia = ctx.createGain();
    ganancia.gain.setValueAtTime(0, ahora);
    ganancia.gain.linearRampToValueAtTime(0.9, ahora + 0.25);
    ganancia.gain.setValueAtTime(0.9, ahora + 1.6);
    ganancia.gain.exponentialRampToValueAtTime(0.01, ahora + 3.4);

    fuente.connect(filtro);
    filtro.connect(ganancia);
    ganancia.connect(this.maestro);
    fuente.start(ahora);
    fuente.stop(ahora + 3.5);
    this.intensidad = 1;
  }

  atajada(): void {
    this.patada(0.2);
  }

  destruir(): void {
    void this.contexto?.close().catch(() => undefined);
    this.contexto = null;
    this.maestro = null;
    this.hinchada = null;
  }
}
