/**
 * WebRTCManager.ts
 * Manages peer-to-peer WebRTC connections with proximity gating.
 *
 * Requirements fulfilled per task sheet:
 * - Local getUserMedia audio stream acquisition.
 * - One RTCPeerConnection per in-range peer.
 * - Offer collision avoidance: peer with lower user id initiates the offer.
 * - Standard STUN configuration.
 * - Integration with signaling relay (Abhishek's events).
 */

export interface WebRTCConfig {
  userId: string;
  iceServers?: RTCIceServer[];
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  onPeerDisconnected?: (peerId: string) => void;
  sendSignal: (to: string, type: string, data: any) => void;
}

export class WebRTCManager {
  private userId: string;
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private iceServers: RTCIceServer[];
  private onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  private onPeerDisconnected?: (peerId: string) => void;
  private sendSignal: (to: string, type: string, data: any) => void;

  constructor(config: WebRTCConfig) {
    this.userId = config.userId;
    this.iceServers = config.iceServers || [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ];
    this.onRemoteStream = config.onRemoteStream;
    this.onPeerDisconnected = config.onPeerDisconnected;
    this.sendSignal = config.sendSignal;
  }

  /**
   * Initializes local microphone audio stream.
   */
  public async initLocalMedia(): Promise<MediaStream> {
    if (this.localStream) return this.localStream;

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });

    return this.localStream;
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Called when Abhishek's signaling server triggers 'peer:enter'.
   * Determines if this client should initiate the offer using deterministic lower-ID rule.
   */
  public async handlePeerEnter(peerId: string): Promise<void> {
    if (this.peerConnections.has(peerId)) {
      return; // Connection already in progress
    }

    const pc = this.createPeerConnection(peerId);
    this.peerConnections.set(peerId, pc);

    // Rule: peer with LOWER user id makes the offer to prevent glare/collisions
    const shouldOffer = this.userId < peerId;
    if (shouldOffer) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.sendSignal(peerId, 'offer', offer);
      } catch (err) {
        console.error(`Failed to create offer for peer ${peerId}:`, err);
      }
    }
  }

  /**
   * Called when Abhishek's signaling server triggers 'peer:leave'.
   */
  public handlePeerLeave(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    if (this.onPeerDisconnected) {
      this.onPeerDisconnected(peerId);
    }
  }

  /**
   * Handles relayed signaling messages ('offer', 'answer', 'ice-candidate').
   */
  public async handleSignal(from: string, type: string, data: any): Promise<void> {
    let pc = this.peerConnections.get(from);

    if (type === 'offer') {
      if (!pc) {
        pc = this.createPeerConnection(from);
        this.peerConnections.set(from, pc);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendSignal(from, 'answer', answer);
    } else if (type === 'answer') {
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
      }
    } else if (type === 'ice-candidate') {
      if (pc && data) {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      }
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    // Attach local audio tracks if available
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    // ICE Candidate trickle
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(peerId, 'ice-candidate', event.candidate);
      }
    };

    // Inbound remote audio track handling
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream && this.onRemoteStream) {
        this.onRemoteStream(peerId, remoteStream);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.handlePeerLeave(peerId);
      }
    };

    return pc;
  }

  public getActivePeerCount(): number {
    return this.peerConnections.size;
  }

  public closeAll(): void {
    for (const [id, pc] of this.peerConnections.entries()) {
      pc.close();
    }
    this.peerConnections.clear();
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
  }
}
