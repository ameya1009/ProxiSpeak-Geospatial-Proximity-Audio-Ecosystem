import { describe, it, expect } from 'vitest';
import { DistanceGainNode } from '../src/DistanceGainNode';
import { AudioMixer } from '../src/AudioMixer';

describe('Spatial Audio Spike Verification (10-16 Oct Tasks)', () => {
  describe('Distance Gain Calculation', () => {
    it('provides full volume at 0 px distance', () => {
      const gain = DistanceGainNode.calculateGain(0, 100);
      expect(gain).toBe(1.0);
    });

    it('falls smoothly to 0 at 100 px earshot radius', () => {
      const gain = DistanceGainNode.calculateGain(100, 100);
      expect(gain).toBe(0.0);
    });

    it('is completely silent beyond 100 px', () => {
      const gain = DistanceGainNode.calculateGain(120, 100);
      expect(gain).toBe(0.0);
    });

    it('attenuates linearly at mid distance (50 px = 0.5 gain)', () => {
      const gain = DistanceGainNode.calculateGain(50, 100);
      expect(gain).toBeCloseTo(0.5, 2);
    });
  });

  describe('AudioMixer Math', () => {
    it('calculates Euclidean distance correctly', () => {
      const mixer = new AudioMixer();
      const d = mixer.calculateDistance({ x: 0, y: 0 }, { x: 30, y: 40 });
      expect(d).toBe(50);
    });

    it('calculates stereo pan from relative X position', () => {
      const mixer = new AudioMixer();
      expect(mixer.computePan(-100)).toBe(-1.0);
      expect(mixer.computePan(100)).toBe(1.0);
      expect(mixer.computePan(0)).toBe(0.0);
      expect(mixer.computePan(50)).toBe(0.5);
    });
  });
});
