# Final Project Report & Presentation Outline
**Project**: ProxiSpeak: Geospatial Proximity Audio Ecosystem  
**Group**: Group 15  
**Team Lead**: Ameya  
**Submission Window**: 5 to 10 Nov 2026  

---

## 1. Executive Summary
ProxiSpeak bridges the gap between conventional video conferencing and natural physical office interaction by mapping participants onto a 2D spatial canvas with real-time distance-attenuated audio, line-of-sight sound occlusion, and WebRTC mesh communication.

## 2. Architecture & Modules
- **Spatial Audio Mixer (`client/audio`)**: Web Audio API node graph with stereo panning, inverse linear distance attenuation, and wall muffling.
- **Signaling Server (`server/signaling`)**: Node.js/Socket.io backend with Redis Pub/Sub multi-instance scaling.
- **Geospatial Engine (`server/geo`)**: MongoDB 2d flat planar indexing for sub-20ms proximity queries and room layout persistence.
- **2D Virtual World (`client/world`)**: High-performance React & HTML5 Canvas running at 60 FPS.

## 3. WebRTC Viva Concepts & Theoretical Foundations
- **Offer / Answer / ICE**: SDP negotiation model, ICE candidate gathering via STUN.
- **Why Full Mesh Has Limits**: \(O(N^2)\) peer connections require CPU and bandwidth scaling limitations; solved via proximity gating + capping connections to \(N=6\) nearest peers.
- **Web Audio Node Graph**: Source -> StereoPannerNode -> GainNode -> Destination with parameter automation (`setTargetAtTime`) preventing audible clicks.
