/**
 * ProxiSpeak Ecosystem - Geospatial Engine
 * Task M1: MongoDB 2D Index Schema for User Positions
 * 
 * Defines schema, TypeScript interfaces, and MongoDB collection index specifications
 * for planar 2D avatar coordinates { userId, roomId, pos: [x, y], updatedAt }.
 */

export interface IPosition {
  userId: string;
  roomId: string;
  pos: [number, number]; // [x, y] Euclidean planar coordinates
  updatedAt: Date;
}

export interface PositionValidationResult {
  valid: boolean;
  error?: string;
  normalized?: IPosition;
}

/**
 * MongoDB 2D Planar Index Specification
 * Uses '2d' index for Cartesian Euclidean space (Canvas pixels), NOT '2dsphere' (Earth spherical).
 */
export const PositionIndexDefinitions = [
  {
    fields: { pos: '2d', roomId: 1 },
    options: {
      name: 'idx_pos_2d_roomId',
      min: -10000,
      max: 10000,
      bits: 26
    }
  },
  {
    fields: { userId: 1, roomId: 1 },
    options: {
      name: 'idx_unique_user_room',
      unique: true
    }
  }
];

/**
 * Validates and normalizes raw position payloads from client/websocket
 * @param data - Raw position object
 */
export function validatePosition(data: any): PositionValidationResult {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Position data must be a non-null object' };
  }

  const { userId, roomId, pos } = data;

  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return { valid: false, error: 'userId must be a non-empty string' };
  }

  if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0) {
    return { valid: false, error: 'roomId must be a non-empty string' };
  }

  if (!Array.isArray(pos) || pos.length !== 2) {
    return { valid: false, error: 'pos must be a 2-element array [x, y]' };
  }

  const [x, y] = pos;
  if (typeof x !== 'number' || isNaN(x) || !isFinite(x)) {
    return { valid: false, error: 'pos[0] (x-coordinate) must be a finite number' };
  }

  if (typeof y !== 'number' || isNaN(y) || !isFinite(y)) {
    return { valid: false, error: 'pos[1] (y-coordinate) must be a finite number' };
  }

  const updatedAt = data.updatedAt instanceof Date ? data.updatedAt : new Date();

  return {
    valid: true,
    normalized: {
      userId: userId.trim(),
      roomId: roomId.trim(),
      pos: [x, y],
      updatedAt
    }
  };
}

// CommonJS export fallback for runtime compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PositionIndexDefinitions,
    validatePosition
  };
}
