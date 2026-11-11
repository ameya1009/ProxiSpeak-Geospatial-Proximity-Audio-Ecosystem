
/**
 * ProxiSpeak Socket.IO Integration Tests
 * Tests movement, proximity hysteresis and WebRTC signaling.
 */

const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:5000";
const userA = io(SERVER_URL);
const userB = io(SERVER_URL);

function waitForEvent(socket, event, timeoutMs = 5000, filter = () => true) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(event, handler);
            reject(new Error(`${event} timeout`));
        }, timeoutMs);

        function handler(data) {
            if (!filter(data)) return;
            clearTimeout(timer);
            socket.off(event, handler);
            resolve(data);
        }

        socket.on(event, handler);
    });
}

function emitAck(socket, event, payload) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`${event} acknowledgement timeout`)),
            5000
        );

        socket.emit(event, payload, response => {
            clearTimeout(timer);
            resolve(response);
        });
    });
}

async function joinRoom(socket, userId) {
    const response = await emitAck(socket, "room:join", {
        roomId: "main-hall",
        userId
    });

    if (!response?.success) {
        throw new Error(response?.message || "Room join failed");
    }
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function moveUser(socket, userId, x, y) {
    await delay(100);

    const response = await emitAck(socket, "user:move", {
        roomId: "main-hall",
        userId,
        x,
        y
    });

    if (!response?.success) {
        throw new Error(response?.message || "Movement failed");
    }
}

async function sendSignal(
    sender,
    event,
    targetPeerId,
    payload
) {
    return emitAck(sender, event, {
        targetPeerId,
        ...payload
    });
}

async function runTests() {
    try {
        await Promise.all([
            new Promise((resolve, reject) => {
                userA.once("connect", resolve);
                userA.once("connect_error", reject);
            }),
            new Promise((resolve, reject) => {
                userB.once("connect", resolve);
                userB.once("connect_error", reject);
            })
        ]);

        console.log("PASS: Both clients connected");

        await joinRoom(userA, "user-A");
        await joinRoom(userB, "user-B");

        console.log("PASS: Both users joined main-hall");

        // Enter proximity at exactly 100 pixels.
await moveUser(userA, "user-A", 100, 100);

const peerEnterEvent = waitForEvent(userA, "peer:enter");

await moveUser(userB, "user-B", 200, 100);

await peerEnterEvent;
console.log("PASS: peer:enter event emitted");
        console.log("PASS: Movement accepted at 100-pixel distance");

        // Test offer.
        const offerReceived = waitForEvent(userB, "signal:offer");

        const offerAck = await sendSignal(
            userA,
            "signal:offer",
            userB.id,
            { sdp: { type: "offer", sdp: "test-offer" } }
        );

        if (!offerAck?.success) {
            throw new Error("Offer relay rejected");
        }

        await offerReceived;
        console.log("PASS: WebRTC offer relayed");

        // Test answer.
        const answerReceived = waitForEvent(userA, "signal:answer");

        const answerAck = await sendSignal(
            userB,
            "signal:answer",
            userA.id,
            { sdp: { type: "answer", sdp: "test-answer" } }
        );

        if (!answerAck?.success) {
            throw new Error("Answer relay rejected");
        }

        await answerReceived;
        console.log("PASS: WebRTC answer relayed");

        // Test ICE candidate.
        const iceReceived = waitForEvent(
            userB,
            "signal:ice-candidate"
        );

        const iceAck = await sendSignal(
            userA,
            "signal:ice-candidate",
            userB.id,
            {
                candidate: {
                    candidate: "candidate:test",
                    sdpMid: "0",
                    sdpMLineIndex: 0
                }
            }
        );

        if (!iceAck?.success) {
            throw new Error("ICE candidate relay rejected");
        }

        await iceReceived;
        console.log("PASS: ICE candidate relayed");

       // Move to 110 pixels: existing proximity should remain.
await moveUser(userB, "user-B", 210, 100);

const hysteresisAck = await sendSignal(
    userA,
    "signal:offer",
    userB.id,
    { sdp: { type: "offer", sdp: "hysteresis-test" } }
);

if (!hysteresisAck?.success) {
    throw new Error("Proximity was not retained at 110 pixels");
}

console.log("PASS: Proximity retained at 110 pixels");

// Move to 121 pixels: proximity should end.
const peerLeaveEvent = waitForEvent(userA, "peer:leave");

await moveUser(userB, "user-B", 221, 100);

await peerLeaveEvent;
console.log("PASS: peer:leave event emitted");

const blockedAck = await sendSignal(
    userA,
    "signal:offer",
    userB.id,
    { sdp: { type: "offer", sdp: "blocked-test" } }
);

if (blockedAck?.success) {
    throw new Error("Non-nearby signaling was not blocked");
}

console.log("PASS: Signaling blocked beyond 120 pixels");

        console.log("\nAll expanded integration tests passed!");

    } catch (error) {
        console.error("\nTEST FAILED:", error.message);
        process.exitCode = 1;
    } finally {
        userA.disconnect();
        userB.disconnect();
    }
}

runTests();
