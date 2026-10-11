/**
 * ConnectionCapper.ts
 * Caps simultaneous WebRTC connections to the N nearest peers with leave hysteresis.
 */

export interface PeerCandidate {
  peerId: string;
  distance: number;
}

export class ConnectionCapper {
  private maxConnections: number;
  private hysteresisBufferPx: number;

  constructor(maxConnections = 6, hysteresisBufferPx = 20) {
    this.maxConnections = maxConnections;
    this.hysteresisBufferPx = hysteresisBufferPx;
  }

  /**
   * Sorts candidate peers by proximity and selects up to N nearest peers.
   */
  public selectActivePeers(
    allPeers: PeerCandidate[],
    currentActivePeerIds: Set<string>,
    earshotRadius = 100
  ): string[] {
    // Retain currently active peers unless they exceed earshot + hysteresis
    const validCandidates = allPeers.filter((p) => {
      const isCurrentlyConnected = currentActivePeerIds.has(p.peerId);
      const effectiveThreshold = isCurrentlyConnected
        ? earshotRadius + this.hysteresisBufferPx
        : earshotRadius;
      return p.distance <= effectiveThreshold;
    });

    // Sort ascending by distance (closest peers first)
    validCandidates.sort((a, b) => a.distance - b.distance);

    // Pick top N
    return validCandidates.slice(0, this.maxConnections).map((p) => p.peerId);
  }
}
