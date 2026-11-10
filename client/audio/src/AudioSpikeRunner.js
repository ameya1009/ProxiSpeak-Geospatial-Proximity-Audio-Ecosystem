/**
 * AudioSpikeRunner.js
 * Test Tone Audio Spike Controller (Web Audio API)
 * Simulates a distance slider adjusting gain and stereo panning for a continuous test tone.
 */

const AudioMixer = (typeof require !== 'undefined')
  ? require('./AudioMixer')
  : (typeof window !== 'undefined' ? window.AudioMixer : {});

const {
  calculateDistance = (p1, p2) => Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2),
  calculateGain = (d, r = 100) => (d >= r ? 0 : d <= 0 ? 1 : Math.max(0, 1 - d / r)),
  calculatePan = (dx, r = 100) => Math.max(-r, Math.min(r, dx)) / r,
  createTestTone
} = AudioMixer;

class AudioSpikeRunner {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.nodes = null;
    this.listenerPos = { x: 0, y: 0 };
    this.peerPos = { x: 0, y: 0 };
    this.earshotRadius = 100; // 100px earshot
  }

  start(frequency = 440) {
    if (!this.nodes && this.ctx) {
      this.nodes = createTestTone(this.ctx, frequency);
      this.updateAudio();
    }
    return this.nodes;
  }

  setListenerPosition(x, y) {
    this.listenerPos = { x, y };
    return this.updateAudio();
  }

  setPeerPosition(x, y) {
    this.peerPos = { x, y };
    return this.updateAudio();
  }

  /**
   * Simulates distance slider input: moves peer along X-axis relative to listener.
   */
  setDistanceSlider(deltaX) {
    this.peerPos = { x: this.listenerPos.x + deltaX, y: this.listenerPos.y };
    return this.updateAudio();
  }

  updateAudio() {
    const dist = calculateDistance(this.listenerPos, this.peerPos);
    const targetGain = calculateGain(dist, this.earshotRadius);
    const targetPan = calculatePan(this.peerPos.x - this.listenerPos.x, this.earshotRadius);

    if (this.nodes && this.ctx) {
      const now = this.ctx.currentTime || 0;
      if (this.nodes.gain.gain.setValueAtTime) {
        this.nodes.gain.gain.setValueAtTime(targetGain, now);
      }
      if (this.nodes.panner.pan.setValueAtTime) {
        this.nodes.panner.pan.setValueAtTime(targetPan, now);
      }
    }

    return { distance: dist, gain: targetGain, pan: targetPan };
  }

  stop() {
    if (this.nodes && this.nodes.osc) {
      try {
        this.nodes.osc.stop();
      } catch (e) {}
      this.nodes = null;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioSpikeRunner };
} else if (typeof window !== 'undefined') {
  window.AudioSpikeRunner = AudioSpikeRunner;
}
