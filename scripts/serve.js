/**
 * ProxiSpeak Localhost Development & Demo Server
 * Zero external dependencies - pure Node.js HTTP server.
 * Combines deliverables from ALL branches on localhost:
 * - Harpreet---frontend: 2D Virtual World (React/Canvas office with avatars and obstacles)
 * - Abhishek-backend: Location API (/api/users/location & /api/users/locations)
 * - Ameya's-branch: Web Audio Engine, WebRTC Audio Mesh, Connection Capper & Obstacle Attenuation
 * - Milind-database (Transferred): MongoDB 2D indexing, $near queries, clustering & benchmarks
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// In-memory user locations store (Abhishek's backend state)
const userLocations = {};

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

function renderLandingPage(port) {
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
      transition: transform 0.2s, border-color 0.2s;
    }
    .card:hover {
      transform: translateY(-4px);
      border-color: var(--accent);
    }
    .card-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .card-tag {
      font-size: 0.7rem;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: var(--muted);
    }
    .card h2 {
      font-size: 1.2rem;
      margin-bottom: 0.4rem;
      color: #fff;
    }
    .card p {
      color: var(--muted);
      font-size: 0.875rem;
      line-height: 1.5;
      margin-bottom: 1.25rem;
    }
    .btn {
      display: inline-block;
      text-align: center;
      background: var(--accent);
      color: #0b0f19;
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.85rem;
      transition: background 0.15s;
    }
    .btn:hover {
      background: var(--accent-hover);
      color: #fff;
    }
    .btn-secondary {
      background: #334155;
      color: #f8fafc;
    }
    .btn-secondary:hover {
      background: #475569;
    }
    .test-runner-card {
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .test-runner-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .test-output {
      background: #060913;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 1rem;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.8rem;
      color: #38bdf8;
      max-height: 220px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
    footer {
      border-top: 1px solid var(--border);
      padding-top: 1.5rem;
      text-align: center;
      color: var(--muted);
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎙️ ProxiSpeak Unified Localhost Hub</h1>
      <p class="lead">Combining All Deliverables Across Branches in One Localhost Environment</p>
      <div class="badge-bar">
        <span class="badge badge-ameya">Ameya: Audio & WebRTC Mesh (95%)</span>
        <span class="badge badge-harpreet">Harpreet: 2D React Canvas (60%)</span>
        <span class="badge badge-abhishek">Abhishek: Signaling & API (22%)</span>
        <span class="badge badge-milind">Milind &rarr; Ameya: Geospatial Engine (100%)</span>
      </div>
    </header>

    <div class="grid">
      <!-- 1. Ameya's Audio Mesh -->
      <div class="card">
        <div>
          <div class="card-meta">
            <span class="card-tag">Branch: Ameya's-branch</span>
            <span style="color:#38bdf8; font-size:0.75rem; font-weight:700;">Tasks A5-A10</span>
          </div>
          <h2>🚀 Spatial Audio Mesh Simulation</h2>
          <p>Two-browser WebRTC audio mesh with dual spatial hysteresis (100px enter, 120px leave), N=4 Connection Capper with 15px swap margin, and AABB ray-casting (-6dB desk, -14dB wall + 900Hz biquad filter).</p>
        </div>
        <a class="btn" href="/client/audio/mesh.html" target="_blank">Launch Audio Mesh ➔</a>
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
          <h2>🌍 Geospatial Engine & Clusters</h2>
          <p>Interactive visualization of the transferred MongoDB geospatial engine: 2D planar indexing ({ pos: '2d', roomId: 1 }), $near distance queries (&lt;0.1ms), BFS conversation clustering, and write batcher IOPS reduction.</p>
        </div>
        <a class="btn" style="background:#a855f7; color:#fff;" href="/server/geo/index.html" target="_blank">Explore Geospatial Engine ➔</a>
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

      <!-- 6. Official Task Sheet & Paperwork -->
      <div class="card">
        <div>
          <div class="card-meta">
            <span class="card-tag">Project Documentation</span>
            <span style="color:#94a3b8; font-size:0.75rem; font-weight:700;">Infotact Report</span>
          </div>
          <h2>📄 Official Task Sheet & Viva Prep</h2>
          <p>Official task sheet tracking all 39 tasks across Ameya, Abhishek, Harpreet, and transferred database tasks (M1–M9) with visual progress bars and viva defense guides.</p>
        </div>
        <a class="btn btn-secondary" href="/docs/WORK_TASK_SHEET_UPDATED.html" target="_blank">View Task Sheet ➔</a>
      </div>
    </div>

    <!-- Live Automated Test Runner Section -->
    <div class="test-runner-card">
      <div class="test-runner-header">
        <div>
          <h2 style="font-size:1.15rem; color:#f8fafc;">🧪 Automated Test Suite Harness (All Modules)</h2>
          <p style="color:#94a3b8; font-size:0.8rem;">Click to execute all 26 test suites directly on localhost.</p>
        </div>
        <button id="btnRunTests" class="btn" style="padding:0.5rem 1rem; font-size:0.85rem; cursor:pointer;">▶ Run 26 Test Suites</button>
      </div>
      <div id="testOutput" class="test-output">Click 'Run 26 Test Suites' to verify all audio spike, WebRTC, proximity, connection capper, obstacle attenuation, and geospatial assertions...</div>
    </div>

    <footer>
      <p>ProxiSpeak Engine running locally at <strong>http://localhost:${port}</strong> | Group 15</p>
    </footer>
  </div>

  <script>
    const btnRunTests = document.getElementById('btnRunTests');
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
        btnRunTests.textContent = '▶ Re-Run Tests';
      }
    });
  </script>
</body>
</html>`;
}

function startServer(port) {
  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // Root route -> Portal
    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(renderLandingPage(port));
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
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          const userId = data.userId || 'user_' + Date.now();
          const lat = data.latitude !== undefined ? Number(data.latitude) : (data.y || 200);
          const lng = data.longitude !== undefined ? Number(data.longitude) : (data.x || 200);
          userLocations[userId] = {
            userId,
            latitude: lat,
            longitude: lng,
            x: data.x || lng,
            y: data.y || lat,
            updatedAt: new Date().toISOString()
          };
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({
            success: true,
            message: "User location updated successfully",
            data: userLocations[userId]
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ success: false, message: e.message }));
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
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, () => {
    console.log(`==================================================================`);
    console.log(`  PROXISPEAK UNIFIED MULTI-BRANCH LOCALHOST SERVER ACTIVE`);
    console.log(`==================================================================`);
    console.log(`  Portal Hub:        http://localhost:${port}/`);
    console.log(`  Harpreet World:    http://localhost:${port}/client/world/standalone.html`);
    console.log(`  Ameya Audio Mesh:  http://localhost:${port}/client/audio/mesh.html`);
    console.log(`  Milind Geospatial: http://localhost:${port}/server/geo/index.html`);
    console.log(`  Abhishek API:      http://localhost:${port}/api/backend`);
    console.log(`  Audio Spike Lab:   http://localhost:${port}/client/audio/index.html`);
    console.log(`  Work Task Sheet:   http://localhost:${port}/docs/WORK_TASK_SHEET_UPDATED.html`);
    console.log(`==================================================================`);
  });

  return server;
}

if (require.main === module) {
  startServer(DEFAULT_PORT);
}

module.exports = { startServer };
