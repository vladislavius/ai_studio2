
import React, { useState } from 'react';
import { ORGANIZATION_STRUCTURE } from '../constants';
import { Employee } from '../types';
import { User, X, Search, FileText, Printer, ChevronRight, Users, Crown, Target, Award, ChevronDown, ArrowDown } from 'lucide-react';

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
  
  // State for collapsible cards
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleCard = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedCards(prev => ({...prev, [id]: !prev[id]}));
  };

  const handleDeptClick = (deptId: string, subDeptId?: string) => {
      // Prevent clicking if no employees (optional check, currently disabled for better UX)
      setSelectedDeptId(deptId);
      setSelectedSubDeptId(subDeptId || null);
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
      });
  };

  const quickExportTxt = (e: React.MouseEvent, emp: Employee) => {
    e.stopPropagation();
    const lines = [
        "EMPLOYEE BRIEF",
        "==============",
        `Name: ${emp.full_name}`,
        `Position: ${emp.position}`,
        `Department: ${ORGANIZATION_STRUCTURE[emp.department?.[0] || '']?.name || '-'}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${emp.full_name.replace(/\s+/g, '_')}_brief.txt`;
    a.click();
  };

  const quickPrint = (e: React.MouseEvent, emp: Employee) => {
    e.stopPropagation();
    const printContent = `<html><head><title>${emp.full_name}</title></head><body><h1>${emp.full_name}</h1><p>${emp.position}</p></body></html>`;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    }
  };

  const currentDept = selectedDeptId ? ORGANIZATION_STRUCTURE[selectedDeptId] : null;
  const filteredList = getFilteredEmployees();
  const ownerStruct = ORGANIZATION_STRUCTURE['owner'];
  const directorName = ORGANIZATION_STRUCTURE['dept7']?.departments?.['dept7_19']?.manager || "Генеральный Директор";

  return (
    <div className="h-full flex flex-col relative bg-slate-50/50 overflow-hidden">
        
        {/* UNIFIED SCROLLABLE AREA (X and Y) */}
        <div className="flex-1 overflow-auto custom-scrollbar p-4 md:p-8">
            <div className="min-w-max mx-auto flex flex-col items-center"> 
                
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
                                <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-0.5">Ген. Директор</div>
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
                                            
                                            <h3 className="text-xs font-bold text-slate-800 leading-tight mb-2 h-8 line-clamp-2">{dept.fullName.split(':')[1] || dept.name}</h3>
                                            
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
                                                    <div className="font-bold text-slate-700 text-[11px] leading-snug mb-1 group-hover/item:text-slate-900 line-clamp-2">{sub.name}</div>
                                                    
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
                <div className="w-full md:w-[450px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-100">
                    
                    {/* Drawer Header */}
                    <div className="p-8 border-b border-slate-100 bg-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-20 -mt-20 z-0"></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg" style={{ backgroundColor: currentDept.color }}>
                                    {selectedDeptId === 'owner' ? <Crown size={24}/> : currentDept.name.substring(0,1)}
                                </div>
                                <button onClick={() => setIsDrawerOpen(false)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X size={20} className="text-slate-600"/></button>
                            </div>
                            
                            <h3 className="text-2xl font-black text-slate-800 leading-tight mb-2">
                                {selectedSubDeptId ? currentDept.departments?.[selectedSubDeptId]?.name : currentDept.fullName}
                            </h3>
                            <p className="text-sm text-slate-500 font-medium">
                                {selectedSubDeptId ? `Подразделение департамента ${currentDept.name.split('.')[0]}` : selectedDeptId === 'owner' ? 'Офис учредителя' : 'Список всех сотрудников департамента'}
                            </p>
                        </div>
                    </div>

                    {/* Search & List */}
                    <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-20">
                         <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                            <input type="text" placeholder="Найти сотрудника..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 transition-all text-slate-800 placeholder:text-slate-400"/>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                        {filteredList.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                    <Users size={24} className="opacity-50"/>
                                </div>
                                <p className="font-medium">Нет сотрудников</p>
                            </div>
                        ) : (
                            filteredList.map(emp => (
                                <div 
                                    key={emp.id} 
                                    onClick={() => onSelectEmployee(emp)}
                                    className="group bg-white rounded-2xl p-4 shadow-sm hover:shadow-lg border border-slate-100 hover:border-blue-100 transition-all cursor-pointer flex gap-4 items-center"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                                         {emp.photo_url ? <img src={emp.photo_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={20}/></div>}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-800 text-sm truncate">{emp.full_name}</div>
                                        <div className="text-xs text-blue-600 truncate font-bold">{emp.position}</div>
                                    </div>

                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => quickExportTxt(e, emp)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500"><FileText size={14}/></button>
                                        <button onClick={(e) => quickPrint(e, emp)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500"><Printer size={14}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default OrgChart;
