/**
 * ProxiSpeak Ecosystem - Geospatial Engine
 * Task M6: Query & Write-Rate Tuning (Position Write Batcher & Throttler - JavaScript Runtime)
 */

class PositionWriteBatcher {
  constructor(repo, config = {}) {
    this.repo = repo;
    this.config = {
      flushIntervalMs: config.flushIntervalMs !== undefined ? config.flushIntervalMs : 50,
      maxBatchSize: config.maxBatchSize !== undefined ? config.maxBatchSize : 200,
      autoStart: config.autoStart !== undefined ? config.autoStart : true
    };

    this.pendingUpdates = new Map();
    this.stats = {
      totalIncoming: 0,
      totalFlushed: 0,
      totalCoalesced: 0,
      coalescingEfficiencyPct: 0,
      flushCount: 0,
      avgBatchSize: 0,
      lastFlushDurationMs: 0
    };

    this.timer = null;
    if (this.config.autoStart) {
      this.start();
    }
  }

  getKey(roomId, userId) {
    return `${roomId}:${userId}`;
  }

  queueUpdate(userId, roomId, pos) {
    this.stats.totalIncoming++;
    const key = this.getKey(roomId, userId);

    this.pendingUpdates.set(key, {
      userId,
      roomId,
      pos,
      timestamp: Date.now()
    });

    if (this.pendingUpdates.size >= this.config.maxBatchSize) {
      this.flushNow();
    }
  }

  async flushNow() {
    if (this.pendingUpdates.size === 0) return 0;

    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const batch = Array.from(this.pendingUpdates.values());
    this.pendingUpdates.clear();

    const batchSize = batch.length;
    for (const item of batch) {
      await this.repo.upsertPosition(item.userId, item.roomId, item.pos);
    }

    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    this.stats.lastFlushDurationMs = Math.round((t1 - t0) * 100) / 100;
    this.stats.totalFlushed += batchSize;
    this.stats.flushCount++;
    this.stats.totalCoalesced = Math.max(0, this.stats.totalIncoming - this.stats.totalFlushed);
    this.stats.coalescingEfficiencyPct = this.stats.totalIncoming > 0
      ? Math.round(((this.stats.totalCoalesced) / this.stats.totalIncoming) * 1000) / 10
      : 0;
    this.stats.avgBatchSize = Math.round((this.stats.totalFlushed / this.stats.flushCount) * 10) / 10;

    return batchSize;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.flushNow();
    }, this.config.flushIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getPendingCount() {
    return this.pendingUpdates.size;
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = {
  PositionWriteBatcher
};
