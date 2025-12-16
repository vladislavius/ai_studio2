
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

// --- STRICT TREND ANALYSIS LOGIC (PERIOD BASED) ---
const analyzeTrend = (vals: StatisticValue[], inverted: boolean = false) => {
    if (!vals || vals.length === 0) {
        return { current: 0, prev: 0, delta: 0, percent: 0, direction: 'flat' as const, isGood: true };
    }

    const sorted = [...vals].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const n = sorted.length;

    // Compare Last Value vs First Value of Selected Period
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

    let isGood = true;
    if (inverted) {
        isGood = delta <= 0;
    } else {
        isGood = delta >= 0;
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
  const [showFullDesc, setShowFullDesc] = useState(true); 

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

  // Reset description toggle when opening new stat
  useEffect(() => {
      setShowFullDesc(true);
  }, [expandedStatId]);

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

  // --- EXPORT & IMPORT ---
  const handleExportStats = () => {
      // 1. Prepare Header
      const csvRows = [
          [
              'ID Статистики (Не менять)', 
              'Департамент', 
              'Название Статистики', 
              'Период', 
              'Посл. Дата',
              'Текущее Значение', 
              'Динамика', 
              'Изменение %', 
              'Тренд',
              '[ВВОД] Дата (ГГГГ-ММ-ДД)',
              '[ВВОД] Значение'
          ].join(',')
      ];

      // 2. Iterate and Calculate
      definitions.forEach(stat => {
          const vals = getFilteredValues(stat.id);
          const { current, percent, direction, isGood } = analyzeTrend(vals, stat.inverted);
          const deptName = getOwnerName(stat.owner_id || '').replace(/,/g, ''); // Remove commas for CSV safety
          const title = stat.title.replace(/,/g, ' ');
          
          let trendSymbol = '→';
          if (direction === 'up') trendSymbol = '↑';
          if (direction === 'down') trendSymbol = '↓';
          
          let trendText = 'Стабильно';
          if (direction === 'up') trendText = stat.inverted ? 'Ухудшение (Рост)' : 'Рост';
          if (direction === 'down') trendText = stat.inverted ? 'Улучшение (Падение)' : 'Падение';

          const periodLabel = PERIODS.find(p => p.id === selectedPeriod)?.label || selectedPeriod;
          const lastDate = vals.length > 0 ? format(new Date(vals[vals.length-1].date), 'dd.MM.yyyy') : '-';

          const row = [
              stat.id,
              `"${deptName}"`,
              `"${title}"`,
              periodLabel,
              lastDate,
              current,
              trendText,
              `${percent.toFixed(1)}%`,
              trendSymbol,
              '', // Empty for user input date
              ''  // Empty for user input value
          ].join(',');

          csvRows.push(row);
      });

      // 3. Download
      const csvContent = "\ufeff" + csvRows.join('\n'); // Add BOM for Excel Cyrillic support
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statistics_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
  };

  const handleImportStats = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !supabase) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const content = e.target?.result as string;
              const lines = content.split('\n');
              const newValues: any[] = [];
              let importCount = 0;

              // Skip header (index 0)
              for (let i = 1; i < lines.length; i++) {
                  const line = lines[i].trim();
                  if (!line) continue;
                  
                  // Simple CSV split (assuming no complex escaped commas in values based on our export)
                  // Columns: 0:ID, ..., 9:InputDate, 10:InputValue
                  // NOTE: Quotes might wrap some fields, rudimentary parsing:
                  const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                  
                  const statId = cols[0]?.replace(/"/g, '').trim();
                  const inputDate = cols[9]?.trim();
                  const inputValue = cols[10]?.trim();

                  if (statId && inputDate && inputValue && inputValue !== '') {
                      newValues.push({
                          definition_id: statId,
                          date: inputDate,
                          value: parseFloat(inputValue),
                          value2: 0
                      });
                      importCount++;
                  }
              }

              if (newValues.length > 0) {
                  if(confirm(`Найдено ${importCount} новых значений для импорта. Загрузить в базу?`)) {
                      const { error } = await supabase.from('statistics_values').insert(newValues);
                      if (error) throw error;
                      alert('Данные успешно импортированы!');
                      await fetchAllValues();
                  }
              } else {
                  alert('Не найдено данных для импорта. Заполните последние две колонки в CSV файле: Дата и Значение.');
              }

          } catch (err: any) {
              alert('Ошибка импорта: ' + err.message);
          }
          if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsText(file);
  };

  // --- ADMIN ACTIONS ---
  const handleSaveDefinition = async () => {
    if (!editingStatDef) return;
    if (!editingStatDef.title || !editingStatDef.owner_id) {
        alert("Название и Владелец обязательны");
        return;
    }

    const payload = {
        title: editingStatDef.title,
        description: editingStatDef.description || '',
        type: editingStatDef.type || 'department',
        owner_id: editingStatDef.owner_id,
        inverted: editingStatDef.inverted || false,
        is_favorite: editingStatDef.is_favorite || false,
        is_double: editingStatDef.is_double || false,
        calculation_method: editingStatDef.calculation_method || '',
    };

    try {
        if (isOffline || !supabase) {
             const newDef = { ...payload, id: editingStatDef.id || `local-def-${Date.now()}` } as StatisticDefinition;
             setDefinitions(prev => editingStatDef.id ? prev.map(d => d.id === editingStatDef.id ? newDef : d) : [...prev, newDef]);
        } else {
            if (editingStatDef.id) {
                const { error } = await supabase.from('statistics_definitions').update(payload).eq('id', editingStatDef.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('statistics_definitions').insert([payload]);
                if (error) throw error;
            }
            await fetchDefinitions();
        }
        setEditingStatDef(null);
    } catch (err: any) {
        alert('Ошибка сохранения: ' + err.message);
    }
  };

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
          if (editingValue.id) { await supabase.from('statistics_values').update(payload).eq('id', editingValue.id); } else { await supabase.from('statistics_values').insert([payload]); }
          const { data } = await supabase.from('statistics_values').select('*').eq('definition_id', selectedStatForValues.id).order('date', {ascending: false});
          setCurrentStatValues(data || []);
          fetchAllValues(); 
      }
      setEditingValue({ definition_id: selectedStatForValues.id, date: new Date().toISOString().split('T')[0], value: 0, value2: 0 });
  };

  const handleDeleteValue = async (id: string) => {
      if(!confirm("Удалить это значение?")) return;
      if(isOffline || !supabase) {
          setCurrentStatValues(prev => prev.filter(v => v.id !== id));
          // Mock update global state for offline
          return;
      }
      
      const { error } = await supabase.from('statistics_values').delete().eq('id', id);
      if(!error) {
          setCurrentStatValues(prev => prev.filter(v => v.id !== id));
          fetchAllValues();
      } else {
          alert("Ошибка удаления: " + error.message);
      }
  };

  // --- RENDER CARD ---
  const renderStatCard = (stat: StatisticDefinition, deptColor: string, contextKey: string) => {
      const vals = getFilteredValues(stat.id);
      const { current, percent, direction, isGood } = analyzeTrend(vals, stat.inverted);
      
      const trendColorHex = isGood ? "#10b981" : "#f43f5e"; 

      return (
          <div 
            key={`${contextKey}-${stat.id}`} 
            onClick={() => !isEditMode && setExpandedStatId(stat.id)}
            className={`relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[200px] md:h-[260px] transition-all group ${isEditMode ? 'ring-2 ring-blue-400 ring-offset-2 hover:-translate-y-0' : 'cursor-pointer hover:-translate-y-1 hover:shadow-md'}`}
          >
              <div className="absolute top-0 left-0 bottom-0 w-1" style={{backgroundColor: deptColor}}></div>
              <div className="absolute top-0 left-1 right-0 h-32 pointer-events-none" style={{ background: `linear-gradient(to bottom, ${deptColor}15, #ffffff00)` }}></div>

              {isEditMode && isAdmin && (
                  <div className="absolute top-2 right-2 flex gap-1 z-30 bg-white/90 p-1 rounded-lg border border-slate-100 shadow-sm backdrop-blur-sm animate-in fade-in">
                      <button onClick={(e) => { e.stopPropagation(); setEditingStatDef(stat); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"><Edit2 size={14}/></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteStat(stat.id); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"><Trash2 size={14}/></button>
                  </div>
              )}

              <div className="p-2.5 md:p-3 md:pl-4 flex flex-col h-full relative z-10">
                  <div className="flex justify-between items-start mb-1 md:mb-2">
                      <div className="flex-1 pr-6">
                           <div className="flex items-center gap-1.5">
                                <h3 className="text-[10px] md:text-xs font-bold text-slate-800 leading-snug line-clamp-2" title={stat.title}>{stat.title}</h3>
                                {stat.inverted && (
                                    <span className="text-[7px] md:text-[8px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-0.5 flex-shrink-0">
                                        <ArrowDownUp size={8}/> <span className="hidden md:inline">ОБР</span>
                                    </span>
                                )}
                           </div>
                           <div className="text-[8px] md:text-[9px] text-slate-400 font-medium truncate mt-0.5 line-clamp-1" title={stat.description}>{stat.description || getOwnerName(stat.owner_id || '')}</div>
                      </div>
                      {!isEditMode && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3 text-slate-300">
                               <Maximize2 size={14} />
                          </div>
                      )}
                  </div>
                  
                  {/* MAIN VALUE & TREND */}
                  <div className="flex items-baseline gap-2 mb-1 md:mb-2">
                      <span className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">{current.toLocaleString()}</span>
                      {vals.length > 1 && (
                          <div className={`flex items-center text-[9px] md:text-[10px] font-bold px-1 py-0.5 md:px-1.5 rounded ${isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {direction === 'up' && <TrendingUp size={10} className="mr-1 md:w-3 md:h-3"/>}
                              {direction === 'down' && <TrendingDown size={10} className="mr-1 md:w-3 md:h-3"/>}
                              {direction === 'flat' && <Minus size={10} className="mr-1 md:w-3 md:h-3"/>}
                              {Math.abs(percent).toFixed(0)}%
                          </div>
                      )}
                  </div>
                  
                  <div className={`flex-1 w-full min-h-0 relative`}>
                       <StatsChart key={selectedPeriod} values={vals} color={trendColorHex} inverted={stat.inverted} isDouble={stat.is_double} />
                  </div>
                  <div className="absolute bottom-2 right-2 flex gap-1 pointer-events-none opacity-50">
                       {stat.is_favorite && <span className="text-[7px] md:text-[8px] bg-amber-100 text-amber-700 px-1 rounded font-bold">ГСД</span>}
                       {stat.is_double && <span className="text-[7px] md:text-[8px] bg-indigo-100 text-indigo-700 px-1 rounded font-bold">2X</span>}
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
              
              const isSpecificView = selectedDeptId === deptId;
              const mainStats = definitions.filter(d => d.owner_id === deptId);
              
              if (!isSpecificView) {
                  // DASHBOARD MODE: Only Main Stats
                  if (mainStats.length === 0 && !isEditMode) return null;
                  
                  return (
                      <div key={deptId} className="space-y-3">
                           <div className="bg-white px-2 py-1.5 md:px-3 md:py-2 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between border-l-4" style={{borderLeftColor: dept.color}}>
                               <h2 className="text-xs md:text-sm font-bold flex items-center gap-2 text-slate-700">{dept.name}</h2>
                               <span className="text-slate-400 text-[10px] md:text-xs font-medium">{dept.manager}</span>
                           </div>
                           <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                               {mainStats.map(stat => renderStatCard(stat, dept.color, 'overview'))}
                               {isEditMode && isAdmin && (
                                   <div onClick={() => openNewStatModal(deptId)} className="border-2 border-dashed border-slate-300 rounded-xl h-[200px] md:h-[260px] flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                                       <Plus size={32} />
                                       <span className="text-xs font-bold mt-2">Добавить статистику</span>
                                   </div>
                               )}
                           </div>
                      </div>
                  );
              } else {
                  // SPECIFIC DEPARTMENT MODE: Show Main Stats + Sub-Department Sections
                  const subDeptIds = dept.departments ? Object.keys(dept.departments) : [];
                  const subDeptStatsCount = definitions.filter(d => d.owner_id && subDeptIds.includes(d.owner_id)).length;

                  return (
                      <div key={deptId} className="space-y-6">
                           <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between border-l-4" style={{borderLeftColor: dept.color}}>
                               <div>
                                  <h2 className="text-sm md:text-lg font-bold text-slate-800">{dept.name}</h2>
                                  <p className="text-[10px] md:text-xs text-slate-500">{dept.manager}</p>
                               </div>
                               <span className="text-[10px] md:text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                                   {mainStats.length + subDeptStatsCount} статистик
                               </span>
                           </div>

                           {/* Main Dept Stats */}
                           <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                               {mainStats.map(stat => renderStatCard(stat, dept.color, `main-${deptId}`))}
                               {isEditMode && isAdmin && (
                                   <div onClick={() => openNewStatModal(deptId)} className="border-2 border-dashed border-slate-300 rounded-xl h-[200px] md:h-[260px] flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                                       <Plus size={32} />
                                       <span className="text-xs font-bold mt-2">Добавить статистику</span>
                                   </div>
                               )}
                           </div>

                           {/* Sub-Departments Stats */}
                           {dept.departments && Object.values(dept.departments).map(sub => {
                               const specificSubStats = definitions.filter(d => d.owner_id === sub.id);
                               if(specificSubStats.length === 0 && !isEditMode) return null;
                               
                               return (
                                   <div key={sub.id} className="mt-6 md:mt-8 pt-4 border-t border-slate-100">
                                       <h3 className="text-xs md:text-sm font-bold text-slate-600 mb-3 md:mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{backgroundColor: dept.color}}></div> {sub.name}</h3>
                                       <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                                           {specificSubStats.map(stat => renderStatCard(stat, dept.color, `sub-${sub.id}`))}
                                           {isEditMode && isAdmin && (
                                               <div onClick={() => openNewStatModal(sub.id)} className="border-2 border-dashed border-slate-300 rounded-xl h-[200px] md:h-[260px] flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
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

  const renderListView = () => {
      // Flatten and sort definitions based on hierarchy
      const sortedDefs = [...definitions].sort((a, b) => {
          // Sort logic matches DEPT_ORDER roughly
          const getDeptIndex = (id?: string) => {
              if (!id) return 999;
              // Check if it's a main dept
              const mainIdx = DEPT_ORDER.indexOf(id);
              if (mainIdx !== -1) return mainIdx * 100;
              // Check if it's a sub dept
              for (let i = 0; i < DEPT_ORDER.length; i++) {
                  const dId = DEPT_ORDER[i];
                  const dept = ORGANIZATION_STRUCTURE[dId];
                  if (dept.departments && dept.departments[id]) {
                      return i * 100 + Object.keys(dept.departments).indexOf(id) + 1;
                  }
              }
              return 999;
          };
          return getDeptIndex(a.owner_id) - getDeptIndex(b.owner_id);
      });

      return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
              <table className="w-full text-sm text-left">
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
                          <tr key={stat.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                  <div className="font-bold text-slate-800">{stat.title}</div>
                                  <div className="text-xs text-slate-500 line-clamp-1">{stat.description}</div>
                                  <div className="flex gap-1 mt-1">
                                      {stat.is_favorite && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">ГСД</span>}
                                      {stat.inverted && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">Обратная</span>}
                                      {stat.is_double && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">Двойная</span>}
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-slate-600 font-medium">
                                  {getOwnerName(stat.owner_id || '')}
                              </td>
                              <td className="px-6 py-4">
                                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs font-bold mr-2">{stat.type}</span>
                                  <span className="text-xs text-slate-400">{stat.calculation_method || '-'}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                      <button onClick={() => setExpandedStatId(stat.id)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Открыть график">
                                          <TrendingUp size={16}/>
                                      </button>
                                      {isAdmin && (
                                          <>
                                              <button onClick={(e) => { e.stopPropagation(); handleOpenValues(stat); }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Ввод данных">
                                                  <Calendar size={16}/>
                                              </button>
                                              <button onClick={(e) => { e.stopPropagation(); setEditingStatDef(stat); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Изменить">
                                                  <Edit2 size={16}/>
                                              </button>
                                              <button onClick={(e) => { e.stopPropagation(); handleDeleteStat(stat.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Удалить">
                                                  <Trash2 size={16}/>
                                              </button>
                                          </>
                                      )}
                                  </div>
                              </td>
                          </tr>
                      ))}
                      {sortedDefs.length === 0 && (
                          <tr><td colSpan={4} className="p-8 text-center text-slate-400">Нет данных</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      );
  };

  return (
      <div className="flex flex-col h-full animate-in fade-in space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
             <div className="flex justify-between items-center">
                 <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                     <button onClick={() => setDisplayMode('dashboard')} className={`p-2 rounded-md transition-all ${displayMode === 'dashboard' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><LayoutDashboard size={18}/></button>
                     <button onClick={() => setDisplayMode('list')} className={`p-2 rounded-md transition-all ${displayMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><List size={18}/></button>
                 </div>
                 
                 {/* EXPORT / IMPORT ACTIONS */}
                 {isAdmin && (
                     <div className="flex items-center gap-2">
                         <button 
                            onClick={handleExportStats}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                            title="Скачать полный отчет по статистикам (CSV)"
                         >
                             <Download size={14} /> <span className="hidden sm:inline">Экспорт</span>
                         </button>
                         <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                            title="Загрузить данные из Excel/CSV"
                         >
                             <Upload size={14} /> <span className="hidden sm:inline">Импорт</span>
                         </button>
                         <input type="file" ref={fileInputRef} onChange={handleImportStats} accept=".csv" className="hidden" />
                     </div>
                 )}

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
                                        {/* EXPANDED DESCRIPTION & HELP BLOCK */}
                                        <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl mb-4 relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1"><Info size={12}/> Справка о статистике</h4>
                                                {isAdmin && (
                                                    <button onClick={() => setEditingStatDef(stat)} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center gap-1 font-bold">
                                                        <Edit2 size={10} /> Изменить
                                                    </button>
                                                )}
                                            </div>
                                            
                                            <div className={`text-sm font-medium text-blue-900 leading-relaxed whitespace-pre-wrap transition-all`}>
                                                {stat.description || 'Нет описания'}
                                                {stat.purpose && (
                                                    <div className="mt-2">
                                                        <span className="font-bold">Цель: </span> {stat.purpose}
                                                    </div>
                                                )}
                                            </div>
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
          
          {/* STAT DEFINITION EDITOR MODAL */}
          {editingStatDef && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                 <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                     <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                         <h3 className="font-bold text-slate-800">{editingStatDef.id ? 'Редактировать статистику' : 'Создать статистику'}</h3>
                         <button onClick={() => setEditingStatDef(null)} className="flex-shrink-0"><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                     </div>
                     <div className="p-6 space-y-4 overflow-y-auto">
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Название</label>
                             <input value={editingStatDef.title || ''} onChange={e => setEditingStatDef({...editingStatDef, title: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800" placeholder="Например: Валовый Доход" />
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Владелец (Департамент)</label>
                             <select value={editingStatDef.owner_id || ''} onChange={e => setEditingStatDef({...editingStatDef, owner_id: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm">
                                 <option value="">Выберите департамент...</option>
                                 {Object.values(ORGANIZATION_STRUCTURE).map(dept => (
                                     <React.Fragment key={dept.id}>
                                         <option value={dept.id} className="font-bold">{dept.fullName}</option>
                                         {dept.departments && Object.values(dept.departments).map(sub => (
                                             <option key={sub.id} value={sub.id}>&nbsp;&nbsp;&nbsp;↳ {sub.name}</option>
                                         ))}
                                     </React.Fragment>
                                 ))}
                             </select>
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Описание / Цель</label>
                             <textarea value={editingStatDef.description || ''} onChange={e => setEditingStatDef({...editingStatDef, description: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[80px]" placeholder="Что измеряет эта статистика?" />
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Тип</label>
                                  <select value={editingStatDef.type || 'department'} onChange={e => setEditingStatDef({...editingStatDef, type: e.target.value as any})} className="w-full p-2 border border-slate-200 rounded-lg text-sm">
                                      <option value="department">Департамент</option>
                                      <option value="company">Компания</option>
                                  </select>
                              </div>
                              <div>
                                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Метод расчета</label>
                                   <input value={editingStatDef.calculation_method || ''} onChange={e => setEditingStatDef({...editingStatDef, calculation_method: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm" placeholder="THB, Шт, %..." />
                              </div>
                         </div>
                         <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                             <label className="flex items-center gap-2 cursor-pointer">
                                 <input type="checkbox" checked={editingStatDef.is_favorite || false} onChange={e => setEditingStatDef({...editingStatDef, is_favorite: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                                 <span className="text-sm text-slate-700">Главная статистика (ГСД)</span>
                             </label>
                             <label className="flex items-center gap-2 cursor-pointer">
                                 <input type="checkbox" checked={editingStatDef.inverted || false} onChange={e => setEditingStatDef({...editingStatDef, inverted: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                                 <span className="text-sm text-slate-700">Обратная (Меньше = Лучше)</span>
                             </label>
                             <label className="flex items-center gap-2 cursor-pointer">
                                 <input type="checkbox" checked={editingStatDef.is_double || false} onChange={e => setEditingStatDef({...editingStatDef, is_double: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                                 <span className="text-sm text-slate-700">Двойной график (2 значения)</span>
                             </label>
                         </div>
                     </div>
                     <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
                         <button onClick={() => setEditingStatDef(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Отмена</button>
                         <button onClick={handleSaveDefinition} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200">Сохранить</button>
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
                                        <tr key={val.id} className="hover:bg-slate-50"><td className="px-3 py-2 text-slate-600">{format(new Date(val.date), 'dd.MM.yy')}</td><td className="px-3 py-2 text-right font-bold text-slate-800">{val.value.toLocaleString()} {selectedStatForValues.is_double && <span className="text-slate-400 ml-1">/ {val.value2?.toLocaleString()}</span>}</td><td className="px-3 py-2 text-right"><div className="flex justify-end gap-1"><button onClick={() => setEditingValue(val)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={16}/></button><button onClick={() => handleDeleteValue(val.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button></div></td></tr>
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
