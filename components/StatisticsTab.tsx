
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { StatisticDefinition, StatisticValue, WiseCondition, Employee } from '../types';
import { ORGANIZATION_STRUCTURE, HANDBOOK_STATISTICS, CONDITION_FORMULAS, WISE_CONDITIONS } from '../constants';
import StatsChart from './StatsChart';
import { TrendingUp, TrendingDown, ArrowRight, Zap, List, X, Building2, LayoutDashboard, Edit2, Trash2, Calendar, Plus, Search, Filter, Layers, Info, HelpCircle, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';

interface StatisticsTabProps {
  employees: Employee[];
  isOffline?: boolean;
  selectedDeptId?: string | null;
  isAdmin?: boolean;
}

// Helper to replace date-fns/subWeeks locally to ensure compatibility
// UPDATED: Used for variable timeframe calculation
const subMonths = (date: Date, months: number) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() - months);
    return result;
};

// --- CONSTANTS ---
const DEMO_DEFINITIONS: StatisticDefinition[] = HANDBOOK_STATISTICS.map((s, i) => ({ ...s, id: `demo-stat-${i}`, type: 'department', is_favorite: s.title.includes('(ГСД)') }));
const generateMockHistory = (baseVal: number, weeks: number = 52) => {
    return Array.from({ length: weeks }).map((_, i) => {
        const weekOffset = weeks - 1 - i;
        const d = new Date();
        d.setDate(d.getDate() - (weekOffset * 7));
        
        // Create a realistic-looking curve
        const trend = Math.sin(i / 8) * (baseVal * 0.1) + (i / weeks * baseVal * 0.4); 
        const noise = (Math.random() - 0.5) * (baseVal * 0.1); 
        let val = Math.max(0, Math.floor(baseVal + trend + noise));
        return { id: `mock-val-${Date.now()}-${i}`, definition_id: 'temp', date: format(d, 'yyyy-MM-dd'), value: val };
    });
};
const DEMO_VALUES: Record<string, StatisticValue[]> = {};
DEMO_DEFINITIONS.forEach((def) => { let base = 100; if (def.title.includes('Выручка') || def.title.includes('Доход')) base = 1500000; DEMO_VALUES[def.id] = generateMockHistory(base, 52).map(v => ({...v, definition_id: def.id})); });

const DEPT_ORDER = ['owner', 'dept7', 'dept1', 'dept2', 'dept3', 'dept4', 'dept5', 'dept6'];

// UPDATED PERIODS: Since data is Weekly, "1 Week" is just a dot. Removed 1w/3w.
// Added All Time option.
const PERIODS = [
    { id: '1m', label: 'Месяц', months: 1 },
    { id: '3m', label: '3 Мес', months: 3 },
    { id: '6m', label: 'Полгода', months: 6 },
    { id: '1y', label: 'Год', months: 12 },
    { id: 'all', label: 'Все', months: 999 },
];

const analyzeTrend = (vals: StatisticValue[], inverted: boolean = false) => {
    if (!vals || vals.length < 1) return { condition: 'non_existence' as WiseCondition, change: 0, current: 0, prev: 0, diff: 0 };
    
    // Sort by date ascending
    const sorted = [...vals].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const currentVal = sorted[sorted.length - 1].value;
    // Standard Trend: Always compare against previous period (week), regardless of view window
    const prevVal = sorted.length > 1 ? sorted[sorted.length - 2].value : 0;
    
    let change = 0;
    let diff = currentVal - prevVal;

    if (prevVal !== 0) change = (currentVal - prevVal) / Math.abs(prevVal);
    else if (currentVal > 0) change = 1; // 0 to something is 100% growth effectively
    
    let condition: WiseCondition = 'normal';
    // Simplified logic
    if (change > 0.1) condition = 'affluence';
    else if (change > 0) condition = 'normal';
    else if (change > -0.1) condition = 'emergency';
    else condition = 'danger';

    if (inverted) {
        change = -change;
        // Invert condition logic approximately
        if (condition === 'affluence') condition = 'danger';
        else if (condition === 'danger') condition = 'affluence';
        else if (condition === 'normal') condition = 'emergency';
        else if (condition === 'emergency') condition = 'normal';
    }
    
    return { condition, change, current: currentVal, prev: prevVal, diff };
};

const StatisticsTab: React.FC<StatisticsTabProps> = ({ employees, isOffline, selectedDeptId, isAdmin }) => {
  const [definitions, setDefinitions] = useState<StatisticDefinition[]>([]);
  const [allLatestValues, setAllLatestValues] = useState<Record<string, StatisticValue[]>>({});
  const [loading, setLoading] = useState(false);
  const [displayMode, setDisplayMode] = useState<'dashboard' | 'list'>('dashboard');
  
  // Filtering & Search
  const [selectedPeriod, setSelectedPeriod] = useState<string>('3m');
  const [listSearchTerm, setListSearchTerm] = useState('');

  // Info Card State (Controls which card is flipped to show description)
  const [infoCardId, setInfoCardId] = useState<string | null>(null);

  // Editing State (Merged Engineering)
  const [editingDef, setEditingDef] = useState<Partial<StatisticDefinition> | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Values Editing State
  const [isValueModalOpen, setIsValueModalOpen] = useState(false);
  const [selectedStatForValues, setSelectedStatForValues] = useState<StatisticDefinition | null>(null);
  const [currentStatValues, setCurrentStatValues] = useState<StatisticValue[]>([]);
  const [editingValue, setEditingValue] = useState<Partial<StatisticValue>>({});

  useEffect(() => { fetchDefinitions(); fetchAllValues(); }, [isOffline]); 

  const fetchDefinitions = async () => {
    setLoading(true);
    if (isOffline) { setDefinitions(DEMO_DEFINITIONS); } 
    else if (supabase) {
        const { data } = await supabase.from('statistics_definitions').select('*').order('title');
        if (data) setDefinitions(data);
    }
    setLoading(false);
  };

  const fetchAllValues = async () => {
      if (isOffline) { setAllLatestValues(DEMO_VALUES); return; }
      if (supabase) {
          const { data } = await supabase.from('statistics_values').select('*');
          if (data) {
              const grouped: Record<string, StatisticValue[]> = {};
              data.forEach((v: StatisticValue) => {
                  if (!grouped[v.definition_id]) grouped[v.definition_id] = [];
                  grouped[v.definition_id].push(v);
              });
              setAllLatestValues(grouped);
          }
      }
  };

  // --- LOGIC ---
  const getFilteredValues = (statId: string) => {
      const vals = allLatestValues[statId] || [];
      if (!vals.length) return [];
      
      const months = PERIODS.find(p => p.id === selectedPeriod)?.months || 3;
      
      if (months === 999) return vals; // All time

      const cutoffDate = subMonths(new Date(), months);
      const cutoffString = format(cutoffDate, 'yyyy-MM-dd');
      
      const filtered = vals.filter(v => v.date >= cutoffString);
      
      // Ensure we have at least the last 2 points if they exist, even if cutoff is aggressive, for trend calculation context (though visual will be cut)
      if (filtered.length < 2 && vals.length >= 2) {
          // Fallback to showing at least some recent data if the period is empty
          const sorted = [...vals].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          return sorted.slice(-4); // Show last 4 points minimum if filter is too empty
      }
      
      return filtered;
  };

  const getOwnerName = (ownerId: string) => {
      if (ORGANIZATION_STRUCTURE[ownerId]) return ORGANIZATION_STRUCTURE[ownerId].name;
      for(const key in ORGANIZATION_STRUCTURE) {
          const d = ORGANIZATION_STRUCTURE[key];
          if (d.departments && d.departments[ownerId]) return d.departments[ownerId].name;
      }
      return ownerId;
  };

  const getParentDeptId = (ownerId: string): string => {
      if (ORGANIZATION_STRUCTURE[ownerId]) return ownerId;
      for(const key in ORGANIZATION_STRUCTURE) {
          const d = ORGANIZATION_STRUCTURE[key];
          if (d.departments && d.departments[ownerId]) return key;
      }
      return 'other';
  };

  // --- CRUD ---
  const handleSaveDef = async () => {
    if (!editingDef || !supabase) return;
    if (editingDef.id) await supabase.from('statistics_definitions').update(editingDef).eq('id', editingDef.id);
    else await supabase.from('statistics_definitions').insert([editingDef]);
    setIsEditModalOpen(false); fetchDefinitions();
  };

  const handleDeleteDef = async (id: string) => {
      if(!confirm("Вы уверены? Это удалит статистику и все данные.")) return;
      if (!supabase) return;
      await supabase.from('statistics_values').delete().eq('definition_id', id);
      await supabase.from('statistics_definitions').delete().eq('id', id);
      fetchDefinitions();
  };

  const handleOpenValues = async (stat: StatisticDefinition) => {
      // Allow viewing values, but edit only if admin? 
      // For now, let's say only admin can input data.
      if (!isAdmin) return;

      setSelectedStatForValues(stat);
      if(supabase) {
          const { data } = await supabase.from('statistics_values').select('*').eq('definition_id', stat.id).order('date', {ascending: false});
          setCurrentStatValues(data || []);
      }
      setEditingValue({ definition_id: stat.id, date: new Date().toISOString().split('T')[0], value: 0 });
      setIsValueModalOpen(true);
  };

  const handleSaveValue = async () => {
      if (!editingValue || !supabase) return;
      if (editingValue.id) await supabase.from('statistics_values').update({ value: editingValue.value, date: editingValue.date }).eq('id', editingValue.id);
      else await supabase.from('statistics_values').insert([{ definition_id: selectedStatForValues?.id, date: editingValue.date, value: editingValue.value }]);
      
      if (selectedStatForValues) {
          const { data } = await supabase.from('statistics_values').select('*').eq('definition_id', selectedStatForValues.id).order('date', {ascending: false});
          setCurrentStatValues(data || []);
      }
      fetchAllValues();
      setEditingValue({ definition_id: selectedStatForValues?.id, date: new Date().toISOString().split('T')[0], value: 0 });
  };

  const handleDeleteValue = async (id: string) => {
      if (!supabase) return;
      await supabase.from('statistics_values').delete().eq('id', id);
       if (selectedStatForValues) {
          const { data } = await supabase.from('statistics_values').select('*').eq('definition_id', selectedStatForValues.id).order('date', {ascending: false});
          setCurrentStatValues(data || []);
      }
      fetchAllValues();
  };


  // --- RENDER CARD ---

  const renderStatCard = (stat: StatisticDefinition, deptColor: string) => {
      const vals = getFilteredValues(stat.id); // This will return LESS items based on period
      
      // Analyze trend uses the last 2 points available in the filtered set.
      const { current, change, diff, condition } = analyzeTrend(vals, stat.inverted);
      
      // Determine Trend Color for Chart LINE ONLY
      const isPos = change >= 0;
      const trendColorHex = isPos ? "#10b981" : "#f43f5e"; // Emerald-500 or Rose-500
      
      const isInfoOpen = infoCardId === stat.id;

      return (
          <div 
            key={stat.id} 
            className="relative bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[340px] transition-all hover:-translate-y-1 hover:shadow-xl group"
          >
              {/* Colored Top Border for Dept Identity */}
              <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{backgroundColor: deptColor}}></div>

              {/* TINTED UPPER SECTION (Header + Values) */}
              <div style={{ backgroundColor: deptColor + '12' }} className="flex flex-col relative">
                  
                  {/* Header */}
                  <div className="p-4 pt-5 relative border-b border-black/5 pr-10">
                      <h3 
                        className={`text-sm font-bold text-slate-800 line-clamp-2 min-h-[40px] flex items-center leading-snug transition-colors ${isAdmin ? 'cursor-pointer hover:text-blue-600' : ''}`}
                        onClick={() => isAdmin && handleOpenValues(stat)}
                      >
                          {stat.title}
                      </h3>
                      <div className="flex justify-between items-center mt-2">
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider opacity-80">{getOwnerName(stat.owner_id || '')}</span>
                           <div className="flex gap-1">
                                {stat.is_favorite && <span className="text-[9px] bg-white text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded font-bold shadow-sm">ГСД</span>}
                                {stat.is_double && <span className="text-[9px] bg-white text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded font-bold shadow-sm">2X</span>}
                           </div>
                      </div>
                      
                      {/* Info Button - Toggle Description */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); setInfoCardId(isInfoOpen ? null : stat.id); }}
                        className={`absolute top-4 right-4 p-1.5 rounded-full transition-all ${isInfoOpen ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                      >
                          <Info size={16} />
                      </button>
                  </div>
                  
                  {/* Values */}
                  <div className="flex px-4 py-4 items-center justify-between">
                      {/* Value */}
                      <div>
                          <span className="text-3xl font-black text-slate-800 tracking-tight block">{current.toLocaleString()}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Текущее</span>
                      </div>

                      {/* Deltas */}
                      <div className="flex flex-col items-end gap-1">
                          <div className={`text-sm font-bold flex items-center px-2 py-1 rounded-lg shadow-sm border border-white/50 backdrop-blur-sm ${isPos ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {isPos ? <TrendingUp size={14} className="mr-1"/> : <TrendingDown size={14} className="mr-1"/>} 
                              {Math.abs(change * 100).toFixed(1)}%
                          </div>
                          <div className={`text-xs font-bold ${isPos ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                          </div>
                      </div>
                  </div>
              </div>

              {/* LOWER SECTION (Chart OR Info) */}
              <div className="flex-1 bg-white relative">
                  
                  {/* Chart Layer */}
                  <div 
                    className="absolute inset-0 p-2 flex flex-col transition-opacity duration-300"
                    style={{ opacity: isInfoOpen ? 0.1 : 1, pointerEvents: isInfoOpen ? 'none' : 'auto' }}
                  >
                       <div className={`flex-1 w-full rounded-xl border border-slate-100 p-2 bg-white ${isAdmin ? 'cursor-pointer' : ''}`} onClick={() => isAdmin && handleOpenValues(stat)}>
                           {/* Key prop ensures animation replays when filtered period changes */}
                           <StatsChart 
                                key={selectedPeriod} 
                                values={vals} 
                                color={trendColorHex} 
                                inverted={stat.inverted}
                                isDouble={stat.is_double}
                           />
                       </div>
                  </div>

                  {/* Info Layer (Description) */}
                  {isInfoOpen && (
                      <div className="absolute inset-0 p-6 overflow-y-auto custom-scrollbar backdrop-blur-sm bg-white/60 z-20 animate-in fade-in slide-in-from-bottom-2">
                           <div className="space-y-4">
                               <div>
                                   <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Info size={10}/> Описание</div>
                                   <p className="text-xs text-slate-700 font-medium leading-relaxed">{stat.description || "Описание отсутствует."}</p>
                               </div>
                               
                               <div>
                                   <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><HelpCircle size={10}/> Методика расчета</div>
                                   <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 font-medium">
                                       {stat.calculation_method || "Прямой ввод данных."}
                                   </div>
                               </div>
                           </div>
                      </div>
                  )}

              </div>
          </div>
      );
  };

  // --- VIEWS ---

  const renderDashboardView = () => (
      <div className="space-y-10 pb-20 animate-in fade-in">
          
          {/* Company Dashboard (No Dept Selected) */}
          {!selectedDeptId && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row items-center justify-between">
                 <div className="mb-4 md:mb-0">
                     <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><LayoutDashboard className="text-blue-600"/> Обзор Компании</h2>
                     <p className="text-slate-500 mt-1">Ключевые показатели эффективности (ГСД) по всем департаментам.</p>
                 </div>
              </div>
          )}

          {DEPT_ORDER.filter(id => !selectedDeptId || id === selectedDeptId).map(deptId => {
              const dept = ORGANIZATION_STRUCTURE[deptId];
              if (!dept) return null;

              // 1. Get stats belonging directly to the Dept
              const deptStats = definitions.filter(d => d.owner_id === deptId);
              
              // 2. Get stats belonging to Sub-Depts (Divisions), strictly ordered
              let subDeptStats: StatisticDefinition[] = [];
              if (dept.departments) {
                  Object.values(dept.departments).forEach(sub => {
                      const stats = definitions.filter(d => d.owner_id === sub.id);
                      subDeptStats = [...subDeptStats, ...stats];
                  });
              }

              const isSpecificView = selectedDeptId === deptId;
              
              if (!isSpecificView) {
                  // --- COMPANY VIEW (GSD ONLY, BUT ORDERED LOGICALLY) ---
                  // Logic: Show Dept GSD first, then Sub-Dept GSDs in order
                  const allDeptStats = [...deptStats, ...subDeptStats].filter(s => s.is_favorite);
                  
                  if (allDeptStats.length === 0) return null;

                  return (
                      <div key={deptId} className="space-y-4">
                           <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between relative overflow-hidden">
                               <div className="absolute left-0 top-0 bottom-0 w-2" style={{backgroundColor: dept.color}}></div>
                               <h2 className="text-lg font-bold flex items-center gap-2 ml-3">
                                   <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs" style={{backgroundColor: dept.color}}>{dept.name.substring(0,1)}</div>
                                   {dept.name}
                               </h2>
                               <span className="text-slate-400 text-xs font-bold hidden sm:block">{dept.manager}</span>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                               {allDeptStats.map(stat => renderStatCard(stat, dept.color))}
                           </div>
                      </div>
                  );

              } else {
                  // --- DEPARTMENT VIEW (DETAILED & GROUPED) ---
                  
                  return (
                      <div key={deptId} className="space-y-8">
                           {/* Header */}
                           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                               <div className="absolute top-0 right-0 w-64 h-64 opacity-10 rounded-full -mr-16 -mt-16 pointer-events-none" style={{backgroundColor: dept.color}}></div>
                               <h2 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-3 relative z-10">
                                   <div className="p-2 rounded-xl text-white shadow-lg" style={{backgroundColor: dept.color}}><Building2 size={32}/></div>
                                   {dept.fullName}
                               </h2>
                               <p className="text-slate-500 mt-2 font-medium max-w-2xl text-sm md:text-base">{dept.description}</p>
                               <div className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-600 bg-slate-50 w-fit px-3 py-1 rounded-lg">
                                   <span className="w-2 h-2 rounded-full" style={{backgroundColor: dept.color}}></span>
                                   Руководитель: {dept.manager}
                               </div>

                               {/* VFP (ЦКП) Display if exists */}
                               {dept.vfp && (
                                   <div className="mt-6 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-2">
                                       <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ценный Конечный Продукт (ЦКП)</div>
                                       <p className="text-slate-700 font-bold leading-relaxed max-w-3xl border-l-4 pl-4" style={{borderColor: dept.color}}>
                                           {dept.vfp}
                                       </p>
                                   </div>
                               )}
                           </div>

                           {/* 1. General Department Stats */}
                           {deptStats.length > 0 && (
                               <div className="space-y-4">
                                   <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-xs tracking-widest px-1">
                                       <Layers size={14}/> Общие статистики департамента
                                   </div>
                                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                       {deptStats.map(stat => renderStatCard(stat, dept.color))}
                                   </div>
                               </div>
                           )}

                           {/* 2. Sub-Departments Stats Grouped */}
                           {dept.departments && Object.values(dept.departments).map(sub => {
                               const subStats = definitions.filter(d => d.owner_id === sub.id);
                               if (subStats.length === 0) return null;
                               
                               return (
                                   <div key={sub.id} className="space-y-4 pt-4 border-t border-slate-100">
                                       <div className="flex items-center gap-3">
                                            <div className="px-3 py-1 rounded-lg text-white font-bold text-sm shadow-sm" style={{backgroundColor: dept.color}}>
                                                Отдел {sub.code}
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-700">{sub.name}</h3>
                                            <span className="text-slate-400 text-sm font-medium hidden sm:inline">({sub.manager})</span>
                                       </div>
                                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                           {subStats.map(stat => renderStatCard(stat, dept.color))}
                                       </div>
                                   </div>
                               );
                           })}
                      </div>
                  );
              }
          })}
      </div>
  );

  const renderListView = () => {
      // 1. Filter definitions based on search
      const filtered = definitions.filter(d => d.title.toLowerCase().includes(listSearchTerm.toLowerCase()));
      
      // 2. Group by Parent Department
      const grouped: Record<string, StatisticDefinition[]> = {};
      
      filtered.forEach(def => {
          const parentDeptId = getParentDeptId(def.owner_id || 'other');
          if (!grouped[parentDeptId]) grouped[parentDeptId] = [];
          grouped[parentDeptId].push(def);
      });

      // 3. Sort Keys based on DEPT_ORDER
      const sortedKeys = Object.keys(grouped).sort((a, b) => {
          const idxA = DEPT_ORDER.indexOf(a);
          const idxB = DEPT_ORDER.indexOf(b);
          // If not found in DEPT_ORDER (e.g., employee specific or 'other'), put at end
          const valA = idxA === -1 ? 999 : idxA;
          const valB = idxB === -1 ? 999 : idxB;
          return valA - valB;
      });

      return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full animate-in fade-in">
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center bg-slate-50 rounded-t-2xl gap-3">
                  <div className="relative w-full md:w-auto">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                      <input 
                        className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl w-full md:w-64 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder="Поиск статистики..." 
                        value={listSearchTerm}
                        onChange={e => setListSearchTerm(e.target.value)}
                      />
                  </div>
                  {/* ADMIN ONLY: Add Stat Button */}
                  {isAdmin && (
                      <button 
                        onClick={() => { setEditingDef({ type: 'department', inverted: false, is_favorite: false }); setIsEditModalOpen(true); }}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-sm"
                      >
                          <Plus size={16}/> Добавить Статистику
                      </button>
                  )}
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {sortedKeys.map(deptId => {
                      const dept = ORGANIZATION_STRUCTURE[deptId] || { name: 'Прочее', color: '#94a3b8' };
                      return (
                          <div key={deptId} className="mb-0">
                              {/* Department Header Stick */}
                              <div className="sticky top-0 z-10 px-6 py-2 bg-slate-100/90 backdrop-blur-sm border-y border-slate-200 flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: dept.color}}></div>
                                  <span className="font-black text-slate-600 text-xs uppercase tracking-wider">{dept.name}</span>
                              </div>
                              
                              <table className="w-full text-sm text-left">
                                  {deptId === sortedKeys[0] && (
                                      <thead className="text-xs text-slate-500 uppercase bg-slate-50 hidden md:table-header-group">
                                          <tr>
                                              <th className="px-6 py-3 w-1/2">Название</th>
                                              <th className="px-6 py-3">Владелец</th>
                                              <th className="px-6 py-3">Тип</th>
                                              <th className="px-6 py-3 text-right">Управление</th>
                                          </tr>
                                      </thead>
                                  )}
                                  <tbody className="divide-y divide-slate-100">
                                      {grouped[deptId].map(def => (
                                          <tr key={def.id} className="hover:bg-blue-50/30 flex flex-col md:table-row p-4 md:p-0 border-b md:border-b-0 border-slate-100">
                                              <td className="md:px-6 md:py-4 font-bold text-slate-700 block md:table-cell mb-1 md:mb-0">
                                                  {def.title}
                                                  {def.is_favorite && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1 rounded inline-block">ГСД</span>}
                                              </td>
                                              <td className="md:px-6 md:py-4 text-slate-500 block md:table-cell text-xs md:text-sm mb-1 md:mb-0">
                                                  <span className="md:hidden font-bold mr-1">Владелец:</span>
                                                  {getOwnerName(def.owner_id || '')}
                                              </td>
                                              <td className="md:px-6 md:py-4 block md:table-cell mb-2 md:mb-0">
                                                  <span className="px-2 py-1 bg-slate-100 rounded text-xs">{def.type}</span>
                                              </td>
                                              <td className="md:px-6 md:py-4 text-right flex justify-start md:justify-end gap-2 md:table-cell">
                                                  {/* ADMIN ONLY: Edit Actions */}
                                                  {isAdmin ? (
                                                      <div className="flex gap-2">
                                                          <button onClick={() => handleOpenValues(def)} className="p-2 text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100" title="Внести данные"><Calendar size={16}/></button>
                                                          <button onClick={() => { setEditingDef(def); setIsEditModalOpen(true); }} className="p-2 text-blue-600 bg-blue-50 rounded hover:bg-blue-100" title="Изменить"><Edit2 size={16}/></button>
                                                          <button onClick={() => handleDeleteDef(def.id)} className="p-2 text-red-600 bg-red-50 rounded hover:bg-red-100" title="Удалить"><Trash2 size={16}/></button>
                                                      </div>
                                                  ) : (
                                                      <span className="text-slate-300 text-xs italic">Только просмотр</span>
                                                  )}
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] relative bg-slate-50 p-4 md:p-6">
        
        {/* TOP CONTROLS */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-full md:w-auto">
                <button onClick={() => setDisplayMode('dashboard')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${displayMode === 'dashboard' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard size={16}/> <span className="hidden sm:inline">Дашборд</span></button>
                <button onClick={() => setDisplayMode('list')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${displayMode === 'list' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><List size={16}/> <span className="hidden sm:inline">Список / Настройки</span></button>
            </div>

            {displayMode === 'dashboard' && (
                <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto w-full md:w-auto max-w-full">
                    {PERIODS.map(p => (
                        <button 
                            key={p.id}
                            onClick={() => setSelectedPeriod(p.id)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedPeriod === p.id ? 'bg-blue-100 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-0 md:pr-2">
            {displayMode === 'dashboard' ? renderDashboardView() : renderListView()}
        </div>

        {/* --- MODALS --- */}
        
        {/* 1. Edit Statistic Definition Modal (Only accessible via buttons shown to Admin) */}
        {isEditModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold">{editingDef?.id ? 'Редактировать Статистику' : 'Новая Статистика'}</h3>
                        <button onClick={() => setIsEditModalOpen(false)}><X className="text-slate-400"/></button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Название</label>
                            <input 
                                value={editingDef?.title || ''} 
                                onChange={e => setEditingDef({...editingDef, title: e.target.value})} 
                                className="w-full bg-white border border-slate-300 text-slate-900 p-3 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                                placeholder="Например: Валовый Доход" 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Владелец</label>
                            <select 
                                value={editingDef?.owner_id || ''} 
                                onChange={e => setEditingDef({...editingDef, owner_id: e.target.value})} 
                                className="w-full bg-white border border-slate-300 text-slate-900 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                            >
                                <option value="">Выберите...</option>
                                {Object.values(ORGANIZATION_STRUCTURE).map(d => (
                                    <React.Fragment key={d.id}>
                                        <option value={d.id} className="font-bold">⭐ {d.fullName}</option>
                                        {d.departments && Object.values(d.departments).map(s => (
                                            <option key={s.id} value={s.id}>&nbsp;&nbsp;↳ {s.name}</option>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </select>
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Описание / ЦКП</label>
                            <textarea 
                                value={editingDef?.description || ''} 
                                onChange={e => setEditingDef({...editingDef, description: e.target.value})} 
                                className="w-full bg-white border border-slate-300 text-slate-900 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium min-h-[80px]"
                                placeholder="Описание сути статистики"
                            />
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Методика Расчета</label>
                            <textarea 
                                value={editingDef?.calculation_method || ''} 
                                onChange={e => setEditingDef({...editingDef, calculation_method: e.target.value})} 
                                className="w-full bg-white border border-slate-300 text-slate-900 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium min-h-[60px]"
                                placeholder="Как считать..."
                            />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={editingDef?.inverted || false} onChange={e => setEditingDef({...editingDef, inverted: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span className="text-sm font-medium">Обратная статистика (Меньше = Лучше)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={editingDef?.is_favorite || false} onChange={e => setEditingDef({...editingDef, is_favorite: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span className="text-sm font-medium">Главная статистика (ГСД)</span>
                        </label>
                        {/* New Checkbox for Double Graph */}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={editingDef?.is_double || false} onChange={e => setEditingDef({...editingDef, is_double: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span className="text-sm font-medium">Двойная Статистика (2 графика)</span>
                        </label>

                        <button onClick={handleSaveDef} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 mt-4">Сохранить</button>
                    </div>
                </div>
            </div>
        )}

        {/* 2. Manage Values Modal */}
        {isValueModalOpen && selectedStatForValues && (
             <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 animate-in zoom-in-95 flex flex-col max-h-[80vh]">
                     <div className="flex justify-between items-center mb-4 border-b pb-4">
                        <div>
                            <h3 className="font-bold text-lg">{selectedStatForValues.title}</h3>
                            <p className="text-xs text-slate-400">Ввод данных</p>
                        </div>
                        <button onClick={() => setIsValueModalOpen(false)}><X className="text-slate-400"/></button>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl mb-4">
                        <div className="flex gap-3">
                             <input type="date" value={editingValue.date || ''} onChange={e => setEditingValue({...editingValue, date: e.target.value})} className="border border-slate-300 bg-white p-2 rounded-lg text-sm text-slate-900 w-32" />
                             <input type="number" value={editingValue.value || 0} onChange={e => setEditingValue({...editingValue, value: parseFloat(e.target.value)})} className="border border-slate-300 bg-white p-2 rounded-lg flex-1 text-sm font-bold text-slate-900" placeholder="Значение" />
                             <button onClick={handleSaveValue} className="bg-blue-600 text-white px-4 rounded-lg font-bold text-sm">OK</button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                        {currentStatValues.map(val => (
                            <div key={val.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded border-b border-transparent hover:border-slate-100">
                                <div>
                                    <span className="font-bold mr-3">{val.value}</span>
                                    <span className="text-xs text-slate-400">{format(new Date(val.date), 'dd.MM.yyyy')}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingValue(val)} className="text-blue-500"><Edit2 size={14}/></button>
                                    <button onClick={() => handleDeleteValue(val.id)} className="text-red-500"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
             </div>
        )}
    </div>
  );
};

export default StatisticsTab;
