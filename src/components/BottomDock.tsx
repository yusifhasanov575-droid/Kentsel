import React from 'react';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Compass,
  FastForward,
  Hammer,
  Home,
  MousePointer,
  Pause,
  Play,
  RotateCw,
  ShoppingBag,
  Trash2,
  Trees,
  Undo2,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  BUILDING_CATALOG,
  BUILDING_LIST,
  BuildingType,
  GameMode,
  SimSpeed,
  ToolCategory,
  ToolId,
} from '../game/types';

interface BottomDockProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeTool: ToolId;
  activeCategory: ToolCategory;
  rotation: number;
  simSpeed: SimSpeed;
  gameMode: GameMode;
  budget: number;
  canUndo: boolean;
  onSelectTool: (tool: ToolId) => void;
  onSelectCategory: (cat: ToolCategory) => void;
  onRotate: () => void;
  onUndo: () => void;
  onChangeSpeed: (speed: SimSpeed) => void;
  onResetCamera: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const CATEGORIES: { id: ToolCategory; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'infra', label: 'Yol & Altyapı' },
  { id: 'residential', label: 'Konut' },
  { id: 'commercial', label: 'Ticaret & Sanayi' },
  { id: 'civic', label: 'Park & Kamu' },
];

function getBuildingIcon(type: BuildingType) {
  switch (type) {
    case 'road':
      return <Compass className="w-4 h-4" />;
    case 'house':
      return <Home className="w-4 h-4" />;
    case 'apartment':
    case 'skyscraper':
      return <Building2 className="w-4 h-4" />;
    case 'shop':
      return <ShoppingBag className="w-4 h-4" />;
    case 'factory':
      return <Hammer className="w-4 h-4" />;
    case 'park':
    case 'forest':
      return <Trees className="w-4 h-4" />;
    case 'wind_turbine':
    case 'water_tower':
      return <Zap className="w-4 h-4" />;
    default:
      return <Building2 className="w-4 h-4" />;
  }
}

function getActiveToolLabel(tool: ToolId): string {
  if (tool === 'inspect') return 'İncele';
  if (tool === 'demolish') return 'Yıkım';
  return BUILDING_CATALOG[tool].shortName;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  collapsed,
  onToggleCollapse,
  activeTool,
  activeCategory,
  rotation,
  simSpeed,
  gameMode,
  budget,
  canUndo,
  onSelectTool,
  onSelectCategory,
  onRotate,
  onUndo,
  onChangeSpeed,
  onResetCamera,
  onZoomIn,
  onZoomOut,
}) => {
  const visibleBuildings =
    activeCategory === 'all'
      ? BUILDING_LIST
      : BUILDING_LIST.filter((b) => b.category === activeCategory);

  const activeLabel = getActiveToolLabel(activeTool);

  return (
    <div
      className="pointer-events-none fixed bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pb-safe transition-transform duration-200 ease-out"
      style={{
        width: 'min(960px, calc(100vw - 16px))',
      }}
    >
      {/* Mobile Compact Thumb Bar when collapsed (stays well under 15% height cap) */}
      {collapsed ? (
        <div className="pointer-events-auto flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-slate-950/94 border border-slate-800 shadow-2xl">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-colors whitespace-nowrap"
            title="Araç Çubuğunu Göster (H)"
          >
            <ChevronUp className="w-4 h-4" />
            <span>Yapılar · {activeLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('inspect')}
            className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border transition-colors ${
              activeTool === 'inspect'
                ? 'bg-sky-600 border-sky-400 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}
            title="İncele"
            aria-label="İncele"
          >
            <MousePointer className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('demolish')}
            className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border transition-colors ${
              activeTool === 'demolish'
                ? 'bg-rose-600 border-rose-400 text-white'
                : 'bg-slate-900 border-slate-800 text-rose-300'
            }`}
            title="Yık"
            aria-label="Yık"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onRotate}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-300"
            title="Çevir (R)"
            aria-label="Çevir"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-35"
            title="Geri Al"
            aria-label="Geri Al"
          >
            <Undo2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Collapse Handle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="pointer-events-auto mb-1.5 flex items-center gap-1.5 min-h-[34px] px-3.5 py-1 rounded-lg bg-slate-950/92 border border-slate-700/90 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-900 shadow-lg transition-colors whitespace-nowrap"
            title="Araç Çubuğunu Gizle (H)"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Araçları Gizle</span>
          </button>

          {/* Main Dock Surface */}
          <div className="pointer-events-auto w-full rounded-2xl bg-slate-950/94 border border-slate-800 shadow-2xl p-2 sm:p-2.5 flex flex-col gap-2">
            {/* Top Row: Category Tabs & Action Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              {/* Category Filter Tabs */}
              <div className="dock-scroll flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg overflow-x-auto">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onSelectCategory(cat.id)}
                    className={`min-h-[34px] sm:min-h-0 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      activeCategory === cat.id
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Utility Tools: Inspect, Demolish, Rotate, Undo, Speed, Camera */}
              <div className="dock-scroll flex items-center gap-1.5 overflow-x-auto shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectTool('inspect')}
                  className={`flex items-center gap-1.5 min-h-[36px] sm:min-h-0 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    activeTool === 'inspect'
                      ? 'bg-sky-600 border-sky-400 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                  title="Binaları Seç ve İncele (ESC)"
                >
                  <MousePointer className="w-3.5 h-3.5" />
                  <span>İncele</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTool('demolish')}
                  className={`flex items-center gap-1.5 min-h-[36px] sm:min-h-0 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    activeTool === 'demolish'
                      ? 'bg-rose-600 border-rose-400 text-white'
                      : 'bg-slate-900 border-slate-800 text-rose-300 hover:bg-rose-950/60'
                  }`}
                  title="Bina / Yol Yık (X)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Yık</span>
                </button>

                <span className="h-4 w-px bg-slate-800 shrink-0" aria-hidden="true" />

                <button
                  type="button"
                  onClick={onRotate}
                  className="flex items-center gap-1 min-h-[36px] sm:min-h-0 px-2 py-1 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  title="Yapıyı 90° Çevir (R)"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span className="font-mono-tabular">{(rotation * 90) % 360}°</span>
                </button>

                <button
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none transition-colors shrink-0"
                  title="Son İşlemi Geri Al (Ctrl+Z)"
                  aria-label="Geri Al"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>

                <span className="h-4 w-px bg-slate-800 shrink-0" aria-hidden="true" />

                {/* Simulation Speed */}
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onChangeSpeed(0)}
                    className={`min-h-[30px] min-w-[30px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-1 rounded-md transition-colors ${
                      simSpeed === 0
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Simülasyonu Duraklat"
                    aria-label="Duraklat"
                  >
                    <Pause className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeSpeed(1)}
                    className={`min-h-[30px] min-w-[30px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-1 rounded-md transition-colors ${
                      simSpeed === 1
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Normal Hız (1x)"
                    aria-label="Normal Hız"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeSpeed(2)}
                    className={`min-h-[30px] min-w-[30px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-1 rounded-md transition-colors ${
                      simSpeed === 2
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Hızlı (2x)"
                    aria-label="Hızlı"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Camera Zoom & Reset */}
                <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded-lg p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={onZoomIn}
                    className="min-h-[30px] min-w-[30px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-1 text-slate-400 hover:text-white rounded-md"
                    title="Yakınlaş"
                    aria-label="Yakınlaş"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onZoomOut}
                    className="min-h-[30px] min-w-[30px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-1 text-slate-400 hover:text-white rounded-md"
                    title="Uzaklaş"
                    aria-label="Uzaklaş"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onResetCamera}
                    className="min-h-[30px] sm:min-h-0 px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:text-white rounded-md whitespace-nowrap"
                    title="Kamerayı Sıfırla"
                  >
                    Merkez
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Row: Building Palette */}
            <div className="dock-scroll flex items-stretch gap-2 overflow-x-auto pb-1">
              {visibleBuildings.map((b) => {
                const selected = activeTool === b.id;
                const affordable = gameMode === 'sandbox' || budget >= b.cost;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onSelectTool(b.id)}
                    title={`${b.name} — ${b.description}`}
                    className={`group relative flex flex-col justify-between min-w-[84px] sm:min-w-[92px] px-2.5 py-2 rounded-xl border text-left transition-all shrink-0 ${
                      selected
                        ? 'bg-slate-800 border-sky-400 ring-1 ring-sky-400/60 text-white'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-600 hover:bg-slate-800/80 text-slate-200'
                    } ${!affordable ? 'opacity-55' : ''}`}
                  >
                    {/* Top accent bar */}
                    <span
                      className="block h-1 w-full rounded-full mb-1.5"
                      style={{ backgroundColor: b.accentColor }}
                    />

                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-slate-300 group-hover:text-white">
                        {getBuildingIcon(b.id)}
                      </span>
                      <span className="hidden sm:inline font-mono-tabular text-[10px] text-slate-500">
                        {b.hotkey}
                      </span>
                    </div>

                    <div className="text-xs font-semibold leading-tight truncate">
                      {b.shortName}
                    </div>

                    <div className="font-mono-tabular text-[11px] mt-0.5 text-slate-400">
                      {gameMode === 'sandbox' ? 'Ücretsiz' : `₺${b.cost}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
