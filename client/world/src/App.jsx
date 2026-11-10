import { useEffect, useRef, useState } from "react";

const PRESET_WORKERS = [
  { workerId: "EMP-001", name: "Ameya Sharma", department: "Team Lead & Audio DSP", avatarColor: "#0284c7" },
  { workerId: "EMP-002", name: "Harpreet Kaur", department: "Frontend & 2D World", avatarColor: "#10b981" },
  { workerId: "EMP-003", name: "Abhishek Verma", department: "Backend & Signaling", avatarColor: "#f59e0b" },
  { workerId: "EMP-004", name: "Milind Kumar", department: "Database & Geospatial", avatarColor: "#8b5cf6" },
];

function App() {
  const canvasRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hudText, setHudText] = useState("Your Pos: (400, 250) | Teammate Dist: 200px");
  const [syncStatus, setSyncStatus] = useState("Connected");

  // Worker Session State
  const [worker, setWorker] = useState(() => {
    try {
      const saved = localStorage.getItem("proxispeak_worker");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [formName, setFormName] = useState("");
  const [formDept, setFormDept] = useState("Engineering");
  const [formColor, setFormColor] = useState("#0284c7");
  const [micTesting, setMicTesting] = useState(false);
  const [vuLevel, setVuLevel] = useState(0);

  // Mic test simulation
  useEffect(() => {
    let interval;
    if (micTesting) {
      interval = setInterval(() => {
        setVuLevel(Math.floor(25 + Math.random() * 65));
      }, 100);
    } else {
      setVuLevel(0);
    }
    return () => clearInterval(interval);
  }, [micTesting]);

  const handleRegister = (e) => {
    if (e) e.preventDefault();
    const finalWorker = {
      workerId: "EMP-" + Math.floor(100 + Math.random() * 900),
      name: formName.trim() || "Office Worker",
      department: formDept,
      avatarColor: formColor,
    };
    setWorker(finalWorker);
    localStorage.setItem("proxispeak_worker", JSON.stringify(finalWorker));

    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalWorker),
    }).catch(() => {});
  };

  const handleQuickJoin = (preset) => {
    setWorker(preset);
    localStorage.setItem("proxispeak_worker", JSON.stringify(preset));

    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preset),
    }).catch(() => {});
  };

  const handleLogout = () => {
    if (window.confirm("Log out from the office floor?")) {
      if (worker) {
        fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: worker.workerId }),
        }).catch(() => {});
      }
      localStorage.removeItem("proxispeak_worker");
      setWorker(null);
    }
  };

  useEffect(() => {
    if (!worker) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const localUserId = worker.workerId;
    const roomId = "default-office";

    const avatar = {
      x: 400,
      y: 250,
      radius: 16,
      speed: 4,
    };

    const remoteAvatar = {
      id: "teammate-1",
      x: 600,
      y: 250,
      radius: 16,
      name: "Teammate",
      role: "Engineering",
      color: "#16a34a",
    };

    let isTeammateSpeaking = true;
    const keys = {};
    let target = null;

    let obstacles = [
      { id: "desk-1", x: 100, y: 100, width: 120, height: 60, type: "desk" },
      { id: "desk-2", x: 300, y: 100, width: 120, height: 60, type: "desk" },
      { id: "desk-3", x: 550, y: 100, width: 120, height: 60, type: "desk" },
      { id: "desk-4", x: 100, y: 320, width: 120, height: 60, type: "desk" },
      { id: "desk-5", x: 550, y: 320, width: 120, height: 60, type: "desk" },
    ];

    const rooms = [
      { name: "MAIN HALL", x: 20, y: 20, width: 760, height: 220 },
      { name: "THE LOUNGE", x: 20, y: 260, width: 360, height: 220 },
      { name: "MEETING ROOM", x: 400, y: 260, width: 380, height: 220 },
    ];

    // Fetch dynamic obstacles
    fetch(`/api/rooms/${roomId}/obstacles`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          obstacles = res.data;
        }
      })
      .catch(() => {});

    function syncLocation() {
      fetch("/api/users/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: localUserId,
          name: worker.name,
          department: worker.department,
          avatarColor: worker.avatarColor,
          roomId: roomId,
          x: Math.round(avatar.x),
          y: Math.round(avatar.y),
        }),
      })
        .then((r) => r.json())
        .then(() => setSyncStatus("Connected (/api/users/location)"))
        .catch(() => setSyncStatus("Offline"));
    }

    function isBlocked(x, y) {
      for (const obstacle of obstacles) {
        const closestX = Math.max(obstacle.x, Math.min(x, obstacle.x + obstacle.width));
        const closestY = Math.max(obstacle.y, Math.min(y, obstacle.y + obstacle.height));
        const dx = x - closestX;
        const dy = y - closestY;
        if (dx * dx + dy * dy < avatar.radius * avatar.radius) {
          return true;
        }
      }
      return false;
    }

    function tryMove(dx, dy) {
      const nextX = Math.max(avatar.radius, Math.min(canvas.width - avatar.radius, avatar.x + dx));
      const nextY = Math.max(avatar.radius, Math.min(canvas.height - avatar.radius, avatar.y + dy));

      if (!isBlocked(nextX, nextY)) {
        avatar.x = nextX;
        avatar.y = nextY;
        syncLocation();
        return true;
      }
      return false;
    }

    function update() {
      let dx = 0;
      let dy = 0;

      if (keys["w"] || keys["arrowup"]) dy -= avatar.speed;
      if (keys["s"] || keys["arrowdown"]) dy += avatar.speed;
      if (keys["a"] || keys["arrowleft"]) dx -= avatar.speed;
      if (keys["d"] || keys["arrowright"]) dx += avatar.speed;

      if (dx !== 0 || dy !== 0) {
        target = null;
        tryMove(dx, dy);
      } else if (target) {
        const diffX = target.x - avatar.x;
        const diffY = target.y - avatar.y;
        const distance = Math.hypot(diffX, diffY);

        if (distance <= avatar.speed) {
          tryMove(diffX, diffY);
          target = null;
        } else {
          const moved = tryMove((diffX / distance) * avatar.speed, (diffY / distance) * avatar.speed);
          if (!moved) target = null;
        }
      }

      const dist = Math.hypot(remoteAvatar.x - avatar.x, remoteAvatar.y - avatar.y);
      const inRange = dist <= 100;
      setHudText(
        `Your Pos: (${Math.round(avatar.x)}, ${Math.round(avatar.y)}) | Teammate: ${Math.round(dist)}px ${inRange ? "🔊 (IN EARSHOT)" : "🔇 (OUT OF RANGE)"}`
      );
    }

    function draw() {
      ctx.fillStyle = "#e8f5e9";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const room of rooms) {
        ctx.strokeStyle = "#a3b8a5";
        ctx.lineWidth = 2;
        ctx.strokeRect(room.x, room.y, room.width, room.height);

        ctx.fillStyle = "#47634c";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "left";
        ctx.fillText(room.name, room.x + 12, room.y + 24);
      }

      for (const obstacle of obstacles) {
        ctx.fillStyle = "#c4a484";
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

        ctx.strokeStyle = "#8b7355";
        ctx.lineWidth = 2;
        ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

        ctx.fillStyle = "#3f2e18";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.fillText("DESK", obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2 + 4);
      }

      // 100px earshot radius
      ctx.beginPath();
      ctx.arc(avatar.x, avatar.y, 100, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
      ctx.fill();
      ctx.strokeStyle = "rgba(37, 99, 235, 0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Local Worker Label
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "center";
      ctx.fillText(worker.name, avatar.x, avatar.y - 24);

      // Local Avatar
      ctx.beginPath();
      ctx.arc(avatar.x, avatar.y, avatar.radius, 0, Math.PI * 2);
      ctx.fillStyle = worker.avatarColor || "#0284c7";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Remote Avatar
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "center";
      ctx.fillText(remoteAvatar.name, remoteAvatar.x, remoteAvatar.y - 24);

      ctx.beginPath();
      ctx.arc(remoteAvatar.x, remoteAvatar.y, remoteAvatar.radius, 0, Math.PI * 2);
      ctx.fillStyle = remoteAvatar.color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      if (isTeammateSpeaking) {
        ctx.beginPath();
        ctx.arc(remoteAvatar.x, remoteAvatar.y, remoteAvatar.radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    let animationId;
    function gameLoop() {
      update();
      draw();
      animationId = requestAnimationFrame(gameLoop);
    }

    function handleKeyDown(event) {
      const key = event.key.toLowerCase();
      if (key === "t") {
        isTeammateSpeaking = !isTeammateSpeaking;
        return;
      }
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
        keys[key] = true;
      }
    }

    function handleKeyUp(event) {
      keys[event.key.toLowerCase()] = false;
    }

    function handleCanvasClick(event) {
      const rect = canvas.getBoundingClientRect();
      target = {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height),
      };
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("click", handleCanvasClick);

    syncLocation();
    gameLoop();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("click", handleCanvasClick);
      cancelAnimationFrame(animationId);
    };
  }, [worker]);

  // If worker is not logged in, render Worker Registration & Login Screen
  if (!worker) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ background: "#1e293b", border: "2px solid #38bdf8", borderRadius: "14px", maxWidth: "560px", width: "100%", padding: "24px", color: "#f8fafc", boxShadow: "0 20px 50px rgba(0,0,0,0.8)" }}>
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <span style={{ background: "#0284c7", color: "#fff", fontSize: "0.72rem", fontWeight: "bold", padding: "3px 10px", borderRadius: "9999px", textTransform: "uppercase" }}>
              🏢 ProxiSpeak Virtual Office
            </span>
            <h2 style={{ margin: "10px 0 4px 0", fontSize: "1.6rem" }}>Office Worker Sign-In &amp; Registration</h2>
            <p style={{ color: "#94a3b8", fontSize: "0.88rem", margin: 0 }}>Register your profile to enter the virtual office floor and connect with coworkers.</p>
          </div>

          <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>
            ⚡ Quick Join as Team Member
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
            {PRESET_WORKERS.map((p) => (
              <button
                key={p.workerId}
                onClick={() => handleQuickJoin(p)}
                style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  padding: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  color: "#f8fafc",
                  textAlign: "left",
                }}
              >
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: p.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "0.75rem" }}>
                  {p.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <div style={{ fontWeight: "600", fontSize: "0.82rem" }}>{p.name}</div>
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{p.department.split("&")[0]}</div>
                </div>
              </button>
            ))}
          </div>

          <div style={{ textAlign: "center", margin: "14px 0", color: "#64748b", fontSize: "0.75rem", fontWeight: "bold" }}>
            ─── OR REGISTER CUSTOM WORKER ───
          </div>

          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "4px" }}>Full Name *</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Alex Mercer"
                style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: "6px", padding: "9px 12px", color: "#fff", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "4px" }}>Department</label>
              <select
                value={formDept}
                onChange={(e) => setFormDept(e.target.value)}
                style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: "6px", padding: "9px 12px", color: "#fff", boxSizing: "border-box" }}
              >
                <option value="Audio DSP & WebRTC">🎧 Audio DSP &amp; WebRTC</option>
                <option value="Frontend & 2D World">🎨 Frontend &amp; 2D World</option>
                <option value="Backend & Signaling">⚙️ Backend &amp; Signaling</option>
                <option value="Database & Geospatial">🗄️ Database &amp; Geospatial</option>
                <option value="Product & Design">📐 Product &amp; Design</option>
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", marginBottom: "4px" }}>Avatar Color</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {["#0284c7", "#10b981", "#8b5cf6", "#f59e0b", "#f43f5e", "#06b6d4"].map((c) => (
                  <div
                    key={c}
                    onClick={() => setFormColor(c)}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: c,
                      cursor: "pointer",
                      border: formColor === c ? "3px solid #fff" : "2px solid transparent",
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setMicTesting(!micTesting)}
                style={{ background: "#334155", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "0.78rem" }}
              >
                {micTesting ? "🛑 Stop Mic Test" : "🎙️ Test Mic Input"}
              </button>
              <div style={{ width: "80px", height: "8px", background: "#1e293b", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${vuLevel}%`, height: "100%", background: "#10b981", transition: "width 0.1s" }} />
              </div>
            </div>

            <button
              type="submit"
              style={{
                width: "100%",
                background: "#38bdf8",
                color: "#0b0f19",
                fontSize: "1rem",
                fontWeight: "bold",
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
              }}
            >
              🚀 Sign In &amp; Enter Office Floor ➔
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <main style={{ textAlign: "center", fontFamily: "Arial, sans-serif", padding: "16px", background: "#0f172a", minHeight: "100vh", color: "#f8fafc" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto 12px auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ color: "#38bdf8", margin: 0, fontSize: "1.5rem" }}>🏢 ProxiSpeak Office</h1>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.85rem" }}>Spatial Web Audio Mesh &bull; MongoDB 2D Proximity</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#1e293b", border: "1px solid #334155", padding: "6px 12px", borderRadius: "9999px", fontSize: "0.85rem" }}>
            <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: worker.avatarColor, display: "inline-block" }} />
            <strong>{worker.name}</strong>
            <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>({worker.department.split("&")[0]})</span>
          </div>
          <button
            onClick={handleLogout}
            style={{ background: "#334155", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "0.75rem" }}
          >
            🚪 Switch Worker
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        style={{
          display: "block",
          margin: "10px auto",
          maxWidth: "95%",
          background: "#e8f5e9",
          border: "2px solid #374151",
          borderRadius: "8px",
          cursor: "crosshair",
        }}
      />

      <div style={{ maxWidth: "800px", margin: "10px auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => setIsMuted(!isMuted)}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            backgroundColor: isMuted ? "#dc2626" : "#16a34a",
            color: "white",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          {isMuted ? "🔇 Mic Muted" : "🎤 Mic On"}
        </button>

        <span style={{ fontFamily: "monospace", color: "#38bdf8", fontSize: "0.85rem" }}>
          {hudText}
        </span>
      </div>

      <p style={{ fontSize: "0.8rem", color: "#64748b" }}>
        Backend Sync Status: <strong style={{ color: "#10b981" }}>{syncStatus}</strong>
      </p>
    </main>
  );
}

export default App;
