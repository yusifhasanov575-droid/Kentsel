import {
  BUILDING_CATALOG,
  CityGrid,
  CityStats,
  GRID_SIZE,
  PlacedBuilding,
} from './types';

export function createEmptyGrid(): CityGrid {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => null),
  );
}

export function cloneGrid(grid: CityGrid): CityGrid {
  return grid.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function inBounds(gx: number, gz: number): boolean {
  return gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE;
}

export interface RoadNeighbors {
  n: boolean; // gz - 1
  e: boolean; // gx + 1
  s: boolean; // gz + 1
  w: boolean; // gx - 1
  mask: number; // N=1, E=2, S=4, W=8
}

export function getRoadNeighbors(
  grid: CityGrid,
  gx: number,
  gz: number,
): RoadNeighbors {
  const n = inBounds(gx, gz - 1) && grid[gz - 1][gx]?.type === 'road';
  const e = inBounds(gx + 1, gz) && grid[gz][gx + 1]?.type === 'road';
  const s = inBounds(gx, gz + 1) && grid[gz + 1][gx]?.type === 'road';
  const w = inBounds(gx - 1, gz) && grid[gz][gx - 1]?.type === 'road';
  const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
  return { n, e, s, w, mask };
}

export function hasAdjacentRoad(
  grid: CityGrid,
  gx: number,
  gz: number,
): boolean {
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  return dirs.some(([dx, dz]) => {
    const nx = gx + dx;
    const nz = gz + dz;
    return inBounds(nx, nz) && grid[nz][nx]?.type === 'road';
  });
}

export function getBuildingEffectiveStats(b: PlacedBuilding) {
  const def = BUILDING_CATALOG[b.type];
  const mult = b.level > 1 ? 1.5 : 1;
  return {
    population: Math.round(def.population * mult),
    jobs: Math.round(def.jobs * mult),
    powerDelta: def.powerDelta < 0 ? Math.round(def.powerDelta * mult) : def.powerDelta,
    waterDelta: def.waterDelta < 0 ? Math.round(def.waterDelta * mult) : def.waterDelta,
    happinessImpact: def.happinessImpact,
    taxIncome: Math.round(def.taxIncome * mult),
  };
}

export function computeCityStats(grid: CityGrid): CityStats {
  let population = 0;
  let jobs = 0;
  let powerProduced = 0;
  let powerUsed = 0;
  let waterProduced = 0;
  let waterUsed = 0;
  let happinessRaw = 64;
  let netIncome = 0;
  let buildingCount = 0;
  let roadCount = 0;
  let unservedBuildings = 0;

  for (let gz = 0; gz < GRID_SIZE; gz++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const b = grid[gz][gx];
      if (!b) continue;

      if (b.type === 'road') {
        roadCount++;
        netIncome += BUILDING_CATALOG.road.taxIncome;
        continue;
      }

      buildingCount++;
      const eff = getBuildingEffectiveStats(b);
      population += eff.population;
      jobs += eff.jobs;

      if (eff.powerDelta >= 0) powerProduced += eff.powerDelta;
      else powerUsed += -eff.powerDelta;

      if (eff.waterDelta >= 0) waterProduced += eff.waterDelta;
      else waterUsed += -eff.waterDelta;

      happinessRaw += eff.happinessImpact;
      netIncome += eff.taxIncome;

      if (
        b.type !== 'forest' &&
        b.type !== 'wind_turbine' &&
        b.type !== 'water_tower' &&
        !hasAdjacentRoad(grid, gx, gz)
      ) {
        unservedBuildings++;
      }
    }
  }

  // Penalties for shortages
  if (powerUsed > powerProduced) {
    happinessRaw -= Math.min(25, Math.ceil((powerUsed - powerProduced) * 0.6));
  }
  if (waterUsed > waterProduced) {
    happinessRaw -= Math.min(25, Math.ceil((waterUsed - waterProduced) * 0.6));
  }
  if (unservedBuildings > 0) {
    happinessRaw -= Math.min(15, unservedBuildings * 2);
  }

  // Employment balance bonus
  if (population > 0 && jobs > 0) {
    const ratio = Math.min(jobs / population, population / jobs);
    happinessRaw += Math.round(ratio * 8);
  }

  const happiness = Math.max(5, Math.min(100, Math.round(happinessRaw)));

  return {
    population,
    jobs,
    powerProduced,
    powerUsed,
    waterProduced,
    waterUsed,
    happiness,
    netIncome,
    buildingCount,
    roadCount,
  };
}
