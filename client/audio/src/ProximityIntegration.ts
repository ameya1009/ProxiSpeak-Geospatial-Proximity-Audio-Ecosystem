/**
 * ProximityIntegration.ts
 * Integrates WebRTCManager with AudioMixer, Abhishek's socket events, and Harpreet's canvas coordinates.
 */

import { AudioMixer, Obstacle } from './AudioMixer';
import { WebRTCManager } from './WebRTCManager';

export interface ProximityCoordinatorConfig {
  userId: string;
  socket: any; // Socket.io client instance
  audioMixer?: AudioMixer;
}

export class ProximityCoordinator {
  public readonly audioMixer: AudioMixer;
  public readonly webrtc: WebRTCManager;
  private socket: any;
  private userId: string;

  constructor(config: ProximityCoordinatorConfig) {
    this.userId = config.userId;
    this.socket = config.socket;
    this.audioMixer = config.audioMixer || new AudioMixer();

    this.webrtc = new WebRTCManager({
      userId: this.userId,
      sendSignal: (to, type, data) => {
        this.socket.emit('signal', { to, type, data });
      },
      onRemoteStream: (peerId, stream) => {
        // Feed in-range peer's audio stream directly into Web Audio graph
        this.audioMixer.addPeer(peerId, stream);
      },
      onPeerDisconnected: (peerId) => {
        this.audioMixer.removePeer(peerId);
      }
    });

    this.bindSocketEvents();
  }

  private bindSocketEvents(): void {
    if (!this.socket) return;

    // Abhishek's proximity gating events
    this.socket.on('peer:enter', (data: { peerId: string; x: number; y: number }) => {
      this.webrtc.handlePeerEnter(data.peerId);
      this.audioMixer.setPeerPosition(data.peerId, data.x, data.y);
    });

    this.socket.on('peer:leave', (data: { peerId: string }) => {
      this.webrtc.handlePeerLeave(data.peerId);
      this.audioMixer.removePeer(data.peerId);
    });

    // WebRTC signaling relay
    this.socket.on('signal', (data: { from: string; type: string; data: any }) => {
      this.webrtc.handleSignal(data.from, data.type, data.data);
    });

    // Avatar movement updates from Harpreet's canvas broadcasted by server
    this.socket.on('peer:moved', (data: { userId: string; x: number; y: number }) => {
      this.audioMixer.setPeerPosition(data.userId, data.x, data.y);
    });
  }

  /**
   * Called by Harpreet's Canvas whenever local avatar moves.
   */
  public onLocalAvatarMoved(x: number, y: number): void {
    this.audioMixer.setListenerPosition(x, y);
    if (this.socket) {
      this.socket.emit('move', { x, y });
    }
  }

  /**
   * Loads obstacles from Milind's database layout.
   */
  public setObstacles(obstacles: Obstacle[]): void {
    this.audioMixer.setObstacles(obstacles);
  }
}
