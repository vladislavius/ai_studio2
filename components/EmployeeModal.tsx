
import React, { useState, useEffect, useRef } from 'react';
import { ORGANIZATION_STRUCTURE } from '../constants';
import { X, Save, Upload, FileText, Trash2, Plus, TrendingUp, TrendingDown, CheckCircle2, Printer, Download } from 'lucide-react';
import { Employee as EmployeeType, Attachment, EmergencyContact, StatisticDefinition, StatisticValue, WiseCondition } from '../types';
import { supabase } from '../supabaseClient';
import StatsChart from './StatsChart';
import { format } from 'date-fns';

interface EmployeeModalProps {
  isOpen: boolean;
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
    const generateHistory = (base: number) => Array.from({length: 20}).map((_, i) => ({
        id: `demo-${i}`, definition_id: 'demo', date: new Date(Date.now() - (19-i)*86400000).toISOString(), value: Math.floor(base + Math.random()*20 - 10)
    }));
    return [
        { 
            def: { id: 'p1', title: 'Личная Продуктивность (Баллы)', type: 'employee', owner_id: 'demo' },
            vals: generateHistory(100)
        },
        { 
            def: { id: 'p2', title: 'Завершенные циклы действий', type: 'employee', owner_id: 'demo' },
            vals: generateHistory(45)
        }
    ];
};

const analyzeTrend = (vals: StatisticValue[], inverted: boolean = false) => {
    if (!vals || vals.length < 2) return { condition: 'non_existence' as WiseCondition, change: 0, current: 0 };
    const sorted = [...vals].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const currentVal = sorted[sorted.length - 1].value;
    const prevVal = sorted[sorted.length - 2].value;
    let change = 0;
    if (prevVal !== 0) change = (currentVal - prevVal) / Math.abs(prevVal);
    else if (currentVal > 0) change = 1;
    if (inverted) change = -change;
    return { condition: change > 0 ? 'normal' as WiseCondition : 'danger' as WiseCondition, change, current: currentVal };
};

const EmployeeModal: React.FC<EmployeeModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<EmployeeType>(DEFAULT_EMPLOYEE);
  const [activeTab, setActiveTab] = useState('general');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats
  const [statsDefinitions, setStatsDefinitions] = useState<StatisticDefinition[]>([]);
  const [statsValues, setStatsValues] = useState<StatisticValue[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isDemoStats, setIsDemoStats] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({ ...DEFAULT_EMPLOYEE, ...initialData });
        fetchPersonalStats(initialData.id);
      } else {
        setFormData({ ...DEFAULT_EMPLOYEE, id: crypto.randomUUID(), created_at: new Date().toISOString() });
        setStatsDefinitions([]);
        setStatsValues([]);
      }
      setActiveTab('general');
    }
  }, [isOpen, initialData]);

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
          }
      }

      // If no real data found, inject DEMO data for visual
      if (!foundData) {
          const demo = generateDemoPersonalStats();
          setStatsDefinitions(demo.map(d => d.def as StatisticDefinition));
          // Flatten values
          const allVals: StatisticValue[] = [];
          demo.forEach(d => {
              d.vals.forEach(v => allVals.push({...v, definition_id: d.def.id}));
          });
          setStatsValues(allVals);
          setIsDemoStats(true);
      }
      setIsLoadingStats(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleDepartment = (deptId: string) => {
      setFormData(prev => {
          const current = prev.department || [];
          const exists = current.includes(deptId);
          let newDepts;
          if (exists) {
              newDepts = current.filter(d => d !== deptId);
              // Remove subdepts linked to this dept
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

  const addEmergencyContact = () => {
    setFormData(prev => ({ ...prev, emergency_contacts: [...prev.emergency_contacts, { name: '', relation: '', phone: '' }] }));
  };

  const removeEmergencyContact = (index: number) => {
    setFormData(prev => ({ ...prev, emergency_contacts: prev.emergency_contacts.filter((_, i) => i !== index) }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const newAttachments: Attachment[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let publicUrl = '';
        let storagePath = '';
        if (supabase) {
           const fileExt = file.name.split('.').pop();
           const fileName = `${formData.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
           const { data, error } = await supabase.storage.from('employee-docs').upload(fileName, file);
           if (!error) {
               storagePath = data?.path || '';
               const { data: urlData } = supabase.storage.from('employee-docs').getPublicUrl(storagePath);
               publicUrl = urlData.publicUrl;
           } else { publicUrl = URL.createObjectURL(file); }
        } else { publicUrl = URL.createObjectURL(file); }
        newAttachments.push({
          id: crypto.randomUUID(), employee_id: formData.id, file_name: file.name, file_type: file.type, file_size: file.size, storage_path: storagePath, public_url: publicUrl, uploaded_at: new Date().toISOString()
        });
      }
      setFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...newAttachments] }));
    } catch (error) { console.error('File error:', error); } finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const removeAttachment = (id: string) => {
      setFormData(prev => ({ ...prev, attachments: prev.attachments.filter(a => a.id !== id) }));
  };

  // --- PRINT FUNCTION ---
  const handlePrint = () => {
    const emp = formData;
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${emp.full_name}</title>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            @page { size: A4; margin: 0; }
            body { 
                margin: 0; 
                padding: 0; 
                font-family: 'Inter', sans-serif; 
                background: #fff; 
                color: #0f172a; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
            }
            .page {
                width: 210mm;
                min-height: 297mm;
                padding: 15mm;
                box-sizing: border-box;
                position: relative;
                display: flex;
                flex-direction: column;
            }

            /* --- HEADER --- */
            .header {
                display: flex;
                gap: 25px;
                margin-bottom: 40px;
                align-items: flex-start;
            }
            .photo {
                width: 120px;
                height: 120px;
                border-radius: 20px;
                object-fit: cover;
                background: #f1f5f9;
            }
            .header-info h1 {
                font-size: 26px;
                font-weight: 900;
                text-transform: uppercase;
                margin: 0 0 5px 0;
                color: #0f172a;
                line-height: 1.1;
            }
            .header-info h2 {
                font-size: 14px;
                font-weight: 700;
                color: #3b82f6; /* Blue Title */
                text-transform: uppercase;
                margin: 0 0 15px 0;
            }
            .badges {
                display: flex;
                gap: 8px;
            }
            .badge {
                background: #f1f5f9;
                color: #334155;
                padding: 6px 10px;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 600;
            }
            .badge.blue {
                background: #eff6ff;
                color: #1d4ed8;
            }

            /* --- LAYOUT --- */
            .container {
                display: grid;
                grid-template-columns: 240px 1fr;
                gap: 40px;
            }
            
            .sidebar {
                border-right: 1px solid #e2e8f0;
                padding-right: 20px;
            }
            
            .section {
                margin-bottom: 30px;
            }
            
            .section-title {
                font-size: 11px;
                font-weight: 800;
                color: #94a3b8; /* Light Grey Title */
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 12px;
                border-bottom: 1px solid #f1f5f9;
                padding-bottom: 4px;
            }

            /* --- LEFT COLUMN STYLES --- */
            .contact-item {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
                font-size: 13px;
                color: #334155;
                font-weight: 500;
            }
            .contact-icon {
                width: 24px;
                height: 24px;
                background: #f1f5f9; /* Light square */
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: 700;
                color: #64748b;
            }

            .address-box {
                background: #f8fafc; /* Very light grey bg */
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 10px;
            }
            .address-label {
                font-size: 10px;
                font-weight: 700;
                color: #64748b;
                text-transform: uppercase;
                margin-bottom: 4px;
            }
            .address-val {
                font-size: 12px;
                color: #334155;
                line-height: 1.4;
            }

            .emergency-card {
                background: #fff1f2; /* Pinkish bg */
                border-left: 3px solid #fecaca;
                padding: 10px;
                border-radius: 0 6px 6px 0;
                margin-bottom: 8px;
            }
            .ec-name { color: #be123c; font-weight: 700; font-size: 12px; }
            .ec-role { color: #e11d48; font-size: 10px; margin-bottom: 2px; }
            .ec-phone { color: #be123c; font-size: 12px; font-weight: 500; }

            /* --- RIGHT COLUMN STYLES --- */
            .grid-2 {
                display: grid;
                grid-template-columns: 1fr 1fr;
                column-gap: 20px;
                row-gap: 15px;
            }
            
            .field-group {
                margin-bottom: 5px;
            }
            .label {
                font-size: 10px;
                font-weight: 700;
                color: #64748b; /* Grey Label */
                text-transform: uppercase;
                margin-bottom: 4px;
                display: block;
            }
            .value {
                font-size: 13px;
                font-weight: 600;
                color: #0f172a; /* Dark Value */
                line-height: 1.3;
            }
            .mono-bg {
                font-family: monospace;
                background: #f1f5f9;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 12px;
            }

            .passport-box {
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 15px;
                background: #fff;
            }

            .finance-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #f8fafc;
                font-size: 12px;
            }
            .finance-label { color: #64748b; font-weight: 600; }
            .finance-val { color: #0f172a; font-weight: 600; text-align: right; }
            
            .footer {
                margin-top: auto;
                text-align: right;
                font-size: 9px;
                color: #94a3b8;
                padding-top: 20px;
                border-top: 1px solid #f1f5f9;
            }

          </style>
        </head>
        <body>
          <div class="page">
             
             <!-- HEADER -->
             <div class="header">
                 <img src="${emp.photo_url || 'https://via.placeholder.com/150'}" class="photo" />
                 <div class="header-info">
                     <h1>${emp.full_name}</h1>
                     <h2>${emp.position || 'Должность не указана'}</h2>
                     <div class="badges">
                        <span class="badge blue">ID: ${emp.id.substring(0,8)}</span>
                        ${emp.nickname ? `<span class="badge">NIK: ${emp.nickname}</span>` : ''}
                        <span class="badge">Joined: ${emp.join_date || '-'}</span>
                     </div>
                 </div>
             </div>

             <div class="container">
                
                <!-- LEFT SIDEBAR -->
                <div class="sidebar">
                    
                    <div class="section">
                        <div class="section-title">CONTACTS</div>
                        ${emp.phone ? `<div class="contact-item"><div class="contact-icon">Ph</div>${emp.phone}</div>` : ''}
                        ${emp.email ? `<div class="contact-item"><div class="contact-icon">@</div>${emp.email}</div>` : ''}
                        ${emp.telegram ? `<div class="contact-item"><div class="contact-icon">Tg</div>${emp.telegram}</div>` : ''}
                        ${emp.whatsapp ? `<div class="contact-item"><div class="contact-icon">Wa</div>${emp.whatsapp}</div>` : ''}
                    </div>

                    <div class="section">
                        <div class="section-title">RESIDENCE</div>
                        <div class="address-box">
                            <div class="address-label">ACTUAL ADDRESS</div>
                            <div class="address-val">${emp.actual_address || '-'}</div>
                        </div>
                        <div class="address-box">
                            <div class="address-label">REGISTRATION</div>
                            <div class="address-val">${emp.registration_address || '-'}</div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">EMERGENCY</div>
                         ${emp.emergency_contacts && emp.emergency_contacts.length > 0 ? 
                            emp.emergency_contacts.map(c => `
                                <div class="emergency-card">
                                    <div class="ec-name">${c.name}</div>
                                    <div class="ec-role">${c.relation}</div>
                                    <div class="ec-phone">${c.phone}</div>
                                </div>
                            `).join('') : '<div style="font-size:11px; color:#94a3b8">Нет контактов</div>'}
                    </div>

                </div>

                <!-- RIGHT MAIN -->
                <div class="main">
                    
                    <div class="section">
                        <div class="section-title">ORGANIZATION & IDENTITY</div>
                        <div class="grid-2">
                            <div>
                                <span class="label">DEPARTMENT</span>
                                <div class="value">${emp.department?.map(d => ORGANIZATION_STRUCTURE[d]?.name.split('.')[1] || '').join(', ') || '-'}</div>
                            </div>
                            <div>
                                <span class="label">SUB-DEPARTMENT</span>
                                <div class="value">${emp.subdepartment?.map(s => {
                                     const deptId = emp.department?.[0];
                                     return deptId ? ORGANIZATION_STRUCTURE[deptId]?.departments?.[s]?.name : s;
                                }).join(', ') || '-'}</div>
                            </div>
                            <div style="margin-top: 10px;">
                                <span class="label">BIRTH DATE</span>
                                <div class="value">${emp.birth_date || '-'}</div>
                            </div>
                             <div style="margin-top: 10px;">
                                <span class="label">INN</span>
                                <div class="value"><span class="mono-bg">${emp.inn || '-'}</span></div>
                            </div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">PASSPORT DETAILS</div>
                        <div class="passport-box">
                             <div class="grid-2">
                                <div>
                                    <span class="label">SERIES & NUMBER</span>
                                    <div class="value"><span class="mono-bg">${emp.passport_number || '-'}</span></div>
                                </div>
                                <div>
                                    <span class="label">DATE OF ISSUE</span>
                                    <div class="value">${emp.passport_date || '-'}</div>
                                </div>
                            </div>
                            <div style="margin-top: 15px;">
                                <span class="label">ISSUED BY</span>
                                <div class="value">${emp.passport_issuer || '-'}</div>
                            </div>
                        </div>
                    </div>

                    ${emp.foreign_passport ? `
                    <div class="section">
                        <div class="section-title">FOREIGN PASSPORT</div>
                        <div class="passport-box">
                             <div class="grid-2">
                                <div>
                                    <span class="label">NUMBER</span>
                                    <div class="value"><span class="mono-bg">${emp.foreign_passport}</span></div>
                                </div>
                                <div>
                                    <span class="label">VALID UNTIL / ISSUED</span>
                                    <div class="value">${emp.foreign_passport_date || '-'}</div>
                                </div>
                            </div>
                             <div style="margin-top: 15px;">
                                <span class="label">AUTHORITY</span>
                                <div class="value">${emp.foreign_passport_issuer || '-'}</div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <div class="section">
                        <div class="section-title">FINANCE</div>
                        <div class="finance-row">
                            <span class="finance-label">Bank Name</span>
                            <span class="finance-val">${emp.bank_name || 'Не указан'}</span>
                        </div>
                        <div class="finance-row">
                            <span class="finance-label">Account / Card</span>
                            <span class="finance-val">${emp.bank_details || '-'}</span>
                        </div>
                         <div class="finance-row">
                            <span class="finance-label">Crypto Wallet (${emp.crypto_network || 'NET'})</span>
                            <span class="finance-val">${emp.crypto_wallet || '-'}</span>
                        </div>
                    </div>

                </div>

             </div>

             <div class="footer">
                CONFIDENTIAL PERSONNEL RECORD • Generated on ${format(new Date(), 'dd.MM.yyyy')}
             </div>

          </div>
          <script>
            window.onload = () => { setTimeout(() => window.print(), 500); };
          </script>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
    } else {
        alert("Pop-up blocked. Please allow pop-ups for this site to print.");
    }
  };

  // --- EXPORT TXT FUNCTION ---
  const handleExportTxt = () => {
    const emp = formData;
    const lines = [
        "EMPLOYEE DOSSIER",
        "================",
        `Name: ${emp.full_name}`,
        `Position: ${emp.position}`,
        `ID: ${emp.id}`,
        "----------------",
        `Phone: ${emp.phone || '-'}`,
        `Email: ${emp.email || '-'}`,
        `Telegram: ${emp.telegram || '-'}`,
        "----------------",
        `Passport: ${emp.passport_number || '-'}`,
        `INN: ${emp.inn || '-'}`,
        "----------------",
        `Bank: ${emp.bank_name || '-'}`,
        `Account: ${emp.bank_details || '-'}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${emp.full_name}_dossier.txt`;
    a.click();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, updated_at: new Date().toISOString() });
  };

  if (!isOpen) return null;

  const inputClass = "w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium text-slate-800 placeholder:text-slate-400 hover:border-slate-300";
  const labelClass = "block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1 tracking-wide";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-5 border-b border-gray-100 bg-white flex-shrink-0">
          <div>
              <h2 className="text-2xl font-bold text-slate-800">{initialData ? 'Редактирование сотрудника' : 'Новый Сотрудник'}</h2>
              <div className="flex items-center gap-2 text-sm text-slate-500 mt-0.5">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono text-slate-600">{formData.id.substring(0,8)}</span>
                  <span>• Личное дело (Full Profile)</span>
              </div>
          </div>
          <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={handlePrint} 
                className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-2"
                title="Печать PDF / Презентация"
              >
                <Printer size={18} /> <span className="hidden sm:inline">Печать / PDF</span>
              </button>
              <button 
                type="button" 
                onClick={handleExportTxt} 
                className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-2"
                title="Экспорт TXT"
              >
                <Download size={18} /> <span className="hidden sm:inline">TXT</span>
              </button>
              <div className="w-px h-8 bg-slate-200 mx-2"></div>
              <button 
                type="button" 
                onClick={onClose} 
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={handleSubmit} 
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 flex items-center gap-2 transition-all hover:-translate-y-0.5"
              >
                <Save size={18} /> Сохранить
              </button>
          </div>
        </div>

        {/* Layout */}
        <div className="flex flex-1 overflow-hidden bg-slate-50/50">
            
            {/* Sidebar Navigation */}
            <div className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col gap-1 overflow-y-auto shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] z-10">
                {[
                    { id: 'general', label: '1. Основное & Структура' },
                    { id: 'contacts', label: '2. Контакты & Адреса' },
                    { id: 'docs', label: '3. Документы (Паспорта)' },
                    { id: 'finance', label: '4. Финансы & Крипта' },
                    { id: 'files', label: '5. Файлы & Экстренные' },
                    { id: 'stats', label: '6. Личная Статистика', icon: <TrendingUp size={14}/> }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)} 
                        className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-between group ${
                            activeTab === tab.id 
                            ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                        }`}
                    >
                        <span className="flex items-center gap-2">{tab.label}</span>
                        {tab.icon && <span className={activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}>{tab.icon}</span>}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <form className="max-w-4xl mx-auto space-y-8 pb-20">
                    
                    {/* TAB: GENERAL */}
                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            
                            {/* Personal Info Section */}
                            <section>
                                <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div> Личные Данные
                                </h3>
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><label className={labelClass}>ФИО (Полностью)</label><input name="full_name" value={formData.full_name} onChange={handleChange} className={inputClass} placeholder="Иванов Иван Иванович" /></div>
                                    <div><label className={labelClass}>Должность</label><input name="position" value={formData.position} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Дата Рождения</label><input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Дата Приема</label><input type="date" name="join_date" value={formData.join_date} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Фото URL</label><input name="photo_url" value={formData.photo_url || ''} onChange={handleChange} className={inputClass} placeholder="https://..." /></div>
                                    <div><label className={labelClass}>Системный NIK</label><input name="nickname" value={formData.nickname || ''} onChange={handleChange} className={inputClass} placeholder="ivan_hr" /></div>
                                </div>
                            </section>

                            {/* Org Structure Section */}
                            <section>
                                <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div> Организационная Структура
                                </h3>
                                
                                <div className="space-y-6">
                                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider">Департамент (Владелец)</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {Object.values(ORGANIZATION_STRUCTURE).map(d => {
                                                const isSelected = formData.department?.includes(d.id);
                                                return (
                                                    <div 
                                                        key={d.id} 
                                                        onClick={() => toggleDepartment(d.id)}
                                                        className={`cursor-pointer p-3 rounded-2xl border-2 transition-all flex items-center gap-3 relative overflow-hidden group ${
                                                            isSelected 
                                                            ? 'border-blue-500 bg-blue-50/50 shadow-md ring-0' 
                                                            : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm font-bold text-sm transition-transform group-hover:scale-105" style={{backgroundColor: d.color}}>
                                                            {d.name.substring(0,1)}
                                                        </div>
                                                        <div className="flex-1 min-w-0 z-10">
                                                            <div className={`text-sm font-bold truncate ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>{d.name.split(':')[0]}</div>
                                                            <div className="text-[10px] text-slate-400 truncate font-medium">{d.manager}</div>
                                                        </div>
                                                        {isSelected && <div className="absolute top-2 right-2 text-blue-500"><CheckCircle2 size={18} fill="currentColor" className="text-white"/></div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {formData.department && formData.department.length > 0 && (
                                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider">Отдел / Секция (Функциональная роль)</label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {formData.department.map(deptId => {
                                                    const dept = ORGANIZATION_STRUCTURE[deptId];
                                                    if (!dept?.departments) return null;
                                                    return Object.values(dept.departments).map(sub => {
                                                        const isSelected = formData.subdepartment?.includes(sub.id);
                                                        return (
                                                            <div 
                                                                key={sub.id}
                                                                onClick={() => toggleSubDepartment(sub.id)}
                                                                className={`cursor-pointer p-4 rounded-2xl border transition-all flex justify-between items-center group ${
                                                                    isSelected 
                                                                    ? 'border-amber-500 bg-amber-50/50 shadow-md' 
                                                                    : 'border-slate-100 hover:border-amber-300 hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                <div>
                                                                    <div className={`text-sm font-bold ${isSelected ? 'text-amber-900' : 'text-slate-700'}`}>{sub.name}</div>
                                                                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">{dept.name.split('.')[0]} • {sub.manager}</div>
                                                                </div>
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

                    {/* TAB: STATISTICS */}
                    {activeTab === 'stats' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div> Личная Статистика и KPI
                            </h3>
                            {isDemoStats && (
                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-4 text-xs text-amber-800 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                    Показаны демонстрационные данные. Реальные статистики отсутствуют.
                                </div>
                            )}
                            {statsDefinitions.length === 0 && !isLoadingStats && !isDemoStats && (
                                <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><TrendingUp size={32}/></div>
                                    <p className="text-slate-500 font-bold text-lg">Нет назначенных статистик</p>
                                    <p className="text-sm text-slate-400 mt-2">Статистики назначаются через Инженерное меню.</p>
                                </div>
                            )}
                            {statsDefinitions.map(stat => {
                                const vals = statsValues.filter(v => v.definition_id === stat.id);
                                const { condition, change, current } = analyzeTrend(vals, stat.inverted);
                                return (
                                    <div key={stat.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                            <div>
                                                <h4 className="font-bold text-lg text-slate-800">{stat.title}</h4>
                                                <p className="text-xs text-slate-500 font-medium mt-1">{stat.description || 'Личный показатель эффективности'}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-3xl font-black text-slate-800 tracking-tight">{current.toLocaleString()}</div>
                                                <div className={`text-xs font-bold flex items-center justify-end gap-1 mt-1 px-2 py-0.5 rounded-lg ${change > 0 ? 'bg-emerald-100 text-emerald-700' : change < 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {change > 0 ? <TrendingUp size={12}/> : change < 0 ? <TrendingDown size={12}/> : null}
                                                    {Math.abs(change * 100).toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-6 h-72 bg-white">
                                            <StatsChart values={vals} inverted={stat.inverted} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* TAB: CONTACTS */}
                    {activeTab === 'contacts' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-purple-500 rounded-full"></div> Контакты & Адреса
                            </h3>
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className={labelClass}>Телефон</label><input name="phone" value={formData.phone} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>WhatsApp</label><input name="whatsapp" value={formData.whatsapp} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Email (Рабочий)</label><input name="email" value={formData.email} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Email (Личный)</label><input name="email2" value={formData.email2} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Telegram</label><input name="telegram" value={formData.telegram} onChange={handleChange} className={inputClass} /></div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                                <div><label className={labelClass}>Фактический адрес</label><textarea name="actual_address" value={formData.actual_address} onChange={handleChange} className={inputClass + " h-24"} /></div>
                                <div><label className={labelClass}>Адрес регистрации</label><textarea name="registration_address" value={formData.registration_address} onChange={handleChange} className={inputClass + " h-24"} /></div>
                            </div>
                        </div>
                    )}

                    {/* TAB: DOCUMENTS */}
                    {activeTab === 'docs' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-slate-600 rounded-full"></div> Паспортные Данные
                            </h3>
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <label className={labelClass}>ИНН</label>
                                <input name="inn" value={formData.inn} onChange={handleChange} className={inputClass + " font-mono text-lg tracking-widest"} placeholder="000000000000" />
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <h4 className="font-bold text-slate-700 mb-4 border-b pb-2">Внутренний Паспорт</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><label className={labelClass}>Серия и Номер</label><input name="passport_number" value={formData.passport_number} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Дата Выдачи</label><input type="date" name="passport_date" value={formData.passport_date} onChange={handleChange} className={inputClass} /></div>
                                    <div className="md:col-span-2"><label className={labelClass}>Кем Выдан</label><textarea name="passport_issuer" value={formData.passport_issuer} onChange={handleChange} className={inputClass + " h-16"} /></div>
                                </div>
                            </div>
                             <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <h4 className="font-bold text-slate-700 mb-4 border-b pb-2">Заграничный Паспорт</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><label className={labelClass}>Номер</label><input name="foreign_passport" value={formData.foreign_passport} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Годен до / Дата выдачи</label><input name="foreign_passport_date" value={formData.foreign_passport_date} onChange={handleChange} className={inputClass} /></div>
                                    <div className="md:col-span-2"><label className={labelClass}>Authority (Кем выдан)</label><input name="foreign_passport_issuer" value={formData.foreign_passport_issuer} onChange={handleChange} className={inputClass} /></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: FINANCE */}
                    {activeTab === 'finance' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-green-500 rounded-full"></div> Финансы
                            </h3>
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <div className="space-y-4">
                                    <div><label className={labelClass}>Название Банка</label><input name="bank_name" value={formData.bank_name} onChange={handleChange} className={inputClass} /></div>
                                    <div><label className={labelClass}>Реквизиты</label><textarea name="bank_details" value={formData.bank_details} onChange={handleChange} className={inputClass + " h-24 font-mono text-sm"} /></div>
                                </div>
                            </div>
                             <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className={labelClass}>Крипто-сеть</label><input name="crypto_network" value={formData.crypto_network} onChange={handleChange} className={inputClass} /></div>
                                <div><label className={labelClass}>Валюта</label><input name="crypto_currency" value={formData.crypto_currency} onChange={handleChange} className={inputClass} /></div>
                                <div className="md:col-span-2"><label className={labelClass}>Адрес Кошелька</label><input name="crypto_wallet" value={formData.crypto_wallet} onChange={handleChange} className={inputClass + " font-mono text-xs"} /></div>
                            </div>
                        </div>
                    )}

                    {/* TAB: FILES */}
                    {activeTab === 'files' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-center mb-4 border-b pb-2">
                                    <h4 className="font-bold text-slate-700">Экстренные Контакты</h4>
                                    <button type="button" onClick={addEmergencyContact} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"><Plus size={14}/> Добавить</button>
                                </div>
                                {formData.emergency_contacts.map((contact, idx) => (
                                    <div key={idx} className="flex gap-3 mb-3 items-end bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <div className="flex-1"><label className="text-[10px] font-bold text-slate-400">Имя</label><input value={contact.name} onChange={(e) => handleEmergencyChange(idx, 'name', e.target.value)} className="w-full bg-transparent border-b border-slate-300 outline-none text-sm font-medium"/></div>
                                        <div className="flex-1"><label className="text-[10px] font-bold text-slate-400">Роль</label><input value={contact.relation} onChange={(e) => handleEmergencyChange(idx, 'relation', e.target.value)} className="w-full bg-transparent border-b border-slate-300 outline-none text-sm"/></div>
                                        <div className="flex-1"><label className="text-[10px] font-bold text-slate-400">Телефон</label><input value={contact.phone} onChange={(e) => handleEmergencyChange(idx, 'phone', e.target.value)} className="w-full bg-transparent border-b border-slate-300 outline-none text-sm"/></div>
                                        <button type="button" onClick={() => removeEmergencyContact(idx)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                                {formData.emergency_contacts.length === 0 && <p className="text-sm text-slate-400 italic">Нет записей.</p>}
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <h4 className="font-bold text-slate-700 mb-4">Файлы и Скан-копии</h4>
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-blue-100 bg-blue-50/50 text-blue-600 rounded-2xl p-8 flex flex-col items-center justify-center hover:bg-blue-50 hover:border-blue-200 transition-all mb-4">
                                    <Upload size={24} className="mb-2"/>
                                    <span className="font-bold">{isUploading ? 'Загрузка...' : 'Загрузить файл'}</span>
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
                                
                                <div className="space-y-2">
                                    {formData.attachments?.map(file => (
                                        <div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:shadow-sm transition-shadow">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-200"><FileText size={20}/></div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-slate-700 truncate">{file.file_name}</div>
                                                    <div className="text-xs text-slate-400">{(file.file_size / 1024).toFixed(1)} KB</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <a href={file.public_url} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold">Скачать</a>
                                                <button type="button" onClick={() => removeAttachment(file.id)} className="p-2 text-red-400 hover:bg-red-100 rounded-lg"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                             <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <h4 className="font-bold text-slate-700 mb-2">Заметки</h4>
                                <textarea name="additional_info" value={formData.additional_info} onChange={handleChange} className={inputClass + " h-24"} placeholder="..." />
                            </div>
                        </div>
                    )}

                </form>
            </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeModal;
