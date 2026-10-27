/**
 * ProxiSpeak Ecosystem - Geospatial Engine
 * Task M8: Room Repository & Obstacle Data Persistence (JavaScript Runtime)
 * (Transferred to & Maintained by Ameya on Ameya's-branch)
 */

const { validateRoom } = require('../schema/room');

class RoomRepository {
  constructor(mongoCollection = null) {
    this.collection = mongoCollection;
    this.inMemoryStore = new Map();
    this.seedDefaultRoom();
  }

  seedDefaultRoom() {
    const defaultObstacles = [
      { id: 'desk-1', name: 'Workstation 1', x: 100, y: 100, width: 120, height: 60, type: 'desk', acousticAttenuationDb: 6.0, occlusionFactor: 0.5 },
      { id: 'desk-2', name: 'Workstation 2', x: 260, y: 100, width: 120, height: 60, type: 'desk', acousticAttenuationDb: 6.0, occlusionFactor: 0.5 },
      { id: 'desk-3', name: 'Workstation 3', x: 420, y: 100, width: 120, height: 60, type: 'desk', acousticAttenuationDb: 6.0, occlusionFactor: 0.5 },
      { id: 'desk-4', name: 'Meeting Table 1', x: 160, y: 220, width: 160, height: 80, type: 'desk', acousticAttenuationDb: 8.0, occlusionFactor: 0.6 },
      { id: 'desk-5', name: 'Meeting Table 2', x: 360, y: 220, width: 160, height: 80, type: 'desk', acousticAttenuationDb: 8.0, occlusionFactor: 0.6 }
    ];

    const defaultRoom = {
      roomId: 'default-office',
      name: 'ProxiSpeak Virtual Headquarters',
      size: { width: 1200, height: 800 },
      maxUsers: 50,
      earshotRadius: 100,
      hysteresisBuffer: 20,
      obstacles: defaultObstacles,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.inMemoryStore.set(defaultRoom.roomId, defaultRoom);
  }

  async upsertRoom(roomData) {
    const validated = validateRoom(roomData);
    if (!validated.valid || !validated.normalized) {
      throw new Error(`Invalid room data: ${validated.error}`);
    }

    const room = validated.normalized;

    if (this.collection && typeof this.collection.updateOne === 'function') {
      await this.collection.updateOne(
        { roomId: room.roomId },
        { $set: room },
        { upsert: true }
      );
    }

    this.inMemoryStore.set(room.roomId, room);
    return room;
  }

  async getRoom(roomId) {
    if (this.inMemoryStore.has(roomId)) {
      return this.inMemoryStore.get(roomId) || null;
    }

    if (this.collection && typeof this.collection.findOne === 'function') {
      const doc = await this.collection.findOne({ roomId });
      if (doc) {
        this.inMemoryStore.set(roomId, doc);
        return doc;
      }
    }

    return null;
  }

  async listRooms() {
    if (this.collection && typeof this.collection.find === 'function') {
      const cursor = this.collection.find({});
      return await cursor.toArray();
    }
    return Array.from(this.inMemoryStore.values());
  }

  async getObstacles(roomId) {
    const room = await this.getRoom(roomId);
    return room ? room.obstacles : [];
  }

  async getObstaclesInRegion(roomId, region) {
    const obstacles = await this.getObstacles(roomId);
    return obstacles.filter(obs => {
      const obsMaxX = obs.x + obs.width;
      const obsMaxY = obs.y + obs.height;
      return (
        obs.x <= region.maxX &&
        obsMaxX >= region.minX &&
        obs.y <= region.maxY &&
        obsMaxY >= region.minY
      );
    });
  }

  async deleteRoom(roomId) {
    if (this.collection && typeof this.collection.deleteOne === 'function') {
      await this.collection.deleteOne({ roomId });
    }
    return this.inMemoryStore.delete(roomId);
  }

  clear() {
    this.inMemoryStore.clear();
  }
}

module.exports = {
  RoomRepository
};
