
import React, { useState, useEffect, useRef } from 'react';
import { ORGANIZATION_STRUCTURE, ROLE_STAT_TEMPLATES, HANDBOOK_STATISTICS } from '../constants';
import { X, Save, Upload, FileText, Trash2, Plus, TrendingUp, TrendingDown, CheckCircle2, Printer, Download, Link as LinkIcon, Image as ImageIcon, Calendar, Info, HelpCircle, ArrowDownUp, AlertCircle, Phone, User, HeartPulse, File, Lock, DownloadCloud, Link2, Unlink, Sparkles, Copy, Edit2, Layers, Loader2, Minus, Wallet, CreditCard, Landmark, Globe, List } from 'lucide-react';
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
    if (!vals || vals.length === 0) {
        return { current: 0, prev: 0, delta: 0, percent: 0, direction: 'flat' as const, isGood: true };
    }

    const sorted = [...vals].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const n = sorted.length;

    // Use PERIOD Based Trend (End vs Start)
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
  const [statsPeriod, setStatsPeriod] = useState<string>('3w');
  const [newValueInput, setNewValueInput] = useState<Record<string, string>>({}); // {statId: value}
  const [newValueInput2, setNewValueInput2] = useState<Record<string, string>>({}); // {statId: value2}
  const [infoStatId, setInfoStatId] = useState<string | null>(null); // For overlay description
  const [newStatDate, setNewStatDate] = useState<string>(getNearestThursday());
  
  // Stat Management State (Create/Assign)
  const [showStatManager, setShowStatManager] = useState(false);
  const [newStatData, setNewStatData] = useState({ title: '', description: '', inverted: false, is_double: false, calculation_method: '' });
  
  // Editing State
  const [editingStatId, setEditingStatId] = useState<string | null>(null);
  const [historyStatId, setHistoryStatId] = useState<string | null>(null); // NEW: To show history modal

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
      setStatsPeriod('3w');
      setInfoStatId(null);
      setShowStatManager(false);
      setEditingStatId(null);
      setHistoryStatId(null);
      setNewStatDate(getNearestThursday());
    }
  }, [isOpen, initialData?.id]);

  const fetchPersonalStats = async (empId: string) => {
      setIsLoadingStats(true);
      setIsDemoStats(false);
      
      let foundData = false;
      if (supabase) {
          const { data: defs, error: defsError } = await supabase.from('statistics_definitions').select('*').eq('owner_id', empId);
          if (defsError) {
              console.error('[EmployeeModal] fetchPersonalStats defs error:', defsError.message);
          } else if (defs && defs.length > 0) {
              setStatsDefinitions(defs);
              const ids = defs.map(d => d.id);
              const { data: vals, error: valsError } = await supabase.from('statistics_values').select('*').in('definition_id', ids).order('date', { ascending: true });
              if (valsError) console.error('[EmployeeModal] fetchPersonalStats vals error:', valsError.message);
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
                setShowStatManager(false);
                setNewStatData({ title: '', description: '', inverted: false, is_double: false, calculation_method: '' });
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

  const handleDeleteValue = async (valId: string) => {
      if(!confirm("Удалить это значение?")) return;
      if (!supabase) {
          setStatsValues(prev => prev.filter(v => v.id !== valId));
          return;
      }
      const { error } = await supabase.from('statistics_values').delete().eq('id', valId);
      if(!error) {
          setStatsValues(prev => prev.filter(v => v.id !== valId));
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
      {/* ... (Modal Header & Tabs - Preserved) ... */}
      <div className="bg-white rounded-none md:rounded-3xl shadow-2xl w-full max-w-6xl h-full md:h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        <div className="flex justify-between items-center px-4 md:px-8 py-3 md:py-5 border-b border-gray-100 bg-white flex-shrink-0">
          <div className="min-w-0 pr-2">
              <h2 className="text-lg md:text-2xl font-bold text-slate-800 truncate leading-tight">{isReadOnly ? 'Сотрудник' : (initialData ? 'Редактирование' : 'Новый')}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 md:hidden">
                  <span>{formData.id.substring(0,6)}...</span>
              </div>
              <div className="items-center gap-2 text-sm text-slate-500 mt-0.5 hidden md:flex">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono text-slate-600">{formData.id.substring(0,8)}</span>
                  <span>• Личное дело {isReadOnly && '(Только чтение)'}</span>
              </div>
          </div>
          <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-3 md:px-5 py-2 md:py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">{isReadOnly ? 'Закрыть' : 'Отмена'}</button>
              {!isReadOnly && (
                  <button type="button" onClick={handleSubmit} disabled={isUploading} className={`px-3 md:px-6 py-2 md:py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 flex items-center gap-2 transition-all ${isUploading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700 hover:-translate-y-0.5'}`}>
                    {isUploading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />} 
                    <span className="hidden md:inline">Сохранить</span>
                  </button>
              )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden bg-slate-50/50">
            <div className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-2 md:p-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shadow-[0_4px_12px_-6px_rgba(0,0,0,0.1)] md:shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] z-10 custom-scrollbar flex-shrink-0 sticky top-0">
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
                        <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex-shrink-0 w-auto md:w-full text-left px-3 md:px-4 py-2 md:py-3.5 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-between group whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                            <span className="flex items-center gap-2">{tab.label}</span>
                            {tab.icon && <span className={`hidden md:block ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}`}>{tab.icon}</span>}
                        </button>
                    )
                })}
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <form className="max-w-4xl mx-auto space-y-8 pb-20" onSubmit={(e) => e.preventDefault()}>
                    {/* ... (Other Tabs Hidden for Brevity - They are preserved in real DOM) ... */}
                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <section>
                                <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2"><div className="w-1.5 h-6 bg-blue-500 rounded-full"></div> Личные Данные</h3>
                                <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                    <div className="md:col-span-2 flex justify-center mb-4">
                                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-slate-100 shadow-lg overflow-hidden bg-slate-200 relative group">
                                            {formData.photo_url ? (<img src={formData.photo_url} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { if (e.currentTarget.src.startsWith('https://ui-avatars.com')) return; e.currentTarget.src = `https://ui-avatars.com/api/?name=${formData.full_name}&background=f1f5f9&color=64748b`; }}/>) : (<div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100"><User size={32}/></div>)}
                                            <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Upload size={24} /></button>
                                            <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e, true)} className="hidden" accept="image/*" />
                                        </div>
                                    </div>
                                    <div><label className={labelClass}>ФИО (Полностью)</label><input name="full_name" value={formData.full_name} onChange={handleChange} className={inputClass} placeholder="Иванов Иван Иванович" /></div>
                                    <div><label className={labelClass}>Должность</label><input name="position" value={formData.position} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Дата Рождения</label><input type="date" name="birth_date" value={formData.birth_date || ''} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Дата Приема</label><input type="date" name="join_date" value={formData.join_date || ''} onChange={handleChange} className={inputClass} /></div>
                                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                         <div><label className={labelClass}>Системный NIK</label><input name="nickname" value={formData.nickname || ''} onChange={handleChange} className={inputClass} placeholder="ivan_hr" /></div>
                                         <div><label className={labelClass}>Telegram (Username)</label><input name="telegram" value={formData.telegram || ''} onChange={handleChange} className={inputClass} placeholder="@username" /></div>
                                    </div>
                                </div>
                            </section>
                            {/* ... Org Structure Section ... */}
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
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <section>
                                <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2"><Phone className="text-emerald-500" size={20}/> Контактная Информация</h3>
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><label className={labelClass}>Мобильный телефон</label><input name="phone" value={formData.phone} onChange={handleChange} className={inputClass} placeholder="+1 234 567 8900" /></div>
                                    <div><label className={labelClass}>WhatsApp</label><input name="whatsapp" value={formData.whatsapp || ''} onChange={handleChange} className={inputClass} placeholder="+1 234 567 8900" /></div>
                                    <div><label className={labelClass}>Telegram</label><input name="telegram" value={formData.telegram || ''} onChange={handleChange} className={inputClass} placeholder="@username" /></div>
                                    <div><label className={labelClass}>Email (Рабочий)</label><input name="email" value={formData.email || ''} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Email (Личный)</label><input name="email2" value={formData.email2 || ''} onChange={handleChange} className={inputClass} /></div>
                                    <div className="md:col-span-2"><label className={labelClass}>Фактический адрес</label><input name="actual_address" value={formData.actual_address || ''} onChange={handleChange} className={inputClass} /></div>
                                    <div className="md:col-span-2"><label className={labelClass}>Адрес регистрации</label><input name="registration_address" value={formData.registration_address || ''} onChange={handleChange} className={inputClass} /></div>
                                </div>
                            </section>
                            
                            <section>
                                <div className="flex justify-between items-center mb-5">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><HeartPulse className="text-rose-500" size={20}/> Экстренные Контакты</h3>
                                    {!isReadOnly && <button type="button" onClick={addEmergencyContact} className="text-xs bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg font-bold hover:bg-rose-100 transition-colors">+ Добавить</button>}
                                </div>
                                <div className="space-y-4">
                                    {formData.emergency_contacts.map((contact, index) => (
                                        <div key={index} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end md:items-center">
                                            <div className="flex-1 w-full"><label className={labelClass}>Имя</label><input value={contact.name} onChange={(e) => handleEmergencyChange(index, 'name', e.target.value)} className={inputClass} /></div>
                                            <div className="flex-1 w-full"><label className={labelClass}>Кем приходится</label><input value={contact.relation} onChange={(e) => handleEmergencyChange(index, 'relation', e.target.value)} className={inputClass} /></div>
                                            <div className="flex-1 w-full"><label className={labelClass}>Телефон</label><input value={contact.phone} onChange={(e) => handleEmergencyChange(index, 'phone', e.target.value)} className={inputClass} /></div>
                                            {!isReadOnly && <button type="button" onClick={() => removeEmergencyContact(index)} className="p-3 text-red-400 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={18}/></button>}
                                        </div>
                                    ))}
                                    {formData.emergency_contacts.length === 0 && <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm">Нет экстренных контактов</div>}
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'docs' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <section>
                                <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2"><FileText className="text-blue-500" size={20}/> Паспортные Данные</h3>
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2"><label className={labelClass}>ИНН</label><input name="inn" value={formData.inn || ''} onChange={handleChange} className={inputClass} /></div>
                                    <div className="md:col-span-2 border-t border-slate-100 my-2"></div>
                                    <h4 className="md:col-span-2 text-sm font-bold text-slate-800 uppercase tracking-wider">Внутренний паспорт</h4>
                                    <div><label className={labelClass}>Серия и номер</label><input name="passport_number" value={formData.passport_number || ''} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Дата выдачи</label><input type="date" name="passport_date" value={formData.passport_date || ''} onChange={handleChange} className={inputClass} /></div>
                                    <div className="md:col-span-2"><label className={labelClass}>Кем выдан</label><input name="passport_issuer" value={formData.passport_issuer || ''} onChange={handleChange} className={inputClass} /></div>
                                    
                                    <div className="md:col-span-2 border-t border-slate-100 my-2"></div>
                                    <h4 className="md:col-span-2 text-sm font-bold text-slate-800 uppercase tracking-wider">Заграничный паспорт</h4>
                                    <div><label className={labelClass}>Номер</label><input name="foreign_passport" value={formData.foreign_passport || ''} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Срок действия</label><input type="date" name="foreign_passport_date" value={formData.foreign_passport_date || ''} onChange={handleChange} className={inputClass} /></div>
                                    <div className="md:col-span-2"><label className={labelClass}>Кем выдан / Орган</label><input name="foreign_passport_issuer" value={formData.foreign_passport_issuer || ''} onChange={handleChange} className={inputClass} /></div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'finance' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <section>
                                <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2"><Wallet className="text-indigo-500" size={20}/> Финансовые Реквизиты</h3>
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div><label className={labelClass}>Банк</label><div className="relative"><Landmark className="absolute left-3 top-3 text-slate-400" size={16}/><input name="bank_name" value={formData.bank_name || ''} onChange={handleChange} className={`${inputClass} pl-10`} placeholder="Kasikorn Bank" /></div></div>
                                        <div><label className={labelClass}>Номер счета / Карты</label><div className="relative"><CreditCard className="absolute left-3 top-3 text-slate-400" size={16}/><input name="bank_details" value={formData.bank_details || ''} onChange={handleChange} className={`${inputClass} pl-10`} /></div></div>
                                    </div>
                                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2 flex items-center gap-2 text-indigo-800 font-bold text-sm mb-2"><Globe size={16}/> Крипто-кошелек</div>
                                        <div><label className={labelClass}>Адрес кошелька</label><input name="crypto_wallet" value={formData.crypto_wallet || ''} onChange={handleChange} className={inputClass} placeholder="0x..." /></div>
                                        <div><label className={labelClass}>Сеть (Network)</label><input name="crypto_network" value={formData.crypto_network || ''} onChange={handleChange} className={inputClass} placeholder="TRC20, BEP20..." /></div>
                                        <div><label className={labelClass}>Валюта</label><input name="crypto_currency" value={formData.crypto_currency || ''} onChange={handleChange} className={inputClass} placeholder="USDT" /></div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'files' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <section>
                                <div className="flex justify-between items-center mb-5">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><File className="text-slate-500" size={20}/> Файлы и Документы</h3>
                                    {!isReadOnly && <button type="button" onClick={() => docInputRef.current?.click()} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100 transition-colors flex items-center gap-2"><Upload size={14}/> Загрузить</button>}
                                    <input type="file" ref={docInputRef} onChange={(e) => handleFileUpload(e)} className="hidden" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {formData.attachments.map(file => (
                                        <div key={file.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 group hover:border-blue-300 transition-all">
                                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 font-bold uppercase text-[10px]">{file.file_type.split('/')[1] || 'FILE'}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-slate-800 truncate" title={file.file_name}>{file.file_name}</div>
                                                <div className="text-[10px] text-slate-400">{format(new Date(file.uploaded_at), 'dd.MM.yyyy')} • {(file.file_size / 1024).toFixed(0)} KB</div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <a href={file.public_url} target="_blank" rel="noreferrer" className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><DownloadCloud size={16}/></a>
                                                {!isReadOnly && <button type="button" onClick={() => removeAttachment(file.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>}
                                            </div>
                                        </div>
                                    ))}
                                    {formData.attachments.length === 0 && <div className="col-span-full text-center p-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400"><p className="font-medium">Нет загруженных файлов</p></div>}
                                </div>
                            </section>
                        </div>
                    )}

                    {/* TAB: STATS (VISIBLE TO ALL, EDITABLE BY ADMIN) */}
                    {activeTab === 'stats' && (
                        isNewEmployee ? (
                            <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 animate-in fade-in">
                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4"><Save size={32} /></div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Сохраните сотрудника</h3>
                                <p className="text-slate-500 max-w-sm mx-auto mb-6 text-sm">Для управления статистикой и KPI необходимо сначала создать карточку сотрудника в базе данных.</p>
                                <button type="button" onClick={handleSubmit} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2"><Save size={18} /> Сохранить и продолжить</button>
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
                                            <button type="button" onClick={() => { setShowStatManager(!showStatManager); }} className={`p-2 rounded-xl transition-all border flex-shrink-0 ${showStatManager ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50'}`} title="Управление статистиками"><Plus size={20}/></button>
                                        )}
                                    </div>
                                </div>
                                
                                {/* --- STAT MANAGER (Assign/Create) --- */}
                                {showStatManager && !isReadOnly && (
                                    <div className="bg-white p-6 rounded-3xl border-2 border-blue-100 shadow-lg mb-6 animate-in slide-in-from-top-4 relative z-10">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wide">Добавление статистики</h4>
                                            <button type="button" onClick={() => setShowStatManager(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Column 1: Templates */}
                                            <div className="border-r border-slate-100 pr-8">
                                                <h5 className="text-xs font-bold text-slate-500 mb-3 uppercase">Быстрый выбор из шаблонов</h5>
                                                <div className="space-y-2">
                                                    {(() => {
                                                        const subDeptId = formData.subdepartment?.[0];
                                                        const deptId = formData.department?.[0];
                                                        
                                                        // Priority: Specific Stats from Handbook -> Specific Role Templates -> Generic Fallbacks
                                                        let templates: any[] = [];
                                                        
                                                        // 1. Try to find actual statistics defined in handbook for this sub-department
                                                        if (subDeptId) {
                                                            const handbookStats = HANDBOOK_STATISTICS.filter(s => s.owner_id === subDeptId);
                                                            if (handbookStats.length > 0) {
                                                                templates = handbookStats.map(s => ({...s}));
                                                            }
                                                        }

                                                        // 2. Fallback to ROLE_STAT_TEMPLATES if handbook is empty for this role
                                                        if (templates.length === 0 && subDeptId && ROLE_STAT_TEMPLATES[subDeptId]) {
                                                            templates = ROLE_STAT_TEMPLATES[subDeptId];
                                                        }

                                                        // 3. Last resort fallback
                                                        if (templates.length === 0) {
                                                            templates = [{ title: 'Личная эффективность' }, { title: 'Завершенные задачи' }];
                                                        }
                                                        
                                                        return templates.map((tmpl, idx) => (
                                                            <button 
                                                                key={idx} 
                                                                type="button" 
                                                                onClick={() => handleCreatePersonalStat(tmpl)}
                                                                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center justify-between group"
                                                            >
                                                                <div className="flex-1 min-w-0 pr-2">
                                                                    <div className="text-sm font-bold text-slate-700 group-hover:text-blue-700 truncate">{tmpl.title}</div>
                                                                    <div className="text-[10px] text-slate-400 truncate">{tmpl.description || 'Стандартная статистика'}</div>
                                                                </div>
                                                                <Plus size={16} className="text-slate-300 group-hover:text-blue-500 flex-shrink-0" />
                                                            </button>
                                                        ));
                                                    })()}
                                                </div>
                                            </div>

                                            {/* Column 2: Custom */}
                                            <div>
                                                <h5 className="text-xs font-bold text-slate-500 mb-3 uppercase">Создать новую</h5>
                                                <div className="space-y-3">
                                                    <input 
                                                        value={newStatData.title} 
                                                        onChange={e => setNewStatData({...newStatData, title: e.target.value})}
                                                        placeholder="Название статистики" 
                                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none"
                                                    />
                                                    <textarea 
                                                        value={newStatData.description} 
                                                        onChange={e => setNewStatData({...newStatData, description: e.target.value})}
                                                        placeholder="Описание и метод подсчета..." 
                                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm min-h-[80px] focus:ring-2 focus:ring-blue-100 outline-none"
                                                    />
                                                    <div className="flex gap-4">
                                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                                                            <input type="checkbox" checked={newStatData.inverted} onChange={e => setNewStatData({...newStatData, inverted: e.target.checked})} className="rounded text-blue-600" /> Обратная
                                                        </label>
                                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                                                            <input type="checkbox" checked={newStatData.is_double} onChange={e => setNewStatData({...newStatData, is_double: e.target.checked})} className="rounded text-blue-600" /> Двойная
                                                        </label>
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleCreatePersonalStat()} 
                                                        disabled={!newStatData.title}
                                                        className="w-full py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all"
                                                    >
                                                        Создать
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* --- EDIT STAT MODAL (INLINE) --- */}
                                {editingStatId && !isReadOnly && (
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-blue-200 mb-4 animate-in fade-in relative z-20">
                                         <div className="flex justify-between items-center mb-3">
                                            <h4 className="text-xs font-bold text-blue-800 uppercase">Редактирование статистики</h4>
                                            <button type="button" onClick={() => setEditingStatId(null)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
                                         </div>
                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                             <input value={newStatData.title} onChange={e => setNewStatData({...newStatData, title: e.target.value})} className="p-2 border rounded-lg text-sm font-bold" />
                                             <input value={newStatData.calculation_method} onChange={e => setNewStatData({...newStatData, calculation_method: e.target.value})} className="p-2 border rounded-lg text-sm" placeholder="Ед. измерения" />
                                             <textarea value={newStatData.description} onChange={e => setNewStatData({...newStatData, description: e.target.value})} className="md:col-span-2 p-2 border rounded-lg text-sm" placeholder="Описание" />
                                             <div className="flex gap-4 md:col-span-2">
                                                 <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={newStatData.inverted} onChange={e => setNewStatData({...newStatData, inverted: e.target.checked})}/> Обратная</label>
                                                 <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={newStatData.is_double} onChange={e => setNewStatData({...newStatData, is_double: e.target.checked})}/> Двойная</label>
                                             </div>
                                             <button type="button" onClick={handleUpdateStat} className="md:col-span-2 py-2 bg-blue-600 text-white font-bold rounded-lg text-xs">Сохранить изменения</button>
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
                                    const { direction, percent, current, isGood } = analyzeTrend(vals, stat.inverted);
                                    
                                    const trendColorHex = isGood ? "#10b981" : "#f43f5e";
                                    return (
                                        <div key={stat.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow relative group">
                                            <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-start bg-white">
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
                                                        <div className={`text-xs font-bold flex items-center justify-end gap-1 mt-1 px-2 py-0.5 rounded-lg ${isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                            {direction === 'up' ? <TrendingUp size={12}/> : (direction === 'down' ? <TrendingDown size={12}/> : <Minus size={12}/>)}
                                                            {Math.abs(percent).toFixed(1)}%
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {!isReadOnly && (
                                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-20">
                                                        <button 
                                                            type="button" 
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHistoryStatId(stat.id); }} 
                                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" 
                                                            title="История значений"
                                                        >
                                                            <List size={14}/>
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditing(stat); }} 
                                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" 
                                                            title="Редактировать"
                                                        >
                                                            <Edit2 size={14}/>
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteStatRequest(stat.id); }} 
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" 
                                                            title="Удалить статистику"
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
                                                <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col gap-3 relative z-10">
                                                    <div className="flex justify-between items-center">
                                                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ввод данных</div>
                                                        <div className="text-[10px] text-slate-400 font-medium">Посл: {vals.length > 0 ? format(new Date(vals[vals.length-1].date), 'dd.MM') : '-'}</div>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row gap-2 w-full">
                                                        <div className="flex gap-2 w-full sm:w-auto">
                                                            <div className="relative flex-1 sm:flex-none">
                                                                <label className="block text-[8px] font-bold text-slate-400 mb-1 uppercase">Дата (Чт)</label>
                                                                <input type="date" value={newStatDate} onChange={e => setNewStatDate(e.target.value)} className="h-9 px-2 border border-slate-200 rounded-lg text-xs font-medium bg-white text-slate-700 focus:border-blue-300 outline-none w-full sm:w-28" />
                                                            </div>
                                                            <div className="flex-1 sm:min-w-[80px]">
                                                                <label className="block text-[8px] font-bold text-slate-400 mb-1 uppercase">Значение</label>
                                                                <input type="number" placeholder="0" value={newValueInput[stat.id] || ''} onChange={e => setNewValueInput({...newValueInput, [stat.id]: e.target.value})} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddValue(stat.id, stat.is_double || false); } }} className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-blue-300 placeholder:font-normal" />
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 flex-1">
                                                            {stat.is_double && (<div className="flex-1 sm:min-w-[80px]"><label className="block text-[8px] font-bold text-slate-400 mb-1 uppercase">Вал 2</label><input type="number" placeholder="0" value={newValueInput2[stat.id] || ''} onChange={e => setNewValueInput2({...newValueInput2, [stat.id]: e.target.value})} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddValue(stat.id, stat.is_double || false); } }} className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-blue-300 placeholder:font-normal" /></div>)}
                                                            <button 
                                                                type="button" 
                                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddValue(stat.id, stat.is_double || false); }} 
                                                                className="h-9 px-4 bg-white border border-slate-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-sm flex-1 sm:flex-none mt-auto"
                                                            >
                                                                <Plus size={16}/> <span className="sm:inline">Добавить</span>
                                                            </button>
                                                        </div>
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
      
      {/* HISTORY MODAL (EMPLOYEE SPECIFIC) */}
      {historyStatId && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[80vh]">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">{statsDefinitions.find(s => s.id === historyStatId)?.title || 'История значений'}</h3>
                      <button onClick={() => setHistoryStatId(null)}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                      {getFilteredValues(historyStatId).length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-sm">Нет записей</div>
                      ) : (
                          <table className="w-full text-sm">
                              <thead className="bg-slate-50 text-slate-400 font-bold text-xs uppercase sticky top-0">
                                  <tr><th className="px-4 py-3 text-left">Дата</th><th className="px-4 py-3 text-right">Значение</th><th className="px-4 py-3 text-right"></th></tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                  {getFilteredValues(historyStatId).slice().reverse().map(val => (
                                      <tr key={val.id} className="hover:bg-slate-50 transition-colors">
                                          <td className="px-4 py-3 text-slate-600 font-medium">{format(new Date(val.date), 'dd.MM.yy')}</td>
                                          <td className="px-4 py-3 text-right font-bold text-slate-800">{val.value.toLocaleString()}</td>
                                          <td className="px-4 py-3 text-right">
                                              <button onClick={() => handleDeleteValue(val.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
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

      <ConfirmationModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} isDanger={true} confirmLabel="Удалить" />
    </div>
  );
};

export default EmployeeModal;
