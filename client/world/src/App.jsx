import { useEffect, useRef, useState } from "react";

function App() {
  const canvasRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hudText, setHudText] = useState("Your Pos: (400, 250) | Teammate Dist: 200px");
  const [syncStatus, setSyncStatus] = useState("Connected");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const localUserId = 'avatar_' + Math.floor(1000 + Math.random() * 9000);
    const roomId = 'default-office';

    const avatar = {
      x: 400,
      y: 250,
      radius: 15,
      speed: 4,
    };

    const remoteAvatar = {
      id: 'teammate-1',
      x: 600,
      y: 250,
      radius: 15,
      name: "Teammate",
    };

    let isTeammateSpeaking = true;
    const keys = {};
    let target = null;

    let obstacles = [
      { id: 'desk-1', x: 100, y: 100, width: 120, height: 60, type: 'desk' },
      { id: 'desk-2', x: 300, y: 100, width: 120, height: 60, type: 'desk' },
      { id: 'desk-3', x: 550, y: 100, width: 120, height: 60, type: 'desk' },
      { id: 'desk-4', x: 100, y: 320, width: 120, height: 60, type: 'desk' },
      { id: 'desk-5', x: 550, y: 320, width: 120, height: 60, type: 'desk' },
    ];

    const rooms = [
      { name: "MAIN HALL", x: 20, y: 20, width: 760, height: 220 },
      { name: "THE LOUNGE", x: 20, y: 260, width: 360, height: 220 },
      { name: "MEETING ROOM", x: 400, y: 260, width: 380, height: 220 },
    ];

    // Fetch dynamic obstacles from Milind's Geospatial Room Repository
    fetch(`/api/rooms/${roomId}/obstacles`)
      .then(r => r.json())
      .then(res => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          obstacles = res.data;
        }
      })
      .catch(() => {});

    function syncLocation() {
      fetch('/api/users/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: localUserId,
          roomId: roomId,
          x: Math.round(avatar.x),
          y: Math.round(avatar.y)
        })
      })
      .then(r => r.json())
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

      // You label
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("You", avatar.x, avatar.y - 24);

      // Local Avatar
      ctx.beginPath();
      ctx.arc(avatar.x, avatar.y, avatar.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#2563eb";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Remote Avatar
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(remoteAvatar.name, remoteAvatar.x, remoteAvatar.y - 24);

      ctx.beginPath();
      ctx.arc(remoteAvatar.x, remoteAvatar.y, remoteAvatar.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#16a34a";
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
  }, []);

  return (
    <main style={{ textAlign: "center", fontFamily: "Arial, sans-serif", padding: "20px" }}>
      <h1 style={{ color: "#38bdf8" }}>ProxiSpeak Office</h1>
      <p style={{ color: "#94a3b8" }}>Connected to Backend &amp; MongoDB Geospatial Repository</p>

      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        style={{
          display: "block",
          margin: "15px auto",
          maxWidth: "95%",
          border: "2px solid #374151",
          borderRadius: "8px",
          cursor: "crosshair",
        }}
      />

      <div style={{ maxWidth: "800px", margin: "10px auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => setIsMuted(!isMuted)}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            backgroundColor: isMuted ? "#dc2626" : "#16a34a",
            color: "white",
            fontSize: "15px",
            fontWeight: "bold",
          }}
        >
          {isMuted ? "🔇 Mic Muted" : "🎤 Mic On"}
        </button>

        <span style={{ fontFamily: "monospace", color: "#38bdf8", fontSize: "0.9rem" }}>
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
