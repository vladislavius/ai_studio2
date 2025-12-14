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

  const formatFileSize = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper for full export from list (same as Modal)
  const quickExportTxt = (e: React.MouseEvent, emp: EmployeeType) => {
    e.stopPropagation();
    const lines = [
        "========================================",
        "          FULL EMPLOYEE DOSSIER         ",
        "========================================",
        "",
        "[1] PERSONAL INFORMATION",
        `Full Name:          ${emp.full_name}`,
        `Position:           ${emp.position}`,
        `System ID:          ${emp.id}`,
        `Nickname (NIK):     ${emp.nickname || 'N/A'}`,
        `Birth Date:         ${emp.birth_date || '-'}`,
        `Join Date:          ${emp.join_date || '-'}`,
        "",
        "[2] CONTACTS",
        `Phone:              ${emp.phone || '-'}`,
        `WhatsApp:           ${emp.whatsapp || '-'}`,
        `Telegram:           ${emp.telegram || '-'}`,
        `Work Email:         ${emp.email || '-'}`,
        `Personal Email:     ${emp.email2 || '-'}`,
        "",
        "[3] ORGANIZATION",
        `Department:         ${emp.department?.map(d => ORGANIZATION_STRUCTURE[d]?.name).join(', ') || '-'}`,
        `Sub-Department:     ${emp.subdepartment?.map(s => {
             const deptId = emp.department?.[0];
             return deptId ? ORGANIZATION_STRUCTURE[deptId]?.departments?.[s]?.name : s;
        }).join(', ') || '-'}`,
        "",
        "[4] ADDRESSES",
        `Actual Address:     ${emp.actual_address || '-'}`,
        `Registration Addr:  ${emp.registration_address || '-'}`,
        "",
        "[5] DOCUMENTS",
        `INN:                ${emp.inn || '-'}`,
        `-- Domestic Passport --`,
        `Number:             ${emp.passport_number || '-'}`,
        `Issued Date:        ${emp.passport_date || '-'}`,
        `Issued By:          ${emp.passport_issuer || '-'}`,
        `-- Foreign Passport --`,
        `Number:             ${emp.foreign_passport || '-'}`,
        `Issued Date:        ${emp.foreign_passport_date || '-'}`,
        `Issued By:          ${emp.foreign_passport_issuer || '-'}`,
        "",
        "[6] FINANCE",
        `Bank Name:          ${emp.bank_name || '-'}`,
        `Account Details:    ${emp.bank_details || '-'}`,
        `Crypto Wallet:      ${emp.crypto_wallet || '-'}`,
        `Crypto Network:     ${emp.crypto_network || '-'}`,
        `Crypto Currency:    ${emp.crypto_currency || '-'}`,
        "",
        "[7] EMERGENCY CONTACTS",
        ...(emp.emergency_contacts.length ? emp.emergency_contacts.map((c, i) => 
            `${i+1}. ${c.name} (${c.relation}) | Phone: ${c.phone} | TG: ${c.telegram || '-'}`
        ) : ['No emergency contacts recorded.']),
        "",
        "[8] ATTACHED FILES",
        ...(emp.attachments?.length ? emp.attachments.map((f, i) => 
            `${i+1}. ${f.file_name} (${f.file_type}) - ${f.public_url}`
        ) : ['No files attached.']),
        "",
        "[9] ADDITIONAL NOTES",
        `${emp.additional_info || 'None'}`,
        "",
        "========================================",
        `Report Generated: ${new Date().toLocaleString()}`,
        "========================================",
    ];
    
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${emp.full_name.replace(/\s+/g, '_')}_full_dossier.txt`;
    a.click();
  };

  const quickPrint = (e: React.MouseEvent, emp: EmployeeType) => {
    e.stopPropagation();
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
        <div key={emp.id} onClick={() => onEdit(emp)} className="group bg-white rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 overflow-hidden flex flex-col relative cursor-pointer">
          
          {/* Top colored banner */}
          <div className="h-24 w-full relative overflow-hidden" style={{ backgroundColor: getDeptColor(emp.department?.[0]) + '20' }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-10 -mt-10 blur-xl"></div>
            
            <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(emp.id); }}
                  className="p-1.5 bg-white/80 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg shadow-sm backdrop-blur-sm transition-all"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
            </div>

            <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
               <button 
                  onClick={(e) => quickExportTxt(e, emp)}
                  className="p-1.5 bg-white/80 hover:bg-white text-gray-500 rounded-lg shadow-sm backdrop-blur-sm transition-all"
                  title="Export Full TXT"
                >
                  <FileText size={14} />
                </button>
                <button 
                  onClick={(e) => quickPrint(e, emp)}
                  className="p-1.5 bg-white/80 hover:bg-white text-gray-500 rounded-lg shadow-sm backdrop-blur-sm transition-all"
                  title="Print Full Dossier"
                >
                  <Printer size={14} />
                </button>
            </div>

          </div>
          
          <div className="px-6 pb-6 flex-1 flex flex-col -mt-12">
            <div className="relative mb-4 self-start">
              <div className="w-24 h-24 rounded-3xl bg-white p-1 shadow-md">
                 <div className="w-full h-full rounded-2xl overflow-hidden bg-gray-100 relative">
                    {emp.photo_url ? (
                      <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><User size={40} /></div>
                    )}
                 </div>
              </div>
              <div className="absolute -bottom-2 -right-2 bg-white p-1 rounded-full shadow-sm" title={getDeptName(emp.department?.[0])}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: getDeptColor(emp.department?.[0]) }}>
                    {getDeptName(emp.department?.[0]).substring(0,2).toUpperCase()}
                  </div>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">{emp.full_name}</h3>
              <p className="text-sm font-medium text-blue-600 mb-1">{emp.position}</p>
              
              {/* Added NIK/ID Display */}
              {emp.nickname && (
                 <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                        <Hash size={10} />
                        NIK: {emp.nickname}
                    </span>
                 </div>
              )}

              {emp.department?.[0] && emp.subdepartment?.[0] && (
                 <p className="text-xs text-gray-400 font-medium">
                   {getSubDeptName(emp.department[0], emp.subdepartment[0])}
                 </p>
              )}
            </div>

            <div className="mt-auto space-y-3 pt-4 border-t border-gray-50">
              {emp.phone && (
                <div className="flex items-center gap-3 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  <Phone size={14} className="text-gray-400" />
                  <span className="truncate">{emp.phone}</span>
                </div>
              )}
              {emp.email && (
                <div className="flex items-center gap-3 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  <Mail size={14} className="text-gray-400" />
                  <span className="truncate">{emp.email}</span>
                </div>
              )}
              {emp.telegram && (
                <div className="flex items-center gap-3 text-sm text-blue-500 hover:text-blue-600 transition-colors">
                  <MessageCircle size={14} />
                  <span className="truncate">{emp.telegram}</span>
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