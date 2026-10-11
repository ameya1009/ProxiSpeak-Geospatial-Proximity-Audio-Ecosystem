/**
 * ObstacleAttenuation.ts
 * Computes stereo panning from relative X position and acoustic attenuation through obstacles.
 */

import { Obstacle } from './AudioMixer';

export class ObstacleAttenuation {
  public static calculatePan(dx: number, earshotRadius = 100): number {
    const clamped = Math.max(-earshotRadius, Math.min(earshotRadius, dx));
    return clamped / earshotRadius;
  }

  public static isLineOccluded(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    obstacles: Obstacle[]
  ): boolean {
    for (const obs of obstacles) {
      if (
        this.intersectsSegment(p1, p2, { x: obs.x, y: obs.y }, { x: obs.x + obs.w, y: obs.y }) ||
        this.intersectsSegment(p1, p2, { x: obs.x + obs.w, y: obs.y }, { x: obs.x + obs.w, y: obs.y + obs.h }) ||
        this.intersectsSegment(p1, p2, { x: obs.x + obs.w, y: obs.y + obs.h }, { x: obs.x, y: obs.y + obs.h }) ||
        this.intersectsSegment(p1, p2, { x: obs.x, y: obs.y + obs.h }, { x: obs.x, y: obs.y })
      ) {
        return true;
      }
    }
    return false;
  }

  private static intersectsSegment(
    a1: { x: number; y: number },
    a2: { x: number; y: number },
    b1: { x: number; y: number },
    b2: { x: number; y: number }
  ): boolean {
    const denom = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);
    if (denom === 0) return false;
    const ua = ((b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x)) / denom;
    const ub = ((a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x)) / denom;
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }
}
