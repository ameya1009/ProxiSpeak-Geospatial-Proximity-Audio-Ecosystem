/**
 * ProxiSpeak Ecosystem - Geospatial Engine
 * Task M2: Position Repository
 * 
 * Implements upsertPosition, removePosition, nearby ($near), withinCircle ($geoWithin)
 * with both native MongoDB query wrappers and high-performance in-memory fallback.
 */

import { IPosition, validatePosition } from '../schema/position';

export interface NearbyResult {
  userId: string;
  roomId: string;
  pos: [number, number];
  distance: number;
  updatedAt: Date;
}

export class PositionRepository {
  private collection: any | null = null;
  // High-performance in-memory storage: key is `${roomId}:${userId}`
  private inMemoryStore: Map<string, IPosition> = new Map();

  /**
   * @param mongoCollection Optional MongoDB Native or Mongoose collection
   */
  constructor(mongoCollection: any = null) {
    this.collection = mongoCollection;
  }

  private getKey(roomId: string, userId: string): string {
    return `${roomId}:${userId}`;
  }

  /**
   * Upsert user position
   */
  async upsertPosition(userId: string, roomId: string, pos: [number, number]): Promise<IPosition> {
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

    // Always update in-memory cache
    this.inMemoryStore.set(this.getKey(record.roomId, record.userId), record);
    return record;
  }

  /**
   * Remove user position
   */
  async removePosition(userId: string, roomId: string): Promise<boolean> {
    if (this.collection && typeof this.collection.deleteOne === 'function') {
      await this.collection.deleteOne({ userId, roomId });
    }
    return this.inMemoryStore.delete(this.getKey(roomId, userId));
  }

  /**
   * Get specific user position
   */
  async getPosition(userId: string, roomId: string): Promise<IPosition | null> {
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

  /**
   * Execute $near query: Find nearest peers sorted by Euclidean distance
   * @param roomId Target room
   * @param center [x, y] coordinates
   * @param maxDistance Maximum distance in pixels
   * @param limit Max number of results
   * @param excludeUserId Optional userId to omit (e.g. self)
   */
  async nearby(
    roomId: string,
    center: [number, number],
    maxDistance: number = 100,
    limit: number = 20,
    excludeUserId?: string
  ): Promise<NearbyResult[]> {
    if (this.collection && typeof this.collection.find === 'function') {
      try {
        const query: any = {
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
        return docs.map((d: any) => ({
          userId: d.userId,
          roomId: d.roomId,
          pos: d.pos,
          distance: Math.hypot(d.pos[0] - center[0], d.pos[1] - center[1]),
          updatedAt: d.updatedAt
        }));
      } catch (err) {
        // Fallback to in-memory evaluation if DB query fails or unindexed
      }
    }

    // In-memory Euclidean $near implementation
    const results: NearbyResult[] = [];
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

    // Sort ascending by distance (same behavior as MongoDB $near)
    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, limit);
  }

  /**
   * Execute $geoWithin query: Find all peers within circle radius
   * @param roomId Target room
   * @param center [x, y] coordinates
   * @param radius Circle radius in pixels
   * @param limit Max results
   */
  async withinCircle(
    roomId: string,
    center: [number, number],
    radius: number = 100,
    limit: number = 50
  ): Promise<IPosition[]> {
    if (this.collection && typeof this.collection.find === 'function') {
      try {
        const query: any = {
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

    // In-memory $geoWithin implementation
    const results: IPosition[] = [];
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

  /**
   * Return internal store map (useful for TTL sweeper)
   */
  getStoreMap(): Map<string, IPosition> {
    return this.inMemoryStore;
  }

  /**
   * Total count of positions in a room
   */
  async count(roomId?: string): Promise<number> {
    if (!roomId) return this.inMemoryStore.size;
    let cnt = 0;
    for (const record of this.inMemoryStore.values()) {
      if (record.roomId === roomId) cnt++;
    }
    return cnt;
  }

  /**
   * Clear all records
   */
  clear(): void {
    this.inMemoryStore.clear();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PositionRepository
  };
}
