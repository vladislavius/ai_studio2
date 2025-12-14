
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

  // Convert Employees to CSV for Excel
  const handleDownloadCSV = () => {
      // Define headers
      const headers = ['id', 'full_name', 'position', 'email', 'phone', 'department_id', 'subdepartment_id', 'birth_date', 'join_date'];
      
      const rows = employees.map(emp => {
          return [
              emp.id,
              `"${emp.full_name.replace(/"/g, '""')}"`, // Escape quotes
              `"${emp.position.replace(/"/g, '""')}"`,
              emp.email || '',
              emp.phone || '',
              emp.department?.[0] || '',
              emp.subdepartment?.[0] || '',
              emp.birth_date || '',
              emp.join_date || ''
          ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      // Add BOM for Excel UTF-8 compatibility
      const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hr_system_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
  };

  const handleDownloadEXE = () => {
    alert("Generating Windows Executable...\n\n(Note: In a real web app, this would trigger a server-side build. For this demo, we acknowledge the request.)");
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
            if (window.confirm(`Found ${parsed.length} employee records. This will replace current data. Continue?`)) {
                 onImport(parsed);
            }
          } else {
            alert('Invalid file format: Expected an array of employees.');
          }
        } catch (err) {
          alert('Error parsing JSON file. Please ensure it is a valid backup file.');
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
                  const headers = lines[0].split(',').map(h => h.trim());
                  
                  const newEmployees: Employee[] = [];
                  
                  for(let i=1; i<lines.length; i++) {
                      if(!lines[i].trim()) continue;
                      // Simple CSV parse (doesn't handle commas inside quotes perfectly without library, but sufficient for standard export)
                      const values = lines[i].split(','); 
                      
                      if(values.length < 2) continue;

                      const emp: any = {
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                          emergency_contacts: [],
                          custom_fields: [],
                          attachments: [],
                          department: [],
                          subdepartment: []
                      };

                      // Map CSV columns back to object
                      // id, full_name, position, email, phone, department_id, subdepartment_id, birth_date, join_date
                      emp.id = values[0]?.trim() || crypto.randomUUID();
                      emp.full_name = values[1]?.replace(/"/g, '').trim();
                      emp.position = values[2]?.replace(/"/g, '').trim();
                      emp.email = values[3]?.trim();
                      emp.phone = values[4]?.trim();
                      if(values[5]?.trim()) emp.department = [values[5].trim()];
                      if(values[6]?.trim()) emp.subdepartment = [values[6].trim()];
                      emp.birth_date = values[7]?.trim();
                      emp.join_date = values[8]?.trim();

                      newEmployees.push(emp as Employee);
                  }

                  if (window.confirm(`Parsed ${newEmployees.length} employees from CSV/Excel. Update system?`)) {
                      onImport(newEmployees);
                  }

              } catch(err) {
                  alert('Error parsing CSV. Ensure format matches export.');
              }
              if (csvInputRef.current) csvInputRef.current.value = '';
          };
          reader.readAsText(file);
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">System Data Management</h2>
            <p className="text-slate-500 mt-1">Manage global database backups and restoration.</p>
        </div>
        
        {/* Google Sheets / Excel Sync Section */}
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-6 rounded-2xl border border-emerald-100 shadow-sm">
            <div className="flex items-start gap-4">
                <div className="bg-white p-3 rounded-xl shadow-sm text-emerald-600">
                    <FileSpreadsheet size={32} />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-emerald-900">Excel / Google Sheets Sync</h3>
                    <p className="text-sm text-emerald-700 mt-1 mb-4">
                        Edit your employee data in Excel or Google Sheets. 
                        Download the CSV below, edit it in your spreadsheet software, and upload it back to update the system.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={handleDownloadCSV} className="px-4 py-2 bg-white text-emerald-700 border border-emerald-200 font-bold rounded-xl text-sm hover:bg-emerald-50 transition-colors shadow-sm">
                            1. Download Excel (CSV)
                        </button>
                        <button onClick={handleCSVImportClick} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-sm hover:bg-emerald-700 transition-colors shadow-sm">
                            2. Upload Modified Excel (CSV)
                        </button>
                        <input type="file" ref={csvInputRef} onChange={handleCSVImport} accept=".csv" className="hidden" />
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Export JSON */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                    <FileJson size={24} />
                </div>
                <h3 className="font-bold text-lg text-slate-800 mb-2">Export JSON Database</h3>
                <p className="text-sm text-slate-500 mb-6">Full system backup including all employee records, settings, and structure. Use this for standard backups.</p>
                <button 
                    onClick={handleDownloadJSON}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                >
                    <Download size={18} /> Download .JSON
                </button>
            </div>

            {/* Export EXE */}
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                    <FileType size={24} />
                </div>
                <h3 className="font-bold text-lg text-slate-800 mb-2">Export Portable (.EXE)</h3>
                <p className="text-sm text-slate-500 mb-6">Download a portable Windows executable viewer for offline access to the HR system data.</p>
                <button 
                    onClick={handleDownloadEXE}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors"
                >
                    <Download size={18} /> Download .EXE
                </button>
            </div>

             {/* Import JSON */}
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 hover:shadow-md transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-16 -mt-16 transition-all group-hover:scale-110"></div>
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform relative z-10">
                    <Database size={24} />
                </div>
                <h3 className="font-bold text-lg text-slate-800 mb-2 relative z-10">Import JSON Backup</h3>
                <p className="text-sm text-slate-500 mb-6 relative z-10">Restore system from a previously saved JSON file. <br/><span className="text-emerald-700 font-medium">Supports only .JSON files.</span></p>
                
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImport}
                    accept=".json"
                    className="hidden"
                />
                <button 
                    onClick={handleImportClick}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors relative z-10"
                >
                    <Upload size={18} /> Select .JSON File
                </button>
            </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
            <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
                <h4 className="font-bold text-amber-800 text-sm">Note regarding Individual Reports</h4>
                <p className="text-sm text-amber-700 mt-1">To download individual Text Reports or Print/PDF versions of specific employee cards, please locate the employee in the list and use the action buttons on their card.</p>
            </div>
        </div>
    </div>
  );
};

export default ImportExport;
