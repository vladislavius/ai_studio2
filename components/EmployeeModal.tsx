
import React, { useState, useEffect, useRef } from 'react';
import { ORGANIZATION_STRUCTURE, ROLE_STAT_TEMPLATES } from '../constants';
import { X, Save, Upload, FileText, Trash2, Plus, TrendingUp, TrendingDown, CheckCircle2, Printer, Download, Link as LinkIcon, Image as ImageIcon, Calendar, Info, HelpCircle, ArrowDownUp, AlertCircle, Phone, User, HeartPulse, File, Lock, DownloadCloud, Link2, Unlink, Sparkles, Copy, Edit2, Layers, Loader2 } from 'lucide-react';
import { Employee as EmployeeType, Attachment, EmergencyContact, StatisticDefinition, StatisticValue, WiseCondition } from '../types';
import { supabase } from '../supabaseClient';
import StatsChart from './StatsChart';
import { format, subDays, getDay } from 'date-fns';
import ConfirmationModal from './ConfirmationModal';

interface EmployeeModalProps {
  isOpen: boolean;
  isReadOnly?: boolean;
  onClose: () => void;
  onSave: (employee: EmployeeType) => void;
  initialData: EmployeeType | null;
}

const DEFAULT_EMPLOYEE: EmployeeType = {
  id: '',
  created_at: '',
  updated_at: '',
  full_name: '',
  position: '',
  nickname: '',
  email: '',
  email2: '',
  phone: '',
  whatsapp: '',
  telegram: '',
  birth_date: '',
  join_date: '',
  actual_address: '',
  registration_address: '',
  inn: '',
  passport_number: '',
  passport_date: '',
  passport_issuer: '',
  foreign_passport: '',
  foreign_passport_date: '',
  foreign_passport_issuer: '',
  bank_name: '',
  bank_details: '',
  crypto_wallet: '',
  crypto_network: '',
  crypto_currency: '',
  additional_info: '',
  emergency_contacts: [],
  custom_fields: [],
  attachments: [],
  department: [],
  subdepartment: []
};

// Demo Data Generator
const generateDemoPersonalStats = () => {
    const generateHistory = (base: number) => Array.from({length: 52}).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - ((51-i) * 7)); // Weekly points for a year
        return {
            id: `demo-${i}`, 
            definition_id: 'demo', 
            date: d.toISOString().split('T')[0], 
            value: Math.max(0, Math.floor(base + Math.sin(i/5)*20 + Math.random()*10 - 5))
        };
    });
    return [
        { 
            def: { id: 'p1', title: 'Личная Продуктивность (Баллы)', type: 'employee', owner_id: 'demo', description: 'Суммарный объем выполненных задач в баллах' },
            vals: generateHistory(100)
        },
        { 
            def: { id: 'p2', title: 'Завершенные циклы действий', type: 'employee', owner_id: 'demo', description: 'Количество полностью закрытых задач без возврата' },
            vals: generateHistory(45)
        }
    ];
};

const PERIODS = [
    { id: '1w', label: '1 Нед.' },
    { id: '3w', label: '3 Нед.' },
    { id: '1m', label: 'Месяц' },
    { id: '3m', label: '3 Мес.' },
    { id: '6m', label: 'Полгода' },
    { id: '1y', label: 'Год' },
    { id: 'all', label: 'Все' },
];

const analyzeTrend = (vals: StatisticValue[], inverted: boolean = false) => {
    if (!vals || vals.length < 2) return { condition: 'non_existence' as WiseCondition, change: 0, current: 0, slope: 0 };
    const sorted = [...vals].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const currentVal = sorted[sorted.length - 1].value;
    
    // Linear Regression Slope
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, n = sorted.length;
    sorted.forEach((v, i) => { sumX += i; sumY += v.value; sumXY += i * v.value; sumXX += i * i; });
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    const startVal = sorted[0].value;
    let change = 0;
    if (startVal !== 0) change = (currentVal - startVal) / Math.abs(startVal);
    else if (currentVal > 0) change = 1;
    
    return { condition: 'normal' as WiseCondition, change, current: currentVal, slope };
};

// Helper to get nearest previous Thursday (Start of Fiscal Week)
const getNearestThursday = () => {
    const d = new Date();
    const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 4 = Thu
    const diff = (day + 7 - 4) % 7; // Distance to Thursday
    d.setDate(d.getDate() - diff);
    return d.toISOString().split('T')[0];
};

const EmployeeModal: React.FC<EmployeeModalProps> = ({ isOpen, isReadOnly = false, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<EmployeeType>(DEFAULT_EMPLOYEE);
  const [activeTab, setActiveTab] = useState('general');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Stats State
  const [statsDefinitions, setStatsDefinitions] = useState<StatisticDefinition[]>([]);
  const [statsValues, setStatsValues] = useState<StatisticValue[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isDemoStats, setIsDemoStats] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<string>('3m');
  const [newValueInput, setNewValueInput] = useState<Record<string, string>>({}); // {statId: value}
  const [newValueInput2, setNewValueInput2] = useState<Record<string, string>>({}); // {statId: value2}
  const [infoStatId, setInfoStatId] = useState<string | null>(null); // For overlay description
  const [newStatDate, setNewStatDate] = useState<string>(getNearestThursday());
  
  // Stat Management State (Create/Assign)
  const [showStatManager, setShowStatManager] = useState(false);
  const [statManagerMode, setStatManagerMode] = useState<'create' | 'assign'>('assign');
  const [newStatData, setNewStatData] = useState({ title: '', description: '', inverted: false, is_double: false, calculation_method: '' });
  
  // Context-Aware Stats (Available to Assign)
  const [departmentStats, setDepartmentStats] = useState<{deptName: string, stats: StatisticDefinition[]}[]>([]);
  
  // Editing State
  const [editingStatId, setEditingStatId] = useState<string | null>(null);

  // Confirm Modal State (Local for statistics actions)
  const [confirmModal, setConfirmModal] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const isNewEmployee = !initialData;

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(prev => {
            if (prev.id === initialData.id && prev.photo_url !== initialData.photo_url) {
                 return { ...DEFAULT_EMPLOYEE, ...initialData, photo_url: prev.photo_url || initialData.photo_url };
            }
            return { ...DEFAULT_EMPLOYEE, ...initialData };
        });
        fetchPersonalStats(initialData.id);
      } else {
        setFormData({ ...DEFAULT_EMPLOYEE, id: crypto.randomUUID(), created_at: new Date().toISOString() });
        setStatsDefinitions([]);
        setStatsValues([]);
      }
      setActiveTab('general');
      setStatsPeriod('3m');
      setInfoStatId(null);
      setShowStatManager(false);
      setNewStatDate(getNearestThursday());
    }
  }, [isOpen, initialData?.id]);

  // When opening Stat Manager, fetch relevant dept stats
  useEffect(() => {
      if (showStatManager && supabase) {
          fetchRelevantDepartmentStats();
      }
  }, [showStatManager, formData.department, formData.subdepartment]);

  const fetchPersonalStats = async (empId: string) => {
      setIsLoadingStats(true);
      setIsDemoStats(false);
      
      let foundData = false;
      if (supabase) {
          const { data: defs } = await supabase.from('statistics_definitions').select('*').eq('owner_id', empId);
          if (defs && defs.length > 0) {
              setStatsDefinitions(defs);
              const ids = defs.map(d => d.id);
              const { data: vals } = await supabase.from('statistics_values').select('*').in('definition_id', ids).order('date', { ascending: true });
              setStatsValues(vals || []);
              foundData = true;
          } else {
              setStatsDefinitions([]);
          }
      }

      if (!supabase && !foundData) {
          const demo = generateDemoPersonalStats();
          setStatsDefinitions(demo.map(d => d.def as StatisticDefinition));
          const allVals: StatisticValue[] = [];
          demo.forEach(d => {
              d.vals.forEach(v => allVals.push({...v, definition_id: d.def.id}));
          });
          setStatsValues(allVals);
          setIsDemoStats(true);
      }
      setIsLoadingStats(false);
  };

  // Fetch statistics belonging to the user's assigned departments
  const fetchRelevantDepartmentStats = async () => {
      if (!supabase) return;
      const deptIds = [...(formData.department || []), ...(formData.subdepartment || [])];
      
      if (deptIds.length === 0) {
          setDepartmentStats([]);
          return;
      }

      const { data } = await supabase.from('statistics_definitions').select('*').in('owner_id', deptIds);
      
      if (data) {
          const grouped: Record<string, StatisticDefinition[]> = {};
          
          data.forEach(stat => {
              const alreadyHas = statsDefinitions.some(s => s.title === stat.title);
              if (alreadyHas) return;

              const deptName = ORGANIZATION_STRUCTURE[stat.owner_id || '']?.name || 
                               Object.values(ORGANIZATION_STRUCTURE).find(d => d.departments?.[stat.owner_id || ''])?.departments?.[stat.owner_id || '']?.name || 
                               'Неизвестный отдел';
              
              if (!grouped[deptName]) grouped[deptName] = [];
              grouped[deptName].push(stat);
          });

          setDepartmentStats(Object.entries(grouped).map(([deptName, stats]) => ({ deptName, stats })));
      }
  };

  const handleCreatePersonalStat = async (template?: Partial<StatisticDefinition>) => {
      const titleToUse = template?.title || newStatData.title;
      if (!titleToUse) { console.warn("Введите название статистики"); return; }
      if (!supabase) return;

      const newStat: Partial<StatisticDefinition> = {
          title: titleToUse,
          description: template?.description || newStatData.description || 'Личная статистика',
          owner_id: formData.id,
          type: 'employee',
          inverted: template?.inverted ?? newStatData.inverted,
          is_double: template?.is_double ?? newStatData.is_double,
          calculation_method: template?.calculation_method ?? newStatData.calculation_method
      };

      try {
        const { data, error } = await supabase.from('statistics_definitions').insert([newStat]).select();
        
        if (error) {
            console.error("Failed to create stat:", error);
        } else if (data && data.length > 0) {
            const createdStat = data[0];
            if (createdStat && createdStat.id) {
                setStatsDefinitions(prev => [...prev, createdStat]);
                if(!template) { 
                    setShowStatManager(false);
                    setNewStatData({ title: '', description: '', inverted: false, is_double: false, calculation_method: '' });
                } else {
                    fetchRelevantDepartmentStats();
                }
            }
        }
      } catch (err) {
          console.error("Crash prevented in stat creation:", err);
      }
  };

  const handleDeleteStatRequest = (statId: string) => {
      setConfirmModal({
          isOpen: true,
          title: 'Удаление статистики',
          message: 'Вы уверены, что хотите удалить эту статистику и все её данные? Это действие необратимо.',
          onConfirm: () => handleDeleteStat(statId)
      });
  };

  const handleDeleteStat = async (statId: string) => {
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      if (!supabase) return;

      // 1. Delete values
      await supabase.from('statistics_values').delete().eq('definition_id', statId);
      // 2. Delete definition
      const { error } = await supabase.from('statistics_definitions').delete().eq('id', statId);

      if (error) {
          console.error("Ошибка удаления: " + error.message);
      } else {
          setStatsDefinitions(prev => prev.filter(s => s.id !== statId));
      }
  };

  const handleUpdateStat = async () => {
      if (!editingStatId || !supabase) return;
      
      try {
          const { error } = await supabase.from('statistics_definitions').update({
              title: newStatData.title,
              description: newStatData.description,
              inverted: newStatData.inverted,
              is_double: newStatData.is_double,
              calculation_method: newStatData.calculation_method
          }).eq('id', editingStatId);

          if (error) {
              console.error("Ошибка обновления: ", error);
          } else {
              setStatsDefinitions(prev => prev.map(s => s.id === editingStatId ? { ...s, ...newStatData } : s));
              setEditingStatId(null);
              setNewStatData({ title: '', description: '', inverted: false, is_double: false, calculation_method: '' });
          }
      } catch (err) {
          console.error("Crash prevented in handleUpdateStat", err);
      }
  };

  const startEditing = (stat: StatisticDefinition) => {
      setEditingStatId(stat.id);
      setNewStatData({
          title: stat.title,
          description: stat.description || '',
          inverted: stat.inverted || false,
          is_double: stat.is_double || false,
          calculation_method: stat.calculation_method || ''
      });
  };

  const getFilteredValues = (statId: string) => {
      const vals = statsValues.filter(v => v.definition_id === statId);
      if (!vals.length) return [];
      
      const sorted = [...vals].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const total = sorted.length;

      switch (statsPeriod) {
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

  const handleAddValue = async (statId: string, isDouble: boolean) => {
      const valStr = newValueInput[statId];
      if (!valStr) return;
      const val = parseFloat(valStr);
      let val2 = 0;
      if (isDouble && newValueInput2[statId]) {
          val2 = parseFloat(newValueInput2[statId]);
      }

      const date = newStatDate; 

      if (isDemoStats || !supabase) {
          const newVal: StatisticValue = {
              id: `local-${Date.now()}`,
              definition_id: statId,
              date: date,
              value: val,
              value2: val2
          };
          setStatsValues(prev => [...prev, newVal]);
          setNewValueInput(prev => ({...prev, [statId]: ''}));
          if(isDouble) setNewValueInput2(prev => ({...prev, [statId]: ''}));
          return;
      }

      const { data, error } = await supabase.from('statistics_values').insert([{ definition_id: statId, value: val, value2: val2, date: date }]).select();
      
      if (!error && data && data.length > 0) {
          setStatsValues(prev => [...prev, data[0]]);
          setNewValueInput(prev => ({...prev, [statId]: ''}));
          if(isDouble) setNewValueInput2(prev => ({...prev, [statId]: ''}));
      } else {
          console.error("Ошибка сохранения значения:", error);
      }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleDepartment = (deptId: string) => {
      if (isReadOnly) return;
      setFormData(prev => {
          const current = prev.department || [];
          const exists = current.includes(deptId);
          let newDepts;
          if (exists) {
              newDepts = current.filter(d => d !== deptId);
              const deptObj = ORGANIZATION_STRUCTURE[deptId];
              const subIdsToRemove = deptObj.departments ? Object.keys(deptObj.departments) : [];
              const newSubs = (prev.subdepartment || []).filter(s => !subIdsToRemove.includes(s));
              return { ...prev, department: newDepts, subdepartment: newSubs };
          } else {
              newDepts = [...current, deptId];
              return { ...prev, department: newDepts };
          }
      });
  };

  const toggleSubDepartment = (subId: string) => {
      if (isReadOnly) return;
      setFormData(prev => {
          const current = prev.subdepartment || [];
          const exists = current.includes(subId);
          const newSubs = exists ? current.filter(s => s !== subId) : [...current, subId];
          return { ...prev, subdepartment: newSubs };
      });
  };

  const handleEmergencyChange = (index: number, field: keyof EmergencyContact, value: string) => {
    const newContacts = [...formData.emergency_contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setFormData(prev => ({ ...prev, emergency_contacts: newContacts }));
  };
  const addEmergencyContact = () => { setFormData(prev => ({ ...prev, emergency_contacts: [...prev.emergency_contacts, { name: '', relation: '', phone: '' }] })); };
  const removeEmergencyContact = (index: number) => { setFormData(prev => ({ ...prev, emergency_contacts: prev.emergency_contacts.filter((_, i) => i !== index) })); };
  
  // --- FILE & PHOTO UPLOAD ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isPhoto: boolean = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        if (isPhoto) { setFormData(prev => ({ ...prev, photo_url: base64 })); }

        if (supabase) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${formData.id}/${Date.now()}_.${fileExt}`; 
            try {
                const bucket = isPhoto ? 'employee-files' : 'employee-docs';
                const fullPath = isPhoto ? `photos/${fileName}` : `documents/${fileName}`;
                const { data, error } = await supabase.storage.from(bucket).upload(fullPath, file);
                
                if (data) {
                    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
                    if (isPhoto) {
                        setFormData(prev => ({ ...prev, photo_url: urlData.publicUrl }));
                    } else {
                        const newAttachment: Attachment = { id: crypto.randomUUID(), employee_id: formData.id, file_name: file.name, file_type: file.type, file_size: file.size, storage_path: data.path, public_url: urlData.publicUrl, uploaded_at: new Date().toISOString() };
                        setFormData(prev => ({ ...prev, attachments: [...prev.attachments, newAttachment] }));
                    }
                }
            } catch (err) { console.error("Upload error", err); }
        }
        setIsUploading(false);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = ''; 
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => { setFormData(prev => ({ ...prev, attachments: prev.attachments.filter(a => a.id !== id) })); };

  const handleSubmit = (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if(isUploading) return;
    onSave({ ...formData, updated_at: new Date().toISOString() });
  };

  if (!isOpen) return null;

  const inputClass = `w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium text-slate-800 placeholder:text-slate-400 hover:border-slate-300 ${isReadOnly ? 'bg-slate-50 text-slate-600 pointer-events-none' : ''}`;
  const labelClass = "block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1 tracking-wide";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-none md:rounded-3xl shadow-2xl w-full max-w-6xl h-full md:h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-4 md:px-8 py-4 md:py-5 border-b border-gray-100 bg-white flex-shrink-0">
          <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-bold text-slate-800 truncate">{isReadOnly ? 'Просмотр Сотрудника' : (initialData ? 'Редактирование' : 'Новый Сотрудник')}</h2>
              <div className="flex items-center gap-2 text-sm text-slate-500 mt-0.5 hidden sm:flex">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono text-slate-600">{formData.id.substring(0,8)}</span>
                  <span>• Личное дело {isReadOnly && '(Только чтение)'}</span>
              </div>
          </div>
          <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-3 md:px-5 py-2 md:py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">{isReadOnly ? 'Закрыть' : 'Отмена'}</button>
              {!isReadOnly && (
                  <button 
                    type="button"
                    onClick={handleSubmit} 
                    disabled={isUploading}
                    className={`px-4 md:px-6 py-2 md:py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 flex items-center gap-2 transition-all ${isUploading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700 hover:-translate-y-0.5'}`}
                  >
                    {isUploading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />} 
                    <span className="hidden sm:inline">Сохранить</span>
                  </button>
              )}
          </div>
        </div>

        {/* Layout */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden bg-slate-50/50">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-2 md:p-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] z-10 custom-scrollbar flex-shrink-0">
                {[
                    { id: 'general', label: '1. Основное' },
                    { id: 'contacts', label: '2. Контакты' },
                    { id: 'docs', label: '3. Документы', restricted: true },
                    { id: 'finance', label: '4. Финансы', restricted: true },
                    { id: 'files', label: '5. Файлы', restricted: true },
                    { id: 'stats', label: '6. Статистика', icon: <TrendingUp size={14}/>, restricted: false }
                ].map(tab => {
                    if (isReadOnly && tab.restricted) return null;
                    return (
                        <button 
                            key={tab.id}
                            type="button" 
                            onClick={() => setActiveTab(tab.id)} 
                            className={`flex-shrink-0 w-auto md:w-full text-left px-3 md:px-4 py-2 md:py-3.5 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-between group whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                        >
                            <span className="flex items-center gap-2">{tab.label}</span>
                            {tab.icon && <span className={`hidden md:block ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}`}>{tab.icon}</span>}
                        </button>
                    )
                })}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                {/* PREVENT DEFAULT ON FORM SUBMIT TO STOP PAGE RELOAD */}
                <form className="max-w-4xl mx-auto space-y-8 pb-20" onSubmit={(e) => e.preventDefault()}>
                    
                    {/* ... (Previous Tabs Content omitted for brevity, logic remains same) ... */}
                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <section>
                                <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2"><div className="w-1.5 h-6 bg-blue-500 rounded-full"></div> Личные Данные</h3>
                                <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                    <div className="md:col-span-2 flex justify-center mb-4">
                                        <div className="w-32 h-32 rounded-full border-4 border-slate-100 shadow-lg overflow-hidden bg-slate-200 relative group">
                                            {formData.photo_url ? (
                                                <img src={formData.photo_url} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { if (e.currentTarget.src.startsWith('https://ui-avatars.com')) return; e.currentTarget.src = `https://ui-avatars.com/api/?name=${formData.full_name}&background=f1f5f9&color=64748b`; }}/>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100"><User size={40}/></div>
                                            )}
                                            <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Upload size={24} /></button>
                                            <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e, true)} className="hidden" accept="image/*" />
                                        </div>
                                    </div>
                                    <div><label className={labelClass}>ФИО (Полностью)</label><input name="full_name" value={formData.full_name} onChange={handleChange} className={inputClass} placeholder="Иванов Иван Иванович" /></div>
                                    <div><label className={labelClass}>Должность</label><input name="position" value={formData.position} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Дата Рождения</label><input type="date" name="birth_date" value={formData.birth_date || ''} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Дата Приема</label><input type="date" name="join_date" value={formData.join_date || ''} onChange={handleChange} className={inputClass} /></div>
                                    <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                         <div><label className={labelClass}>Системный NIK</label><input name="nickname" value={formData.nickname || ''} onChange={handleChange} className={inputClass} placeholder="ivan_hr" /></div>
                                         <div><label className={labelClass}>Telegram (Username)</label><input name="telegram" value={formData.telegram || ''} onChange={handleChange} className={inputClass} placeholder="@username" /></div>
                                    </div>
                                </div>
                            </section>
                            <section>
                                <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2"><div className="w-1.5 h-6 bg-amber-500 rounded-full"></div> Организационная Структура</h3>
                                <div className="space-y-6">
                                    <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm">
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider">Департамент (Владелец)</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {Object.values(ORGANIZATION_STRUCTURE).map(d => {
                                                const isSelected = formData.department?.includes(d.id);
                                                return (
                                                    <div key={d.id} onClick={() => toggleDepartment(d.id)} className={`cursor-pointer p-3 rounded-2xl border-2 transition-all flex items-center gap-3 relative overflow-hidden group ${isSelected ? 'border-blue-500 bg-blue-50/50 shadow-md ring-0' : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'}`}>
                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm font-bold text-sm transition-transform group-hover:scale-105" style={{backgroundColor: d.color}}>{d.name.substring(0,1)}</div>
                                                        <div className="flex-1 min-w-0 z-10"><div className={`text-sm font-bold truncate ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>{d.name.split(':')[0]}</div><div className="text-[10px] text-slate-400 truncate font-medium">{d.manager}</div></div>
                                                        {isSelected && <div className="absolute top-2 right-2 text-blue-500"><CheckCircle2 size={18} fill="currentColor" className="text-white"/></div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {formData.department && formData.department.length > 0 && (
                                        <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider">Отдел / Секция (Функциональная роль)</label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {formData.department.map(deptId => {
                                                    const dept = ORGANIZATION_STRUCTURE[deptId];
                                                    if (!dept?.departments) return null;
                                                    return Object.values(dept.departments).map(sub => {
                                                        const isSelected = formData.subdepartment?.includes(sub.id);
                                                        return (
                                                            <div key={sub.id} onClick={() => toggleSubDepartment(sub.id)} className={`cursor-pointer p-4 rounded-2xl border transition-all flex justify-between items-center group ${isSelected ? 'border-amber-500 bg-amber-50/50 shadow-md' : 'border-slate-100 hover:border-amber-300 hover:bg-slate-50'}`}>
                                                                <div><div className={`text-sm font-bold ${isSelected ? 'text-amber-900' : 'text-slate-700'}`}>{sub.name}</div><div className="text-[10px] text-slate-400 font-medium mt-0.5">{dept.name.split('.')[0]} • {sub.manager}</div></div>
                                                                {isSelected && <CheckCircle2 size={20} className="text-amber-500" fill="#fff"/>}
                                                            </div>
                                                        );
                                                    });
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    )}
                    
                    {activeTab === 'contacts' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2"><div className="w-1.5 h-6 bg-purple-500 rounded-full"></div> Контакты & Адреса</h3>
                            <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className={labelClass}>Телефон</label><input name="phone" value={formData.phone} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>WhatsApp</label><input name="whatsapp" value={formData.whatsapp} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Email (Рабочий)</label><input name="email" value={formData.email} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Email (Личный)</label><input name="email2" value={formData.email2} onChange={handleChange} className={inputClass} /></div>
                            </div>
                            <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                                <div><label className={labelClass}>Фактический адрес</label><textarea name="actual_address" value={formData.actual_address || ''} onChange={handleChange} className={inputClass + " h-24"} /></div>
                                <div><label className={labelClass}>Адрес регистрации</label><textarea name="registration_address" value={formData.registration_address || ''} onChange={handleChange} className={inputClass + " h-24"} /></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'docs' && !isReadOnly && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4"><h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2"><div className="w-1.5 h-6 bg-slate-600 rounded-full"></div> Паспортные Данные</h3><div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm"><label className={labelClass}>ИНН</label><input name="inn" value={formData.inn} onChange={handleChange} className={inputClass + " font-mono text-lg tracking-widest"} placeholder="000000000000" /></div><div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm"><h4 className="font-bold text-slate-700 mb-4 border-b pb-2">Внутренний Паспорт</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className={labelClass}>Серия и Номер</label><input name="passport_number" value={formData.passport_number} onChange={handleChange} className={inputClass} /></div><div><label className={labelClass}>Дата Выдачи</label><input type="date" name="passport_date" value={formData.passport_date} onChange={handleChange} className={inputClass} /></div><div className="md:col-span-2"><label className={labelClass}>Кем Выдан</label><textarea name="passport_issuer" value={formData.passport_issuer} onChange={handleChange} className={inputClass + " h-16"} /></div></div></div><div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm"><h4 className="font-bold text-slate-700 mb-4 border-b pb-2">Заграничный Паспорт</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className={labelClass}>Номер</label><input name="foreign_passport" value={formData.foreign_passport} onChange={handleChange} className={inputClass} /></div><div><label className={labelClass}>Годен до / Дата выдачи</label><input name="foreign_passport_date" value={formData.foreign_passport_date} onChange={handleChange} className={inputClass} /></div><div className="md:col-span-2"><label className={labelClass}>Authority (Кем выдан)</label><input name="foreign_passport_issuer" value={formData.foreign_passport_issuer} onChange={handleChange} className={inputClass} /></div></div></div></div>
                    )}
                    
                    {activeTab === 'finance' && !isReadOnly && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4"><h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2"><div className="w-1.5 h-6 bg-green-500 rounded-full"></div> Финансы</h3><div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm"><div className="space-y-4"><div><label className={labelClass}>Название Банка</label><input name="bank_name" value={formData.bank_name} onChange={handleChange} className={inputClass} /></div><div><label className={labelClass}>Реквизиты</label><textarea name="bank_details" value={formData.bank_details} onChange={handleChange} className={inputClass + " h-24 font-mono text-sm"} /></div></div></div><div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className={labelClass}>Крипто-сеть</label><input name="crypto_network" value={formData.crypto_network} onChange={handleChange} className={inputClass} /></div><div><label className={labelClass}>Валюта</label><input name="crypto_currency" value={formData.crypto_currency} onChange={handleChange} className={inputClass} /></div><div className="md:col-span-2"><label className={labelClass}>Адрес Кошелька</label><input name="crypto_wallet" value={formData.crypto_wallet} onChange={handleChange} className={inputClass + " font-mono text-xs"} /></div></div></div>
                    )}

                    {activeTab === 'files' && !isReadOnly && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3 text-blue-700 mb-2">
                                <Lock size={20} className="flex-shrink-0" />
                                <span className="text-sm font-medium">Эти документы защищены и доступны только вам и уполномоченным сотрудникам HR.</span>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-slate-700 flex items-center gap-2"><FileText size={18}/> Документы Сотрудника</h4>
                                    <button type="button" onClick={() => docInputRef.current?.click()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"><Plus size={14}/> Добавить документ</button>
                                    <input type="file" ref={docInputRef} onChange={(e) => handleFileUpload(e, false)} className="hidden" multiple />
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
                                    <table className="w-full text-sm text-left min-w-[500px]">
                                        <thead className="bg-blue-700 text-white font-semibold">
                                            <tr><th className="px-4 py-3 w-1/3">Название документа</th><th className="px-4 py-3">Дата</th><th className="px-4 py-3">Номер (ID)</th><th className="px-4 py-3 text-right">Действия</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {formData.attachments.length === 0 ? (<tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">Нет загруженных документов</td></tr>) : (formData.attachments.map(att => (<tr key={att.id} className="hover:bg-slate-50 transition-colors"><td className="px-4 py-3 font-medium text-slate-700">{att.file_name}</td><td className="px-4 py-3 text-slate-600">{format(new Date(att.uploaded_at), 'dd.MM.yyyy')}</td><td className="px-4 py-3 text-slate-500 font-mono text-xs">{att.id.substring(0,8).toUpperCase()}</td><td className="px-4 py-3 text-right flex justify-end gap-2"><a href={att.public_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"><DownloadCloud size={14}/> Скачать</a><button type="button" onClick={() => removeAttachment(att.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"><Trash2 size={16}/></button></td></tr>)))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-center mb-4"><h4 className="font-bold text-slate-700 flex items-center gap-2"><HeartPulse size={18}/> Экстренные Контакты</h4><button type="button" onClick={addEmergencyContact} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors"><Plus size={14}/> Добавить</button></div>
                                {formData.emergency_contacts.length === 0 ? (<div className="p-4 text-center bg-slate-50 rounded-2xl text-slate-400 text-sm">Контакты не указаны</div>) : (<div className="space-y-3">{formData.emergency_contacts.map((contact, idx) => (<div key={idx} className="flex flex-col md:flex-row gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 relative group"><div className="flex-1"><label className="text-[10px] uppercase font-bold text-slate-400">Имя</label><input value={contact.name} onChange={(e) => handleEmergencyChange(idx, 'name', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-medium" placeholder="Имя Фамилия" /></div><div className="w-full md:w-32"><label className="text-[10px] uppercase font-bold text-slate-400">Кто это</label><input value={contact.relation} onChange={(e) => handleEmergencyChange(idx, 'relation', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-medium" placeholder="Жена, Брат..." /></div><div className="flex-1"><label className="text-[10px] uppercase font-bold text-slate-400">Телефон</label><input value={contact.phone} onChange={(e) => handleEmergencyChange(idx, 'phone', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-medium" placeholder="+7..." /></div><button type="button" onClick={() => removeEmergencyContact(idx)} className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button></div>))}</div>)}
                            </div>
                             <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm"><h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><File size={18}/> Заметки / Дополнительная Информация</h4><textarea name="additional_info" value={formData.additional_info || ''} onChange={handleChange} className={inputClass + " h-32"} placeholder="Произвольные заметки о сотруднике, наблюдения, история..." /></div>
                        </div>
                    )}

                    {/* TAB: STATS (VISIBLE TO ALL, EDITABLE BY ADMIN) */}
                    {activeTab === 'stats' && (
                        isNewEmployee ? (
                            <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 animate-in fade-in">
                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                    <Save size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Сохраните сотрудника</h3>
                                <p className="text-slate-500 max-w-sm mx-auto mb-6 text-sm">
                                    Для управления статистикой и KPI необходимо сначала создать карточку сотрудника в базе данных.
                                </p>
                                <button type="button" onClick={handleSubmit} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2">
                                    <Save size={18} />
                                    Сохранить и продолжить
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 relative">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-4">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div> Личная Статистика и KPI</h3>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto w-full sm:w-auto">
                                            {PERIODS.map(p => (
                                                <button key={p.id} type="button" onClick={() => setStatsPeriod(p.id)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${statsPeriod === p.id ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>{p.label}</button>
                                            ))}
                                        </div>
                                        {!isReadOnly && (
                                            <button 
                                                type="button" 
                                                onClick={() => { setShowStatManager(!showStatManager); }} 
                                                className={`p-2 rounded-xl transition-all border flex-shrink-0 ${showStatManager ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50'}`} 
                                                title="Управление статистиками"
                                            >
                                                <Plus size={20}/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                {/* STATS MANAGER (Add/Assign) - Only visible if !isReadOnly */}
                                {showStatManager && !isReadOnly && (
                                    <div className="bg-white p-6 rounded-3xl border-2 border-blue-100 shadow-lg mb-6 animate-in slide-in-from-top-4 relative z-10">
                                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                                            <h4 className="font-bold text-slate-800">Добавить Статистику</h4>
                                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                                <button type="button" onClick={() => setStatManagerMode('assign')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${statManagerMode === 'assign' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Выбрать из базы</button>
                                                <button type="button" onClick={() => setStatManagerMode('create')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${statManagerMode === 'create' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Создать с нуля</button>
                                            </div>
                                        </div>

                                        {/* MODE: CREATE FRESH */}
                                        {statManagerMode === 'create' && (
                                            <div className="space-y-3">
                                                <input 
                                                    type="text"
                                                    value={newStatData.title} 
                                                    onChange={e => setNewStatData({...newStatData, title: e.target.value})} 
                                                    placeholder="Название (например: Личные продажи)" 
                                                    className="w-full px-4 py-3 border border-slate-300 bg-white text-slate-900 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                                                />
                                                <input 
                                                    type="text"
                                                    value={newStatData.description} 
                                                    onChange={e => setNewStatData({...newStatData, description: e.target.value})} 
                                                    placeholder="Описание (что измеряем)" 
                                                    className="w-full px-4 py-3 border border-slate-300 bg-white text-slate-900 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" 
                                                />
                                                <div className="flex gap-4">
                                                    <label className="flex items-center gap-2 text-sm text-slate-600 font-medium cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border border-slate-200"><input type="checkbox" checked={newStatData.inverted} onChange={e => setNewStatData({...newStatData, inverted: e.target.checked})} className="rounded text-blue-600"/> Обратная</label>
                                                    <label className="flex items-center gap-2 text-sm text-slate-600 font-medium cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border border-slate-200"><input type="checkbox" checked={newStatData.is_double} onChange={e => setNewStatData({...newStatData, is_double: e.target.checked})} className="rounded text-blue-600"/> Двойная</label>
                                                </div>
                                                <button type="button" onClick={() => handleCreatePersonalStat()} className="w-full py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">Создать Личную Статистику</button>
                                            </div>
                                        )}

                                        {/* MODE: ASSIGN FROM DEPT (CLONE) */}
                                        {statManagerMode === 'assign' && (
                                            <div className="space-y-4">
                                                <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-800 border border-blue-100 flex items-start gap-2">
                                                    <Info size={16} className="flex-shrink-0 mt-0.5"/>
                                                    <span>
                                                        Выберите статистику подразделения. Будет создана <strong>личная копия</strong> для сотрудника, показатели которой в будущем будут суммироваться в общую статистику отдела.
                                                    </span>
                                                </div>

                                                {departmentStats.length === 0 ? (
                                                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl">
                                                        <p className="text-slate-400 text-sm italic mb-2">Нет доступных статистик для выбранных департаментов.</p>
                                                        <p className="text-slate-400 text-xs">Убедитесь, что сотрудник добавлен в отдел, и у отдела есть созданные статистики.</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                                                        {departmentStats.map((group, idx) => (
                                                            <div key={idx}>
                                                                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                                    <Layers size={12}/> {group.deptName}
                                                                </h5>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    {group.stats.map(stat => (
                                                                        <button 
                                                                            key={stat.id}
                                                                            type="button"
                                                                            onClick={() => handleCreatePersonalStat(stat)}
                                                                            className="flex items-center justify-between p-3 bg-slate-50 hover:bg-white hover:shadow-md border border-slate-200 rounded-xl text-left transition-all group"
                                                                        >
                                                                            <div>
                                                                                <div className="font-bold text-slate-700 text-sm">{stat.title}</div>
                                                                                <div className="text-[10px] text-slate-400 line-clamp-1">{stat.description || 'Нет описания'}</div>
                                                                            </div>
                                                                            <div className="bg-white p-1.5 rounded-lg text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                                                                                <Plus size={14}/>
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Editing Modal (Inline) - Only visible if !isReadOnly */}
                                {editingStatId && !isReadOnly && (
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-blue-200 mb-4 animate-in fade-in">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-bold text-blue-800 text-sm">Редактирование статистики</h4>
                                            <button onClick={() => setEditingStatId(null)}><X size={16} className="text-slate-400 hover:text-slate-600"/></button>
                                        </div>
                                        <div className="space-y-3">
                                            <input value={newStatData.title} onChange={e => setNewStatData({...newStatData, title: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold" placeholder="Название" />
                                            <input value={newStatData.description} onChange={e => setNewStatData({...newStatData, description: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Описание" />
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={newStatData.inverted} onChange={e => setNewStatData({...newStatData, inverted: e.target.checked})}/> Обратная</label>
                                                <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={newStatData.is_double} onChange={e => setNewStatData({...newStatData, is_double: e.target.checked})}/> Двойная</label>
                                            </div>
                                            <button onClick={handleUpdateStat} className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">Сохранить изменения</button>
                                        </div>
                                    </div>
                                )}

                                {statsDefinitions.length === 0 && !isDemoStats && (
                                    <div className="text-center py-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
                                        <TrendingUp className="mx-auto text-slate-300 mb-2" size={32}/>
                                        <p className="text-slate-500 font-medium text-sm">Нет назначенных статистик</p>
                                        {!isReadOnly && <button type="button" onClick={() => setShowStatManager(true)} className="mt-2 text-blue-600 font-bold text-xs hover:underline">Добавить статистику</button>}
                                    </div>
                                )}

                                {statsDefinitions.map(stat => {
                                    if (!stat) return null;
                                    const vals = getFilteredValues(stat.id);
                                    const { slope, change, current } = analyzeTrend(vals, stat.inverted);
                                    const isSlopeUp = slope > 0;
                                    let isPositiveOutcome = isSlopeUp;
                                    if(stat.inverted) isPositiveOutcome = !isSlopeUp;

                                    const trendColorHex = isPositiveOutcome ? "#10b981" : "#f43f5e";
                                    return (
                                        <div key={stat.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow relative group">
                                            <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-start bg-white">
                                                {/* ... Header content ... */}
                                                <div className="flex-1 pr-4">
                                                    <div className="flex items-start gap-2 mb-1">
                                                        <h4 className="font-bold text-lg text-slate-800 leading-tight">{stat.title}</h4>
                                                        <button type="button" onClick={() => setInfoStatId(infoStatId === stat.id ? null : stat.id)} className="text-slate-300 hover:text-blue-600 transition-colors mt-0.5"><Info size={16} /></button>
                                                    </div>
                                                    {stat.inverted && (<div className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider mb-1.5"><ArrowDownUp size={10} /> ОБРАТНАЯ</div>)}
                                                    <p className="text-xs text-slate-500 font-medium line-clamp-2">{stat.description || 'Личный показатель эффективности'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{current.toLocaleString()}</div>
                                                    {vals.length > 1 && (
                                                        <div className={`text-xs font-bold flex items-center justify-end gap-1 mt-1 px-2 py-0.5 rounded-lg ${isPositiveOutcome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                            {slope >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                                                            {Math.abs(change * 100).toFixed(1)}%
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Edit / Delete Controls - Only if !isReadOnly */}
                                                {!isReadOnly && (
                                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-20">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => startEditing(stat)}
                                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Редактировать"
                                                        >
                                                            <Edit2 size={14}/>
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleDeleteStatRequest(stat.id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Удалить статистику и данные"
                                                        >
                                                            <Trash2 size={14}/>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="px-4 md:px-6 pb-2 pt-4 h-56 md:h-64 bg-white relative z-0">
                                                <StatsChart key={statsPeriod} values={vals} inverted={stat.inverted} color={trendColorHex} isDouble={stat.is_double} />
                                            </div>
                                            
                                            {/* Footer - Only if !isReadOnly */}
                                            {!isReadOnly && (
                                                <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                                                    <div className="flex justify-between items-center">
                                                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ввод данных</div>
                                                        <div className="text-[10px] text-slate-400 font-medium">Посл: {vals.length > 0 ? format(new Date(vals[vals.length-1].date), 'dd.MM') : '-'}</div>
                                                    </div>
                                                    
                                                    <div className="flex flex-wrap items-end gap-2 w-full">
                                                        <div className="relative flex-shrink-0">
                                                            <label className="block text-[8px] font-bold text-slate-400 mb-1 uppercase">Дата (Чт)</label>
                                                            <input type="date" value={newStatDate} onChange={e => setNewStatDate(e.target.value)} className="h-9 px-2 border border-slate-200 rounded-lg text-xs font-medium bg-white text-slate-700 focus:border-blue-300 outline-none w-28" />
                                                        </div>
                                                        
                                                        <div className="flex-1 min-w-[80px]">
                                                             <label className="block text-[8px] font-bold text-slate-400 mb-1 uppercase">Значение</label>
                                                             <input 
                                                                type="number" 
                                                                placeholder="0" 
                                                                value={newValueInput[stat.id] || ''} 
                                                                onChange={e => setNewValueInput({...newValueInput, [stat.id]: e.target.value})} 
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        handleAddValue(stat.id, stat.is_double || false);
                                                                    }
                                                                }}
                                                                className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-blue-300 placeholder:font-normal" 
                                                             />
                                                        </div>

                                                        {stat.is_double && (
                                                            <div className="flex-1 min-w-[80px]">
                                                                <label className="block text-[8px] font-bold text-slate-400 mb-1 uppercase">Вал 2</label>
                                                                <input 
                                                                    type="number" 
                                                                    placeholder="0" 
                                                                    value={newValueInput2[stat.id] || ''} 
                                                                    onChange={e => setNewValueInput2({...newValueInput2, [stat.id]: e.target.value})} 
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            handleAddValue(stat.id, stat.is_double || false);
                                                                        }
                                                                    }}
                                                                    className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-blue-300 placeholder:font-normal" 
                                                                />
                                                            </div>
                                                        )}

                                                        <button type="button" onClick={() => handleAddValue(stat.id, stat.is_double || false)} className="h-9 px-4 bg-white border border-slate-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-sm ml-auto"><Plus size={16}/> <span className="hidden sm:inline">Добавить</span></button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </form>
            </div>
        </div>
      </div>
      
      {/* Confirmation Modal at highest level */}
      <ConfirmationModal 
            isOpen={confirmModal.isOpen}
            title={confirmModal.title}
            message={confirmModal.message}
            onConfirm={confirmModal.onConfirm}
            onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            isDanger={true}
            confirmLabel="Удалить"
      />
    </div>
  );
};

export default EmployeeModal;
