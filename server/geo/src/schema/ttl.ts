/**
 * ProxiSpeak Ecosystem - Geospatial Engine
 * Task M5: TTL Index on updatedAt for Automatic Ghost Cleanup
 * 
 * Defines TTL index definitions and ghost avatar eviction logic for avatars that
 * disconnected or stopped sending movement/heartbeat updates.
 */

export interface TTLConfig {
  expireAfterSeconds: number; // Default: 30 seconds
  fieldName: string;          // Default: 'updatedAt'
  sweepIntervalMs?: number;   // In-memory polling interval (e.g. 5000ms)
}

export const DefaultTTLConfig: TTLConfig = {
  expireAfterSeconds: 30,
  fieldName: 'updatedAt',
  sweepIntervalMs: 5000
};

/**
 * MongoDB TTL Index Specification for Collection Setup
 */
export const TTLIndexDefinition = {
  fields: { updatedAt: 1 },
  options: {
    name: 'idx_ttl_updatedAt',
    expireAfterSeconds: DefaultTTLConfig.expireAfterSeconds
  }
};

/**
 * GhostAvatarSweeper
 * Provides automated background eviction for ghost avatars in environments
 * running either standalone in-memory or with persistent MongoDB.
 */
export class GhostAvatarSweeper {
  private config: TTLConfig;
  private timer: any = null;
  private onEvictCallback?: (evictedUserIds: string[]) => void;

  constructor(config: Partial<TTLConfig> = {}, onEvict?: (evictedUserIds: string[]) => void) {
    this.config = { ...DefaultTTLConfig, ...config };
    this.onEvictCallback = onEvict;
  }

  /**
   * Check which avatars have expired given a cutoff timestamp
   * @param positions Array or Map of positions
   * @param now Current timestamp in ms
   */
  sweepInMemory(positions: Map<string, { userId: string; updatedAt: Date }>, now: number = Date.now()): string[] {
    const cutoff = now - (this.config.expireAfterSeconds * 1000);
    const evicted: string[] = [];

    for (const [key, record] of positions.entries()) {
      const updatedMs = record.updatedAt instanceof Date ? record.updatedAt.getTime() : new Date(record.updatedAt).getTime();
      if (updatedMs < cutoff) {
        evicted.push(record.userId);
        positions.delete(key);
      }
    }

    if (evicted.length > 0 && this.onEvictCallback) {
      this.onEvictCallback(evicted);
    }

    return evicted;
  }

  /**
   * Start periodic background sweeper
   */
  start(positionsMap: Map<string, any>): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.sweepInMemory(positionsMap);
    }, this.config.sweepIntervalMs || 5000);
  }

  /**
   * Stop periodic sweeper
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getTTLSeconds(): number {
    return this.config.expireAfterSeconds;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DefaultTTLConfig,
    TTLIndexDefinition,
    GhostAvatarSweeper
  };
}
