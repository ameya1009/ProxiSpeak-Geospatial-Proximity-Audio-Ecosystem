
import { useEffect, useRef } from "react";

function App() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const avatar = {
      x: 400,
      y: 250,
      radius: 15,
      speed: 4,
    };

    const keys = {};

    function handleKeyDown(event) {
      const key = event.key.toLowerCase();

      if (
        ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)
      ) {
        event.preventDefault();
        keys[key] = true;
      }
    }

    function handleKeyUp(event) {
      keys[event.key.toLowerCase()] = false;
    }

    function update() {
      if (keys["w"] || keys["arrowup"]) {
        avatar.y -= avatar.speed;
      }

      if (keys["s"] || keys["arrowdown"]) {
        avatar.y += avatar.speed;
      }

      if (keys["a"] || keys["arrowleft"]) {
        avatar.x -= avatar.speed;
      }

      if (keys["d"] || keys["arrowright"]) {
        avatar.x += avatar.speed;
      }

      avatar.x = Math.max(
        avatar.radius,
        Math.min(canvas.width - avatar.radius, avatar.x)
      );

      avatar.y = Math.max(
        avatar.radius,
        Math.min(canvas.height - avatar.radius, avatar.y)
      );
    }

    function draw() {
      // Office floor
      ctx.fillStyle = "#e8f5e9";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Desk
      ctx.fillStyle = "#c4a484";
      ctx.fillRect(100, 100, 120, 60);

      // 100-pixel earshot radius
      ctx.beginPath()
      ctx.arc(avatar.x, avatar.y, 100, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(37, 99, 235, 0.12)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.6)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Avatar
      ctx.beginPath();
      ctx.arc(avatar.x, avatar.y, avatar.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#2563eb";
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    let animationId;

    function gameLoop() {
      update();
      draw();
      animationId = requestAnimationFrame(gameLoop);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    gameLoop();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <main style={{ textAlign: "center", fontFamily: "Arial, sans-serif" }}>
      <h1>ProxiSpeak Office</h1>
      <p>Move your avatar using WASD or arrow keys</p>

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
    </main>
  );
}

export default App;

