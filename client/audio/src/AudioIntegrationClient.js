/**
 * AudioIntegrationClient.js
 * Integration Client & Mock Adapter for Spatial Audio on Ameya's Branch.
 *
 * Designed to operate both with a live Socket.io signaling server (Abhishek)
 * and in decoupled Mock Mode while waiting for teammate backend/frontend implementations.
 *
 * Implements:
 * - Movement and Presence contract handling (join, move, peer:moved, peer:left)
 * - Proximity & Signaling contract handling (peer:enter at 100px, peer:leave at 120px hysteresis)
 * - WebRTC Glare Avoidance: Lower user ID makes the offer (min(localId, remoteId))
 * - Auto-binding to SpatialAudioMixer for dynamic stream lifecycle management
 */

const { SpatialAudioMixer } = require('./SpatialAudioMixer');

class AudioIntegrationClient {
  /**
   * @param {Object} config
   * @param {string} config.userId - Local user unique ID
   * @param {string} [config.roomId='default-room'] - Active room
   * @param {SpatialAudioMixer} config.mixer - SpatialAudioMixer instance
   * @param {Object} [config.socket=null] - Socket.io client instance (null = Mock Mode)
   * @param {number} [config.earshotRadius=100] - Proximity entry radius in pixels
   * @param {number} [config.leaveRadius=120] - Proximity exit radius in pixels (hysteresis buffer)
   */
  constructor(config = {}) {
    if (!config.userId) throw new Error('userId is required');
    if (!config.mixer) throw new Error('SpatialAudioMixer instance is required');

    this.userId = config.userId;
    this.roomId = config.roomId || 'default-room';
    this.mixer = config.mixer;
    this.socket = config.socket || null;
    this.isMockMode = !Boolean(config.socket);

    this.earshotRadius = config.earshotRadius || 100;
    this.leaveRadius = config.leaveRadius || 120;

    this.localPos = { x: 0, y: 0 };
    this.inRangePeers = new Set(); // peerIds currently inside earshot / hysteresis
    this.knownPeers = new Map();   // peerId -> { x, y }

    this.eventListeners = new Map(); // eventName -> Array<callback>

    this._setupSocketListeners();
  }

  /**
   * Subscribes to client lifecycle events ('peer:enter', 'peer:leave', 'signal:sent', etc.)
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  emitEvent(event, data) {
    const handlers = this.eventListeners.get(event) || [];
    for (const cb of handlers) {
      try { cb(data); } catch (e) {}
    }
  }

  /**
   * Moves the local user's avatar.
   * In Live Mode: broadcasts move to socket.
   * In Mock Mode: computes proximity against known peers with hysteresis.
   */
  move(x, y) {
    this.localPos = { x: Number(x) || 0, y: Number(y) || 0 };
    this.mixer.setListenerPosition(this.localPos.x, this.localPos.y);

    if (this.socket && !this.isMockMode) {
      this.socket.emit('move', { x: this.localPos.x, y: this.localPos.y });
    } else {
      // Mock Mode: evaluate proximity against known peers
      this._evaluateProximity();
    }
  }

  /**
   * Simulates or handles remote peer movement.
   * @param {string} peerId
   * @param {number} x
   * @param {number} y
   * @param {MediaStream|AudioNode} [audioSource=null]
   */
  setRemotePeerPosition(peerId, x, y, audioSource = null) {
    const pos = { x: Number(x) || 0, y: Number(y) || 0 };
    this.knownPeers.set(peerId, { ...pos, audioSource });

    if (this.inRangePeers.has(peerId)) {
      this.mixer.setPeerPosition(peerId, pos.x, pos.y);
    }

    if (this.isMockMode) {
      this._evaluateProximityForPeer(peerId, pos, audioSource);
    }
  }

  /**
   * Evaluates proximity with hysteresis for all known peers.
   * @private
   */
  _evaluateProximity() {
    for (const [peerId, peerData] of this.knownPeers.entries()) {
      this._evaluateProximityForPeer(peerId, peerData, peerData.audioSource);
    }
  }

  /**
   * Evaluates proximity with hysteresis for an individual peer:
   * - Enter within 100px (earshotRadius)
   * - Leave beyond 120px (leaveRadius)
   * @private
   */
  _evaluateProximityForPeer(peerId, pos, audioSource) {
    const dx = pos.x - this.localPos.x;
    const dy = pos.y - this.localPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const isConnected = this.inRangePeers.has(peerId);

    if (!isConnected && dist <= this.earshotRadius) {
      // Peer entered earshot!
      this.inRangePeers.add(peerId);

      // Determine who makes the offer: Lower user ID makes the offer
      const isOfferer = this.userId < peerId;

      this.emitEvent('peer:enter', {
        peerId,
        distance: dist,
        isOfferer,
        position: { ...pos }
      });

      // Add to spatial audio mixer if audio source is available
      if (audioSource) {
        this.mixer.addPeer(peerId, audioSource, pos);
      }
    } else if (isConnected && dist > this.leaveRadius) {
      // Peer left earshot (beyond 120px hysteresis buffer)!
      this.inRangePeers.delete(peerId);

      this.emitEvent('peer:leave', {
        peerId,
        distance: dist
      });

      // Remove from spatial mixer (smooth fade out)
      this.mixer.removePeer(peerId);
    } else if (isConnected) {
      // Still in range: update coordinates
      this.mixer.setPeerPosition(peerId, pos.x, pos.y);
    }
  }

  /**
   * Sets up real Socket.io listeners if connected.
   * @private
   */
  _setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.socket.emit('join', {
        roomId: this.roomId,
        userId: this.userId,
        initialPos: this.localPos
      });
    });

    this.socket.on('peer:enter', (data) => {
      const { peerId, x, y } = data;
      this.inRangePeers.add(peerId);
      this.emitEvent('peer:enter', data);
    });

    this.socket.on('peer:leave', (data) => {
      const { peerId } = data;
      this.inRangePeers.delete(peerId);
      this.mixer.removePeer(peerId);
      this.emitEvent('peer:leave', data);
    });

    this.socket.on('peer:moved', (data) => {
      const { userId, x, y } = data;
      if (this.inRangePeers.has(userId)) {
        this.mixer.setPeerPosition(userId, x, y);
      }
      this.emitEvent('peer:moved', data);
    });

    this.socket.on('signal', (data) => {
      this.emitEvent('signal', data);
    });
  }

  /**
   * Relays a WebRTC signal payload (offer, answer, ICE candidate).
   */
  sendSignal(targetPeerId, type, data) {
    if (!this.inRangePeers.has(targetPeerId) && !this.isMockMode) {
      throw new Error(`Cannot signal out-of-range peer: ${targetPeerId}`);
    }

    const payload = {
      to: targetPeerId,
      from: this.userId,
      type,
      data
    };

    if (this.socket && !this.isMockMode) {
      this.socket.emit('signal', payload);
    }

    this.emitEvent('signal:sent', payload);
    return payload;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioIntegrationClient };
} else if (typeof window !== 'undefined') {
  window.AudioIntegrationClient = AudioIntegrationClient;
}
