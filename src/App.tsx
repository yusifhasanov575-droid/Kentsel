import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomDock } from './components/BottomDock';
import { CityAnalyticsPanel } from './components/CityAnalyticsPanel';
import { CityViewport, CityViewportHandle } from './components/CityViewport';
import { InspectorPopover } from './components/InspectorPopover';
import { TopHud } from './components/TopHud';
import {
  cloneGrid,
  computeCityStats,
  createEmptyGrid,
  inBounds,
} from './game/simulation';
import { soundEngine } from './game/sound';
import {
  buildCoastalTownPreset,
  buildMetropolisPreset,
  nextBuildingId,
} from './game/starterCity';
import {
  BUILDING_CATALOG,
  BUILDING_LIST,
  BuildingType,
  CityGrid,
  GameMode,
  HistorySnapshot,
  SimSpeed,
  TimeOfDay,
  ToastMessage,
  ToolCategory,
  ToolId,
} from './game/types';

const STORAGE_KEY = 'kentsel_sandbox_save_v1';

interface SavedState {
  grid: CityGrid;
  budget: number;
  gameMode: GameMode;
  timeOfDay: TimeOfDay;
}

function loadInitialState(): SavedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedState;
      if (Array.isArray(parsed.grid) && parsed.grid.length === 20) {
        return {
          grid: parsed.grid,
          budget: typeof parsed.budget === 'number' ? parsed.budget : 50000,
          gameMode: parsed.gameMode === 'economy' ? 'economy' : 'sandbox',
          timeOfDay:
            parsed.timeOfDay === 'sunset' || parsed.timeOfDay === 'night'
              ? parsed.timeOfDay
              : 'day',
        };
      }
    }
  } catch {
    // Ignore corrupt local storage
  }
  return {
    grid: buildCoastalTownPreset(),
    budget: 50000,
    gameMode: 'sandbox',
    timeOfDay: 'day',
  };
}

export default function App() {
  const initial = useMemo(() => loadInitialState(), []);

  const [grid, setGrid] = useState<CityGrid>(initial.grid);
  const [history, setHistory] = useState<{ grid: CityGrid; budget: number }[]>([]);
  const [budget, setBudget] = useState<number>(initial.budget);
  const [gameMode, setGameMode] = useState<GameMode>(initial.gameMode);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(initial.timeOfDay);
  const [simSpeed, setSimSpeed] = useState<SimSpeed>(1);
  const [activeTool, setActiveTool] = useState<ToolId>('house');
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('all');
  const [rotation, setRotation] = useState<number>(0);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  );
  const [analyticsOpen, setAnalyticsOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [selectedCell, setSelectedCell] = useState<{ gx: number; gz: number } | null>(
    null,
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const viewportRef = useRef<CityViewportHandle | null>(null);
  const toastIdRef = useRef(1);
  const stepCounterRef = useRef(1);

  const stats = useMemo(() => computeCityStats(grid), [grid]);

  const [financeHistory, setFinanceHistory] = useState<HistorySnapshot[]>(() => {
    const initialStats = computeCityStats(initial.grid);
    const now = new Date();
    const basePoints: HistorySnapshot[] = [];
    for (let i = 5; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 5000);
      const label = t.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const stepBudget = Math.max(0, initial.budget - i * initialStats.netIncome);
      basePoints.push({
        step: stepCounterRef.current++,
        timestamp: label,
        budget: stepBudget,
        netIncome: initialStats.netIncome,
        population: initialStats.population,
        happiness: initialStats.happiness,
      });
    }
    return basePoints;
  });

  const appendFinanceSnapshot = useCallback(
    (nextBudget: number, nextGrid: CityGrid) => {
      const nextStats = computeCityStats(nextGrid);
      const label = new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setFinanceHistory((prev) => [
        ...prev.slice(-39),
        {
          step: stepCounterRef.current++,
          timestamp: label,
          budget: nextBudget,
          netIncome: nextStats.netIncome,
          population: nextStats.population,
          happiness: nextStats.happiness,
        },
      ]);
    },
    [],
  );

  const pushToast = useCallback(
    (text: string, tone: ToastMessage['tone'] = 'info') => {
      const id = toastIdRef.current++;
      setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2600);
    },
    [],
  );

  // Persist city state
  useEffect(() => {
    try {
      const payload: SavedState = { grid, budget, gameMode, timeOfDay };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota issues
    }
  }, [grid, budget, gameMode, timeOfDay]);

  const budgetRef = useRef(budget);
  budgetRef.current = budget;

  // Simulation tax & analytics history tick
  useEffect(() => {
    if (simSpeed === 0) return;
    const intervalMs = simSpeed === 2 ? 2600 : 5000;
    const timer = window.setInterval(() => {
      const nextBudget = Math.max(0, budgetRef.current + stats.netIncome);
      setBudget(nextBudget);
      appendFinanceSnapshot(nextBudget, grid);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [simSpeed, stats.netIncome, grid, appendFinanceSnapshot]);

  const canAffordTool = useCallback(
    (tool: ToolId): boolean => {
      if (gameMode === 'sandbox') return true;
      if (tool === 'inspect' || tool === 'demolish') return true;
      return budget >= BUILDING_CATALOG[tool].cost;
    },
    [gameMode, budget],
  );

  const pushUndoSnapshot = useCallback((currGrid: CityGrid, currBudget: number) => {
    setHistory((prev) => [...prev.slice(-29), { grid: cloneGrid(currGrid), budget: currBudget }]);
  }, []);

  const handlePlaceOrAct = useCallback(
    (gx: number, gz: number) => {
      if (!inBounds(gx, gz)) return;

      if (activeTool === 'inspect') {
        setSelectedCell({ gx, gz });
        return;
      }

      if (activeTool === 'demolish') {
        const existing = grid[gz][gx];
        if (!existing) return;
        pushUndoSnapshot(grid, budget);
        const next = cloneGrid(grid);
        next[gz][gx] = null;
        setGrid(next);
        const refund =
          gameMode === 'economy'
            ? Math.round(BUILDING_CATALOG[existing.type].cost * 0.4)
            : 0;
        const nextBudget = budget + refund;
        if (gameMode === 'economy') {
          setBudget(nextBudget);
        }
        appendFinanceSnapshot(nextBudget, next);
        if (selectedCell && selectedCell.gx === gx && selectedCell.gz === gz) {
          setSelectedCell(null);
        }
        soundEngine.playDemolish();
        return;
      }

      // Building placement
      const existing = grid[gz][gx];
      if (existing) {
        // Clicking an occupied tile selects it if not dragging road/forest
        if (!BUILDING_CATALOG[activeTool].draggable) {
          setSelectedCell({ gx, gz });
        }
        return;
      }

      const def = BUILDING_CATALOG[activeTool as BuildingType];
      if (gameMode === 'economy' && budget < def.cost) {
        pushToast(`Yetersiz bütçe (${def.name} için ₺${def.cost} gerekli)`, 'warn');
        return;
      }

      pushUndoSnapshot(grid, budget);
      const next = cloneGrid(grid);
      next[gz][gx] = {
        id: nextBuildingId(),
        type: activeTool as BuildingType,
        gx,
        gz,
        rotation,
        variant: Math.floor(Math.random() * 3),
        level: 1,
        placedAt: Date.now(),
      };
      setGrid(next);
      const nextBudget = gameMode === 'economy' ? budget - def.cost : budget;
      if (gameMode === 'economy') {
        setBudget(nextBudget);
      }
      appendFinanceSnapshot(nextBudget, next);
      soundEngine.playBuild(activeTool === 'road');
    },
    [
      activeTool,
      appendFinanceSnapshot,
      budget,
      gameMode,
      grid,
      pushToast,
      pushUndoSnapshot,
      rotation,
      selectedCell,
    ],
  );

  const handleUpgradeBuilding = useCallback(
    (gx: number, gz: number) => {
      const target = grid[gz]?.[gx];
      if (!target || target.level >= 2) return;
      const def = BUILDING_CATALOG[target.type];
      const cost = Math.round(def.cost * 0.8);
      if (gameMode === 'economy' && budget < cost) {
        pushToast(`Yükseltme için ₺${cost} gerekli`, 'warn');
        return;
      }

      pushUndoSnapshot(grid, budget);
      const next = cloneGrid(grid);
      if (next[gz][gx]) {
        next[gz][gx] = {
          ...next[gz][gx]!,
          level: 2,
          placedAt: Date.now(),
        };
      }
      setGrid(next);
      const nextBudget = gameMode === 'economy' ? budget - cost : budget;
      if (gameMode === 'economy') {
        setBudget(nextBudget);
      }
      appendFinanceSnapshot(nextBudget, next);
      soundEngine.playUpgrade();
      pushToast(`${def.name} Seviye 2'ye yükseltildi`, 'success');
    },
    [appendFinanceSnapshot, budget, gameMode, grid, pushToast, pushUndoSnapshot],
  );

  const handleDemolishSelected = useCallback(
    (gx: number, gz: number) => {
      const existing = grid[gz]?.[gx];
      if (!existing) return;
      pushUndoSnapshot(grid, budget);
      const next = cloneGrid(grid);
      next[gz][gx] = null;
      setGrid(next);
      const refund =
        gameMode === 'economy'
          ? Math.round(BUILDING_CATALOG[existing.type].cost * 0.4)
          : 0;
      const nextBudget = budget + refund;
      if (gameMode === 'economy') {
        setBudget(nextBudget);
      }
      appendFinanceSnapshot(nextBudget, next);
      setSelectedCell(null);
      soundEngine.playDemolish();
    },
    [appendFinanceSnapshot, budget, gameMode, grid, pushUndoSnapshot],
  );

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setGrid(last.grid);
      setBudget(last.budget);
      soundEngine.playRotate();
      return prev.slice(0, -1);
    });
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((r) => (r + 1) % 4);
    soundEngine.playRotate();
  }, []);

  const handleLoadPreset = useCallback(
    (preset: 'coastal' | 'metropolis' | 'empty') => {
      pushUndoSnapshot(grid, budget);
      setSelectedCell(null);
      if (preset === 'coastal') {
        const next = buildCoastalTownPreset();
        setGrid(next);
        setBudget(50000);
        appendFinanceSnapshot(50000, next);
        pushToast('Sahil Kasabası haritası yüklendi', 'success');
      } else if (preset === 'metropolis') {
        const next = buildMetropolisPreset();
        setGrid(next);
        setBudget(75000);
        appendFinanceSnapshot(75000, next);
        pushToast('Metropol Çekirdeği haritası yüklendi', 'success');
      } else {
        const next = createEmptyGrid();
        setGrid(next);
        setBudget(50000);
        appendFinanceSnapshot(50000, next);
        pushToast('Ada temizlendi, sıfırdan inşa edebilirsiniz', 'info');
      }
      soundEngine.playUpgrade();
    },
    [appendFinanceSnapshot, budget, grid, pushToast, pushUndoSnapshot],
  );

  const handleCapturePhoto = useCallback(() => {
    const dataUrl = viewportRef.current?.captureScreenshot();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `kentsel-sehir-${Date.now()}.png`;
    a.click();
    pushToast('Şehir fotoğrafı indirildi', 'success');
  }, [pushToast]);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundEngine.enabled = next;
      return next;
    });
  }, []);

  const handleToggleMode = useCallback(() => {
    setGameMode((prev) => {
      const next = prev === 'sandbox' ? 'economy' : 'sandbox';
      pushToast(
        next === 'sandbox'
          ? 'Kum Havuzu Modu: Sınırsız bütçe aktif'
          : 'Ekonomi Modu: Vergi ve bütçe yönetimi aktif',
        'info',
      );
      return next;
    });
  }, [pushToast]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      const key = e.key.toUpperCase();
      if (key === 'R') {
        e.preventDefault();
        handleRotate();
        return;
      }
      if (key === 'H') {
        e.preventDefault();
        setDockCollapsed((v) => !v);
        return;
      }
      if (key === 'G') {
        e.preventDefault();
        setAnalyticsOpen((v) => !v);
        return;
      }
      if (key === 'X') {
        setActiveTool('demolish');
        return;
      }
      if (e.key === 'Escape') {
        setActiveTool('inspect');
        setSelectedCell(null);
        return;
      }

      const matched = BUILDING_LIST.find((b) => b.hotkey === key);
      if (matched) {
        setActiveTool(matched.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRotate, handleUndo]);

  const inspectedBuilding =
    selectedCell && grid[selectedCell.gz]?.[selectedCell.gx]
      ? grid[selectedCell.gz][selectedCell.gx]
      : null;

  return (
    <div className="relative w-screen h-dvh overflow-hidden bg-slate-950 flex flex-col">
      {/* Top Bar */}
      <TopHud
        stats={stats}
        budget={budget}
        gameMode={gameMode}
        timeOfDay={timeOfDay}
        soundEnabled={soundEnabled}
        analyticsOpen={analyticsOpen}
        onChangeTimeOfDay={setTimeOfDay}
        onToggleMode={handleToggleMode}
        onToggleSound={handleToggleSound}
        onToggleAnalytics={() => setAnalyticsOpen((v) => !v)}
        onLoadPreset={handleLoadPreset}
        onCapturePhoto={handleCapturePhoto}
      />

      {/* Full-Viewport 3D Canvas Container */}
      <main className="relative flex-1 w-full overflow-hidden">
        <CityViewport
          grid={grid}
          activeTool={activeTool}
          rotation={rotation}
          timeOfDay={timeOfDay}
          simSpeed={simSpeed}
          selectedCell={selectedCell}
          canAffordTool={canAffordTool}
          onPlaceOrAct={handlePlaceOrAct}
          onSelectCell={setSelectedCell}
          viewportRef={viewportRef}
        />

        {/* Building Inspector */}
        <InspectorPopover
          building={inspectedBuilding}
          grid={grid}
          gameMode={gameMode}
          budget={budget}
          onUpgrade={handleUpgradeBuilding}
          onDemolish={handleDemolishSelected}
          onClose={() => setSelectedCell(null)}
        />

        {/* D3 Analytics Panel */}
        <CityAnalyticsPanel
          open={analyticsOpen}
          grid={grid}
          stats={stats}
          budget={budget}
          gameMode={gameMode}
          history={financeHistory}
          onClose={() => setAnalyticsOpen(false)}
        />

        {/* Toast Stack */}
        {toasts.length > 0 && (
          <div
            className={`pointer-events-none fixed top-14 sm:top-16 z-30 flex flex-col items-end gap-2 transition-all ${
              analyticsOpen
                ? 'right-3 sm:right-[396px] lg:right-[440px]'
                : 'right-3 sm:right-4'
            }`}
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`px-3.5 py-2 rounded-lg border text-xs font-medium shadow-xl ${
                  t.tone === 'warn'
                    ? 'bg-rose-950/95 border-rose-700 text-rose-200'
                    : t.tone === 'success'
                      ? 'bg-emerald-950/95 border-emerald-700 text-emerald-200'
                      : 'bg-slate-900/95 border-slate-700 text-slate-200'
                }`}
              >
                {t.text}
              </div>
            ))}
          </div>
        )}

        {/* Subtle Bottom-Left Control Hint */}
        <div className="pointer-events-none hidden lg:block fixed bottom-4 left-4 z-10 text-[11px] text-slate-300/80 bg-slate-950/75 border border-slate-800/80 rounded-lg px-2.5 py-1.5">
          Sol tık: İnşa · Sağ tık: Döndür · Kaydır: Yakınlaş · R: Çevir · WASD: Gezin
        </div>

        {/* Collapsible Bottom Control Dock */}
        <BottomDock
          collapsed={dockCollapsed}
          onToggleCollapse={() => setDockCollapsed((v) => !v)}
          activeTool={activeTool}
          activeCategory={activeCategory}
          rotation={rotation}
          simSpeed={simSpeed}
          gameMode={gameMode}
          budget={budget}
          canUndo={history.length > 0}
          onSelectTool={setActiveTool}
          onSelectCategory={setActiveCategory}
          onRotate={handleRotate}
          onUndo={handleUndo}
          onChangeSpeed={setSimSpeed}
          onResetCamera={() => viewportRef.current?.resetCamera()}
          onZoomIn={() => viewportRef.current?.zoomBy(0.84)}
          onZoomOut={() => viewportRef.current?.zoomBy(1.18)}
        />
      </main>
    </div>
  );
}
