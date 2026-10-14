# ProxiSpeak: Viva Examination & Technical Defense Guide
**Author / Candidate**: Ameya (`Ameya's-branch` — Team Lead, Spatial Audio Mixer & WebRTC Client)  
**Project**: ProxiSpeak: Geospatial Proximity Audio Ecosystem  
**Target Window**: Mid-Review (26/27 Oct 2026) & Final Review (9/10 Nov 2026)  

---

## 1. WebRTC Signaling, Offer/Answer, and ICE

### 1.1. Handshake Lifecycle
WebRTC establishes direct peer-to-peer media transmission without streaming audio through the signaling server:
1. **Local Media Acquisition**: Calling `navigator.mediaDevices.getUserMedia({ audio: true, video: false })` acquires the local microphone `MediaStream`.
2. **Peer Initialization**: An `RTCPeerConnection` instance is instantiated per in-range peer.
3. **Offer Generation**: The initiating peer calls `pc.createOffer()`, sets it locally with `pc.setLocalDescription(offer)`, and forwards the SDP (Session Description Protocol) object via Socket.io signaling:
   ```javascript
   socket.emit('signal', { to: targetUserId, type: 'offer', data: offer });
   ```
4. **Answer Generation**: The recipient receives the offer, sets `pc.setRemoteDescription(offer)`, generates `pc.createAnswer()`, sets `pc.setLocalDescription(answer)`, and returns the answer through the signaling relay.
5. **Remote Stream Reception**: When the media tracks are negotiated, the `ontrack` event fires on `RTCPeerConnection`, providing the remote `MediaStream` which is piped into the Web Audio API graph.

### 1.2. Interactive Connectivity Establishment (ICE) & Trickle ICE
- **ICE Candidates**: Network interfaces (host IP, server reflexive IP, relay IP) discovered by the browser.
- **Trickle ICE**: Rather than waiting for all candidate gathering to finish before sending the SDP, candidates are streamed incrementally via `pc.onicecandidate` as soon as they are gathered:
  ```javascript
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { to: targetUserId, type: 'ice-candidate', data: event.candidate });
    }
  };
  ```

---

## 2. STUN vs. TURN & NAT Traversal

| Protocol | Full Name | Purpose | Data Path | Cost & Latency |
| :--- | :--- | :--- | :--- | :--- |
| **STUN** | Session Traversal Utilities for NAT (RFC 5389) | Discovers the public IP and UDP port assigned by a NAT | Direct peer-to-peer (media does not flow through STUN) | Extremely lightweight, minimal server CPU/bandwidth |
| **TURN** | Traversal Using Relays around NAT (RFC 5766) | Relays audio packets when direct connection fails | Media relayed through TURN server | High bandwidth and hosting cost; adds hop latency |

### Why STUN Fails & When TURN is Needed:
- In **Full-Cone** or **Port-Restricted Cone NAT**, STUN successfully tells the client its public reflexive IP and port, allowing incoming UDP packets from the peer.
- In **Symmetric NAT** (common in enterprise firewalls and mobile 4G/5G carriers), the NAT device allocates a completely different port for every remote destination IP. The port STUN discovered cannot receive packets from the peer. Direct P2P is blocked, and TURN relaying is strictly required.

---

## 3. P2P Mesh Limits & Geospatial Earshot Culling

### 3.1. The Full-Mesh Bottleneck
In a standard full-mesh WebRTC architecture:
- Each peer uploads their audio to all $N-1$ users.
- Total connections across the room scale at:
  $$\text{Connections} = \frac{N(N - 1)}{2} = O(N^2)$$
- Client upstream bandwidth scales linearly at $O(N)$. At 50 participants streaming Opus audio at 40 kbps:
  $$50 \times 40\text{ kbps} = 2.0\text{ Mbps upload per client}$$
  Most client browsers and home connections suffer severe packet loss, jitter, and CPU exhaustion.

### 3.2. ProxiSpeak's Solution: Geospatial Mesh Gating
Rather than maintaining a room-wide mesh, ProxiSpeak dynamically gates connections using the virtual world coordinates:
1. **Earshot Threshold ($100\text{px}$)**: Only avatars within 100 pixels establish an `RTCPeerConnection`.
2. **Leave Hysteresis ($120\text{px}$)**: Prevents connection flapping at the perimeter.
3. **Connection Cap ($N_{\max} \le 6$)**: Each client caps active peer connections to the $N$ closest avatars, guaranteeing client bandwidth and CPU remain bounded at $O(1)$.

---

## 4. Avoiding Offer Collisions (Glare Handling)

### 4.1. What is Glare?
When Avatar A and Avatar B walk into earshot simultaneously, both clients may trigger `peer:enter` at the same instant and both emit an `offer`. In WebRTC, an incoming offer received while in the `have-local-offer` state causes a collision error (Glare).

### 4.2. ProxiSpeak's Deterministic Rule: Lower User ID Offerer
To avoid glare without complex retry backoffs, ProxiSpeak enforces a deterministic tie-breaker:
$$\text{Offerer} = \min(\text{localUserId}, \text{remoteUserId})$$
- If `localUserId < remoteUserId`: The local client generates and sends the `offer`.
- If `localUserId > remoteUserId`: The local client stays passive and waits for the remote peer's `offer`.
- This ensures exactly **one** offer is created per peer pair, completely eliminating race conditions.

---

## 5. Web Audio API Graph & Attenuation Math

### 5.1. Audio Node Routing Graph
```text
[MediaStreamSource / 440Hz Oscillator]
                │
                ▼
     [StereoPannerNode] (Pan: -1.0 [Left] to +1.0 [Right])
                │
                ▼
         [GainNode] (Volume: 1.00 down to 0.00)
                │
                ▼
     [AudioContext.destination] (Speakers / Headphones)
```

### 5.2. Mathematical Formulas

#### Euclidean Distance
Given listener position $(x_1, y_1)$ and peer position $(x_2, y_2)$:
$$d = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$$

#### Linear Distance Attenuation
With earshot radius $R_{\max} = 100\text{px}$:
$$G(d) = \begin{cases} 
1.0 & \text{if } d \le 0 \\
1 - \frac{d}{R_{\max}} & \text{if } 0 < d < R_{\max} \\
0.0 & \text{if } d \ge R_{\max} 
\end{cases}$$

#### Why Linear Attenuation Over Inverse Square ($1/d^2$)?
- The physical inverse square law ($1/d^2$) approaches infinity as $d \to 0$, causing extreme digital clipping or requiring artificial near-field clamping.
- Linear attenuation provides a predictable, human-friendly fade curve and smoothly reaches complete silence at exactly $R_{\max} = 100\text{px}$, which visually matches the 2D canvas earshot boundary.

#### Stereo Panning
Given relative horizontal displacement $\Delta x = x_{\text{peer}} - x_{\text{listener}}$:
$$P = \text{clamp}\left(\frac{\Delta x}{R_{\max}}, -1.0, 1.0\right)$$
- $\Delta x = -100\text{px} \implies P = -1.0$ (Full Left Channel)
- $\Delta x = 0\text{px} \implies P = 0.0$ (Center / Balanced)
- $\Delta x = +100\text{px} \implies P = +1.0$ (Full Right Channel)

---

## 6. System Architecture: How the Four Modules Fit Together

```text
  ┌──────────────────────────────────────────────────────────────┐
  │                 HARPREET: 2D VIRTUAL WORLD                   │
  │  - React + HTML5 Canvas (60 FPS requestAnimationFrame)      │
  │  - Captures WASD keystrokes; renders avatars & earshot rings │
  └──────────────────────────────┬───────────────────────────────┘
                                 │ Emits: socket.emit('move', {x, y})
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                 ABHISHEK: SIGNALING SERVER                   │
  │  - Node.js, Express, Socket.io, Redis Pub/Sub                │
  │  - Evaluates proximity: emits 'peer:enter' and 'peer:leave'  │
  │  - Relays WebRTC signaling offers/answers/ICE                │
  └──────────────────────────────┬───────────────────────────────┘
                                 │ Queries / Persists positions
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                 MILIND: GEOSPATIAL DATABASE                  │
  │  - MongoDB with 2d planar index: { pos: [x, y] }            │
  │  - Executes $near and $geoWithin queries in <20 ms           │
  └──────────────────────────────┬───────────────────────────────┘
                                 │ Proximity triggers audio
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                  AMEYA: SPATIAL AUDIO MIXER                  │
  │  - WebRTC PeerConnection manager with STUN                   │
  │  - Web Audio API graph (StereoPanner -> Gain -> Output)      │
  │  - Continuous distance attenuation and relative panning      │
  └──────────────────────────────────────────────────────────────┘
```
