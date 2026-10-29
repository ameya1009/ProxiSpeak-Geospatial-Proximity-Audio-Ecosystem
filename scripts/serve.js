/**
 * ProxiSpeak Localhost Development & Demo Server
 * Zero external dependencies - pure Node.js HTTP server.
 * Serves the interactive Web Audio Mesh, Audio Spike Lab, and Project Documentation.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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
  <title>ProxiSpeak - Localhost Portal</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: #1e293b;
      --text: #f8fafc;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --accent-hover: #0284c7;
      --success: #10b981;
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
      padding: 3rem 1.5rem;
      min-height: 100vh;
    }
    .container {
      max-width: 900px;
      width: 100%;
    }
    header {
      text-align: center;
      margin-bottom: 2.5rem;
    }
    h1 {
      font-size: 2.2rem;
      color: var(--accent);
      margin-bottom: 0.5rem;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    p.lead {
      color: var(--muted);
      font-size: 1.1rem;
    }
    .badge {
      display: inline-block;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      background: #0369a1;
      color: #e0f2fe;
      margin-top: 1rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2.5rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.75rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.2s, border-color 0.2s;
    }
    .card:hover {
      transform: translateY(-4px);
      border-color: var(--accent);
    }
    .card h2 {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
      color: #fff;
    }
    .card p {
      color: var(--muted);
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 1.25rem;
    }
    .btn {
      display: inline-block;
      text-align: center;
      background: var(--accent);
      color: #0b0f19;
      padding: 0.65rem 1.25rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.95rem;
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
      <h1>🎙️ ProxiSpeak Localhost Portal</h1>
      <p class="lead">Geospatial Proximity Audio Communication Ecosystem</p>
      <div class="badge">Active Branch: Ameya's-branch (100% Passing Tests)</div>
    </header>

    <div class="grid">
      <div class="card">
        <div>
          <h2>🚀 Proximity Audio Mesh (Task A6)</h2>
          <p>Two-browser interactive proximity audio room with 2D Canvas avatar movements, obstacle collision avoidance, dynamic stereo panning, and automatic WebRTC spatial audio gating.</p>
        </div>
        <a class="btn" href="/client/audio/mesh.html" target="_blank">Launch Mesh Simulation ➔</a>
      </div>

      <div class="card">
        <div>
          <h2>🎛️ Spatial Audio Spike Lab (Task A4)</h2>
          <p>Interactive laboratory testing the Web Audio API graph: real-time distance gain curves, smooth exponential ramping, stereo panning, and real-time frequency spectrum analysis.</p>
        </div>
        <a class="btn" href="/client/audio/index.html" target="_blank">Open Audio Spike Lab ➔</a>
      </div>

      <div class="card">
        <div>
          <h2>📄 Updated Work Task Sheet</h2>
          <p>Official task sheet tracking all completed tasks across Ameya, Abhishek, Harpreet, and transferred database tasks (M1–M9) with visual progress bars.</p>
        </div>
        <a class="btn btn-secondary" href="/docs/WORK_TASK_SHEET_UPDATED.html" target="_blank">View Task Sheet ➔</a>
      </div>
    </div>

    <footer>
      <p>ProxiSpeak Engine running locally at <strong>http://localhost:${port}</strong> | Group 15</p>
    </footer>
  </div>
</body>
</html>`;
}

function startServer(port) {
  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // Root route -> Portal
    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(renderLandingPage(port));
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
    console.log(`  PROXISPEAK LOCALHOST SERVER ACTIVE`);
    console.log(`==================================================================`);
    console.log(`  Portal URL:       http://localhost:${port}/`);
    console.log(`  Audio Mesh:       http://localhost:${port}/client/audio/mesh.html`);
    console.log(`  Audio Spike Lab:  http://localhost:${port}/client/audio/index.html`);
    console.log(`  Work Task Sheet:  http://localhost:${port}/docs/WORK_TASK_SHEET_UPDATED.html`);
    console.log(`==================================================================`);
  });

  return server;
}

if (require.main === module) {
  startServer(DEFAULT_PORT);
}

module.exports = { startServer };
