#!/usr/bin/env node

/**
 * ProxiSpeak Ecosystem - Progress Checker & Branch Auditor
 * Analyzes repository status against the official Infotact Solutions Task Sheet PDF.
 */

const { execSync } = require('child_process');
const fs = require('fs');

function getGitOutput(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (err) {
    return '';
  }
}

function renderProgressBar(percentage, length = 20) {
  const filledLength = Math.round((percentage / 100) * length);
  const emptyLength = length - filledLength;
  const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
  return `[${bar}] ${percentage.toFixed(1)}%`;
}

// Task sheet task definitions per member from the PDF
const memberSpecs = {
  Ameya: {
    role: "Team Lead; Spatial Audio Mixer and WebRTC client",
    branch: "Ameya's-branch",
    folder: "client/audio",
    tasks: [
      { id: "A1", desc: "Create repo (client/, server/, docs/), protect main, docker-compose (Mongo + Redis)", dates: "10-11 Oct", check: () => fs.existsSync('docker-compose.yml') && fs.existsSync('docs') && fs.existsSync('client/audio') },
      { id: "A2", desc: "CI: lint, type-check, tests, build on push, Green CI badge in README", dates: "11-12 Oct", check: () => fs.existsSync('.github/workflows/ci.yml') && fs.readFileSync('README.md', 'utf8').includes('CI') },
      { id: "A3", desc: "Connect repo to dashboard, Work Distribution Document, mentor questions", dates: "12-13 Oct", check: () => fs.existsSync('docs/WORK_DISTRIBUTION.md') && fs.existsSync('docs/MENTOR_QUESTIONS.md') },
      { id: "A4", desc: "Contracts v1 in docs/, Audio spike: test tone gain & stereo panner", dates: "13-16 Oct", check: () => fs.existsSync('docs/CONTRACTS.md') && fs.existsSync('client/audio/src/AudioMixer.js') },
      { id: "A5", desc: "WebRTC client manager: getUserMedia, RTCPeerConnection per peer, lower-id offerer, STUN", dates: "17-21 Oct", check: () => fs.existsSync('client/audio/src/WebRTCManager.js') },
      { id: "A6", desc: "Integrate with Abhishek's events & Harpreet's canvas (enter/leave triggers audio)", dates: "19-23 Oct", check: () => fs.existsSync('client/audio/src/ProximityIntegration.js') },
      { id: "A7", desc: "Rehearse Mid Review 3x, record backup demo", dates: "24-25 Oct", check: () => fs.existsSync('docs/MID_REVIEW_REHEARSAL.md') },
      { id: "A8", desc: "Route remote streams through Web Audio: gain by distance with smooth ramps", dates: "27-30 Oct", check: () => fs.existsSync('client/audio/src/DistanceGainNode.js') },
      { id: "A9", desc: "Cap simultaneous connections to N nearest peers + leave hysteresis", dates: "30 Oct - 1 Nov", check: () => fs.existsSync('client/audio/src/ConnectionCapper.js') },
      { id: "A10", desc: "Stereo or 3D panning from relative X, obstacle sound attenuation", dates: "2-4 Nov", check: () => fs.existsSync('client/audio/src/ObstacleAttenuation.js') },
      { id: "A11", desc: "Deploy over HTTPS, load test, assemble report and PPT", dates: "4-6 Nov", check: () => fs.existsSync('docs/FINAL_REPORT.md') }
    ]
  },
  Abhishek: {
    role: "Backend: Signaling Server (Node.js, Express, Socket.io, Redis)",
    branch: "Abhishek-backend",
    folder: "server/signaling",
    tasks: [
      { id: "B1", desc: "Node, Express, Socket.io server, env config, clean secrets", dates: "10-12 Oct", check: () => fs.existsSync('server/signaling/src/server.ts') || getGitOutput('git ls-tree origin/Abhishek-backend backend/server.js').includes('server.js') },
      { id: "B2", desc: "join/leave, move {x,y} validated & throttled, broadcast", dates: "12-16 Oct", check: () => fs.existsSync('server/signaling/src/events/movement.ts') || getGitOutput('git ls-tree origin/Abhishek-backend backend/routes/userRoutes.js').includes('userRoutes.js') },
      { id: "B3", desc: "nearby() filter: enter 100px, leave 120px hysteresis, peer:enter/leave", dates: "17-20 Oct", check: () => fs.existsSync('server/signaling/src/proximity/hysteresis.ts') },
      { id: "B4", desc: "Signaling relay: signal {to, type, data} relayed only between in-range peers", dates: "18-22 Oct", check: () => fs.existsSync('server/signaling/src/events/signaling.ts') },
      { id: "B5", desc: "Measure move-to-event latency with Milind's benchmark", dates: "21-23 Oct", check: () => fs.existsSync('server/signaling/benchmark.log') },
      { id: "B6", desc: "Redis adapter for Socket.io across multiple instances", dates: "27-30 Oct", check: () => fs.existsSync('server/signaling/src/redisAdapter.ts') },
      { id: "B7", desc: "Load test with 50+ simulated clients", dates: "30 Oct - 1 Nov", check: () => fs.existsSync('server/signaling/loadtest.log') },
      { id: "B8", desc: "Room persistence, origin allowlist, rate limits", dates: "2-4 Nov", check: () => fs.existsSync('server/signaling/src/security.ts') },
      { id: "B9", desc: "Help deploy; final tests; report chapter", dates: "4-6 Nov", check: () => fs.existsSync('server/signaling/docs/chapter.md') }
    ]
  },
  Milind: {
    role: "Database: Geospatial Engine (MongoDB $near, $geoWithin)",
    branch: "Milind-database",
    folder: "server/geo",
    tasks: [
      { id: "M1", desc: "MongoDB 2d index schema for positions {userId, roomId, pos: [x,y]}", dates: "10-13 Oct", check: () => fs.existsSync('server/geo/src/schema/position.ts') || fs.existsSync('server/geo/src/schema/position.js') },
      { id: "M2", desc: "Repository: upsertPosition, remove, nearby($near), withinCircle($geoWithin)", dates: "13-16 Oct", check: () => fs.existsSync('server/geo/src/repository/positionRepo.ts') || fs.existsSync('server/geo/src/repository/positionRepo.js') },
      { id: "M3", desc: "Cluster users by proximity (connected groups)", dates: "17-20 Oct", check: () => fs.existsSync('server/geo/src/clusters/proximityCluster.ts') || fs.existsSync('server/geo/src/clusters/proximityCluster.js') },
      { id: "M4", desc: "Benchmark harness: 50 & 100 users, p50/p95/p99 query latency (<20ms)", dates: "19-23 Oct", check: () => fs.existsSync('server/geo/benchmark.ts') || fs.existsSync('server/geo/benchmark.js') },
      { id: "M5", desc: "TTL index on updatedAt for automatic ghost cleanup", dates: "21-23 Oct", check: () => fs.existsSync('server/geo/src/schema/ttl.ts') || fs.existsSync('server/geo/src/schema/ttl.js') },
      { id: "M6", desc: "Query & write-rate tuning (throttle/batch writes)", dates: "27-30 Oct", check: () => fs.existsSync('server/geo/src/tuning/batcher.ts') || fs.existsSync('server/geo/src/tuning/batcher.js') },
      { id: "M7", desc: "Design rooms collection { roomId, size, obstacles }", dates: "30 Oct - 1 Nov", check: () => fs.existsSync('server/geo/src/schema/room.ts') || fs.existsSync('server/geo/src/schema/room.js') },
      { id: "M8", desc: "Room persistence & obstacle data exposure", dates: "2-5 Nov", check: () => fs.existsSync('server/geo/src/repository/roomRepo.ts') || fs.existsSync('server/geo/src/repository/roomRepo.js') },
      { id: "M9", desc: "Collection diagram, DB documentation & report chapter", dates: "5-6 Nov", check: () => fs.existsSync('server/geo/docs/chapter.md') }
    ]
  },
  Harpreet: {
    role: "Frontend: 2D Virtual World (React & HTML5 Canvas)",
    branch: "Harpreet---frontend",
    folder: "client/world",
    tasks: [
      { id: "H1", desc: "Git onboarding: clone, branch, add name to README", dates: "10-11 Oct", check: () => fs.readFileSync('README.md', 'utf8').includes('Harpreet') },
      { id: "H2", desc: "React app (Vite) with Canvas & requestAnimationFrame render loop", dates: "11-14 Oct", check: () => fs.existsSync('client/world/src/Canvas.tsx') || getGitOutput('git ls-tree origin/Harpreet---frontend client/world/src/App.jsx').includes('App.jsx') },
      { id: "H3", desc: "Keyboard (WASD/arrows) & click-to-move, emit move {x,y}", dates: "14-16 Oct", check: () => fs.existsSync('client/world/src/controls/movement.ts') || getGitOutput('git show origin/Harpreet---frontend:client/world/src/App.jsx').includes('handleKeyDown') },
      { id: "H4", desc: "Remote avatars interpolation (15 updates/sec), names, join screen", dates: "17-21 Oct", check: () => fs.existsSync('client/world/src/components/RemoteAvatars.tsx') || getGitOutput('git show origin/Harpreet---frontend:client/world/src/App.jsx').toLowerCase().includes('remoteavatar') },
      { id: "H5", desc: "Draw 100px earshot ring, connected peers indicator, mute button", dates: "21-23 Oct", check: () => fs.existsSync('client/world/src/components/EarshotRing.tsx') || (getGitOutput('git show origin/Harpreet---frontend:client/world/src/App.jsx').toLowerCase().includes('earshot') && getGitOutput('git show origin/Harpreet---frontend:client/world/src/App.jsx').toLowerCase().includes('ismuted')) },
      { id: "H6", desc: "Keep drawing loop outside React state (use refs) for 60 FPS without stutter", dates: "24-25 Oct", check: () => fs.existsSync('client/world/src/hooks/useRenderLoop.ts') },
      { id: "H7", desc: "Offscreen canvas for static map, profile 60 FPS with 50 avatars", dates: "27-30 Oct", check: () => fs.existsSync('client/world/src/canvas/OffscreenMap.ts') },
      { id: "H8", desc: "Audio UI: per-peer volume indicator, mic permissions & error states", dates: "30 Oct - 1 Nov", check: () => fs.existsSync('client/world/src/components/AudioUI.tsx') },
      { id: "H9", desc: "Draw furniture & obstacles from saved room layout", dates: "2-5 Nov", check: () => fs.existsSync('client/world/src/components/Obstacles.tsx') || getGitOutput('git show origin/Harpreet---frontend:client/world/src/App.jsx').toLowerCase().includes('obstacle') },
      { id: "H10", desc: "Record demo video & report chapter", dates: "5-6 Nov", check: () => fs.existsSync('client/world/docs/chapter.md') }
    ]
  }
};

function main() {
  console.log('='.repeat(78));
  console.log('  PROXISPEAK ECOSYSTEM - BRANCH PROGRESS & TASK SHEET AUDITOR');
  console.log('='.repeat(78));
  
  const currentBranch = getGitOutput('git branch --show-current') || 'unknown';
  console.log(`Current Active Branch: [ ${currentBranch} ]`);
  if (currentBranch !== "Ameya's-branch") {
    console.log(`⚠️  WARNING: You are NOT on Ameya's-branch. Rule mandates work strictly on Ameya's-branch!`);
  } else {
    console.log(`✅ Branch Safety Guardrail: Active on Ameya's-branch.`);
  }
  console.log('-'.repeat(78));
  console.log('BRANCH PROGRESS SUMMARY:');
  console.log('-'.repeat(78));

  const branches = [
    { name: 'main', branchRef: 'main' },
    { name: "Ameya (Lead / Audio)", memberKey: 'Ameya', branchRef: "Ameya's-branch" },
    { name: 'Abhishek (Backend)', memberKey: 'Abhishek', branchRef: 'Abhishek-backend' },
    { name: 'Milind (DB -> Transferred)', memberKey: 'Milind', branchRef: "Ameya's-branch (Reassigned)" },
    { name: 'Harpreet (Frontend)', memberKey: 'Harpreet', branchRef: 'Harpreet---frontend' }
  ];

  for (const b of branches) {
    let completedCount = 0;
    let totalTasks = 1;
    let details = '';

    if (b.memberKey && memberSpecs[b.memberKey]) {
      const spec = memberSpecs[b.memberKey];
      totalTasks = spec.tasks.length;
      completedCount = spec.tasks.filter(t => {
        try { return t.check(); } catch { return false; }
      }).length;
      details = `(${completedCount}/${totalTasks} tasks completed)`;
    } else {
      let sum = 0;
      let total = 0;
      for (const m of Object.values(memberSpecs)) {
        total += m.tasks.length;
        sum += m.tasks.filter(t => {
          try { return t.check(); } catch { return false; }
        }).length;
      }
      completedCount = sum;
      totalTasks = total;
      details = `(Integrated: ${sum}/${total})`;
    }

    const pct = (completedCount / totalTasks) * 100;
    const bar = renderProgressBar(pct, 20);
    console.log(`* ${b.name.padEnd(30)} ${bar} ${details}`);
  }

  console.log('-'.repeat(78));
  console.log("AMEYA'S ASSIGNED TASKS (SCHEDULE CHECK):");
  console.log('-'.repeat(78));

  const ameyaTasks = memberSpecs.Ameya.tasks;
  for (const task of ameyaTasks) {
    let done = false;
    try { done = task.check(); } catch {}
    const statusIcon = done ? '✅ [DONE]' : '⏳ [PENDING]';
    console.log(` ${statusIcon} [${task.dates.padEnd(14)}] ${task.id}: ${task.desc}`);
  }

  console.log('-'.repeat(78));
  console.log("TRANSFERRED GEOSPATIAL TASKS EXECUTED BY AMEYA (MILIND M1-M9):");
  console.log('-'.repeat(78));

  const milindTasks = memberSpecs.Milind.tasks;
  for (const task of milindTasks) {
    let done = false;
    try { done = task.check(); } catch {}
    const statusIcon = done ? '✅ [DONE]' : '⏳ [PENDING]';
    console.log(` ${statusIcon} [${task.dates.padEnd(14)}] ${task.id}: ${task.desc}`);
  }

  console.log('='.repeat(78));
}

if (require.main === module) {
  main();
}

module.exports = { memberSpecs, renderProgressBar };
