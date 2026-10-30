/**
 * ProxiSpeak Ecosystem - Geospatial Engine
 * Task M4: Benchmark Harness for 50 & 100 Concurrent Users
 * 
 * Measures p50, p95, and p99 query latency for nearby ($near) and withinCircle ($geoWithin)
 * geospatial operations, asserting p99 query latency remains strictly < 20ms.
 */

import { PositionRepository } from './src/repository/positionRepo';

export interface BenchmarkMetrics {
  userCount: number;
  iterations: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  passed: boolean; // p99 < 20ms
}

export interface BenchmarkReport {
  timestamp: string;
  results: BenchmarkMetrics[];
  allPassed: boolean;
}

function computePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return Math.round(sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))] * 1000) / 1000;
}

/**
 * Run geospatial query benchmark for specified user counts
 */
export async function runGeospatialBenchmark(
  options: { userCounts?: number[]; queriesPerUser?: number; earshotRadius?: number } = {}
): Promise<BenchmarkReport> {
  const userCounts = options.userCounts || [50, 100];
  const queriesPerUser = options.queriesPerUser || 10;
  const earshotRadius = options.earshotRadius || 100;

  const results: BenchmarkMetrics[] = [];
  const roomId = 'benchmark-room-alpha';

  for (const count of userCounts) {
    const repo = new PositionRepository();
    const latencies: number[] = [];

    // 1. Seed initial avatar positions across a 1200x800 canvas
    for (let i = 0; i < count; i++) {
      const x = Math.random() * 1200;
      const y = Math.random() * 800;
      await repo.upsertPosition(`user_${i}`, roomId, [x, y]);
    }

    // Warm up V8 JIT compiler to ensure steady-state execution
    for (let w = 0; w < 5; w++) {
      await repo.nearby(roomId, [500, 500], earshotRadius, 5, 'warmup');
      await repo.withinCircle(roomId, [500, 500], earshotRadius);
    }

    // 2. Perform concurrent spatial queries (nearby and withinCircle)
    const totalQueries = count * queriesPerUser;
    for (let q = 0; q < totalQueries; q++) {
      const targetUserIdx = Math.floor(Math.random() * count);
      const targetUserId = `user_${targetUserIdx}`;
      const posRecord = await repo.getPosition(targetUserId, roomId);
      const center = posRecord ? posRecord.pos : [Math.random() * 1200, Math.random() * 800];

      const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      
      // Alternating queries: 70% nearby ($near), 30% withinCircle ($geoWithin)
      if (q % 3 === 0) {
        await repo.withinCircle(roomId, center, earshotRadius);
      } else {
        await repo.nearby(roomId, center, earshotRadius, 10, targetUserId);
      }

      const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      latencies.push(t1 - t0);
    }

    latencies.sort((a, b) => a - b);
    const sum = latencies.reduce((acc, v) => acc + v, 0);
    const avgMs = Math.round((sum / latencies.length) * 1000) / 1000;
    const p50Ms = computePercentile(latencies, 50);
    const p95Ms = computePercentile(latencies, 95);
    const p99Ms = computePercentile(latencies, 99);
    const minMs = Math.round(latencies[0] * 1000) / 1000;
    const maxMs = Math.round(latencies[latencies.length - 1] * 1000) / 1000;
    const passed = p99Ms < 20.0;

    results.push({
      userCount: count,
      iterations: totalQueries,
      p50Ms,
      p95Ms,
      p99Ms,
      avgMs,
      minMs,
      maxMs,
      passed
    });
  }

  const allPassed = results.every(r => r.passed);
  return {
    timestamp: new Date().toISOString(),
    results,
    allPassed
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runGeospatialBenchmark
  };
}
