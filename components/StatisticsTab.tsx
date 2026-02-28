
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { StatisticDefinition, StatisticValue, WiseCondition, Employee } from '../types';
import { ORGANIZATION_STRUCTURE, HANDBOOK_STATISTICS } from '../constants';
import StatsChart from './StatsChart';
import ConfirmationModal from './ConfirmationModal';
import { TrendingUp, TrendingDown, LayoutDashboard, Info, HelpCircle, Building2, Layers, Calendar, Edit2, X, List, Search, Plus, Trash2, Sliders, Save, AlertCircle, ArrowDownUp, Download, Upload, Maximize2, MoreHorizontal, Minus, ChevronDown, ChevronUp, FileSpreadsheet, Target, Award, Crown } from 'lucide-react';
import { format } from 'date-fns';

interface StatisticsTabProps {
  employees: Employee[];
  isOffline?: boolean;
  selectedDeptId?: string | null;
  isAdmin?: boolean;
}

const DEMO_DEFINITIONS: StatisticDefinition[] = HANDBOOK_STATISTICS.map((s, i) => ({ ...s, id: `demo-stat-${i}`, type: 'department', description: s.title.includes('ГСД') ? 'Ключевой показатель эффективности подразделения.' : 'Вспомогательная статистика для мониторинга деятельности.' }));
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
    if (!vals || vals.length === 0) return { current: 0, prev: 0, delta: 0, percent: 0, direction: 'flat' as const, isGood: true };
    const sorted = [...vals].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const n = sorted.length;
    const current = sorted[n - 1].value;
    const startOfPeriod = sorted[0].value; 
    const prev = n > 1 ? startOfPeriod : 0;
    const delta = current - prev;
    let percent = prev === 0 ? (current === 0 ? 0 : 100) : (delta / Math.abs(prev)) * 100;
    let direction: 'up' | 'down' | 'flat' = delta > 0 ? 'up' : (delta < 0 ? 'down' : 'flat');
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
  const [isLoading, setIsLoading] = useState(true);
  const [editingStatDef, setEditingStatDef] = useState<Partial<StatisticDefinition> | null>(null);
  const [isValueModalOpen, setIsValueModalOpen] = useState(false);
  const [selectedStatForValues, setSelectedStatForValues] = useState<StatisticDefinition | null>(null);
  const [currentStatValues, setCurrentStatValues] = useState<StatisticValue[]>([]);
  const [editingValue, setEditingValue] = useState<Partial<StatisticValue>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      statId: string | null;
  }>({ isOpen: false, title: '', message: '', statId: null });

  useEffect(() => {
    setIsLoading(true);
    fetchDefinitions().finally(() => setIsLoading(false));
    fetchAllValues();
  }, [isOffline]);

  const fetchDefinitions = async () => {
    if (isOffline) {
      if (definitions.length === 0) setDefinitions(DEMO_DEFINITIONS);
    } else if (supabase) {
        const { data, error } = await supabase.from('statistics_definitions').select('*').order('title');
        if (data) setDefinitions(data);
        else if (error) console.error('[StatisticsTab] fetchDefinitions error:', error.message);
    }
  };

  const fetchAllValues = async () => {
      if (isOffline) { if (Object.keys(allLatestValues).length === 0) setAllLatestValues(DEMO_VALUES); return; }
      if (supabase) {
          const { data, error } = await supabase.from('statistics_values').select('*');
          if (data) {
              const grouped: Record<string, StatisticValue[]> = {};
              data.forEach((v: StatisticValue) => {
                  if (!grouped[v.definition_id]) grouped[v.definition_id] = [];
                  grouped[v.definition_id].push(v);
              });
              setAllLatestValues(grouped);
          } else if (error) {
              console.error('[StatisticsTab] fetchAllValues error:', error.message);
          }
      }
  };

  const handleExportStats = () => {
      const csvRows = [['ID Статистики (Не менять)', 'Департамент', 'Название Статистики', 'Описание', 'Период', 'Текущее Значение', 'Динамика'].join(',')];
      definitions.forEach(stat => {
          const vals = getFilteredValues(stat.id);
          const { current, percent, direction } = analyzeTrend(vals, stat.inverted);
          const deptName = getOwnerName(stat.owner_id || '').replace(/,/g, '');
          const title = stat.title.replace(/,/g, ' ');
          const desc = (stat.description || '').replace(/,/g, ' ');
          csvRows.push([stat.id, `"${deptName}"`, `"${title}"`, `"${desc}"`, selectedPeriod, current, `${percent.toFixed(1)}%`].join(','));
      });
      const csvContent = "\ufeff" + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `statistics_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
          const content = ev.target?.result as string;
          const lines = content.split('\n');
          let importCount = 0;
          for (let i = 1; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
              const statId = cols[0]?.replace(/"/g, '').trim();
              const dateInput = cols[9]?.replace(/"/g, '').trim(); // Custom logic for specific imports
              const valInput = cols[10]?.replace(/"/g, '').trim();
              if (statId && dateInput && valInput && !isNaN(parseFloat(valInput))) {
                  const payload = { definition_id: statId, date: dateInput, value: parseFloat(valInput) };
                  if (isOffline || !supabase) {
                      setAllLatestValues(prev => { const existing = prev[statId] || []; return { ...prev, [statId]: [...existing, { ...payload, id: `local-${Date.now()}-${i}` }] }; });
                  } else { await supabase.from('statistics_values').insert([payload]); }
                  importCount++;
              }
          }
          if (importCount > 0) { alert(`Успешно импортировано значений: ${importCount}`); fetchAllValues(); }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveDefinition = async () => {
    if (!editingStatDef || !editingStatDef.title || !editingStatDef.owner_id) return;
    const payload = { title: editingStatDef.title, description: editingStatDef.description || '', type: editingStatDef.type || 'department', owner_id: editingStatDef.owner_id, inverted: editingStatDef.inverted || false, is_favorite: editingStatDef.is_favorite || false, is_double: editingStatDef.is_double || false, calculation_method: editingStatDef.calculation_method || '' };
    try {
        if (isOffline || !supabase) {
             const newDef = { ...payload, id: editingStatDef.id || `local-def-${Date.now()}` } as StatisticDefinition;
             setDefinitions(prev => editingStatDef.id ? prev.map(d => d.id === editingStatDef.id ? newDef : d) : [...prev, newDef]);
             if (selectedStatForValues?.id === editingStatDef.id) setSelectedStatForValues(newDef);
        } else {
            if (editingStatDef.id) { await supabase.from('statistics_definitions').update(payload).eq('id', editingStatDef.id); } 
            else { await supabase.from('statistics_definitions').insert([payload]); }
            await fetchDefinitions();
            if (selectedStatForValues?.id === editingStatDef.id) {
                 const { data } = await supabase.from('statistics_definitions').select('*').eq('id', editingStatDef.id).single();
                 if (data) setSelectedStatForValues(data);
            }
        }
        setEditingStatDef(null);
    } catch (err) {}
  };

  const openDeleteConfirm = (id: string) => {
      const stat = definitions.find(d => d.id === id);
      if (!stat) return;
      setConfirmModal({
          isOpen: true,
          title: 'Удаление статистики',
          message: `Вы действительно хотите удалить "${stat.title}"?\nВсе исторические данные (график) будут стерты без возможности восстановления.`,
          statId: id
      });
  };

  const executeDeleteStat = async () => {
      const id = confirmModal.statId;
      if (!id) return;
      try {
        if (isOffline || !supabase) {
            setDefinitions(prev => prev.filter(d => d.id !== id));
            setAllLatestValues(prev => { const next = { ...prev }; delete next[id]; return next; });
        } else {
            await supabase.from('statistics_values').delete().eq('definition_id', id);
            await supabase.from('statistics_definitions').delete().eq('id', id);
            await fetchDefinitions();
            await fetchAllValues();
        }
        setConfirmModal({ isOpen: false, title: '', message: '', statId: null });
        if (expandedStatId === id) setExpandedStatId(null);
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
      if(!confirm("Удалить запись?")) return;
      if(isOffline || !supabase) { setCurrentStatValues(prev => prev.filter(v => v.id !== id)); return; }
      const { error } = await supabase.from('statistics_values').delete().eq('id', id);
      if(!error) { setCurrentStatValues(prev => prev.filter(v => v.id !== id)); fetchAllValues(); }
  };

  const renderStatCard = (stat: StatisticDefinition, deptColor: string, contextKey: string) => {
      const vals = getFilteredValues(stat.id);
      const { current, percent, direction, isGood } = analyzeTrend(vals, stat.inverted);
      const trendColorHex = isGood ? "#10b981" : "#f43f5e"; 
      return (
          <div key={`${contextKey}-${stat.id}`} onClick={() => !isEditMode && setExpandedStatId(stat.id)} className={`relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[210px] md:h-[240px] transition-all group ${isEditMode ? 'ring-2 ring-blue-400 ring-offset-2' : 'cursor-pointer hover:shadow-md hover:border-slate-300'}`}>
              <div className="absolute top-0 left-0 bottom-0 w-1" style={{backgroundColor: deptColor}}></div>
              <div className="p-3 md:p-4 flex flex-col h-full relative z-10">
                  <div className="flex justify-between items-start mb-1">
                      <div className="flex-1 pr-6">
                           <h3 className="text-[10px] font-black text-slate-800 uppercase leading-tight mb-1 line-clamp-2">{stat.title}</h3>
                           <div className="text-[9px] text-slate-400 font-medium line-clamp-2 min-h-[22px] leading-snug">{stat.description || 'Описание показателя отсутствует'}</div>
                      </div>
                      {stat.inverted && <span className="text-[8px] bg-purple-100 text-purple-700 px-1 rounded font-bold ml-1">ОБР</span>}
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-xl md:text-2xl font-black text-slate-900">{current.toLocaleString()}</span>
                      {vals.length > 1 && (
                          <div className={`flex items-center text-[10px] font-bold ${isGood ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {direction === 'up' && <TrendingUp size={10} className="mr-0.5"/>}
                              {direction === 'down' && <TrendingDown size={10} className="mr-0.5"/>}
                              {Math.abs(percent).toFixed(0)}%
                          </div>
                      )}
                  </div>
                  <div className={`flex-1 w-full min-h-0 relative`}><StatsChart values={vals} color={trendColorHex} inverted={stat.inverted} isDouble={stat.is_double} /></div>
                  
                  {stat.is_favorite && <div className="absolute bottom-2 right-2 text-[8px] font-black text-amber-500 uppercase tracking-widest opacity-60">ГСД</div>}
                  
                  {isEditMode && isAdmin && (
                    <div className="absolute top-2 right-2 flex gap-1 bg-white/90 p-1 rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 transition-all z-20">
                        <button onClick={(e) => { e.stopPropagation(); setEditingStatDef(stat); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"><Edit2 size={12}/></button>
                        <button onClick={(e) => { e.stopPropagation(); openDeleteConfirm(stat.id); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"><Trash2 size={12}/></button>
                    </div>
                  )}
              </div>
          </div>
      );
  };

  const renderSkeletonCard = (key: string) => (
      <div key={key} className="bg-white rounded-xl shadow-sm border border-slate-200 h-[210px] md:h-[240px] animate-pulse">
          <div className="p-4 flex flex-col h-full">
              <div className="h-3 bg-slate-200 rounded w-3/4 mb-2"></div>
              <div className="h-2 bg-slate-100 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
              <div className="flex-1 bg-slate-100 rounded"></div>
          </div>
      </div>
  );

  const renderDashboardView = () => {
    if (!selectedDeptId) {
        if (isLoading) {
            return (
                <div className="space-y-12 animate-in fade-in pb-20">
                    {DEPT_ORDER.slice(1).map(deptId => {
                        const dept = ORGANIZATION_STRUCTURE[deptId];
                        if (!dept) return null;
                        return (
                            <div key={deptId} className="space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg animate-pulse bg-slate-200"></div>
                                        <div className="h-4 bg-slate-200 rounded w-32 animate-pulse"></div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                                    {[1, 2, 3].map(i => renderSkeletonCard(`${deptId}-skel-${i}`))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        return (
            <div className="space-y-12 animate-in fade-in pb-20">
                {DEPT_ORDER.map(deptId => {
                    const dept = ORGANIZATION_STRUCTURE[deptId];
                    if (!dept) return null;
                    const subIds = dept.departments ? Object.keys(dept.departments) : [];
                    const allDeptIds = [deptId, ...subIds];
                    const favStats = definitions.filter(d => allDeptIds.includes(d.owner_id || '') && d.is_favorite);
                    if (favStats.length === 0 && !isEditMode) return null;
                    
                    return (
                        <div key={deptId} className="space-y-4">
                             <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                 <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black shadow-md text-xs" style={{backgroundColor: dept.color}}>{deptId === 'owner' ? <Crown size={14}/> : dept.name.split('.')[0]}</div>
                                     <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">{dept.name}</h2>
                                 </div>
                                 <span className="text-[10px] text-slate-400 font-bold uppercase">ГЛАВНЫЕ ПОКАЗАТЕЛИ (ГСД)</span>
                             </div>
                             <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                                 {favStats.map(stat => renderStatCard(stat, dept.color, 'dash'))}
                             </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    const dept = ORGANIZATION_STRUCTURE[selectedDeptId];
    if (!dept) return null;
    const deptMainStats = definitions.filter(d => d.owner_id === selectedDeptId);
    const subDepts = dept.departments ? Object.values(dept.departments) : [];

    return (
        <div className="space-y-8 animate-in fade-in pb-24">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg" style={{backgroundColor: dept.color}}>
                        {selectedDeptId === 'owner' ? <Crown size={24}/> : dept.name.split('.')[0]}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">{dept.fullName}</h1>
                        <p className="text-sm text-slate-400 font-bold mt-1 uppercase">РУКОВОДИТЕЛЬ: {dept.manager}</p>
                    </div>
                </div>
                {dept.vfp && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                         <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Award size={10}/> ЦЕННЫЙ КОНЕЧНЫЙ ПРОДУКТ (ЦКП)</div>
                         <p className="text-sm font-semibold text-slate-600 italic">"{dept.vfp}"</p>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500"><Layers size={14}/></div>
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Общие статистики департамента</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {isLoading && deptMainStats.length === 0
                        ? [1, 2, 3].map(i => renderSkeletonCard(`dept-main-skel-${i}`))
                        : deptMainStats.map(stat => renderStatCard(stat, dept.color, 'dept-main'))}
                    {isEditMode && isAdmin && (
                        <div onClick={() => setEditingStatDef({ owner_id: selectedDeptId, type: 'department', is_favorite: false, title: '', description: '' })} className="border-2 border-dashed border-slate-200 rounded-xl h-[210px] md:h-[240px] flex flex-col items-center justify-center text-slate-300 cursor-pointer hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                            <Plus size={32} /><span className="text-xs font-bold mt-2">Добавить</span>
                        </div>
                    )}
                </div>
            </div>

            {subDepts.map(sub => {
                const subStats = definitions.filter(d => d.owner_id === sub.id);
                if (subStats.length === 0 && !isEditMode && !isLoading) return null;
                return (
                    <div key={sub.id} className="space-y-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 px-1">
                            <div className="bg-amber-100 px-2 py-1 rounded-lg text-amber-700 text-[10px] font-black border border-amber-200 uppercase tracking-tight">DIV {sub.code}</div>
                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{sub.name}</span>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {isLoading && subStats.length === 0
                                ? [1, 2].map(i => renderSkeletonCard(`${sub.id}-skel-${i}`))
                                : subStats.map(stat => renderStatCard(stat, dept.color, `sub-${sub.id}`))}
                            {isEditMode && isAdmin && (
                                <div onClick={() => setEditingStatDef({ owner_id: sub.id, type: 'department', is_favorite: false, title: '', description: '' })} className="border-2 border-dashed border-slate-200 rounded-xl h-[210px] md:h-[240px] flex flex-col items-center justify-center text-slate-300 cursor-pointer hover:border-amber-400 hover:text-amber-500 hover:bg-amber-50/50 transition-all">
                                    <Plus size={28} /><span className="text-[10px] font-bold mt-1 uppercase">В отдел {sub.code}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
  };

  const renderListView = () => {
      const sortedDefs = [...definitions].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      return (
          <div className="space-y-4 animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                              <tr>
                                  <th className="px-6 py-4">Название</th>
                                  <th className="px-6 py-4">Владелец</th>
                                  <th className="px-6 py-4">Тип</th>
                                  <th className="px-6 py-4 text-right">Действия</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {sortedDefs.map(stat => (
                                  <tr key={stat.id} className="hover:bg-slate-50 transition-colors group">
                                      <td className="px-6 py-4">
                                          <div className="font-bold text-slate-800">{stat.title}</div>
                                          <div className="text-[10px] text-slate-400 mt-0.5 italic line-clamp-1">{stat.description || 'Описание отсутствует'}</div>
                                          <div className="flex gap-1 mt-2">
                                              {stat.is_favorite && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">ГСД</span>}
                                              {stat.inverted && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">ОБР</span>}
                                          </div>
                                      </td>
                                      <td className="px-6 py-4 text-slate-600 font-medium">{getOwnerName(stat.owner_id || '')}</td>
                                      <td className="px-6 py-4"><span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs font-bold uppercase">{stat.type}</span></td>
                                      <td className="px-6 py-4 text-right">
                                          <div className="flex justify-end gap-2">
                                              <button onClick={() => setExpandedStatId(stat.id)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Посмотреть график"><TrendingUp size={16}/></button>
                                              {isAdmin && (
                                                  <>
                                                      <button onClick={() => handleOpenValues(stat)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer" title="Ввод данных"><Calendar size={16}/></button>
                                                      <button onClick={() => setEditingStatDef(stat)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Редактировать"><Edit2 size={16}/></button>
                                                      <button onClick={(e) => { e.stopPropagation(); openDeleteConfirm(stat.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" title="Удалить"><Trash2 size={16}/></button>
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
          </div>
      );
  };

  return (
      <div className="flex flex-col h-full animate-in fade-in space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 flex-shrink-0">
             <div className="flex justify-between items-center">
                 <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                     <button onClick={() => setDisplayMode('dashboard')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${displayMode === 'dashboard' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><LayoutDashboard size={16}/> Дашборд</button>
                     <button onClick={() => setDisplayMode('list')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${displayMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><List size={16}/> Список</button>
                 </div>
                 {isAdmin && (
                     <div className="flex items-center gap-2">
                         <input type="file" ref={fileInputRef} onChange={handleImportCSV} className="hidden" accept=".csv" />
                         <button onClick={() => fileInputRef.current?.click()} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg border border-emerald-200 cursor-pointer" title="Импорт CSV"><Upload size={18} /></button>
                         <button onClick={handleExportStats} className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 cursor-pointer" title="Экспорт CSV"><Download size={18} /></button>
                         <button onClick={() => setIsEditMode(!isEditMode)} className={`p-2 rounded-lg border transition-all cursor-pointer ${isEditMode ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} title="Конструктор (Редактирование)"><Edit2 size={18}/></button>
                     </div>
                 )}
             </div>
             <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 -mx-1 px-1 touch-pan-x">
                  {PERIODS.map(p => (
                      <button key={p.id} onClick={() => setSelectedPeriod(p.id)} className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-lg transition-all border cursor-pointer ${selectedPeriod === p.id ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}>{p.label}</button>
                  ))}
             </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-1">
              {displayMode === 'dashboard' ? renderDashboardView() : renderListView()}
          </div>

          {/* STAT MODAL */}
          {expandedStatId && (
               <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 md:p-4" onClick={() => setExpandedStatId(null)}>
                   <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                       <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-start gap-4">
                           <div className="flex-1 min-w-0 pr-4">
                               <h3 className="font-bold text-base md:text-xl text-slate-800 leading-tight break-words mb-1">{definitions.find(d => d.id === expandedStatId)?.title}</h3>
                               <p className="text-xs text-slate-400 font-medium">{getOwnerName(definitions.find(d => d.id === expandedStatId)?.owner_id || '')}</p>
                           </div>
                           <div className="flex gap-2">
                               {isAdmin && (
                                   <button onClick={() => openDeleteConfirm(expandedStatId)} className="p-2 text-red-400 hover:bg-red-50 rounded-full cursor-pointer"><Trash2 size={20}/></button>
                               )}
                               <button onClick={() => setExpandedStatId(null)} className="p-2 hover:bg-slate-100 rounded-full flex-shrink-0 cursor-pointer"><X size={20}/></button>
                           </div>
                       </div>
                       <div className="flex-1 p-4 md:p-6 bg-slate-50 overflow-y-auto custom-scrollbar">
                            {(() => {
                                const stat = definitions.find(d => d.id === expandedStatId);
                                if (!stat) return null;
                                const vals = getFilteredValues(stat.id);
                                const { current, percent, direction, isGood } = analyzeTrend(vals, stat.inverted);
                                return (
                                    <div className="space-y-6">
                                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl relative group">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1"><Info size={12}/> Справка</h4>
                                                {isAdmin && (
                                                    <button onClick={() => setEditingStatDef(stat)} className="p-1.5 text-blue-400 hover:text-blue-600 bg-white rounded-lg shadow-sm cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={12}/></button>
                                                )}
                                            </div>
                                            <p className="text-sm font-medium text-blue-900 leading-relaxed whitespace-pre-wrap">{stat.description || 'Описание отсутствует. Добавьте его через конструктор.'}</p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex-1">
                                                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Текущее значение</div>
                                                <div className="text-3xl font-black text-slate-900">{current.toLocaleString()}</div>
                                            </div>
                                            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex-1">
                                                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Динамика периода</div>
                                                <div className={`text-2xl font-bold flex items-center gap-2 ${isGood ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {direction === 'up' ? <TrendingUp size={24}/> : (direction === 'down' ? <TrendingDown size={24}/> : <Minus size={24}/>)}
                                                    {Math.abs(percent).toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-64 md:h-96 bg-white rounded-2xl border border-slate-200 shadow-sm p-2 md:p-4"><StatsChart values={vals} inverted={stat.inverted} isDouble={stat.is_double} /></div>
                                        {isAdmin && <button onClick={() => { setExpandedStatId(null); handleOpenValues(stat); }} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 cursor-pointer hover:bg-blue-700 transition-all uppercase tracking-wider text-sm">Редактировать данные (Ввод)</button>}
                                    </div>
                                );
                            })()}
                       </div>
                   </div>
               </div>
          )}
          
          {/* DEFINITION EDITOR MODAL (CONSTRUCTOR) */}
          {editingStatDef && (
             <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                 <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                     <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                         <h3 className="font-bold text-slate-800">{editingStatDef.id ? 'Редактировать' : 'Новая статистика'}</h3>
                         <button onClick={() => setEditingStatDef(null)} className="cursor-pointer text-slate-400 hover:text-slate-600"><X size={20} /></button>
                     </div>
                     <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Название статистики</label>
                             <input value={editingStatDef.title || ''} onChange={e => setEditingStatDef({...editingStatDef, title: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800 shadow-sm" placeholder="Напр: Валовая выручка" />
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Описание / Метод подсчета</label>
                             <textarea value={editingStatDef.description || ''} onChange={e => setEditingStatDef({...editingStatDef, description: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] text-sm font-medium text-slate-700 shadow-sm leading-relaxed" placeholder="Опишите, что именно измеряет этот показатель..." />
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Владелец (Ответственное подразделение)</label>
                             <select value={editingStatDef.owner_id || ''} onChange={e => setEditingStatDef({...editingStatDef, owner_id: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm shadow-sm font-semibold">
                                 <option value="">Выберите подразделение...</option>
                                 {Object.values(ORGANIZATION_STRUCTURE).map(dept => (
                                     <React.Fragment key={dept.id}>
                                         <option value={dept.id} className="font-bold">⭐ {dept.name}</option>
                                         {dept.departments && Object.values(dept.departments).map(sub => (
                                             <option key={sub.id} value={sub.id}>&nbsp;&nbsp;&nbsp;↳ {sub.name}</option>
                                         ))}
                                     </React.Fragment>
                                 ))}
                             </select>
                         </div>
                         <div className="flex flex-col gap-2.5 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                             <label className="flex items-center gap-3 cursor-pointer group"><input type="checkbox" checked={editingStatDef.is_favorite || false} onChange={e => setEditingStatDef({...editingStatDef, is_favorite: e.target.checked})} className="w-4 h-4 rounded text-blue-600 border-slate-300" /><span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">ГСД (Отображать на Дашборде)</span></label>
                             <label className="flex items-center gap-3 cursor-pointer group"><input type="checkbox" checked={editingStatDef.inverted || false} onChange={e => setEditingStatDef({...editingStatDef, inverted: e.target.checked})} className="w-4 h-4 rounded text-purple-600 border-slate-300" /><span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Обратная (Меньше = Лучше)</span></label>
                             <label className="flex items-center gap-3 cursor-pointer group"><input type="checkbox" checked={editingStatDef.is_double || false} onChange={e => setEditingStatDef({...editingStatDef, is_double: e.target.checked})} className="w-4 h-4 rounded text-indigo-600 border-slate-300" /><span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Двойная статистика (Два графика)</span></label>
                         </div>
                     </div>
                     <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                         <button onClick={() => setEditingStatDef(null)} className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-200 transition-colors">Отмена</button>
                         <button onClick={handleSaveDefinition} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg cursor-pointer hover:bg-blue-700 transition-all uppercase text-xs tracking-widest">Сохранить</button>
                     </div>
                 </div>
             </div>
          )}

          {/* VALUES EDITOR MODAL (DATA INPUT) */}
          {isValueModalOpen && selectedStatForValues && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-2 sm:p-4">
                  <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[95vh]">
                      <div className="p-3 md:p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
                          <div className="min-w-0 pr-4">
                              <div className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Редактор статистики</div>
                              <h3 className="font-bold text-xs sm:text-base text-slate-800 leading-tight truncate max-w-[250px]">{selectedStatForValues.title}</h3>
                          </div>
                          <button onClick={() => setIsValueModalOpen(false)} className="p-1.5 bg-slate-200/50 rounded-full flex-shrink-0 cursor-pointer text-slate-500 hover:bg-slate-200"><X size={18} /></button>
                      </div>

                      {/* QUICK DESCRIPTION SECTION */}
                      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-2 flex-shrink-0 group">
                           <div className="flex justify-between items-center">
                               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Info size={10}/> Справка / Методика</h4>
                               <button onClick={() => setEditingStatDef(selectedStatForValues)} className="text-[9px] font-bold text-blue-600 hover:underline cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">Изменить</button>
                           </div>
                           <p className="text-xs font-medium text-slate-600 italic leading-relaxed">{selectedStatForValues.description || 'Описание не указано. Добавьте его в настройках статистики.'}</p>
                      </div>

                      <div className="p-3 md:p-4 bg-blue-50 border-b border-blue-100 flex flex-col gap-3 flex-shrink-0 shadow-inner">
                          <div className="flex flex-col sm:flex-row gap-2">
                              <div className="flex-1">
                                  <label className="block text-[9px] font-black text-blue-400 uppercase mb-1 ml-1">Дата</label>
                                  <input type="date" value={editingValue?.date || ''} onChange={e => setEditingValue({...editingValue, date: e.target.value})} className="w-full h-10 border border-blue-200 bg-white rounded-lg px-2 text-[11px] md:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400 shadow-sm text-center sm:text-left" />
                              </div>
                              <div className="flex-1">
                                  <label className="block text-[9px] font-black text-blue-400 uppercase mb-1 ml-1">Значение 1</label>
                                  <input type="number" value={editingValue?.value || ''} onChange={e => setEditingValue({...editingValue, value: parseFloat(e.target.value)})} className="w-full h-10 border border-blue-200 bg-white rounded-lg px-2 text-[11px] md:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400 shadow-sm" placeholder="0" />
                              </div>
                              {selectedStatForValues.is_double && (
                                  <div className="flex-1">
                                      <label className="block text-[9px] font-black text-blue-400 uppercase mb-1 ml-1">Значение 2</label>
                                      <input type="number" value={editingValue?.value2 || ''} onChange={e => setEditingValue({...editingValue, value2: parseFloat(e.target.value)})} className="w-full h-10 border border-blue-200 bg-white rounded-lg px-2 text-[11px] md:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400 shadow-sm" placeholder="0" />
                                  </div>
                              )}
                          </div>
                          <div className="flex justify-end gap-2">
                              {editingValue?.id && (
                                  <button onClick={() => setEditingValue({ definition_id: selectedStatForValues.id, date: new Date().toISOString().split('T')[0], value: 0, value2: 0 })} className="px-3 py-1.5 text-slate-500 font-bold hover:bg-slate-200 rounded-lg text-[10px] transition-colors cursor-pointer">Отмена</button>
                              )}
                              <button onClick={handleSaveValue} className="h-10 px-6 bg-blue-600 text-white text-[10px] md:text-xs font-black rounded-lg shadow-lg shadow-blue-200 flex items-center justify-center gap-1.5 hover:bg-blue-700 transition-all flex-1 sm:flex-none cursor-pointer"><Plus size={14}/> {editingValue?.id ? 'Обновить' : 'Добавить'}</button>
                          </div>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-white">
                          {currentStatValues.length === 0 ? (
                              <div className="p-8 text-center text-slate-300 flex flex-col items-center gap-2"><Calendar size={32} className="opacity-20"/><p className="text-[11px] font-medium">История пуста</p></div>
                          ) : (
                              <table className="w-full text-[11px] md:text-sm">
                                  <thead className="bg-slate-50 text-slate-400 font-black text-[9px] uppercase sticky top-0 z-10 shadow-sm">
                                      <tr>
                                          <th className="px-3 md:px-4 py-2 text-left">Дата</th>
                                          <th className="px-3 md:px-4 py-2 text-right">Значение</th>
                                          {selectedStatForValues.is_double && <th className="px-3 md:px-4 py-2 text-right">Вал 2</th>}
                                          <th className="px-3 md:px-4 py-2 text-right">Действия</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {currentStatValues.map(val => (
                                          <tr key={val.id} className="hover:bg-blue-50/30 transition-colors group">
                                              <td className="px-3 md:px-4 py-2 text-slate-600 font-bold">{format(new Date(val.date), 'dd.MM.yyyy')}</td>
                                              <td className="px-3 md:px-4 py-2 text-right font-black text-slate-800">{val.value.toLocaleString()}</td>
                                              {selectedStatForValues.is_double && <td className="px-3 md:px-4 py-2 text-right font-black text-slate-400">{(val.value2 || 0).toLocaleString()}</td>}
                                              <td className="px-3 md:px-4 py-2 text-right">
                                                  <div className="flex justify-end gap-1">
                                                      <button onClick={() => setEditingValue(val)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"><Edit2 size={12}/></button>
                                                      <button onClick={() => handleDeleteValue(val.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"><Trash2 size={12}/></button>
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

          {/* GLOBAL CONFIRMATION MODAL */}
          <ConfirmationModal 
              isOpen={confirmModal.isOpen}
              title={confirmModal.title}
              message={confirmModal.message}
              onConfirm={executeDeleteStat}
              onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
              isDanger={true}
              confirmLabel="Удалить навсегда"
          />
      </div>
  );
};

export default StatisticsTab;
