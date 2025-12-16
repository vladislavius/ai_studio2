
import React, { useState, useRef, useLayoutEffect } from 'react';
import { ORGANIZATION_STRUCTURE } from '../constants';
import { Employee } from '../types';
import { User, X, Search, FileText, ChevronRight, Users, Crown, Target, Award, Copy, Check, MessageCircle, Phone, Hash, AlertTriangle, Zap } from 'lucide-react';

interface OrgChartProps {
  employees: Employee[];
  onSelectEmployee: (emp: Employee) => void;
}

// Remove owner from horizontal scroll, we render it manually at top
const HORIZONTAL_DEPT_ORDER = ['dept7', 'dept1', 'dept2', 'dept3', 'dept4', 'dept5', 'dept6'];

const OrgChart: React.FC<OrgChartProps> = ({ employees, onSelectEmployee }) => {
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedSubDeptId, setSelectedSubDeptId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // State for collapsible cards
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Auto-center scroll on mount
  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      const { scrollWidth, clientWidth } = scrollContainerRef.current;
      if (scrollWidth > clientWidth) {
        scrollContainerRef.current.scrollLeft = (scrollWidth - clientWidth) / 2;
      }
    }
  }, []);

  const toggleCard = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedCards(prev => ({...prev, [id]: !prev[id]}));
  };

  const handleDeptClick = (deptId: string, subDeptId?: string) => {
      setSelectedDeptId(deptId);
      setSelectedSubDeptId(subDeptId || null);
      setSearchTerm(''); // Reset search on open
      setIsDrawerOpen(true);
  };

  const getFilteredEmployees = () => {
      if (!selectedDeptId) return [];
      return employees.filter(emp => {
          const deptMatch = emp.department?.includes(selectedDeptId);
          if (selectedSubDeptId) {
              return deptMatch && emp.subdepartment?.includes(selectedSubDeptId);
          }
          return deptMatch;
      }).filter(emp => 
        emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        emp.position.toLowerCase().includes(searchTerm.toLowerCase())
      );
  };

  const handleCopy = (text: string, id: string) => {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCopyAll = (emp: Employee) => {
      const text = [
          `Имя: ${emp.full_name}`,
          `Должность: ${emp.position}`,
          `NIK: ${emp.nickname || '-'}`,
          `Телефон: ${emp.phone || '-'}`,
          `Telegram: ${emp.telegram || '-'}`
      ].join('\n');
      handleCopy(text, `all-${emp.id}`);
  };

  const currentDept = selectedDeptId ? ORGANIZATION_STRUCTURE[selectedDeptId] : null;
  const filteredList = getFilteredEmployees();
  const ownerStruct = ORGANIZATION_STRUCTURE['owner'];
  const directorName = ORGANIZATION_STRUCTURE['dept7']?.departments?.['dept7_19']?.manager || "ИД";

  // Determine which description to show
  let descriptionTitle = '';
  let descriptionText = '';
  let vfpText = '';
  let functions: string[] = [];
  let mainStat = '';
  let managerName = '';
  let troubleSigns: string[] = [];
  let developmentActions: string[] = [];

  if (currentDept) {
      if (selectedSubDeptId && currentDept.departments) {
          const sub = currentDept.departments[selectedSubDeptId];
          descriptionTitle = sub.name;
          descriptionText = sub.description || '';
          vfpText = sub.vfp || '';
          managerName = sub.manager;
      } else {
          descriptionTitle = currentDept.fullName;
          descriptionText = currentDept.longDescription || currentDept.description;
          vfpText = currentDept.vfp || '';
          functions = currentDept.functions || [];
          mainStat = currentDept.mainStat || '';
          managerName = currentDept.manager;
          troubleSigns = currentDept.troubleSigns || [];
          developmentActions = currentDept.developmentActions || [];
      }
  }

  return (
    <div className="h-full flex flex-col relative bg-slate-50/50 overflow-hidden">
        
        {/* UNIFIED SCROLLABLE AREA (X and Y) */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto custom-scrollbar p-4 md:p-8">
            {/* Added w-full to wrapper for mobile, md:min-w-max for desktop to ensure proper centering logic */}
            <div className="w-full md:min-w-max mx-auto flex flex-col items-center"> 
                
                {/* 2. HIERARCHY TOP (FOUNDER -> DIRECTOR) - COMPACT */}
                <div className="flex flex-col items-center mb-6 relative z-10">
                    
                    {/* FOUNDER CARD (Compact) */}
                    <div 
                        onClick={() => handleDeptClick('owner')}
                        className="w-56 md:w-60 bg-white rounded-xl shadow-md border-2 border-amber-200 p-2.5 cursor-pointer hover:-translate-y-1 transition-transform relative z-20"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner flex-shrink-0">
                                <Crown size={20}/>
                            </div>
                            <div className="min-w-0">
                                <div className="text-[9px] uppercase font-bold text-amber-600 tracking-wider mb-0.5">Основатель</div>
                                <div className="font-bold text-slate-800 text-sm leading-tight truncate">{ownerStruct.manager}</div>
                            </div>
                        </div>
                        {/* Owner Badge Count */}
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-md border-2 border-white">
                             {employees.filter(e => e.department?.includes('owner')).length}
                        </div>
                    </div>

                    {/* Vertical Connector 1 (Compact) */}
                    <div className="h-4 w-px bg-slate-300"></div>

                    {/* DIRECTOR CARD (Compact) */}
                    <div 
                        onClick={() => handleDeptClick('dept7', 'dept7_19')} 
                        className="w-56 md:w-60 bg-white rounded-xl shadow-sm border border-slate-300 p-2.5 cursor-pointer hover:-translate-y-1 transition-transform relative z-20"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shadow-inner flex-shrink-0">
                                <User size={20}/>
                            </div>
                            <div className="min-w-0">
                                <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-0.5">Исполнительный Директор</div>
                                <div className="font-bold text-slate-800 text-sm leading-tight truncate">{directorName}</div>
                            </div>
                        </div>
                    </div>

                    {/* Vertical Connector 2 (Compact) */}
                    <div className="h-6 w-px bg-slate-300"></div>
                
                </div>

                {/* 3. DEPARTMENTS ROW */}
                <div className="relative mb-8 w-full max-w-[100vw] md:max-w-none">
                    {/* Horizontal Connector Line */}
                    <div className="absolute top-0 left-10 right-10 h-px bg-slate-300 -z-10"></div>

                    {/* Horizontal Container (Not scrollable itself, relies on parent) */}
                    <div className="flex flex-col md:flex-row justify-center gap-4 md:gap-4 pt-6 md:pt-6">
                        {HORIZONTAL_DEPT_ORDER.map(deptId => {
                            const dept = ORGANIZATION_STRUCTURE[deptId];
                            const subDepts = dept.departments ? Object.values(dept.departments) : [];
                            const deptColor = dept.color;
                            
                            return (
                                <div key={deptId} className="flex-shrink-0 w-full md:w-64 flex flex-col group relative px-4 md:px-0">
                                    
                                    {/* Vertical Connector from Main Line (Desktop) */}
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-px h-6 bg-slate-300 hidden md:block"></div>

                                    {/* Department Card */}
                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/50 flex flex-col h-[400px] overflow-hidden transition-all duration-300 hover:shadow-xl">
                                        
                                        {/* Header Area */}
                                        <div 
                                            onClick={() => handleDeptClick(deptId)}
                                            className="p-3 pb-3 relative cursor-pointer overflow-hidden bg-white border-b border-slate-50"
                                        >
                                            <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: deptColor }}></div>
                                            
                                            <div className="flex justify-between items-start mb-2 mt-1">
                                                <div className="w-7 h-7 rounded-md flex items-center justify-center text-white font-black text-xs shadow-md shadow-slate-200" style={{ backgroundColor: deptColor }}>
                                                    {dept.name.split('.')[0]}
                                                </div>
                                                <div className="bg-slate-100 px-2 py-0.5 rounded-full text-[9px] font-bold text-slate-600 flex items-center gap-1">
                                                    <Users size={10} />
                                                    {employees.filter(e => e.department?.includes(deptId)).length}
                                                </div>
                                            </div>
                                            
                                            <h3 className="text-xs font-bold text-slate-800 leading-tight mb-2 min-h-[1.5rem] break-words">
                                                {dept.fullName.split(':')[1] || dept.name}
                                            </h3>
                                            
                                            <div className="flex items-center gap-2 mt-1 p-1.5 rounded-lg border border-slate-100 bg-slate-50/50">
                                                 <div className="w-4 h-4 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-400">
                                                     <User size={8}/>
                                                 </div>
                                                 <div className="min-w-0">
                                                     <div className="text-[9px] font-bold text-slate-700 leading-tight truncate">{dept.manager}</div>
                                                 </div>
                                            </div>
                                        </div>

                                        {/* Divisions List */}
                                        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-slate-50/50 custom-scrollbar">
                                            {subDepts.map(sub => (
                                                <div 
                                                    key={sub.id}
                                                    onClick={() => handleDeptClick(deptId, sub.id)}
                                                    className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all cursor-pointer group/item relative overflow-hidden"
                                                >
                                                    <div className="absolute left-0 top-0 bottom-0 w-0.5 transition-all group-hover/item:bg-opacity-100 bg-opacity-0" style={{ backgroundColor: deptColor }}></div>
                                                    
                                                    <div className="flex justify-between items-start mb-0.5">
                                                        <span className="text-[7px] font-black uppercase text-slate-300 tracking-widest">DIV {sub.code}</span>
                                                        <ChevronRight size={8} className="text-slate-300 group-hover/item:text-slate-500 transition-colors"/>
                                                    </div>
                                                    <div className="font-bold text-slate-700 text-[11px] leading-snug mb-1 group-hover/item:text-slate-900 break-words">{sub.name}</div>
                                                    
                                                    <div className="flex items-center justify-between border-t border-slate-50 pt-1">
                                                        <div className="flex items-center gap-1 text-[8px] text-slate-400">
                                                            <User size={8}/>
                                                            <span className="font-medium truncate max-w-[80px]">{sub.manager.split(' ')[0]}</span>
                                                        </div>
                                                        <span className="text-[8px] font-bold bg-slate-100 text-slate-400 px-1 rounded-md">
                                                            {employees.filter(e => e.subdepartment?.includes(sub.id)).length}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 1. GOAL & VFP BANNERS - Compact & Bottom */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 mb-8 max-w-3xl w-full px-4 md:px-0">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col items-center text-center relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
                        <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <Target size={16}/>
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1">Цель Компании</h3>
                        <p className="text-slate-500 text-xs leading-relaxed">
                            {ownerStruct.goal ? (ownerStruct.goal.length > 150 ? ownerStruct.goal.substring(0, 150) + '...' : ownerStruct.goal) : "Цель не задана."}
                        </p>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col items-center text-center relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                        <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <Award size={16}/>
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1">ЦКП Компании</h3>
                        <p className="text-slate-500 text-xs leading-relaxed">
                            {ownerStruct.vfp ? (ownerStruct.vfp.length > 150 ? ownerStruct.vfp.substring(0, 150) + '...' : ownerStruct.vfp) : "ЦКП не задан."}
                        </p>
                    </div>
                </div>

            </div>
        </div>

        {/* EMPLOYEE DRAWER (SLIDE OVER) */}
        {isDrawerOpen && currentDept && (
            <div className="absolute inset-0 z-50 flex justify-end bg-slate-900/10 backdrop-blur-[2px] animate-in fade-in duration-300">
                <div className="w-full md:w-[550px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-100">
                    
                    {/* Drawer Header (Full Width Text) */}
                    <div className="p-4 border-b border-slate-100 bg-white relative overflow-hidden flex items-start justify-between shadow-sm z-30">
                        <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0" style={{ backgroundColor: currentDept.color }}>
                                {selectedDeptId === 'owner' ? <Crown size={20}/> : currentDept.name.substring(0,1)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-lg font-black text-slate-800 leading-tight break-words">
                                    {descriptionTitle}
                                </h3>
                            </div>
                        </div>
                        <button onClick={() => setIsDrawerOpen(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0"><X size={20} className="text-slate-500"/></button>
                    </div>

                    {/* SCROLLABLE CONTENT */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 relative">
                        
                        {/* DESCRIPTION SECTION (Before Manager) */}
                        <div className="bg-white p-6 border-b border-slate-100">
                             
                             {/* Description Text */}
                             {descriptionText && (
                                <div className="mb-5">
                                    <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 flex items-center gap-1"><FileText size={10}/> Описание</h4>
                                    <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{descriptionText}</p>
                                </div>
                             )}

                             {/* Main Statistic (if exists) */}
                             {mainStat && (
                                 <div className="mb-5 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                      <h4 className="text-[10px] uppercase font-black text-blue-400 tracking-widest mb-1">Главная Статистика</h4>
                                      <p className="text-sm font-bold text-blue-900">{mainStat}</p>
                                 </div>
                             )}

                             {/* Functions List */}
                             {functions && functions.length > 0 && (
                                 <div className="mb-5">
                                      <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2">Основные функции</h4>
                                      <ul className="space-y-1.5">
                                          {functions.map((fn, idx) => (
                                              <li key={idx} className="text-xs text-slate-600 font-medium flex items-start gap-2">
                                                  <div className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 flex-shrink-0"></div>
                                                  {fn}
                                              </li>
                                          ))}
                                      </ul>
                                 </div>
                             )}

                             {/* Signs of Trouble (Red Block) */}
                             {troubleSigns && troubleSigns.length > 0 && (
                                 <div className="mb-5 bg-red-50 p-4 rounded-xl border border-red-100">
                                      <h4 className="text-[10px] uppercase font-black text-red-500 tracking-widest mb-3 flex items-center gap-1"><AlertTriangle size={12}/> Признаки проблем:</h4>
                                      <ul className="space-y-1.5">
                                          {troubleSigns.map((sign, idx) => (
                                              <li key={idx} className="text-xs text-red-800 font-medium flex items-start gap-2">
                                                  <div className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0"></div>
                                                  {sign}
                                              </li>
                                          ))}
                                      </ul>
                                 </div>
                             )}

                             {/* Development Actions (Green Block) */}
                             {developmentActions && developmentActions.length > 0 && (
                                 <div className="mb-5 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                      <h4 className="text-[10px] uppercase font-black text-emerald-600 tracking-widest mb-3 flex items-center gap-1"><Zap size={12}/> Первоочередные действия:</h4>
                                      <ul className="space-y-1.5">
                                          {developmentActions.map((action, idx) => (
                                              <li key={idx} className="text-xs text-emerald-800 font-medium flex items-start gap-2">
                                                  <div className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0"></div>
                                                  {action}
                                              </li>
                                          ))}
                                      </ul>
                                 </div>
                             )}

                             {/* VFP Section */}
                             {vfpText && (
                                 <div className="mb-6">
                                     <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 flex items-center gap-1"><Award size={10}/> Ценный Конечный Продукт (ЦКП)</h4>
                                     <div className="bg-slate-50 border-l-4 border-slate-300 p-3 rounded-r-lg">
                                         <p className="text-sm font-bold text-slate-700 italic">"{vfpText}"</p>
                                     </div>
                                 </div>
                             )}

                             {/* Manager Section */}
                             <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                                 <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
                                     <User size={20}/>
                                 </div>
                                 <div>
                                     <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Ответственный руководитель</div>
                                     <div className="text-sm font-bold text-slate-800">{managerName}</div>
                                 </div>
                             </div>
                        </div>

                        {/* EMPLOYEES LIST HEADER */}
                        <div className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Users size={12}/> Сотрудники ({filteredList.length})
                            </h4>
                            <div className="relative w-40">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12}/>
                                <input 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    type="text" 
                                    placeholder="Поиск..." 
                                    className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-300"
                                />
                            </div>
                        </div>

                        {/* EMPLOYEES MINI CARDS (NOW CLICKABLE FOR EVERYONE) */}
                        <div className="p-4 space-y-3 pb-20">
                            {filteredList.length === 0 ? (
                                <div className="h-32 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl mx-2">
                                    <p className="font-medium text-xs">Нет сотрудников в этом отделе</p>
                                </div>
                            ) : (
                                filteredList.map(emp => (
                                    <div 
                                        key={emp.id}
                                        onClick={() => onSelectEmployee(emp)} 
                                        className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex gap-4 items-start cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group/card"
                                    >
                                        {/* Avatar */}
                                        <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-100 shadow-sm relative">
                                             {emp.photo_url ? (
                                                <img 
                                                    src={emp.photo_url} 
                                                    className="w-full h-full object-cover" 
                                                    onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${emp.full_name}&background=f1f5f9&color=64748b`)}
                                                    // Standard error fallback logic handled by browser or parent if src fails
                                                /> 
                                             ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={24}/></div>
                                             )}
                                             <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-black/20 to-transparent"></div>
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            {/* Header */}
                                            <div className="flex justify-between items-start mb-1">
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm leading-tight group-hover/card:text-blue-600 transition-colors">{emp.full_name}</div>
                                                    <div className="text-xs text-blue-600 font-bold mt-0.5">{emp.position}</div>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleCopyAll(emp); }} 
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                                                    title="Скопировать данные"
                                                >
                                                    {copiedId === `all-${emp.id}` ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
                                                </button>
                                            </div>

                                            {/* Details Grid */}
                                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                
                                                {/* NIK */}
                                                <div className="bg-slate-50 rounded-lg px-2 py-1.5 flex items-center justify-between border border-slate-100 group">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Hash size={10} className="text-slate-400 flex-shrink-0"/>
                                                        <span className="text-xs text-slate-600 font-medium truncate">{emp.nickname || 'нет ника'}</span>
                                                    </div>
                                                    {emp.nickname && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleCopy(emp.nickname || '', `nik-${emp.id}`); }} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-blue-600 transition-opacity">
                                                            {copiedId === `nik-${emp.id}` ? <Check size={10} className="text-green-500"/> : <Copy size={10}/>}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* PHONE */}
                                                <div className="bg-slate-50 rounded-lg px-2 py-1.5 flex items-center justify-between border border-slate-100 group">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Phone size={10} className="text-slate-400 flex-shrink-0"/>
                                                        <span className="text-xs text-slate-600 font-medium truncate">{emp.phone || '-'}</span>
                                                    </div>
                                                    {emp.phone && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleCopy(emp.phone || '', `ph-${emp.id}`); }} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-blue-600 transition-opacity">
                                                            {copiedId === `ph-${emp.id}` ? <Check size={10} className="text-green-500"/> : <Copy size={10}/>}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* TELEGRAM */}
                                                <div className="bg-slate-50 rounded-lg px-2 py-1.5 flex items-center justify-between border border-slate-100 group sm:col-span-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <MessageCircle size={10} className="text-slate-400 flex-shrink-0"/>
                                                        <span className="text-xs text-slate-600 font-medium truncate">{emp.telegram || '-'}</span>
                                                    </div>
                                                    {emp.telegram && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleCopy(emp.telegram || '', `tg-${emp.id}`); }} className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-blue-600 transition-opacity">
                                                            {copiedId === `tg-${emp.id}` ? <Check size={10} className="text-green-500"/> : <Copy size={10}/>}
                                                        </button>
                                                    )}
                                                </div>

                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default OrgChart;