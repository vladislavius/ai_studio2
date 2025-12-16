
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { StatisticDefinition, StatisticValue, WiseCondition, Employee } from '../types';
import { ORGANIZATION_STRUCTURE, HANDBOOK_STATISTICS } from '../constants';
import StatsChart from './StatsChart';
import { TrendingUp, TrendingDown, LayoutDashboard, Info, HelpCircle, Building2, Layers, Calendar, Edit2, X, List, Search, Plus, Trash2, Sliders, Save, AlertCircle, ArrowDownUp, Download, Upload, Maximize2 } from 'lucide-react';
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
        // Mocking value2 for double stats
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
    { id: '1m', label: 'Месяц' },
    { id: '3m', label: '3 Мес.' },
    { id: '6m', label: 'Полгода' },
    { id: '1y', label: 'Год' },
    { id: 'all', label: 'Все' },
];

// STRICT LINEAR REGRESSION TREND ANALYSIS
const analyzeTrend = (vals: StatisticValue[], inverted: boolean = false) => {
    if (!vals || vals.length < 2) return { condition: 'non_existence' as WiseCondition, change: 0, current: 0, prev: 0, diff: 0, slope: 0 };
    
    // Sort by date ascending
    const sorted = [...vals].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const currentVal = sorted[sorted.length - 1].value;
    const prevVal = sorted.length > 1 ? sorted[sorted.length - 2].value : 0;
    
    // Calculate Linear Regression Slope
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    const n = sorted.length;

    sorted.forEach((v, i) => {
        sumX += i;
        sumY += v.value;
        sumXY += i * v.value;
        sumXX += i * i;
    });

    // Slope (m)
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Determines change percentage for display (last vs first in period or simple current vs prev)
    // Let's use current vs start of period for % text
    const startVal = sorted[0].value;
    let change = 0;
    if (startVal !== 0) change = (currentVal - startVal) / Math.abs(startVal);
    else if (currentVal > 0) change = 1;

    let diff = currentVal - prevVal;

    // Condition logic can remain, but color is now strict
    return { condition: 'normal' as WiseCondition, change, current: currentVal, prev: prevVal, diff, slope };
};

const StatisticsTab: React.FC<StatisticsTabProps> = ({ employees, isOffline, selectedDeptId, isAdmin }) => {
  const [definitions, setDefinitions] = useState<StatisticDefinition[]>([]);
  const [allLatestValues, setAllLatestValues] = useState<Record<string, StatisticValue[]>>({});
  const [selectedPeriod, setSelectedPeriod] = useState<string>('3m');
  const [infoCardId, setInfoCardId] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'dashboard' | 'list'>('dashboard');
  const [listSearchTerm, setListSearchTerm] = useState('');
  
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
  
  // Import Ref
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
          if (isOffline || !supabase) {
              if (editingStatDef.id) {
                  setDefinitions(prev => prev.map(d => d.id === editingStatDef.id ? { ...d, ...payload, id: editingStatDef.id! } : d));
              } else {
                  const newId = `local-stat-${Date.now()}`;
                  setDefinitions(prev => [...prev, { ...payload, id: newId } as StatisticDefinition]);
                  setAllLatestValues(prev => ({ ...prev, [newId]: [] }));
              }
          } 
          else {
              if (editingStatDef.id) {
                  const { error } = await supabase.from('statistics_definitions').update(payload).eq('id', editingStatDef.id);
                  if (error) throw error;
              } else {
                  const { error } = await supabase.from('statistics_definitions').insert([payload]);
                  if (error) throw error;
              }
              fetchDefinitions(); 
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
            const { error: valError } = await supabase.from('statistics_values').delete().eq('definition_id', id);
            if (valError) throw new Error("Ошибка удаления значений: " + valError.message);

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
      
      const sorted = [...vals].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const total = sorted.length;

      // Strict Point Slicing logic
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
      setEditingValue({ definition_id: stat.id, date: new Date().toISOString().split('T')[0], value: 0, value2: 0 });
      setIsValueModalOpen(true);
  };

  const handleSaveValue = async () => {
      if (!editingValue) return;
      if (!selectedStatForValues) return;
      
      const payload = { 
          definition_id: selectedStatForValues.id, 
          date: editingValue.date || new Date().toISOString().split('T')[0], 
          value: editingValue.value || 0,
          value2: editingValue.value2 || 0
      };

      if (isOffline || !supabase) {
           const newVal = { ...payload, id: editingValue.id || `local-val-${Date.now()}` } as StatisticValue;
           const updatedList = editingValue.id 
                ? currentStatValues.map(v => v.id === editingValue.id ? newVal : v)
                : [newVal, ...currentStatValues];
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

  // --- IMPORT / EXPORT LOGIC ---

  const handleDownloadStatsCSV = () => {
      // 1. Determine Visible Definitions based on filters
      let visibleDefinitions = definitions.filter(def => {
          if (!selectedDeptId) return true;
          const parentId = getParentDeptId(def.owner_id || 'other');
          return parentId === selectedDeptId;
      });

      // 2. SORT LOGIC
      visibleDefinitions.sort((a, b) => {
          const ownerA = a.owner_id || '';
          const ownerB = b.owner_id || '';
          const parentA = getParentDeptId(ownerA);
          const parentB = getParentDeptId(ownerB);

          // Compare Parent Departments first
          const indexA = DEPT_ORDER.indexOf(parentA);
          const indexB = DEPT_ORDER.indexOf(parentB);
          
          if (indexA !== indexB) {
              // Handle unassigned/new departments at the end
              if (indexA === -1) return 1;
              if (indexB === -1) return -1;
              return indexA - indexB;
          }

          // Same Parent Dept. Now check if one IS the parent
          if (ownerA === parentA && ownerB !== parentB) return -1;
          if (ownerB === parentB && ownerA !== parentA) return 1;

          // Both are sub-departments (or same level). Sort by Code/Name if possible
          // We can use the order of keys in departments object if we want strict schema order,
          // otherwise alphabetical title is a good fallback.
          return a.title.localeCompare(b.title);
      });

      // 3. Columns: Include ID and config for re-import capability
      const headers = [
          'ID', 'owner_id', 'Название', 'Владелец', 'Департамент', 
          'calculation_method', 'inverted', 'is_double', 'is_favorite',
          'Текущее Значение', 'Период', 'Изменение %', 'Тренд', 'Описание'
      ];
      
      const rows = visibleDefinitions.map(def => {
          const vals = getFilteredValues(def.id);
          const { current, change, slope } = analyzeTrend(vals, def.inverted);
          const percent = (change * 100).toFixed(1) + '%';
          const trendDir = slope > 0 ? 'Рост' : (slope < 0 ? 'Падение' : 'Стабильно');
          const ownerName = getOwnerName(def.owner_id || '');
          const deptName = ORGANIZATION_STRUCTURE[getParentDeptId(def.owner_id || 'other')]?.name || '-';
          const periodLabel = PERIODS.find(p => p.id === selectedPeriod)?.label || selectedPeriod;

          return [
              def.id,
              def.owner_id || '',
              `"${def.title.replace(/"/g, '""')}"`,
              `"${ownerName.replace(/"/g, '""')}"`,
              `"${deptName.replace(/"/g, '""')}"`,
              `"${(def.calculation_method || '').replace(/"/g, '""')}"`,
              def.inverted ? 'TRUE' : 'FALSE',
              def.is_double ? 'TRUE' : 'FALSE',
              def.is_favorite ? 'TRUE' : 'FALSE',
              current,
              periodLabel,
              percent,
              trendDir,
              `"${(def.description || '').replace(/"/g, '""')}"`
          ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stats_export_${selectedDeptId || 'all'}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleImportStatsCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const content = e.target?.result as string;
              // Split lines, handling potential \r\n
              const lines = content.split(/\r?\n/);
              
              // Simple parser - assumes CSV is valid from our export
              // Headers should be: ID, owner_id, Название, ...
              const headers = lines[0].split(',').map(h => h.trim());
              
              // Map indexes
              const idIdx = headers.indexOf('ID');
              const ownerIdIdx = headers.indexOf('owner_id');
              const titleIdx = headers.indexOf('Название');
              const calcIdx = headers.indexOf('calculation_method');
              const invIdx = headers.indexOf('inverted');
              const doubleIdx = headers.indexOf('is_double');
              const favIdx = headers.indexOf('is_favorite');
              const descIdx = headers.indexOf('Описание');

              if (idIdx === -1 || titleIdx === -1 || ownerIdIdx === -1) {
                  alert('Неверный формат CSV. Обязательны колонки ID, owner_id, Название. Используйте Экспорт для получения шаблона.');
                  return;
              }

              let updatedCount = 0;
              let createdCount = 0;
              const updates = [];
              const inserts = [];

              for (let i = 1; i < lines.length; i++) {
                  // Regex to split by comma but ignore commas inside quotes
                  const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                  if (!row) continue;
                  
                  // Clean quotes function
                  const clean = (val: string) => val ? val.replace(/^"|"$/g, '').replace(/""/g, '"') : '';
                  
                  // Better CSV Line Parser
                  const parseLine = (text: string) => {
                      const res = [];
                      let cur = '';
                      let inQ = false;
                      for (let char of text) {
                          if (char === '"') { inQ = !inQ; }
                          else if (char === ',' && !inQ) { res.push(cur); cur = ''; }
                          else { cur += char; }
                      }
                      res.push(cur);
                      return res;
                  };
                  
                  const cols = parseLine(lines[i]);
                  if (cols.length < 3) continue;

                  const statId = cols[idIdx]?.trim();
                  const ownerId = cols[ownerIdIdx]?.trim();
                  const title = clean(cols[titleIdx]?.trim());
                  
                  if (!title || !ownerId) continue;

                  const defPayload = {
                      title: title,
                      owner_id: ownerId,
                      calculation_method: clean(cols[calcIdx]?.trim() || ''),
                      description: clean(cols[descIdx]?.trim() || ''),
                      inverted: (cols[invIdx]?.trim().toUpperCase() === 'TRUE'),
                      is_double: (cols[doubleIdx]?.trim().toUpperCase() === 'TRUE'),
                      is_favorite: (cols[favIdx]?.trim().toUpperCase() === 'TRUE'),
                      type: 'department' // Default
                  };

                  // Check if ID exists and is valid (not created by export logic if new)
                  // If ID looks like a UUID or existing ID, update. If empty or new, insert.
                  const isExisting = definitions.find(d => d.id === statId);

                  if (isExisting) {
                      updates.push({ ...defPayload, id: statId });
                      updatedCount++;
                  } else {
                      inserts.push({ ...defPayload }); // Let DB generate ID or use provided if valid
                      createdCount++;
                  }
              }

              if (updates.length > 0 && supabase) {
                  for (const up of updates) {
                      await supabase.from('statistics_definitions').update(up).eq('id', up.id);
                  }
              }
              if (inserts.length > 0 && supabase) {
                  await supabase.from('statistics_definitions').insert(inserts);
              }
              
              if (isOffline) {
                   alert("В оффлайн режиме импорт симулирован. Обновите страницу.");
              } else {
                   alert(`Импорт завершен.\nОбновлено: ${updatedCount}\nСоздано: ${createdCount}`);
                   fetchDefinitions();
              }

          } catch (err: any) {
              console.error(err);
              alert('Ошибка при чтении файла: ' + err.message);
          }
          if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsText(file);
  };

  // --- RENDER CARD (UPDATED COMPACT DESIGN) ---
  const renderStatCard = (stat: StatisticDefinition, deptColor: string) => {
      const vals = getFilteredValues(stat.id);
      const { current, change, slope } = analyzeTrend(vals, stat.inverted);
      
      const isSlopeUp = slope > 0;
      let isGoodOutcome = isSlopeUp;
      if (stat.inverted) isGoodOutcome = !isSlopeUp;

      const trendColorHex = isGoodOutcome ? "#10b981" : "#f43f5e";
      const isInfoOpen = infoCardId === stat.id;

      return (
          <div 
            key={stat.id} 
            onClick={() => !isEditMode && setExpandedStatId(stat.id)}
            className={`relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[260px] transition-all group ${isEditMode ? 'ring-2 ring-blue-400 ring-offset-2 hover:-translate-y-0' : 'cursor-pointer hover:-translate-y-1 hover:shadow-md'}`}
          >
              <div className="absolute top-0 left-0 bottom-0 w-1" style={{backgroundColor: deptColor}}></div>
              
              <div 
                  className="absolute top-0 left-1 right-0 h-32 pointer-events-none" 
                  style={{ background: `linear-gradient(to bottom, ${deptColor}15, #ffffff00)` }} 
              ></div>

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
                           <div className="text-[9px] text-slate-400 font-medium truncate mt-0.5">{getOwnerName(stat.owner_id || '')}</div>
                      </div>
                      {!isEditMode && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3 text-slate-300">
                               <Maximize2 size={14} />
                          </div>
                      )}
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-2xl font-black text-slate-800 tracking-tight">{current.toLocaleString()}</span>
                      {vals.length > 1 && (
                          <div className={`flex items-center text-[10px] font-bold ${isGoodOutcome ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {slope >= 0 ? <TrendingUp size={10} className="mr-0.5"/> : <TrendingDown size={10} className="mr-0.5"/>} 
                              {Math.abs(change * 100).toFixed(0)}%
                          </div>
                      )}
                  </div>
                  <div className={`flex-1 w-full min-h-0 relative`}>
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
              const deptStats = definitions.filter(d => d.owner_id === deptId);
              let subDeptStats: StatisticDefinition[] = [];
              if (dept.departments) {
                  Object.values(dept.departments).forEach(sub => { subDeptStats.push(...definitions.filter(d => d.owner_id === sub.id)); });
              }
              const isSpecificView = selectedDeptId === deptId;

              if (!isSpecificView) {
                  const allDeptStats = deptStats; 
                  if (allDeptStats.length === 0 && !isEditMode) return null;
                  return (
                      <div key={deptId} className="space-y-3">
                           <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between border-l-4" style={{borderLeftColor: dept.color}}>
                               <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700">{dept.name}</h2>
                               <span className="text-slate-400 text-xs font-medium">{dept.manager}</span>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                               {allDeptStats.map(stat => renderStatCard(stat, dept.color))}
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
                                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                       {deptStats.map(stat => renderStatCard(stat, dept.color))}
                                       {isEditMode && isAdmin && (
                                           <div onClick={() => openNewStatModal(deptId)} className="border-2 border-dashed border-slate-300 rounded-xl h-[260px] flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
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
                                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                           {subStats.map(stat => renderStatCard(stat, dept.color))}
                                           {isEditMode && isAdmin && (
                                               <div onClick={() => openNewStatModal(sub.id)} className="border-2 border-dashed border-slate-300 rounded-xl h-[260px] flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
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
      // (Simplified list view logic for brevity, follows same pattern)
      const filtered = definitions.filter(d => d.title.toLowerCase().includes(listSearchTerm.toLowerCase()));
      const grouped: Record<string, StatisticDefinition[]> = {};
      filtered.forEach(def => {
          const parentDeptId = getParentDeptId(def.owner_id || 'other');
          if (!grouped[parentDeptId]) grouped[parentDeptId] = [];
          grouped[parentDeptId].push(def);
      });
      const sortedKeys = Object.keys(grouped).sort((a, b) => DEPT_ORDER.indexOf(a) - DEPT_ORDER.indexOf(b));

      return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full animate-in fade-in">
              {/* Controls */}
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 rounded-t-2xl gap-3">
                  <div className="relative w-full md:w-auto">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                      <input className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl w-full md:w-64 text-sm focus:ring-2 focus:ring-blue-100 outline-none" placeholder="Найти статистику..." value={listSearchTerm} onChange={e => setListSearchTerm(e.target.value)} />
                  </div>
              </div>
              {/* Table */}
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
                                  <tbody className="divide-y divide-slate-100">
                                      {grouped[deptId].map(stat => {
                                          const vals = getFilteredValues(stat.id);
                                          const { current, change, slope } = analyzeTrend(vals, stat.inverted);
                                          const isGood = stat.inverted ? slope <= 0 : slope >= 0;
                                          const trendColor = isGood ? 'text-emerald-600' : 'text-rose-600';
                                          
                                          return (
                                              <tr key={stat.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => !isEditMode && setExpandedStatId(stat.id)}>
                                                  <td className="px-6 py-4 font-bold text-slate-700">{stat.title}</td>
                                                  <td className="px-6 py-4 text-right">
                                                      <div className="font-black text-slate-800">{current.toLocaleString()}</div>
                                                  </td>
                                                  <td className={`px-6 py-4 text-right font-bold text-xs ${trendColor}`}>
                                                      {vals.length > 1 ? (slope > 0 ? '↗' : '↘') + ' ' + Math.abs(change*100).toFixed(1) + '%' : '-'}
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
      <div className="flex flex-col h-full animate-in fade-in space-y-4">
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                 <button onClick={() => setDisplayMode('dashboard')} className={`p-2 rounded-md transition-all ${displayMode === 'dashboard' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><LayoutDashboard size={20}/></button>
                 <button onClick={() => setDisplayMode('list')} className={`p-2 rounded-md transition-all ${displayMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><List size={20}/></button>
             </div>
             
             <div className="flex items-center gap-2">
                 <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-2">
                      {PERIODS.map(p => (
                          <button key={p.id} onClick={() => setSelectedPeriod(p.id)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${selectedPeriod === p.id ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>{p.label}</button>
                      ))}
                 </div>
                 
                 {isAdmin && (
                    <>
                        <button onClick={() => setIsEditMode(!isEditMode)} className={`p-2 rounded-lg border transition-all ${isEditMode ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} title="Режим редактирования">
                            <Edit2 size={20}/>
                        </button>
                        <button onClick={handleDownloadStatsCSV} className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50" title="Экспорт CSV"><Download size={20}/></button>
                        <button onClick={handleImportClick} className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50" title="Импорт CSV"><Upload size={20}/></button>
                        <input type="file" ref={fileInputRef} onChange={handleImportStatsCSV} accept=".csv" className="hidden" />
                    </>
                 )}
             </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
              {displayMode === 'dashboard' ? renderDashboardView() : renderListView()}
          </div>

          {/* Expanded Modal */}
          {expandedStatId && (
               <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setExpandedStatId(null)}>
                   <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                       <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                           <h3 className="font-bold text-lg text-slate-800">{definitions.find(d => d.id === expandedStatId)?.title}</h3>
                           <button onClick={() => setExpandedStatId(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                       </div>
                       <div className="flex-1 p-6 bg-slate-50 overflow-y-auto">
                            {(() => {
                                const stat = definitions.find(d => d.id === expandedStatId);
                                if (!stat) return null;
                                const vals = getFilteredValues(stat.id);
                                const { current, change, slope } = analyzeTrend(vals, stat.inverted);
                                return (
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex-1">
                                                <div className="text-sm text-slate-500 font-medium mb-1">Текущее значение</div>
                                                <div className="text-4xl font-black text-slate-900">{current.toLocaleString()}</div>
                                            </div>
                                            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex-1">
                                                <div className="text-sm text-slate-500 font-medium mb-1">Динамика ({selectedPeriod})</div>
                                                <div className={`text-2xl font-bold flex items-center gap-2 ${slope > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {slope > 0 ? <TrendingUp size={24}/> : <TrendingDown size={24}/>}
                                                    {Math.abs(change * 100).toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-96 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                                            <StatsChart values={vals} inverted={stat.inverted} isDouble={stat.is_double} />
                                        </div>
                                        {isAdmin && (
                                            <div className="flex justify-end">
                                                <button onClick={() => { setExpandedStatId(null); handleOpenValues(stat); }} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700">
                                                    Редактировать значения
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                       </div>
                   </div>
               </div>
          )}

          {/* Edit Definition Modal */}
          {editingStatDef && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">{editingStatDef.id ? 'Редактировать' : 'Новая Статистика'}</h3>
                            <button onClick={() => setEditingStatDef(null)}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                             <div>
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Название</label>
                                 <input value={editingStatDef.title || ''} onChange={e => setEditingStatDef({...editingStatDef, title: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="Название..."/>
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Владелец</label>
                                 <select value={editingStatDef.owner_id || ''} onChange={e => setEditingStatDef({...editingStatDef, owner_id: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none bg-white">
                                     <option value="">Выберите...</option>
                                     {Object.values(ORGANIZATION_STRUCTURE).map(d => (
                                         <React.Fragment key={d.id}>
                                             <option value={d.id}>{d.name}</option>
                                             {d.departments && Object.values(d.departments).map(s => <option key={s.id} value={s.id}>&nbsp;&nbsp;↳ {s.name}</option>)}
                                         </React.Fragment>
                                     ))}
                                 </select>
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Описание</label>
                                 <textarea value={editingStatDef.description || ''} onChange={e => setEditingStatDef({...editingStatDef, description: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none h-24" placeholder="Описание..."/>
                             </div>
                             <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                 <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer"><input type="checkbox" checked={editingStatDef.inverted || false} onChange={e => setEditingStatDef({...editingStatDef, inverted: e.target.checked})} className="rounded text-blue-600"/> Обратная (Меньше = Лучше)</label>
                                 <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer"><input type="checkbox" checked={editingStatDef.is_double || false} onChange={e => setEditingStatDef({...editingStatDef, is_double: e.target.checked})} className="rounded text-blue-600"/> Двойная</label>
                                 <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer"><input type="checkbox" checked={editingStatDef.is_favorite || false} onChange={e => setEditingStatDef({...editingStatDef, is_favorite: e.target.checked})} className="rounded text-blue-600"/> ГСД (Главная)</label>
                             </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                            <button onClick={() => setEditingStatDef(null)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">Отмена</button>
                            <button onClick={handleCreateOrUpdateStat} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors">Сохранить</button>
                        </div>
                    </div>
                </div>
          )}

          {/* Edit Values Modal */}
          {isValueModalOpen && selectedStatForValues && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-bold text-slate-800 leading-tight">{selectedStatForValues.title}</h3>
                                <p className="text-xs text-slate-500">Редактирование значений</p>
                            </div>
                            <button onClick={() => setIsValueModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        
                        {/* Editor Input */}
                        <div className="p-4 border-b border-slate-100 bg-blue-50/50">
                             <div className="flex gap-3">
                                 <div className="w-1/3">
                                     <label className="text-[10px] font-bold text-slate-400 uppercase">Дата</label>
                                     <input type="date" value={editingValue?.date || ''} onChange={e => setEditingValue({...editingValue, date: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium"/>
                                 </div>
                                 <div className="flex-1">
                                     <label className="text-[10px] font-bold text-slate-400 uppercase">Значение</label>
                                     <input type="number" value={editingValue?.value || 0} onChange={e => setEditingValue({...editingValue, value: parseFloat(e.target.value)})} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold"/>
                                 </div>
                                 {selectedStatForValues.is_double && (
                                     <div className="flex-1">
                                         <label className="text-[10px] font-bold text-slate-400 uppercase">Вал 2</label>
                                         <input type="number" value={editingValue?.value2 || 0} onChange={e => setEditingValue({...editingValue, value2: parseFloat(e.target.value)})} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold"/>
                                     </div>
                                 )}
                             </div>
                             <div className="flex justify-end mt-3 gap-2">
                                 {editingValue.id && <button onClick={() => setEditingValue({ definition_id: selectedStatForValues.id, date: new Date().toISOString().split('T')[0], value: 0, value2: 0 })} className="text-xs text-slate-400 underline self-center mr-2">Отмена</button>}
                                 <button onClick={handleSaveValue} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-blue-700 flex items-center gap-1"><Save size={14}/> Сохранить</button>
                             </div>
                        </div>

                        {/* History List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            {currentStatValues.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">Нет данных</div>}
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-400 font-bold text-xs uppercase sticky top-0">
                                    <tr><th className="px-3 py-2 text-left">Дата</th><th className="px-3 py-2 text-right">Значение</th><th className="px-3 py-2 text-right">Действия</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {currentStatValues.map(val => (
                                        <tr key={val.id} className="hover:bg-slate-50">
                                            <td className="px-3 py-2 text-slate-600">{format(new Date(val.date), 'dd.MM.yyyy')}</td>
                                            <td className="px-3 py-2 text-right font-bold text-slate-800">
                                                {val.value.toLocaleString()} 
                                                {selectedStatForValues.is_double && <span className="text-slate-400 ml-1">/ {val.value2?.toLocaleString()}</span>}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                 <div className="flex justify-end gap-1">
                                                     <button onClick={() => setEditingValue(val)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={14}/></button>
                                                     <button onClick={async () => {
                                                         if(!confirm('Удалить?')) return;
                                                         if(isOffline || !supabase) {
                                                             const newVals = currentStatValues.filter(v => v.id !== val.id);
                                                             setCurrentStatValues(newVals);
                                                             setAllLatestValues(prev => ({ ...prev, [selectedStatForValues.id]: newVals }));
                                                         } else {
                                                             await supabase.from('statistics_values').delete().eq('id', val.id);
                                                             const { data } = await supabase.from('statistics_values').select('*').eq('definition_id', selectedStatForValues.id).order('date', {ascending: false});
                                                             setCurrentStatValues(data || []);
                                                             fetchAllValues();
                                                         }
                                                     }} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                                                 </div>
                                            </td>
                                        </tr>
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
