/**
 * ProxiSpeak Ecosystem - ConnectionCapper
 * Task A9: Cap simultaneous WebRTC connections to N nearest peers + leave hysteresis
 * 
 * Features:
 * - Caps active simultaneous WebRTC connections to N nearest peers (default N=4)
 * - Ranks candidates by Euclidean distance from the local listener
 * - 2-tier Hysteresis:
 *   1. Spatial Hysteresis: Enter at 100px, leave at 120px
 *   2. Rank/Preemption Hysteresis: A candidate must be at least 15px closer than the furthest
 *      active peer to preempt their slot, preventing connection flapping/glare.
 * - Integration callbacks: onConnect, onDisconnect, onEvict
 * - Exposes full connection topology metrics and diagnostics
 */

class ConnectionCapper {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxConnections=4] - Maximum simultaneous active WebRTC peer connections (N)
   * @param {number} [options.enterRadius=100] - Distance in pixels to enter connection range
   * @param {number} [options.leaveRadius=120] - Distance in pixels to leave connection range (spatial hysteresis)
   * @param {number} [options.swapHysteresis=15] - Distance margin (px) required for a closer peer to evict an active peer
   * @param {Function} [options.onConnect] - Callback (peerId, distance) when a peer is granted a connection slot
   * @param {Function} [options.onDisconnect] - Callback (peerId, reason) when a peer connection is torn down
   * @param {Function} [options.onEvict] - Callback (evictedPeerId, newPeerId) when an active peer is evicted for a closer one
   */
  constructor(options = {}) {
    this.maxConnections = options.maxConnections !== undefined ? options.maxConnections : 4;
    this.enterRadius = options.enterRadius !== undefined ? options.enterRadius : 100;
    this.leaveRadius = options.leaveRadius !== undefined ? options.leaveRadius : 120;
    this.swapHysteresis = options.swapHysteresis !== undefined ? options.swapHysteresis : 15;

    this.onConnect = options.onConnect || (() => {});
    this.onDisconnect = options.onDisconnect || (() => {});
    this.onEvict = options.onEvict || (() => {});

    this.listenerPosition = { x: 0, y: 0 };
    // peerId -> { id, position: {x, y}, distance: number, isActive: boolean, joinedAt: number }
    this.peers = new Map();
    // Set of active peer IDs
    this.activeSet = new Set();

    this.stats = {
      admittedCount: 0,
      evictedCount: 0,
      naturalDisconnectCount: 0,
      totalRankEvaluations: 0
    };
  }

  /**
   * Set local listener avatar position
   * @param {number} x
   * @param {number} y
   */
  setListenerPosition(x, y) {
    this.listenerPosition = { x, y };
    // Recompute all peer distances
    for (const peer of this.peers.values()) {
      peer.distance = this.computeDistance(this.listenerPosition, peer.position);
    }
    this.evaluateConnections();
  }

  /**
   * Register or update remote peer position
   * @param {string} peerId
   * @param {number} x
   * @param {number} y
   */
  updatePeerPosition(peerId, x, y) {
    if (!peerId) return;

    const pos = { x, y };
    const distance = this.computeDistance(this.listenerPosition, pos);

    let peer = this.peers.get(peerId);
    if (!peer) {
      peer = {
        id: peerId,
        position: pos,
        distance,
        isActive: false,
        joinedAt: Date.now()
      };
      this.peers.set(peerId, peer);
    } else {
      peer.position = pos;
      peer.distance = distance;
    }

    this.evaluateConnections();
    return peer;
  }

  /**
   * Remove peer explicitly (e.g. peer left room)
   * @param {string} peerId
   * @param {string} [reason='peer_left']
   */
  removePeer(peerId, reason = 'peer_left') {
    if (!this.peers.has(peerId)) return false;

    const peer = this.peers.get(peerId);
    const wasActive = this.activeSet.has(peerId);

    if (wasActive) {
      this.activeSet.delete(peerId);
      this.stats.naturalDisconnectCount++;
      try {
        this.onDisconnect(peerId, reason);
      } catch (err) {
        console.error(`Error in onDisconnect for ${peerId}:`, err);
      }
    }

    this.peers.delete(peerId);
    // Backfill any open slot if available
    this.evaluateConnections();
    return true;
  }

  /**
   * Main evaluation loop: Enforces maxConnections cap, 100/120px hysteresis, and preemption margin
   */
  evaluateConnections() {
    this.stats.totalRankEvaluations++;

    // 1. Evict any active peers that exceeded the leave hysteresis radius (> 120px)
    for (const activeId of Array.from(this.activeSet)) {
      const peer = this.peers.get(activeId);
      if (!peer || peer.distance > this.leaveRadius) {
        this.activeSet.delete(activeId);
        if (peer) peer.isActive = false;
        this.stats.naturalDisconnectCount++;
        try {
          this.onDisconnect(activeId, 'exceeded_leave_radius');
        } catch (err) {
          console.error(`Error in onDisconnect for ${activeId}:`, err);
        }
      }
    }

    // 2. Identify candidates eligible for connection (distance <= enterRadius or already active within leaveRadius)
    const eligiblePeers = [];
    for (const peer of this.peers.values()) {
      if (this.activeSet.has(peer.id)) {
        // Active peers remain eligible as long as distance <= leaveRadius
        if (peer.distance <= this.leaveRadius) {
          eligiblePeers.push(peer);
        }
      } else {
        // Inactive candidates must be strictly within enterRadius (<= 100px)
        if (peer.distance <= this.enterRadius) {
          eligiblePeers.push(peer);
        }
      }
    }

    // Sort eligible peers by distance ascending (closest first)
    eligiblePeers.sort((a, b) => a.distance - b.distance);

    // 3. Fill available slots up to maxConnections
    for (const peer of eligiblePeers) {
      if (this.activeSet.size < this.maxConnections) {
        if (!this.activeSet.has(peer.id)) {
          this.activeSet.add(peer.id);
          peer.isActive = true;
          this.stats.admittedCount++;
          try {
            this.onConnect(peer.id, peer.distance);
          } catch (err) {
            console.error(`Error in onConnect for ${peer.id}:`, err);
          }
        }
      } else {
        // All N slots filled. Check if this inactive peer is significantly closer than the furthest active peer
        if (!this.activeSet.has(peer.id)) {
          // Find active peer with maximum distance
          let furthestActive = null;
          for (const activeId of this.activeSet) {
            const activePeer = this.peers.get(activeId);
            if (!furthestActive || (activePeer && activePeer.distance > furthestActive.distance)) {
              furthestActive = activePeer;
            }
          }

          // Preemption criteria: candidate must be at least swapHysteresis (15px) closer than furthestActive
          if (furthestActive && peer.distance + this.swapHysteresis < furthestActive.distance) {
            // Evict furthest active peer
            this.activeSet.delete(furthestActive.id);
            furthestActive.isActive = false;
            this.stats.evictedCount++;

            try {
              this.onEvict(furthestActive.id, peer.id);
              this.onDisconnect(furthestActive.id, 'evicted_by_closer_peer');
            } catch (err) {
              console.error(`Error during eviction of ${furthestActive.id}:`, err);
            }

            // Admit closer peer
            this.activeSet.add(peer.id);
            peer.isActive = true;
            this.stats.admittedCount++;

            try {
              this.onConnect(peer.id, peer.distance);
            } catch (err) {
              console.error(`Error during admission of ${peer.id}:`, err);
            }
          }
        }
      }
    }
  }

  /**
   * Euclidean distance helper
   */
  computeDistance(p1, p2) {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  /**
   * Check if a peer currently has an active connection slot
   * @param {string} peerId
   * @returns {boolean}
   */
  isPeerActive(peerId) {
    return this.activeSet.has(peerId);
  }

  /**
   * Return array of currently active peers with metrics
   */
  getActivePeers() {
    return Array.from(this.activeSet)
      .map(id => this.peers.get(id))
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Return diagnostics and topology summary
   */
  getDiagnostics() {
    return {
      listenerPosition: { ...this.listenerPosition },
      maxConnections: this.maxConnections,
      activeCount: this.activeSet.size,
      activePeerIds: Array.from(this.activeSet),
      totalKnownPeers: this.peers.size,
      enterRadius: this.enterRadius,
      leaveRadius: this.leaveRadius,
      swapHysteresis: this.swapHysteresis,
      stats: { ...this.stats }
    };
  }

  /**
   * Clear all peers and reset state
   */
  clear() {
    for (const activeId of this.activeSet) {
      try {
        this.onDisconnect(activeId, 'capper_cleared');
      } catch (err) {}
    }
    this.peers.clear();
    this.activeSet.clear();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConnectionCapper };
}
if (typeof window !== 'undefined') {
  window.ConnectionCapper = ConnectionCapper;
}
