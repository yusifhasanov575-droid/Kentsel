import React from 'react';
import { ArrowUpCircle, Trash2, X } from 'lucide-react';
import {
  getBuildingEffectiveStats,
  hasAdjacentRoad,
} from '../game/simulation';
import {
  BUILDING_CATALOG,
  CityGrid,
  GameMode,
  PlacedBuilding,
} from '../game/types';

interface InspectorPopoverProps {
  building: PlacedBuilding | null;
  grid: CityGrid;
  gameMode: GameMode;
  budget: number;
  onUpgrade: (gx: number, gz: number) => void;
  onDemolish: (gx: number, gz: number) => void;
  onClose: () => void;
}

export const InspectorPopover: React.FC<InspectorPopoverProps> = ({
  building,
  grid,
  gameMode,
  budget,
  onUpgrade,
  onDemolish,
  onClose,
}) => {
  if (!building) return null;

  const def = BUILDING_CATALOG[building.type];
  const eff = getBuildingEffectiveStats(building);
  const needsRoad =
    building.type !== 'road' &&
    building.type !== 'forest' &&
    building.type !== 'wind_turbine' &&
    building.type !== 'water_tower';
  const roadConnected = hasAdjacentRoad(grid, building.gx, building.gz);
  const upgradeCost = Math.round(def.cost * 0.8);
  const canUpgrade =
    building.type !== 'road' &&
    building.type !== 'forest' &&
    building.level < 2 &&
    (gameMode === 'sandbox' || budget >= upgradeCost);

  return (
    <aside className="pointer-events-auto fixed inset-x-3 bottom-16 sm:inset-x-auto sm:bottom-auto sm:top-16 sm:left-4 z-20 sm:w-72 rounded-2xl sm:rounded-xl bg-slate-950/94 border border-slate-700/90 shadow-2xl p-3.5 text-slate-100">
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div>
          <div className="text-[11px] text-slate-400">
            Parsel ({building.gx + 1}, {building.gz + 1}) · Seviye {building.level}
          </div>
          <h3 className="font-display text-base font-bold text-white leading-snug">
            {def.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[36px] min-w-[36px] flex items-center justify-center p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed mt-2.5">
        {def.description}
      </p>

      {needsRoad && (
        <div
          className={`mt-2.5 text-xs font-medium ${
            roadConnected ? 'text-emerald-400' : 'text-amber-400'
          }`}
        >
          {roadConnected
            ? 'Yol bağlantısı aktif'
            : 'Uyarı: Yakında yol bağlantısı yok'}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3 pt-2.5 border-t border-slate-800 text-xs">
        {eff.population > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Nüfus</span>
            <span className="font-mono-tabular font-semibold text-white">
              +{eff.population}
            </span>
          </div>
        )}
        {eff.jobs > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">İstihdam</span>
            <span className="font-mono-tabular font-semibold text-white">
              +{eff.jobs}
            </span>
          </div>
        )}
        {eff.powerDelta !== 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Enerji</span>
            <span
              className={`font-mono-tabular font-semibold ${
                eff.powerDelta > 0 ? 'text-emerald-400' : 'text-slate-200'
              }`}
            >
              {eff.powerDelta > 0 ? `+${eff.powerDelta}` : eff.powerDelta} MW
            </span>
          </div>
        )}
        {eff.waterDelta !== 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Su</span>
            <span
              className={`font-mono-tabular font-semibold ${
                eff.waterDelta > 0 ? 'text-sky-400' : 'text-slate-200'
              }`}
            >
              {eff.waterDelta > 0 ? `+${eff.waterDelta}` : eff.waterDelta} m³
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-400">Döngü Geliri</span>
          <span
            className={`font-mono-tabular font-semibold ${
              eff.taxIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {eff.taxIncome >= 0 ? `+₺${eff.taxIncome}` : `-₺${Math.abs(eff.taxIncome)}`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3.5 pt-2.5 border-t border-slate-800">
        {building.type !== 'road' && building.type !== 'forest' && (
          <button
            type="button"
            disabled={!canUpgrade}
            onClick={() => onUpgrade(building.gx, building.gz)}
            className="flex-1 min-h-[40px] sm:min-h-0 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition-colors"
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            <span>
              {building.level >= 2
                ? 'Son Seviye'
                : gameMode === 'sandbox'
                  ? 'Yükselt'
                  : `Yükselt (₺${upgradeCost})`}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onDemolish(building.gx, building.gz)}
          className="min-h-[40px] sm:min-h-0 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/40 text-rose-300 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Yık</span>
        </button>
      </div>
    </aside>
  );
};
