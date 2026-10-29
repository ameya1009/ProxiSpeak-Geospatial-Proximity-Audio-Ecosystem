const assert = require('assert');
const { calculateDistance, calculateGain, calculatePan, createTestTone } = require('../client/audio/src/AudioMixer');
const { AudioSpikeRunner } = require('../client/audio/src/AudioSpikeRunner');

console.log('--- Running Audio Spike Math & Attenuation Tests ---');

// Test 1: Standard & Negative Coordinates Distance Calculation
assert.strictEqual(calculateDistance({ x: 0, y: 0 }, { x: 30, y: 40 }), 50, '30-40-50 Euclidean distance');
assert.strictEqual(calculateDistance({ x: 50, y: 50 }, { x: 50, y: 50 }), 0, 'Zero distance for identical points');
assert.strictEqual(calculateDistance({ x: -10, y: -20 }, { x: 20, y: 20 }), 50, 'Negative coordinate distance');
console.log('✔ Distance calculations & coordinate edge cases: OK');

// Test 2: Distance Gain Attenuation Curve (100px earshot)
assert.strictEqual(calculateGain(0, 100), 1.0, 'Full volume at 0 px');
assert.strictEqual(calculateGain(50, 100), 0.5, '50% volume at 50 px');
assert.strictEqual(calculateGain(100, 100), 0.0, 'Silent at 100 px');
assert.strictEqual(calculateGain(120, 100), 0.0, 'Silent beyond 100 px');
assert.strictEqual(calculateGain(-5, 100), 1.0, 'Clamped max volume for negative input');
assert.strictEqual(calculateGain(9999, 100), 0.0, 'Clamped min volume for huge distance');
console.log('✔ Distance gain curve & boundary conditions: OK');

// Test 3: Stereo Panning (-1.0 to +1.0)
assert.strictEqual(calculatePan(-100, 100), -1.0, 'Hard left pan');
assert.strictEqual(calculatePan(0, 100), 0.0, 'Center pan');
assert.strictEqual(calculatePan(100, 100), 1.0, 'Hard right pan');
assert.strictEqual(calculatePan(50, 100), 0.5, 'Right pan 0.5');
assert.strictEqual(calculatePan(-500, 100), -1.0, 'Clamped hard left beyond range');
assert.strictEqual(calculatePan(500, 100), 1.0, 'Clamped hard right beyond range');
console.log('✔ Stereo panning & clamping: OK');

// Test 4: Web Audio API Node Graph Wiring (Oscillator -> StereoPanner -> Gain -> Destination)
const connectionChain = [];
let gainSetVal = null;
let panSetVal = null;

const mockContext = {
  currentTime: 10,
  destination: { name: 'destination' },
  createOscillator() {
    const osc = {
      type: '',
      frequency: { setValueAtTime: (v) => { osc.freq = v; } },
      connect: (target) => { connectionChain.push({ from: 'oscillator', to: target.name || 'node' }); },
      start: () => { osc.started = true; },
      stop: () => { osc.stopped = true; }
    };
    return osc;
  },
  createStereoPanner() {
    return {
      name: 'panner',
      pan: { setValueAtTime: (v) => { panSetVal = v; } },
      connect: (target) => { connectionChain.push({ from: 'panner', to: target.name || 'node' }); }
    };
  },
  createGain() {
    return {
      name: 'gain',
      gain: { setValueAtTime: (v) => { gainSetVal = v; } },
      connect: (target) => { connectionChain.push({ from: 'gain', to: target.name || 'node' }); }
    };
  }
};

const tone = createTestTone(mockContext, 440);
assert.strictEqual(tone.osc.started, true, 'Oscillator started');
assert.strictEqual(connectionChain.length, 3, 'Complete 3-node audio pipeline wired');
assert.deepStrictEqual(connectionChain[0], { from: 'oscillator', to: 'panner' });
assert.deepStrictEqual(connectionChain[1], { from: 'panner', to: 'gain' });
assert.deepStrictEqual(connectionChain[2], { from: 'gain', to: 'destination' });
console.log('✔ Web Audio node graph routing & test tone instantiation: OK');

// Test 5: AudioSpikeRunner driven by distance slider
const runner = new AudioSpikeRunner(mockContext);
runner.start(440);

// Move distance slider to 0 px (center)
const stateAt0 = runner.setDistanceSlider(0);
assert.strictEqual(stateAt0.distance, 0);
assert.strictEqual(stateAt0.gain, 1.0);
assert.strictEqual(stateAt0.pan, 0.0);
assert.strictEqual(gainSetVal, 1.0);
assert.strictEqual(panSetVal, 0.0);

// Move distance slider to 60 px right
const stateAt60 = runner.setDistanceSlider(60);
assert.strictEqual(stateAt60.distance, 60);
assert.strictEqual(stateAt60.gain, 0.4);
assert.strictEqual(stateAt60.pan, 0.6);
assert.strictEqual(gainSetVal, 0.4);
assert.strictEqual(panSetVal, 0.6);

// Move distance slider to 100 px left (silent, hard left)
const stateAt100 = runner.setDistanceSlider(-100);
assert.strictEqual(stateAt100.distance, 100);
assert.strictEqual(stateAt100.gain, 0.0);
assert.strictEqual(stateAt100.pan, -1.0);
assert.strictEqual(gainSetVal, 0.0);
assert.strictEqual(panSetVal, -1.0);

runner.stop();
console.log('✔ AudioSpikeRunner distance slider behavior (gain attenuation & panning): OK');

// Test 6: 2D Coordinate Movement (Diagonal distance & 2D panning)
runner.start(440);
runner.setListenerPosition(100, 100);
const diagState = runner.setPeerPosition(130, 140); // dx = 30, dy = 40 => dist = 50
assert.strictEqual(diagState.distance, 50, 'Diagonal distance = 50 px');
assert.strictEqual(diagState.gain, 0.5, 'Gain at 50px = 0.5');
assert.strictEqual(diagState.pan, 0.3, 'Pan for dx=30 / 100 = 0.3');
runner.stop();
console.log('✔ 2D diagonal distance and spatial panning: OK');

// Test 7: Browser HTML UI and Paperwork Integrity
const fs = require('fs');
const path = require('path');
const htmlPath = path.join(__dirname, '../client/audio/index.html');
assert.strictEqual(fs.existsSync(htmlPath), true, 'client/audio/index.html exists');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
assert.strictEqual(htmlContent.includes('AudioMixer.js'), true, 'HTML references AudioMixer.js');
assert.strictEqual(htmlContent.includes('AudioSpikeRunner.js'), true, 'HTML references AudioSpikeRunner.js');
assert.strictEqual(htmlContent.includes('sliderDeltaX'), true, 'HTML contains sliderDeltaX');

const vivaPath = path.join(__dirname, '../docs/VIVA_PREPARATION.md');
assert.strictEqual(fs.existsSync(vivaPath), true, 'docs/VIVA_PREPARATION.md exists');
const checkinPath = path.join(__dirname, '../docs/DAILY_CHECKINS.md');
assert.strictEqual(fs.existsSync(checkinPath), true, 'docs/DAILY_CHECKINS.md exists');
console.log('✔ Browser HTML UI, viva guide, and daily check-ins verification: OK');

// --- SpatialAudioMixer Production Engine Tests (IAudioModule Contract) ---
const { SpatialAudioMixer } = require('../client/audio/src/SpatialAudioMixer');

function createMockAudioContext() {
  const connections = [];
  const disconnections = [];
  return {
    currentTime: 10,
    destination: { name: 'destination' },
    createStereoPanner() {
      const p = {
        name: 'panner',
        pan: {
          value: 0,
          setValueAtTime: (v) => { p.pan.value = v; },
          linearRampToValueAtTime: (v) => { p.pan.value = v; }
        },
        connect: (target) => { connections.push({ from: 'panner', to: target.name || 'node' }); },
        disconnect: () => { disconnections.push('panner'); }
      };
      return p;
    },
    createGain() {
      const g = {
        name: 'gain',
        gain: {
          value: 1,
          setValueAtTime: (v) => { g.gain.value = v; },
          linearRampToValueAtTime: (v) => { g.gain.value = v; }
        },
        connect: (target) => { connections.push({ from: 'gain', to: target.name || 'node' }); },
        disconnect: () => { disconnections.push('gain'); }
      };
      return g;
    },
    createMediaStreamSource(stream) {
      const s = {
        name: 'mediaSource',
        connect: (target) => { connections.push({ from: 'mediaSource', to: target.name || 'node' }); },
        disconnect: () => { disconnections.push('mediaSource'); }
      };
      return s;
    },
    connections,
    disconnections
  };
}

function createMockSourceNode() {
  const node = {
    name: 'mockSource',
    connect: (target) => {},
    disconnect: () => { node.disconnected = true; },
    stop: () => { node.stopped = true; }
  };
  return node;
}

// Test 8: SpatialAudioMixer Multi-Peer Lifecycle & IAudioModule Contract
const mockCtx2 = createMockAudioContext();
const mixer = new SpatialAudioMixer(mockCtx2, { earshotRadius: 100, rampTime: 0 });

const source1 = createMockSourceNode();
const source2 = createMockSourceNode();
const source3 = createMockSourceNode();

mixer.addPeer('peer-1', source1, { x: 0, y: 50 });  // d = 50px
mixer.addPeer('peer-2', source2, { x: 60, y: 0 });  // d = 60px
mixer.addPeer('peer-3', source3, { x: 150, y: 0 }); // d = 150px (silent)

const state1 = mixer.getPeerState('peer-1');
assert.strictEqual(state1.distance, 50, 'Peer 1 distance = 50px');
assert.strictEqual(state1.gain, 0.5, 'Peer 1 gain = 0.5');
assert.strictEqual(state1.pan, 0.0, 'Peer 1 pan = 0.0');
assert.strictEqual(state1.inEarshot, true, 'Peer 1 in earshot');

const state2 = mixer.getPeerState('peer-2');
assert.strictEqual(state2.distance, 60, 'Peer 2 distance = 60px');
assert.strictEqual(state2.gain, 0.4, 'Peer 2 gain = 0.4');
assert.strictEqual(state2.pan, 0.6, 'Peer 2 pan = 0.6 (Right)');
assert.strictEqual(state2.inEarshot, true, 'Peer 2 in earshot');

const state3 = mixer.getPeerState('peer-3');
assert.strictEqual(state3.distance, 150, 'Peer 3 distance = 150px');
assert.strictEqual(state3.gain, 0.0, 'Peer 3 gain = 0.0 (Silent beyond 100px)');
assert.strictEqual(state3.inEarshot, false, 'Peer 3 out of earshot');
console.log('✔ SpatialAudioMixer multi-peer initialization & distance gating: OK');

// Test 9: setListenerPosition & dynamic coordinate recalculation
mixer.setListenerPosition(50, 0); // Moved listener right by 50px
const updatedState1 = mixer.getPeerState('peer-1');
// Listener at (50, 0), Peer 1 at (0, 50) => dx = -50, dy = 50 => dist = sqrt(5000) ~ 70.71
assert.strictEqual(Math.round(updatedState1.distance), 71, 'Peer 1 distance updated');
assert.strictEqual(updatedState1.pan, -0.5, 'Peer 1 pan shifted left to -0.5');

// Update Peer 2 position directly onto listener (50, 0)
const state2Coincident = mixer.setPeerPosition('peer-2', 50, 0);
assert.strictEqual(state2Coincident.distance, 0, 'Coincident distance = 0');
assert.strictEqual(state2Coincident.gain, 1.0, 'Coincident gain = 1.0');
assert.strictEqual(state2Coincident.pan, 0.0, 'Coincident pan = 0.0');

// Mute toggle
assert.strictEqual(mixer.setMuted(true), true);
assert.strictEqual(mixer.setMuted(false), false);
console.log('✔ Listener movements, peer repositioning, and mute toggles: OK');

// Test 10: removePeer, node disconnect, and memory cleanup
const removed = mixer.removePeer('peer-1');
assert.strictEqual(removed, true, 'Peer 1 removed');
assert.strictEqual(mixer.getPeerState('peer-1'), null, 'Peer 1 state cleaned from Map');
assert.strictEqual(source1.disconnected, true, 'Peer 1 source disconnected');

mixer.destroy();
assert.strictEqual(mixer.peers.size, 0, 'All peers destroyed on shutdown');
console.log('✔ Node disconnect, garbage collection, and clean shutdown: OK');

// --- Test 11: AudioIntegrationClient Mock Mode & Proximity Hysteresis ---
const { AudioIntegrationClient } = require('../client/audio/src/AudioIntegrationClient');

const mockCtx3 = createMockAudioContext();
const mixer3 = new SpatialAudioMixer(mockCtx3, { earshotRadius: 100, rampTime: 0 });
const clientAmeya = new AudioIntegrationClient({
  userId: 'user-ameya',
  mixer: mixer3,
  earshotRadius: 100,
  leaveRadius: 120
});

let enteredPeer = null;
let leftPeer = null;
let offererDesignation = null;

clientAmeya.on('peer:enter', (e) => {
  enteredPeer = e.peerId;
  offererDesignation = e.isOfferer;
});
clientAmeya.on('peer:leave', (e) => {
  leftPeer = e.peerId;
});

const peerSourceBob = createMockSourceNode();

// Bob is at (150, 0) -> outside earshot (dist = 150px)
clientAmeya.setRemotePeerPosition('user-bob', 150, 0, peerSourceBob);
assert.strictEqual(enteredPeer, null, 'Bob should not enter at 150px');
assert.strictEqual(clientAmeya.inRangePeers.has('user-bob'), false);

// Bob moves to (90, 0) -> within 100px earshot (dist = 90px)
clientAmeya.setRemotePeerPosition('user-bob', 90, 0, peerSourceBob);
assert.strictEqual(enteredPeer, 'user-bob', 'Bob entered earshot at 90px');
assert.strictEqual(clientAmeya.inRangePeers.has('user-bob'), true);
// Offerer check: 'user-ameya' < 'user-bob' => Ameya is the offerer!
assert.strictEqual(offererDesignation, true, 'Ameya is designated offerer (lower userId)');

// Bob moves to (110, 0) -> within hysteresis buffer (100px < d <= 120px)
clientAmeya.setRemotePeerPosition('user-bob', 110, 0, peerSourceBob);
assert.strictEqual(leftPeer, null, 'Bob should NOT leave in hysteresis zone (110px <= 120px)');
assert.strictEqual(clientAmeya.inRangePeers.has('user-bob'), true);

// Bob moves to (130, 0) -> beyond 120px leave radius
clientAmeya.setRemotePeerPosition('user-bob', 130, 0, peerSourceBob);
assert.strictEqual(leftPeer, 'user-bob', 'Bob left earshot beyond 120px');
assert.strictEqual(clientAmeya.inRangePeers.has('user-bob'), false);
console.log('✔ AudioIntegrationClient mock adapter, 100px/120px hysteresis, and lower-id offerer: OK');

// --- Test 12: WebRTC Signaling Relay & Signal Dispatch ---
// Bring Bob back into range
clientAmeya.setRemotePeerPosition('user-bob', 50, 0, peerSourceBob);
assert.strictEqual(clientAmeya.inRangePeers.has('user-bob'), true);

let sentSignal = null;
clientAmeya.on('signal:sent', (s) => { sentSignal = s; });

const payload = clientAmeya.sendSignal('user-bob', 'offer', { sdp: 'dummy-offer-sdp' });
assert.strictEqual(payload.to, 'user-bob');
assert.strictEqual(payload.from, 'user-ameya');
assert.strictEqual(payload.type, 'offer');
assert.strictEqual(sentSignal.data.sdp, 'dummy-offer-sdp');
console.log('✔ WebRTC signal dispatching & peer gating: OK');

// --- Test 13: WebRTCManager Initialization, STUN Config, and Media Management ---
const { WebRTCManager, DEFAULT_ICE_SERVERS } = require('../client/audio/src/WebRTCManager');

assert.strictEqual(DEFAULT_ICE_SERVERS.length >= 2, true, 'At least 2 Google STUN servers configured');
assert.strictEqual(DEFAULT_ICE_SERVERS[0].urls.includes('stun.l.google.com'), true, 'Primary Google STUN server verified');

function createMockRTCPeerConnection(config) {
  const pc = {
    config,
    localDescription: null,
    remoteDescription: null,
    tracks: [],
    iceCandidates: [],
    closed: false,
    addTrack(track, stream) {
      pc.tracks.push({ track, stream });
    },
    async createOffer() {
      return { type: 'offer', sdp: 'mock-offer-sdp' };
    },
    async createAnswer() {
      return { type: 'answer', sdp: 'mock-answer-sdp' };
    },
    async setLocalDescription(desc) {
      pc.localDescription = desc;
    },
    async setRemoteDescription(desc) {
      pc.remoteDescription = desc;
    },
    async addIceCandidate(cand) {
      pc.iceCandidates.push(cand);
    },
    close() {
      pc.closed = true;
    }
  };
  return pc;
}

const mockCtx4 = createMockAudioContext();
const mixer4 = new SpatialAudioMixer(mockCtx4, { earshotRadius: 100, rampTime: 0 });

let outboundSignals = [];
const rtcAmeya = new WebRTCManager({
  userId: 'user-ameya',
  mixer: mixer4,
  sendSignal: (to, type, data) => {
    outboundSignals.push({ to, type, data });
  },
  peerConnectionFactory: (cfg) => createMockRTCPeerConnection(cfg)
});

// Set mock local stream
const mockTrack = { kind: 'audio', enabled: true };
const mockStream = { getAudioTracks: () => [mockTrack], tracks: [mockTrack] };
rtcAmeya.setLocalStream(mockStream);

// Test mute toggles
rtcAmeya.setMuted(true);
assert.strictEqual(mockTrack.enabled, false, 'Audio track disabled when muted');
assert.strictEqual(rtcAmeya.isMuted, true);
rtcAmeya.setMuted(false);
assert.strictEqual(mockTrack.enabled, true, 'Audio track enabled when unmuted');
assert.strictEqual(rtcAmeya.isMuted, false);
console.log('✔ WebRTCManager STUN configuration, media stream management, and mute toggles: OK');

// --- Test 14: Offer/Answer Lifecycle, Glare Avoidance, and Track Routing ---
async function runWebRTCLifecycleTest() {
  outboundSignals = [];

  // 1. Connect to peer-bob (user-ameya < user-bob): Ameya MUST be the offerer
  const peerBob = await rtcAmeya.connectPeer('user-bob', { x: 30, y: 40 });
  assert.strictEqual(peerBob.isOfferer, true, 'Ameya is designated offerer for user-bob');
  assert.strictEqual(outboundSignals.length, 1, 'Offer dispatched to signaling');
  assert.strictEqual(outboundSignals[0].type, 'offer');
  assert.strictEqual(outboundSignals[0].to, 'user-bob');
  assert.strictEqual(peerBob.pc.localDescription.type, 'offer');

  // Simulate peer-bob replying with an answer
  await rtcAmeya.handleSignal({
    from: 'user-bob',
    type: 'answer',
    data: { type: 'answer', sdp: 'remote-answer-sdp' }
  });
  assert.strictEqual(peerBob.pc.remoteDescription.type, 'answer', 'Remote answer set on RTCPeerConnection');

  // Simulate remote track arrival -> SpatialAudioMixer wiring
  const mockRemoteSourceNode = createMockSourceNode();
  peerBob.pc.ontrack({ streams: [mockRemoteSourceNode], track: mockRemoteSourceNode });
  assert.strictEqual(mixer4.peers.has('user-bob'), true, 'Remote stream automatically wired into SpatialAudioMixer');
  const bobAudioState = mixer4.getPeerState('user-bob');
  assert.strictEqual(bobAudioState.distance, 50, 'Bob spatial distance correctly calculated (30, 40)');
  assert.strictEqual(bobAudioState.gain, 0.5, 'Bob gain attenuated to 50%');

  // 2. Connect to peer-aaron (user-aaron < user-ameya): Ameya is NOT the offerer (awaits offer)
  outboundSignals = [];
  const peerAaron = await rtcAmeya.connectPeer('user-aaron', { x: 0, y: 20 });
  assert.strictEqual(peerAaron.isOfferer, false, 'Ameya is passive receiver for lower-id user-aaron');
  assert.strictEqual(outboundSignals.length, 0, 'No premature offer sent by higher-id client');

  // Aaron sends an offer -> Ameya creates and sends answer
  await rtcAmeya.handleSignal({
    from: 'user-aaron',
    type: 'offer',
    data: { type: 'offer', sdp: 'aaron-offer-sdp' }
  });
  assert.strictEqual(outboundSignals.length, 1, 'Answer dispatched to aaron');
  assert.strictEqual(outboundSignals[0].type, 'answer');
  assert.strictEqual(outboundSignals[0].to, 'user-aaron');

  // Test ICE candidate buffering & handling
  await rtcAmeya.handleSignal({
    from: 'user-aaron',
    type: 'ice-candidate',
    data: { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host' }
  });
  assert.strictEqual(peerAaron.pc.iceCandidates.length, 1, 'ICE candidate received and added');

  // 3. Disconnect peer
  rtcAmeya.disconnectPeer('user-bob');
  assert.strictEqual(peerBob.pc.closed, true, 'RTCPeerConnection closed');
  assert.strictEqual(mixer4.peers.has('user-bob'), false, 'Peer removed from SpatialAudioMixer');

  rtcAmeya.destroy();
  assert.strictEqual(rtcAmeya.peers.size, 0, 'WebRTCManager cleanly shut down');
  console.log('✔ Full WebRTC offer/answer handshake, glare avoidance, trickle ICE, and audio pipeline routing: OK');
}

// --- Test 15: ProximityIntegration Two-Browser Same-Machine Integration (Task A6) ---
async function runProximityIntegrationTest() {
  const { ProximityIntegration } = require('../client/audio/src/ProximityIntegration');

  const mockCtxAlice = createMockAudioContext();
  const mixerAlice = new SpatialAudioMixer(mockCtxAlice, { earshotRadius: 100, rampTime: 0 });

  const mockCtxBob = createMockAudioContext();
  const mixerBob = new SpatialAudioMixer(mockCtxBob, { earshotRadius: 100, rampTime: 0 });

  const signalBus = {
    listeners: new Map(),
    emit(event, data) {
      const list = this.listeners.get(event) || [];
      for (const cb of list) cb(data);
    },
    on(event, cb) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event).push(cb);
    }
  };

  const rtcAlice = new WebRTCManager({
    userId: 'alice',
    mixer: mixerAlice,
    sendSignal: (to, type, data) => signalBus.emit('signal', { to, from: 'alice', type, data }),
    peerConnectionFactory: (cfg) => createMockRTCPeerConnection(cfg)
  });

  const rtcBob = new WebRTCManager({
    userId: 'bob',
    mixer: mixerBob,
    sendSignal: (to, type, data) => signalBus.emit('signal', { to, from: 'bob', type, data }),
    peerConnectionFactory: (cfg) => createMockRTCPeerConnection(cfg)
  });

  const aliceClient = new ProximityIntegration({
    userId: 'alice',
    mixer: mixerAlice,
    webrtcManager: rtcAlice,
    initialPosition: { x: 100, y: 100 },
    earshotRadius: 100,
    leaveRadius: 120
  });

  const bobClient = new ProximityIntegration({
    userId: 'bob',
    mixer: mixerBob,
    webrtcManager: rtcBob,
    initialPosition: { x: 300, y: 100 },
    earshotRadius: 100,
    leaveRadius: 120
  });

  const aliceEvents = [];
  const bobEvents = [];
  aliceClient.on('peer:enter', (e) => aliceEvents.push({ type: 'enter', ...e }));
  aliceClient.on('peer:leave', (e) => aliceEvents.push({ type: 'leave', ...e }));
  bobClient.on('peer:enter', (e) => bobEvents.push({ type: 'enter', ...e }));
  bobClient.on('peer:leave', (e) => bobEvents.push({ type: 'leave', ...e }));

  // 1. Initial State: Distance = 200px (> 120px) -> Out of range
  aliceClient.handleRemoteMove('bob', 300, 100);
  bobClient.handleRemoteMove('alice', 100, 100);

  assert.strictEqual(aliceClient.peers.get('bob').inRange, false, 'Bob initially out of range for Alice');
  assert.strictEqual(bobClient.peers.get('alice').inRange, false, 'Alice initially out of range for Bob');
  assert.strictEqual(aliceEvents.length, 0, 'No enter event yet');

  // 2. Bob walks into Alice's earshot: x=160, y=100 (dist = 60px <= 100px)
  bobClient.updateLocalPosition(160, 100);
  aliceClient.handleRemoteMove('bob', 160, 100);

  assert.strictEqual(aliceClient.peers.get('bob').inRange, true, 'Bob in range for Alice at 60px');
  assert.strictEqual(bobClient.peers.get('alice').inRange, true, 'Alice in range for Bob at 60px');
  assert.strictEqual(aliceEvents.length, 1, 'peer:enter fired for Alice');
  assert.strictEqual(aliceEvents[0].isOfferer, true, 'Alice (lower ID) is the offerer');
  assert.strictEqual(bobEvents[0].isOfferer, false, 'Bob (higher ID) is the receiver');

  // 3. Bob moves within hysteresis band: x=210, y=100 (dist = 110px: 100px < d <= 120px)
  bobClient.updateLocalPosition(210, 100);
  aliceClient.handleRemoteMove('bob', 210, 100);
  assert.strictEqual(aliceClient.peers.get('bob').inRange, true, 'Bob remains connected in hysteresis band (110px)');
  assert.strictEqual(aliceEvents.length, 1, 'No spurious leave event triggered inside hysteresis band');

  // 4. Bob walks away past leave threshold: x=230, y=100 (dist = 130px > 120px) -> WALKING AWAY CUTS SOUND
  bobClient.updateLocalPosition(230, 100);
  aliceClient.handleRemoteMove('bob', 230, 100);

  assert.strictEqual(aliceClient.peers.get('bob').inRange, false, 'Bob marked out of range');
  assert.strictEqual(aliceEvents.length, 2, 'peer:leave event fired on Alice');
  assert.strictEqual(aliceEvents[1].type, 'leave', 'Walking away cuts sound');
  assert.strictEqual(aliceEvents[1].distance, 130, 'Leave distance accurately captured');
  assert.strictEqual(mixerAlice.peers.has('bob'), false, 'Bob removed from Alice SpatialAudioMixer');

  // 5. Clean teardown
  aliceClient.destroy();
  bobClient.destroy();
  assert.strictEqual(aliceClient.peers.size, 0);
  assert.strictEqual(bobClient.peers.size, 0);

  console.log('✔ ProximityIntegration: Canvas movement, peer:enter/leave triggers, lower-id offerer, and walking-away audio cut-off: OK');
}

// --- Test 16: Obstacle Collision, Acoustic Line-of-Sight, and Mid Review Spatial Audit ---
function runObstacleAndSpatialAuditTest() {
  const { ProximityIntegration } = require('../client/audio/src/ProximityIntegration');
  const mockCtx = createMockAudioContext();
  const mixer = new SpatialAudioMixer(mockCtx, { earshotRadius: 100 });

  const client = new ProximityIntegration({
    userId: 'audit-user',
    mixer: mixer,
    initialPosition: { x: 50, y: 50 }
  });

  // 1. Collision detection (matching Harpreet's 5 office desks)
  // Desk 1 is at x: 100..220, y: 100..160
  // Position (150, 130) is inside desk 1 -> MUST be blocked
  assert.strictEqual(client.isBlocked(150, 130, 15), true, 'Position inside desk 1 is blocked');
  // Position (150, 70) is >15px away -> NOT blocked
  assert.strictEqual(client.isBlocked(150, 70, 15), false, 'Position outside desk 1 is free');

  // 2. Acoustic Line-of-sight Ray Casting
  // Path from (50, 130) to (250, 130) passes directly through Desk 1
  const losThroughDesk = client.checkLineOfSight({ x: 50, y: 130 }, { x: 250, y: 130 });
  assert.strictEqual(losThroughDesk.occluded, true, 'Ray passing through desk 1 is occluded');
  assert.strictEqual(losThroughDesk.obstacle.id, 'desk-1', 'Occluding obstacle correctly identified');

  // Path from (50, 50) to (250, 50) is clear
  const losClear = client.checkLineOfSight({ x: 50, y: 50 }, { x: 250, y: 50 });
  assert.strictEqual(losClear.occluded, false, 'Clear line of sight detected');

  // 3. Mid Review Spatial Audit Diagnostics (<20ms latency requirement)
  const diag = client.getDiagnostics();
  assert.strictEqual(diag.userId, 'audit-user');
  assert.strictEqual(diag.isCompliantWithVivaAudit, true);
  assert.ok(diag.spatialAuditLatencyMs < 20, 'Spatial audit latency strictly under 20ms viva requirement');

  client.destroy();
  console.log('✔ Obstacle collision, acoustic line-of-sight ray casting, and <20ms spatial audit diagnostics: OK');
}

// --- Test 17: Task A8 - DistanceGainNode Audio Stream Routing & Smooth Parameter Scheduling ---
function runDistanceGainNodeTest() {
  const { DistanceGainNode } = require('../client/audio/src/DistanceGainNode');
  const mockCtx = createMockAudioContext();

  const gainNode = new DistanceGainNode(mockCtx, {
    minDistance: 30,
    maxDistance: 100,
    rolloffModel: 'linear',
    rampTime: 0.05
  });

  // 1. Initial attenuation curve checks
  assert.strictEqual(gainNode.calculateAttenuation(0), 1.0, 'Full volume at distance 0');
  assert.strictEqual(gainNode.calculateAttenuation(30), 1.0, 'Full volume at minDistance (30px)');
  assert.strictEqual(gainNode.calculateAttenuation(65), 0.5, 'Half volume halfway (65px)');
  assert.strictEqual(gainNode.calculateAttenuation(100), 0.0, 'Zero volume at maxDistance (100px)');
  assert.strictEqual(gainNode.calculateAttenuation(150), 0.0, 'Zero volume beyond maxDistance');

  // 2. Smooth parameter ramping without clicks
  const scheduledGain = gainNode.updateDistance(65);
  assert.strictEqual(scheduledGain, 0.5);
  const diag = gainNode.getDiagnostics();
  assert.strictEqual(diag.currentGain, 0.5);
  assert.strictEqual(diag.lastRampSchedule.duration, 0.05, '50ms click-prevention ramp scheduled');
  assert.strictEqual(diag.inRange, true);

  // 3. Move beyond earshot -> distance gating
  gainNode.updateDistance(120);
  assert.strictEqual(gainNode.getDiagnostics().currentGain, 0.0);
  assert.strictEqual(gainNode.isInAudibleRange(), false, 'Out of audible range');

  // 4. Mute / Unmute
  gainNode.updateDistance(30);
  assert.strictEqual(gainNode.getDiagnostics().currentGain, 1.0);
  gainNode.mute();
  assert.strictEqual(gainNode.getDiagnostics().currentGain, 0.0);
  assert.strictEqual(gainNode.getDiagnostics().muted, true);
  gainNode.unmute();
  assert.strictEqual(gainNode.getDiagnostics().currentGain, 1.0);
  assert.strictEqual(gainNode.getDiagnostics().muted, false);

  // 5. Alternate models (inverse and exponential)
  const inverseNode = new DistanceGainNode(mockCtx, { minDistance: 30, maxDistance: 100, rolloffModel: 'inverse' });
  assert.strictEqual(inverseNode.calculateAttenuation(30), 1.0);
  assert.ok(inverseNode.calculateAttenuation(65) > 0 && inverseNode.calculateAttenuation(65) < 1.0);
  assert.strictEqual(inverseNode.calculateAttenuation(100), 0.0);

  // 6. Source attachment & cleanup
  const mockSource = { connect: () => {}, disconnect: () => {} };
  gainNode.attachSource(mockSource);
  assert.strictEqual(gainNode.getDiagnostics().hasSource, true);
  gainNode.destroy();
  assert.strictEqual(gainNode.getDiagnostics().hasSource, false);

  console.log('✔ Task A8: DistanceGainNode stream routing, smooth ramps, and click prevention: OK');
}

// --- Test 18: Tasks M1 & M5 - MongoDB 2D Index Schema, Validation & TTL Sweeper ---
function runPositionSchemaAndTTLTest() {
  const { validatePosition, PositionIndexDefinitions } = require('../server/geo/src/schema/position');
  const { GhostAvatarSweeper, TTLIndexDefinition } = require('../server/geo/src/schema/ttl');

  // 1. Position Schema Index definition
  assert.strictEqual(PositionIndexDefinitions[0].fields.pos, '2d', 'Uses 2D Cartesian planar index');
  assert.strictEqual(PositionIndexDefinitions[1].options.unique, true, 'Unique user/room index');

  // 2. Position validation
  assert.strictEqual(validatePosition(null).valid, false);
  assert.strictEqual(validatePosition({ userId: '', roomId: 'r1', pos: [10, 20] }).valid, false);
  assert.strictEqual(validatePosition({ userId: 'u1', roomId: 'r1', pos: 'bad' }).valid, false);
  assert.strictEqual(validatePosition({ userId: 'u1', roomId: 'r1', pos: [NaN, 20] }).valid, false);
  
  const validResult = validatePosition({ userId: 'alice', roomId: 'office-1', pos: [120, 340] });
  assert.strictEqual(validResult.valid, true);
  assert.deepStrictEqual(validResult.normalized.pos, [120, 340]);

  // 3. TTL Index specification
  assert.strictEqual(TTLIndexDefinition.fields.updatedAt, 1);
  assert.strictEqual(TTLIndexDefinition.options.expireAfterSeconds, 30);

  // 4. Ghost Avatar Sweeper
  const sweeper = new GhostAvatarSweeper({ expireAfterSeconds: 30 });
  const map = new Map();
  const now = Date.now();
  map.set('office-1:active-user', { userId: 'active-user', updatedAt: new Date(now - 5000) });
  map.set('office-1:ghost-user', { userId: 'ghost-user', updatedAt: new Date(now - 45000) }); // >30s old

  const evicted = sweeper.sweepInMemory(map, now);
  assert.strictEqual(evicted.length, 1);
  assert.strictEqual(evicted[0], 'ghost-user', 'Ghost avatar automatically evicted');
  assert.strictEqual(map.has('office-1:ghost-user'), false);
  assert.strictEqual(map.has('office-1:active-user'), true);

  console.log('✔ Tasks M1 & M5: Position 2D schema validation, TTL indexing, and ghost avatar cleanup: OK');
}

// --- Test 19: Task M2 - PositionRepository ($near & $geoWithin) ---
async function runPositionRepositoryTest() {
  const { PositionRepository } = require('../server/geo/src/repository/positionRepo');
  const repo = new PositionRepository();
  const roomId = 'test-room';

  // 1. Upsert positions
  await repo.upsertPosition('user-a', roomId, [100, 100]);
  await repo.upsertPosition('user-b', roomId, [150, 100]); // 50px away
  await repo.upsertPosition('user-c', roomId, [190, 100]); // 90px away
  await repo.upsertPosition('user-d', roomId, [300, 100]); // 200px away (out of earshot)

  assert.strictEqual(await repo.count(roomId), 4);
  const posA = await repo.getPosition('user-a', roomId);
  assert.deepStrictEqual(posA.pos, [100, 100]);

  // 2. nearby ($near) query from user-a [100, 100] with 100px earshot
  const nearA = await repo.nearby(roomId, [100, 100], 100, 10, 'user-a');
  assert.strictEqual(nearA.length, 2, 'user-b and user-c are within 100px earshot');
  assert.strictEqual(nearA[0].userId, 'user-b', 'user-b is closest (50px)');
  assert.strictEqual(nearA[0].distance, 50);
  assert.strictEqual(nearA[1].userId, 'user-c', 'user-c is second closest (90px)');
  assert.strictEqual(nearA[1].distance, 90);

  // 3. withinCircle ($geoWithin) query
  const circleResults = await repo.withinCircle(roomId, [100, 100], 100);
  assert.strictEqual(circleResults.length, 3, 'user-a, user-b, user-c inside 100px circle');

  // 4. Remove user
  await repo.removePosition('user-d', roomId);
  assert.strictEqual(await repo.count(roomId), 3);
  assert.strictEqual(await repo.getPosition('user-d', roomId), null);

  repo.clear();
  assert.strictEqual(await repo.count(roomId), 0);
  console.log('✔ Task M2: PositionRepository upsert, remove, $near distance sorting, and $geoWithin: OK');
}

// --- Test 20: Task M3 - Proximity Clustering (Connected User Components) ---
function runProximityClusteringTest() {
  const { clusterUsersByProximity, getActiveConversations, findUserCluster } = require('../server/geo/src/clusters/proximityCluster');

  // Group 1: Alice, Bob, Charlie forming an audio chain (Alice at 0, Bob at 60, Charlie at 120 -> all within 60px <= 100px)
  // Group 2: David and Eve (David at 500, Eve at 550 -> 50px <= 100px)
  // Isolated: Frank at (900, 900)
  const users = [
    { userId: 'alice', pos: [0, 0] },
    { userId: 'bob', pos: [60, 0] },
    { userId: 'charlie', pos: [120, 0] },
    { userId: 'david', pos: [500, 0] },
    { userId: 'eve', pos: [550, 0] },
    { userId: 'frank', pos: [900, 900] }
  ];

  const clusters = clusterUsersByProximity(users, 100);
  assert.strictEqual(clusters.length, 3, 'Three distinct spatial clusters');

  // Group 1 should contain alice, bob, charlie
  const group1 = clusters.find(c => c.members.includes('alice'));
  assert.ok(group1);
  assert.strictEqual(group1.size, 3);
  assert.deepStrictEqual(group1.members.sort(), ['alice', 'bob', 'charlie']);
  assert.deepStrictEqual(group1.centroid, [60, 0]);
  assert.strictEqual(group1.isolated, false);

  // Group 2 should contain david, eve
  const group2 = clusters.find(c => c.members.includes('david'));
  assert.ok(group2);
  assert.strictEqual(group2.size, 2);
  assert.deepStrictEqual(group2.members.sort(), ['david', 'eve']);

  // Isolated Frank
  const frankCluster = findUserCluster('frank', clusters);
  assert.ok(frankCluster);
  assert.strictEqual(frankCluster.isolated, true);

  // Active conversations
  const conversations = getActiveConversations(clusters);
  assert.strictEqual(conversations.length, 2, 'Two multi-user conversation circles');

  console.log('✔ Task M3: Spatial proximity clustering, connected components, and conversation grouping: OK');
}

// --- Test 21: Task M6 - PositionWriteBatcher (Write Throttling & Coalescing) ---
async function runWriteBatcherTest() {
  const { PositionRepository } = require('../server/geo/src/repository/positionRepo');
  const { PositionWriteBatcher } = require('../server/geo/src/tuning/batcher');

  const repo = new PositionRepository();
  const batcher = new PositionWriteBatcher(repo, {
    flushIntervalMs: 50,
    maxBatchSize: 100,
    autoStart: false // manual flush control for deterministic test
  });

  const roomId = 'room-speed';

  // Simulate high-frequency 60Hz movements from 3 users emitting 10 updates each in the same 50ms window
  for (let step = 0; step < 10; step++) {
    batcher.queueUpdate('user-1', roomId, [100 + step, 200]);
    batcher.queueUpdate('user-2', roomId, [300 + step, 400]);
    batcher.queueUpdate('user-3', roomId, [500 + step, 600]);
  }

  // 30 incoming writes queued, but because of last-write-wins deduplication, only 3 writes pending!
  assert.strictEqual(batcher.getPendingCount(), 3);
  const flushed = await batcher.flushNow();
  assert.strictEqual(flushed, 3, 'Flushed exactly 3 coalesced writes instead of 30');

  const stats = batcher.getStats();
  assert.strictEqual(stats.totalIncoming, 30);
  assert.strictEqual(stats.totalFlushed, 3);
  assert.strictEqual(stats.totalCoalesced, 27);
  assert.strictEqual(stats.coalescingEfficiencyPct, 90.0, '90% write reduction efficiency achieved');

  // Verify DB contains the latest positions
  const pos1 = await repo.getPosition('user-1', roomId);
  assert.deepStrictEqual(pos1.pos, [109, 200], 'Last-write-wins position stored');

  batcher.stop();
  console.log('✔ Task M6: PositionWriteBatcher write coalescing, throttling, and >70% efficiency: OK');
}

// --- Test 22: Task M4 - Geospatial Benchmark Harness (<20ms p99 Latency Assertion) ---
async function runGeospatialBenchmarkTest() {
  const { runGeospatialBenchmark } = require('../server/geo/benchmark');
  const report = await runGeospatialBenchmark({
    userCounts: [50, 100],
    queriesPerUser: 5,
    earshotRadius: 100
  });

  assert.strictEqual(report.allPassed, true, 'Benchmark p99 latency strictly < 20ms');
  for (const res of report.results) {
    assert.ok(res.p99Ms < 20.0, `p99 latency for ${res.userCount} users (${res.p99Ms}ms) < 20ms`);
  }

  console.log('✔ Task M4: Benchmark harness for 50 & 100 users with p99 < 20ms: OK');
}

// --- Test 23: Task M7 - Rooms Collection Schema & Obstacle Validation ---
function runRoomSchemaTest() {
  const { validateRoom, RoomIndexDefinitions } = require('../server/geo/src/schema/room');
  assert.strictEqual(RoomIndexDefinitions[0].fields.roomId, 1);
  assert.strictEqual(RoomIndexDefinitions[0].options.unique, true);

  assert.strictEqual(validateRoom(null).valid, false);
  assert.strictEqual(validateRoom({ roomId: '' }).valid, false);
  assert.strictEqual(validateRoom({ roomId: 'r1', size: { width: -10, height: 100 } }).valid, false);

  const valid = validateRoom({
    roomId: 'room-main',
    name: 'Executive Boardroom',
    size: { width: 1000, height: 600 },
    obstacles: [
      { id: 'obs-1', name: 'Conference Table', x: 200, y: 150, width: 200, height: 100, type: 'desk' }
    ]
  });
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.normalized.obstacles.length, 1);
  assert.strictEqual(valid.normalized.obstacles[0].acousticAttenuationDb, 6.0);
  console.log('✔ Task M7: Rooms schema validation & obstacle AABB parameters: OK');
}

// --- Test 24: Tasks M8 & M9 - Room Repository, Obstacle Persistence & Documentation ---
async function runRoomRepoAndDocsTest() {
  const fs = require('fs');
  const { RoomRepository } = require('../server/geo/src/repository/roomRepo');
  const repo = new RoomRepository();

  // 1. Check default seeded office room matching Harpreet's canvas
  const defaultRoom = await repo.getRoom('default-office');
  assert.ok(defaultRoom);
  assert.strictEqual(defaultRoom.obstacles.length, 5, 'Seeded with 5 office workstations');

  // 2. Query obstacles in a specific region
  const regionObstacles = await repo.getObstaclesInRegion('default-office', {
    minX: 50,
    minY: 50,
    maxX: 240,
    maxY: 180
  });
  assert.ok(regionObstacles.length >= 1, 'Found workstation 1 intersecting bounding box');
  assert.strictEqual(regionObstacles[0].id, 'desk-1');

  // 3. Upsert a custom room
  await repo.upsertRoom({
    roomId: 'huddle-room-1',
    name: 'Huddle Room Alpha',
    size: { width: 500, height: 400 },
    obstacles: []
  });
  const allRooms = await repo.listRooms();
  assert.strictEqual(allRooms.length, 2);

  // 4. Verify Task M9 documentation chapter exists and is comprehensive (>100 lines)
  assert.strictEqual(fs.existsSync('server/geo/docs/chapter.md'), true);
  const chapterContent = fs.readFileSync('server/geo/docs/chapter.md', 'utf8');
  assert.ok(chapterContent.length > 2000, 'Database architecture chapter is fully written');
  assert.ok(chapterContent.includes('Entity-Relationship'), 'Contains ER diagram');

  console.log('✔ Tasks M8 & M9: Room persistence, obstacle spatial queries, and DB documentation chapter: OK');
}

// --- Test 25: Task A9 - ConnectionCapper (Cap to N Nearest Peers + Leave Hysteresis) ---
function runConnectionCapperTest() {
  const { ConnectionCapper } = require('../client/audio/src/ConnectionCapper');

  const connected = [];
  const disconnected = [];
  const evicted = [];

  const capper = new ConnectionCapper({
    maxConnections: 2, // Cap at 2 simultaneous connections
    enterRadius: 100,
    leaveRadius: 120,
    swapHysteresis: 15,
    onConnect: (id, dist) => connected.push({ id, dist }),
    onDisconnect: (id, reason) => disconnected.push({ id, reason }),
    onEvict: (evictedId, newId) => evicted.push({ evictedId, newId })
  });

  capper.setListenerPosition(0, 0);

  // 1. Peer A at 40px, Peer B at 70px -> both admitted (2 slots filled)
  capper.updatePeerPosition('peerA', 40, 0);
  capper.updatePeerPosition('peerB', 70, 0);

  assert.strictEqual(capper.getActivePeers().length, 2);
  assert.strictEqual(capper.isPeerActive('peerA'), true);
  assert.strictEqual(capper.isPeerActive('peerB'), true);
  assert.strictEqual(connected.length, 2);

  // 2. Peer C arrives at 65px: closer than Peer B (70px), BUT only 5px closer (< swapHysteresis of 15px)
  // MUST NOT evict Peer B (anti-thrashing hysteresis)
  capper.updatePeerPosition('peerC', 65, 0);
  assert.strictEqual(capper.isPeerActive('peerB'), true, 'Peer B not evicted due to swap hysteresis margin');
  assert.strictEqual(capper.isPeerActive('peerC'), false, 'Peer C rejected pending sufficient distance delta');

  // 3. Peer C moves to 50px: now 20px closer than Peer B (70 - 50 = 20 > 15px)
  // MUST evict Peer B and admit Peer C
  capper.updatePeerPosition('peerC', 50, 0);
  assert.strictEqual(capper.isPeerActive('peerB'), false, 'Peer B evicted by significantly closer Peer C');
  assert.strictEqual(capper.isPeerActive('peerC'), true, 'Peer C admitted');
  assert.strictEqual(evicted.length, 1);
  assert.strictEqual(evicted[0].evictedId, 'peerB');
  assert.strictEqual(evicted[0].newId, 'peerC');

  // Peer B walks away out of earshot (200px)
  capper.updatePeerPosition('peerB', 200, 0);

  // 4. Peer A moves to 110px: within 100px - 120px leave hysteresis buffer -> stays connected
  capper.updatePeerPosition('peerA', 110, 0);
  assert.strictEqual(capper.isPeerActive('peerA'), true, 'Peer A remains connected in leave hysteresis buffer (110px)');

  // 5. Peer A moves to 125px (> 120px leaveRadius) -> naturally evicted
  capper.updatePeerPosition('peerA', 125, 0);
  assert.strictEqual(capper.isPeerActive('peerA'), false, 'Peer A evicted after exceeding leave radius');

  // Clean clear
  capper.clear();
  assert.strictEqual(capper.getActivePeers().length, 0);
  console.log('✔ Task A9: ConnectionCapper N-peer cap, swap hysteresis margin, and leave buffer: OK');
}

// --- Test 26: Task A10 - ObstacleAttenuation (AABB Ray-Casting, Acoustic Loss, and Low-Pass Filter) ---
function runObstacleAttenuationTest() {
  const { ObstacleAttenuation } = require('../client/audio/src/ObstacleAttenuation');
  const attenuator = new ObstacleAttenuation({
    baseDeskLossDb: 6.0,
    baseWallLossDb: 14.0,
    clearCutoffHz: 20000,
    occludedCutoffHz: 900
  });

  const obstacles = [
    { id: 'desk-1', x: 100, y: 100, width: 120, height: 60, type: 'desk' },
    { id: 'wall-1', x: 300, y: 50, width: 20, height: 200, type: 'wall' }
  ];

  // 1. Clear Line-of-sight: from (0, 0) to (50, 50)
  const clearResult = attenuator.analyzeLineOfSight({ x: 0, y: 0 }, { x: 50, y: 50 }, obstacles);
  assert.strictEqual(clearResult.occluded, false);
  assert.strictEqual(clearResult.totalLossDb, 0);
  assert.strictEqual(clearResult.gainMultiplier, 1.0);
  assert.strictEqual(clearResult.cutoffFrequencyHz, 20000);

  // 2. Occluded by Desk 1: from (50, 130) to (250, 130)
  const deskResult = attenuator.analyzeLineOfSight({ x: 50, y: 130 }, { x: 250, y: 130 }, obstacles);
  assert.strictEqual(deskResult.occluded, true);
  assert.strictEqual(deskResult.intersectedObstacles.length, 1);
  assert.strictEqual(deskResult.intersectedObstacles[0].id, 'desk-1');
  assert.strictEqual(deskResult.totalLossDb, 6.0);
  assert.ok(deskResult.gainMultiplier < 0.6 && deskResult.gainMultiplier > 0.4, '6dB loss produces ~0.501 linear gain');
  assert.ok(deskResult.cutoffFrequencyHz <= 900, 'Low-pass filter frequency clamped for acoustic occlusion');

  // 3. Occluded by both Desk 1 and Wall 1: from (50, 130) to (400, 130)
  const multiResult = attenuator.analyzeLineOfSight({ x: 50, y: 130 }, { x: 400, y: 130 }, obstacles);
  assert.strictEqual(multiResult.occluded, true);
  assert.strictEqual(multiResult.intersectedObstacles.length, 2);
  assert.strictEqual(multiResult.totalLossDb, 20.0, '6dB desk + 14dB wall = 20dB cumulative loss');
  assert.strictEqual(multiResult.gainMultiplier, 0.1, '20dB loss produces 0.1 linear gain');

  // 4. Stereo panning calculation
  assert.strictEqual(attenuator.calculatePan(0, 100), 0.0, 'Center pan');
  assert.strictEqual(attenuator.calculatePan(-100, 100), -1.0, 'Hard left pan');
  assert.strictEqual(attenuator.calculatePan(100, 100), 1.0, 'Hard right pan');
  assert.strictEqual(attenuator.calculatePan(50, 100), 0.5, 'Right pan 0.5');

  console.log('✔ Task A10: ObstacleAttenuation AABB ray-casting, dB transmission loss, biquad filter, and stereo pan: OK');
}

async function runAll() {
  await runWebRTCLifecycleTest();
  await runProximityIntegrationTest();
  runObstacleAndSpatialAuditTest();
  runDistanceGainNodeTest();
  runPositionSchemaAndTTLTest();
  await runPositionRepositoryTest();
  runProximityClusteringTest();
  await runWriteBatcherTest();
  await runGeospatialBenchmarkTest();
  runRoomSchemaTest();
  await runRoomRepoAndDocsTest();
  runConnectionCapperTest();
  runObstacleAttenuationTest();
  console.log('\nAll 26 audio spike, SpatialAudioMixer, multi-peer, WebRTCManager, ProximityIntegration, DistanceGainNode, ConnectionCapper, ObstacleAttenuation, and Geospatial Engine assertions passed cleanly.');
}

runAll().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
