
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { StatisticDefinition, StatisticValue, WiseCondition, Employee } from '../types';
import { ORGANIZATION_STRUCTURE, HANDBOOK_STATISTICS } from '../constants';
import StatsChart from './StatsChart';
import { TrendingUp, TrendingDown, LayoutDashboard, Info, HelpCircle, Building2, Layers, Calendar, Edit2, X, List, Search, Plus, Trash2, Sliders, Save, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface StatisticsTabProps {
  employees: Employee[];
  isOffline?: boolean;
  selectedDeptId?: string | null;
  isAdmin?: boolean;
}

// --- CONSTANTS ---
const DEMO_DEFINITIONS: StatisticDefinition[] = HANDBOOK_STATISTICS.map((s, i) => ({ ...s, id: `demo-stat-${i}`, type: 'department', is_favorite: s.title.includes('(ГСД)') }));
const generateMockHistory = (baseVal: number, weeks: number = 52) => {
    return Array.from({ length: weeks }).map((_, i) => {
        const weekOffset = weeks - 1 - i;
        const d = new Date();
        d.setDate(d.getDate() - (weekOffset * 7));
        
        const trend = Math.sin(i / 8) * (baseVal * 0.1) + (i / weeks * baseVal * 0.4); 
        const noise = (Math.random() - 0.5) * (baseVal * 0.1); 
        let val = Math.max(0, Math.floor(baseVal + trend + noise));
        return { id: `mock-val-${Date.now()}-${i}`, definition_id: 'temp', date: format(d, 'yyyy-MM-dd'), value: val };
    });
};
const DEMO_VALUES: Record<string, StatisticValue[]> = {};
DEMO_DEFINITIONS.forEach((def) => { let base = 100; if (def.title.includes('Выручка') || def.title.includes('Доход')) base = 1500000; DEMO_VALUES[def.id] = generateMockHistory(base, 52).map(v => ({...v, definition_id: def.id})); });

const DEPT_ORDER = ['owner', 'dept7', 'dept1', 'dept2', 'dept3', 'dept4', 'dept5', 'dept6'];

const PERIODS = [
    { id: '1w', label: 'Неделя' },
    { id: '3w', label: '3 Нед.' },
    { id: '1m', label: 'Месяц' },
    { id: '3m', label: '3 Мес.' },
    { id: '6m', label: 'Полгода' },
    { id: '1y', label: 'Год' },
    { id: 'all', label: 'Все' },
];

const analyzeTrend = (vals: StatisticValue[], inverted: boolean = false) => {
    if (!vals || vals.length < 1) return { condition: 'non_existence' as WiseCondition, change: 0, current: 0, prev: 0, diff: 0 };
    
    const sorted = [...vals].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const currentVal = sorted[sorted.length - 1].value;
    const prevVal = sorted.length > 1 ? sorted[sorted.length - 2].value : 0;
    
    let change = 0;
    let diff = currentVal - prevVal;

    if (prevVal !== 0) change = (currentVal - prevVal) / Math.abs(prevVal);
    else if (currentVal > 0) change = 1; 
    
    let condition: WiseCondition = 'normal';
    if (change > 0.1) condition = 'affluence';
    else if (change > 0) condition = 'normal';
    else if (change > -0.1) condition = 'emergency';
    else condition = 'danger';

    if (inverted) {
        change = -change;
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
  const [selectedPeriod, setSelectedPeriod] = useState<string>('3m');
  const [infoCardId, setInfoCardId] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'dashboard' | 'list'>('dashboard');
  const [listSearchTerm, setListSearchTerm] = useState('');
  
  // ADMIN EDIT MODE
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingStatDef, setEditingStatDef] = useState<Partial<StatisticDefinition> | null>(null);

  // Values Editing State
  const [isValueModalOpen, setIsValueModalOpen] = useState(false);
  const [selectedStatForValues, setSelectedStatForValues] = useState<StatisticDefinition | null>(null);
  const [currentStatValues, setCurrentStatValues] = useState<StatisticValue[]>([]);
  const [editingValue, setEditingValue] = useState<Partial<StatisticValue>>({});

  useEffect(() => { fetchDefinitions(); fetchAllValues(); }, [isOffline]); 

  const fetchDefinitions = async () => {
    if (isOffline) { 
        // Only set defaults if definitions are empty to allow local CRUD
        if (definitions.length === 0) setDefinitions(DEMO_DEFINITIONS); 
    } 
    else if (supabase) {
        const { data } = await supabase.from('statistics_definitions').select('*').order('title');
        if (data) setDefinitions(data);
    }
  };

  const fetchAllValues = async () => {
      if (isOffline) { 
          // Only set defaults if empty
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

  // --- ADMIN STAT CRUD ---
  const handleCreateOrUpdateStat = async () => {
      if (!isAdmin) return;
      if (!editingStatDef) return;
      if (!editingStatDef.title || !editingStatDef.owner_id) { alert("Необходимо указать Название и Владельца"); return; }
      
      const payload = {
          title: editingStatDef.title,
          description: editingStatDef.description,
          owner_id: editingStatDef.owner_id,
          type: editingStatDef.type || 'department',
          is_favorite: editingStatDef.is_favorite || false,
          inverted: editingStatDef.inverted || false,
          is_double: editingStatDef.is_double || false,
          calculation_method: editingStatDef.calculation_method
      };

      try {
          // OFFLINE / DEMO MODE OR NO CONNECTION
          if (isOffline || !supabase) {
              if (editingStatDef.id) {
                  // Update existing locally
                  setDefinitions(prev => prev.map(d => d.id === editingStatDef.id ? { ...d, ...payload, id: editingStatDef.id! } : d));
              } else {
                  // Create new locally
                  const newId = `local-stat-${Date.now()}`;
                  setDefinitions(prev => [...prev, { ...payload, id: newId } as StatisticDefinition]);
                  // Init empty values
                  setAllLatestValues(prev => ({ ...prev, [newId]: [] }));
              }
          } 
          // ONLINE MODE
          else {
              if (editingStatDef.id) {
                  const { error } = await supabase.from('statistics_definitions').update(payload).eq('id', editingStatDef.id);
                  if (error) throw error;
              } else {
                  const { error } = await supabase.from('statistics_definitions').insert([payload]);
                  if (error) throw error;
              }
              fetchDefinitions(); // Refresh from server
          }
          setEditingStatDef(null);
      } catch (error: any) {
          alert('Ошибка сохранения: ' + error.message);
      }
  };

  const handleDeleteStat = async (id: string) => {
      if (!isAdmin) return;
      if (!confirm("Вы уверены? Это удалит статистику и ВСЮ историю значений.")) return;
      
      try {
        if (isOffline || !supabase) {
            setDefinitions(prev => prev.filter(d => d.id !== id));
            setAllLatestValues(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        } else {
            // Delete values first
            const { error: valError } = await supabase.from('statistics_values').delete().eq('definition_id', id);
            if (valError) throw new Error("Ошибка удаления значений: " + valError.message);

            // Delete definition
            const { error: defError } = await supabase.from('statistics_definitions').delete().eq('id', id);
            if (defError) throw new Error("Ошибка удаления статистики: " + defError.message);
            
            await fetchDefinitions();
        }
      } catch (err: any) {
          alert(err.message || "Не удалось удалить статистику");
          console.error(err);
      }
  };
  
  const openNewStatModal = (preselectOwnerId: string) => {
      setEditingStatDef({ 
          owner_id: preselectOwnerId, 
          type: 'department', 
          is_favorite: false,
          title: ''
      });
  };


  const getFilteredValues = (statId: string) => {
      const vals = allLatestValues[statId] || [];
      if (!vals.length) return [];
      
      const cutoffDate = new Date();
      switch (selectedPeriod) {
          case '1w': cutoffDate.setDate(cutoffDate.getDate() - 7); break;
          case '3w': cutoffDate.setDate(cutoffDate.getDate() - 21); break;
          case '1m': cutoffDate.setMonth(cutoffDate.getMonth() - 1); break;
          case '3m': cutoffDate.setMonth(cutoffDate.getMonth() - 3); break;
          case '6m': cutoffDate.setMonth(cutoffDate.getMonth() - 6); break;
          case '1y': cutoffDate.setFullYear(cutoffDate.getFullYear() - 1); break;
          case 'all': cutoffDate.setTime(0); break;
          default: cutoffDate.setMonth(cutoffDate.getMonth() - 3);
      }

      if (selectedPeriod === 'all') return vals;

      const cutoffString = format(cutoffDate, 'yyyy-MM-dd');
      const filtered = vals.filter(v => v.date >= cutoffString);
      
      if (filtered.length < 2 && vals.length >= 2) {
          const sorted = [...vals].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          return sorted.slice(-4); 
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

  const handleOpenValues = async (stat: StatisticDefinition) => {
      if (!isAdmin) return;
      setSelectedStatForValues(stat);
      
      if(isOffline || !supabase) {
          setCurrentStatValues(allLatestValues[stat.id] || []);
      } else {
          const { data } = await supabase.from('statistics_values').select('*').eq('definition_id', stat.id).order('date', {ascending: false});
          setCurrentStatValues(data || []);
      }
      setEditingValue({ definition_id: stat.id, date: new Date().toISOString().split('T')[0], value: 0 });
      setIsValueModalOpen(true);
  };

  const handleSaveValue = async () => {
      if (!editingValue) return;
      if (!selectedStatForValues) return;
      
      const payload = { 
          definition_id: selectedStatForValues.id, 
          date: editingValue.date || new Date().toISOString().split('T')[0], 
          value: editingValue.value || 0 
      };

      if (isOffline || !supabase) {
           const newVal = { ...payload, id: editingValue.id || `local-val-${Date.now()}` } as StatisticValue;
           
           // Update local state for values
           const updatedList = editingValue.id 
                ? currentStatValues.map(v => v.id === editingValue.id ? newVal : v)
                : [newVal, ...currentStatValues];
           
           // Sort by date descending
           updatedList.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
           setCurrentStatValues(updatedList);
           
           // Update global store
           setAllLatestValues(prev => ({ ...prev, [selectedStatForValues.id]: updatedList }));

      } else {
          if (editingValue.id) { await supabase.from('statistics_values').update(payload).eq('id', editingValue.id); } 
          else { await supabase.from('statistics_values').insert([payload]); }
          
          const { data } = await supabase.from('statistics_values').select('*').eq('definition_id', selectedStatForValues.id).order('date', {ascending: false});
          setCurrentStatValues(data || []);
          fetchAllValues(); // refresh global
      }
      
      // Reset form
      setEditingValue({ definition_id: selectedStatForValues.id, date: new Date().toISOString().split('T')[0], value: 0 });
  };

  // --- RENDER CARD (UPDATED COMPACT DESIGN) ---
  const renderStatCard = (stat: StatisticDefinition, deptColor: string) => {
      const vals = getFilteredValues(stat.id);
      const { current, change, diff } = analyzeTrend(vals, stat.inverted);
      const isPos = change >= 0;
      const trendColorHex = isPos ? "#10b981" : "#f43f5e";
      const isInfoOpen = infoCardId === stat.id;

      return (
          <div 
            key={stat.id} 
            className={`relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[220px] transition-all group ${isEditMode ? 'ring-2 ring-blue-400 ring-offset-2 hover:-translate-y-0' : 'hover:-translate-y-1 hover:shadow-md'}`}
          >
              <div className="absolute top-0 left-0 bottom-0 w-1" style={{backgroundColor: deptColor}}></div>
              
              {/* EDIT MODE OVERLAY (ADMIN ONLY) */}
              {isEditMode && isAdmin && (
                  <div className="absolute top-2 right-2 flex gap-1 z-30 bg-white/90 p-1 rounded-lg border border-slate-100 shadow-sm backdrop-blur-sm animate-in fade-in">
                      <button onClick={(e) => { e.stopPropagation(); setEditingStatDef(stat); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"><Edit2 size={14}/></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteStat(stat.id); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"><Trash2 size={14}/></button>
                  </div>
              )}

              <div className="p-3 pl-4 flex flex-col h-full relative">
                  <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 pr-6">
                           <h3 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2" title={stat.title}>{stat.title}</h3>
                           <div className="text-[9px] text-slate-400 font-medium truncate mt-0.5">{getOwnerName(stat.owner_id || '')}</div>
                      </div>
                      {!isEditMode && <button onClick={(e) => { e.stopPropagation(); setInfoCardId(isInfoOpen ? null : stat.id); }} className={`p-1 rounded-md transition-all ${isInfoOpen ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-50'}`}><Info size={14} /></button>}
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-2xl font-black text-slate-800 tracking-tight">{current.toLocaleString()}</span>
                      <div className={`flex items-center text-[10px] font-bold ${isPos ? 'text-emerald-600' : 'text-rose-600'}`}>{isPos ? <TrendingUp size={10} className="mr-0.5"/> : <TrendingDown size={10} className="mr-0.5"/>} {Math.abs(change * 100).toFixed(0)}%</div>
                  </div>
                  <div className={`flex-1 w-full min-h-0 relative ${isAdmin && !isEditMode ? 'cursor-pointer' : ''}`} onClick={() => isAdmin && !isEditMode && handleOpenValues(stat)}>
                       <StatsChart key={selectedPeriod} values={vals} color={trendColorHex} inverted={stat.inverted} isDouble={stat.is_double} />
                  </div>
                  <div className="absolute bottom-2 right-2 flex gap-1 pointer-events-none opacity-50">
                       {stat.is_favorite && <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded font-bold">ГСД</span>}
                       {stat.is_double && <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 rounded font-bold">2X</span>}
                  </div>
                  {isInfoOpen && !isEditMode && (
                      <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 p-4 animate-in fade-in flex flex-col overflow-y-auto custom-scrollbar">
                           <div className="flex justify-between items-center mb-2"><span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Описание</span><button onClick={() => setInfoCardId(null)}><X size={14} className="text-slate-400 hover:text-slate-600"/></button></div>
                           <p className="text-xs text-slate-700 font-medium leading-relaxed mb-3">{stat.description || "Описание отсутствует."}</p>
                           <div className="mt-auto pt-2 border-t border-slate-100">
                               <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1 flex items-center gap-1"><HelpCircle size={10}/> Методика</div>
                               <div className="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100 font-medium">{stat.calculation_method || "Прямой ввод."}</div>
                           </div>
                           {isAdmin && <button onClick={() => handleOpenValues(stat)} className="mt-3 w-full py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-blue-100 transition-colors"><Calendar size={12}/> Внести данные</button>}
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const renderDashboardView = () => (
      <div className="space-y-10 animate-in fade-in">
          {DEPT_ORDER.filter(id => !selectedDeptId || id === selectedDeptId).map(deptId => {
              const dept = ORGANIZATION_STRUCTURE[deptId];
              if (!dept) return null;
              const deptStats = definitions.filter(d => d.owner_id === deptId);
              let subDeptStats: StatisticDefinition[] = [];
              if (dept.departments) {
                  Object.values(dept.departments).forEach(sub => { subDeptStats.push(...definitions.filter(d => d.owner_id === sub.id)); });
              }
              const isSpecificView = selectedDeptId === deptId;

              if (!isSpecificView) {
                  const allDeptStats = [...deptStats, ...subDeptStats].filter(s => s.is_favorite);
                  // In Edit Mode, we show the section even if empty so you can add to it
                  if (allDeptStats.length === 0 && !isEditMode) return null;

                  return (
                      <div key={deptId} className="space-y-3">
                           <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between border-l-4" style={{borderLeftColor: dept.color}}>
                               <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700">{dept.name}</h2>
                               <span className="text-slate-400 text-xs font-medium">{dept.manager}</span>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                               {allDeptStats.map(stat => renderStatCard(stat, dept.color))}
                               {isEditMode && isAdmin && (
                                   <div onClick={() => openNewStatModal(deptId)} className="border-2 border-dashed border-slate-300 rounded-xl h-[220px] flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                                       <Plus size={32} />
                                       <span className="text-xs font-bold mt-2">Добавить статистику</span>
                                   </div>
                               )}
                           </div>
                      </div>
                  );
              } else {
                  return (
                      <div key={deptId} className="space-y-6">
                           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                               <div className="absolute top-0 right-0 w-32 h-32 opacity-10 rounded-full -mr-10 -mt-10 pointer-events-none" style={{backgroundColor: dept.color}}></div>
                               <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 relative z-10"><div className="p-2 rounded-xl text-white shadow-md" style={{backgroundColor: dept.color}}><Building2 size={24}/></div>{dept.fullName}</h2>
                               {dept.vfp && (<div className="mt-4 pt-4 border-t border-slate-100"><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ценный Конечный Продукт (ЦКП)</div><p className="text-slate-700 text-sm font-medium leading-relaxed border-l-2 pl-3" style={{borderColor: dept.color}}>{dept.vfp}</p></div>)}
                           </div>
                           
                           {(deptStats.length > 0 || isEditMode) && (
                               <div className="space-y-3">
                                   <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-xs tracking-widest px-1"><Layers size={14}/> Общие статистики</div>
                                   <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                       {deptStats.map(stat => renderStatCard(stat, dept.color))}
                                       {isEditMode && isAdmin && (
                                           <div onClick={() => openNewStatModal(deptId)} className="border-2 border-dashed border-slate-300 rounded-xl h-[220px] flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                                               <Plus size={32} />
                                               <span className="text-xs font-bold mt-2">Добавить</span>
                                           </div>
                                       )}
                                   </div>
                               </div>
                           )}

                           {dept.departments && Object.values(dept.departments).map(sub => {
                               const subStats = definitions.filter(d => d.owner_id === sub.id);
                               if (subStats.length === 0 && !isEditMode) return null;
                               return (
                                   <div key={sub.id} className="space-y-3 pt-4 border-t border-slate-200/50">
                                       <div className="flex items-center gap-3"><span className="px-2 py-0.5 rounded text-white font-bold text-xs" style={{backgroundColor: dept.color}}>DIV {sub.code}</span><h3 className="text-base font-bold text-slate-700">{sub.name}</h3></div>
                                       <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                           {subStats.map(stat => renderStatCard(stat, dept.color))}
                                           {isEditMode && isAdmin && (
                                               <div onClick={() => openNewStatModal(sub.id)} className="border-2 border-dashed border-slate-300 rounded-xl h-[220px] flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                                                   <Plus size={32} />
                                                   <span className="text-xs font-bold mt-2">Добавить</span>
                                               </div>
                                           )}
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
      const filtered = definitions.filter(d => d.title.toLowerCase().includes(listSearchTerm.toLowerCase()));
      const grouped: Record<string, StatisticDefinition[]> = {};
      
      // Group by Parent Dept to recreate separation
      filtered.forEach(def => {
          const parentDeptId = getParentDeptId(def.owner_id || 'other');
          if (!grouped[parentDeptId]) grouped[parentDeptId] = [];
          grouped[parentDeptId].push(def);
      });

      // Sort keys by DEPT_ORDER
      const sortedKeys = Object.keys(grouped).sort((a, b) => {
          const idxA = DEPT_ORDER.indexOf(a);
          const idxB = DEPT_ORDER.indexOf(b);
          const valA = idxA === -1 ? 999 : idxA;
          const valB = idxB === -1 ? 999 : idxB;
          return valA - valB;
      });

      return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full animate-in fade-in">
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 rounded-t-2xl gap-3">
                  <div className="relative w-full md:w-auto">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                      <input 
                        className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl w-full md:w-64 text-sm focus:ring-2 focus:ring-blue-100 outline-none transition-all" 
                        placeholder="Найти статистику..." 
                        value={listSearchTerm}
                        onChange={e => setListSearchTerm(e.target.value)}
                      />
                  </div>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {sortedKeys.map(deptId => {
                      const dept = ORGANIZATION_STRUCTURE[deptId] || { name: 'Прочее', color: '#94a3b8' };
                      if(selectedDeptId && selectedDeptId !== deptId) return null;

                      return (
                          <div key={deptId} className="mb-0">
                              <div className="sticky top-0 z-10 px-6 py-3 bg-slate-100/90 backdrop-blur-sm border-y border-slate-200 flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: dept.color}}></div>
                                  <span className="font-black text-slate-600 text-xs uppercase tracking-wider">{dept.name}</span>
                              </div>
                              <table className="w-full text-sm text-left">
                                  {deptId === sortedKeys[0] && (
                                      <thead className="text-xs text-slate-400 uppercase bg-slate-50 hidden md:table-header-group">
                                          <tr>
                                              <th className="px-6 py-3 w-1/2">Название Статистики</th>
                                              <th className="px-6 py-3">Владелец</th>
                                              <th className="px-6 py-3">Текущее</th>
                                              <th className="px-6 py-3 text-right">Ввод</th>
                                          </tr>
                                      </thead>
                                  )}
                                  <tbody className="divide-y divide-slate-100">
                                      {grouped[deptId].map(def => {
                                          const vals = allLatestValues[def.id] || [];
                                          const { current, change } = analyzeTrend(vals, def.inverted);
                                          const isPos = change >= 0;
                                          return (
                                              <tr key={def.id} className="hover:bg-blue-50/30 group transition-colors">
                                                  <td className="px-6 py-3 md:py-4 font-bold text-slate-700">
                                                      {def.title}
                                                      {def.is_favorite && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded inline-block">ГСД</span>}
                                                  </td>
                                                  <td className="px-6 py-2 md:py-4 text-slate-500 text-xs md:text-sm">
                                                      {getOwnerName(def.owner_id || '')}
                                                  </td>
                                                  <td className="px-6 py-2 md:py-4">
                                                      <div className="flex items-center gap-2">
                                                          <span className="font-black text-slate-800">{current.toLocaleString()}</span>
                                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPos ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                              {isPos ? '↑' : '↓'} {Math.abs(change * 100).toFixed(0)}%
                                                          </span>
                                                      </div>
                                                  </td>
                                                  <td className="px-6 py-2 md:py-4 text-right">
                                                      {isAdmin && (
                                                          <div className="flex justify-end gap-2">
                                                              <button onClick={() => handleOpenValues(def)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center">
                                                                  <Edit2 size={16}/>
                                                              </button>
                                                              {isEditMode && (
                                                                  <div className="flex gap-2">
                                                                      <button onClick={(e) => { e.stopPropagation(); setEditingStatDef(def); }} className="p-2 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center">
                                                                          <Sliders size={16}/>
                                                                      </button>
                                                                      <button onClick={(e) => { e.stopPropagation(); handleDeleteStat(def.id); }} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center">
                                                                          <Trash2 size={16}/>
                                                                      </button>
                                                                  </div>
                                                              )}
                                                          </div>
                                                      )}
                                                  </td>
                                              </tr>
                                          );
                                      })}
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
        
        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex items-center gap-4">
                <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex">
                    <button onClick={() => setDisplayMode('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${displayMode === 'dashboard' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <LayoutDashboard size={16}/> Дашборд
                    </button>
                    <button onClick={() => setDisplayMode('list')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${displayMode === 'list' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <List size={16}/> Список
                    </button>
                </div>
                
                {/* ADMIN EDIT TOGGLE */}
                {isAdmin && (
                    <button 
                        onClick={() => setIsEditMode(!isEditMode)} 
                        className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border ${isEditMode ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-100' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                        {isEditMode ? <><X size={16}/> Завершить</> : <><Edit2 size={16}/> Конструктор</>}
                    </button>
                )}
            </div>

            {displayMode === 'dashboard' && (
                <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto w-full md:w-auto">
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-0 md:pr-2 pb-20">
             {displayMode === 'dashboard' ? renderDashboardView() : renderListView()}
        </div>

        {/* --- STAT DEFINITION MODAL (CREATE/EDIT) --- */}
        {editingStatDef && (
            <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                     <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <h3 className="font-bold text-lg text-slate-800">{editingStatDef.id ? 'Редактировать статистику' : 'Создать статистику'}</h3>
                        <button onClick={() => setEditingStatDef(null)}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    
                    {/* Offline Warning */}
                    {(isOffline || !supabase) && (
                        <div className="mb-4 p-3 bg-amber-50 text-amber-800 text-xs rounded-xl flex items-start gap-2 border border-amber-100">
                             <AlertCircle size={16} className="mt-0.5 flex-shrink-0"/>
                             <div>
                                 <strong>Внимание: Офлайн режим</strong>
                                 <p className="mt-0.5 opacity-80">Изменения сохранятся только в памяти браузера и исчезнут после перезагрузки страницы.</p>
                             </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Название *</label>
                            <input value={editingStatDef.title || ''} onChange={e => setEditingStatDef({...editingStatDef, title: e.target.value})} className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm" placeholder="Например: Валовый Доход" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Владелец (Департамент) *</label>
                            <select value={editingStatDef.owner_id || ''} onChange={e => setEditingStatDef({...editingStatDef, owner_id: e.target.value})} className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm">
                                <option value="">Выберите владельца...</option>
                                {Object.values(ORGANIZATION_STRUCTURE).map(dept => (<React.Fragment key={dept.id}><option value={dept.id} className="font-bold text-slate-900">⭐ {dept.fullName}</option>{dept.departments && Object.values(dept.departments).map(sub => (<option key={sub.id} value={sub.id} className="text-slate-600">&nbsp;&nbsp;&nbsp;↳ {sub.name}</option>))}</React.Fragment>))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Описание</label>
                            <textarea value={editingStatDef.description || ''} onChange={e => setEditingStatDef({...editingStatDef, description: e.target.value})} className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-xl min-h-[80px] focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm" placeholder="Что измеряем..." />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Методика Расчета</label>
                             <input value={editingStatDef.calculation_method || ''} onChange={e => setEditingStatDef({...editingStatDef, calculation_method: e.target.value})} className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-xl text-sm" placeholder="Как считаем..." />
                        </div>
                        <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={editingStatDef.is_favorite || false} onChange={e => setEditingStatDef({...editingStatDef, is_favorite: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-blue-600" /><span className="text-sm font-medium text-slate-700">ГСД (Показывать на главном экране)</span></label>
                            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={editingStatDef.inverted || false} onChange={e => setEditingStatDef({...editingStatDef, inverted: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-blue-600" /><span className="text-sm font-medium text-slate-700">Обратная (Меньше = Лучше)</span></label>
                            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={editingStatDef.is_double || false} onChange={e => setEditingStatDef({...editingStatDef, is_double: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-blue-600" /><span className="text-sm font-medium text-slate-700">Двойная (2 графика)</span></label>
                        </div>
                    </div>
                    <button onClick={handleCreateOrUpdateStat} className="mt-6 w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2">
                        <Save size={18}/> Сохранить
                    </button>
                </div>
            </div>
        )}

        {/* --- VALUE ENTRY MODAL (REUSED) --- */}
        {isValueModalOpen && selectedStatForValues && (
             <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 animate-in zoom-in-95 flex flex-col max-h-[80vh]">
                     <div className="flex justify-between items-center mb-4 border-b pb-4">
                        <div>
                            <h3 className="font-bold text-sm text-slate-800 line-clamp-1">{selectedStatForValues.title}</h3>
                            <p className="text-xs text-slate-400">Ввод данных</p>
                        </div>
                        <button onClick={() => setIsValueModalOpen(false)}><X size={18} className="text-slate-400"/></button>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl mb-4">
                        <div className="flex gap-2">
                             <input type="date" value={editingValue.date || ''} onChange={e => setEditingValue({...editingValue, date: e.target.value})} className="border border-slate-300 bg-white p-2 rounded-lg text-xs w-28" />
                             <input type="number" value={editingValue.value || 0} onChange={e => setEditingValue({...editingValue, value: parseFloat(e.target.value)})} className="border border-slate-300 bg-white p-2 rounded-lg flex-1 text-sm font-bold" placeholder="0" />
                        </div>
                        <button onClick={handleSaveValue} className="w-full mt-2 bg-blue-600 text-white py-2 rounded-lg font-bold text-xs">Сохранить запись</button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                        {currentStatValues.map(val => (
                            <div key={val.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded border-b border-transparent hover:border-slate-100 text-xs">
                                <div><span className="font-bold mr-2">{val.value}</span><span className="text-slate-400">{format(new Date(val.date), 'dd.MM.yy')}</span></div>
                                <button className="text-blue-500" onClick={() => setEditingValue(val)}><Edit2 size={12}/></button>
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
