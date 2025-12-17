import React, { useRef } from 'react';
import { Employee } from '../types';
import { Download, Upload, FileJson, FileType, Database, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface ImportExportProps {
  employees: Employee[];
  onImport: (data: Employee[]) => void;
}

const ImportExport: React.FC<ImportExportProps> = ({ employees, onImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadJSON = () => {
    const data = JSON.stringify(employees, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hr_system_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  // Convert Employees to CSV with ALL fields from Supabase schema
  const handleDownloadCSV = () => {
      const headers = [
          'id', 'full_name', 'position', 'nickname', 'email', 'email2', 'phone', 'whatsapp', 'telegram',
          'birth_date', 'join_date', 'photo_url', 'additional_info', 'actual_address', 'registration_address',
          'bank_name', 'bank_details', 'crypto_wallet', 'crypto_network', 'crypto_currency', 'inn',
          'passport_number', 'passport_date', 'passport_issuer', 'foreign_passport', 'foreign_passport_date',
          'foreign_passport_issuer', 'department', 'subdepartment'
      ];
      
      const rows = employees.map(emp => {
          const escape = (v: any) => {
              if (v === null || v === undefined) return '';
              if (Array.isArray(v)) return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
              return `"${String(v).replace(/"/g, '""')}"`;
          };

          return [
              emp.id,
              escape(emp.full_name),
              escape(emp.position),
              escape(emp.nickname),
              escape(emp.email),
              escape(emp.email2),
              escape(emp.phone),
              escape(emp.whatsapp),
              escape(emp.telegram),
              escape(emp.birth_date),
              escape(emp.join_date),
              escape(emp.photo_url),
              escape(emp.additional_info),
              escape(emp.actual_address),
              escape(emp.registration_address),
              escape(emp.bank_name),
              escape(emp.bank_details),
              escape(emp.crypto_wallet),
              escape(emp.crypto_network),
              escape(emp.crypto_currency),
              escape(emp.inn),
              escape(emp.passport_number),
              escape(emp.passport_date),
              escape(emp.passport_issuer),
              escape(emp.foreign_passport),
              escape(emp.foreign_passport_date),
              escape(emp.foreign_passport_issuer),
              escape(emp.department),
              escape(emp.subdepartment)
          ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hr_system_full_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleCSVImportClick = () => {
      csvInputRef.current?.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            if (window.confirm(`Найдено ${parsed.length} записей. Это заменит текущие данные. Продолжить?`)) {
                 onImport(parsed);
            }
          }
        } catch (err) {
          alert('Ошибка чтения JSON файла.');
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsText(file);
    }
  };

  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
              try {
                  const content = e.target?.result as string;
                  const lines = content.split('\n');
                  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                  const newEmployees: Employee[] = [];
                  
                  for(let i=1; i<lines.length; i++) {
                      if(!lines[i].trim()) continue;
                      const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                      const emp: any = {};
                      
                      headers.forEach((header, idx) => {
                          let val = cols[idx]?.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
                          if (header === 'department' || header === 'subdepartment') {
                              try { emp[header] = JSON.parse(val); } catch { emp[header] = []; }
                          } else {
                              emp[header] = val || null;
                          }
                      });
                      
                      if (!emp.id) emp.id = crypto.randomUUID();
                      emp.emergency_contacts = emp.emergency_contacts || [];
                      emp.custom_fields = emp.custom_fields || [];
                      emp.attachments = emp.attachments || [];
                      
                      newEmployees.push(emp as Employee);
                  }

                  if (window.confirm(`Импортировать ${newEmployees.length} сотрудников из CSV?`)) {
                      onImport(newEmployees);
                  }
              } catch(err) {
                  alert('Ошибка парсинга CSV.');
              }
              if (csvInputRef.current) csvInputRef.current.value = '';
          };
          reader.readAsText(file);
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Управление данными системы</h2>
            <p className="text-slate-500 mt-1">Резервное копирование и восстановление базы данных.</p>
        </div>
        
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-6 rounded-2xl border border-emerald-100 shadow-sm">
            <div className="flex items-start gap-4">
                <div className="bg-white p-3 rounded-xl shadow-sm text-emerald-600">
                    <FileSpreadsheet size={32} />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-emerald-900">Экспорт в Excel (Полный)</h3>
                    <p className="text-sm text-emerald-700 mt-1 mb-4">
                        Скачайте полную базу сотрудников со всеми полями (29 колонок) для редактирования в Excel или Google Таблицах.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={handleDownloadCSV} className="px-4 py-2 bg-white text-emerald-700 border border-emerald-200 font-bold rounded-xl text-sm hover:bg-emerald-50 transition-colors shadow-sm flex items-center gap-2">
                            <Download size={16}/> Скачать CSV
                        </button>
                        <button onClick={handleCSVImportClick} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-sm hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2">
                            <Upload size={16}/> Загрузить CSV
                        </button>
                        <input type="file" ref={csvInputRef} onChange={handleCSVImport} accept=".csv" className="hidden" />
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                    <FileJson size={24} />
                </div>
                <h3 className="font-bold text-lg text-slate-800 mb-2">JSON Бэкап</h3>
                <p className="text-sm text-slate-500 mb-6">Полный дамп базы данных в формате JSON для технических целей.</p>
                <div className="flex gap-2">
                    <button onClick={handleDownloadJSON} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors">
                        <Download size={18} /> Экспорт
                    </button>
                    <button onClick={handleImportClick} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-200 text-blue-600 font-medium hover:bg-blue-50 transition-colors">
                        <Upload size={18} /> Импорт
                    </button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4 items-start">
                <AlertCircle className="text-amber-500 flex-shrink-0" size={24} />
                <div>
                    <h4 className="font-bold text-amber-800 text-sm">Важное примечание</h4>
                    <p className="text-sm text-amber-700 mt-1">При редактировании CSV файла в Excel не меняйте структуру колонок и ID сотрудников, чтобы избежать ошибок при обратной загрузке.</p>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ImportExport;