
import { useEffect, useRef, useState } from "react";

function App() {
  const canvasRef = useRef(null);

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const avatar = {
      x: 400,
      y: 250,
      radius: 15,
      speed: 4,
    };

   const remoteAvatars = [
  {
    x: 600,
    y: 250,
    radius: 15,
    name: "Teammate",
    isSpeaking: true,
   },
  {
    x: 500,
    y: 180,
    radius: 15,
    name: "Teammate 2",
    isSpeaking: false,
  },
];  


    const keys = {};
    let target = null;    

  const obstacles = [
  { x: 100, y: 100, width: 120, height: 60 },
  { x: 300, y: 100, width: 120, height: 60 },
  { x: 550, y: 100, width: 120, height: 60 },
  { x: 100, y: 320, width: 120, height: 60 },
  { x: 550, y: 320, width: 120, height: 60 },
];

function isBlocked(x, y) {

  for (const obstacle of obstacles) {
    const closestX = Math.max(
      obstacle.x,
      Math.min(x, obstacle.x + obstacle.width)
    );

    const closestY = Math.max(
      obstacle.y,
      Math.min(y, obstacle.y + obstacle.height)
    );

    const dx = x - closestX;
    const dy = y - closestY;

    if (dx * dx + dy * dy < avatar.radius * avatar.radius) {
      return true;
    }
  }

  return false;
}

function tryMove(dx, dy) {
  const nextX = Math.max(
    avatar.radius,
    Math.min(canvas.width - avatar.radius, avatar.x + dx)
  );

  const nextY = Math.max(
    avatar.radius,
    Math.min(canvas.height - avatar.radius, avatar.y + dy)
  );

  if (!isBlocked(nextX, nextY)) {
    avatar.x = nextX;
    avatar.y = nextY;
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

  // Keyboard movement
  if (dx !== 0 || dy !== 0) {
    target = null;
    tryMove(dx, dy);
  }

  // Click-to-move
  if (target) {
    const diffX = target.x - avatar.x;
    const diffY = target.y - avatar.y;
    const distance = Math.hypot(diffX, diffY);

    if (distance <= avatar.speed) {
      if (tryMove(diffX, diffY)) {
        target = null;
      } else {
        target = null;
      }
    } else {
      const moved = tryMove(
        (diffX / distance) * avatar.speed,
        (diffY / distance) * avatar.speed
      );

      if (!moved) target = null;
    }
  }
} 


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

    function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();

    target = {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
   }

   
    function draw() {
      // Office floor
      ctx.fillStyle = "#e8f5e9";
      ctx.fillRect(0, 0, canvas.width, canvas.height);  
            
         // Office room sections
     const rooms = [
     {
        name: "MAIN HALL",
        x: 20,
        y: 20,
        width: 760,
        height: 220,
      },
    {
      name: "THE LOUNGE",
      x: 20,
      y: 260,
      width: 360,
      height: 220,
     },
  {
    name: "MEETING ROOM",
    x: 400,
    y: 260,
    width: 380,
    height: 220,
  },
];

// Draw room boundaries and labels
for (const room of rooms) {
  ctx.strokeStyle = "#a3b8a5";
  ctx.lineWidth = 2;

  ctx.strokeRect(
    room.x,
    room.y,
    room.width,
    room.height
  );

  ctx.fillStyle = "#47634c";
  ctx.font = "bold 14px Arial";
  ctx.fillText(
    room.name,
    room.x + 12,
    room.y + 24
  );
}


        // Furniture: blocked areas
      for (const obstacle of obstacles) {
       ctx.fillStyle = "#c4a484";
       ctx.fillRect(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height
     );

      ctx.strokeStyle = "#8b7355";
      ctx.lineWidth = 2;
      ctx.strokeRect(
       obstacle.x,
       obstacle.y,
       obstacle.width,
       obstacle.height
    );
  }

      // 100-pixel earshot radius
      ctx.beginPath()
      ctx.arc(avatar.x, avatar.y, 100, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(37, 99, 235, 0.12)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.6)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Your name label
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("You", avatar.x, avatar.y - 24);

      // Avatar
      ctx.beginPath();
      ctx.arc(avatar.x, avatar.y, avatar.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#2563eb";
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw remote teammates
for (const remoteAvatar of remoteAvatars) {
  ctx.beginPath();
  ctx.arc(
    remoteAvatar.x,
    remoteAvatar.y,
    remoteAvatar.radius,
    0,
    Math.PI * 2
  );

  ctx.fillStyle = "#16a34a";
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Speaking indicator
  if (remoteAvatar.isSpeaking) {
    ctx.beginPath();
    ctx.arc(
      remoteAvatar.x,
      remoteAvatar.y,
      remoteAvatar.radius + 6,
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Teammate name
  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    remoteAvatar.name,
    remoteAvatar.x,
    remoteAvatar.y - 24
  );
}
    }

   

    let animationId;

    function gameLoop() {
      update();
      draw();
      animationId = requestAnimationFrame(gameLoop);
    }

           window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener('click', handleCanvasClick);

    gameLoop();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener('click', handleCanvasClick)
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

        
     <button
       onClick={() => setIsMuted(!isMuted)}
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
        {isMuted ? "🔇 Mic Muted" : "🎤 Mic On"}
     </button>

    </main>
  );
}

export default App;

