/**
 * ProxiSpeak Ecosystem - Geospatial Engine
 * Task M2: Position Repository (JavaScript Runtime)
 */

const { validatePosition } = require('../schema/position');

class PositionRepository {
  constructor(mongoCollection = null) {
    this.collection = mongoCollection;
    this.inMemoryStore = new Map();
  }

  getKey(roomId, userId) {
    return `${roomId}:${userId}`;
  }

  async upsertPosition(userId, roomId, pos) {
    const validated = validatePosition({ userId, roomId, pos });
    if (!validated.valid || !validated.normalized) {
      throw new Error(`Invalid position: ${validated.error}`);
    }

    const record = validated.normalized;

    if (this.collection && typeof this.collection.updateOne === 'function') {
      await this.collection.updateOne(
        { userId: record.userId, roomId: record.roomId },
        { $set: { pos: record.pos, updatedAt: record.updatedAt } },
        { upsert: true }
      );
    }

    this.inMemoryStore.set(this.getKey(record.roomId, record.userId), record);
    return record;
  }

  async removePosition(userId, roomId) {
    if (this.collection && typeof this.collection.deleteOne === 'function') {
      await this.collection.deleteOne({ userId, roomId });
    }
    return this.inMemoryStore.delete(this.getKey(roomId, userId));
  }

  async getPosition(userId, roomId) {
    const key = this.getKey(roomId, userId);
    if (this.inMemoryStore.has(key)) {
      return this.inMemoryStore.get(key) || null;
    }

    if (this.collection && typeof this.collection.findOne === 'function') {
      const doc = await this.collection.findOne({ userId, roomId });
      if (doc) {
        this.inMemoryStore.set(key, doc);
        return doc;
      }
    }
    return null;
  }

  async nearby(roomId, center, maxDistance = 100, limit = 20, excludeUserId) {
    if (this.collection && typeof this.collection.find === 'function') {
      try {
        const query = {
          roomId,
          pos: {
            $near: center,
            $maxDistance: maxDistance
          }
        };
        if (excludeUserId) {
          query.userId = { $ne: excludeUserId };
        }
        const cursor = this.collection.find(query).limit(limit);
        const docs = await cursor.toArray();
        return docs.map((d) => ({
          userId: d.userId,
          roomId: d.roomId,
          pos: d.pos,
          distance: Math.hypot(d.pos[0] - center[0], d.pos[1] - center[1]),
          updatedAt: d.updatedAt
        }));
      } catch (err) {
        // Fallback to in-memory evaluation
      }
    }

    const results = [];
    const [cx, cy] = center;

    for (const record of this.inMemoryStore.values()) {
      if (record.roomId !== roomId) continue;
      if (excludeUserId && record.userId === excludeUserId) continue;

      const [px, py] = record.pos;
      const distance = Math.hypot(px - cx, py - cy);

      if (distance <= maxDistance) {
        results.push({
          userId: record.userId,
          roomId: record.roomId,
          pos: record.pos,
          distance,
          updatedAt: record.updatedAt
        });
      }
    }

    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, limit);
  }

  async withinCircle(roomId, center, radius = 100, limit = 50) {
    if (this.collection && typeof this.collection.find === 'function') {
      try {
        const query = {
          roomId,
          pos: {
            $geoWithin: {
              $center: [center, radius]
            }
          }
        };
        const cursor = this.collection.find(query).limit(limit);
        return await cursor.toArray();
      } catch (err) {
        // Fallback to in-memory evaluation
      }
    }

    const results = [];
    const [cx, cy] = center;

    for (const record of this.inMemoryStore.values()) {
      if (record.roomId !== roomId) continue;
      const [px, py] = record.pos;
      const distance = Math.hypot(px - cx, py - cy);
      if (distance <= radius) {
        results.push(record);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  getStoreMap() {
    return this.inMemoryStore;
  }

  async count(roomId) {
    if (!roomId) return this.inMemoryStore.size;
    let cnt = 0;
    for (const record of this.inMemoryStore.values()) {
      if (record.roomId === roomId) cnt++;
    }
    return cnt;
  }

  clear() {
    this.inMemoryStore.clear();
  }
}

module.exports = {
  PositionRepository
};
