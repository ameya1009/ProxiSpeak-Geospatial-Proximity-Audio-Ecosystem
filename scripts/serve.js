/**
 * ProxiSpeak Localhost Development & Demo Server
 * Zero external dependencies - pure Node.js HTTP & HTTPS server.
 * Combines deliverables from ALL branches on localhost:
 * - Harpreet---frontend: 2D Virtual World (React/Canvas office with avatars and obstacles)
 * - Abhishek-backend: Location API (/api/users/location & /api/users/locations)
 * - Ameya's-branch: Web Audio Engine, WebRTC Audio Mesh, Connection Capper & Obstacle Attenuation
 * - Milind-database (Transferred): MongoDB 2D indexing, $near queries, clustering & benchmarks
 * - Task A11: HTTPS secure origin deployment & 50/100 peer load test harness
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec } = require('child_process');
const { RoomRepository } = require('../server/geo/src/repository/roomRepo');
const { PositionRepository } = require('../server/geo/src/repository/positionRepo');
const { getHttpsOptions } = require('./generate_cert');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DEFAULT_HTTPS_PORT = process.env.HTTPS_PORT ? parseInt(process.env.HTTPS_PORT, 10) : 3443;

// In-memory user locations store (Abhishek's backend state)
const userLocations = {};
// Geospatial Repositories (Milind's transferred Tasks M2 & M8)
const roomRepo = new RoomRepository();
const positionRepo = new PositionRepository();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8'
};

function renderLandingPage(port, httpsPort = DEFAULT_HTTPS_PORT) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ProxiSpeak - Unified Multi-Branch Localhost Hub</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: #1e293b;
      --text: #f8fafc;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --accent-hover: #0284c7;
      --success: #10b981;
      --warning: #f59e0b;
      --border: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2.5rem 1.25rem;
      min-height: 100vh;
    }
    .container {
      max-width: 1050px;
      width: 100%;
    }
    header {
      text-align: center;
      margin-bottom: 2rem;
    }
    h1 {
      font-size: 2.3rem;
      color: var(--accent);
      margin-bottom: 0.5rem;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    p.lead {
      color: var(--muted);
      font-size: 1.05rem;
    }
    .badge-bar {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-top: 1rem;
    }
    .badge {
      display: inline-block;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-ameya { background: #0369a1; color: #e0f2fe; }
    .badge-harpreet { background: #065f46; color: #d1fae5; }
    .badge-abhishek { background: #854d0e; color: #fef3c7; }
    .badge-milind { background: #4c1d95; color: #ede9fe; }
    .badge-https { background: #047857; color: #ecfdf5; border: 1px solid #10b981; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .card:hover {
      transform: translateY(-2px);
      border-color: var(--accent);
    }
    .card h2 {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
      color: #fff;
    }
    .card p {
      color: var(--muted);
      font-size: 0.88rem;
      line-height: 1.5;
      margin-bottom: 1.25rem;
    }
    .card-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .card-tag {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
    }
    .btn {
      display: inline-block;
      padding: 0.65rem 1.1rem;
      background: var(--accent);
      color: #0b0f19;
      font-weight: 700;
      font-size: 0.88rem;
      text-decoration: none;
      border-radius: 6px;
      text-align: center;
      transition: background 0.15s ease;
      cursor: pointer;
      border: none;
    }
    .btn:hover {
      background: var(--accent-hover);
    }
    .btn-secondary {
      background: #334155;
      color: var(--text);
    }
    .btn-secondary:hover {
      background: #475569;
    }
    .test-runner-card {
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 2rem;
    }
    .test-runner-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .test-output {
      background: #050811;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 1rem;
      font-family: monospace;
      font-size: 0.8rem;
      color: #38bdf8;
      max-height: 240px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
    footer {
      text-align: center;
      color: var(--muted);
      font-size: 0.8rem;
      border-top: 1px solid var(--border);
      padding-top: 1.5rem;
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>ProxiSpeak Localhost Portal</h1>
      <p class="lead">Interactive Multi-Branch Development & Demonstration Hub</p>
      <div class="badge-bar">
        <span class="badge badge-ameya">Ameya: Audio &amp; Lead (100%)</span>
        <span class="badge badge-milind">Milind: DB (100% via Ameya)</span>
        <span class="badge badge-harpreet">Harpreet: 2D Canvas</span>
        <span class="badge badge-abhishek">Abhishek: Signaling</span>
        <a href="https://localhost:${httpsPort}/" class="badge badge-https" style="text-decoration:none;">🔒 HTTPS Enabled (:3443)</a>
      </div>
    </header>

    <div class="grid">
      <!-- 1. Ameya's Audio Mesh & Two-Browser Simulator -->
      <div class="card">
        <div>
          <div class="card-meta">
            <span class="card-tag">Branch: Ameya's-branch</span>
            <span style="color:#38bdf8; font-size:0.75rem; font-weight:700;">Tasks A4-A10</span>
          </div>
          <h2>🎧 Two-Browser Audio Mesh</h2>
          <p>Task A6 two-window proximity audio mesh featuring 3D HRTF & Stereo panning, N=4 Connection Capper with 15px hysteresis, and real-time obstacle sound occlusion.</p>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <a class="btn" style="flex:1;" href="/client/audio/mesh.html" target="_blank">HTTP Audio Mesh ➔</a>
          <a class="btn" style="background:#047857; color:#fff; flex:1;" href="https://localhost:${httpsPort}/client/audio/mesh.html" target="_blank">HTTPS Mesh (Mic) ➔</a>
        </div>
      </div>

      <!-- 2. Harpreet's 2D World Canvas -->
      <div class="card">
        <div>
          <div class="card-meta">
            <span class="card-tag">Branch: Harpreet---frontend</span>
            <span style="color:#10b981; font-size:0.75rem; font-weight:700;">Tasks H1-H10</span>
          </div>
          <h2>🎨 2D Virtual World (React Canvas)</h2>
          <p>Harpreet's interactive 800x500 office map featuring the Main Hall, Lounge, and Meeting Room zones, 5 furniture desks, collision blocking, WASD controls, and teammate speaking indicator pulse.</p>
        </div>
        <a class="btn" style="background:#10b981;" href="/client/world/standalone.html" target="_blank">Launch 2D Virtual World ➔</a>
      </div>

      <!-- 3. Milind & Ameya's Geospatial Engine -->
      <div class="card">
        <div>
          <div class="card-meta">
            <span class="card-tag">Branch: Milind &rarr; Ameya</span>
            <span style="color:#a855f7; font-size:0.75rem; font-weight:700;">Tasks M1-M9</span>
          </div>
          <h2>🌍 Geospatial Engine & Rooms</h2>
          <p>Interactive visualization of the transferred MongoDB geospatial engine: 2D planar indexing, $near distance queries (&lt;0.6ms), BFS conversation clustering, write batcher, and Task M8 Room & Obstacle persistence API.</p>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <a class="btn" style="background:#a855f7; color:#fff; flex:1;" href="/server/geo/index.html" target="_blank">Engine Visualizer ➔</a>
          <a class="btn btn-secondary" style="flex:1;" href="/api/rooms/default-office/obstacles" target="_blank">Obstacles API ➔</a>
        </div>
      </div>

      <!-- 4. Abhishek's Backend API -->
      <div class="card">
        <div>
          <div class="card-meta">
            <span class="card-tag">Branch: Abhishek-backend</span>
            <span style="color:#f59e0b; font-size:0.75rem; font-weight:700;">Tasks S1-S3</span>
          </div>
          <h2>⚡ Backend Signaling & Location API</h2>
          <p>Live REST endpoints for user positioning and status check matching Abhishek's Express controller: /api/backend status, /api/users/locations data store, and real-time JSON responses.</p>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <a class="btn" style="background:#f59e0b; flex:1;" href="/api/backend" target="_blank">Status API ➔</a>
          <a class="btn btn-secondary" style="flex:1;" href="/api/users/locations" target="_blank">Locations API ➔</a>
        </div>
      </div>

      <!-- 5. Spatial Audio DSP Lab -->
      <div class="card">
        <div>
          <div class="card-meta">
            <span class="card-tag">Branch: Ameya's-branch</span>
            <span style="color:#38bdf8; font-size:0.75rem; font-weight:700;">Tasks A4 & A8</span>
          </div>
          <h2>🎛️ Spatial Audio DSP Lab</h2>
          <p>Interactive laboratory testing the Web Audio API graph: real-time distance gain curves (Linear, Inverse, Exponential), smooth 50ms ramping, relative-X stereo panning, and frequency spectrum visualizer.</p>
        </div>
        <a class="btn btn-secondary" href="/client/audio/index.html" target="_blank">Open DSP Lab ➔</a>
      </div>

      <!-- 6. Final Report & Viva Presentation -->
      <div class="card">
        <div>
          <div class="card-meta">
            <span class="card-tag">Final Review (Task A11)</span>
            <span style="color:#10b981; font-size:0.75rem; font-weight:700;">Completed ✅</span>
          </div>
          <h2>🎓 Final Report & Presentation</h2>
          <p>Exhaustive final academic report with architectural diagrams, Web Audio DSP math, and interactive browser-based slide deck ready for examiner viva defense.</p>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <a class="btn" style="background:#0284c7; flex:1;" href="/docs/FINAL_PRESENTATION.html" target="_blank">Launch Slide Deck ➔</a>
          <a class="btn btn-secondary" style="flex:1;" href="/docs/FINAL_REPORT.md" target="_blank">Final Report ➔</a>
        </div>
      </div>
    </div>

    <!-- Live Automated Test Runner & Load Test Section -->
    <div class="test-runner-card">
      <div class="test-runner-header">
        <div>
          <h2 style="font-size:1.15rem; color:#f8fafc;">🧪 Automated Verification & Load Test Harness</h2>
          <p style="color:#94a3b8; font-size:0.8rem;">Execute all 30 unit tests or stress-test 50 & 100 concurrent avatars.</p>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button id="btnRunTests" class="btn" style="padding:0.5rem 1rem; font-size:0.85rem; cursor:pointer;">▶ Run 30 Test Suites</button>
          <button id="btnRunLoadTest" class="btn" style="background:#10b981; color:#0b0f19; padding:0.5rem 1rem; font-size:0.85rem; cursor:pointer;">⚡ Run 100-Peer Load Test</button>
        </div>
      </div>
      <div id="testOutput" class="test-output">Click 'Run 30 Test Suites' or 'Run 100-Peer Load Test' to execute automated verification directly on localhost...</div>
    </div>

    <footer>
      <p>ProxiSpeak Engine running locally at <strong>http://localhost:${port}</strong> &amp; <strong>https://localhost:${httpsPort}</strong> | Group 15</p>
    </footer>
  </div>

  <script>
    const btnRunTests = document.getElementById('btnRunTests');
    const btnRunLoadTest = document.getElementById('btnRunLoadTest');
    const testOutput = document.getElementById('testOutput');

    btnRunTests.addEventListener('click', async () => {
      btnRunTests.disabled = true;
      btnRunTests.textContent = 'Running Tests...';
      testOutput.textContent = 'Executing node scripts/run_tests.js... Please wait.';

      try {
        const res = await fetch('/api/run-tests');
        const data = await res.json();
        testOutput.textContent = data.output || 'Done';
      } catch (e) {
        testOutput.textContent = 'Error executing tests: ' + e.message;
      } finally {
        btnRunTests.disabled = false;
        btnRunTests.textContent = '▶ Re-Run 30 Tests';
      }
    });

    btnRunLoadTest.addEventListener('click', async () => {
      btnRunLoadTest.disabled = true;
      btnRunLoadTest.textContent = 'Benchmarking...';
      testOutput.textContent = 'Executing node scripts/load_test.js (50 & 100 concurrent avatars)... Please wait.';

      try {
        const res = await fetch('/api/load-test');
        const data = await res.json();
        testOutput.textContent = data.output || 'Done';
      } catch (e) {
        testOutput.textContent = 'Error executing load test: ' + e.message;
      } finally {
        btnRunLoadTest.disabled = false;
        btnRunLoadTest.textContent = '⚡ Re-Run Load Test';
      }
    });
  </script>
</body>
</html>`;
}

function createRequestHandler(port, httpsPort) {
  return (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // Root route -> Portal
    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(renderLandingPage(port, httpsPort));
    }

    // --- Abhishek's Backend API Routes ---
    if (pathname === '/api/backend' || pathname === '/api') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({
        message: "ProxiSpeak Backend is running successfully!",
        branch: "Abhishek-backend",
        timestamp: new Date().toISOString()
      }));
    }

    if (pathname === '/api/users/locations' && req.method === 'GET') {
      const locations = Object.values(userLocations);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({
        success: true,
        count: locations.length,
        data: locations
      }));
    }

    if (pathname === '/api/users/location' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          const userId = data.userId || 'user_' + Date.now();
          const roomId = data.roomId || 'default-office';
          const posX = data.x !== undefined ? Number(data.x) : (data.longitude !== undefined ? Number(data.longitude) : 200);
          const posY = data.y !== undefined ? Number(data.y) : (data.latitude !== undefined ? Number(data.latitude) : 200);

          const record = {
            userId,
            roomId,
            x: posX,
            y: posY,
            longitude: posX,
            latitude: posY,
            updatedAt: new Date().toISOString()
          };
          userLocations[userId] = record;

          // Wire directly to MongoDB PositionRepository (Milind's Geospatial Engine)
          try {
            await positionRepo.upsertPosition(userId, roomId, [posX, posY]);
          } catch (geoErr) {
            // Keep going with cached record
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({
            success: true,
            message: "User location updated successfully",
            data: record
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, message: e.message }));
        }
      });
      return;
    }

    // --- Geospatial Query: Nearby Users via MongoDB 2D Indexing ($near) ---
    if (pathname === '/api/users/nearby' && req.method === 'GET') {
      const q = parsedUrl.query;
      const x = Number(q.x || 0);
      const y = Number(q.y || 0);
      const maxDist = Number(q.maxDistance || 100);
      const roomId = q.roomId || 'default-office';

      positionRepo.nearby(roomId, [x, y], maxDist).then(nearbyUsers => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          success: true,
          count: nearbyUsers.length,
          data: nearbyUsers
        }));
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      });
      return;
    }

    // --- Milind's Geospatial Engine & Room Persistence (Task M8) ---
    if (pathname === '/api/rooms' && req.method === 'GET') {
      roomRepo.listRooms().then(rooms => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, count: rooms.length, data: rooms }));
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      });
      return;
    }

    const roomObstacleMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/obstacles$/);
    if (roomObstacleMatch && req.method === 'GET') {
      const roomId = roomObstacleMatch[1];
      roomRepo.getObstacles(roomId).then(obstacles => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, roomId, count: obstacles.length, data: obstacles }));
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      });
      return;
    }

    const singleRoomMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
    if (singleRoomMatch && req.method === 'GET') {
      const roomId = singleRoomMatch[1];
      roomRepo.getRoom(roomId).then(room => {
        if (!room) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, message: `Room '${roomId}' not found` }));
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: room }));
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      });
      return;
    }

    if (pathname === '/api/rooms' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          const room = await roomRepo.upsertRoom(data);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: true, data: room }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // --- Automated Testing API ---
    if (pathname === '/api/run-tests') {
      exec('node scripts/run_tests.js', { cwd: ROOT_DIR }, (err, stdout, stderr) => {
        const output = (stdout || '') + (stderr || '');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          success: !err,
          output: output.trim()
        }));
      });
      return;
    }

    // --- 50 & 100 Peer Load Test API (Task A11) ---
    if (pathname === '/api/load-test') {
      exec('node scripts/load_test.js', { cwd: ROOT_DIR }, (err, stdout, stderr) => {
        const output = (stdout || '') + (stderr || '');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          success: !err,
          output: output.trim()
        }));
      });
      return;
    }

    // --- Branch Progress API ---
    if (pathname === '/api/progress') {
      exec('node scripts/check_progress.js', { cwd: ROOT_DIR }, (err, stdout, stderr) => {
        const output = (stdout || '') + (stderr || '');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          success: !err,
          output: output.trim()
        }));
      });
      return;
    }

    // Resolve safe path inside ROOT_DIR
    const safePath = path.normalize(path.join(ROOT_DIR, pathname));
    if (!safePath.startsWith(ROOT_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('403 Forbidden: Access outside workspace directory');
    }

    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end(`404 Not Found: ${pathname}`);
      }

      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      const readStream = fs.createReadStream(safePath);
      readStream.pipe(res);
    });
  };
}

function startServer(port = DEFAULT_PORT, httpsPort = DEFAULT_HTTPS_PORT) {
  const handler = createRequestHandler(port, httpsPort);
  const server = http.createServer(handler);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`HTTP Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1, httpsPort);
    } else {
      console.error('HTTP Server error:', err);
    }
  });

  server.listen(port, () => {
    console.log(`==================================================================`);
    console.log(`  PROXISPEAK UNIFIED MULTI-BRANCH LOCALHOST SERVER ACTIVE`);
    console.log(`==================================================================`);
    console.log(`  HTTP Portal Hub:    http://localhost:${port}/`);
    console.log(`  Harpreet World:     http://localhost:${port}/client/world/standalone.html`);
    console.log(`  Ameya Audio Mesh:   http://localhost:${port}/client/audio/mesh.html`);
    console.log(`  Milind Geospatial:  http://localhost:${port}/server/geo/index.html`);
    console.log(`  Final Slide Deck:   http://localhost:${port}/docs/FINAL_PRESENTATION.html`);
    console.log(`  Work Task Sheet:    http://localhost:${port}/docs/WORK_TASK_SHEET_UPDATED.html`);

    // Try starting HTTPS server
    try {
      const httpsOpts = getHttpsOptions();
      const httpsServer = https.createServer(httpsOpts, handler);
      httpsServer.on('error', (hErr) => {
        if (hErr.code === 'EADDRINUSE') {
          console.log(`HTTPS Port ${httpsPort} in use.`);
        } else {
          console.warn('HTTPS error:', hErr.message);
        }
      });
      httpsServer.listen(httpsPort, () => {
        console.log(`  HTTPS Secure Hub:   https://localhost:${httpsPort}/ (WebRTC mic enabled)`);
        console.log(`==================================================================`);
      });
    } catch (e) {
      console.log(`  HTTPS Note: ${e.message}`);
      console.log(`==================================================================`);
    }
  });

  return server;
}

if (require.main === module) {
  startServer(DEFAULT_PORT, DEFAULT_HTTPS_PORT);
}

module.exports = { startServer, createRequestHandler };
