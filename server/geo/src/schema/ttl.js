/**
 * ProxiSpeak Ecosystem - Geospatial Engine
 * Task M5: TTL Index on updatedAt for Automatic Ghost Cleanup (JavaScript Runtime)
 */

const DefaultTTLConfig = {
  expireAfterSeconds: 30,
  fieldName: 'updatedAt',
  sweepIntervalMs: 5000
};

const TTLIndexDefinition = {
  fields: { updatedAt: 1 },
  options: {
    name: 'idx_ttl_updatedAt',
    expireAfterSeconds: DefaultTTLConfig.expireAfterSeconds
  }
};

class GhostAvatarSweeper {
  constructor(config = {}, onEvict) {
    this.config = { ...DefaultTTLConfig, ...config };
    this.onEvictCallback = onEvict;
    this.timer = null;
  }

  sweepInMemory(positions, now = Date.now()) {
    const cutoff = now - (this.config.expireAfterSeconds * 1000);
    const evicted = [];

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

  start(positionsMap) {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.sweepInMemory(positionsMap);
    }, this.config.sweepIntervalMs || 5000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getTTLSeconds() {
    return this.config.expireAfterSeconds;
  }
}

module.exports = {
  DefaultTTLConfig,
  TTLIndexDefinition,
  GhostAvatarSweeper
};
