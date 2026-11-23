import React, { useState } from 'react';
import {
  BarChart3,
  Camera,
  ChevronDown,
  Droplets,
  Infinity as InfinityIcon,
  Map as MapIcon,
  Moon,
  RotateCcw,
  SlidersHorizontal,
  Smile,
  Sun,
  Sunset,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  Zap,
} from 'lucide-react';
import { CityStats, GameMode, TimeOfDay } from '../game/types';

interface TopHudProps {
  stats: CityStats;
  budget: number;
  gameMode: GameMode;
  timeOfDay: TimeOfDay;
  soundEnabled: boolean;
  analyticsOpen: boolean;
  onChangeTimeOfDay: (tod: TimeOfDay) => void;
  onToggleMode: () => void;
  onToggleSound: () => void;
  onToggleAnalytics: () => void;
  onLoadPreset: (preset: 'coastal' | 'metropolis' | 'empty') => void;
  onCapturePhoto: () => void;
}

export const TopHud: React.FC<TopHudProps> = ({
  stats,
  budget,
  gameMode,
  timeOfDay,
  soundEnabled,
  analyticsOpen,
  onChangeTimeOfDay,
  onToggleMode,
  onToggleSound,
  onToggleAnalytics,
  onLoadPreset,
  onCapturePhoto,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const powerDeficit = stats.powerUsed > stats.powerProduced;
  const waterDeficit = stats.waterUsed > stats.waterProduced;

  return (
    <header className="pointer-events-auto relative z-20 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 h-12 sm:h-auto sm:py-2.5 bg-slate-950/92 border-b border-slate-800 text-slate-100 shrink-0">
      {/* Zone 1: Brand wordmark */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-display text-base sm:text-lg font-extrabold tracking-tight text-white whitespace-nowrap">
          Kentsel
        </span>
      </div>

      {/* Zone 2A: Mobile Compact Telemetry (xs only) */}
      <div className="flex sm:hidden items-center gap-2.5 text-xs min-w-0 overflow-hidden">
        <div className="flex items-center gap-1 whitespace-nowrap shrink-0">
          <Users className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-mono-tabular font-semibold text-white">
            {stats.population.toLocaleString('tr-TR')}
          </span>
        </div>

        <span className="h-3 w-px bg-slate-800 shrink-0" aria-hidden="true" />

        <div className="flex items-center gap-1 whitespace-nowrap shrink-0">
          <Wallet className="w-3.5 h-3.5 text-emerald-400" />
          {gameMode === 'sandbox' ? (
            <InfinityIcon className="w-3.5 h-3.5 text-emerald-300" />
          ) : (
            <span className="font-mono-tabular font-semibold text-white">
              ₺{budget.toLocaleString('tr-TR')}
            </span>
          )}
        </div>

        <span className="h-3 w-px bg-slate-800 shrink-0" aria-hidden="true" />

        <div className="flex items-center gap-1 whitespace-nowrap shrink-0">
          <Smile
            className={`w-3.5 h-3.5 ${
              stats.happiness >= 70
                ? 'text-emerald-400'
                : stats.happiness >= 45
                  ? 'text-amber-400'
                  : 'text-rose-400'
            }`}
          />
          <span className="font-mono-tabular font-semibold text-white">
            %{stats.happiness}
          </span>
        </div>

        {(powerDeficit || waterDeficit) && (
          <span className="text-[10px] font-semibold text-rose-400 whitespace-nowrap shrink-0">
            Eksik
          </span>
        )}
      </div>

      {/* Zone 2B: Tablet & Desktop Tabular Telemetry Strip */}
      <div className="hidden sm:flex items-center gap-3 md:gap-4 lg:gap-6 overflow-x-auto py-0.5 text-xs">
        <div
          className="flex items-center gap-1.5 whitespace-nowrap shrink-0"
          title="Toplam Nüfus"
        >
          <Users className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden lg:inline text-slate-400">Nüfus</span>
          <span className="font-mono-tabular font-semibold text-white">
            {stats.population.toLocaleString('tr-TR')}
          </span>
        </div>

        <span className="h-3.5 w-px bg-slate-800 shrink-0" aria-hidden="true" />

        <div
          className="flex items-center gap-1.5 whitespace-nowrap shrink-0"
          title="Şehir Bütçesi ve Döngü Geliri"
        >
          <Wallet className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden lg:inline text-slate-400">Bütçe</span>
          {gameMode === 'sandbox' ? (
            <span className="inline-flex items-center gap-1 font-mono-tabular font-semibold text-emerald-300">
              <InfinityIcon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sınırsız</span>
            </span>
          ) : (
            <span className="font-mono-tabular font-semibold text-white">
              ₺{budget.toLocaleString('tr-TR')}
              <span
                className={`ml-1 text-[11px] ${
                  stats.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ({stats.netIncome >= 0 ? '+' : ''}
                {stats.netIncome})
              </span>
            </span>
          )}
        </div>

        <span className="h-3.5 w-px bg-slate-800 shrink-0" aria-hidden="true" />

        <div
          className="flex items-center gap-1.5 whitespace-nowrap shrink-0"
          title="Enerji Tüketimi / Üretimi"
        >
          <Zap
            className={`w-3.5 h-3.5 ${
              powerDeficit ? 'text-rose-400' : 'text-sky-400'
            }`}
          />
          <span className="hidden xl:inline text-slate-400">Enerji</span>
          <span
            className={`font-mono-tabular font-semibold ${
              powerDeficit ? 'text-rose-300' : 'text-white'
            }`}
          >
            {stats.powerUsed}/{stats.powerProduced} MW
          </span>
          {powerDeficit && (
            <span className="text-[11px] font-medium text-rose-400">Eksik</span>
          )}
        </div>

        <span className="h-3.5 w-px bg-slate-800 shrink-0" aria-hidden="true" />

        <div
          className="flex items-center gap-1.5 whitespace-nowrap shrink-0"
          title="Su Tüketimi / Kapasitesi"
        >
          <Droplets
            className={`w-3.5 h-3.5 ${
              waterDeficit ? 'text-rose-400' : 'text-blue-400'
            }`}
          />
          <span className="hidden xl:inline text-slate-400">Su</span>
          <span
            className={`font-mono-tabular font-semibold ${
              waterDeficit ? 'text-rose-300' : 'text-white'
            }`}
          >
            {stats.waterUsed}/{stats.waterProduced} m³
          </span>
          {waterDeficit && (
            <span className="text-[11px] font-medium text-rose-400">Eksik</span>
          )}
        </div>

        <span className="h-3.5 w-px bg-slate-800 shrink-0" aria-hidden="true" />

        <div
          className="flex items-center gap-1.5 whitespace-nowrap shrink-0"
          title="Vatandaş Mutluluğu"
        >
          <Smile
            className={`w-3.5 h-3.5 ${
              stats.happiness >= 70
                ? 'text-emerald-400'
                : stats.happiness >= 45
                  ? 'text-amber-400'
                  : 'text-rose-400'
            }`}
          />
          <span className="hidden xl:inline text-slate-400">Mutluluk</span>
          <span className="font-mono-tabular font-semibold text-white">
            %{stats.happiness}
          </span>
        </div>
      </div>

      {/* Zone 3: Responsive Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Time of Day (Tablet md+ and Desktop) */}
        <div className="hidden md:flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => onChangeTimeOfDay('day')}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 ${
              timeOfDay === 'day'
                ? 'bg-slate-700 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Gündüz"
          >
            <Sun className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Gündüz</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTimeOfDay('sunset')}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 ${
              timeOfDay === 'sunset'
                ? 'bg-amber-600 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Gün Batımı"
          >
            <Sunset className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Akşam</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTimeOfDay('night')}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 ${
              timeOfDay === 'night'
                ? 'bg-indigo-600 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Gece"
          >
            <Moon className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Gece</span>
          </button>
        </div>

        {/* Mode Toggle (Desktop lg+) */}
        <button
          type="button"
          onClick={onToggleMode}
          className={`hidden lg:inline-flex px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
            gameMode === 'sandbox'
              ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30'
              : 'bg-amber-600/20 border-amber-500/50 text-amber-300 hover:bg-amber-600/30'
          }`}
          title="Kum Havuzu (Sınırsız) veya Ekonomi Moduna geç"
        >
          {gameMode === 'sandbox' ? 'Kum Havuzu' : 'Ekonomi Modu'}
        </button>

        {/* Analytics Toggle (All Screens) */}
        <button
          type="button"
          onClick={onToggleAnalytics}
          className={`flex items-center justify-center gap-1.5 min-h-[38px] min-w-[38px] sm:min-h-0 sm:min-w-0 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
            analyticsOpen
              ? 'bg-sky-600 border-sky-400 text-white'
              : 'bg-slate-900 border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800'
          }`}
          title="D3 Şehir Analitiği ve Grafikler (G)"
          aria-label="Şehir Analitiği"
        >
          <BarChart3 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Analitik</span>
        </button>

        {/* Sound & Photo (Desktop lg+) */}
        <button
          type="button"
          onClick={onToggleSound}
          className="hidden lg:inline-flex p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title={soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
          aria-label={soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-500" />
          )}
        </button>

        <button
          type="button"
          onClick={onCapturePhoto}
          className="hidden lg:inline-flex p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title="Şehrin Fotoğrafını Çek"
          aria-label="Fotoğraf Çek"
        >
          <Camera className="w-4 h-4" />
        </button>

        {/* Unified Menu / Harita Dropdown (Shows extra mobile/tablet controls + presets) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center justify-center gap-1.5 min-h-[38px] min-w-[38px] sm:min-h-0 sm:min-w-0 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors whitespace-nowrap shrink-0"
            aria-label="Harita ve Ayarlar"
          >
            <SlidersHorizontal className="w-4 h-4 sm:hidden" />
            <MapIcon className="hidden sm:block w-3.5 h-3.5" />
            <span className="hidden sm:inline">Harita</span>
            <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-slate-400" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-64 z-30 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-2 text-xs">
                {/* Mobile-only full utility telemetry */}
                <div className="sm:hidden px-3.5 pb-2 mb-1.5 border-b border-slate-800 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Enerji</span>
                    <span
                      className={`font-mono-tabular font-semibold ${
                        powerDeficit ? 'text-rose-300' : 'text-white'
                      }`}
                    >
                      {stats.powerUsed}/{stats.powerProduced} MW
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Su</span>
                    <span
                      className={`font-mono-tabular font-semibold ${
                        waterDeficit ? 'text-rose-300' : 'text-white'
                      }`}
                    >
                      {stats.waterUsed}/{stats.waterProduced} m³
                    </span>
                  </div>
                </div>

                {/* Mobile & Tablet Time-of-Day */}
                <div className="md:hidden px-3 pb-2 mb-1.5 border-b border-slate-800">
                  <div className="text-[11px] text-slate-400 mb-1.5">Günün Saati</div>
                  <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => onChangeTimeOfDay('day')}
                      className={`flex items-center justify-center gap-1 py-1.5 rounded-md ${
                        timeOfDay === 'day'
                          ? 'bg-slate-700 text-white font-medium'
                          : 'text-slate-400'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Gündüz</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeTimeOfDay('sunset')}
                      className={`flex items-center justify-center gap-1 py-1.5 rounded-md ${
                        timeOfDay === 'sunset'
                          ? 'bg-amber-600 text-white font-medium'
                          : 'text-slate-400'
                      }`}
                    >
                      <Sunset className="w-3.5 h-3.5" />
                      <span>Akşam</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeTimeOfDay('night')}
                      className={`flex items-center justify-center gap-1 py-1.5 rounded-md ${
                        timeOfDay === 'night'
                          ? 'bg-indigo-600 text-white font-medium'
                          : 'text-slate-400'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Gece</span>
                    </button>
                  </div>
                </div>

                {/* Mobile & Tablet Mode, Sound, Photo */}
                <div className="lg:hidden border-b border-slate-800 pb-1.5 mb-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onToggleMode();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-left text-slate-200 hover:bg-slate-800"
                  >
                    <span>Oyun Modu</span>
                    <span
                      className={`font-semibold ${
                        gameMode === 'sandbox' ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {gameMode === 'sandbox' ? 'Kum Havuzu' : 'Ekonomi'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleSound}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-left text-slate-200 hover:bg-slate-800"
                  >
                    <span>Ses Efektleri</span>
                    <span className="text-slate-400">
                      {soundEnabled ? 'Açık' : 'Kapalı'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onCapturePhoto();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-slate-200 hover:bg-slate-800"
                  >
                    <Camera className="w-3.5 h-3.5 text-sky-400" />
                    <span>Fotoğraf Çek</span>
                  </button>
                </div>

                {/* Presets */}
                <button
                  type="button"
                  onClick={() => {
                    onLoadPreset('coastal');
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                  <span>Sahil Kasabası (Başlangıç)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onLoadPreset('metropolis');
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <MapIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Metropol Çekirdeği</span>
                </button>
                <div className="my-1 border-t border-slate-800" />
                <button
                  type="button"
                  onClick={() => {
                    onLoadPreset('empty');
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-rose-300 hover:bg-rose-950/50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Boş Ada (Hepsini Temizle)</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
