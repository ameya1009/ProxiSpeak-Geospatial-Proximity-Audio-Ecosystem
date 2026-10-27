/**
 * ProxiSpeak Ecosystem - Geospatial Engine
 * Task M6: Query & Write-Rate Tuning (Position Write Batcher & Throttler)
 * 
 * Coalesces high-frequency client movement events (up to 60Hz) into micro-batches
 * (e.g. 50ms windows) using last-write-wins deduplication per avatar, preventing
 * database write saturation while guaranteeing low-latency position propagation.
 */

import { IPosition } from '../schema/position';
import { PositionRepository } from '../repository/positionRepo';

export interface BatcherConfig {
  flushIntervalMs: number; // Interval between DB flushes (default 50ms = 20Hz)
  maxBatchSize: number;    // Max queue depth before triggering immediate flush
  autoStart?: boolean;     // Whether to auto-start flush timer
}

export interface BatcherStats {
  totalIncoming: number;
  totalFlushed: number;
  totalCoalesced: number;
  coalescingEfficiencyPct: number;
  flushCount: number;
  avgBatchSize: number;
  lastFlushDurationMs: number;
}

export class PositionWriteBatcher {
  private repo: PositionRepository;
  private config: BatcherConfig;
  private pendingUpdates: Map<string, { userId: string; roomId: string; pos: [number, number]; timestamp: number }>;
  private timer: any = null;
  private stats: BatcherStats;

  constructor(repo: PositionRepository, config: Partial<BatcherConfig> = {}) {
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

    if (this.config.autoStart) {
      this.start();
    }
  }

  private getKey(roomId: string, userId: string): string {
    return `${roomId}:${userId}`;
  }

  /**
   * Enqueue a position update from a client websocket/event
   */
  queueUpdate(userId: string, roomId: string, pos: [number, number]): void {
    this.stats.totalIncoming++;
    const key = this.getKey(roomId, userId);

    // Overwrite previous update for this user in current window (coalescing)
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

  /**
   * Immediately flush all pending coalesced position writes
   */
  async flushNow(): Promise<number> {
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

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.flushNow();
    }, this.config.flushIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getPendingCount(): number {
    return this.pendingUpdates.size;
  }

  getStats(): BatcherStats {
    return { ...this.stats };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PositionWriteBatcher
  };
}
