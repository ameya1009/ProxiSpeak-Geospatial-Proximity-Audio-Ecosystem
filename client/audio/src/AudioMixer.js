/**
 * AudioMixer.js
 * Ameya's Audio Spike implementation (Web Audio API):
 * Audio node graph: OscillatorNode -> StereoPannerNode -> GainNode -> destination.
 *
 * Provides:
 * - calculateDistance(p1, p2): Euclidean pixel distance
 * - calculateGain(distance, earshotRadius): Linear attenuation (1.0 at 0px to 0.0 at earshotRadius)
 * - calculatePan(dx, earshotRadius): Stereo pan (-1.0 to 1.0)
 * - createTestTone(ctx, freq): Creates connected spike oscillator and nodes
 */

function calculateDistance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function calculateGain(distance, earshotRadius = 100) {
  if (distance >= earshotRadius) return 0.0;
  if (distance <= 0) return 1.0;
  return Math.max(0, 1 - (distance / earshotRadius));
}

function calculatePan(dx, earshotRadius = 100) {
  const clamped = Math.max(-earshotRadius, Math.min(earshotRadius, dx));
  return clamped / earshotRadius;
}

function createTestTone(audioContext, frequency = 440) {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const panner = audioContext.createStereoPanner();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, audioContext.currentTime);

  osc.connect(panner);
  panner.connect(gain);
  gain.connect(audioContext.destination);

  osc.start();
  return { osc, gain, panner };
}

module.exports = {
  calculateDistance,
  calculateGain,
  calculatePan,
  createTestTone
};
