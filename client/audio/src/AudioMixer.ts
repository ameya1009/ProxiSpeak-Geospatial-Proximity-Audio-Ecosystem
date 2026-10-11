/**
 * AudioMixer.ts
 * Spatial Audio Mixer implementing Web Audio API node graph:
 * [MediaStreamSource] -> [StereoPannerNode] -> [GainNode] -> [AudioContext.destination]
 *
 * Implements the agreed contract for Ameya's audio module API:
 * - addPeer(id, stream)
 * - removePeer(id)
 * - setListenerPosition(x, y)
 * - setPeerPosition(id, x, y)
 */

export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  attenuationFactor?: number; // e.g. 0.3 for a heavy wall
}

export interface PeerAudioNode {
  id: string;
  stream: MediaStream;
  sourceNode: MediaStreamAudioSourceNode;
  pannerNode: StereoPannerNode;
  gainNode: GainNode;
  position: { x: number; y: number };
}

export class AudioMixer {
  private ctx: AudioContext | null = null;
  private listenerPos: { x: number; y: number } = { x: 0, y: 0 };
  private peers: Map<string, PeerAudioNode> = new Map();
  private obstacles: Obstacle[] = [];
  
  // Audio configuration parameters per specification
  public readonly EARSHOT_RADIUS = 100; // px
  public readonly HYSTERESIS_RADIUS = 120; // px
  public readonly RAMP_TIME_CONSTANT = 0.05; // 50ms smooth exponential ramp (no clicks)

  constructor(audioContext?: AudioContext) {
    if (audioContext) {
      this.ctx = audioContext;
    }
  }

  /**
   * Initializes or resumes the AudioContext (requires browser user interaction).
   */
  public ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Sets obstacles loaded from Milind's room layout for sound occlusion.
   */
  public setObstacles(obstacles: Obstacle[]): void {
    this.obstacles = obstacles;
    this.recalculateAllPeers();
  }

  /**
   * Updates local listener position (Harpreet's avatar position).
   */
  public setListenerPosition(x: number, y: number): void {
    this.listenerPos = { x, y };
    this.recalculateAllPeers();
  }

  /**
   * Registers a peer's WebRTC stream into the Web Audio API graph.
   */
  public addPeer(id: string, stream: MediaStream): void {
    const ctx = this.ensureContext();

    // Clean up any existing node for this peer
    this.removePeer(id);

    const sourceNode = ctx.createMediaStreamSource(stream);
    const pannerNode = ctx.createStereoPanner();
    const gainNode = ctx.createGain();

    // Initial silent state until position updated
    gainNode.gain.setValueAtTime(0, ctx.currentTime);

    // Audio Graph routing: Source -> StereoPanner -> Gain -> Destination
    sourceNode.connect(pannerNode);
    pannerNode.connect(gainNode);
    gainNode.connect(ctx.destination);

    this.peers.set(id, {
      id,
      stream,
      sourceNode,
      pannerNode,
      gainNode,
      position: { x: this.listenerPos.x, y: this.listenerPos.y }
    });

    this.updatePeerAudio(id);
  }

  /**
   * Removes peer audio nodes and disconnects Web Audio graph.
   */
  public removePeer(id: string): void {
    const peer = this.peers.get(id);
    if (!peer) return;

    try {
      peer.sourceNode.disconnect();
      peer.pannerNode.disconnect();
      peer.gainNode.disconnect();
    } catch (e) {
      // Ignore disconnect errors during teardown
    }

    this.peers.delete(id);
  }

  /**
   * Sets an in-range peer's position and recalculates spatial audio parameters.
   */
  public setPeerPosition(id: string, x: number, y: number): void {
    const peer = this.peers.get(id);
    if (!peer) return;

    peer.position = { x, y };
    this.updatePeerAudio(id);
  }

  /**
   * Calculate Euclidean distance between listener and peer.
   */
  public calculateDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Computes gain attenuation [0.0 - 1.0] using an inverse linear curve with smooth cutoff.
   * Full volume at 0 px, falling smoothly to 0.0 (silent) at EARSHOT_RADIUS (100 px).
   */
  public computeGain(distance: number, occluded: boolean = false): number {
    if (distance >= this.EARSHOT_RADIUS) {
      return 0.0;
    }
    // Linear falloff: 1 at d=0, 0 at d=EARSHOT_RADIUS
    let gain = Math.max(0, 1 - (distance / this.EARSHOT_RADIUS));
    // Apply additional wall/obstacle dampening if occluded
    if (occluded) {
      gain *= 0.35; // 65% extra sound attenuation through walls
    }
    return Math.min(1.0, Math.max(0.0, gain));
  }

  /**
   * Computes stereo pan [-1.0 (hard left) to +1.0 (hard right)] based on relative X delta.
   */
  public computePan(dx: number): number {
    const clampedDx = Math.max(-this.EARSHOT_RADIUS, Math.min(this.EARSHOT_RADIUS, dx));
    return clampedDx / this.EARSHOT_RADIUS;
  }

  /**
   * Check if a 2D line segment intersects any obstacle rectangle (line of sight check).
   */
  public isOccluded(p1: { x: number; y: number }, p2: { x: number; y: number }): boolean {
    for (const obs of this.obstacles) {
      if (this.lineIntersectsRect(p1, p2, obs)) {
        return true;
      }
    }
    return false;
  }

  private lineIntersectsRect(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    r: Obstacle
  ): boolean {
    // Check bounding box corners: top, bottom, left, right edges
    const left = r.x;
    const right = r.x + r.w;
    const top = r.y;
    const bottom = r.y + r.h;

    return (
      this.linesIntersect(p1.x, p1.y, p2.x, p2.y, left, top, right, top) ||
      this.linesIntersect(p1.x, p1.y, p2.x, p2.y, right, top, right, bottom) ||
      this.linesIntersect(p1.x, p1.y, p2.x, p2.y, right, bottom, left, bottom) ||
      this.linesIntersect(p1.x, p1.y, p2.x, p2.y, left, bottom, left, top)
    );
  }

  private linesIntersect(
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number
  ): boolean {
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom === 0) return false;
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

  private updatePeerAudio(id: string): void {
    const peer = this.peers.get(id);
    if (!peer || !this.ctx) return;

    const dist = this.calculateDistance(this.listenerPos, peer.position);
    const occluded = this.isOccluded(this.listenerPos, peer.position);
    const targetGain = this.computeGain(dist, occluded);
    const targetPan = this.computePan(peer.position.x - this.listenerPos.x);

    const now = this.ctx.currentTime;
    
    // Smooth de-zippered parameter transitions (prevent clicks and pops)
    peer.gainNode.gain.cancelScheduledValues(now);
    peer.gainNode.gain.setTargetAtTime(targetGain, now, this.RAMP_TIME_CONSTANT);

    peer.pannerNode.pan.cancelScheduledValues(now);
    peer.pannerNode.pan.setTargetAtTime(targetPan, now, this.RAMP_TIME_CONSTANT);
  }

  private recalculateAllPeers(): void {
    for (const id of this.peers.keys()) {
      this.updatePeerAudio(id);
    }
  }

  /**
   * Diagnostic spike test method: creates an oscillator node to simulate spatial sound.
   */
  public createTestTone(frequency = 440): { oscillator: OscillatorNode; gain: GainNode; panner: StereoPannerNode } {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    osc.connect(panner);
    panner.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    return { oscillator: osc, gain, panner };
  }
}
