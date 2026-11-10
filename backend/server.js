/**
 * ProxiSpeak Ecosystem - Backend & WebRTC Signaling Server
 * Branch: Abhishek-backend / Integrated
 *
 * Implements:
 * - Express HTTP API (/api/users/location & /api/users/locations)
 * - Socket.IO real-time WebRTC signaling (offer/answer/ICE exchange)
 * - Proximity movement broadcasting (peer:move, peer:join, peer:leave)
 */

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { saveLocation, removeLocation, getAllLocations } = require("./models/userLocations");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const userRoutes = require("./routes/userRoutes");
app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Normal HTTP health check route
app.get("/", (req, res) => {
  res.json({
    message: "ProxiSpeak Backend & Signaling Server is running successfully!",
    activeUsers: getAllLocations().length
  });
});

// Socket.IO signaling & proximity movement
io.on("connection", (socket) => {
  console.log("[Signaling] Client connected:", socket.id);

  // 1. Join room
  socket.on("join-room", ({ roomId = "default-office", userId }) => {
    socket.roomId = roomId;
    socket.userId = userId || socket.id;
    socket.join(roomId);

    console.log(`[Signaling] User '${socket.userId}' joined room '${roomId}'`);

    // Notify others in room
    socket.to(roomId).emit("peer:join", {
      peerId: socket.userId,
      socketId: socket.id
    });

    // Send existing peers in room to the newly joined client
    const existingPeers = getAllLocations(roomId);
    socket.emit("room:peers", { peers: existingPeers });
  });

  // 2. Real-time avatar movement broadcast
  socket.on("location:update", ({ x, y, roomId }) => {
    const targetRoom = roomId || socket.roomId || "default-office";
    if (socket.userId && x !== undefined && y !== undefined) {
      const record = saveLocation(socket.userId, x, y, targetRoom);
      socket.to(targetRoom).emit("peer:move", {
        peerId: socket.userId,
        x: record.x,
        y: record.y,
        updatedAt: record.updatedAt
      });
    }
  });

  // 3. WebRTC Offer / Answer / ICE Candidate exchange
  socket.on("webrtc:offer", ({ toSocketId, toUserId, offer }) => {
    const payload = {
      fromSocketId: socket.id,
      fromUserId: socket.userId,
      offer
    };
    if (toSocketId) {
      io.to(toSocketId).emit("webrtc:offer", payload);
    } else {
      socket.to(socket.roomId || "default-office").emit("webrtc:offer", payload);
    }
  });

  socket.on("webrtc:answer", ({ toSocketId, answer }) => {
    io.to(toSocketId).emit("webrtc:answer", {
      fromSocketId: socket.id,
      fromUserId: socket.userId,
      answer
    });
  });

  socket.on("webrtc:ice-candidate", ({ toSocketId, candidate }) => {
    io.to(toSocketId).emit("webrtc:ice-candidate", {
      fromSocketId: socket.id,
      fromUserId: socket.userId,
      candidate
    });
  });

  // 4. Disconnection cleanup
  socket.on("disconnect", () => {
    console.log("[Signaling] Client disconnected:", socket.id);
    if (socket.userId) {
      removeLocation(socket.userId);
      if (socket.roomId) {
        socket.to(socket.roomId).emit("peer:leave", {
          peerId: socket.userId,
          socketId: socket.id
        });
      }
    }
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = { app, server, io };
