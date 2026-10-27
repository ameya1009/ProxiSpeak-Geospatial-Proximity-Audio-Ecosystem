/**
 * ProxiSpeak Ecosystem - DistanceGainNode
 * Task A8: Route remote streams through Web Audio: gain by distance with smooth ramps
 * 
 * Features:
 * - Direct routing of MediaStream (via MediaStreamAudioSourceNode) or AudioNode into Web Audio graph
 * - Attenuation curve models: 'linear', 'inverse', 'exponential'
 * - Smooth parameter scheduling (cancelScheduledValues + linearRampToValueAtTime / exponentialRampToValueAtTime)
 * - Click-prevention smoothing window (default 50ms)
 * - Distance gating / cutoff beyond earshot radius
 * - Complete mute/unmute and volume controls
 */

class DistanceGainNode {
  /**
   * @param {AudioContext} audioContext - Web Audio API context
   * @param {Object} [options]
   * @param {number} [options.minDistance=30] - Distance within which audio is at full gain (1.0)
   * @param {number} [options.maxDistance=100] - Distance at which audio is completely inaudible (0.0)
   * @param {string} [options.rolloffModel='linear'] - 'linear' | 'inverse' | 'exponential'
   * @param {number} [options.rolloffFactor=1.0] - Attenuation steepness factor
   * @param {number} [options.rampTime=0.05] - Smoothing ramp duration in seconds (50ms)
   * @param {AudioNode} [options.destination] - Custom audio destination (defaults to audioContext.destination)
   */
  constructor(audioContext, options = {}) {
    if (!audioContext) {
      throw new Error('DistanceGainNode requires a valid AudioContext.');
    }

    this.context = audioContext;
    this.minDistance = options.minDistance !== undefined ? options.minDistance : 30;
    this.maxDistance = options.maxDistance !== undefined ? options.maxDistance : 100;
    this.rolloffModel = options.rolloffModel || 'linear';
    this.rolloffFactor = options.rolloffFactor !== undefined ? options.rolloffFactor : 1.0;
    this.rampTime = options.rampTime !== undefined ? options.rampTime : 0.05; // 50ms ramp
    this.destination = options.destination || audioContext.destination;

    // Internal Web Audio nodes
    this.gainNode = this.context.createGain ? this.context.createGain() : {
      gain: {
        value: 1.0,
        setValueAtTime: (v, t) => { this.gainNode.gain.value = v; },
        linearRampToValueAtTime: (v, t) => { this.gainNode.gain.value = v; },
        exponentialRampToValueAtTime: (v, t) => { this.gainNode.gain.value = v; },
        cancelScheduledValues: (t) => {}
      },
      connect: (dest) => {},
      disconnect: () => {}
    };

    // Initialize gain node
    if (this.gainNode.gain && this.gainNode.gain.setValueAtTime) {
      const now = this.context.currentTime || 0;
      this.gainNode.gain.setValueAtTime(1.0, now);
    }
    if (this.gainNode.connect && this.destination) {
      this.gainNode.connect(this.destination);
    }

    this.sourceNode = null;
    this.stream = null;
    this.currentDistance = 0;
    this.targetGain = 1.0;
    this.currentGain = 1.0;
    this.muted = false;
    this.userVolume = 1.0;
    this.lastRampSchedule = null;
  }

  /**
   * Route a remote MediaStream from WebRTC peer connection
   * @param {MediaStream} mediaStream
   * @returns {AudioNode} the created source node
   */
  routeStream(mediaStream) {
    if (!mediaStream) {
      throw new Error('routeStream requires a valid MediaStream.');
    }

    // Disconnect any existing source
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (e) {}
      this.sourceNode = null;
    }

    this.stream = mediaStream;
    if (typeof this.context.createMediaStreamSource === 'function') {
      this.sourceNode = this.context.createMediaStreamSource(mediaStream);
      this.sourceNode.connect(this.gainNode);
    } else {
      // Mock / fallback for testing
      this.sourceNode = {
        name: 'MediaStreamAudioSourceNode',
        stream: mediaStream,
        connect: (target) => {},
        disconnect: () => {}
      };
    }

    return this.sourceNode;
  }

  /**
   * Attach an arbitrary AudioNode (e.g. Oscillator, BufferSource)
   * @param {AudioNode} audioNode
   */
  attachSource(audioNode) {
    if (!audioNode) {
      throw new Error('attachSource requires a valid AudioNode.');
    }

    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (e) {}
      this.sourceNode = null;
    }

    this.sourceNode = audioNode;
    if (typeof audioNode.connect === 'function') {
      audioNode.connect(this.gainNode);
    }
    return this.sourceNode;
  }

  /**
   * Calculate mathematical distance attenuation gain
   * @param {number} distance - Euclidean pixel distance
   * @returns {number} normalized gain [0.0, 1.0]
   */
  calculateAttenuation(distance) {
    const d = Math.max(0, distance);

    // If within minimum distance, audio is unattenuated
    if (d <= this.minDistance) {
      return 1.0;
    }

    // If beyond maximum earshot distance, completely inaudible
    if (d >= this.maxDistance) {
      return 0.0;
    }

    switch (this.rolloffModel) {
      case 'inverse': {
        // Inverse distance formula: minDistance / (minDistance + rolloffFactor * (d - minDistance))
        const effectiveDist = d - this.minDistance;
        const gain = this.minDistance / (this.minDistance + this.rolloffFactor * effectiveDist);
        // Cutoff taper towards maxDistance
        const cutoffRatio = (this.maxDistance - d) / (this.maxDistance - this.minDistance);
        return Math.max(0, Math.min(1.0, gain * cutoffRatio));
      }

      case 'exponential': {
        // Exponential decay: e^(-rolloffFactor * (d - minDistance) / span)
        const span = this.maxDistance - this.minDistance;
        const normalized = (d - this.minDistance) / span;
        const gain = Math.exp(-3.0 * this.rolloffFactor * normalized);
        // Taper to 0 at boundary
        return Math.max(0, Math.min(1.0, gain * (1.0 - normalized)));
      }

      case 'linear':
      default: {
        // Linear slope: 1.0 at minDistance down to 0.0 at maxDistance
        const span = this.maxDistance - this.minDistance;
        const gain = 1.0 - (d - this.minDistance) / span;
        return Math.max(0, Math.min(1.0, gain));
      }
    }
  }

  /**
   * Update avatar distance with smooth parameter ramping
   * Prevents audio popping and clicks using linearRampToValueAtTime or exponentialRampToValueAtTime
   * @param {number} distance - Distance to remote peer in pixels
   * @param {number} [rampDuration] - Optional custom ramp duration in seconds
   * @returns {number} the newly scheduled target gain
   */
  updateDistance(distance, rampDuration) {
    this.currentDistance = Math.max(0, distance);
    const attenuation = this.calculateAttenuation(this.currentDistance);
    const targetGain = this.muted ? 0.0 : attenuation * this.userVolume;
    this.targetGain = targetGain;

    const duration = rampDuration !== undefined ? rampDuration : this.rampTime;
    const now = this.context.currentTime || 0;
    const endTime = now + duration;

    if (this.gainNode && this.gainNode.gain) {
      const param = this.gainNode.gain;
      if (typeof param.cancelScheduledValues === 'function') {
        param.cancelScheduledValues(now);
      }

      if (typeof param.setValueAtTime === 'function') {
        // Set anchor value at current time to prevent discontinuity jumps
        param.setValueAtTime(this.currentGain, now);
      }

      if (targetGain > 0.0001 && typeof param.exponentialRampToValueAtTime === 'function' && this.rolloffModel === 'exponential') {
        param.exponentialRampToValueAtTime(Math.max(0.0001, targetGain), endTime);
      } else if (typeof param.linearRampToValueAtTime === 'function') {
        param.linearRampToValueAtTime(targetGain, endTime);
      } else if (typeof param.setValueAtTime === 'function') {
        param.setValueAtTime(targetGain, endTime);
      }
    }

    this.currentGain = targetGain;
    this.lastRampSchedule = {
      startTime: now,
      endTime: endTime,
      targetGain: targetGain,
      duration: duration
    };

    return targetGain;
  }

  /**
   * Set user/master volume multiplier
   * @param {number} volume - Volume [0.0, 1.0]
   */
  setVolume(volume) {
    this.userVolume = Math.max(0, Math.min(1.0, volume));
    return this.updateDistance(this.currentDistance);
  }

  /**
   * Mute audio smoothly
   * @param {number} [rampDuration=0.03] - Rapid 30ms ramp down to avoid clicks
   */
  mute(rampDuration = 0.03) {
    this.muted = true;
    return this.updateDistance(this.currentDistance, rampDuration);
  }

  /**
   * Unmute audio smoothly
   * @param {number} [rampDuration=0.05]
   */
  unmute(rampDuration = 0.05) {
    this.muted = false;
    return this.updateDistance(this.currentDistance, rampDuration);
  }

  /**
   * Check if current distance is within audible range
   * @returns {boolean}
   */
  isInAudibleRange() {
    return this.currentDistance < this.maxDistance;
  }

  /**
   * Return full diagnostics object
   */
  getDiagnostics() {
    return {
      currentDistance: this.currentDistance,
      minDistance: this.minDistance,
      maxDistance: this.maxDistance,
      rolloffModel: this.rolloffModel,
      currentGain: this.currentGain,
      targetGain: this.targetGain,
      muted: this.muted,
      userVolume: this.userVolume,
      hasSource: !!this.sourceNode,
      inRange: this.isInAudibleRange(),
      lastRampSchedule: this.lastRampSchedule
    };
  }

  /**
   * Clean up and disconnect all Web Audio nodes
   */
  destroy() {
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (e) {}
      this.sourceNode = null;
    }
    if (this.gainNode) {
      try { this.gainNode.disconnect(); } catch (e) {}
    }
    this.stream = null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DistanceGainNode };
}
if (typeof window !== 'undefined') {
  window.DistanceGainNode = DistanceGainNode;
}
