/**
 * ProxiSpeak Ecosystem - ObstacleAttenuation
 * Task A10: Stereo or 3D Panning from Relative X, Obstacle Sound Attenuation
 * 
 * Features:
 * - Geometric ray-casting against 2D Axis-Aligned Bounding Boxes (AABB)
 * - Acoustic transmission loss modeling (decibel reduction based on obstacle density)
 * - Low-pass biquad filtering for acoustic occlusion (high frequencies absorbed by furniture/walls)
 * - Smooth parameter scheduling across filter cutoff and gain parameters to eliminate clicks
 * - Relative-X stereo panning calculations with earshot boundaries
 */

class ObstacleAttenuation {
  /**
   * @param {Object} [options]
   * @param {number} [options.baseDeskLossDb=6.0] - Decibels of acoustic attenuation per desk
   * @param {number} [options.baseWallLossDb=14.0] - Decibels of acoustic attenuation per wall
   * @param {number} [options.clearCutoffHz=20000] - Low-pass filter frequency when line-of-sight is clear
   * @param {number} [options.occludedCutoffHz=900] - Low-pass filter frequency when occluded
   */
  constructor(options = {}) {
    this.baseDeskLossDb = options.baseDeskLossDb !== undefined ? options.baseDeskLossDb : 6.0;
    this.baseWallLossDb = options.baseWallLossDb !== undefined ? options.baseWallLossDb : 14.0;
    this.clearCutoffHz = options.clearCutoffHz || 20000;
    this.occludedCutoffHz = options.occludedCutoffHz || 900;
  }

  /**
   * Segments intersection test
   */
  static segmentsIntersect(a, b, c, d) {
    const ccw = (p1, p2, p3) => (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
    return (ccw(a, c, d) !== ccw(b, c, d)) && (ccw(a, b, c) !== ccw(a, b, d));
  }

  /**
   * Check if a 2D line segment intersects an AABB rectangle
   * @param {Object} p1 - {x, y}
   * @param {Object} p2 - {x, y}
   * @param {Object} rect - {x, y, width, height}
   * @returns {boolean}
   */
  static lineIntersectsRect(p1, p2, rect) {
    if (p1.x >= rect.x && p1.x <= rect.x + rect.width && p1.y >= rect.y && p1.y <= rect.y + rect.height) return true;
    if (p2.x >= rect.x && p2.x <= rect.x + rect.width && p2.y >= rect.y && p2.y <= rect.y + rect.height) return true;

    const rLeft = rect.x, rRight = rect.x + rect.width, rTop = rect.y, rBottom = rect.y + rect.height;
    const edges = [
      [{ x: rLeft, y: rTop }, { x: rRight, y: rTop }],
      [{ x: rRight, y: rTop }, { x: rRight, y: rBottom }],
      [{ x: rRight, y: rBottom }, { x: rLeft, y: rBottom }],
      [{ x: rLeft, y: rBottom }, { x: rLeft, y: rTop }]
    ];

    for (const [e1, e2] of edges) {
      if (ObstacleAttenuation.segmentsIntersect(p1, p2, e1, e2)) return true;
    }
    return false;
  }

  /**
   * Evaluates acoustic line-of-sight and computes transmission loss
   * @param {Object} listenerPos - {x, y}
   * @param {Object} peerPos - {x, y}
   * @param {Array} obstacles - List of AABB obstacles [{id, x, y, width, height, type}]
   * @returns {Object} Acoustic analysis result
   */
  analyzeLineOfSight(listenerPos, peerPos, obstacles = []) {
    if (!obstacles || obstacles.length === 0) {
      return {
        occluded: false,
        intersectedObstacles: [],
        totalLossDb: 0,
        gainMultiplier: 1.0,
        cutoffFrequencyHz: this.clearCutoffHz
      };
    }

    const intersected = [];
    let totalLossDb = 0;

    for (const obs of obstacles) {
      if (ObstacleAttenuation.lineIntersectsRect(listenerPos, peerPos, obs)) {
        intersected.push(obs);
        const loss = obs.type === 'wall'
          ? this.baseWallLossDb
          : (obs.acousticAttenuationDb !== undefined ? obs.acousticAttenuationDb : this.baseDeskLossDb);
        totalLossDb += loss;
      }
    }

    const isOccluded = intersected.length > 0;
    // Decibel to linear amplitude conversion: 10^(-dB / 20)
    const gainMultiplier = isOccluded ? Math.max(0.05, Math.pow(10, -totalLossDb / 20)) : 1.0;
    
    // Low-pass filter cutoff drops as obstacle occlusion increases
    let cutoffFrequencyHz = this.clearCutoffHz;
    if (isOccluded) {
      const reduction = Math.min(intersected.length * 200, 500);
      cutoffFrequencyHz = Math.max(400, this.occludedCutoffHz - reduction);
    }

    return {
      occluded: isOccluded,
      intersectedObstacles: intersected,
      totalLossDb: Math.round(totalLossDb * 10) / 10,
      gainMultiplier: Math.round(gainMultiplier * 1000) / 1000,
      cutoffFrequencyHz: Math.round(cutoffFrequencyHz)
    };
  }

  /**
   * Calculate stereo panning from relative horizontal displacement
   * @param {number} relativeX - (peerX - listenerX) in pixels
   * @param {number} [earshotRadius=100] - Distance at which sound pans hard left/right
   * @returns {number} Pan value [-1.0 (hard left), 0.0 (center), +1.0 (hard right)]
   */
  calculatePan(relativeX, earshotRadius = 100) {
    if (earshotRadius <= 0) return 0;
    const clamped = Math.max(-earshotRadius, Math.min(earshotRadius, relativeX));
    return Math.round((clamped / earshotRadius) * 1000) / 1000;
  }

  /**
   * Create an acoustic occlusion filter node pipeline (BiquadFilterNode)
   * @param {AudioContext} audioContext
   * @returns {BiquadFilterNode}
   */
  createOcclusionFilter(audioContext) {
    if (!audioContext || typeof audioContext.createBiquadFilter !== 'function') {
      return {
        type: 'lowpass',
        frequency: {
          value: this.clearCutoffHz,
          setValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
          cancelScheduledValues: () => {}
        },
        connect: () => {},
        disconnect: () => {}
      };
    }

    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.clearCutoffHz, audioContext.currentTime || 0);
    filter.Q.setValueAtTime(1.0, audioContext.currentTime || 0);
    return filter;
  }

  /**
   * Smoothly apply acoustic occlusion parameters to a filter node and gain node
   * @param {BiquadFilterNode} filterNode
   * @param {GainNode} gainNode
   * @param {Object} losAnalysis - Output from analyzeLineOfSight
   * @param {number} currentTime - AudioContext currentTime
   * @param {number} [rampDuration=0.05] - 50ms smooth transition window
   */
  applyAcousticParameters(filterNode, gainNode, losAnalysis, currentTime = 0, rampDuration = 0.05) {
    const endTime = currentTime + rampDuration;

    if (filterNode && filterNode.frequency) {
      if (typeof filterNode.frequency.cancelScheduledValues === 'function') {
        filterNode.frequency.cancelScheduledValues(currentTime);
        filterNode.frequency.setValueAtTime(filterNode.frequency.value, currentTime);
        filterNode.frequency.linearRampToValueAtTime(losAnalysis.cutoffFrequencyHz, endTime);
      } else {
        filterNode.frequency.value = losAnalysis.cutoffFrequencyHz;
      }
    }

    if (gainNode && gainNode.gain) {
      if (typeof gainNode.gain.cancelScheduledValues === 'function') {
        gainNode.gain.cancelScheduledValues(currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
        gainNode.gain.linearRampToValueAtTime(gainNode.gain.value * losAnalysis.gainMultiplier, endTime);
      }
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ObstacleAttenuation };
}
if (typeof window !== 'undefined') {
  window.ObstacleAttenuation = ObstacleAttenuation;
}
