import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { BarChart3, PieChart, TrendingUp, X } from 'lucide-react';
import { getBuildingEffectiveStats } from '../game/simulation';
import {
  BUILDING_CATALOG,
  BuildingType,
  CityGrid,
  CityStats,
  GameMode,
  GRID_SIZE,
  HistorySnapshot,
} from '../game/types';

interface CityAnalyticsPanelProps {
  open: boolean;
  grid: CityGrid;
  stats: CityStats;
  budget: number;
  gameMode: GameMode;
  history: HistorySnapshot[];
  onClose: () => void;
}

type AnalyticsTab = 'distribution' | 'finance';
type SeriesMetric = 'budget' | 'netIncome';

interface BuildingCountDatum {
  type: BuildingType;
  name: string;
  shortName: string;
  categoryLabel: string;
  color: string;
  count: number;
  share: number;
  netIncomeSum: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  infra: 'Altyapı',
  residential: 'Konut',
  commercial: 'Ticaret & Sanayi',
  civic: 'Park & Kamu',
};

export const CityAnalyticsPanel: React.FC<CityAnalyticsPanelProps> = ({
  open,
  grid,
  stats,
  budget,
  gameMode,
  history,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('distribution');
  const [seriesMetric, setSeriesMetric] = useState<SeriesMetric>('budget');
  const [hoveredType, setHoveredType] = useState<BuildingType | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const yAxisRef = useRef<SVGGElement | null>(null);
  const xAxisRef = useRef<SVGGElement | null>(null);

  // Aggregate building distribution & cashflow per type from grid
  const distributionData = useMemo<BuildingCountDatum[]>(() => {
    const counts = new Map<BuildingType, { count: number; netIncomeSum: number }>();
    let total = 0;

    for (let gz = 0; gz < GRID_SIZE; gz++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const b = grid[gz][gx];
        if (!b) continue;
        total += 1;
        const eff = getBuildingEffectiveStats(b);
        const prev = counts.get(b.type) ?? { count: 0, netIncomeSum: 0 };
        counts.set(b.type, {
          count: prev.count + 1,
          netIncomeSum: prev.netIncomeSum + eff.taxIncome,
        });
      }
    }

    const list: BuildingCountDatum[] = [];
    counts.forEach((val, type) => {
      const def = BUILDING_CATALOG[type];
      list.push({
        type,
        name: def.name,
        shortName: def.shortName,
        categoryLabel: CATEGORY_LABELS[def.category] ?? def.category,
        color: def.accentColor,
        count: val.count,
        share: total > 0 ? (val.count / total) * 100 : 0,
        netIncomeSum: val.netIncomeSum,
      });
    });

    list.sort((a, b) => b.count - a.count);
    return list;
  }, [grid]);

  const totalStructures = useMemo(
    () => distributionData.reduce((acc, item) => acc + item.count, 0),
    [distributionData],
  );

  // D3 Donut Geometry
  const donutSize = 176;
  const donutRadius = donutSize / 2;

  const pieSlices = useMemo(() => {
    const pieGen = d3
      .pie<BuildingCountDatum>()
      .sort(null)
      .value((d) => d.count)
      .padAngle(0.025);

    const arcNormal = d3
      .arc<d3.PieArcDatum<BuildingCountDatum>>()
      .innerRadius(donutRadius * 0.56)
      .outerRadius(donutRadius * 0.88)
      .cornerRadius(3);

    const arcHover = d3
      .arc<d3.PieArcDatum<BuildingCountDatum>>()
      .innerRadius(donutRadius * 0.56)
      .outerRadius(donutRadius * 0.96)
      .cornerRadius(3);

    return pieGen(distributionData).map((slice) => ({
      data: slice.data,
      pathNormal: arcNormal(slice) ?? '',
      pathHover: arcHover(slice) ?? '',
    }));
  }, [distributionData, donutRadius]);

  const hoveredItem = useMemo(
    () => distributionData.find((d) => d.type === hoveredType) ?? null,
    [distributionData, hoveredType],
  );

  const maxCount = useMemo(
    () => d3.max(distributionData, (d) => d.count) ?? 1,
    [distributionData],
  );

  const countBarScale = useMemo(
    () => d3.scaleLinear().domain([0, maxCount]).range([0, 100]),
    [maxCount],
  );

  // D3 Time-Series Chart Scales & Paths
  const chartW = 372;
  const chartH = 168;
  const margin = { top: 14, right: 12, bottom: 24, left: 52 };
  const innerW = chartW - margin.left - margin.right;
  const innerH = chartH - margin.top - margin.bottom;

  const chartModel = useMemo(() => {
    const points = history.length > 0 ? history : [];
    const values = points.map((p) =>
      seriesMetric === 'budget' ? p.budget : p.netIncome,
    );

    const minVal = d3.min(values) ?? 0;
    const maxVal = d3.max(values) ?? 100;
    const span = Math.max(10, maxVal - minVal);
    const yMin =
      seriesMetric === 'budget'
        ? Math.max(0, minVal - span * 0.15)
        : Math.min(0, minVal - span * 0.15);
    const yMax = maxVal + span * 0.15;

    const xScale = d3
      .scaleLinear()
      .domain([0, Math.max(1, points.length - 1)])
      .range([0, innerW]);

    const yScale = d3.scaleLinear().domain([yMin, yMax]).nice().range([innerH, 0]);

    const lineGen = d3
      .line<HistorySnapshot>()
      .x((_, i) => xScale(i))
      .y((d) =>
        yScale(seriesMetric === 'budget' ? d.budget : d.netIncome),
      )
      .curve(d3.curveMonotoneX);

    const areaGen = d3
      .area<HistorySnapshot>()
      .x((_, i) => xScale(i))
      .y0(innerH)
      .y1((d) =>
        yScale(seriesMetric === 'budget' ? d.budget : d.netIncome),
      )
      .curve(d3.curveMonotoneX);

    return {
      points,
      xScale,
      yScale,
      linePath: points.length >= 2 ? lineGen(points) ?? '' : '',
      areaPath: points.length >= 2 ? areaGen(points) ?? '' : '',
    };
  }, [history, innerH, innerW, seriesMetric]);

  // Render D3 Axes via refs when Finance tab is visible
  useEffect(() => {
    if (!open || activeTab !== 'finance') return;

    if (yAxisRef.current) {
      const yAxis = d3
        .axisLeft(chartModel.yScale)
        .ticks(4)
        .tickSize(-innerW)
        .tickFormat((val) => {
          const n = Number(val);
          if (Math.abs(n) >= 1000) return `₺${(n / 1000).toFixed(1)}k`;
          return `₺${Math.round(n)}`;
        });

      const g = d3.select(yAxisRef.current);
      g.call(yAxis);
      g.select('.domain').remove();
      g.selectAll('.tick line')
        .attr('stroke', 'rgba(148, 163, 184, 0.12)')
        .attr('stroke-dasharray', '2,2');
      g.selectAll('.tick text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'JetBrains Mono, monospace');
    }

    if (xAxisRef.current) {
      const count = chartModel.points.length;
      const xAxis = d3
        .axisBottom(chartModel.xScale)
        .ticks(Math.min(5, Math.max(2, count - 1)))
        .tickSize(0)
        .tickFormat((idx) => {
          const pt = chartModel.points[Math.round(Number(idx))];
          return pt ? pt.timestamp : '';
        });

      const g = d3.select(xAxisRef.current);
      g.call(xAxis);
      g.select('.domain').attr('stroke', 'rgba(148, 163, 184, 0.2)');
      g.selectAll('.tick text')
        .attr('fill', '#64748b')
        .attr('font-size', '10px')
        .attr('dy', '10px')
        .attr('font-family', 'JetBrains Mono, monospace');
    }
  }, [open, activeTab, chartModel, innerW]);

  // D3 Diverging Cashflow Data
  const cashflowItems = useMemo(() => {
    return [...distributionData]
      .filter((d) => d.netIncomeSum !== 0)
      .sort((a, b) => Math.abs(b.netIncomeSum) - Math.abs(a.netIncomeSum))
      .slice(0, 7);
  }, [distributionData]);

  const maxAbsCashflow = useMemo(
    () => Math.max(50, d3.max(cashflowItems, (d) => Math.abs(d.netIncomeSum)) ?? 50),
    [cashflowItems],
  );

  const cashflowScale = useMemo(
    () => d3.scaleLinear().domain([0, maxAbsCashflow]).range([0, 100]),
    [maxAbsCashflow],
  );

  if (!open) return null;

  const activePoint =
    hoveredIndex !== null && chartModel.points[hoveredIndex]
      ? chartModel.points[hoveredIndex]
      : chartModel.points[chartModel.points.length - 1] ?? null;

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (chartModel.points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * chartW - margin.left;
    const clamped = Math.max(0, Math.min(innerW, relX));
    const idx = Math.round(chartModel.xScale.invert(clamped));
    setHoveredIndex(Math.max(0, Math.min(chartModel.points.length - 1, idx)));
  };

  const accentStroke = seriesMetric === 'budget' ? '#38bdf8' : '#34d399';

  return (
    <>
      {/* Mobile backdrop scrim to close bottom sheet */}
      <div
        className="sm:hidden fixed inset-0 z-20 bg-slate-950/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="pointer-events-auto fixed inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto sm:top-16 sm:right-3 lg:right-4 z-30 sm:z-20 w-full sm:w-[376px] lg:w-[416px] max-h-[80dvh] sm:max-h-[calc(100dvh-11rem)] flex flex-col rounded-t-3xl sm:rounded-2xl bg-slate-950/95 border-t sm:border border-slate-800 shadow-2xl text-slate-100 overflow-hidden pb-safe">
        {/* Mobile Sheet Grab Handle */}
        <div className="sm:hidden w-10 h-1.5 bg-slate-700 rounded-full mx-auto mt-2.5 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <BarChart3 className="w-4 h-4 text-sky-400 shrink-0" />
            <h2 className="font-display text-sm font-bold text-white tracking-tight truncate">
              Şehir Analitiği
            </h2>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Interactive Tab Switcher */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('distribution')}
                className={`flex items-center gap-1.5 min-h-[34px] sm:min-h-0 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === 'distribution'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <PieChart className="w-3.5 h-3.5" />
                <span>Dağılım</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('finance')}
                className={`flex items-center gap-1.5 min-h-[34px] sm:min-h-0 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === 'finance'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Bütçe & Gelir</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Analitik Panelini Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

      {/* Body */}
      <div className="p-4 overflow-y-auto space-y-4">
        {activeTab === 'distribution' ? (
          totalStructures === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-medium text-slate-300">
                Haritada henüz yapı bulunmuyor
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Alt araç çubuğundan yol, konut veya altyapı ekleyerek D3 bina dağılım grafiğini canlı görüntüleyin.
              </p>
            </div>
          ) : (
            <>
              {/* D3 Donut + Summary Row */}
              <div className="flex items-center gap-5 pb-4 border-b border-slate-800/80">
                <div className="relative shrink-0" style={{ width: donutSize, height: donutSize }}>
                  <svg
                    width={donutSize}
                    height={donutSize}
                    viewBox={`0 0 ${donutSize} ${donutSize}`}
                    className="overflow-visible"
                  >
                    <g transform={`translate(${donutRadius}, ${donutRadius})`}>
                      {pieSlices.map((slice) => {
                        const isHovered = hoveredType === slice.data.type;
                        return (
                          <path
                            key={slice.data.type}
                            d={isHovered ? slice.pathHover : slice.pathNormal}
                            fill={slice.data.color}
                            fillOpacity={
                              hoveredType && !isHovered ? 0.42 : 0.95
                            }
                            stroke="#020617"
                            strokeWidth={1.5}
                            className="cursor-pointer transition-opacity duration-150"
                            onMouseEnter={() => setHoveredType(slice.data.type)}
                            onMouseLeave={() => setHoveredType(null)}
                          />
                        );
                      })}
                    </g>
                  </svg>

                  {/* Center Readout */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-3">
                    <span className="text-[11px] text-slate-400 truncate max-w-[90px]">
                      {hoveredItem ? hoveredItem.shortName : 'Toplam Yapı'}
                    </span>
                    <span className="font-mono-tabular text-xl font-bold text-white leading-tight">
                      {hoveredItem ? hoveredItem.count : totalStructures}
                    </span>
                    <span className="font-mono-tabular text-[11px] text-slate-400">
                      {hoveredItem
                        ? `%${hoveredItem.share.toFixed(1)}`
                        : `${distributionData.length} tip`}
                    </span>
                  </div>
                </div>

                {/* Key Structural Totals */}
                <div className="flex-1 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-400">Bina Sayısı</span>
                    <span className="font-mono-tabular font-semibold text-white">
                      {stats.buildingCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-400">Yol Parseli</span>
                    <span className="font-mono-tabular font-semibold text-white">
                      {stats.roadCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-400">İstihdam</span>
                    <span className="font-mono-tabular font-semibold text-sky-300">
                      {stats.jobs} kişi
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Net Döngü</span>
                    <span
                      className={`font-mono-tabular font-semibold ${
                        stats.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {stats.netIncome >= 0 ? '+' : ''}₺{stats.netIncome}
                    </span>
                  </div>
                </div>
              </div>

              {/* D3 Proportional Bar Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Yapı Tipi · Kategori</span>
                  <span>Adet · Oran</span>
                </div>

                <div className="divide-y divide-slate-800/60">
                  {distributionData.map((item) => {
                    const widthPct = countBarScale(item.count);
                    const isHovered = hoveredType === item.type;
                    return (
                      <div
                        key={item.type}
                        onMouseEnter={() => setHoveredType(item.type)}
                        onMouseLeave={() => setHoveredType(null)}
                        className={`py-2 px-1.5 -mx-1.5 rounded-lg transition-colors cursor-default ${
                          isHovered ? 'bg-slate-900' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="font-medium text-slate-100 truncate">
                              {item.name}
                            </span>
                            <span className="text-[11px] text-slate-500 shrink-0">
                              · {item.categoryLabel}
                            </span>
                          </div>
                          <div className="font-mono-tabular text-xs text-slate-300 shrink-0">
                            <span className="font-semibold text-white">
                              {item.count}
                            </span>
                            <span className="text-slate-500 ml-1.5">
                              %{item.share.toFixed(0)}
                            </span>
                          </div>
                        </div>

                        <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-200"
                            style={{
                              width: `${Math.max(4, widthPct)}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )
        ) : (
          <>
            {/* Finance Tab: Metric Toggle + D3 Interactive Area/Line Chart */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setSeriesMetric('budget')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    seriesMetric === 'budget'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Bütçe (₺)
                </button>
                <button
                  type="button"
                  onClick={() => setSeriesMetric('netIncome')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    seriesMetric === 'netIncome'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Net Gelir (₺/döngü)
                </button>
              </div>

              <span className="text-[11px] text-slate-400">
                {gameMode === 'sandbox' ? 'Kum Havuzu · Tahmini Hazine' : 'Canlı Hazine'}
              </span>
            </div>

            {/* Active Hover Readout Strip */}
            {activePoint && (
              <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
                <div>
                  <div className="text-[11px] text-slate-400">
                    Zaman ({activePoint.timestamp})
                  </div>
                  <div className="font-mono-tabular font-semibold text-white">
                    ₺{(hoveredIndex !== null ? activePoint.budget : budget).toLocaleString('tr-TR')}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Döngü Geliri</div>
                  <div
                    className={`font-mono-tabular font-semibold ${
                      activePoint.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {activePoint.netIncome >= 0 ? '+' : ''}₺{activePoint.netIncome}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Nüfus</div>
                  <div className="font-mono-tabular font-semibold text-amber-300">
                    {activePoint.population.toLocaleString('tr-TR')}
                  </div>
                </div>
              </div>
            )}

            {/* D3 SVG Area/Line Chart */}
            <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-2">
              {chartModel.points.length < 2 ? (
                <div className="h-[168px] flex items-center justify-center text-xs text-slate-400 text-center px-4">
                  Değişim eğrisini görmek için bina ekleyin veya simülasyon döngüsünü bekleyin.
                </div>
              ) : (
                <svg
                  viewBox={`0 0 ${chartW} ${chartH}`}
                  className="w-full h-auto cursor-crosshair select-none"
                  onPointerMove={handleSvgPointerMove}
                  onPointerLeave={() => setHoveredIndex(null)}
                >
                  <defs>
                    <linearGradient id="d3AreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={accentStroke} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={accentStroke} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>

                  <g transform={`translate(${margin.left}, ${margin.top})`}>
                    <g ref={yAxisRef} />
                    <g ref={xAxisRef} transform={`translate(0, ${innerH})`} />

                    {/* Zero baseline when netIncome crosses zero */}
                    {seriesMetric === 'netIncome' &&
                      chartModel.yScale.domain()[0] < 0 &&
                      chartModel.yScale.domain()[1] > 0 && (
                        <line
                          x1={0}
                          x2={innerW}
                          y1={chartModel.yScale(0)}
                          y2={chartModel.yScale(0)}
                          stroke="rgba(248, 113, 113, 0.45)"
                          strokeWidth={1}
                          strokeDasharray="3,3"
                        />
                      )}

                    <path d={chartModel.areaPath} fill="url(#d3AreaGrad)" />
                    <path
                      d={chartModel.linePath}
                      fill="none"
                      stroke={accentStroke}
                      strokeWidth={2}
                    />

                    {/* Hover crosshair & point */}
                    {hoveredIndex !== null && chartModel.points[hoveredIndex] && (
                      <>
                        <line
                          x1={chartModel.xScale(hoveredIndex)}
                          x2={chartModel.xScale(hoveredIndex)}
                          y1={0}
                          y2={innerH}
                          stroke="rgba(226, 232, 240, 0.35)"
                          strokeWidth={1}
                        />
                        <circle
                          cx={chartModel.xScale(hoveredIndex)}
                          cy={chartModel.yScale(
                            seriesMetric === 'budget'
                              ? chartModel.points[hoveredIndex].budget
                              : chartModel.points[hoveredIndex].netIncome,
                          )}
                          r={4}
                          fill={accentStroke}
                          stroke="#020617"
                          strokeWidth={2}
                        />
                      </>
                    )}
                  </g>
                </svg>
              )}
            </div>

            {/* D3 Diverging Cashflow Breakdown by Building Type */}
            <div className="space-y-2 pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Gelir / Gider Kalemleri</span>
                <span>Döngü Etkisi</span>
              </div>

              {cashflowItems.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  Gelir veya bakım gideri oluşturan yapı henüz yok.
                </p>
              ) : (
                <div className="space-y-2">
                  {cashflowItems.map((item) => {
                    const isPositive = item.netIncomeSum >= 0;
                    const barPct = cashflowScale(Math.abs(item.netIncomeSum));
                    return (
                      <div key={item.type} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-200 truncate">
                            {item.name} ({item.count})
                          </span>
                          <span
                            className={`font-mono-tabular font-semibold ${
                              isPositive ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isPositive ? '+' : ''}₺{item.netIncomeSum}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div className="flex justify-end border-r border-slate-700/80">
                            {!isPositive && (
                              <div
                                className="h-full bg-rose-500 rounded-l-full"
                                style={{ width: `${Math.max(6, barPct)}%` }}
                              />
                            )}
                          </div>
                          <div className="flex justify-start">
                            {isPositive && (
                              <div
                                className="h-full bg-emerald-500 rounded-r-full"
                                style={{ width: `${Math.max(6, barPct)}%` }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
    </>
  );
};
