/**
 * Generador pseudoaleatorio con semilla (mulberry32).
 * Con la misma semilla, la misma partida: hace falta para guardar y reproducir.
 */
export class Rng {
  private estado: number;

  constructor(seed: number) {
    this.estado = seed >>> 0;
  }

  /** Float en [0, 1). */
  next(): number {
    this.estado = (this.estado + 0x6d2b79f5) >>> 0;
    let t = this.estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entero en [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Barajado Fisher-Yates in place. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Distribucion cuasi-normal (suma de 3 uniformes) recortada al rango. */
  normal(media: number, desvio: number, min: number, max: number): number {
    const u = (this.next() + this.next() + this.next()) / 3;
    const v = media + (u - 0.5) * 2 * desvio * 1.732;
    return Math.max(min, Math.min(max, Math.round(v)));
  }

  chance(prob: number): boolean {
    return this.next() < prob;
  }
}

export function seedAleatoria(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
