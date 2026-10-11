/**
 * DistanceGainNode.ts
 * Dedicated distance-gain calculator with smooth exponential ramps to eliminate clicks.
 */

export class DistanceGainNode {
  public static calculateGain(distance: number, maxRadius = 100): number {
    if (distance >= maxRadius) return 0.0;
    if (distance <= 0) return 1.0;
    // Linear falloff curve: volume falls from 1.0 at 0px to 0.0 at 100px
    return Math.max(0, 1 - (distance / maxRadius));
  }

  public static applySmoothRamp(param: AudioParam, targetValue: number, currentTime: number, timeConstant = 0.05): void {
    param.cancelScheduledValues(currentTime);
    param.setTargetAtTime(targetValue, currentTime, timeConstant);
  }
}
