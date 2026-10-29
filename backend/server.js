const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");
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

// Redis clients
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const pubClient = createClient({
  url: redisUrl
});

const subClient = pubClient.duplicate();

// Redis error handling
pubClient.on("error", (err) => {
  console.error("Redis Pub Client Error:", err);
});

subClient.on("error", (err) => {
  console.error("Redis Sub Client Error:", err);
});

// Normal HTTP test route
app.get("/", (req, res) => {
  res.json({
    message: "ProxiSpeak Backend is running successfully!"
  });
});

// Socket.IO connection
io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("redis-test", (message) => {
        console.log("Redis test received:", message);

        io.emit("redis-test-response", {
            message,
            serverPort: PORT,
            fromSocket: socket.id
        });
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

// Start server after Redis connection
async function startServer() {
  try {
    await Promise.all([
      pubClient.connect(),
      subClient.connect()
    ]);

    io.adapter(createAdapter(pubClient, subClient));

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log("Redis adapter connected successfully");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();