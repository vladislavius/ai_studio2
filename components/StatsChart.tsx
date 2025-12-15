
import React, { useMemo, useState } from 'react';
import { StatisticValue } from '../types';
import { format, subDays, addDays } from 'date-fns';

interface StatsChartProps {
  values: StatisticValue[];
  color?: string;
  inverted?: boolean;
  isDouble?: boolean;
}

const StatsChart: React.FC<StatsChartProps> = ({ values, color = "#3b82f6", inverted, isDouble }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const sortedValues = useMemo(() => {
    if (!values) return [];
    // Ensure we don't have nulls or incomplete objects
    return [...values].filter(v => v && v.date && v.value !== undefined && v.value !== null).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [values]);

  // Handle empty state
  if (!sortedValues || sortedValues.length < 2) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Недостаточно данных</p>
        <p className="text-[10px] text-slate-300 mt-1">Требуется минимум 2 значения (1 неделя)</p>
      </div>
    );
  }

  // --- CONFIGURATION ---
  const SVG_WIDTH = 800;
  const SVG_HEIGHT = 250;
  const PADDING_X = 30; // Increased padding for dots not to be cut off
  const PADDING_Y = 30;

  // --- DATA PREPARATION ---
  
  const allValues = isDouble 
      ? [...sortedValues.map(v => v.value), ...sortedValues.map(v => v.value2 || 0)]
      : sortedValues.map(v => v.value);

  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const dataRange = maxVal - minVal || 1;
  
  const yMin = Math.max(0, minVal - (dataRange * 0.1));
  const yMax = maxVal + (dataRange * 0.1);
  const yRange = yMax - yMin;

  // --- COORDINATE MATH ---
  const getX = (index: number) => {
    return PADDING_X + (index / (sortedValues.length - 1)) * (SVG_WIDTH - PADDING_X * 2);
  };

  const getY = (val: number) => {
    return SVG_HEIGHT - PADDING_Y - ((val - yMin) / yRange) * (SVG_HEIGHT - PADDING_Y * 2);
  };

  // --- HELPER: Get Fiscal Week String (Thu-Wed) ---
  const getFiscalWeekString = (dateStr: string) => {
      const d = new Date(dateStr);
      const day = d.getDay(); // 0-Sun, 4-Thu
      // If entered on Thu, it's the start. If entered Wed, it's the end.
      // Usually entered at end of week. 
      // Assumption: Date stored is the end of the week or any day within.
      // Let's find the previous Thursday relative to this date
      
      const distToThu = (day + 7 - 4) % 7; 
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - distToThu);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Wednesday

      return `${format(startOfWeek, 'dd.MM')} - ${format(endOfWeek, 'dd.MM')}`;
  };

  // --- TREND LINE CALCULATION (Linear Regression) ---
  const calculateTrendLine = (data: typeof sortedValues) => {
      const n = data.length;
      if (n < 2) return null;

      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumXX = 0;

      data.forEach((v, x) => {
          const y = v.value;
          sumX += x;
          sumY += y;
          sumXY += x * y;
          sumXX += x * x;
      });

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      const startY = slope * 0 + intercept;
      const endY = slope * (n - 1) + intercept;

      return {
          x1: getX(0),
          y1: getY(startY),
          x2: getX(n - 1),
          y2: getY(endY)
      };
  };

  const trendLine = calculateTrendLine(sortedValues);

  // --- PATH GENERATION ---
  const generatePath = (data: typeof sortedValues, valueKey: 'value' | 'value2') => {
      return data.map((v, i) => {
          const val = valueKey === 'value' ? v.value : (v.value2 || 0);
          return `${i === 0 ? 'M' : 'L'} ${getX(i)},${getY(val)}`
      }).join(' ');
  };

  const generateAreaPath = (data: typeof sortedValues) => {
      const line = generatePath(data, 'value');
      return `${line} L ${getX(data.length - 1)},${SVG_HEIGHT - PADDING_Y} L ${getX(0)},${SVG_HEIGHT - PADDING_Y} Z`;
  };

  const primaryPath = generatePath(sortedValues, 'value');
  const primaryArea = generateAreaPath(sortedValues);
  const secondaryPath = isDouble ? generatePath(sortedValues, 'value2') : '';

  const mainColor = isDouble ? "#10b981" : color;
  const secondColor = "#ef4444"; 

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const effectiveWidth = rect.width - (rect.width * (PADDING_X * 2 / SVG_WIDTH));
      const relativeX = x - (rect.width * (PADDING_X / SVG_WIDTH));
      let idx = Math.round((relativeX / effectiveWidth) * (sortedValues.length - 1));
      idx = Math.max(0, Math.min(sortedValues.length - 1, idx));
      setHoveredIndex(idx);
  };

  return (
    <div className="w-full h-full relative group bg-white select-none rounded-xl">
        {/* TOOLTIP */}
        {hoveredIndex !== null && (() => {
            const point = sortedValues[hoveredIndex];
            const pxX = getX(hoveredIndex);
            const pxY = getY(point.value);
            
            // Smart Positioning Logic
            const isNearTop = pxY < (SVG_HEIGHT * 0.4); // If in top 40%
            const isNearLeft = hoveredIndex < 2;
            const isNearRight = hoveredIndex > sortedValues.length - 3;
            
            // Horizontal shift
            let transformX = '-50%';
            let marginLeft = '0px';
            if (isNearLeft) { transformX = '0%'; marginLeft = '5px'; }
            if (isNearRight) { transformX = '-100%'; marginLeft = '-5px'; }
            
            // Vertical shift (Flip down if near top)
            // 'mt-3' pushes it down (below point), '-mt-3' pulls it closer when above
            const verticalClass = isNearTop 
                ? 'translate-y-2'  // Move Down
                : '-translate-y-full -mt-3'; // Move Up

            return (
                <div 
                    className={`absolute z-50 pointer-events-none bg-slate-800/95 backdrop-blur-sm text-white text-[10px] rounded-lg py-1.5 px-2.5 shadow-xl transition-all duration-75 flex flex-col gap-0.5 min-w-[100px] border border-slate-700 ${verticalClass}`}
                    style={{ 
                        left: `${(pxX / SVG_WIDTH) * 100}%`, 
                        top: `${(pxY / SVG_HEIGHT) * 100}%`,
                        transform: `translateX(${transformX})`,
                        marginLeft: marginLeft
                    }}
                >
                    <div className="font-bold text-[9px] uppercase tracking-wider opacity-60 border-b border-slate-600 pb-1 mb-1 text-center">
                        Неделя: {getFiscalWeekString(point.date)}
                    </div>
                    <div className="flex justify-between gap-3 items-center">
                        <span className="opacity-80 font-medium">{isDouble ? 'Вал 1:' : 'Значение:'}</span>
                        <span className="font-mono font-bold text-sm" style={{color: mainColor}}>{point.value.toLocaleString()}</span>
                    </div>
                    {isDouble && (
                        <div className="flex justify-between gap-3 items-center">
                            <span className="opacity-80 font-medium">Вал 2:</span>
                            <span className="font-mono font-bold text-rose-400">{(point.value2 || 0).toLocaleString()}</span>
                        </div>
                    )}
                </div>
            );
        })()}

        <svg 
            width="100%" 
            height="100%" 
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} 
            preserveAspectRatio="none"
            className="overflow-visible"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredIndex(null)}
        >
            <defs>
                <linearGradient id={`grad-main-${mainColor}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={mainColor} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={mainColor} stopOpacity={0.02} />
                </linearGradient>
            </defs>

            {/* --- GRID --- */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const y = SVG_HEIGHT - PADDING_Y - (t * (SVG_HEIGHT - PADDING_Y * 2));
                const val = yMin + (t * yRange);
                return (
                    <g key={t}>
                        <line x1={PADDING_X} y1={y} x2={SVG_WIDTH - PADDING_X} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                        <text x={PADDING_X - 8} y={y + 3} fontSize="9" fill="#94a3b8" textAnchor="end" fontWeight="500">{Math.round(val)}</text>
                    </g>
                );
            })}

            {/* --- TREND LINE (Dashed) --- */}
            {trendLine && (
                <line 
                    x1={trendLine.x1} 
                    y1={trendLine.y1} 
                    x2={trendLine.x2} 
                    y2={trendLine.y2} 
                    stroke="#94a3b8" 
                    strokeWidth="2" 
                    strokeDasharray="6 4" 
                    opacity="0.6"
                />
            )}

            {/* --- AREAS & LINES --- */}
            {/* We only fill area for primary line to keep it clean */}
            {!isDouble && <path d={primaryArea} fill={`url(#grad-main-${mainColor})`} />}
            
            <path 
                d={primaryPath} 
                fill="none" 
                stroke={mainColor} 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="drop-shadow-sm"
            />

            {isDouble && (
                <path 
                    d={secondaryPath} 
                    fill="none" 
                    stroke={secondColor} 
                    strokeWidth="2" 
                    strokeDasharray="4 2"
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                />
            )}

            {/* --- DISTINCT DOTS (POINTS) --- */}
            {sortedValues.map((v, i) => (
                <circle
                    key={`dot-${i}`}
                    cx={getX(i)}
                    cy={getY(v.value)}
                    r="3.5"
                    fill="white"
                    stroke={mainColor}
                    strokeWidth="2"
                    className="transition-all duration-200"
                    style={{ 
                        r: hoveredIndex === i ? 6 : 3.5,
                        strokeWidth: hoveredIndex === i ? 3 : 2
                    }}
                />
            ))}

            {isDouble && sortedValues.map((v, i) => (
                <circle
                    key={`sec-dot-${i}`}
                    cx={getX(i)}
                    cy={getY(v.value2 || 0)}
                    r="3"
                    fill="white"
                    stroke={secondColor}
                    strokeWidth="1.5"
                />
            ))}

            {/* --- X AXIS LABELS --- */}
            {sortedValues.length > 1 && (
                <>
                    <text x={PADDING_X} y={SVG_HEIGHT - 10} fontSize="10" fill="#64748b" fontWeight="600" textAnchor="start">
                        {format(new Date(sortedValues[0].date), 'dd.MM')}
                    </text>
                    <text x={SVG_WIDTH - PADDING_X} y={SVG_HEIGHT - 10} fontSize="10" fill="#64748b" fontWeight="600" textAnchor="end">
                        {format(new Date(sortedValues[sortedValues.length - 1].date), 'dd.MM')}
                    </text>
                </>
            )}
        </svg>
    </div>
  );
};

export default StatsChart;
