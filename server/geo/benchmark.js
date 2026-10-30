/**
 * ProxiSpeak Ecosystem - Geospatial Engine
 * Task M4: Benchmark Harness for 50 & 100 Concurrent Users (JavaScript Runtime)
 */

const { PositionRepository } = require('./src/repository/positionRepo');

function computePercentile(sortedValues, percentile) {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return Math.round(sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))] * 1000) / 1000;
}

async function runGeospatialBenchmark(options = {}) {
  const userCounts = options.userCounts || [50, 100];
  const queriesPerUser = options.queriesPerUser || 10;
  const earshotRadius = options.earshotRadius || 100;

  const results = [];
  const roomId = 'benchmark-room-alpha';

  for (const count of userCounts) {
    const repo = new PositionRepository();
    const latencies = [];

    // Seed initial avatar positions across a 1200x800 canvas
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

    // Perform concurrent spatial queries (nearby and withinCircle)
    const totalQueries = count * queriesPerUser;
    for (let q = 0; q < totalQueries; q++) {
      const targetUserIdx = Math.floor(Math.random() * count);
      const targetUserId = `user_${targetUserIdx}`;
      const posRecord = await repo.getPosition(targetUserId, roomId);
      const center = posRecord ? posRecord.pos : [Math.random() * 1200, Math.random() * 800];

      const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      
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

if (require.main === module) {
  (async () => {
    console.log('='.repeat(70));
    console.log('  PROXISPEAK GEOSPATIAL ENGINE BENCHMARK (50 & 100 USERS)');
    console.log('='.repeat(70));
    const report = await runGeospatialBenchmark();
    console.table(report.results.map(r => ({
      Users: r.userCount,
      Queries: r.iterations,
      'Avg (ms)': r.avgMs,
      'p50 (ms)': r.p50Ms,
      'p95 (ms)': r.p95Ms,
      'p99 (ms)': r.p99Ms,
      'Target (<20ms)': r.passed ? 'PASSED ✅' : 'FAILED ❌'
    })));
    console.log(`\nOverall Benchmark Result: ${report.allPassed ? 'ALL TESTS PASSED ✅' : 'FAIL ❌'}`);
  })();
}

module.exports = {
  runGeospatialBenchmark
};
