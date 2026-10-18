/**
 * WebRTCManager.js
 * Ameya's WebRTC Client Manager for ProxiSpeak (Task A5: 17 to 21 Oct).
 *
 * Requirements:
 * - getUserMedia: Acquires local microphone audio stream
 * - One RTCPeerConnection per in-range peer
 * - STUN: Configured with Google public STUN servers
 * - Glare Avoidance: The peer with the lower user id makes the offer (min(localId, peerId))
 * - Dynamic audio stream wiring to SpatialAudioMixer
 * - Pluggable signaling transport (Socket.io or Mock Adapter)
 */

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

class WebRTCManager {
  /**
   * @param {Object} config
   * @param {string} config.userId - Local user unique identifier
   * @param {Object} [config.mixer=null] - SpatialAudioMixer instance
   * @param {Function} [config.sendSignal=null] - (to, type, data) => void
   * @param {Object} [config.rtcConfig] - Custom RTCConfiguration (defaults to Google STUN)
   * @param {Function} [config.peerConnectionFactory] - Custom factory for testing/Node environments
   */
  constructor(config = {}) {
    if (!config.userId) {
      throw new Error('WebRTCManager requires a valid userId');
    }
    this.userId = config.userId;
    this.mixer = config.mixer || null;
    this.sendSignal = config.sendSignal || (() => {});
    this.rtcConfig = config.rtcConfig || { iceServers: DEFAULT_ICE_SERVERS };
    this.pcFactory = config.peerConnectionFactory || ((cfg) => {
      const PeerConnClass = (typeof window !== 'undefined' && (window.RTCPeerConnection || window.webkitRTCPeerConnection));
      if (!PeerConnClass) {
        throw new Error('RTCPeerConnection is not available in this environment');
      }
      return new PeerConnClass(cfg);
    });

    this.localStream = null;
    this.peers = new Map(); // peerId -> { pc, remoteStream, isOfferer, state }
    this.isMuted = false;
    this.eventListeners = new Map();
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  emit(event, data) {
    const handlers = this.eventListeners.get(event) || [];
    for (const cb of handlers) {
      try { cb(data); } catch (e) {}
    }
  }

  /**
   * Acquires local microphone media stream via getUserMedia.
   * @param {MediaStreamConstraints} [constraints={ audio: true, video: false }]
   */
  async initLocalStream(constraints = { audio: true, video: false }) {
    if (this.localStream) return this.localStream;

    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } else {
      throw new Error('navigator.mediaDevices.getUserMedia is not available');
    }

    this.emit('localstream', this.localStream);
    return this.localStream;
  }

  /**
   * Allows setting an explicit local stream (useful for simulated audio spikes and test harnesses).
   * @param {MediaStream|Object} stream
   */
  setLocalStream(stream) {
    this.localStream = stream;
    this.emit('localstream', this.localStream);
    return this.localStream;
  }

  /**
   * Initiates or prepares a WebRTC peer connection when an avatar enters proximity.
   * Enforces the deterministic Lower User ID Offerer Rule:
   * The peer with min(localUserId, peerId) creates and sends the offer.
   * @param {string} peerId
   * @param {Object} [initialPos={x: 0, y: 0}]
   */
  async connectPeer(peerId, initialPos = { x: 0, y: 0 }) {
    if (!peerId) throw new Error('peerId is required');
    if (peerId === this.userId) return null; // Cannot connect to self

    if (this.peers.has(peerId)) {
      return this.peers.get(peerId);
    }

    const pc = this.pcFactory(this.rtcConfig);
    const isOfferer = this.userId < peerId;

    const peerEntry = {
      peerId,
      pc,
      remoteStream: null,
      isOfferer,
      position: { ...initialPos },
      iceCandidateQueue: []
    };

    this.peers.set(peerId, peerEntry);

    // Attach local audio tracks if available
    if (this.localStream && typeof pc.addTrack === 'function') {
      const audioTracks = typeof this.localStream.getAudioTracks === 'function'
        ? this.localStream.getAudioTracks()
        : (this.localStream.tracks || []);
      for (const track of audioTracks) {
        pc.addTrack(track, this.localStream);
      }
    }

    // Trickle ICE Candidate Handler
    pc.onicecandidate = (event) => {
      if (event && event.candidate) {
        this.sendSignal(peerId, 'ice-candidate', event.candidate);
        this.emit('signal:sent', { to: peerId, type: 'ice-candidate', data: event.candidate });
      }
    };

    // Remote Track Handler -> Route into SpatialAudioMixer
    pc.ontrack = (event) => {
      const stream = (event.streams && event.streams[0]) ? event.streams[0] : event.track;
      peerEntry.remoteStream = stream;
      if (this.mixer) {
        this.mixer.addPeer(peerId, stream, peerEntry.position);
      }
      this.emit('track', { peerId, stream, track: event.track });
    };

    // State change logging
    pc.onconnectionstatechange = () => {
      this.emit('statechange', { peerId, state: pc.connectionState });
    };

    // Glare Avoidance: Only the lower user id initiates the offer!
    if (isOfferer && typeof pc.createOffer === 'function') {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.sendSignal(peerId, 'offer', pc.localDescription || offer);
        this.emit('signal:sent', { to: peerId, type: 'offer', data: pc.localDescription || offer });
      } catch (err) {
        this.emit('error', { peerId, error: err });
      }
    }

    return peerEntry;
  }

  /**
   * Processes incoming WebRTC signaling payloads (offer, answer, ice-candidate).
   * @param {Object} payload
   * @param {string} payload.from - Sending peer user ID
   * @param {string} payload.type - 'offer' | 'answer' | 'ice-candidate'
   * @param {Object} payload.data - SDP or ICE Candidate
   */
  async handleSignal(payload) {
    const { from, type, data } = payload;
    if (!from || !type) return;

    // Automatically initialize peer entry if not already present
    if (!this.peers.has(from)) {
      await this.connectPeer(from);
    }

    const peer = this.peers.get(from);
    if (!peer || !peer.pc) return;

    const pc = peer.pc;

    if (type === 'offer') {
      try {
        if (typeof pc.setRemoteDescription === 'function') {
          await pc.setRemoteDescription(data);
        }
        // Drain any buffered ICE candidates
        while (peer.iceCandidateQueue.length > 0) {
          const cand = peer.iceCandidateQueue.shift();
          if (typeof pc.addIceCandidate === 'function') {
            await pc.addIceCandidate(cand);
          }
        }
        if (typeof pc.createAnswer === 'function') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.sendSignal(from, 'answer', pc.localDescription || answer);
          this.emit('signal:sent', { to: from, type: 'answer', data: pc.localDescription || answer });
        }
      } catch (err) {
        this.emit('error', { peerId: from, error: err });
      }
    } else if (type === 'answer') {
      try {
        if (typeof pc.setRemoteDescription === 'function') {
          await pc.setRemoteDescription(data);
        }
        // Drain any buffered ICE candidates
        while (peer.iceCandidateQueue.length > 0) {
          const cand = peer.iceCandidateQueue.shift();
          if (typeof pc.addIceCandidate === 'function') {
            await pc.addIceCandidate(cand);
          }
        }
      } catch (err) {
        this.emit('error', { peerId: from, error: err });
      }
    } else if (type === 'ice-candidate') {
      try {
        if (pc.remoteDescription && typeof pc.addIceCandidate === 'function') {
          await pc.addIceCandidate(data);
        } else {
          // Buffer candidate until remote description is set
          peer.iceCandidateQueue.push(data);
        }
      } catch (err) {
        this.emit('error', { peerId: from, error: err });
      }
    }
  }

  /**
   * Disconnects a peer when they move out of earshot.
   * @param {string} peerId
   */
  disconnectPeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return false;

    try {
      if (peer.pc && typeof peer.pc.close === 'function') {
        peer.pc.close();
      }
    } catch (e) {}

    if (this.mixer) {
      this.mixer.removePeer(peerId);
    }

    this.peers.delete(peerId);
    this.emit('peer:disconnected', { peerId });
    return true;
  }

  /**
   * Updates position of a connected peer in the SpatialAudioMixer.
   * @param {string} peerId
   * @param {number} x
   * @param {number} y
   */
  setPeerPosition(peerId, x, y) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.position = { x, y };
    }
    if (this.mixer) {
      this.mixer.setPeerPosition(peerId, x, y);
    }
  }

  /**
   * Toggles microphone mute state.
   * @param {boolean} [muted]
   */
  setMuted(muted = !this.isMuted) {
    this.isMuted = Boolean(muted);
    if (this.localStream && typeof this.localStream.getAudioTracks === 'function') {
      const tracks = this.localStream.getAudioTracks();
      for (const t of tracks) {
        t.enabled = !this.isMuted;
      }
    }
    if (this.mixer) {
      this.mixer.setMuted(this.isMuted);
    }
    this.emit('mute', { muted: this.isMuted });
    return this.isMuted;
  }

  /**
   * Tears down all connections and media resources.
   */
  destroy() {
    for (const peerId of Array.from(this.peers.keys())) {
      this.disconnectPeer(peerId);
    }
    if (this.localStream && typeof this.localStream.getTracks === 'function') {
      for (const t of this.localStream.getTracks()) {
        try { t.stop(); } catch (e) {}
      }
    }
    this.localStream = null;
    this.peers.clear();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WebRTCManager, DEFAULT_ICE_SERVERS };
} else if (typeof window !== 'undefined') {
  window.WebRTCManager = WebRTCManager;
  window.DEFAULT_ICE_SERVERS = DEFAULT_ICE_SERVERS;
}
