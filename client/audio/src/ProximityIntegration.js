/**
 * ProximityIntegration.js
 * Ameya's Proximity & Spatial Audio Integration Engine (Task A6: 19 to 23 Oct).
 *
 * Fulfills the project task sheet requirement:
 * "Integrate with Abhishek's events & Harpreet's canvas (enter/leave triggers audio).
 *  Two browsers on the same machine communicate audio; walking away cuts the sound."
 *
 * Capabilities:
 * - Coordinates Harpreet's 2D canvas avatar movement with Abhishek's signaling events
 * - Proximity hysteresis: 100px enter (earshot radius), 120px leave (hysteresis buffer)
 * - Automatic WebRTC connection initiation on peer:enter with deterministic lower-ID offerer rule
 * - Immediate audio attenuation and cutoff on peer:leave (walking away cuts the sound)
 * - Built-in BroadcastChannel mesh transport for seamless 2-browser testing on the same machine
 * - Pluggable Socket.io transport for backend integration
 * - Optional HTML5 Canvas render loop binding (WASD/arrows, earshot rings, avatar rendering)
 */

const { SpatialAudioMixer } = (typeof require !== 'undefined')
  ? require('./SpatialAudioMixer')
  : (typeof window !== 'undefined' ? window : {});

const { WebRTCManager } = (typeof require !== 'undefined')
  ? require('./WebRTCManager')
  : (typeof window !== 'undefined' ? window : {});

class ProximityIntegration {
  /**
   * @param {Object} config
   * @param {string} config.userId - Unique ID of local user (e.g. 'alice', 'bob')
   * @param {string} [config.roomId='default-room'] - Room identifier
   * @param {SpatialAudioMixer} [config.mixer] - SpatialAudioMixer instance
   * @param {WebRTCManager} [config.webrtcManager] - WebRTCManager instance
   * @param {Object|string} [config.transport='broadcast-channel'] - Socket instance, 'broadcast-channel', or custom transport
   * @param {number} [config.earshotRadius=100] - Distance in px to trigger peer:enter & connect audio
   * @param {number} [config.leaveRadius=120] - Distance in px to trigger peer:leave & cut audio
   * @param {Object} [config.initialPosition={x: 200, y: 200}] - Starting coordinates
   */
  constructor(config = {}) {
    if (!config.userId) {
      throw new Error('ProximityIntegration requires a valid userId');
    }

    this.userId = config.userId;
    this.roomId = config.roomId || 'default-room';
    this.earshotRadius = Number(config.earshotRadius) || 100;
    this.leaveRadius = Number(config.leaveRadius) || 120;

    this.localPos = {
      x: config.initialPosition && typeof config.initialPosition.x === 'number' ? config.initialPosition.x : 200,
      y: config.initialPosition && typeof config.initialPosition.y === 'number' ? config.initialPosition.y : 200
    };

    // Instantiate or wire SpatialAudioMixer
    if (config.mixer) {
      this.mixer = config.mixer;
    } else {
      const ctx = config.audioContext || (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null);
      this.mixer = ctx ? new SpatialAudioMixer(ctx, { earshotRadius: this.earshotRadius }) : null;
    }
    if (this.mixer && typeof this.mixer.setListenerPosition === 'function') {
      this.mixer.setListenerPosition(this.localPos.x, this.localPos.y);
    }

    // Instantiate or wire WebRTCManager
    this.webrtcManager = config.webrtcManager || new WebRTCManager({
      userId: this.userId,
      mixer: this.mixer,
      sendSignal: (to, type, data) => this._sendSignal(to, type, data)
    });

    // Peering state: peerId -> { id, x, y, inRange, lastDistance }
    this.peers = new Map();

    // Event bus
    this.eventListeners = new Map();

    // Transport setup
    this.transportType = typeof config.transport === 'string' ? config.transport : (config.transport ? 'socket' : 'broadcast-channel');
    this.transport = config.transport || 'broadcast-channel';
    this._initTransport();
  }

  // --- Event Emitter ---

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
    return this;
  }

  emit(event, data) {
    const callbacks = this.eventListeners.get(event) || [];
    for (const cb of callbacks) {
      try {
        cb(data);
      } catch (err) {
        console.error(`Error in event listener for ${event}:`, err);
      }
    }
  }

  // --- Transport Layer ---

  _initTransport() {
    if (this.transportType === 'broadcast-channel' && typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel(`proxispeak_room_${this.roomId}`);
      this.broadcastChannel.onmessage = (event) => {
        const msg = event.data;
        if (!msg || msg.senderId === this.userId) return; // Ignore own messages
        this._handleIncomingMessage(msg);
      };
    } else if (this.transport && typeof this.transport.on === 'function') {
      // Socket.io instance provided
      this.transport.on('peer:moved', (data) => {
        if (data && data.userId !== this.userId) {
          this.handleRemoteMove(data.userId, data.x, data.y);
        }
      });
      this.transport.on('peer:left', (data) => {
        if (data && data.userId) {
          this.handleRemoteDisconnect(data.userId);
        }
      });
      this.transport.on('signal', (data) => {
        if (data && data.to === this.userId) {
          this.handleIncomingSignal(data);
        }
      });
    }
  }

  _sendSignal(to, type, data) {
    const payload = {
      type: 'signal',
      senderId: this.userId,
      to,
      signalType: type,
      signalData: data
    };

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(payload);
    } else if (this.transport && typeof this.transport.emit === 'function') {
      this.transport.emit('signal', { to, from: this.userId, type, data });
    }

    this.emit('signal:sent', { to, type, data });
  }

  _broadcastMove() {
    const payload = {
      type: 'move',
      senderId: this.userId,
      x: this.localPos.x,
      y: this.localPos.y
    };

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(payload);
    } else if (this.transport && typeof this.transport.emit === 'function') {
      this.transport.emit('move', { x: this.localPos.x, y: this.localPos.y });
    }

    this.emit('local:moved', { x: this.localPos.x, y: this.localPos.y });
  }

  _broadcastPresence() {
    const payload = {
      type: 'presence',
      senderId: this.userId,
      x: this.localPos.x,
      y: this.localPos.y
    };

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(payload);
    } else if (this.transport && typeof this.transport.emit === 'function') {
      this.transport.emit('join', { roomId: this.roomId, userId: this.userId, initialPos: this.localPos });
    }
  }

  _handleIncomingMessage(msg) {
    if (!msg || !msg.senderId) return;

    switch (msg.type) {
      case 'presence':
      case 'move':
        this.handleRemoteMove(msg.senderId, msg.x, msg.y);
        // Reply with local presence if they just arrived
        if (msg.type === 'presence') {
          const reply = {
            type: 'move',
            senderId: this.userId,
            x: this.localPos.x,
            y: this.localPos.y
          };
          if (this.broadcastChannel) {
            this.broadcastChannel.postMessage(reply);
          }
        }
        break;

      case 'leave':
        this.handleRemoteDisconnect(msg.senderId);
        break;

      case 'signal':
        if (msg.to === this.userId) {
          this.handleIncomingSignal({
            from: msg.senderId,
            to: msg.to,
            type: msg.signalType,
            data: msg.signalData
          });
        }
        break;

      default:
        break;
    }
  }

  // --- Avatar Movement & Proximity Engine ---

  /**
   * Updates local avatar coordinates, updates Web Audio listener, and evaluates proximity.
   * @param {number} x
   * @param {number} y
   */
  updateLocalPosition(x, y) {
    this.localPos.x = Number(x);
    this.localPos.y = Number(y);

    // Update Web Audio listener position in 3D audio graph
    this.mixer.setListenerPosition(this.localPos.x, this.localPos.y);

    // Broadcast updated coordinates to peers
    this._broadcastMove();

    // Re-evaluate proximity with hysteresis against all known peers
    for (const [peerId, peer] of this.peers.entries()) {
      this._evaluatePeerProximity(peer);
    }

    return this.localPos;
  }

  /**
   * Handles remote peer movement notification.
   * @param {string} peerId
   * @param {number} x
   * @param {number} y
   */
  handleRemoteMove(peerId, x, y) {
    if (peerId === this.userId) return;

    let peer = this.peers.get(peerId);
    if (!peer) {
      peer = {
        id: peerId,
        x: Number(x) || 0,
        y: Number(y) || 0,
        inRange: false,
        lastDistance: Infinity
      };
      this.peers.set(peerId, peer);
    } else {
      peer.x = Number(x) || 0;
      peer.y = Number(y) || 0;
    }

    this._evaluatePeerProximity(peer);
    this.emit('peer:moved', { peerId, x: peer.x, y: peer.y, inRange: peer.inRange, distance: peer.lastDistance });
  }

  /**
   * Evaluates proximity with hysteresis for a specific peer:
   * - Enter threshold: distance <= 100px (triggers peer:enter, connects WebRTC, routes audio)
   * - Leave threshold: distance > 120px (triggers peer:leave, cuts audio, closes WebRTC)
   * - Hysteresis band (100px - 120px): maintains existing connection state to prevent flapping.
   * @private
   */
  _evaluatePeerProximity(peer) {
    const dx = peer.x - this.localPos.x;
    const dy = peer.y - this.localPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    peer.lastDistance = distance;

    if (!peer.inRange && distance <= this.earshotRadius) {
      // ENTER EVENT: Peer entered earshot circle!
      peer.inRange = true;
      const isOfferer = this.userId < peer.id; // Deterministic glare avoidance

      this.emit('peer:enter', {
        peerId: peer.id,
        distance,
        isOfferer,
        position: { x: peer.x, y: peer.y }
      });

      // Initiate WebRTC peer connection (lower ID initiates the offer)
      if (this.webrtcManager) {
        this.webrtcManager.connectPeer(peer.id, { x: peer.x, y: peer.y });
      }

      // Update position in spatial audio mixer
      this.mixer.setPeerPosition(peer.id, peer.x, peer.y);

    } else if (peer.inRange && distance > this.leaveRadius) {
      // LEAVE EVENT: Peer walked away past 120px hysteresis boundary!
      peer.inRange = false;

      this.emit('peer:leave', {
        peerId: peer.id,
        distance
      });

      // Cut audio immediately & tear down peer connection
      this.mixer.removePeer(peer.id);
      if (this.webrtcManager) {
        if (typeof this.webrtcManager.disconnectPeer === 'function') {
          this.webrtcManager.disconnectPeer(peer.id);
        } else if (typeof this.webrtcManager.closePeer === 'function') {
          this.webrtcManager.closePeer(peer.id);
        }
      }

    } else if (peer.inRange) {
      // IN-RANGE MOVEMENT: Update coordinates & spatial audio parameters
      this.mixer.setPeerPosition(peer.id, peer.x, peer.y);
      if (this.webrtcManager) {
        this.webrtcManager.setPeerPosition(peer.id, peer.x, peer.y);
      }
    }
  }

  /**
   * Handles incoming WebRTC signal payload and forwards to WebRTCManager.
   * @param {Object} payload
   */
  handleIncomingSignal(payload) {
    if (!this.webrtcManager) return;
    this.webrtcManager.handleSignal(payload);
    this.emit('signal:received', payload);
  }

  /**
   * Handles peer disconnection or explicit departure.
   * @param {string} peerId
   */
  handleRemoteDisconnect(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    if (peer.inRange) {
      this.mixer.removePeer(peerId);
      if (this.webrtcManager) {
        if (typeof this.webrtcManager.disconnectPeer === 'function') {
          this.webrtcManager.disconnectPeer(peerId);
        } else if (typeof this.webrtcManager.closePeer === 'function') {
          this.webrtcManager.closePeer(peerId);
        }
      }
      this.emit('peer:leave', { peerId, reason: 'disconnect' });
    }

    this.peers.delete(peerId);
    this.emit('peer:left', { peerId });
  }

  /**
   * Starts discovery and broadcasts initial presence.
   */
  start() {
    this._broadcastPresence();
    return this;
  }

  /**
   * Cleanly closes all audio and network connections.
   */
  destroy() {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'leave', senderId: this.userId });
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    if (this.webrtcManager) {
      if (typeof this.webrtcManager.destroy === 'function') {
        this.webrtcManager.destroy();
      } else if (typeof this.webrtcManager.closeAll === 'function') {
        this.webrtcManager.closeAll();
      }
    }

    if (this.mixer && typeof this.mixer.destroy === 'function') {
      this.mixer.destroy();
    }

    this.peers.clear();
    this.eventListeners.clear();
  }

  // --- HTML5 Canvas Interactive Controller ---

  /**
   * Binds this integration client to an HTML5 Canvas, mirroring Harpreet's 2D canvas controls.
   * Renders floor, 100px earshot circle, 120px cut-off boundary, local avatar, and remote peers.
   * @param {HTMLCanvasElement} canvas
   * @param {Object} [options]
   */
  attachCanvas(canvas, options = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      return null;
    }

    const ctx = canvas.getContext('2d');
    const speed = options.speed || 4;
    const avatarRadius = options.avatarRadius || 15;
    const keys = {};

    const handleKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault();
        keys[k] = true;
      }
    };

    const handleKeyUp = (e) => {
      const k = e.key.toLowerCase();
      keys[k] = false;
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    }

    let animationId = null;

    const render = () => {
      let moved = false;
      let newX = this.localPos.x;
      let newY = this.localPos.y;

      if (keys['w'] || keys['arrowup']) { newY -= speed; moved = true; }
      if (keys['s'] || keys['arrowdown']) { newY += speed; moved = true; }
      if (keys['a'] || keys['arrowleft']) { newX -= speed; moved = true; }
      if (keys['d'] || keys['arrowright']) { newX += speed; moved = true; }

      // Clamp to canvas borders
      newX = Math.max(avatarRadius, Math.min(canvas.width - avatarRadius, newX));
      newY = Math.max(avatarRadius, Math.min(canvas.height - avatarRadius, newY));

      if (moved && (newX !== this.localPos.x || newY !== this.localPos.y)) {
        this.updateLocalPosition(newX, newY);
      }

      // Clear & draw background
      ctx.fillStyle = '#0f172a'; // Deep slate
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw subtle grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Draw 120px Hysteresis Leave Boundary (Dotted Circle)
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.arc(this.localPos.x, this.localPos.y, this.leaveRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)'; // Reddish indicator
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw 100px Earshot Radius (Filled + Solid Circle)
      ctx.beginPath();
      ctx.arc(this.localPos.x, this.localPos.y, this.earshotRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw Remote Peers
      for (const [peerId, peer] of this.peers.entries()) {
        const isInRange = peer.inRange;
        const color = isInRange ? '#10b981' : '#64748b'; // Emerald if in range, Slate if out

        // Draw line connecting listener and peer if in range
        if (isInRange) {
          ctx.beginPath();
          ctx.moveTo(this.localPos.x, this.localPos.y);
          ctx.lineTo(peer.x, peer.y);
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Peer Avatar Circle
        ctx.beginPath();
        ctx.arc(peer.x, peer.y, avatarRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Peer Label & Status
        ctx.fillStyle = '#f8fafc';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(peer.id, peer.x, peer.y - avatarRadius - 8);

        // Distance Badge
        const distText = `${Math.round(peer.lastDistance)}px ${isInRange ? '🔊 ACTIVE' : '🔇 MUTED'}`;
        ctx.fillStyle = isInRange ? '#34d399' : '#94a3b8';
        ctx.font = '10px monospace';
        ctx.fillText(distText, peer.x, peer.y + avatarRadius + 14);
      }

      // Draw Local Avatar (Blue)
      ctx.beginPath();
      ctx.arc(this.localPos.x, this.localPos.y, avatarRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Local Avatar Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.userId} (You)`, this.localPos.x, this.localPos.y - avatarRadius - 8);

      // Coordinate HUD
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Pos: (${Math.round(this.localPos.x)}, ${Math.round(this.localPos.y)}) | Earshot: ${this.earshotRadius}px | Cutoff: ${this.leaveRadius}px`, 12, 20);

      if (typeof requestAnimationFrame !== 'undefined') {
        animationId = requestAnimationFrame(render);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      animationId = requestAnimationFrame(render);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      }
      if (animationId && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(animationId);
      }
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ProximityIntegration };
} else if (typeof window !== 'undefined') {
  window.ProximityIntegration = ProximityIntegration;
}
