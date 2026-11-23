export const GRID_SIZE = 20;
export const CELL_SIZE = 2;

export type BuildingType =
  | 'road'
  | 'house'
  | 'apartment'
  | 'shop'
  | 'skyscraper'
  | 'factory'
  | 'park'
  | 'forest'
  | 'wind_turbine'
  | 'water_tower'
  | 'school'
  | 'hospital'
  | 'clock_tower';

export type ToolId = 'inspect' | BuildingType | 'demolish';

export type ToolCategory = 'all' | 'infra' | 'residential' | 'commercial' | 'civic';

export type TimeOfDay = 'day' | 'sunset' | 'night';

export type GameMode = 'sandbox' | 'economy';

export type SimSpeed = 0 | 1 | 2;

export interface BuildingDef {
  id: BuildingType;
  name: string;
  shortName: string;
  category: Exclude<ToolCategory, 'all'>;
  cost: number;
  population: number;
  jobs: number;
  powerDelta: number; // + produces, - consumes
  waterDelta: number; // + produces, - consumes
  happinessImpact: number;
  taxIncome: number; // per economy tick
  hotkey: string;
  accentColor: string;
  description: string;
  draggable?: boolean;
}

export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  gx: number;
  gz: number;
  rotation: number; // 0, 1, 2, 3 (multiples of 90 deg)
  variant: number; // 0..2 visual color/style variation
  level: number; // 1..2
  placedAt: number;
}

export type CityGrid = (PlacedBuilding | null)[][];

export interface CityStats {
  population: number;
  jobs: number;
  powerProduced: number;
  powerUsed: number;
  waterProduced: number;
  waterUsed: number;
  happiness: number; // 0..100
  netIncome: number;
  buildingCount: number;
  roadCount: number;
}

export interface HistorySnapshot {
  step: number;
  timestamp: string;
  budget: number;
  netIncome: number;
  population: number;
  happiness: number;
}

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'warn' | 'success';
}

export const BUILDING_CATALOG: Record<BuildingType, BuildingDef> = {
  road: {
    id: 'road',
    name: 'Asfalt Yol',
    shortName: 'Yol',
    category: 'infra',
    cost: 40,
    population: 0,
    jobs: 0,
    powerDelta: 0,
    waterDelta: 0,
    happinessImpact: 0,
    taxIncome: -2,
    hotkey: '1',
    accentColor: '#64748b',
    description: 'Binaları birbirine bağlar ve araç trafiğini açar. Sürükleyerek döşenebilir.',
    draggable: true,
  },
  house: {
    id: 'house',
    name: 'Müstakil Ev',
    shortName: 'Ev',
    category: 'residential',
    cost: 250,
    population: 12,
    jobs: 0,
    powerDelta: -2,
    waterDelta: -2,
    happinessImpact: 2,
    taxIncome: 35,
    hotkey: '2',
    accentColor: '#f59e0b',
    description: 'Bahçeli sıcak konut. Şehir nüfusunu ve vergi gelirini artırır.',
  },
  apartment: {
    id: 'apartment',
    name: 'Apartman',
    shortName: 'Apartman',
    category: 'residential',
    cost: 700,
    population: 48,
    jobs: 0,
    powerDelta: -6,
    waterDelta: -6,
    happinessImpact: 1,
    taxIncome: 110,
    hotkey: '3',
    accentColor: '#fb923c',
    description: 'Balkonlu çok katlı konut bloğu. Yüksek nüfus kapasitesi sağlar.',
  },
  shop: {
    id: 'shop',
    name: 'Çarşı & Kafe',
    shortName: 'Çarşı',
    category: 'commercial',
    cost: 450,
    population: 0,
    jobs: 16,
    powerDelta: -4,
    waterDelta: -3,
    happinessImpact: 4,
    taxIncome: 95,
    hotkey: '4',
    accentColor: '#38bdf8',
    description: 'Mahalle esnafı ve kafe terası. İş imkânı ve ticari gelir üretir.',
  },
  skyscraper: {
    id: 'skyscraper',
    name: 'Gökdelen',
    shortName: 'Gökdelen',
    category: 'commercial',
    cost: 2200,
    population: 30,
    jobs: 85,
    powerDelta: -18,
    waterDelta: -14,
    happinessImpact: 3,
    taxIncome: 340,
    hotkey: '5',
    accentColor: '#0ea5e9',
    description: 'Cam cepheli iş kulesi. Yüksek istihdam ve büyük vergi getirisi sağlar.',
  },
  factory: {
    id: 'factory',
    name: 'Fabrika',
    shortName: 'Fabrika',
    category: 'commercial',
    cost: 1100,
    population: 0,
    jobs: 55,
    powerDelta: -12,
    waterDelta: -8,
    happinessImpact: -7,
    taxIncome: 240,
    hotkey: '6',
    accentColor: '#a8a29e',
    description: 'Yüksek üretim geliri ve istihdam sağlar ancak çevre mutluluğunu düşürür.',
  },
  park: {
    id: 'park',
    name: 'Şehir Parkı',
    shortName: 'Park',
    category: 'civic',
    cost: 300,
    population: 0,
    jobs: 2,
    powerDelta: -1,
    waterDelta: -2,
    happinessImpact: 10,
    taxIncome: -10,
    hotkey: '7',
    accentColor: '#22c55e',
    description: 'Fıskiyeli meydan ve gölgelik ağaçlar. Vatandaş mutluluğunu yükseltir.',
  },
  forest: {
    id: 'forest',
    name: 'Ağaç Korusu',
    shortName: 'Orman',
    category: 'civic',
    cost: 90,
    population: 0,
    jobs: 0,
    powerDelta: 0,
    waterDelta: 0,
    happinessImpact: 4,
    taxIncome: 0,
    hotkey: '8',
    accentColor: '#16a34a',
    description: 'Doğal yeşil doku ve temiz hava sağlar. Sürükleyerek ekilebilir.',
    draggable: true,
  },
  wind_turbine: {
    id: 'wind_turbine',
    name: 'Rüzgar Türbini',
    shortName: 'Türbin',
    category: 'infra',
    cost: 850,
    population: 0,
    jobs: 4,
    powerDelta: 35,
    waterDelta: 0,
    happinessImpact: 2,
    taxIncome: -25,
    hotkey: '9',
    accentColor: '#e2e8f0',
    description: 'Temiz elektrik üretir (+35 MW) ve çevre dostudur.',
  },
  water_tower: {
    id: 'water_tower',
    name: 'Su Kulesi',
    shortName: 'Su Kulesi',
    category: 'infra',
    cost: 650,
    population: 0,
    jobs: 3,
    powerDelta: -3,
    waterDelta: 40,
    happinessImpact: 1,
    taxIncome: -20,
    hotkey: '0',
    accentColor: '#60a5fa',
    description: 'Şehir şebekesine temiz su sağlar (+40 m³).',
  },
  school: {
    id: 'school',
    name: 'Okul',
    shortName: 'Okul',
    category: 'civic',
    cost: 1200,
    population: 0,
    jobs: 22,
    powerDelta: -5,
    waterDelta: -5,
    happinessImpact: 12,
    taxIncome: -35,
    hotkey: 'Q',
    accentColor: '#eab308',
    description: 'Eğitim kurumu. Şehir mutluluğunu ve yaşam kalitesini belirgin artırır.',
  },
  hospital: {
    id: 'hospital',
    name: 'Hastane',
    shortName: 'Hastane',
    category: 'civic',
    cost: 1800,
    population: 0,
    jobs: 40,
    powerDelta: -10,
    waterDelta: -9,
    happinessImpact: 16,
    taxIncome: -50,
    hotkey: 'E',
    accentColor: '#ef4444',
    description: 'Modern sağlık merkezi. Vatandaş sağlığı ve memnuniyetini zirveye taşır.',
  },
  clock_tower: {
    id: 'clock_tower',
    name: 'Saat Kulesi',
    shortName: 'Saat Kulesi',
    category: 'civic',
    cost: 2600,
    population: 0,
    jobs: 8,
    powerDelta: -4,
    waterDelta: -2,
    happinessImpact: 20,
    taxIncome: 45,
    hotkey: 'T',
    accentColor: '#f97316',
    description: 'Tarihi şehir simgesi. Turizm geliri ve yüksek prestij sağlar.',
  },
};

export const BUILDING_LIST: BuildingDef[] = Object.values(BUILDING_CATALOG);
