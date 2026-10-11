# Shared API & Event Contracts (Version 1.0)
**Project**: ProxiSpeak: Geospatial Proximity Audio Ecosystem  
**Cohort**: Group 15  
**Policy**: Agreed in Week 1; mutable only via Pull Request with approval from contract owners.

---

## 1. Movement and Presence Contract
- **Owner**: Abhishek (`server/signaling`)
- **Used by**: Harpreet (`client/world`)

### Client -> Server Events:
```typescript
// Emitted when a client joins the virtual room
socket.emit('join', {
  roomId: string,
  userId: string,
  username: string,
  initialPos: { x: number, y: number }
});

// Emitted when avatar moves on canvas (throttled at ~15-20 updates/sec)
socket.emit('move', {
  x: number, // Bounded by world coordinates
  y: number
});
```

### Server -> Client Events:
```typescript
// Broadcasted to room subscribers when a peer changes position
socket.on('peer:moved', (data: { userId: string; x: number; y: number }));

// Broadcasted when a peer leaves or disconnects
socket.on('peer:left', (data: { userId: string }));

// Initial room state snapshot sent immediately after join
socket.on('state:snapshot', (data: {
  users: Array<{ userId: string; username: string; x: number; y: number }>;
  roomId: string;
}));
```

---

## 2. Proximity and Signaling Contract
- **Owner**: Abhishek (`server/signaling`)
- **Used by**: Ameya (`client/audio`)

### Server -> Client Proximity Events:
```typescript
// Fired when a peer comes within 100 pixels (Earshot Radius)
socket.on('peer:enter', (data: { peerId: string; x: number; y: number }));

// Fired when an existing peer moves beyond 120 pixels (Hysteresis Buffer)
socket.on('peer:leave', (data: { peerId: string }));
```

### Bidirectional WebRTC Signaling Relay:
```typescript
// Signal relayed ONLY between peers currently in proximity
socket.emit('signal', {
  to: string,      // Recipient userId
  type: 'offer' | 'answer' | 'ice-candidate',
  data: any        // RTCSessionDescriptionInit or RTCIceCandidateInit
});

socket.on('signal', (data: {
  from: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
}));
```

---

## 3. Position Data Repository Contract
- **Owner**: Milind (`server/geo`)
- **Used by**: Abhishek (`server/signaling`)

```typescript
export interface PositionDoc {
  userId: string;
  roomId: string;
  pos: [number, number]; // [x, y] coordinates in flat 2d space
  updatedAt: Date;
}

export interface IPositionRepository {
  upsertPosition(userId: string, roomId: string, x: number, y: number): Promise<PositionDoc>;
  remove(userId: string): Promise<boolean>;
  nearby(userId: string, radiusPx: number): Promise<PositionDoc[]>;
  withinCircle(roomId: string, centerX: number, centerY: number, radiusPx: number): Promise<PositionDoc[]>;
}
```

---

## 4. Audio Module API Contract
- **Owner**: Ameya (`client/audio`)
- **Used by**: Harpreet (`client/world`)

```typescript
export interface IAudioModule {
  /**
   * Registers a remote WebRTC MediaStream for an in-range peer.
   * Wires the stream into the Web Audio API graph (source -> panner -> gain -> destination).
   */
  addPeer(id: string, stream: MediaStream): void;

  /**
   * Disconnects and destroys Web Audio nodes associated with a departing peer.
   */
  removePeer(id: string): void;

  /**
   * Sets the local user's avatar position (listener location).
   */
  setListenerPosition(x: number, y: number): void;

  /**
   * Sets an in-range peer's position to adjust distance-based attenuation and stereo panning.
   */
  setPeerPosition(id: string, x: number, y: number): void;

  /**
   * Mutes or unmutes local microphone track.
   */
  setMuted(muted: boolean): boolean;
}
```
