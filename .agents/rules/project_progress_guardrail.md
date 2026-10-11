---
name: project-progress-guardrail
description: Enforce checking repository branch progress with progress bars and restrict all coding strictly to Ameya's-branch according to the task sheet PDF.
always_on: true
---

# ProxiSpeak Antigravity Workspace Rule

## Rule 1: Always Check Repository & Branch Progress on Open
Whenever opening or working in this project:
- Execute `node scripts/check_progress.js`.
- Render Unicode progress bars showing the progress of each branch (`main`, `Ameya's-branch`, `Abhishek-backend`, `Milind-database`, `Harpreet---frontend`).
- Evaluate task sheet completion according to the current date and milestone schedule from `INFOTACT SOLUTIONS | Group 15 | ProxiSpeak: Work Task Sheet`.

## Rule 2: Strictly Work on `Ameya's-branch` Only
- You must NEVER make commits or edits destined for other branches.
- Active branch must always be `Ameya's-branch`.
- Ameya's deliverables:
  - `client/audio` (Spatial Audio Mixer, Web Audio API, WebRTC client).
  - Repository setup, docker-compose, CI pipelines (`.github/workflows/ci.yml`).
  - Contracts in `docs/` (`docs/CONTRACTS.md`), Work Distribution Document (`docs/WORK_DISTRIBUTION.md`), mentor questions (`docs/MENTOR_QUESTIONS.md`).
  - PR reviews and merge coordination.

## Rule 3: Evidence-Based Development & Documentation
- Maintain tests, rigorous typings, and architectural explanations for viva preparation.
