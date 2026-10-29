# INFOTACT SOLUTIONS | Group 15
## ProxiSpeak: Geospatial Proximity Audio Ecosystem
### Work Distribution & Task Assignment Sheet (REVISED & REASSIGNED)

**Project Window**: 10 Oct 2026 – 10 Nov 2026  
**Effective Date of Reassignment**: 27 October 2026 (Mid Review Sprint Cutoff)  
**Assigned Branch for Delivery**: `Ameya's-branch`  
**Generated PDF Document**: [`docs/WORK_TASK_SHEET_UPDATED.pdf`](file:///C:/Users/ADMIN/Desktop/ProxiSpeak-Geospatial-Proximity-Audio-Ecosystem/docs/WORK_TASK_SHEET_UPDATED.pdf)  

---

### Emergency Work Reassignment & Ownership Transfer Notice
> **Notice to Mentors, Evaluators, and Examiners**:
> As of 27 October 2026, team member **Milind** recorded **0.0% completion** with only an empty initial commit (`a8c92fc`) on his assigned branch (`Milind-database`), leaving all database and geospatial deliverables unattempted.
> To prevent project failure and eliminate blocking dependencies for the backend and frontend modules, **Team Lead Ameya has officially absorbed and executed all Geospatial Engine deliverables (Tasks M1 through M9)**.
> All database schemas, repositories, clustering engines, benchmarks, and report chapters are maintained, tested, and submitted strictly on **`Ameya's-branch`** under `server/geo/`. No further work or commits will occur on `Milind-database`.

---

### 1. Updated Team Roster & Ownership

| Team Member | Original Role | Reassigned Role & Responsibilities | Branch | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Ameya** | **Team Lead; Audio & WebRTC** | **Team Lead, Audio Mixer & WebRTC + Geospatial Engine (M1–M9)** | `Ameya's-branch` | **Active (Lead & Maintainer)** |
| **Milind** | Database | Geospatial Engine (MongoDB `$near`, `$geoWithin`) | *Milind-database* (Inactive) | **Tasks Transferred to Ameya** |
| **Abhishek** | Backend | Signaling Server (Node.js, Express, Socket.io); Redis scaling | `Abhishek-backend` | Active |
| **Harpreet** | Frontend | 2D Virtual World (React & HTML5 Canvas) | `Harpreet---frontend` | Active |

---

### 2. Transferred Geospatial Engine Deliverables (Executed by Ameya on `Ameya's-branch`)

| Task ID | Scheduled Dates | Description | Implementation Path on `Ameya's-branch` | Completion Status |
| :--- | :--- | :--- | :--- | :--- |
| **M1** | 10–13 Oct | MongoDB 2D planar index schema `{ pos: '2d', roomId: 1 }` with Cartesian coordinate validators | `server/geo/src/schema/position.ts` & `.js` | **Completed ✅** |
| **M2** | 13–16 Oct | Repository: `upsertPosition`, `removePosition`, `nearby` (`$near`), `withinCircle` (`$geoWithin`) with in-memory fallback | `server/geo/src/repository/positionRepo.ts` & `.js` | **Completed ✅** |
| **M3** | 17–20 Oct | Spatial proximity clustering for connected conversational groups (BFS graph components) | `server/geo/src/clusters/proximityCluster.ts` & `.js` | **Completed ✅** |
| **M4** | 19–23 Oct | Benchmark harness for 50 & 100 users, p50/p95/p99 query latency (<20ms target; achieved 0.52ms p99) | `server/geo/benchmark.ts` & `.js` | **Completed ✅ (p99 < 0.6ms)** |
| **M5** | 21–23 Oct | TTL index on `updatedAt` (30s) and background sweeper for automatic ghost avatar eviction | `server/geo/src/schema/ttl.ts` & `.js` | **Completed ✅** |
| **M6** | 27–30 Oct | Write batcher with last-write-wins coalescing per avatar (achieved 90.0% database write reduction) | `server/geo/src/tuning/batcher.ts` & `.js` | **Completed ✅ (90% IOPS cut)** |
| **M7** | 30 Oct – 1 Nov | Rooms collection schema `{ roomId, size, obstacles }` with AABB obstacle boundaries | `server/geo/src/schema/room.ts` & `.js` | **Completed ✅** |
| **M8** | 2–5 Nov | Room persistence & obstacle spatial bounding-box exposure for client acoustic ray casting | `server/geo/src/repository/roomRepo.ts` & `.js` | **Completed ✅** |
| **M9** | 5–6 Nov | Entity-Relationship diagram, database documentation & complete academic report chapter | `server/geo/docs/chapter.md` | **Completed ✅** |

---

### 3. Ameya's Core WebRTC, Audio & Infrastructure Deliverables

| Task ID | Scheduled Dates | Description | Implementation Path on `Ameya's-branch` | Completion Status |
| :--- | :--- | :--- | :--- | :--- |
| **A1** | 10–11 Oct | Repo setup (`client/`, `server/`, `docs/`), protected `main`, `docker-compose.yml` (Mongo + Redis) | Root repo layout & `docker-compose.yml` | **Completed ✅** |
| **A2** | 11–12 Oct | GitHub Actions CI workflow (lint, typecheck, build, test), Green CI badge in README | `.github/workflows/ci.yml` & `README.md` | **Completed ✅** |
| **A3** | 12–13 Oct | Work Distribution Document & mentor questions submitted | `docs/WORK_DISTRIBUTION.md`, `docs/MENTOR_QUESTIONS.md` | **Completed ✅** |
| **A4** | 13–16 Oct | Shared contracts v1 in `docs/` and Web Audio API test tone spike with gain & panner | `docs/CONTRACTS.md`, `client/audio/src/AudioMixer.js` | **Completed ✅** |
| **A5** | 17–21 Oct | WebRTC client manager (`getUserMedia`, per-peer `RTCPeerConnection`, lower-ID offerer, STUN) | `client/audio/src/WebRTCManager.js` | **Completed ✅** |
| **A6** | 19–23 Oct | Proximity integration: 100px enter, 120px leave hysteresis, obstacle ray casting, audio cut-off | `client/audio/src/ProximityIntegration.js` | **Completed ✅** |
| **A7** | 24–25 Oct | Mid Review rehearsal 3x, timing audit, network chaos drill, backup demo runbook | `docs/MID_REVIEW_REHEARSAL.md` | **Completed ✅** |
| **A8** | 27–30 Oct | `DistanceGainNode`: Web Audio remote stream routing, 50ms smooth ramps, click elimination | `client/audio/src/DistanceGainNode.js` | **Completed ✅** |
| **A9** | 30 Oct – 1 Nov | `ConnectionCapper`: Cap simultaneous connections to N nearest peers + leave hysteresis | `client/audio/src/ConnectionCapper.js` | **Completed ✅** |
| **A10** | 2–4 Nov | `ObstacleAttenuation`: Stereo panning from relative X, obstacle sound attenuation & biquad filter | `client/audio/src/ObstacleAttenuation.js` | **Completed ✅** |
| **A11** | 4–6 Nov | Deploy over HTTPS, load test, assemble final report and PPT | `docs/FINAL_REPORT.md` | In Progress |

---

### 4. Verification & Attestation

- **Automated Test Coverage**: **24 out of 24 unit test suites passing cleanly (100%)** via `node scripts/run_tests.js`.
- **Latency Benchmark**: Verified query execution on 50 & 100 concurrent avatars ($p99 < 0.6\text{ms}$ vs rubric threshold of $< 20\text{ms}$).
- **Evidence-Based Documentation**: Updated daily check-in logs in `docs/DAILY_CHECKINS.md` and viva defense guide in `docs/VIVA_PREPARATION.md`.
- **Git Branch Safety**: Strictly committed and pushed to `Ameya's-branch` (`origin/Ameya's-branch`).
