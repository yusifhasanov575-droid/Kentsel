import { createEmptyGrid } from './simulation';
import { BuildingType, CityGrid, PlacedBuilding } from './types';

let uidCounter = 1;
export function nextBuildingId(): string {
  uidCounter += 1;
  return `b_${Date.now().toString(36)}_${uidCounter}`;
}

function put(
  grid: CityGrid,
  gx: number,
  gz: number,
  type: BuildingType,
  rotation = 0,
  variant = 0,
  level = 1,
) {
  const b: PlacedBuilding = {
    id: nextBuildingId(),
    type,
    gx,
    gz,
    rotation,
    variant,
    level,
    placedAt: 0,
  };
  grid[gz][gx] = b;
}

export function buildCoastalTownPreset(): CityGrid {
  const grid = createEmptyGrid();

  // Main avenue loop (creates lively continuous traffic)
  for (let x = 5; x <= 14; x++) {
    put(grid, x, 6, 'road');
    put(grid, x, 13, 'road');
  }
  for (let z = 6; z <= 13; z++) {
    put(grid, 5, z, 'road');
    put(grid, 10, z, 'road');
    put(grid, 14, z, 'road');
  }
  // Cross street
  for (let x = 5; x <= 14; x++) {
    put(grid, x, 9, 'road');
  }
  // Outer spur to wind & industry
  for (let x = 2; x <= 5; x++) put(grid, x, 9, 'road');
  for (let z = 4; z <= 6; z++) put(grid, 10, z, 'road');

  // Town center: Clock Tower & Parks
  put(grid, 8, 10, 'clock_tower', 0, 0, 1);
  put(grid, 7, 10, 'park', 0, 0, 1);
  put(grid, 9, 10, 'park', 1, 1, 1);

  // Commercial strip & Skyscrapers
  put(grid, 7, 8, 'shop', 2, 0, 1);
  put(grid, 8, 8, 'shop', 2, 1, 1);
  put(grid, 9, 8, 'skyscraper', 2, 0, 1);
  put(grid, 11, 8, 'skyscraper', 2, 1, 1);
  put(grid, 12, 8, 'shop', 2, 2, 1);
  put(grid, 11, 10, 'hospital', 0, 0, 1);
  put(grid, 12, 10, 'school', 0, 0, 1);

  // Residential neighborhoods
  put(grid, 6, 5, 'house', 2, 0, 1);
  put(grid, 7, 5, 'house', 2, 1, 1);
  put(grid, 8, 5, 'house', 2, 2, 1);
  put(grid, 9, 5, 'apartment', 2, 0, 1);
  put(grid, 11, 5, 'apartment', 2, 1, 1);
  put(grid, 12, 5, 'house', 2, 0, 1);
  put(grid, 13, 5, 'house', 2, 1, 1);

  put(grid, 6, 14, 'house', 0, 1, 1);
  put(grid, 7, 14, 'apartment', 0, 0, 1);
  put(grid, 8, 14, 'house', 0, 2, 1);
  put(grid, 9, 14, 'house', 0, 0, 1);
  put(grid, 11, 14, 'park', 0, 0, 1);
  put(grid, 12, 14, 'apartment', 0, 1, 1);
  put(grid, 13, 14, 'house', 0, 2, 1);

  put(grid, 6, 11, 'house', 1, 0, 1);
  put(grid, 6, 12, 'house', 1, 1, 1);
  put(grid, 15, 7, 'house', 3, 2, 1);
  put(grid, 15, 8, 'house', 3, 0, 1);
  put(grid, 15, 11, 'apartment', 3, 1, 1);

  // Utilities & Green Power
  put(grid, 2, 7, 'wind_turbine', 1, 0, 1);
  put(grid, 2, 11, 'wind_turbine', 1, 0, 1);
  put(grid, 3, 10, 'water_tower', 0, 0, 1);
  put(grid, 16, 4, 'wind_turbine', 3, 0, 1);

  // Small clean industrial corner
  put(grid, 3, 8, 'factory', 2, 0, 1);
  put(grid, 4, 8, 'factory', 2, 1, 1);

  // Natural Forest groves around perimeter
  const trees: [number, number][] = [
    [1, 2], [2, 2], [2, 3], [1, 4], [3, 2],
    [16, 2], [17, 2], [17, 3], [18, 4],
    [1, 15], [2, 16], [3, 17], [1, 17],
    [16, 16], [17, 15], [17, 16], [18, 17],
    [7, 11], [8, 12], [13, 11], [13, 12],
  ];
  trees.forEach(([x, z], idx) => {
    put(grid, x, z, 'forest', idx % 4, idx % 3, 1);
  });

  return grid;
}

export function buildMetropolisPreset(): CityGrid {
  const grid = createEmptyGrid();

  // Dense downtown grid avenues
  for (let x = 3; x <= 16; x++) {
    put(grid, x, 4, 'road');
    put(grid, x, 8, 'road');
    put(grid, x, 12, 'road');
    put(grid, x, 16, 'road');
  }
  for (let z = 4; z <= 16; z++) {
    put(grid, 3, z, 'road');
    put(grid, 7, z, 'road');
    put(grid, 12, z, 'road');
    put(grid, 16, z, 'road');
  }

  // Central Plaza
  put(grid, 9, 9, 'clock_tower', 0, 0, 1);
  put(grid, 10, 9, 'park', 0, 0, 1);
  put(grid, 9, 10, 'park', 1, 1, 1);
  put(grid, 10, 10, 'park', 2, 0, 1);
  put(grid, 8, 9, 'hospital', 0, 0, 1);
  put(grid, 11, 9, 'school', 0, 0, 1);

  // Skyscraper skyline
  const towers: [number, number][] = [
    [8, 7], [9, 7], [10, 7], [11, 7],
    [8, 11], [11, 11],
    [6, 7], [6, 9], [13, 7], [13, 9],
  ];
  towers.forEach(([x, z], i) => put(grid, x, z, 'skyscraper', i % 4, i % 3, 1));

  // Shops & Apartments
  for (let x = 4; x <= 6; x++) {
    put(grid, x, 5, 'apartment', 2, x % 3, 1);
    put(grid, x, 13, 'apartment', 0, x % 3, 1);
  }
  for (let x = 13; x <= 15; x++) {
    put(grid, x, 5, 'apartment', 2, x % 3, 1);
    put(grid, x, 13, 'shop', 0, x % 3, 1);
  }
  for (let x = 8; x <= 11; x++) {
    put(grid, x, 5, 'shop', 2, x % 3, 1);
    put(grid, x, 15, 'apartment', 0, x % 3, 1);
  }

  // Houses on outer edges
  for (let x = 4; x <= 15; x++) {
    if (x !== 7 && x !== 12) {
      put(grid, x, 3, 'house', 2, x % 3, 1);
      put(grid, x, 17, 'house', 0, x % 3, 1);
    }
  }

  // Power & Water Ring
  put(grid, 1, 4, 'wind_turbine', 1, 0, 1);
  put(grid, 1, 8, 'wind_turbine', 1, 0, 1);
  put(grid, 1, 12, 'wind_turbine', 1, 0, 1);
  put(grid, 1, 16, 'wind_turbine', 1, 0, 1);
  put(grid, 18, 6, 'water_tower', 0, 0, 1);
  put(grid, 18, 10, 'water_tower', 0, 0, 1);
  put(grid, 18, 14, 'wind_turbine', 3, 0, 1);

  // Industrial district
  put(grid, 4, 10, 'factory', 1, 0, 1);
  put(grid, 4, 11, 'factory', 1, 1, 1);
  put(grid, 15, 10, 'factory', 3, 0, 1);

  return grid;
}
