import { describe, it, expect } from 'vitest';
import { DistanceGainNode } from '../src/DistanceGainNode';
import { ObstacleAttenuation } from '../src/ObstacleAttenuation';
import { ConnectionCapper } from '../src/ConnectionCapper';

describe('Spatial Audio & WebRTC Module Verification', () => {
  describe('DistanceGainNode', () => {
    it('provides full volume at 0 px distance', () => {
      const gain = DistanceGainNode.calculateGain(0, 100);
      expect(gain).toBe(1.0);
    });

    it('falls smoothly to 0 at 100 px distance', () => {
      const gain = DistanceGainNode.calculateGain(100, 100);
      expect(gain).toBe(0.0);
    });

    it('is completely silent beyond 100 px', () => {
      const gain = DistanceGainNode.calculateGain(120, 100);
      expect(gain).toBe(0.0);
    });

    it('attenuates linearly at mid distances', () => {
      const gain = DistanceGainNode.calculateGain(50, 100);
      expect(gain).toBeCloseTo(0.5, 2);
    });
  });

  describe('ObstacleAttenuation & Stereo Panning', () => {
    it('pans audio left when peer is to the left', () => {
      const pan = ObstacleAttenuation.calculatePan(-100, 100);
      expect(pan).toBe(-1.0);
    });

    it('pans audio right when peer is to the right', () => {
      const pan = ObstacleAttenuation.calculatePan(100, 100);
      expect(pan).toBe(1.0);
    });

    it('centers audio when delta X is 0', () => {
      const pan = ObstacleAttenuation.calculatePan(0, 100);
      expect(pan).toBe(0.0);
    });

    it('detects occlusion when line-of-sight intersects a wall obstacle', () => {
      const p1 = { x: 10, y: 50 };
      const p2 = { x: 90, y: 50 };
      const obstacles = [{ x: 40, y: 20, w: 20, h: 60 }]; // Wall in between
      const occluded = ObstacleAttenuation.isLineOccluded(p1, p2, obstacles);
      expect(occluded).toBe(true);
    });

    it('does not report occlusion when line-of-sight is unobstructed', () => {
      const p1 = { x: 10, y: 10 };
      const p2 = { x: 30, y: 10 };
      const obstacles = [{ x: 50, y: 50, w: 20, h: 20 }];
      const occluded = ObstacleAttenuation.isLineOccluded(p1, p2, obstacles);
      expect(occluded).toBe(false);
    });
  });

  describe('ConnectionCapper', () => {
    it('caps active connections to N nearest peers', () => {
      const capper = new ConnectionCapper(3, 20);
      const candidates = [
        { peerId: 'p1', distance: 30 },
        { peerId: 'p2', distance: 10 },
        { peerId: 'p3', distance: 75 },
        { peerId: 'p4', distance: 50 },
        { peerId: 'p5', distance: 95 }
      ];
      const active = capper.selectActivePeers(candidates, new Set(), 100);
      expect(active).toEqual(['p2', 'p1', 'p4']);
    });

    it('applies hysteresis so existing connections are not dropped abruptly at 105 px', () => {
      const capper = new ConnectionCapper(5, 20);
      const candidates = [
        { peerId: 'existing-p1', distance: 110 }
      ];
      // When existing-p1 is already connected, 110 <= 100 + 20 is accepted
      const active = capper.selectActivePeers(candidates, new Set(['existing-p1']), 100);
      expect(active).toContain('existing-p1');

      // For a new peer, 110 px is beyond 100 px and rejected
      const activeNew = capper.selectActivePeers(candidates, new Set(), 100);
      expect(activeNew).toHaveLength(0);
    });
  });
});
