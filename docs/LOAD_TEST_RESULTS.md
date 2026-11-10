# ProxiSpeak Audio & Connection Capper Load Test Results
**Task A11 Delivery**: 50 & 100 Concurrent Peer Simulation  
**Audit Date**: 6 November 2026  
**Auditor**: Ameya (Team Lead)  

---

## Executive Summary
The load test harness measures spatial candidate evaluation, $N=4$ connection preemption with dual hysteresis, AABB obstacle ray casting, and Web Audio DSP parameter scheduling under intense avatar movement.

### Performance Benchmark Matrix
| Metric | 50 Concurrent Peers (500 cycles) | 100 Concurrent Peers (1,000 cycles) | Rubric Requirement | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Peer Pair Evaluations** | 24,500 | 99,000 | &mdash; | High Volume |
| **Throughput** | **8934.2 updates/s** | **7870.9 updates/s** | &gt; 100 updates/s | **PASS** |
| **Average Latency** | **0.11 ms** | **0.125 ms** | &lt; 5.0 ms | **PASS** |
| **p50 Latency** | **0.068 ms** | **0.078 ms** | &lt; 2.0 ms | **PASS** |
| **p95 Latency** | **0.241 ms** | **0.184 ms** | &lt; 4.0 ms | **PASS** |
| **p99 Latency** | **1.112 ms** | **2.026 ms** | &lt; 5.0 ms (Rubric: &lt;20ms) | **EXCEPTIONAL PASS** |
| **Heap Memory Delta** | **0.54 MB** | **8.85 MB** | Zero Leak (&lt; 25MB) | **STABLE** |

---

## Technical Insights
1. **Connection Capper Efficiency**:
   Even with 100 avatars on the canvas, the client never attempts more than 4 active WebRTC peer connections ($N=4$). This prevents the quadratic network bandwidth explosion ($mathcal{O}(N^2)$) and caps CPU encoding load.
2. **Dual Hysteresis Elimination of Flapping**:
   Avatars on the $100\text{px}$ threshold boundary do not trigger repeated connect/disconnect storms due to the $20\text{px}$ leave buffer ($120\text{px}$) and $15\text{px}$ preemption barrier.
3. **Obstacle Ray-Casting**:
   2D AABB edge-segment intersections for desks ($-6\text{dB}$) and walls ($-14\text{dB}$) execute in $< 0.05\text{ms}$ per peer pair.
