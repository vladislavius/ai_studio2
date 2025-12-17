import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { StatisticDefinition, StatisticValue, WiseCondition, Employee } from '../types';
import { ORGANIZATION_STRUCTURE, HANDBOOK_STATISTICS } from '../constants';
import StatsChart from './StatsChart';
import { TrendingUp, TrendingDown, LayoutDashboard, Info, HelpCircle, Building2, Layers, Calendar, Edit2, X, List, Search, Plus, Trash2, Sliders, Save, AlertCircle, ArrowDownUp, Download, Upload, Maximize2, MoreHorizontal, Minus, ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react';
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

const analyzeTrend = (vals: StatisticValue[], inverted: boolean = false) => {
    if (!vals || vals.length === 0) {
        return { current: 0, prev: 0, delta: 0, percent: 0, direction: 'flat' as const, isGood: true };
    }
    const sorted = [...vals].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const n = sorted.length;
    const current = sorted[n - 1].value;
    const startOfPeriod = sorted[0].value; 
    const prev = n > 1 ? startOfPeriod : 0;
    const delta = current - prev;
    let percent = 0;
    if (prev === 0) {
        percent = current === 0 ? 0 : 100;
    } else {
        percent = (delta / Math.abs(prev)) * 100;
    }
    let direction: 'up' | 'down' | 'flat' = 'flat';
    if (delta > 0) direction = 'up';
    if (delta < 0) direction = 'down';
    let isGood = inverted ? delta <= 0 : delta >= 0;
    return { current, prev, delta, percent, direction, isGood };
};

const StatisticsTab: React.FC<StatisticsTabProps> = ({ employees, isOffline, selectedDeptId, isAdmin }) => {
  const [definitions, setDefinitions] = useState<StatisticDefinition[]>([]);
  const [allLatestValues, setAllLatestValues] = useState<Record<string, StatisticValue[]>>({});
  const [selectedPeriod, setSelectedPeriod] = useState<string>('3w');
  const [displayMode, setDisplayMode] = useState<'dashboard' | 'list'>('dashboard');
  const [expandedStatId, setExpandedStatId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingStatDef, setEditingStatDef] = useState<Partial<StatisticDefinition> | null>(null);
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

  const handleExportStats = () => {
      const csvRows = [['ID Статистики (Не менять)', 'Департамент', 'Название Статистики', 'Период', 'Посл. Дата', 'Текущее Значение', 'Динамика', 'Изменение %', 'Тренд', '[ВВОД] Дата (ГГГГ-ММ-ДД)', '[ВВОД] Значение'].join(',')];
      definitions.forEach(stat => {
          const vals = getFilteredValues(stat.id);
          const { current, percent, direction } = analyzeTrend(vals, stat.inverted);
          const deptName = getOwnerName(stat.owner_id || '').replace(/,/g, '');
          const title = stat.title.replace(/,/g, ' ');
          let trendSymbol = direction === 'up' ? '↑' : (direction === 'down' ? '↓' : '→');
          const lastDate = vals.length > 0 ? format(new Date(vals[vals.length-1].date), 'dd.MM.yyyy') : '-';
          csvRows.push([stat.id, `"${deptName}"`, `"${title}"`, selectedPeriod, lastDate, current, direction, `${percent.toFixed(1)}%`, trendSymbol, '', ''].join(','));
      });
      const csvContent = "\ufeff" + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `statistics_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
  };

  const handleSaveDefinition = async () => {
    if (!editingStatDef || !editingStatDef.title || !editingStatDef.owner_id) return;
    const payload = { title: editingStatDef.title, description: editingStatDef.description || '', type: editingStatDef.type || 'department', owner_id: editingStatDef.owner_id, inverted: editingStatDef.inverted || false, is_favorite: editingStatDef.is_favorite || false, is_double: editingStatDef.is_double || false, calculation_method: editingStatDef.calculation_method || '' };
    try {
        if (isOffline || !supabase) {
             const newDef = { ...payload, id: editingStatDef.id || `local-def-${Date.now()}` } as StatisticDefinition;
             setDefinitions(prev => editingStatDef.id ? prev.map(d => d.id === editingStatDef.id ? newDef : d) : [...prev, newDef]);
        } else {
            if (editingStatDef.id) { await supabase.from('statistics_definitions').update(payload).eq('id', editingStatDef.id); } 
            else { await supabase.from('statistics_definitions').insert([payload]); }
            await fetchDefinitions();
        }
        setEditingStatDef(null);
    } catch (err) {}
  };

  const handleDeleteStat = async (id: string) => { 
      if (!isAdmin || !confirm("Удалить статистику и всю историю?")) return;
      try {
        if (isOffline || !supabase) {
            setDefinitions(prev => prev.filter(d => d.id !== id));
            setAllLatestValues(prev => { const next = { ...prev }; delete next[id]; return next; });
        } else {
            await supabase.from('statistics_values').delete().eq('definition_id', id);
            await supabase.from('statistics_definitions').delete().eq('id', id);
            await fetchDefinitions();
        }
      } catch (err) {}
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
          if (d.departments && d.departments[ownerId]) return `${d.name.split('.')[0]} -> ${d.departments[ownerId].name}`;
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
          if (editingValue.id) { await supabase.from('statistics_values').update(payload).eq('id', editingValue.id); } 
          else { await supabase.from('statistics_values').insert([payload]); }
          const { data } = await supabase.from('statistics_values').select('*').eq('definition_id', selectedStatForValues.id).order('date', {ascending: false});
          setCurrentStatValues(data || []);
          fetchAllValues(); 
      }
      setEditingValue({ definition_id: selectedStatForValues.id, date: new Date().toISOString().split('T')[0], value: 0, value2: 0 });
  };

  const handleDeleteValue = async (id: string) => {
      if(!confirm("Удалить?")) return;
      if(isOffline || !supabase) { setCurrentStatValues(prev => prev.filter(v => v.id !== id)); return; }
      const { error } = await supabase.from('statistics_values').delete().eq('id', id);
      if(!error) { setCurrentStatValues(prev => prev.filter(v => v.id !== id)); fetchAllValues(); }
  };

  const renderStatCard = (stat: StatisticDefinition, deptColor: string, contextKey: string) => {
      const vals = getFilteredValues(stat.id);
      const { current, percent, direction, isGood } = analyzeTrend(vals, stat.inverted);
      const trendColorHex = isGood ? "#10b981" : "#f43f5e"; 

      return (
          <div 
            key={`${contextKey}-${stat.id}`} 
            onClick={() => !isEditMode && setExpandedStatId(stat.id)}
            className={`relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[200px] md:h-[260px] transition-all group ${isEditMode ? 'ring-2 ring-blue-400 ring-offset-2' : 'cursor-pointer hover:-translate-y-1 hover:shadow-md'}`}
          >
              <div className="absolute top-0 left-0 bottom-0 w-1" style={{backgroundColor: deptColor}}></div>
              <div className="p-2.5 md:p-3 md:pl-4 flex flex-col h-full relative z-10">
                  <div className="flex justify-between items-start mb-1 md:mb-2">
                      <div className="flex-1 pr-6">
                           <h3 className="text-[10px] md:text-xs font-bold text-slate-800 leading-tight line-clamp-4 md:line-clamp-3 text-balance break-words">{stat.title}</h3>
                           <div className="text-[8px] md:text-[9px] text-slate-400 font-medium truncate mt-1">{getOwnerName(stat.owner_id || '')}</div>
                      </div>
                      {isEditMode && isAdmin && (
                          <div className="flex gap-1 z-30">
                              <button onClick={(e) => { e.stopPropagation(); setEditingStatDef(stat); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"><Edit2 size={12}/></button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteStat(stat.id); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"><Trash2 size={12}/></button>
                          </div>
                      )}
                  </div>
                  <div className="flex items-baseline gap-2 mb-1 md:mb-2">
                      <span className="text-lg md:text-2xl font-black text-slate-900">{current.toLocaleString()}</span>
                      {vals.length > 1 && (
                          <div className={`flex items-center text-[9px] md:text-[10px] font-bold px-1 py-0.5 rounded ${isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {direction === 'up' && <TrendingUp size={10} className="mr-0.5"/>}
                              {direction === 'down' && <TrendingDown size={10} className="mr-0.5"/>}
                              {Math.abs(percent).toFixed(0)}%
                          </div>
                      )}
                  </div>
                  <div className={`flex-1 w-full min-h-0 relative`}><StatsChart values={vals} color={trendColorHex} inverted={stat.inverted} isDouble={stat.is_double} /></div>
                  <div className="absolute bottom-1 right-1 flex gap-1 pointer-events-none opacity-40">
                       {stat.is_favorite && <span className="text-[7px] bg-amber-100 text-amber-700 px-1 rounded font-bold uppercase">ГСД</span>}
                       {stat.is_double && <span className="text-[7px] bg-indigo-100 text-indigo-700 px-1 rounded font-bold uppercase">2X</span>}
                  </div>
              </div>
          </div>
      );
  };

  const renderDashboardView = () => (
      <div className="space-y-6 md:space-y-10 animate-in fade-in">
          {DEPT_ORDER.filter(id => !selectedDeptId || id === selectedDeptId).map(deptId => {
              const dept = ORGANIZATION_STRUCTURE[deptId];
              if (!dept) return null;
              const mainStats = definitions.filter(d => d.owner_id === deptId);
              if (mainStats.length === 0 && !isEditMode) return null;
              return (
                  <div key={deptId} className="space-y-3">
                       <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between border-l-4" style={{borderLeftColor: dept.color}}>
                           <h2 className="text-xs md:text-sm font-bold text-slate-700">{dept.name}</h2>
                           <span className="text-slate-400 text-[10px] md:text-xs font-medium">{dept.manager}</span>
                       </div>
                       <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                           {mainStats.map(stat => renderStatCard(stat, dept.color, 'overview'))}
                           {isEditMode && isAdmin && (
                               <div onClick={() => setEditingStatDef({ owner_id: deptId, type: 'department', is_favorite: false, title: '' })} className="border-2 border-dashed border-slate-300 rounded-xl h-[200px] md:h-[260px] flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                                   <Plus size={32} /><span className="text-xs font-bold mt-2">Добавить</span>
                               </div>
                           )}
                       </div>
                  </div>
              );
          })}
      </div>
  );

  const renderListView = () => {
      const sortedDefs = [...definitions].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      return (
          <div className="space-y-4 animate-in fade-in">
              {/* Desktop View Table */}
              <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto touch-pan-x">
                      <table className="w-full text-sm text-left min-w-[800px]">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                              <tr>
                                  <th className="px-6 py-4">Название</th>
                                  <th className="px-6 py-4">Владелец</th>
                                  <th className="px-6 py-4">Тип / Метод</th>
                                  <th className="px-6 py-4 text-right">Действия</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {sortedDefs.map(stat => (
                                  <tr key={stat.id} className="hover:bg-slate-50 transition-colors group">
                                      <td className="px-6 py-4">
                                          <div className="font-bold text-slate-800">{stat.title}</div>
                                          <div className="flex gap-1 mt-1">
                                              {stat.is_favorite && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">ГСД</span>}
                                              {stat.inverted && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">ОБР</span>}
                                          </div>
                                      </td>
                                      <td className="px-6 py-4 text-slate-600 font-medium">{getOwnerName(stat.owner_id || '')}</td>
                                      <td className="px-6 py-4"><span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs font-bold mr-2 uppercase">{stat.type}</span></td>
                                      <td className="px-6 py-4 text-right">
                                          <div className="flex justify-end gap-2">
                                              <button onClick={() => setExpandedStatId(stat.id)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><TrendingUp size={16}/></button>
                                              {isAdmin && (
                                                  <>
                                                      <button onClick={() => handleOpenValues(stat)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Calendar size={16}/></button>
                                                      <button onClick={() => setEditingStatDef(stat)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                                      <button onClick={() => handleDeleteStat(stat.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                                  </>
                                              )}
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* Mobile Card View for List - Optimized for mobile UX and preventing scroll conflicts */}
              <div className="grid grid-cols-1 gap-4 md:hidden pb-10">
                  {sortedDefs.map(stat => (
                      <div key={stat.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                          <div className="flex justify-between items-start">
                              <div>
                                  <div className="font-bold text-slate-800 text-sm leading-snug break-words pr-2">{stat.title}</div>
                                  <div className="text-[10px] text-slate-400 font-medium mt-1">{getOwnerName(stat.owner_id || '')}</div>
                                  <div className="flex gap-1 mt-2">
                                      {stat.is_favorite && <span className="text-[8px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-bold">ГСД</span>}
                                      {stat.inverted && <span className="text-[8px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-bold">ОБР</span>}
                                  </div>
                              </div>
                              <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-tighter">{stat.type}</span>
                          </div>
                          <div className="flex justify-end gap-1.5 pt-3 border-t border-slate-50">
                              <button onClick={() => setExpandedStatId(stat.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold"><TrendingUp size={14}/> График</button>
                              {isAdmin && (
                                  <>
                                      <button onClick={() => handleOpenValues(stat)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold"><Calendar size={14}/> Ввод</button>
                                      <button onClick={() => setEditingStatDef(stat)} className="p-2.5 text-slate-400 bg-slate-50 rounded-xl border border-slate-200"><Edit2 size={14}/></button>
                                      <button onClick={() => handleDeleteStat(stat.id)} className="p-2.5 text-red-400 bg-red-50 rounded-xl border border-red-100"><Trash2 size={14}/></button>
                                  </>
                              )}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  };

  return (
      <div className="flex flex-col h-full animate-in fade-in space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 flex-shrink-0">
             <div className="flex justify-between items-center">
                 <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                     <button onClick={() => setDisplayMode('dashboard')} className={`p-2 rounded-md transition-all ${displayMode === 'dashboard' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><LayoutDashboard size={18}/></button>
                     <button onClick={() => setDisplayMode('list')} className={`p-2 rounded-md transition-all ${displayMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><List size={18}/></button>
                 </div>
                 {isAdmin && (
                     <div className="flex items-center gap-2">
                         <button onClick={handleExportStats} className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200" title="Экспорт"><Download size={18} /></button>
                         <button onClick={() => setIsEditMode(!isEditMode)} className={`p-2 rounded-lg border transition-all ${isEditMode ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} title="Режим редактирования"><Edit2 size={18}/></button>
                     </div>
                 )}
             </div>
             <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 -mx-1 px-1 touch-pan-x">
                  {PERIODS.map(p => (
                      <button key={p.id} onClick={() => setSelectedPeriod(p.id)} className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-lg transition-all border ${selectedPeriod === p.id ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-100'}`}>{p.label}</button>
                  ))}
             </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
              {displayMode === 'dashboard' ? renderDashboardView() : renderListView()}
          </div>

          {/* STAT MODAL */}
          {expandedStatId && (
               <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 md:p-4" onClick={() => setExpandedStatId(null)}>
                   <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                       <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-start gap-4">
                           <h3 className="font-bold text-base md:text-xl text-slate-800 leading-tight flex-1 break-words">{definitions.find(d => d.id === expandedStatId)?.title}</h3>
                           <button onClick={() => setExpandedStatId(null)} className="p-2 hover:bg-slate-100 rounded-full flex-shrink-0"><X size={20}/></button>
                       </div>
                       <div className="flex-1 p-4 md:p-6 bg-slate-50 overflow-y-auto custom-scrollbar">
                            {(() => {
                                const stat = definitions.find(d => d.id === expandedStatId);
                                if (!stat) return null;
                                const vals = getFilteredValues(stat.id);
                                const { current, percent, direction, isGood } = analyzeTrend(vals, stat.inverted);
                                return (
                                    <div className="space-y-6">
                                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                                            <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1 mb-2"><Info size={12}/> Справка</h4>
                                            <p className="text-sm font-medium text-blue-900 leading-relaxed whitespace-pre-wrap">{stat.description || 'Описание отсутствует'}</p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex-1">
                                                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Значение</div>
                                                <div className="text-3xl font-black text-slate-900">{current.toLocaleString()}</div>
                                            </div>
                                            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex-1">
                                                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Динамика</div>
                                                <div className={`text-2xl font-bold flex items-center gap-2 ${isGood ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {direction === 'up' ? <TrendingUp size={24}/> : (direction === 'down' ? <TrendingDown size={24}/> : <Minus size={24}/>)}
                                                    {Math.abs(percent).toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-64 md:h-96 bg-white rounded-2xl border border-slate-200 shadow-sm p-2 md:p-4"><StatsChart values={vals} inverted={stat.inverted} isDouble={stat.is_double} /></div>
                                        {isAdmin && <button onClick={() => { setExpandedStatId(null); handleOpenValues(stat); }} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200">Редактировать значения</button>}
                                    </div>
                                );
                            })()}
                       </div>
                   </div>
               </div>
          )}
          
          {/* DEFINITION EDITOR MODAL */}
          {editingStatDef && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                 <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                     <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                         <h3 className="font-bold text-slate-800">{editingStatDef.id ? 'Редактировать' : 'Новая статистика'}</h3>
                         <button onClick={() => setEditingStatDef(null)}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                     </div>
                     <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Название</label>
                             <input value={editingStatDef.title || ''} onChange={e => setEditingStatDef({...editingStatDef, title: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800" />
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Владелец (Департамент)</label>
                             <select value={editingStatDef.owner_id || ''} onChange={e => setEditingStatDef({...editingStatDef, owner_id: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm">
                                 <option value="">Выберите...</option>
                                 {Object.values(ORGANIZATION_STRUCTURE).map(dept => (
                                     <React.Fragment key={dept.id}>
                                         <option value={dept.id} className="font-bold">{dept.name}</option>
                                         {dept.departments && Object.values(dept.departments).map(sub => (
                                             <option key={sub.id} value={sub.id}>&nbsp;&nbsp;&nbsp;↳ {sub.name}</option>
                                         ))}
                                     </React.Fragment>
                                 ))}
                             </select>
                         </div>
                         <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl">
                             <label className="flex items-center gap-3 cursor-pointer p-1"><input type="checkbox" checked={editingStatDef.is_favorite || false} onChange={e => setEditingStatDef({...editingStatDef, is_favorite: e.target.checked})} className="rounded text-blue-600" /><span className="text-sm font-bold text-slate-700">ГСД</span></label>
                             <label className="flex items-center gap-3 cursor-pointer p-1"><input type="checkbox" checked={editingStatDef.inverted || false} onChange={e => setEditingStatDef({...editingStatDef, inverted: e.target.checked})} className="rounded text-purple-600" /><span className="text-sm font-bold text-slate-700">Обратная</span></label>
                         </div>
                     </div>
                     <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                         <button onClick={() => setEditingStatDef(null)} className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 rounded-xl">Отмена</button>
                         <button onClick={handleSaveDefinition} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg">Сохранить</button>
                     </div>
                 </div>
             </div>
          )}

          {/* VALUES EDITOR MODAL - Fixed for mobile overlaps */}
          {isValueModalOpen && selectedStatForValues && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-2 sm:p-4">
                  <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
                          <div className="min-w-0 pr-4">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Редактор значений</div>
                              <h3 className="font-bold text-sm sm:text-base text-slate-800 leading-tight truncate">{selectedStatForValues.title}</h3>
                          </div>
                          <button onClick={() => setIsValueModalOpen(false)} className="p-1.5 bg-slate-200/50 rounded-full flex-shrink-0"><X size={20} className="text-slate-500"/></button>
                      </div>
                      
                      {/* Editor Form - Fixed mobile grid/flex to prevent squeeze */}
                      <div className="p-4 bg-blue-50 border-b border-blue-100 flex flex-col gap-4 flex-shrink-0 shadow-inner">
                          <div className="flex flex-col sm:flex-row gap-3">
                              <div className="flex-1">
                                  <label className="block text-[10px] font-black text-blue-400 uppercase mb-1 ml-1">Дата</label>
                                  <input 
                                      type="date" 
                                      value={editingValue?.date || ''} 
                                      onChange={e => setEditingValue({...editingValue, date: e.target.value})} 
                                      className="w-full border border-blue-200 bg-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400 shadow-sm h-11" 
                                  />
                              </div>
                              <div className="flex-1">
                                  <label className="block text-[10px] font-black text-blue-400 uppercase mb-1 ml-1">Значение 1</label>
                                  <input 
                                      type="number" 
                                      value={editingValue?.value || ''} 
                                      onChange={e => setEditingValue({...editingValue, value: parseFloat(e.target.value)})} 
                                      className="w-full border border-blue-200 bg-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400 shadow-sm h-11" 
                                      placeholder="0"
                                  />
                              </div>
                              {selectedStatForValues.is_double && (
                                  <div className="flex-1">
                                      <label className="block text-[10px] font-black text-blue-400 uppercase mb-1 ml-1">Значение 2</label>
                                      <input 
                                          type="number" 
                                          value={editingValue?.value2 || ''} 
                                          onChange={e => setEditingValue({...editingValue, value2: parseFloat(e.target.value)})} 
                                          className="w-full border border-blue-200 bg-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400 shadow-sm h-11" 
                                          placeholder="0"
                                      />
                                  </div>
                              )}
                          </div>
                          <div className="flex justify-end gap-2">
                              {editingValue?.id && (
                                  <button onClick={() => setEditingValue({ definition_id: selectedStatForValues.id, date: new Date().toISOString().split('T')[0], value: 0, value2: 0 })} className="px-4 py-2.5 text-slate-500 font-bold hover:bg-slate-200 rounded-xl text-xs transition-colors">Отмена</button>
                              )}
                              <button onClick={handleSaveValue} className="px-8 py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-200 flex items-center gap-2 hover:bg-blue-700 transition-all"><Plus size={16}/> {editingValue?.id ? 'Обновить' : 'Добавить'}</button>
                          </div>
                      </div>

                      {/* Values List Area */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-white touch-pan-y">
                          {currentStatValues.length === 0 ? (
                              <div className="p-12 text-center text-slate-300 flex flex-col items-center gap-2"><Calendar size={48} className="opacity-20"/><p className="text-sm font-medium">История пуста</p></div>
                          ) : (
                              <table className="w-full text-sm">
                                  <thead className="bg-slate-50 text-slate-400 font-black text-[10px] uppercase sticky top-0 z-10 shadow-sm">
                                      <tr>
                                          <th className="px-4 py-3 text-left">Дата</th>
                                          <th className="px-4 py-3 text-right">Значение</th>
                                          {selectedStatForValues.is_double && <th className="px-4 py-3 text-right">Вал 2</th>}
                                          <th className="px-4 py-3 text-right">Действия</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {currentStatValues.map(val => (
                                          <tr key={val.id} className="hover:bg-blue-50/30 transition-colors group">
                                              <td className="px-4 py-3 text-slate-600 font-bold text-xs">{format(new Date(val.date), 'dd.MM.yyyy')}</td>
                                              <td className="px-4 py-3 text-right font-black text-slate-800 text-sm">{val.value.toLocaleString()}</td>
                                              {selectedStatForValues.is_double && <td className="px-4 py-3 text-right font-black text-slate-400 text-sm">{(val.value2 || 0).toLocaleString()}</td>}
                                              <td className="px-4 py-3 text-right">
                                                  <div className="flex justify-end gap-1">
                                                      <button onClick={() => setEditingValue(val)} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={14}/></button>
                                                      <button onClick={() => handleDeleteValue(val.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14}/></button>
                                                  </div>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          )}
                      </div>
                  </div>
              </div>
          )}
      </div>
  );
};

export default StatisticsTab;