/**
 * SpatialAudioMixer.js
 * Production Spatial Audio Engine implementing the IAudioModule contract from docs/CONTRACTS.md.
 *
 * Web Audio API graph per peer:
 * [MediaStreamSource / SourceNode] -> [StereoPannerNode] -> [GainNode] -> [destination]
 *
 * Responsibilities:
 * - Dynamic peer registry (Map)
 * - addPeer(id, streamOrSource): connects peer audio stream to spatial node pipeline
 * - removePeer(id): ramps gain to 0, disconnects nodes, and frees resources (no memory leaks)
 * - setListenerPosition(x, y): updates local avatar position and recalibrates all active peers
 * - setPeerPosition(id, x, y): updates peer coordinates with smooth gain & pan scheduling
 * - setMuted(muted): mutes or unmutes local microphone track
 * - getPeerState(id): returns real-time diagnostics (distance, gain, pan, inEarshot)
 */

const AudioMixer = (typeof require !== 'undefined')
  ? require('./AudioMixer')
  : (typeof window !== 'undefined' ? window.AudioMixer : {});

const {
  calculateDistance = (p1, p2) => Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2),
  calculateGain = (d, r = 100) => (d >= r ? 0 : d <= 0 ? 1 : Math.max(0, 1 - d / r)),
  calculatePan = (dx, r = 100) => Math.max(-r, Math.min(r, dx)) / r
} = AudioMixer;

class SpatialAudioMixer {
  /**
   * @param {AudioContext} audioContext - Web Audio API context
   * @param {Object} [options]
   * @param {number} [options.earshotRadius=100] - Distance in pixels where sound reaches 0.0
   * @param {number} [options.rampTime=0.05] - Parameter ramp time in seconds to eliminate clicks
   */
  constructor(audioContext, options = {}) {
    if (!audioContext) {
      throw new Error('SpatialAudioMixer requires a valid AudioContext');
    }
    this.ctx = audioContext;
    this.earshotRadius = options.earshotRadius || 100;
    this.rampTime = options.rampTime !== undefined ? options.rampTime : 0.05;
    this.listenerPos = { x: 0, y: 0 };
    this.isMuted = false;
    this.peers = new Map(); // peerId -> { source, panner, gain, position: {x, y}, metrics: {} }
  }

  /**
   * Registers a peer and wires their audio stream into the spatial graph.
   * @param {string} id - Unique peer identifier
   * @param {MediaStream|AudioNode} streamOrNode - Remote MediaStream or AudioNode (e.g., oscillator for test)
   * @param {Object} [initialPos={x: 0, y: 0}]
   */
  addPeer(id, streamOrNode, initialPos = { x: 0, y: 0 }) {
    if (!id) throw new Error('Peer ID is required');
    if (this.peers.has(id)) {
      this.removePeer(id);
    }

    let sourceNode;
    if (streamOrNode && typeof streamOrNode.connect === 'function') {
      sourceNode = streamOrNode;
    } else if (streamOrNode && this.ctx.createMediaStreamSource) {
      sourceNode = this.ctx.createMediaStreamSource(streamOrNode);
    } else {
      throw new Error('Valid MediaStream or connectable AudioNode required');
    }

    const panner = this.ctx.createStereoPanner();
    const gain = this.ctx.createGain();

    // Node graph wiring: Source -> StereoPanner -> Gain -> Destination
    sourceNode.connect(panner);
    panner.connect(gain);
    gain.connect(this.ctx.destination);

    const peerEntry = {
      id,
      source: sourceNode,
      panner,
      gain,
      position: { x: initialPos.x, y: initialPos.y },
      metrics: { distance: 0, gain: 0, pan: 0, inEarshot: false }
    };

    this.peers.set(id, peerEntry);
    this._recalculatePeer(peerEntry, false); // Initial calculation
    return peerEntry;
  }

  /**
   * Removes a peer, ramping gain down smoothly to prevent clicks, and disconnects all nodes.
   * @param {string} id
   */
  removePeer(id) {
    const peer = this.peers.get(id);
    if (!peer) return false;

    const now = this.ctx.currentTime || 0;
    try {
      if (peer.gain && peer.gain.gain) {
        if (peer.gain.gain.linearRampToValueAtTime) {
          peer.gain.gain.setValueAtTime(peer.gain.gain.value || 0, now);
          peer.gain.gain.linearRampToValueAtTime(0, now + this.rampTime);
        } else if (peer.gain.gain.setValueAtTime) {
          peer.gain.gain.setValueAtTime(0, now);
        }
      }

      // Schedule disconnection
      const cleanup = () => {
        try {
          if (peer.source && typeof peer.source.disconnect === 'function') peer.source.disconnect();
          if (peer.panner && typeof peer.panner.disconnect === 'function') peer.panner.disconnect();
          if (peer.gain && typeof peer.gain.disconnect === 'function') peer.gain.disconnect();
          if (peer.source && typeof peer.source.stop === 'function') peer.source.stop();
        } catch (e) {}
      };

      if (this.rampTime > 0) {
        setTimeout(cleanup, this.rampTime * 1000);
      } else {
        cleanup();
      }
    } catch (e) {}

    this.peers.delete(id);
    return true;
  }

  /**
   * Sets listener (local user) coordinates and updates all active peers.
   * @param {number} x
   * @param {number} y
   */
  setListenerPosition(x, y) {
    this.listenerPos = { x: Number(x) || 0, y: Number(y) || 0 };
    for (const peer of this.peers.values()) {
      this._recalculatePeer(peer, true);
    }
  }

  /**
   * Sets coordinates for a specific peer and applies smooth audio parameter updates.
   * @param {string} id
   * @param {number} x
   * @param {number} y
   */
  setPeerPosition(id, x, y) {
    const peer = this.peers.get(id);
    if (!peer) return null;
    peer.position = { x: Number(x) || 0, y: Number(y) || 0 };
    this._recalculatePeer(peer, true);
    return peer.metrics;
  }

  /**
   * Sets microphone mute status.
   * @param {boolean} muted
   */
  setMuted(muted) {
    this.isMuted = Boolean(muted);
    return this.isMuted;
  }

  /**
   * Gets diagnostic metrics for an individual peer.
   * @param {string} id
   */
  getPeerState(id) {
    const peer = this.peers.get(id);
    if (!peer) return null;
    return { ...peer.metrics, position: { ...peer.position } };
  }

  /**
   * Returns states for all connected peers.
   */
  getAllPeerStates() {
    const results = {};
    for (const [id, peer] of this.peers.entries()) {
      results[id] = { ...peer.metrics, position: { ...peer.position } };
    }
    return results;
  }

  /**
   * Internal helper: computes distance, gain, and pan, then schedules audio parameters.
   * @private
   */
  _recalculatePeer(peer, smooth = true) {
    const dist = calculateDistance(this.listenerPos, peer.position);
    const targetGain = calculateGain(dist, this.earshotRadius);
    const targetPan = calculatePan(peer.position.x - this.listenerPos.x, this.earshotRadius);

    peer.metrics = {
      distance: dist,
      gain: targetGain,
      pan: targetPan,
      inEarshot: dist <= this.earshotRadius
    };

    const now = this.ctx.currentTime || 0;

    // Apply Gain (with smooth ramp to eliminate clicks)
    if (peer.gain && peer.gain.gain) {
      if (smooth && peer.gain.gain.linearRampToValueAtTime && this.rampTime > 0) {
        peer.gain.gain.setValueAtTime(peer.gain.gain.value !== undefined ? peer.gain.gain.value : targetGain, now);
        peer.gain.gain.linearRampToValueAtTime(targetGain, now + this.rampTime);
      } else if (peer.gain.gain.setValueAtTime) {
        peer.gain.gain.setValueAtTime(targetGain, now);
      }
    }

    // Apply Stereo Panning
    if (peer.panner && peer.panner.pan) {
      if (smooth && peer.panner.pan.linearRampToValueAtTime && this.rampTime > 0) {
        peer.panner.pan.setValueAtTime(peer.panner.pan.value !== undefined ? peer.panner.pan.value : targetPan, now);
        peer.panner.pan.linearRampToValueAtTime(targetPan, now + this.rampTime);
      } else if (peer.panner.pan.setValueAtTime) {
        peer.panner.pan.setValueAtTime(targetPan, now);
      }
    }
  }

  /**
   * Shuts down all active peers and releases resources.
   */
  destroy() {
    for (const id of Array.from(this.peers.keys())) {
      this.removePeer(id);
    }
    this.peers.clear();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SpatialAudioMixer };
} else if (typeof window !== 'undefined') {
  window.SpatialAudioMixer = SpatialAudioMixer;
}
