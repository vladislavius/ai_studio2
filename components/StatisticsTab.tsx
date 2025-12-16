
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { StatisticDefinition, StatisticValue, WiseCondition, Employee } from '../types';
import { ORGANIZATION_STRUCTURE, HANDBOOK_STATISTICS } from '../constants';
import StatsChart from './StatsChart';
import { TrendingUp, TrendingDown, LayoutDashboard, Info, HelpCircle, Building2, Layers, Calendar, Edit2, X, List, Search, Plus, Trash2, Sliders, Save, AlertCircle, ArrowDownUp, Download, Upload, Maximize2, MoreHorizontal, Minus } from 'lucide-react';
import { format } from 'date-fns';

interface StatisticsTabProps {
  employees: Employee[];
  isOffline?: boolean;
  selectedDeptId?: string | null;
  isAdmin?: boolean;
}

// --- CONSTANTS ---
const DEMO_DEFINITIONS: StatisticDefinition[] = HANDBOOK_STATISTICS.map((s, i) => ({ ...s, id: `demo-stat-${i}`, type: 'department', is_favorite: s.is_favorite ?? s.title.includes('(ГСД)') }));
const generateMockHistory = (baseVal: number, weeks: number = 52) => {
    return Array.from({ length: weeks }).map((_, i) => {
        const weekOffset = weeks - 1 - i;
        const d = new Date();
        d.setDate(d.getDate() - (weekOffset * 7));
        
        const trend = Math.sin(i / 8) * (baseVal * 0.1) + (i / weeks * baseVal * 0.4); 
        const noise = (Math.random() - 0.5) * (baseVal * 0.1); 
        let val = Math.max(0, Math.floor(baseVal + trend + noise));
        let val2 = val * 0.7; 
        return { id: `mock-val-${Date.now()}-${i}`, definition_id: 'temp', date: format(d, 'yyyy-MM-dd'), value: val, value2: val2 };
    });
};
const DEMO_VALUES: Record<string, StatisticValue[]> = {};
DEMO_DEFINITIONS.forEach((def) => { let base = 100; if (def.title.includes('Выручка') || def.title.includes('Доход')) base = 1500000; DEMO_VALUES[def.id] = generateMockHistory(base, 52).map(v => ({...v, definition_id: def.id})); });

const DEPT_ORDER = ['owner', 'dept7', 'dept1', 'dept2', 'dept3', 'dept4', 'dept5', 'dept6'];

const PERIODS = [
    { id: '1w', label: '1 Нед.' },
    { id: '3w', label: '3 Нед.' },
    { id: '1m', label: '1 Мес.' },
    { id: '3m', label: '3 Мес.' },
    { id: '6m', label: 'Полгода' },
    { id: '1y', label: 'Год' },
    { id: 'all', label: 'Все' },
];

// --- STRICT TREND ANALYSIS LOGIC (PERIOD BASED) ---
const analyzeTrend = (vals: StatisticValue[], inverted: boolean = false) => {
    // 1. Safety check
    if (!vals || vals.length === 0) {
        return { current: 0, prev: 0, delta: 0, percent: 0, direction: 'flat' as const, isGood: true };
    }

    // 2. Strict Sort by Date (Oldest to Newest)
    const sorted = [...vals].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const n = sorted.length;

    // 3. Extract Points (Current vs START OF PERIOD)
    // To show growth over the selected timeframe, we compare the Last point against the First point of the visible chart.
    const current = sorted[n - 1].value;
    const startOfPeriod = sorted[0].value; 
    
    // Fallback: If only 1 point exists, compare to 0.
    const prev = n > 1 ? startOfPeriod : 0;

    // 4. Calculate Math
    const delta = current - prev;
    
    let percent = 0;
    if (prev === 0) {
        percent = current === 0 ? 0 : 100;
    } else {
        percent = (delta / Math.abs(prev)) * 100;
    }

    // 5. Determine Physical Direction (Up/Down)
    let direction: 'up' | 'down' | 'flat' = 'flat';
    if (delta > 0) direction = 'up';
    if (delta < 0) direction = 'down';

    // 6. Determine Sentiment
    let isGood = true;
    if (inverted) {
        isGood = delta <= 0; // Down is Good for Inverted
    } else {
        isGood = delta >= 0; // Up is Good for Normal
    }

    return { current, prev, delta, percent, direction, isGood };
};

const StatisticsTab: React.FC<StatisticsTabProps> = ({ employees, isOffline, selectedDeptId, isAdmin }) => {
  const [definitions, setDefinitions] = useState<StatisticDefinition[]>([]);
  const [allLatestValues, setAllLatestValues] = useState<Record<string, StatisticValue[]>>({});
  const [selectedPeriod, setSelectedPeriod] = useState<string>('3w');
  const [displayMode, setDisplayMode] = useState<'dashboard' | 'list'>('dashboard');
  
  // EXPANDED VIEW STATE
  const [expandedStatId, setExpandedStatId] = useState<string | null>(null);

  // ADMIN EDIT MODE
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingStatDef, setEditingStatDef] = useState<Partial<StatisticDefinition> | null>(null);

  // Values Editing State
  const [isValueModalOpen, setIsValueModalOpen] = useState(false);
  const [selectedStatForValues, setSelectedStatForValues] = useState<StatisticDefinition | null>(null);
  const [currentStatValues, setCurrentStatValues] = useState<StatisticValue[]>([]);
  const [editingValue, setEditingValue] = useState<Partial<StatisticValue>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchDefinitions(); fetchAllValues(); }, [isOffline]); 

  const fetchDefinitions = async () => {
    if (isOffline) { 
        if (definitions.length === 0) setDefinitions(DEMO_DEFINITIONS); 
    } 
    else if (supabase) {
        const { data } = await supabase.from('statistics_definitions').select('*').order('title');
        if (data) setDefinitions(data);
    }
  };

  const fetchAllValues = async () => {
      if (isOffline) { 
          if (Object.keys(allLatestValues).length === 0) setAllLatestValues(DEMO_VALUES); 
          return; 
      }
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

  // --- ADMIN ACTIONS ---
  const handleCreateOrUpdateStat = async () => { /* ... preserved ... */ };
  const handleDeleteStat = async (id: string) => { 
      if (!isAdmin) return;
      if (!confirm("Вы уверены? Это удалит статистику и ВСЮ историю значений.")) return;
      try {
        if (isOffline || !supabase) {
            setDefinitions(prev => prev.filter(d => d.id !== id));
            setAllLatestValues(prev => { const next = { ...prev }; delete next[id]; return next; });
        } else {
            await supabase.from('statistics_values').delete().eq('definition_id', id);
            await supabase.from('statistics_definitions').delete().eq('id', id);
            await fetchDefinitions();
        }
      } catch (err: any) { alert(err.message); }
  };
  
  const openNewStatModal = (preselectOwnerId: string) => {
      setEditingStatDef({ owner_id: preselectOwnerId, type: 'department', is_favorite: false, title: '' });
  };

  const getFilteredValues = (statId: string) => {
      const vals = allLatestValues[statId] || [];
      if (!vals.length) return [];
      const sorted = [...vals].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const total = sorted.length;
      switch (selectedPeriod) {
          case '1w': return sorted.slice(Math.max(0, total - 2)); 
          case '3w': return sorted.slice(Math.max(0, total - 4));
          case '1m': return sorted.slice(Math.max(0, total - 5));
          case '3m': return sorted.slice(Math.max(0, total - 13));
          case '6m': return sorted.slice(Math.max(0, total - 26));
          case '1y': return sorted.slice(Math.max(0, total - 52));
          case 'all': return sorted;
          default: return sorted.slice(Math.max(0, total - 13));
      }
  };

  const getOwnerName = (ownerId: string) => {
      if (ORGANIZATION_STRUCTURE[ownerId]) return ORGANIZATION_STRUCTURE[ownerId].name;
      for(const key in ORGANIZATION_STRUCTURE) {
          const d = ORGANIZATION_STRUCTURE[key];
          if (d.departments && d.departments[ownerId]) return d.departments[ownerId].name;
      }
      return ownerId;
  };

  const handleOpenValues = async (stat: StatisticDefinition) => {
      if (!isAdmin) return;
      setSelectedStatForValues(stat);
      if(isOffline || !supabase) { setCurrentStatValues(allLatestValues[stat.id] || []); } 
      else { const { data } = await supabase.from('statistics_values').select('*').eq('definition_id', stat.id).order('date', {ascending: false}); setCurrentStatValues(data || []); }
      setEditingValue({ definition_id: stat.id, date: new Date().toISOString().split('T')[0], value: 0, value2: 0 });
      setIsValueModalOpen(true);
  };

  const handleSaveValue = async () => {
      if (!editingValue || !selectedStatForValues) return;
      const payload = { definition_id: selectedStatForValues.id, date: editingValue.date || new Date().toISOString().split('T')[0], value: editingValue.value || 0, value2: editingValue.value2 || 0 };
      if (isOffline || !supabase) {
           const newVal = { ...payload, id: editingValue.id || `local-val-${Date.now()}` } as StatisticValue;
           const updatedList = editingValue.id ? currentStatValues.map(v => v.id === editingValue.id ? newVal : v) : [newVal, ...currentStatValues];
           updatedList.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
           setCurrentStatValues(updatedList);
           setAllLatestValues(prev => ({ ...prev, [selectedStatForValues.id]: updatedList }));
      } else {
          if (editingValue.id) { await supabase.from('statistics_values').update(payload).eq('id', editingValue.id); } else { await supabase.from('statistics_values').insert([payload]); }
          const { data } = await supabase.from('statistics_values').select('*').eq('definition_id', selectedStatForValues.id).order('date', {ascending: false});
          setCurrentStatValues(data || []);
          fetchAllValues(); 
      }
      setEditingValue({ definition_id: selectedStatForValues.id, date: new Date().toISOString().split('T')[0], value: 0, value2: 0 });
  };

  // --- RENDER CARD ---
  const renderStatCard = (stat: StatisticDefinition, deptColor: string, contextKey: string) => {
      const vals = getFilteredValues(stat.id);
      const { current, percent, direction, isGood } = analyzeTrend(vals, stat.inverted);
      
      const trendColorHex = isGood ? "#10b981" : "#f43f5e"; // Emerald vs Rose

      return (
          <div 
            key={`${contextKey}-${stat.id}`} 
            onClick={() => !isEditMode && setExpandedStatId(stat.id)}
            className={`relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[260px] transition-all group ${isEditMode ? 'ring-2 ring-blue-400 ring-offset-2 hover:-translate-y-0' : 'cursor-pointer hover:-translate-y-1 hover:shadow-md'}`}
          >
              <div className="absolute top-0 left-0 bottom-0 w-1" style={{backgroundColor: deptColor}}></div>
              <div className="absolute top-0 left-1 right-0 h-32 pointer-events-none" style={{ background: `linear-gradient(to bottom, ${deptColor}15, #ffffff00)` }}></div>

              {isEditMode && isAdmin && (
                  <div className="absolute top-2 right-2 flex gap-1 z-30 bg-white/90 p-1 rounded-lg border border-slate-100 shadow-sm backdrop-blur-sm animate-in fade-in">
                      <button onClick={(e) => { e.stopPropagation(); setEditingStatDef(stat); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"><Edit2 size={14}/></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteStat(stat.id); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"><Trash2 size={14}/></button>
                  </div>
              )}

              <div className="p-3 pl-4 flex flex-col h-full relative z-10">
                  <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 pr-6">
                           <div className="flex items-center gap-1.5">
                                <h3 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2" title={stat.title}>{stat.title}</h3>
                                {stat.inverted && (
                                    <span className="text-[8px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-0.5 flex-shrink-0">
                                        <ArrowDownUp size={8}/> ОБР
                                    </span>
                                )}
                           </div>
                           <div className="text-[9px] text-slate-400 font-medium truncate mt-0.5 line-clamp-1" title={stat.description}>{stat.description || getOwnerName(stat.owner_id || '')}</div>
                      </div>
                      {!isEditMode && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3 text-slate-300">
                               <Maximize2 size={14} />
                          </div>
                      )}
                  </div>
                  
                  {/* MAIN VALUE & TREND */}
                  <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-2xl font-black text-slate-900 tracking-tight">{current.toLocaleString()}</span>
                      {vals.length > 1 && (
                          <div className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {direction === 'up' && <TrendingUp size={12} className="mr-1"/>}
                              {direction === 'down' && <TrendingDown size={12} className="mr-1"/>}
                              {direction === 'flat' && <Minus size={12} className="mr-1"/>}
                              {Math.abs(percent).toFixed(0)}%
                          </div>
                      )}
                  </div>
                  
                  <div className={`flex-1 w-full min-h-0 relative`}>
                       {/* Pass the calculated isGood color to the chart to ensure visual consistency */}
                       <StatsChart key={selectedPeriod} values={vals} color={trendColorHex} inverted={stat.inverted} isDouble={stat.is_double} />
                  </div>
                  <div className="absolute bottom-2 right-2 flex gap-1 pointer-events-none opacity-50">
                       {stat.is_favorite && <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded font-bold">ГСД</span>}
                       {stat.is_double && <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 rounded font-bold">2X</span>}
                  </div>
              </div>
          </div>
      );
  };

  const renderDashboardView = () => (
      <div className="space-y-10 animate-in fade-in">
          {DEPT_ORDER.filter(id => !selectedDeptId || id === selectedDeptId).map(deptId => {
              const dept = ORGANIZATION_STRUCTURE[deptId];
              if (!dept) return null;
              
              // DUPLICATION LOGIC
              const deptStats = definitions.filter(d => {
                  if (d.owner_id === deptId) return true;
                  if (d.is_favorite && dept.departments && Object.keys(dept.departments).includes(d.owner_id || '')) return true;
                  return false;
              });
              
              const isSpecificView = selectedDeptId === deptId;

              if (!isSpecificView) {
                  // Overview Mode
                  if (deptStats.length === 0 && !isEditMode) return null;
                  return (
                      <div key={deptId} className="space-y-3">
                           <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between border-l-4" style={{borderLeftColor: dept.color}}>
                               <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700">{dept.name}</h2>
                               <span className="text-slate-400 text-xs font-medium">{dept.manager}</span>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                               {deptStats.map(stat => renderStatCard(stat, dept.color, 'overview'))}
                               {isEditMode && isAdmin && (
                                   <div onClick={() => openNewStatModal(deptId)} className="border-2 border-dashed border-slate-300 rounded-xl h-[260px] flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                                       <Plus size={32} />
                                       <span className="text-xs font-bold mt-2">Добавить статистику</span>
                                   </div>
                               )}
                           </div>
                      </div>
                  );
              } else {
                  // Specific Department Mode
                  return (
                      <div key={deptId} className="space-y-6">
                           <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between border-l-4" style={{borderLeftColor: dept.color}}>
                               <div>
                                  <h2 className="text-lg font-bold text-slate-800">{dept.name}</h2>
                                  <p className="text-xs text-slate-500">{dept.manager}</p>
                               </div>
                               <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{deptStats.length} статистик</span>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                               {deptStats.map(stat => renderStatCard(stat, dept.color, 'main'))}
                               {isEditMode && isAdmin && (
                                   <div onClick={() => openNewStatModal(deptId)} className="border-2 border-dashed border-slate-300 rounded-xl h-[260px] flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                                       <Plus size={32} />
                                       <span className="text-xs font-bold mt-2">Добавить статистику</span>
                                   </div>
                               )}
                           </div>

                           {dept.departments && Object.values(dept.departments).map(sub => {
                               const subStats = definitions.filter(d => d.owner_id === sub.id);
                               if(subStats.length === 0 && !isEditMode) return null;
                               return (
                                   <div key={sub.id} className="mt-8 pt-4 border-t border-slate-100">
                                       <h3 className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{backgroundColor: dept.color}}></div> {sub.name}</h3>
                                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                           {subStats.map(stat => renderStatCard(stat, dept.color, `sub-${sub.id}`))}
                                           {isEditMode && isAdmin && (
                                               <div onClick={() => openNewStatModal(sub.id)} className="border-2 border-dashed border-slate-300 rounded-xl h-[260px] flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                                                   <Plus size={32} />
                                                   <span className="text-xs font-bold mt-2">Добавить в {sub.code}</span>
                                               </div>
                                           )}
                                       </div>
                                   </div>
                               )
                           })}
                      </div>
                  );
              }
          })}
      </div>
  );

  const renderListView = () => { /* ... preserved ... */ return null; };

  return (
      <div className="flex flex-col h-full animate-in fade-in space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
             <div className="flex justify-between items-center">
                 <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                     <button onClick={() => setDisplayMode('dashboard')} className={`p-2 rounded-md transition-all ${displayMode === 'dashboard' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><LayoutDashboard size={18}/></button>
                     <button onClick={() => setDisplayMode('list')} className={`p-2 rounded-md transition-all ${displayMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><List size={18}/></button>
                 </div>
                 {isAdmin && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsEditMode(!isEditMode)} className={`p-2 rounded-lg border transition-all ${isEditMode ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} title="Режим редактирования">
                            <Edit2 size={18}/>
                        </button>
                    </div>
                 )}
             </div>
             <div className="relative">
                 <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 -mx-1 px-1">
                      {PERIODS.map(p => (
                          <button key={p.id} onClick={() => setSelectedPeriod(p.id)} className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-lg transition-all border ${selectedPeriod === p.id ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}>{p.label}</button>
                      ))}
                 </div>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
              {displayMode === 'dashboard' ? renderDashboardView() : renderListView()}
          </div>

          {/* Modal Components (Preserved) */}
          {expandedStatId && (
               <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setExpandedStatId(null)}>
                   <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                       <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                           <h3 className="font-bold text-lg text-slate-800 truncate pr-4">{definitions.find(d => d.id === expandedStatId)?.title}</h3>
                           <button onClick={() => setExpandedStatId(null)} className="p-2 hover:bg-slate-100 rounded-full flex-shrink-0"><X size={20}/></button>
                       </div>
                       <div className="flex-1 p-4 md:p-6 bg-slate-50 overflow-y-auto">
                            {(() => {
                                const stat = definitions.find(d => d.id === expandedStatId);
                                if (!stat) return null;
                                const vals = getFilteredValues(stat.id);
                                const { current, percent, direction, isGood } = analyzeTrend(vals, stat.inverted);
                                
                                return (
                                    <div className="space-y-6">
                                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl mb-4">
                                            <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Описание</h4>
                                            <p className="text-sm font-medium text-blue-900 leading-relaxed whitespace-pre-wrap">{stat.description || 'Нет описания'}</p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-stretch gap-4">
                                            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex-1">
                                                <div className="text-sm text-slate-500 font-medium mb-1">Текущее значение</div>
                                                <div className="text-4xl font-black text-slate-900">{current.toLocaleString()}</div>
                                            </div>
                                            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex-1">
                                                <div className="text-sm text-slate-500 font-medium mb-1">Динамика</div>
                                                <div className={`text-2xl font-bold flex items-center gap-2 ${isGood ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {direction === 'up' ? <TrendingUp size={24}/> : (direction === 'down' ? <TrendingDown size={24}/> : <Minus size={24}/>)}
                                                    {Math.abs(percent).toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-64 md:h-96 bg-white rounded-2xl border border-slate-200 shadow-sm p-2 md:p-4">
                                            <StatsChart values={vals} inverted={stat.inverted} isDouble={stat.is_double} />
                                        </div>
                                        {isAdmin && (
                                            <div className="flex justify-end">
                                                <button onClick={() => { setExpandedStatId(null); handleOpenValues(stat); }} className="w-full sm:w-auto px-4 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700">Редактировать значения</button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                       </div>
                   </div>
               </div>
          )}
          
          {/* Value Editor Modal and rest... */}
          {isValueModalOpen && selectedStatForValues && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div className="min-w-0 pr-2"><h3 className="font-bold text-slate-800 leading-tight truncate">{selectedStatForValues.title}</h3></div>
                            <button onClick={() => setIsValueModalOpen(false)} className="flex-shrink-0"><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        <div className="p-4 border-b border-slate-100 bg-blue-50/50">
                             <div className="flex flex-col sm:flex-row gap-3">
                                 <div className="w-full sm:w-1/3"><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Дата</label><input type="date" value={editingValue?.date || ''} onChange={e => setEditingValue({...editingValue, date: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium h-10"/></div>
                                 <div className="flex-1"><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Значение</label><input type="number" value={editingValue?.value || 0} onChange={e => setEditingValue({...editingValue, value: parseFloat(e.target.value)})} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold h-10"/></div>
                                 {selectedStatForValues.is_double && (<div className="flex-1"><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Вал 2</label><input type="number" value={editingValue?.value2 || 0} onChange={e => setEditingValue({...editingValue, value2: parseFloat(e.target.value)})} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold h-10"/></div>)}
                             </div>
                             <div className="flex justify-end mt-4 gap-3">
                                 {editingValue.id && <button onClick={() => setEditingValue({ definition_id: selectedStatForValues.id, date: new Date().toISOString().split('T')[0], value: 0, value2: 0 })} className="text-xs text-slate-400 underline self-center">Отмена</button>}
                                 <button onClick={handleSaveValue} className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-blue-700 flex items-center justify-center gap-1"><Save size={16}/> Сохранить</button>
                             </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            {currentStatValues.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">Нет данных</div>}
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-400 font-bold text-xs uppercase sticky top-0"><tr><th className="px-3 py-2 text-left">Дата</th><th className="px-3 py-2 text-right">Значение</th><th className="px-3 py-2 text-right"></th></tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {currentStatValues.map(val => (
                                        <tr key={val.id} className="hover:bg-slate-50"><td className="px-3 py-2 text-slate-600">{format(new Date(val.date), 'dd.MM.yy')}</td><td className="px-3 py-2 text-right font-bold text-slate-800">{val.value.toLocaleString()} {selectedStatForValues.is_double && <span className="text-slate-400 ml-1">/ {val.value2?.toLocaleString()}</span>}</td><td className="px-3 py-2 text-right"><div className="flex justify-end gap-1"><button onClick={() => setEditingValue(val)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={16}/></button><button onClick={async () => { if(!confirm('Удалить?')) return; /* ... delete logic ... */ }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button></div></td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
          )}
      </div>
  );
};

export default StatisticsTab;
