/**
 * ProxiSpeak Ecosystem - Geospatial Engine
 * Task M3: Proximity Clustering for Connected User Groups
 * 
 * Implements graph-based spatial connected components (BFS/DSU) to group
 * avatars into distinct conversation clusters based on earshot proximity.
 */

export interface UserPosition {
  userId: string;
  pos: [number, number];
  roomId?: string;
}

export interface SpatialCluster {
  clusterId: string;
  members: string[];
  size: number;
  centroid: [number, number];
  radius: number;
  isolated: boolean;
}

/**
 * Cluster avatars into connected components based on earshot threshold
 * @param positions List of user positions
 * @param earshotThreshold Distance threshold in pixels (default 100px)
 */
export function clusterUsersByProximity(
  positions: UserPosition[],
  earshotThreshold: number = 100
): SpatialCluster[] {
  if (!Array.isArray(positions) || positions.length === 0) {
    return [];
  }

  const n = positions.length;
  // Build adjacency list
  const adj: Map<number, number[]> = new Map();
  for (let i = 0; i < n; i++) {
    adj.set(i, []);
  }

  for (let i = 0; i < n; i++) {
    const [x1, y1] = positions[i].pos;
    for (let j = i + 1; j < n; j++) {
      const [x2, y2] = positions[j].pos;
      const dist = Math.hypot(x1 - x2, y1 - y2);
      if (dist <= earshotThreshold) {
        adj.get(i)!.push(j);
        adj.get(j)!.push(i);
      }
    }
  }

  const visited = new Uint8Array(n);
  const clusters: SpatialCluster[] = [];
  let clusterIdx = 0;

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;

    const componentIndices: number[] = [];
    const queue: number[] = [i];
    visited[i] = 1;

    while (queue.length > 0) {
      const u = queue.shift()!;
      componentIndices.push(u);

      for (const v of adj.get(u) || []) {
        if (!visited[v]) {
          visited[v] = 1;
          queue.push(v);
        }
      }
    }

    // Compute cluster metrics (centroid & bounding radius)
    let sumX = 0;
    let sumY = 0;
    const members: string[] = [];

    for (const idx of componentIndices) {
      const p = positions[idx];
      members.push(p.userId);
      sumX += p.pos[0];
      sumY += p.pos[1];
    }

    const count = componentIndices.length;
    const centroid: [number, number] = [
      Math.round((sumX / count) * 100) / 100,
      Math.round((sumY / count) * 100) / 100
    ];

    let maxDist = 0;
    for (const idx of componentIndices) {
      const p = positions[idx];
      const d = Math.hypot(p.pos[0] - centroid[0], p.pos[1] - centroid[1]);
      if (d > maxDist) maxDist = d;
    }

    clusters.push({
      clusterId: `cluster_${clusterIdx++}`,
      members,
      size: count,
      centroid,
      radius: Math.round(maxDist * 100) / 100,
      isolated: count === 1
    });
  }

  return clusters;
}

/**
 * Filter clusters to only those with 2 or more participants (active conversation circles)
 */
export function getActiveConversations(clusters: SpatialCluster[]): SpatialCluster[] {
  return clusters.filter(c => !c.isolated);
}

/**
 * Find the cluster containing a given user
 */
export function findUserCluster(userId: string, clusters: SpatialCluster[]): SpatialCluster | null {
  for (const c of clusters) {
    if (c.members.includes(userId)) {
      return c;
    }
  }
  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    clusterUsersByProximity,
    getActiveConversations,
    findUserCluster
  };
}
