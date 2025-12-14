
import React, { useMemo } from 'react';
import { StatisticValue } from '../types';

interface StatsChartProps {
  values: StatisticValue[];
  color?: string; // Allow passing specific color (Green/Red/DeptColor)
  inverted?: boolean;
  isDouble?: boolean; // New prop for double chart
}

const StatsChart: React.FC<StatsChartProps> = ({ values, color = "#3b82f6", inverted, isDouble }) => {
  const sortedValues = useMemo(() => {
    if (!values) return [];
    return [...values].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [values]);

  if (!values || values.length < 2) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-[10px] text-slate-300">Мало данных</p>
      </div>
    );
  }

  // Dimensions
  const width = 300;
  const height = 120; // Fixed height for the card slot
  const padding = 10;

  // --- DOUBLE GRAPH DATA GENERATION (MOCK FOR VISUAL) ---
  // Since we don't have separate DB values yet, we generate a second line 
  // that is slightly offset/inverted to simulate "Accounts Payable" vs "Reserves"
  const secondaryValues = useMemo(() => {
      if (!isDouble) return [];
      return sortedValues.map(v => ({
          ...v,
          // Simulate payables being roughly 40-60% of reserves but fluctuating inversely or randomly
          value: Math.max(0, v.value * (0.4 + Math.sin(new Date(v.date).getTime()) * 0.15))
      }));
  }, [sortedValues, isDouble]);

  // Scales
  const allValues = isDouble 
      ? [...sortedValues.map(v => v.value), ...secondaryValues.map(v => v.value)]
      : sortedValues.map(v => v.value);

  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;
  
  // Add padding to Y to prevent clipping at top/bottom edges
  const yMin = minVal - (range * 0.1);
  const yMax = maxVal + (range * 0.1);
  const yRange = yMax - yMin;

  const getX = (index: number) => {
    return padding + (index / (sortedValues.length - 1)) * (width - padding * 2);
  };

  const getY = (val: number) => {
    // Invert Y because SVG 0 is top
    return height - padding - ((val - yMin) / yRange) * (height - padding * 2);
  };

  // Generate Path for Primary Area (Reserves - Greenish usually if not specified)
  const linePoints = sortedValues.map((v, i) => `${getX(i)},${getY(v.value)}`).join(' ');
  const areaPoints = `${getX(0)},${height} ${linePoints} ${getX(sortedValues.length - 1)},${height}`;

  // Generate Path for Secondary Line (Payables - Red usually)
  const linePoints2 = secondaryValues.map((v, i) => `${getX(i)},${getY(v.value)}`).join(' ');

  // Colors for Double Graph
  const primaryColor = isDouble ? "#10b981" : color; // Emerald for Reserves
  const secondaryColor = "#ef4444"; // Red for Payables

  return (
    <div className="w-full h-full">
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <defs>
                <linearGradient id={`grad-${primaryColor.replace('#','')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={primaryColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={primaryColor} stopOpacity={0.05} />
                </linearGradient>
            </defs>

            {/* Grid Lines (Vertical) */}
            {[0.25, 0.5, 0.75].map(p => (
                <line key={`v-${p}`} x1={width * p} y1={0} x2={width * p} y2={height} stroke="#e2e8f0" strokeWidth="0.5" />
            ))}
            {/* Grid Lines (Horizontal) */}
            {[0.25, 0.5, 0.75].map(p => (
                <line key={`h-${p}`} x1={0} y1={height * p} x2={width} y2={height * p} stroke="#e2e8f0" strokeWidth="0.5" />
            ))}

            {/* Primary Area (Reserves) */}
            <path d={`M ${areaPoints} Z`} fill={`url(#grad-${primaryColor.replace('#','')})`} />

            {/* Primary Line */}
            <polyline 
                points={linePoints} 
                fill="none" 
                stroke={primaryColor} 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
            />

            {/* Secondary Line (Payables) - ONLY IF DOUBLE */}
            {isDouble && (
                <polyline 
                    points={linePoints2} 
                    fill="none" 
                    stroke={secondaryColor} 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeDasharray="4 4"
                />
            )}

            {/* Trendline (Only for primary if not double, to avoid clutter) */}
            {!isDouble && (
                <line 
                    x1={getX(0)} y1={getY(sortedValues[0].value)} 
                    x2={getX(sortedValues.length - 1)} y2={getY(sortedValues[sortedValues.length-1].value)} 
                    stroke="#94a3b8" 
                    strokeWidth="1" 
                    strokeDasharray="2 2" 
                    opacity="0.4"
                />
            )}

            {/* Dots */}
            {sortedValues.map((v, i) => (
                <circle key={`p1-${i}`} cx={getX(i)} cy={getY(v.value)} r="2" fill={primaryColor} />
            ))}
            
            {isDouble && secondaryValues.map((v, i) => (
                <circle key={`p2-${i}`} cx={getX(i)} cy={getY(v.value)} r="2" fill={secondaryColor} />
            ))}
        </svg>
    </div>
  );
};

export default StatsChart;
