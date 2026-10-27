/**
 * ProxiSpeak Ecosystem - Geospatial Engine
 * Task M7: Rooms Collection Schema & Obstacle Definitions
 * (Transferred to & Maintained by Ameya on Ameya's-branch)
 * 
 * Defines schema and validators for virtual office rooms, dimensions,
 * acoustic wall parameters, and obstacle bounding boxes (AABBs).
 */

export interface ObstacleAABB {
  id: string;
  name: string;
  x: number;      // Min X (pixels)
  y: number;      // Min Y (pixels)
  width: number;  // Width (pixels)
  height: number; // Height (pixels)
  type: 'desk' | 'wall' | 'partition' | 'pillar';
  acousticAttenuationDb?: number; // Decibels of audio reduction (default: 6dB - 12dB)
  occlusionFactor?: number;       // High-frequency cutoff dampening [0.0 - 1.0]
}

export interface IRoom {
  roomId: string;
  name: string;
  size: {
    width: number;
    height: number;
  };
  maxUsers: number;
  earshotRadius: number; // Default 100px
  hysteresisBuffer: number; // Default 20px (leave at 120px)
  obstacles: ObstacleAABB[];
  createdAt: Date;
  updatedAt: Date;
}

export const RoomIndexDefinitions = [
  {
    fields: { roomId: 1 },
    options: { unique: true, name: 'idx_unique_room_id' }
  }
];

export function validateRoom(data: any): { valid: boolean; error?: string; normalized?: IRoom } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Room data must be an object' };
  }

  const { roomId, name, size } = data;

  if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0) {
    return { valid: false, error: 'roomId must be a non-empty string' };
  }

  if (!size || typeof size.width !== 'number' || typeof size.height !== 'number') {
    return { valid: false, error: 'size must contain width and height numbers' };
  }

  if (size.width <= 0 || size.height <= 0) {
    return { valid: false, error: 'size dimensions must be strictly positive' };
  }

  const obstacles: ObstacleAABB[] = Array.isArray(data.obstacles) ? data.obstacles : [];
  for (const obs of obstacles) {
    if (!obs.id || typeof obs.x !== 'number' || typeof obs.y !== 'number' || typeof obs.width !== 'number' || typeof obs.height !== 'number') {
      return { valid: false, error: `Invalid obstacle definition in room: ${JSON.stringify(obs)}` };
    }
  }

  const now = new Date();
  return {
    valid: true,
    normalized: {
      roomId: roomId.trim(),
      name: (name && typeof name === 'string') ? name.trim() : roomId.trim(),
      size: { width: size.width, height: size.height },
      maxUsers: typeof data.maxUsers === 'number' ? data.maxUsers : 50,
      earshotRadius: typeof data.earshotRadius === 'number' ? data.earshotRadius : 100,
      hysteresisBuffer: typeof data.hysteresisBuffer === 'number' ? data.hysteresisBuffer : 20,
      obstacles: obstacles.map(obs => ({
        id: obs.id,
        name: obs.name || obs.id,
        x: obs.x,
        y: obs.y,
        width: obs.width,
        height: obs.height,
        type: obs.type || 'desk',
        acousticAttenuationDb: obs.acousticAttenuationDb !== undefined ? obs.acousticAttenuationDb : 6.0,
        occlusionFactor: obs.occlusionFactor !== undefined ? obs.occlusionFactor : 0.5
      })),
      createdAt: data.createdAt instanceof Date ? data.createdAt : now,
      updatedAt: data.updatedAt instanceof Date ? data.updatedAt : now
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RoomIndexDefinitions,
    validateRoom
  };
}
