
/**
 * ProxiSpeak Signaling Server
 * Backend owner: Abhishek
 *
 * Features:
 * - Express + Socket.IO
 * - Redis location storage
 * - Redis Socket.IO adapter
 * - 2D integer pixel coordinates
 * - 20 updates/second movement throttle
 * - Configurable world boundaries
 * - 100px proximity entry / 120px exit
 * - WebRTC signaling restricted to nearby peers
 * - Contract events and legacy test-client compatibility
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

const {
    configureLocationStore,
    saveLocation,
    removeLocation,
    getAllLocations
} = require("./models/userLocations");

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const PORT = Number(process.env.PORT) || 5000;

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
    throw new Error("REDIS_URL is missing from backend/.env");
}

const ENTER_RADIUS = 100;
const EXIT_RADIUS = 120;

// 50ms = maximum 20 movement updates per second.
const MOVEMENT_INTERVAL_MS = 50;
const SIGNALING_INTERVAL_MS = 100;
// World boundaries can be configured in .env.
const WORLD_WIDTH = Number(process.env.WORLD_WIDTH) || 2000;
const WORLD_HEIGHT = Number(process.env.WORLD_HEIGHT) || 2000;

if (
    !Number.isFinite(WORLD_WIDTH) ||
    !Number.isFinite(WORLD_HEIGHT) ||
    WORLD_WIDTH <= 0 ||
    WORLD_HEIGHT <= 0
) {
    throw new Error("Invalid WORLD_WIDTH or WORLD_HEIGHT");
}

// --------------------------------------------------
// EXPRESS AND HTTP
// --------------------------------------------------

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map(value => value.trim())
    : ["http://localhost:3000", "http://localhost:5173"];

const corsOptions = {
    origin(origin, callback) {
        // Allow requests without an Origin header, such as local scripts.
        if (!origin || allowedOrigins.includes("*") ||
            allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST"]
};

app.use(cors(corsOptions));

app.use((err, req, res, next) => {
    if (err.message === "Origin not allowed by CORS") {
        return res.status(403).json({
            success: false,
            message: "Origin not allowed"
        });
    }

    next(err);
});

app.use(express.json({ limit: "100kb" }));

const userRoutes = require("./routes/userRoutes");

app.use("/api/users", userRoutes);

const server = http.createServer(app);

// --------------------------------------------------
// REDIS CLIENTS
// --------------------------------------------------

const pubClient = createClient({
    url: REDIS_URL
});

const subClient = pubClient.duplicate();

pubClient.on("error", error => {
    console.error("Redis publisher error:", error);
});

subClient.on("error", error => {
    console.error("Redis subscriber error:", error);
});

// --------------------------------------------------
// SOCKET.IO
// --------------------------------------------------

const io = new Server(server, {
    cors: corsOptions,
    maxHttpBufferSize: 1e6,
    allowRequest: (req, callback) => {
        const origin = req.headers.origin;

        if (!origin || allowedOrigins.includes("*") ||
            allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback("Origin not allowed", false);
    }
});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "ProxiSpeak Signaling Server is running",
        redis: pubClient.isReady,
        world: {
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT
        }
    });
});

// --------------------------------------------------
// VALIDATION HELPERS
// --------------------------------------------------

function validString(value) {
    return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.length <= 128
    );
}

function validPosition(x, y) {
    return (
        Number.isInteger(x) &&
        Number.isInteger(y) &&
        x >= 0 &&
        y >= 0 &&
        x < WORLD_WIDTH &&
        y < WORLD_HEIGHT
    );
}

function acknowledge(ack, result) {
    if (typeof ack === "function") {
        ack(result);
    }
}

function getProximityKey(roomId) {
    return `proxispeak:proximity:${encodeURIComponent(roomId)}`;
}

function getPairMember(userA, userB) {
    const sorted = [userA, userB].sort();
    return JSON.stringify(sorted);
}

// --------------------------------------------------
// REDIS PROXIMITY HELPERS
// --------------------------------------------------

async function emitToUser(roomId, userId, event, data) {
    const peers = await io.in(roomId).fetchSockets();

    for (const peer of peers) {
        if (peer.data.userId === userId) {
            io.to(peer.id).emit(event, data);
        }
    }
}

async function cleanupUserProximity(roomId, userId) {
    const locations = await getAllLocations(roomId);
    const proximityKey = getProximityKey(roomId);

    for (const location of locations) {
        if (location.userId === userId) {
            continue;
        }

        const pairMember = getPairMember(
            userId,
            location.userId
        );

        const removed = await pubClient.sRem(
            proximityKey,
            pairMember
        );

        if (removed > 0) {
            await emitToUser(
                roomId,
                location.userId,
                "peer:leave",
                { peerId: userId }
            );
        }
    }
}

// --------------------------------------------------
// PROXIMITY ENGINE
// --------------------------------------------------

async function updateProximity(roomId) {
    const locations = await getAllLocations(roomId);

    const roomSockets = await io.in(roomId).fetchSockets();

    const activeUserIds = new Set(
        roomSockets.map(socket => socket.data.userId)
    );

    const proximityKey = getProximityKey(roomId);

    for (let i = 0; i < locations.length; i++) {
        for (let j = i + 1; j < locations.length; j++) {
            const a = locations[i];
            const b = locations[j];

            if (
                !activeUserIds.has(a.userId) ||
                !activeUserIds.has(b.userId)
            ) {
                continue;
            }

            if (a.userId === b.userId) {
                continue;
            }

            const distance = Math.hypot(
                a.x - b.x,
                a.y - b.y
            );

            const pairMember = getPairMember(
                a.userId,
                b.userId
            );

            const alreadyNearby = await pubClient.sIsMember(
                proximityKey,
                pairMember
            );

            // Enter proximity at 100 pixels or less.
            if (distance <= ENTER_RADIUS && !alreadyNearby) {
                await pubClient.sAdd(
                    proximityKey,
                    pairMember
                );

                await Promise.all([
                    emitToUser(roomId, a.userId, "peer:enter", {
                        peerId: b.userId,
                        x: b.x,
                        y: b.y
                    }),

                    emitToUser(roomId, b.userId, "peer:enter", {
                        peerId: a.userId,
                        x: a.x,
                        y: a.y
                    })
                ]);
            }

            // Exit proximity only beyond 120 pixels.
            else if (distance > EXIT_RADIUS && alreadyNearby) {
                await pubClient.sRem(
                    proximityKey,
                    pairMember
                );

                await Promise.all([
                    emitToUser(roomId, a.userId, "peer:leave", {
                        peerId: b.userId
                    }),

                    emitToUser(roomId, b.userId, "peer:leave", {
                        peerId: a.userId
                    })
                ]);
            }
        }
    }
}

// --------------------------------------------------
// ROOM CLEANUP
// --------------------------------------------------

async function leaveCurrentRoom(socket) {
    const { roomId, userId } = socket.data;

    if (!roomId || !userId) {
        return;
    }

    const peers = await io.in(roomId).fetchSockets();

    const anotherConnection = peers.some(peer =>
        peer.id !== socket.id &&
        peer.data.userId === userId
    );

    await socket.leave(roomId);

    if (!anotherConnection) {
        socket.to(roomId).emit("peer:left", { userId });

        // Legacy compatibility.
        socket.to(roomId).emit("user:left", {
            userId,
            peerId: socket.id
        });

        await cleanupUserProximity(roomId, userId);
        await removeLocation(userId, roomId);
    }

    socket.data.roomId = null;
    socket.data.userId = null;
    socket.data.username = null;
    socket.data.nearbyPeers = new Set();
}

// --------------------------------------------------
// JOIN ROOM
// --------------------------------------------------

async function handleJoin(socket, payload = {}, ack) {
    try {
        const {
            roomId,
            userId,
            username,
            initialPos
        } = payload;

        if (!validString(roomId) || !validString(userId)) {
            return acknowledge(ack, {
                success: false,
                message: "Valid roomId and userId are required"
            });
        }

        const position = initialPos || { x: 0, y: 0 };

        if (!validPosition(position.x, position.y)) {
            return acknowledge(ack, {
                success: false,
                message: "Invalid initial position or world boundary exceeded"
            });
        }

        if (socket.data.roomId) {
            await leaveCurrentRoom(socket);
        }

        socket.data.roomId = roomId;
        socket.data.userId = userId;
        socket.data.username = validString(username)
            ? username.trim()
            : userId;

        socket.data.lastMoveAt = 0;

        await socket.join(roomId);

        // Save initial position in Redis.
        await saveLocation(
            userId,
            position.x,
            position.y,
            roomId
        );

        // Initial room state snapshot.
        const locations = await getAllLocations(roomId);

        const users = locations.map(location => {
            const matchingSocket = null;

            return {
                userId: location.userId,
                username: location.userId === userId
                    ? socket.data.username
                    : location.userId,
                x: location.x,
                y: location.y
            };
        });

        socket.emit("state:snapshot", {
            roomId,
            users
        });

        // Legacy compatibility for the existing test-client.
        const peers = await io.in(roomId).fetchSockets();

        socket.emit("room:peers", {
            roomId,
            peers: peers
                .filter(peer => peer.id !== socket.id)
                .map(peer => ({
                    userId: peer.data.userId,
                    peerId: peer.id
                }))
        });

        await updateProximity(roomId);

        acknowledge(ack, {
            success: true,
            roomId,
            userId
        });

        console.log(`${userId} joined room ${roomId}`);

    } catch (error) {
        console.error("Room join error:", error);

        acknowledge(ack, {
            success: false,
            message: "Failed to join room"
        });
    }
}

// --------------------------------------------------
// MOVEMENT
// --------------------------------------------------

async function handleMove(socket, payload = {}, ack) {
    try {
        const { x, y } = payload;

        if (!socket.data.roomId || !socket.data.userId) {
            return acknowledge(ack, {
                success: false,
                message: "Join a room before moving"
            });
        }

        // Legacy payloads may contain roomId/userId.
        if (
            (payload.roomId &&
                payload.roomId !== socket.data.roomId) ||
            (payload.userId &&
                payload.userId !== socket.data.userId)
        ) {
            return acknowledge(ack, {
                success: false,
                message: "Room or user identity mismatch"
            });
        }

        if (!validPosition(x, y)) {
            return acknowledge(ack, {
                success: false,
                message: "Coordinates must be integers inside world boundaries"
            });
        }

        const now = Date.now();

        if (
            now - (socket.data.lastMoveAt || 0) <
            MOVEMENT_INTERVAL_MS
        ) {
            return acknowledge(ack, {
                success: false,
                message: "Movement rate limit exceeded"
            });
        }

        socket.data.lastMoveAt = now;

        const roomId = socket.data.roomId;
        const userId = socket.data.userId;

        const location = await saveLocation(
            userId,
            x,
            y,
            roomId
        );

        // Contract event.
        socket.to(roomId).emit("peer:moved", {
            userId,
            x: location.x,
            y: location.y
        });

        // Legacy compatibility.
        socket.to(roomId).emit("user:moved", {
            userId,
            peerId: socket.id,
            x: location.x,
            y: location.y,
            updatedAt: location.updatedAt
        });

        await updateProximity(roomId);

        acknowledge(ack, {
            success: true,
            data: location
        });

    } catch (error) {
        console.error("Movement error:", error);

        acknowledge(ack, {
            success: false,
            message: "Movement update failed"
        });
    }
}

// --------------------------------------------------
// WEBRTC SIGNALING
// --------------------------------------------------

async function relaySignal(socket, targetUserId, type, data, ack) {
    try {
        const roomId = socket.data.roomId;
        const senderUserId = socket.data.userId;
const now = Date.now();

if (
    now - (socket.data.lastSignalAt || 0) <
    SIGNALING_INTERVAL_MS
) {
    return acknowledge(ack, {
        success: false,
        message: "Signaling rate limit exceeded"
    });
}

socket.data.lastSignalAt = now;
        if (!roomId || !senderUserId || !validString(targetUserId)) {
            return acknowledge(ack, {
                success: false,
                message: "Join a room and provide a valid target userId"
            });
        }

        const validTypes = [
            "offer",
            "answer",
            "ice-candidate"
        ];

        if (!validTypes.includes(type) || !data) {
            return acknowledge(ack, {
                success: false,
                message: "Invalid signaling type or data"
            });
        }

        if (targetUserId === senderUserId) {
            return acknowledge(ack, {
                success: false,
                message: "Cannot signal yourself"
            });
        }

        const pairMember = getPairMember(
            senderUserId,
            targetUserId
        );

        const isNearby = await pubClient.sIsMember(
            getProximityKey(roomId),
            pairMember
        );

        if (!isNearby) {
            return acknowledge(ack, {
                success: false,
                message: "Peer is outside the audio proximity range"
            });
        }

        const peers = await io.in(roomId).fetchSockets();

        const targets = peers.filter(peer =>
            peer.data.userId === targetUserId
        );

        if (targets.length === 0) {
            return acknowledge(ack, {
                success: false,
                message: "Target peer is not in this room"
            });
        }

        const message = {
            from: senderUserId,
            type,
            data
        };

        for (const target of targets) {
            io.to(target.id).emit("signal", message);
        }

        acknowledge(ack, { success: true });

    } catch (error) {
        console.error("WebRTC signaling error:", error);

        acknowledge(ack, {
            success: false,
            message: "Signaling relay failed"
        });
    }
}

// --------------------------------------------------
// SOCKET CONNECTION
// --------------------------------------------------

io.on("connection", socket => {
    console.log("Client connected:", socket.id);

    // Contract event.
    socket.on("join", (payload, ack) => {
        handleJoin(socket, payload, ack);
    });

    // Legacy join event.
    socket.on("room:join", (payload, ack) => {
        handleJoin(socket, payload, ack);
    });

    // Contract movement event.
    socket.on("move", (payload, ack) => {
        handleMove(socket, payload, ack);
    });

    // Legacy movement event.
    socket.on("user:move", (payload, ack) => {
        handleMove(socket, payload, ack);
    });

    // Contract WebRTC signaling event.
    socket.on("signal", (payload = {}, ack) => {
        relaySignal(
            socket,
            payload.to,
            payload.type,
            payload.data,
            ack
        );
    });

    // Legacy offer event.
    socket.on("signal:offer", (payload = {}, ack) => {
        relayLegacySignal(socket, payload, "offer", ack);
    });

    // Legacy answer event.
    socket.on("signal:answer", (payload = {}, ack) => {
        relayLegacySignal(socket, payload, "answer", ack);
    });

    // Legacy ICE event.
    socket.on("signal:ice-candidate", (payload = {}, ack) => {
        relayLegacySignal(socket, payload, "ice-candidate", ack);
    });

    // Disconnect cleanup.
    socket.on("disconnect", async () => {
        try {
            await leaveCurrentRoom(socket);
        } catch (error) {
            console.error("Disconnect cleanup error:", error);
        }

        console.log("Client disconnected:", socket.id);
    });
});

// --------------------------------------------------
// LEGACY WEBRTC COMPATIBILITY
// --------------------------------------------------

async function relayLegacySignal(socket, payload, type, ack) {
        const now = Date.now();

    if (
        now - (socket.data.lastSignalAt || 0) <
        SIGNALING_INTERVAL_MS
    ) {
        return acknowledge(ack, {
            success: false,
            message: "Signaling rate limit exceeded"
        });
    }

    socket.data.lastSignalAt = now;
    try {
        const { targetPeerId, sdp, candidate } = payload;

        const roomId = socket.data.roomId;

        if (!roomId || !targetPeerId) {
            return acknowledge(ack, {
                success: false,
                message: "Join a room and provide a target peer"
            });
        }

        const peers = await io.in(roomId).fetchSockets();

        const target = peers.find(peer =>
            peer.id === targetPeerId ||
            peer.data.userId === targetPeerId
        );

        if (!target || target.data.userId === socket.data.userId) {
            return acknowledge(ack, {
                success: false,
                message: "Target peer not found"
            });
        }

        const data = type === "ice-candidate"
            ? candidate
            : sdp;

        if (!data) {
            return acknowledge(ack, {
                success: false,
                message: "Signaling data is required"
            });
        }

        const nearby = await pubClient.sIsMember(
            getProximityKey(roomId),
            getPairMember(
                socket.data.userId,
                target.data.userId
            )
        );

        if (!nearby) {
            return acknowledge(ack, {
                success: false,
                message: "Peer is outside the audio proximity range"
            });
        }

        const eventName = type === "ice-candidate"
            ? "signal:ice-candidate"
            : `signal:${type}`;

        io.to(target.id).emit(eventName, {
            fromPeerId: socket.id,
            fromUserId: socket.data.userId,
            ...(type === "ice-candidate"
                ? { candidate: data }
                : { sdp: data })
        });

        acknowledge(ack, { success: true });

    } catch (error) {
        console.error("Legacy signaling error:", error);

        acknowledge(ack, {
            success: false,
            message: "Legacy signaling failed"
        });
    }
}

// --------------------------------------------------
// SERVER STARTUP
// --------------------------------------------------

async function startServer() {
    try {
        console.log("Connecting to Redis...");

        await Promise.all([
            pubClient.connect(),
            subClient.connect()
        ]);

        // Connect the Redis location model.
        configureLocationStore(pubClient);

        // Enable cross-instance Socket.IO communication.
        io.adapter(createAdapter(pubClient, subClient));

        await new Promise((resolve, reject) => {
            server.once("error", reject);

            server.listen(PORT, () => {
                server.removeListener("error", reject);
                resolve();
            });
        });

        console.log("----------------------------------");
        console.log("ProxiSpeak Signaling Server started");
        console.log(`HTTP: http://localhost:${PORT}`);
        console.log("Redis location store: Connected");
        console.log("Redis Socket.IO adapter: Connected");
        console.log(`World: ${WORLD_WIDTH} x ${WORLD_HEIGHT}`);
        console.log(`Movement throttle: ${MOVEMENT_INTERVAL_MS}ms`);
        console.log(`Proximity: ${ENTER_RADIUS}px / ${EXIT_RADIUS}px`);
        console.log("----------------------------------");

    } catch (error) {
        console.error("Server startup failed:", error);

        await Promise.allSettled([
            pubClient.quit(),
            subClient.quit()
        ]);

        process.exitCode = 1;
    }
}

// --------------------------------------------------
// GRACEFUL SHUTDOWN
// --------------------------------------------------

let shuttingDown = false;

async function shutdown() {
    if (shuttingDown) return;

    shuttingDown = true;

    console.log("Shutting down ProxiSpeak server...");

    try {
        await new Promise(resolve => {
            io.close(() => resolve());
        });

        await Promise.allSettled([
            pubClient.quit(),
            subClient.quit()
        ]);

        console.log("Server shutdown complete.");

    } catch (error) {
        console.error("Shutdown error:", error);
    }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

// --------------------------------------------------
// START AND EXPORT
// --------------------------------------------------

if (require.main === module) {
    startServer();
}

module.exports = {
    app,
    server,
    io,
    startServer,
    updateProximity
};
