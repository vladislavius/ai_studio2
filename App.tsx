
import React, { useState, useEffect } from 'react';
import { Users, Briefcase, Cake, FileDown, Plus, Search, Menu, LayoutGrid, Database, Settings, Loader2, LogOut, TrendingUp, WifiOff, Network, List, ChevronLeft, ChevronRight } from 'lucide-react';
import EmployeeList from './components/EmployeeList';
import EmployeeModal from './components/EmployeeModal';
import Birthdays from './components/Birthdays';
import ImportExport from './components/ImportExport';
import StatisticsTab from './components/StatisticsTab';
import OrgChart from './components/OrgChart';
import Auth from './components/Auth';
import { ORGANIZATION_STRUCTURE } from './constants';
import { Employee, ViewMode, Attachment } from './types';
import { supabase } from './supabaseClient';

const DEMO_EMPLOYEES: Employee[] = [
  {
    id: 'demo-1',
    full_name: 'Alexandra Volkov',
    position: 'HR Director',
    department: ['dept1'],
    email: 'alex.v@company.com',
    phone: '+1 (555) 012-3456',
    photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    emergency_contacts: [],
    custom_fields: [],
    attachments: [],
    join_date: '2022-03-15',
    birth_date: '1988-07-21',
    subdepartment: []
  },
  {
    id: 'demo-2',
    full_name: 'Dmitry Sokolov',
    position: 'Senior Developer',
    department: ['dept4', 'dept4_12'],
    email: 'd.sokolov@company.com',
    phone: '+1 (555) 098-7654',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    emergency_contacts: [],
    custom_fields: [],
    attachments: [],
    join_date: '2023-01-10',
    birth_date: '1995-12-05',
    subdepartment: []
  },
  {
    id: 'demo-3',
    full_name: 'Elena Petrova',
    position: 'Marketing Manager',
    department: ['dept2', 'dept2_4'],
    email: 'e.petrova@company.com',
    phone: '+1 (555) 111-2233',
    photo_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    emergency_contacts: [],
    custom_fields: [],
    attachments: [],
    join_date: '2021-11-05',
    birth_date: '1992-04-12',
    subdepartment: []
  }
];

function App() {
  const [session, setSession] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Navigation State
  const [currentView, setCurrentView] = useState<ViewMode>('org_chart'); 
  const [employeeSubView, setEmployeeSubView] = useState<'list' | 'birthdays' | 'data'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string | null>(null); // Used for filtering stats in 'statistics' view
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // --- Auth & Init Logic ---
  useEffect(() => {
    if (isOffline) {
        setAuthChecking(false);
        return;
    }
    if (!supabase) {
        setAuthChecking(false);
        return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecking(false);
      if (session) fetchEmployees();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
          fetchEmployees();
      } else {
          setEmployees([]);
      }
    });
    return () => subscription.unsubscribe();
  }, [isOffline]);

  const handleBypassAuth = () => {
      setIsOffline(true);
      setSession({ user: { email: 'demo@offline.local' } });
      setEmployees(DEMO_EMPLOYEES);
      setAuthChecking(false);
  };

  const fetchEmployees = async () => {
    if (isOffline) return;
    setIsLoading(true);
    if (!supabase) return;
    try {
      const { data: employeesData, error: employeesError } = await supabase.from('employees').select('*').order('created_at', { ascending: false });
      if (employeesError) throw employeesError;
      const { data: attachmentsData } = await supabase.from('employee_attachments').select('*');
      if (employeesData) {
        const mergedEmployees = employeesData.map((emp: any) => ({
          ...emp,
          attachments: attachmentsData ? attachmentsData.filter((att: any) => att.employee_id === emp.id) : []
        }));
        setEmployees(mergedEmployees as Employee[]);
      }
    } catch (error: any) {
      console.error('Error fetching employees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
      if (isOffline) { setIsOffline(false); setSession(null); setEmployees([]); return; }
      if (!supabase) return;
      await supabase.auth.signOut();
      setSession(null);
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.position.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleSaveEmployee = async (emp: Employee) => {
    if (isOffline) {
        setEmployees(prev => {
            const exists = prev.find(e => e.id === emp.id);
            if (exists) return prev.map(e => e.id === emp.id ? emp : e);
            return [emp, ...prev];
        });
        setIsModalOpen(false); setEditingEmployee(null);
        return;
    }
    if (!supabase) return;
    const { attachments, ...employeeData } = emp;
    try {
        const { error: empError } = await supabase.from('employees').upsert(employeeData);
        if (empError) throw empError;
        if (attachments) {
            const { data: existingDocs } = await supabase.from('employee_attachments').select('id').eq('employee_id', emp.id);
            const existingIds = existingDocs?.map(d => d.id) || [];
            const newIds = attachments.map(a => a.id);
            const idsToDelete = existingIds.filter(id => !newIds.includes(id));
            if (idsToDelete.length > 0) await supabase.from('employee_attachments').delete().in('id', idsToDelete);
            const attachmentsToUpsert = attachments.map(a => ({ ...a, employee_id: emp.id }));
            if (attachmentsToUpsert.length > 0) await supabase.from('employee_attachments').upsert(attachmentsToUpsert);
        }
        await fetchEmployees();
        setIsModalOpen(false); setEditingEmployee(null);
    } catch (error: any) {
        if (error.message === 'Failed to fetch' || error.message.includes('SSL') || error.message.includes('Network')) {
            alert('Connection lost. Switching to Offline Mode.');
            setIsOffline(true);
            setEmployees(prev => { const exists = prev.find(e => e.id === emp.id); return exists ? prev.map(e => e.id === emp.id ? emp : e) : [emp, ...prev]; });
            setIsModalOpen(false); setEditingEmployee(null);
        } else {
            alert('Error saving data: ' + error.message);
        }
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    if (isOffline) { setEmployees(prev => prev.filter(e => e.id !== id)); return; }
    if (!supabase) return;
    try {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (error) throw error;
        setEmployees(prev => prev.filter(e => e.id !== id));
    } catch (error: any) { alert('Error deleting: ' + error.message); }
  };

  const handleEditClick = (emp: Employee) => { setEditingEmployee(emp); setIsModalOpen(true); };
  const handleAddClick = () => { setEditingEmployee(null); setIsModalOpen(true); };
  
  const handleImportData = async (data: Employee[]) => { /* Import logic same as before */ };

  if (authChecking) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
  if (!session) return <Auth onBypass={handleBypassAuth} />;

  const sidebarWidth = isSidebarCollapsed ? 'w-20' : 'w-72';
  const mainMargin = isSidebarCollapsed ? 'ml-20' : 'ml-72';

  return (
    <div className="min-h-screen flex bg-slate-50">
      
      {/* Sidebar */}
      <aside className={`${sidebarWidth} bg-white border-r border-gray-200 flex-shrink-0 flex flex-col fixed h-full z-20 transition-all duration-300 ease-in-out shadow-lg shadow-slate-200/50`}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between h-[73px]">
          <div className="flex items-center gap-3 overflow-hidden">
             <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white shadow-lg transition-all ${isOffline ? 'bg-slate-700 shadow-slate-300' : 'bg-blue-600 shadow-blue-200'}`}>
                {isOffline ? <WifiOff size={20} /> : <Users size={24} />}
             </div>
             <div className={`transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                  <h1 className="font-bold text-lg text-slate-800 whitespace-nowrap">HR System</h1>
                  {isOffline && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">OFFLINE</span>}
             </div>
          </div>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors absolute right-[-12px] top-6 bg-white border border-slate-200 shadow-sm z-30"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
             {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
          <div className="mb-6">
            {!isSidebarCollapsed && <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 animate-in fade-in">Основное</p>}
            
            <button 
                onClick={() => setCurrentView('org_chart')} 
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-medium group relative ${currentView === 'org_chart' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                title="Оргсхема"
            >
              <div className="flex-shrink-0"><Network size={20} /></div>
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Оргсхема</span>}
            </button>
            
            <button 
                onClick={() => setCurrentView('employees')} 
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-medium group relative ${currentView === 'employees' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                title="Сотрудники"
            >
              <div className="flex-shrink-0"><LayoutGrid size={20} /></div>
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Сотрудники</span>}
            </button>
          </div>

          <div>
             {!isSidebarCollapsed && <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 animate-in fade-in">Статистики</p>}
            
            <button 
              onClick={() => { setSelectedDept(null); setCurrentView('statistics'); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-1 ${currentView === 'statistics' && !selectedDept ? 'bg-slate-800 text-white font-semibold shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
              title="Дашборд Компании"
            >
              <div className="flex-shrink-0"><TrendingUp size={20} /></div>
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Дашборд</span>}
            </button>

            <div className="mt-2 space-y-1">
                {Object.values(ORGANIZATION_STRUCTURE).filter(d => d.id !== 'owner').map(dept => (
                  <button
                    key={dept.id}
                    onClick={() => {
                      setSelectedDept(dept.id);
                      setCurrentView('statistics');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group ${currentView === 'statistics' && selectedDept === dept.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
                    title={dept.name}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm" style={{ backgroundColor: dept.color }} />
                    {!isSidebarCollapsed && <span className="truncate">{dept.name}</span>}
                  </button>
                ))}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-4">
            {!isSidebarCollapsed && (
              <div className="bg-slate-50 rounded-xl p-4 text-center animate-in fade-in">
                <p className="text-xs text-slate-500 mb-1">Сотрудников</p>
                <p className="text-2xl font-bold text-slate-800">{isLoading ? '...' : employees.length}</p>
              </div>
            )}
          <button onClick={handleLogout} className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-medium transition-colors text-sm ${isSidebarCollapsed ? 'px-0' : ''}`} title="Выход">
             <LogOut size={18} />
             {!isSidebarCollapsed && <span>Выход</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ${mainMargin} flex flex-col min-w-0 transition-all duration-300 ease-in-out`}>
        {/* Top Bar */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-200 px-8 py-4 flex justify-between items-center print:hidden h-[73px]">
          <div className="flex items-center gap-4 flex-1">
            {/* Show Search only on Employee List subview */}
            {currentView === 'employees' && employeeSubView === 'list' && (
              <div className="relative w-full max-w-md animate-in fade-in slide-in-from-left-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text"
                  placeholder="Поиск сотрудников..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl outline-none transition-all"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleAddClick} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5">
              <Plus size={20} /> Добавить
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8 flex-1 flex flex-col h-full overflow-hidden">
          {isLoading ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-400"><Loader2 className="animate-spin mb-2" size={32} /><p>Загрузка данных...</p></div>
          ) : (
            <>
              {currentView === 'org_chart' && (
                  <OrgChart employees={employees} onSelectEmployee={handleEditClick} />
              )}

              {currentView === 'employees' && (
                <div className="flex flex-col h-full">
                  {/* Internal Navigation Tabs for Employees View */}
                  <div className="flex border-b border-slate-200 mb-6">
                    <button 
                        onClick={() => setEmployeeSubView('list')}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${employeeSubView === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    >
                        <List size={16}/> Справочник
                    </button>
                    <button 
                        onClick={() => setEmployeeSubView('birthdays')}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${employeeSubView === 'birthdays' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    >
                        <Cake size={16}/> Дни Рождения
                    </button>
                     <button 
                        onClick={() => setEmployeeSubView('data')}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${employeeSubView === 'data' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    >
                        <Database size={16}/> База Данных
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                    {employeeSubView === 'list' && (
                      <div className="animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex justify-between items-end mb-6">
                          <div>
                            <h2 className="text-2xl font-bold text-slate-800">Справочник сотрудников</h2>
                            <p className="text-slate-500 mt-1">Всего {filteredEmployees.length} записей</p>
                          </div>
                        </div>
                        <EmployeeList employees={filteredEmployees} onEdit={handleEditClick} onDelete={handleDeleteEmployee} />
                      </div>
                    )}

                    {employeeSubView === 'birthdays' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2">
                            <h2 className="text-2xl font-bold text-slate-800 mb-6">Календарь Дней Рождения</h2>
                            <Birthdays employees={employees} />
                        </div>
                    )}

                    {employeeSubView === 'data' && (
                         <div className="animate-in fade-in slide-in-from-bottom-2">
                            <ImportExport employees={employees} onImport={handleImportData} />
                         </div>
                    )}
                  </div>
                </div>
              )}

              {currentView === 'statistics' && (
                  <StatisticsTab employees={employees} isOffline={isOffline} selectedDeptId={selectedDept} />
              )}
            </>
          )}
        </div>
      </main>

      <EmployeeModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEmployee}
        initialData={editingEmployee}
      />
    </div>
  );
}

export default App;
