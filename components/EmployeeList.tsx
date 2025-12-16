
import React from 'react';
import { Employee as EmployeeType } from '../types';
import { ORGANIZATION_STRUCTURE } from '../constants';
import { Edit2, Trash2, User, Phone, Mail, MessageCircle, FileText, Printer, Hash } from 'lucide-react';
import { format } from 'date-fns';

interface EmployeeListProps {
  employees: EmployeeType[];
  onEdit: (emp: EmployeeType) => void;
  onDelete: (id: string) => void;
}

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, onEdit, onDelete }) => {
  const getDeptColor = (deptId?: string) => {
    if (!deptId) return '#e2e8f0';
    return ORGANIZATION_STRUCTURE[deptId]?.color || '#e2e8f0';
  };

  const getDeptName = (deptId?: string) => {
    if (!deptId) return 'Unassigned';
    return ORGANIZATION_STRUCTURE[deptId]?.name || 'Unknown';
  };

  const getSubDeptName = (deptId?: string, subDeptId?: string) => {
    if (!deptId || !subDeptId) return '';
    const dept = ORGANIZATION_STRUCTURE[deptId];
    if (!dept || !dept.departments) return '';
    return dept.departments[subDeptId]?.name || '';
  };

  // --- FULL TXT EXPORT LOGIC ---
  const quickExportTxt = (e: React.MouseEvent, emp: EmployeeType) => {
    e.stopPropagation();
    
    // Helper to align keys
    const pad = (key: string) => key.padEnd(25, ' ');
    const val = (v: string | undefined | null) => v ? v : '-';

    const deptName = emp.department?.map(d => ORGANIZATION_STRUCTURE[d]?.name).join(', ') || '-';
    const subDeptName = emp.subdepartment?.map(s => {
         const deptId = emp.department?.[0];
         return deptId ? ORGANIZATION_STRUCTURE[deptId]?.departments?.[s]?.name : s;
    }).join(', ') || '-';

    // Format Emergency Contacts properly for TXT
    const emergencyContactsText = (emp.emergency_contacts && emp.emergency_contacts.length > 0)
        ? emp.emergency_contacts.map((c, i) => 
            `   ${i+1}. ${c.name} (${c.relation})\n      Тел: ${c.phone}`
          ).join('\n')
        : "   Контакты не указаны";

    const lines = [
        "================================================================",
        "                   ЛИЧНОЕ ДЕЛО СОТРУДНИКА                       ",
        "================================================================",
        `Дата формирования: ${new Date().toLocaleString('ru-RU')}`,
        "",
        "[ 1. ОСНОВНАЯ ИНФОРМАЦИЯ ]",
        `${pad('ФИО:')}${val(emp.full_name)}`,
        `${pad('Должность:')}${val(emp.position)}`,
        `${pad('Системный ID:')}${val(emp.id)}`,
        `${pad('Никнейм (NIK):')}${val(emp.nickname)}`,
        `${pad('Дата рождения:')}${val(emp.birth_date)}`,
        `${pad('Дата приема:')}${val(emp.join_date)}`,
        "",
        "[ 2. ОРГАНИЗАЦИОННАЯ СТРУКТУРА ]",
        `${pad('Департамент:')}${deptName}`,
        `${pad('Отдел/Секция:')}${subDeptName}`,
        "",
        "[ 3. КОНТАКТЫ ]",
        `${pad('Телефон:')}${val(emp.phone)}`,
        `${pad('WhatsApp:')}${val(emp.whatsapp)}`,
        `${pad('Telegram:')}${val(emp.telegram)}`,
        `${pad('Email (Рабочий):')}${val(emp.email)}`,
        `${pad('Email (Личный):')}${val(emp.email2)}`,
        "",
        "[ 4. АДРЕСА ]",
        `${pad('Фактический адрес:')}${val(emp.actual_address)}`,
        `${pad('Адрес регистрации:')}${val(emp.registration_address)}`,
        "",
        "[ 5. ДОКУМЕНТЫ И ЛЕГАЛЬНОСТЬ ]",
        `${pad('ИНН:')}${val(emp.inn)}`,
        `--- Внутренний паспорт ---`,
        `${pad('Номер:')}${val(emp.passport_number)}`,
        `${pad('Дата выдачи:')}${val(emp.passport_date)}`,
        `${pad('Кем выдан:')}${val(emp.passport_issuer)}`,
        `--- Заграничный паспорт ---`,
        `${pad('Номер:')}${val(emp.foreign_passport)}`,
        `${pad('Срок действия:')}${val(emp.foreign_passport_date)}`,
        `${pad('Кем выдан:')}${val(emp.foreign_passport_issuer)}`,
        "",
        "[ 6. ФИНАНСЫ ]",
        `${pad('Банк:')}${val(emp.bank_name)}`,
        `${pad('Реквизиты/Карта:')}${val(emp.bank_details)}`,
        `${pad('Крипто-кошелек:')}${val(emp.crypto_wallet)}`,
        `${pad('Сеть:')}${val(emp.crypto_network)}`,
        `${pad('Валюта:')}${val(emp.crypto_currency)}`,
        "",
        "[ 7. ЭКСТРЕННЫЕ КОНТАКТЫ ]",
        emergencyContactsText,
        "",
        "[ 8. ДОПОЛНИТЕЛЬНО ]",
        `${pad('Заметки:')}${val(emp.additional_info)}`,
        "",
        "[ 9. КАСТОМНЫЕ ПОЛЯ ]",
        ...(emp.custom_fields && emp.custom_fields.length > 0
            ? emp.custom_fields.map(f => `${pad(f.label + ':')}${f.value}`)
            : ["   Нет дополнительных полей"]),
        "",
        "================================================================",
        "                  КОНЕЦ ФАЙЛА                                   ",
        "================================================================"
    ];
    
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${emp.full_name.replace(/\s+/g, '_')}_dossier.txt`;
    a.click();
  };

  const quickPrint = (e: React.MouseEvent, emp: EmployeeType) => {
    e.stopPropagation();
     
     // Generate Emergency Contacts HTML
     const emergencyHtml = emp.emergency_contacts && emp.emergency_contacts.length > 0
        ? emp.emergency_contacts.map(c => `
            <div class="emergency-card">
                <div class="ec-name">${c.name}</div>
                <div class="ec-role">${c.relation || 'Родственник'}</div>
                <div class="ec-phone">${c.phone}</div>
            </div>
          `).join('')
        : '<div style="font-size:11px; color:#94a3b8; font-style: italic;">Контакты не указаны</div>';

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
            .header { display: flex; gap: 25px; margin-bottom: 30px; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
            .photo { width: 120px; height: 120px; border-radius: 12px; object-fit: cover; background: #f1f5f9; border: 1px solid #e2e8f0; }
            .header-info h1 { font-size: 24px; font-weight: 800; text-transform: uppercase; margin: 0 0 5px 0; color: #0f172a; line-height: 1.1; }
            .header-info h2 { font-size: 14px; font-weight: 600; color: #3b82f6; text-transform: uppercase; margin: 0 0 15px 0; }
            .badges { display: flex; gap: 8px; flex-wrap: wrap; }
            .badge { background: #f8fafc; color: #475569; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; border: 1px solid #e2e8f0; }
            .container { display: grid; grid-template-columns: 240px 1fr; gap: 30px; }
            .sidebar { border-right: 1px solid #e2e8f0; padding-right: 20px; }
            .section { margin-bottom: 25px; }
            .section-title { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px; }
            
            .contact-item { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 12px; color: #334155; font-weight: 500; }
            .contact-icon { width: 20px; height: 20px; background: #f1f5f9; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #64748b; }
            
            .address-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 8px; }
            .address-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
            .address-val { font-size: 11px; color: #334155; line-height: 1.3; }
            
            .emergency-card { background: #fff1f2; border-left: 3px solid #fecaca; padding: 8px; border-radius: 0 4px 4px 0; margin-bottom: 6px; }
            .ec-name { color: #9f1239; font-weight: 700; font-size: 11px; }
            .ec-role { color: #be123c; font-size: 9px; margin-bottom: 2px; }
            .ec-phone { color: #881337; font-size: 11px; font-weight: 600; }
            
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; row-gap: 12px; }
            .label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px; display: block; }
            .value { font-size: 12px; font-weight: 600; color: #0f172a; line-height: 1.3; }
            .mono-bg { font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
            
            .passport-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #fff; margin-bottom: 8px; }
            .finance-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f8fafc; font-size: 11px; }
            .finance-label { color: #64748b; font-weight: 600; }
            .finance-val { color: #0f172a; font-weight: 600; text-align: right; }
            
            .footer { margin-top: auto; text-align: right; font-size: 9px; color: #cbd5e1; padding-top: 15px; border-top: 1px solid #f1f5f9; }
          </style>
        </head>
        <body>
          <div class="page">
             <div class="header">
                 <img src="${emp.photo_url || ''}" class="photo" onerror="this.src='https://ui-avatars.com/api/?name=${emp.full_name}&background=f1f5f9&color=64748b'" />
                 <div class="header-info">
                     <h1>${emp.full_name}</h1>
                     <h2>${emp.position || 'Должность не указана'}</h2>
                     <div class="badges">
                        <span class="badge">ID: ${emp.id.substring(0,8)}</span>
                        ${emp.nickname ? `<span class="badge">NIK: ${emp.nickname}</span>` : ''}
                        <span class="badge">Принят: ${emp.join_date || '-'}</span>
                     </div>
                 </div>
             </div>
             <div class="container">
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
                            <div class="address-label">ACTUAL</div>
                            <div class="address-val">${emp.actual_address || '-'}</div>
                        </div>
                        <div class="address-box">
                            <div class="address-label">REGISTRATION</div>
                            <div class="address-val">${emp.registration_address || '-'}</div>
                        </div>
                    </div>
                    <div class="section">
                        <div class="section-title">EMERGENCY CONTACTS</div>
                        ${emergencyHtml}
                    </div>
                </div>
                <div class="main">
                    <div class="section">
                        <div class="section-title">ORGANIZATION & IDENTITY</div>
                        <div class="grid-2">
                            <div><span class="label">DEPARTMENT</span><div class="value">${emp.department?.map(d => ORGANIZATION_STRUCTURE[d]?.name.split('.')[1] || '').join(', ') || '-'}</div></div>
                            <div><span class="label">SUB-DEPARTMENT</span><div class="value">${emp.subdepartment?.map(s => { const deptId = emp.department?.[0]; return deptId ? ORGANIZATION_STRUCTURE[deptId]?.departments?.[s]?.name : s; }).join(', ') || '-'}</div></div>
                            <div style="margin-top: 10px;"><span class="label">BIRTH DATE</span><div class="value">${emp.birth_date || '-'}</div></div>
                             <div style="margin-top: 10px;"><span class="label">INN</span><div class="value"><span class="mono-bg">${emp.inn || '-'}</span></div></div>
                        </div>
                    </div>
                    <div class="section">
                        <div class="section-title">PASSPORT DETAILS</div>
                        <div class="passport-box">
                             <div class="grid-2">
                                <div><span class="label">SERIES & NUMBER</span><div class="value"><span class="mono-bg">${emp.passport_number || '-'}</span></div></div>
                                <div><span class="label">DATE OF ISSUE</span><div class="value">${emp.passport_date || '-'}</div></div>
                            </div>
                            <div style="margin-top: 10px;"><span class="label">ISSUED BY</span><div class="value">${emp.passport_issuer || '-'}</div></div>
                        </div>
                    </div>
                    ${emp.foreign_passport ? `<div class="section"><div class="section-title">FOREIGN PASSPORT</div><div class="passport-box"><div class="grid-2"><div><span class="label">NUMBER</span><div class="value"><span class="mono-bg">${emp.foreign_passport}</span></div></div><div><span class="label">VALID UNTIL / ISSUED</span><div class="value">${emp.foreign_passport_date || '-'}</div></div></div><div style="margin-top: 10px;"><span class="label">AUTHORITY</span><div class="value">${emp.foreign_passport_issuer || '-'}</div></div></div></div>` : ''}
                    <div class="section">
                        <div class="section-title">FINANCE</div>
                        <div class="finance-row"><span class="finance-label">Bank Name</span><span class="finance-val">${emp.bank_name || 'Не указан'}</span></div>
                        <div class="finance-row"><span class="finance-label">Account / Card</span><span class="finance-val">${emp.bank_details || '-'}</span></div>
                         <div class="finance-row"><span class="finance-label">Crypto Wallet (${emp.crypto_network || 'NET'})</span><span class="finance-val">${emp.crypto_wallet || '-'}</span></div>
                    </div>
                    
                    ${emp.additional_info ? `<div class="section"><div class="section-title">NOTES</div><div style="font-size:11px; color:#334155; line-height:1.5; border-left:2px solid #e2e8f0; padding-left:10px;">${emp.additional_info}</div></div>` : ''}
                </div>
             </div>
             <div class="footer">CONFIDENTIAL PERSONNEL RECORD • HR SYSTEM PRO • ${format(new Date(), 'dd.MM.yyyy')}</div>
          </div>
          <script>window.onload = () => { setTimeout(() => window.print(), 500); };</script>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) { printWindow.document.write(printContent); printWindow.document.close(); }
  };

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-200">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
           <User size={40} className="opacity-50" />
        </div>
        <p className="text-xl font-semibold text-gray-600">No employees found</p>
        <p className="text-sm">Try adjusting your search or add a new employee.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {employees.map((emp) => (
        <div key={emp.id} onClick={() => onEdit(emp)} className="group bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-200 transition-all duration-300 overflow-hidden flex flex-col relative cursor-pointer hover:-translate-y-1">
          
          {/* Top colored banner */}
          <div className="h-20 w-full relative overflow-hidden" style={{ backgroundColor: getDeptColor(emp.department?.[0]) + '25' }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/30 rounded-full -mr-10 -mt-10 blur-xl"></div>
            
            <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(emp.id); }}
                  className="p-1.5 bg-white/90 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg shadow-sm backdrop-blur-sm transition-all border border-slate-100"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
            </div>

            <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
               <button 
                  onClick={(e) => quickExportTxt(e, emp)}
                  className="p-1.5 bg-white/90 hover:bg-white text-slate-500 rounded-lg shadow-sm backdrop-blur-sm transition-all border border-slate-100"
                  title="Export Full TXT"
                >
                  <FileText size={14} />
                </button>
                <button 
                  onClick={(e) => quickPrint(e, emp)}
                  className="p-1.5 bg-white/90 hover:bg-white text-slate-500 rounded-lg shadow-sm backdrop-blur-sm transition-all border border-slate-100"
                  title="Print Full Dossier"
                >
                  <Printer size={14} />
                </button>
            </div>

          </div>
          
          <div className="px-4 pb-4 flex-1 flex flex-col -mt-10">
            <div className="relative mb-3 self-start">
              <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-sm border border-slate-100">
                 <div className="w-full h-full rounded-xl overflow-hidden bg-gray-100 relative">
                    {emp.photo_url ? (
                      <img 
                        src={emp.photo_url} 
                        alt={emp.full_name} 
                        className="w-full h-full object-cover" 
                        onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${emp.full_name}&background=f1f5f9&color=64748b`)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><User size={32} /></div>
                    )}
                 </div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full shadow-sm border border-slate-100" title={getDeptName(emp.department?.[0])}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white" style={{ backgroundColor: getDeptColor(emp.department?.[0]) }}>
                    {getDeptName(emp.department?.[0]).substring(0,2).toUpperCase()}
                  </div>
              </div>
            </div>

            <div className="mb-3">
              <h3 className="font-bold text-slate-800 text-base leading-tight mb-0.5 line-clamp-1">{emp.full_name}</h3>
              <p className="text-xs font-bold text-blue-600 mb-1 line-clamp-1">{emp.position}</p>
              
              {/* Added NIK/ID Display */}
              {emp.nickname && (
                 <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded flex items-center gap-1 border border-slate-100">
                        <Hash size={9} />
                        {emp.nickname}
                    </span>
                 </div>
              )}

              {emp.department?.[0] && emp.subdepartment?.[0] && (
                 <p className="text-[10px] text-slate-400 font-medium line-clamp-1">
                   {getSubDeptName(emp.department[0], emp.subdepartment[0])}
                 </p>
              )}
            </div>

            <div className="mt-auto space-y-2 pt-3 border-t border-slate-50">
              {emp.phone && (
                <div className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 transition-colors">
                  <Phone size={12} className="text-slate-400 flex-shrink-0" />
                  <span className="truncate font-medium">{emp.phone}</span>
                </div>
              )}
              {emp.email && (
                <div className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 transition-colors">
                  <Mail size={12} className="text-slate-400 flex-shrink-0" />
                  <span className="truncate font-medium">{emp.email}</span>
                </div>
              )}
              {emp.telegram && (
                <div className="flex items-center gap-2 text-xs text-blue-500 hover:text-blue-600 transition-colors">
                  <MessageCircle size={12} className="flex-shrink-0" />
                  <span className="truncate font-medium">{emp.telegram}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EmployeeList;
