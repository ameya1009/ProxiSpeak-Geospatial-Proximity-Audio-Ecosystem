# Workspace Rule: ProxiSpeak Geospatial Proximity Audio Ecosystem

## 1. Branch Safety Guardrail (Strict)
- **Work Branch**: You MUST ONLY make changes and commits on **`Ameya's-branch`** (or `origin/Ameya's-branch`).
- **Forbidden Branches**: NEVER commit or push changes directly to `main`, `Abhishek-backend`, `Milind-database`, or `Harpreet---frontend`.
- When starting any task, check `git branch --show-current` to ensure you are currently on `Ameya's-branch`.

## 2. On-Open Project & Branch Progress Check
Whenever this repository is opened in Antigravity or a new task is initiated:
1. Run the progress check script:
   ```bash
   node scripts/check_progress.js
   ```
2. Display the progress status of each team member and their assigned branch using visual progress bars:
   - `Ameya` (`Ameya's-branch`): Team Lead, Spatial Audio Mixer (Web Audio API) & WebRTC Client, Repo/CI, Paperwork & Merges (`client/audio`, `docs/`, `scripts/`, `.github/`).
   - `Abhishek` (`Abhishek-backend`): Signaling Server (Node.js, Express, Socket.io), Redis scaling (`server/signaling`).
   - `Milind` (`Milind-database`): Geospatial Engine (MongoDB $near & $geoWithin), Room persistence (`server/geo`).
   - `Harpreet` (`Harpreet---frontend`): 2D Virtual World (React & HTML5 Canvas) (`client/world`).
   - `main`: Integration branch.

3. Compare current repository state against the official project task sheet (`INFOTACT SOLUTIONS | Group 15 | ProxiSpeak: Work Task Sheet`).
4. Output a summary table comparing the scheduled date vs. actual task completion.

## 3. Evidence-Based Quality & Paperwork Standards
- Every feature implemented for Ameya must include:
  - Documented design and shared contracts in `docs/` (`docs/CONTRACTS.md`, `docs/WORK_DISTRIBUTION.md`, `docs/MENTOR_QUESTIONS.md`).
  - Unit tests and CI verification.
  - Zero placeholder / pseudo-code: all code must be fully functioning, verified, and test-covered.
  - Explanation of viva topics (WebRTC offer/answer, ICE, STUN/TURN, Web Audio graph, gain curves, line-of-sight attenuation).
