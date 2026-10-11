# Work Distribution Document
**Project**: ProxiSpeak: Geospatial Proximity Audio Ecosystem  
**Organization**: Infotact Solutions  
**Cohort**: Web Development | Group 15  
**Project Window**: 10 Oct 2026 to 10 Nov 2026  

---

## 1. Team Directory & Ownership

| Member | Role | Key Module Owned | Folder | Branch | Contacts / Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ameya** | **Team Lead; WebRTC client & audio** | Spatial Audio Mixer (Web Audio API) & WebRTC client; repo, CI, merges | `client/audio/` | `Ameya's-branch` | Active (Lead) |
| **Abhishek** | Backend | Signaling Server (Node.js, Express, Socket.io); Redis scaling | `server/signaling/` | `Abhishek-backend` | Active |
| **Milind** | Database | Geospatial Engine (MongoDB `$near` & `$geoWithin`); room persistence | `server/geo/` | `Milind-database` | Active |
| **Harpreet** | Frontend | 2D Virtual World (React & HTML5 Canvas) | `client/world/` | `Harpreet---frontend` | Active |

---

## 2. Review Milestones & Dates

- **10 Oct 2026**: Project Kickoff. Repo initialized, branch structure created, CI active, initial commits pushed.
- **16 Oct 2026 (Week 1 Finish)**: Avatars move on canvas, X/Y broadcasted, MongoDB schema & geospatial queries operational, shared contracts locked.
- **23 Oct 2026 (Week 2 Finish)**: Proximity gating of offers (100 px enter, 120 px leave); two browsers communicate WebRTC audio through signaling server.
- **20 to 27 Oct 2026 (Mid Review Window)**:
  - Target slot requested: **26 or 27 October 2026**.
  - Work Distribution Document & Social media video submitted.
  - Requirement: Spatial audit (<20 ms latency) & 2-peer audio proof.
- **1 Nov 2026 (Week 3 Finish)**: Distance-based volume attenuation; Redis pub/sub multi-node Socket.io scaling.
- **6 Nov 2026 (Week 4 Finish)**: Room persistence, stereo panning, obstacle sound attenuation, 60 FPS canvas benchmark, project report, PPT, and demo video completed.
- **5 to 10 Nov 2026 (Final Review Window)**: Target presentation date requested: **9 or 10 November 2026**.

---

## 3. Team Commitments & Daily Check-In Policy
1. At least one meaningful, high-quality commit per member on their respective branch every day (no empty or trivial commits).
2. Daily check-in posted in the team communication channel by 8:00 PM IST:
   - What was committed today
   - What is planned next
   - Any blockers encountered
3. Team lead (Ameya) conducts PR reviews into `main` and ensures zero broken builds on integration.
