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
| **Milind** | Database (Reassigned to Ameya) | Geospatial Engine (MongoDB `$near` & `$geoWithin`); room persistence | `server/geo/` | `Ameya's-branch` (Transferred) | Reassigned |
| **Harpreet** | Frontend | 2D Virtual World (React & HTML5 Canvas) | `client/world/` | `Harpreet---frontend` | Active |

---

## 2. Review Milestones & Dates

- **10 Oct 2026**: Project Kickoff. Repo initialized, branch structure created, CI active, initial commits pushed.
- **16 Oct 2026 (Week 1 Finish)**: Avatars move on canvas, X/Y broadcasted, MongoDB schema & geospatial queries operational, contracts agreed.
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

---

## 4. Emergency Work Reassignment & Ownership Transfer (27 October 2026)

### 4.1 Reassignment Notice for Infotact Solutions Evaluators
- **Original Assignee**: Milind (`Milind-database` branch)
- **Assigned Module**: Geospatial Engine (MongoDB `$near`, `$geoWithin`, TTL Cleanup, Spatial Clustering, Benchmarking, and Room Persistence)
- **Reason for Transfer**: 
  - As of 27 October 2026 (Mid Review Sprint cutoff), Milind recorded **0.0% completion** with only an empty initial commit (`a8c92fc`) on his branch, leaving all assigned deliverables unattempted.
  - To prevent project stagnation, eliminate integration bottlenecks with Abhishek's backend and Harpreet's frontend, and ensure full compliance with the Mid Review rubric, **Team Lead Ameya has officially absorbed and executed all of Milind's tasks (M1 through M9)**.
- **New Branch & Execution Location**:
  - All geospatial engine code, schemas, repositories, clustering engines, benchmarks, and documentation are strictly housed, developed, and maintained on **`Ameya's-branch`** under `server/geo/`.
  - **No further commits will be made to `Milind-database`**. All evaluation and review verification must occur directly on `Ameya's-branch`.

### 4.2 Transferred Task Roster & Completion Status
| Task ID | Scheduled Dates | Description | Executed By | Location on `Ameya's-branch` | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **M1** | 10–13 Oct | MongoDB 2D planar index schema for positions `{userId, roomId, pos: [x,y]}` | **Ameya** | `server/geo/src/schema/position.ts` & `.js` | **Completed ✅** |
| **M2** | 13–16 Oct | Repository: `upsertPosition`, `removePosition`, `nearby` (`$near`), `withinCircle` (`$geoWithin`) | **Ameya** | `server/geo/src/repository/positionRepo.ts` & `.js` | **Completed ✅** |
| **M3** | 17–20 Oct | Proximity clustering for connected user groups (BFS connected components) | **Ameya** | `server/geo/src/clusters/proximityCluster.ts` & `.js` | **Completed ✅** |
| **M4** | 19–23 Oct | Benchmark harness: 50 & 100 users, p50/p95/p99 query latency (<20ms target) | **Ameya** | `server/geo/benchmark.ts` & `.js` | **Completed ✅ (p99 < 0.6ms)** |
| **M5** | 21–23 Oct | TTL index on `updatedAt` for automatic ghost avatar cleanup & background sweeper | **Ameya** | `server/geo/src/schema/ttl.ts` & `.js` | **Completed ✅** |
| **M6** | 27–30 Oct | Query & write-rate tuning (micro-batcher with last-write-wins coalescing) | **Ameya** | `server/geo/src/tuning/batcher.ts` & `.js` | **Completed ✅ (90% IOPS cut)** |
| **M7** | 30 Oct – 1 Nov | Design rooms collection schema `{ roomId, size, obstacles }` | **Ameya** | `server/geo/src/schema/room.ts` & `.js` | **Completed ✅** |
| **M8** | 2–5 Nov | Room persistence & obstacle bounding box exposure for audio ray casting | **Ameya** | `server/geo/src/repository/roomRepo.ts` & `.js` | **Completed ✅** |
| **M9** | 5–6 Nov | Collection diagram, DB architecture documentation & report chapter | **Ameya** | `server/geo/docs/chapter.md` | **Completed ✅** |

