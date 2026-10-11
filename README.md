# ProxiSpeak: Geospatial Proximity Audio Ecosystem

[![CI Pipeline](https://github.com/ameya1009/ProxiSpeak-Geospatial-Proximity-Audio-Ecosystem/actions/workflows/ci.yml/badge.svg)](https://github.com/ameya1009/ProxiSpeak-Geospatial-Proximity-Audio-Ecosystem/actions/workflows/ci.yml)
[![Branch](https://img.shields.io/badge/Active%20Branch-Ameya's--branch-blue)](https://github.com/ameya1009/ProxiSpeak-Geospatial-Proximity-Audio-Ecosystem/tree/Ameya's-branch)

Remote collaboration tools (like Zoom) force users into rigid "rooms" where only one person can speak at a time. They lack the spontaneous, spatial dynamics of a real office where you can hear people talking nearby and organically walk over to join a conversation.

**ProxiSpeak** delivers an interactive 2D office environment featuring real-time geospatial proximity audio using Web Audio API and WebRTC peer-to-peer audio connections.

---

## Team, Roles & Module Ownership (Group 15 - Infotact Solutions)

| Member | Role | Key Module Owned | Folder | Branch |
| :--- | :--- | :--- | :--- | :--- |
| **Ameya** | **Team Lead; WebRTC client & audio** | Spatial Audio Mixer (Web Audio API) & WebRTC client; repo, CI, merges | `client/audio/` | `Ameya's-branch` |
| **Abhishek** | Backend | Signaling Server (Node.js, Express, Socket.io); Redis scaling | `server/signaling/` | `Abhishek-backend` |
| **Milind** | Database | Geospatial Engine (MongoDB `$near` & `$geoWithin`); room persistence | `server/geo/` | `Milind-database` |
| **Harpreet** | Frontend | 2D Virtual World (React & HTML5 Canvas) | `client/world/` | `Harpreet---frontend` |

---

## On-Open Project & Branch Progress Tracking

To audit the current completion status against the official task sheet PDF:

```bash
npm run progress
# or
node scripts/check_progress.js
```

This displays interactive progress bars for every team member and branch, validating completed deliverables day-by-day.

---

## Infrastructure Setup

To spin up local infrastructure dependencies (MongoDB and Redis):

```bash
docker-compose up -d
```
