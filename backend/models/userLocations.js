
/**
 * ProxiSpeak Redis Location Store
 * Shared 2D Cartesian coordinates (integer pixels).
 */

let redisClient = null;

const KEY_PREFIX = "proxispeak:locations:";

function configureLocationStore(client) {
    if (!client || !client.isReady) {
        throw new Error("A connected Redis client is required");
    }

    redisClient = client;
}

function ensureRedis() {
    if (!redisClient || !redisClient.isReady) {
        throw new Error("Redis location store is not connected");
    }
}

function validateLocation(userId, x, y, roomId) {
    if (
        typeof userId !== "string" ||
        !userId.trim() ||
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        typeof roomId !== "string" ||
        !roomId.trim()
    ) {
        throw new Error(
            "Valid userId, integer x/y and roomId are required"
        );
    }
}

function getKey(userId, roomId) {
    return (
        KEY_PREFIX +
        encodeURIComponent(roomId) +
        ":" +
        encodeURIComponent(userId)
    );
}

async function saveLocation(userId, x, y, roomId = "main-hall") {
    ensureRedis();
    validateLocation(userId, x, y, roomId);

    const record = {
        userId,
        roomId,
        x,
        y,
        updatedAt: Date.now()
    };

    await redisClient.set(
        getKey(userId, roomId),
        JSON.stringify(record)
    );

    return record;
}

async function getLocation(userId, roomId = "main-hall") {
    ensureRedis();

    const value = await redisClient.get(getKey(userId, roomId));

    return value ? JSON.parse(value) : null;
}


async function getAllLocations(roomId = null) {
    ensureRedis();

    const pattern = roomId
        ? `${KEY_PREFIX}${encodeURIComponent(roomId)}:*`
        : `${KEY_PREFIX}*`;

    const records = [];

    for await (const keys of redisClient.scanIterator({
        MATCH: pattern,
        COUNT: 100
    })) {
        for (const key of keys) {
            const value = await redisClient.get(key);

            if (value) {
                records.push(JSON.parse(value));
            }
        }
    }

    return records;
}


async function removeLocation(userId, roomId = "main-hall") {
    ensureRedis();

    return (await redisClient.del(getKey(userId, roomId))) > 0;
}

module.exports = {
    configureLocationStore,
    saveLocation,
    getLocation,
    getAllLocations,
    removeLocation
};
