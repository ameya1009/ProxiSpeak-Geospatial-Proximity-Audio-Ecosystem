import { useEffect, useRef, useState } from "react";
import { getProximityIntegration } from "./audioBridge";
import Login from "./Login"; // Import the login component you just created

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");

  const canvasRef = useRef(null);
  const integrationRef = useRef(null);
  const remoteAvatarsRef = useRef([]);

  const [isMuted, setIsMuted] = useState(true);
  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [audioError, setAudioError] = useState("");

  const avatarRef = useRef({
    x: 400,
    y: 250,
    radius: 15,
    speed: 4,
  });

  const keysRef = useRef({});
  const targetRef = useRef(null);

  const obstacles = [
    { x: 100, y: 100, width: 120, height: 60 },
    { x: 300, y: 100, width: 120, height: 60 },
    { x: 550, y: 100, width: 120, height: 60 },
    { x: 100, y: 320, width: 120, height: 60 },
    { x: 550, y: 320, width: 120, height: 60 },
  ];

  const rooms = [
    { name: "MAIN HALL", x: 20, y: 20, width: 760, height: 220 },
    { name: "THE LOUNGE", x: 20, y: 260, width: 360, height: 220 },
    { name: "MEETING ROOM", x: 400, y: 260, width: 380, height: 220 },
  ];

  const isBlocked = (x, y, radius) => {
    for (const obstacle of obstacles) {
      const closestX = Math.max(obstacle.x, Math.min(x, obstacle.x + obstacle.width));
      const closestY = Math.max(obstacle.y, Math.min(y, obstacle.y + obstacle.height));
      const dx = x - closestX;
      const dy = y - closestY;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
    return false;
  };

  const startAudio = async () => {
    let integration = null;
    try {
      setAudioError("");
      const Integration = getProximityIntegration();
      if (!Integration) throw new Error("ProximityIntegration is not loaded");

      integration = new Integration({
        userId: username, // Use the logged-in username here!
        roomId: "proxispeak-room",
        initialPosition: { x: avatarRef.current.x, y: avatarRef.current.y },
        earshotRadius: 100,
        leaveRadius: 120,
      });

      integration.on("peer:enter", ({ peerId, position }) => {
        const avatars = remoteAvatarsRef.current;
        if (!avatars.some((a) => a.name === peerId)) {
          remoteAvatarsRef.current = [
            ...avatars,
            { x: position.x, y: position.y, radius: 15, name: peerId, isSpeaking: false },
          ];
        }
      });

      integration.on("peer:moved", ({ peerId, x, y, inRange }) => {
        remoteAvatarsRef.current = remoteAvatarsRef.current.map((avatar) => {
          if (avatar.name === peerId) {
            return { ...avatar, x, y, isSpeaking: !!inRange };
          }
          return avatar;
        });
      });

      integration.on("peer:leave", ({ peerId }) => {
        remoteAvatarsRef.current = remoteAvatarsRef.current.filter(
          (avatar) => avatar.name !== peerId
        );
      });

      await integration.webrtcManager.initLocalStream();

      if (integration.mixer?.ctx?.state === "suspended") {
        await integration.mixer.ctx.resume();
      }

      integrationRef.current = integration;
      integration.start();

      setIsAudioStarted(true);
      setIsMuted(false);
    } catch (error) {
      console.error("Audio startup failed:", error);
      if (integration) integration.destroy();
      integrationRef.current = null;
      setIsAudioStarted(false);
      setIsMuted(true);
      setAudioError(error.message || "Could not start audio");
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return; // Only run canvas loop when logged in

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const tryMove = (dx, dy) => {
      const avatar = avatarRef.current;
      const nextX = Math.max(avatar.radius, Math.min(canvas.width - avatar.radius, avatar.x + dx));
      const nextY = Math.max(avatar.radius, Math.min(canvas.height - avatar.radius, avatar.y + dy));

      if (!isBlocked(nextX, nextY, avatar.radius)) {
        avatar.x = nextX;
        avatar.y = nextY;
        
        if (integrationRef.current) {
          integrationRef.current.updateLocalPosition(avatar.x, avatar.y);
        }
        return true;
      }
      return false;
    };

    const update = () => {
      const keys = keysRef.current;
      const avatar = avatarRef.current;
      let dx = 0;
      let dy = 0;

      if (keys["w"] || keys["arrowup"]) dy -= avatar.speed;
      if (keys["s"] || keys["arrowdown"]) dy += avatar.speed;
      if (keys["a"] || keys["arrowleft"]) dx -= avatar.speed;
      if (keys["d"] || keys["arrowright"]) dx += avatar.speed;

      if (dx !== 0 || dy !== 0) {
        targetRef.current = null;
        tryMove(dx, dy);
      }

      const target = targetRef.current;
      if (target) {
        const diffX = target.x - avatar.x;
        const diffY = target.y - avatar.y;
        const distance = Math.hypot(diffX, diffY);

        if (distance <= avatar.speed) {
          tryMove(diffX, diffY);
          targetRef.current = null;
        } else {
          const moved = tryMove(
            (diffX / distance) * avatar.speed,
            (diffY / distance) * avatar.speed
          );
          if (!moved) targetRef.current = null;
        }
      }
    };

    const draw = () => {
      ctx.fillStyle = "#e8f5e9";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const room of rooms) {
        ctx.strokeStyle = "#a3b8a5";
        ctx.lineWidth = 2;
        ctx.strokeRect(room.x, room.y, room.width, room.height);
        ctx.fillStyle = "#47634c";
        ctx.font = "bold 14px Arial";
        ctx.fillText(room.name, room.x + 65, room.y + 25);
      }

      for (const obstacle of obstacles) {
        ctx.fillStyle = "#c4a484";
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        ctx.strokeStyle = "#8b7355";
        ctx.lineWidth = 2;
        ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      }

      const avatar = avatarRef.current;

      ctx.beginPath();
      ctx.arc(avatar.x, avatar.y, 100, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
      ctx.fill();
      ctx.strokeStyle = "rgba(37, 99, 235, 0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Display user's name on their avatar label
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(username || "You", avatar.x, avatar.y - 24);

      ctx.beginPath();
      ctx.arc(avatar.x, avatar.y, avatar.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#2563eb";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      for (const remoteAvatar of remoteAvatarsRef.current) {
        ctx.beginPath();
        ctx.arc(remoteAvatar.x, remoteAvatar.y, remoteAvatar.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#16a34a";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.stroke();

        if (remoteAvatar.isSpeaking) {
          ctx.beginPath();
          ctx.arc(remoteAvatar.x, remoteAvatar.y, remoteAvatar.radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.fillStyle = "#1f2937";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText(remoteAvatar.name, remoteAvatar.x, remoteAvatar.y - 24);
      }
    };

    let animationId;
    const gameLoop = () => {
      update();
      draw();
      animationId = requestAnimationFrame(gameLoop);
    };

    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
        keysRef.current[key] = true;
      }
    };

    const handleKeyUp = (event) => {
      keysRef.current[event.key.toLowerCase()] = false;
    };

    const handleCanvasClick = (event) => {
      const rect = canvas.getBoundingClientRect();
      targetRef.current = {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height),
      };
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("click", handleCanvasClick);
    gameLoop();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("click", handleCanvasClick);
      cancelAnimationFrame(animationId);
      integrationRef.current?.destroy();
      integrationRef.current = null;
      remoteAvatarsRef.current = [];
    };
  }, [isLoggedIn]);

  // If not logged in, show the login screen
  if (!isLoggedIn) {
    return <Login onJoin={(name) => { setUsername(name); setIsLoggedIn(true); }} />;
  }

  return (
    <main style={{ textAlign: "center", fontFamily: "Arial, sans-serif" }}>
      <h1>ProxiSpeak Office</h1>
      <p>Welcome, <b>{username}</b>! Move your avatar using WASD or arrow keys / Click to move</p>

      {audioError && <p style={{ color: "#dc2626", fontWeight: "bold" }}>{audioError}</p>}

      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        style={{
          display: "block",
          margin: "20px auto",
          maxWidth: "95%",
          border: "2px solid #374151",
        }}
      />

      <button
        onClick={() => {
          if (!isAudioStarted) {
            startAudio();
            return;
          }

          const nextMuted = !isMuted;
          if (integrationRef.current?.webrtcManager) {
            integrationRef.current.webrtcManager.setMuted(nextMuted);
          }
          setIsMuted(nextMuted);
        }}
        style={{
          padding: "10px 20px",
          marginBottom: "20px",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
          backgroundColor: isMuted ? "#dc2626" : "#16a34a",
          color: "white",
          fontSize: "16px",
        }}
      >
        {!isAudioStarted
          ? "🎤 Enable Mic"
          : isMuted
            ? "🔇 Mic Muted"
            : "🎤 Mic On"}
      </button>
    </main>
  );
}

export default App;