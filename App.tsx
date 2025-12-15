
import React, { useState, useEffect } from 'react';
import { Users, Briefcase, Cake, FileDown, Plus, Search, Menu, LayoutGrid, Database, Settings as SettingsIcon, Loader2, LogOut, TrendingUp, WifiOff, Network, List, ChevronLeft, ChevronRight, X, Shield, Edit3, Lock, Filter } from 'lucide-react';
import EmployeeList from './components/EmployeeList';
import EmployeeModal from './components/EmployeeModal';
import Birthdays from './components/Birthdays';
import Settings from './components/Settings'; 
import StatisticsTab from './components/StatisticsTab';
import OrgChart from './components/OrgChart';
import Auth from './components/Auth';
import ConfirmationModal from './components/ConfirmationModal';
import { ORGANIZATION_STRUCTURE, ADMIN_EMAILS } from './constants';
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

// --- SORT ORDER CONSTANT ---
const DEPT_SORT_ORDER = ['owner', 'dept7', 'dept1', 'dept2', 'dept3', 'dept4', 'dept5', 'dept6'];

function App() {
  const [session, setSession] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Navigation State
  const [currentView, setCurrentView] = useState<ViewMode>('org_chart'); 
  const [employeeSubView, setEmployeeSubView] = useState<'list' | 'birthdays'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  
  // Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const isAdmin = isOffline || (session?.user?.email && ADMIN_EMAILS.includes(session.user.email));

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
      setSession({ user: { email: ADMIN_EMAILS[0] } });
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
      
      let attachmentsData: any[] = [];
      try {
          const { data: att, error: attError } = await supabase.from('employee_attachments').select('*');
          if (!attError && att) attachmentsData = att;
      } catch (err) {
          console.warn("Could not fetch attachments, continuing without them.", err);
      }

      if (employeesData) {
        const mergedEmployees = employeesData.map((emp: any) => ({
          ...emp,
          attachments: attachmentsData.filter((att: any) => att.employee_id === emp.id)
        }));
        setEmployees(mergedEmployees as Employee[]);
      }
    } catch (error: any) {
      console.error('Error fetching employees:', error);
      // Removed native alert to prevent sandbox errors
      console.error('Ошибка загрузки сотрудников: ' + error.message);
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

  const filteredEmployees = employees
    .filter(emp => {
        const matchesSearch = emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              emp.position.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = deptFilter === 'all' || emp.department?.includes(deptFilter);
        return matchesSearch && matchesDept;
    })
    .sort((a, b) => {
        const deptA = a.department?.[0] || 'other';
        const deptB = b.department?.[0] || 'other';
        const indexA = DEPT_SORT_ORDER.indexOf(deptA);
        const indexB = DEPT_SORT_ORDER.indexOf(deptB);
        const safeIndexA = indexA === -1 ? 999 : indexA;
        const safeIndexB = indexB === -1 ? 999 : indexB;

        if (safeIndexA !== safeIndexB) return safeIndexA - safeIndexB;
        return a.full_name.localeCompare(b.full_name);
    });

  const sanitizePayload = (emp: Employee) => {
      const { attachments, ...data } = emp;
      const payload: any = { ...data };
      const dateFields = ['birth_date', 'join_date', 'passport_date', 'foreign_passport_date'];
      dateFields.forEach(field => {
          if (payload[field] === '') {
              payload[field] = null;
          }
      });
      return { payload, attachments };
  };

  const handleSaveEmployee = async (emp: Employee) => {
    if (!isAdmin) return;

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
    
    const { payload, attachments } = sanitizePayload(emp);
    
    try {
        const { error: empError } = await supabase.from('employees').upsert(payload);
        
        if (empError) {
            console.error("Supabase Save Error:", empError);
            return;
        }
        
        if (attachments && attachments.length > 0) {
            try {
                const { data: existingDocs } = await supabase.from('employee_attachments').select('id').eq('employee_id', emp.id);
                const existingIds = existingDocs?.map(d => d.id) || [];
                const newIds = attachments.map(a => a.id);
                const idsToDelete = existingIds.filter(id => !newIds.includes(id));
                
                if (idsToDelete.length > 0) await supabase.from('employee_attachments').delete().in('id', idsToDelete);
                
                const attachmentsToUpsert = attachments
                    .filter(a => a.file_name && a.public_url)
                    .map(a => ({ 
                        id: a.id,
                        employee_id: emp.id,
                        file_name: a.file_name,
                        file_type: a.file_type,
                        file_size: a.file_size,
                        storage_path: a.storage_path,
                        public_url: a.public_url,
                        uploaded_at: a.uploaded_at
                    }));
                
                if (attachmentsToUpsert.length > 0) await supabase.from('employee_attachments').upsert(attachmentsToUpsert);
            } catch (attErr) {
                console.warn("Attachment saving failed (table missing?), skipping.", attErr);
            }
        }
        await fetchEmployees();
        setIsModalOpen(false); setEditingEmployee(null);
    } catch (error: any) {
        console.error('Critical Error:', error.message);
    }
  };

  // REPLACED NATIVE CONFIRM WITH CUSTOM MODAL
  const handleDeleteEmployeeRequest = (id: string) => {
      if (!isAdmin) return;
      const empName = employees.find(e => e.id === id)?.full_name || 'этого сотрудника';
      
      setConfirmModal({
          isOpen: true,
          title: 'Удаление сотрудника',
          message: `Вы собираетесь удалить ${empName}.\nЭто действие удалит карточку, все файлы и личные статистики.\nВосстановить данные будет невозможно.`,
          onConfirm: () => executeDeleteEmployee(id)
      });
  };

  const executeDeleteEmployee = async (id: string) => {
    setConfirmModal(prev => ({ ...prev, isOpen: false })); // Close modal immediately
    
    if (isOffline) { 
        setEmployees(prev => prev.filter(e => e.id !== id)); 
        return; 
    }
    
    if (!supabase) return;

    try {
        setIsLoading(true);
        // MANUAL CASCADE DELETE to prevent FK constraints issues
        
        // 1. Delete Attachments
        await supabase.from('employee_attachments').delete().eq('employee_id', id);

        // 2. Delete Stats (Values then Definitions)
        const { data: stats } = await supabase.from('statistics_definitions').select('id').eq('owner_id', id);
        if (stats && stats.length > 0) {
            const statIds = stats.map(s => s.id);
            await supabase.from('statistics_values').delete().in('definition_id', statIds);
            await supabase.from('statistics_definitions').delete().in('id', statIds);
        }

        // 3. Delete Employee
        const { error } = await supabase.from('employees').delete().eq('id', id);
        
        if (error) throw error;
        
        setEmployees(prev => prev.filter(e => e.id !== id));
    } catch (error: any) { 
        console.error("Delete failed", error);
        // Use console instead of alert
    } finally {
        setIsLoading(false);
    }
  };

  const handleEditClick = (emp: Employee) => { 
      setEditingEmployee(emp); 
      setIsModalOpen(true); 
  };
  
  const handleAddClick = () => { 
      if (!isAdmin) return;
      setEditingEmployee(null); 
      setIsModalOpen(true); 
  };
  
  const handleImportData = async (data: Employee[]) => {
      if (!isAdmin) return;
      if (isOffline) {
          setEmployees(data);
          return;
      }
      setIsLoading(true);
      for(const emp of data) {
          await handleSaveEmployee(emp);
      }
      setIsLoading(false);
  };

  if (authChecking) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
  if (!session) return <Auth onBypass={handleBypassAuth} />;

  const sidebarWidth = isSidebarCollapsed ? 'w-20' : 'w-72';
  const sidebarMobileClasses = isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full';

  return (
    <div className="min-h-screen flex bg-slate-50 overflow-hidden relative">
      
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 z-20 md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
      )}

      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        isDanger={true}
        confirmLabel="Удалить"
      />

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-30 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out shadow-lg shadow-slate-200/50 md:relative md:translate-x-0 ${sidebarWidth} ${sidebarMobileClasses}`}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between h-[73px]">
          <div className="flex items-center gap-3 overflow-hidden">
             <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white shadow-lg transition-all ${isOffline ? 'bg-slate-700 shadow-slate-300' : 'bg-blue-600 shadow-blue-200'}`}>
                {isOffline ? <WifiOff size={20} /> : <Users size={24} />}
             </div>
             <div className={`transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 w-0 hidden md:block' : 'opacity-100'}`}>
                  <h1 className="font-bold text-lg text-slate-800 whitespace-nowrap">HR System</h1>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-1 ${isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                      {isAdmin ? 'ADMIN' : 'USER'}
                  </span>
             </div>
          </div>
          
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={20}/></button>
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:block p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors absolute right-[-12px] top-6 bg-white border border-slate-200 shadow-sm z-30">
             {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
          <div className="mb-6">
            {!isSidebarCollapsed && <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 animate-in fade-in">Основное</p>}
            
            <button onClick={() => { setCurrentView('org_chart'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-medium group relative ${currentView === 'org_chart' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
              <div className="flex-shrink-0"><Network size={20} /></div>
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Оргсхема</span>}
            </button>
            
            {isAdmin && (
                <button onClick={() => { setCurrentView('employees'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-medium group relative ${currentView === 'employees' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
                <div className="flex-shrink-0"><LayoutGrid size={20} /></div>
                {!isSidebarCollapsed && <span className="whitespace-nowrap">Сотрудники</span>}
                </button>
            )}
          </div>

          <div>
             {!isSidebarCollapsed && <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 animate-in fade-in">Статистики</p>}
            
            <button onClick={() => { setSelectedDept(null); setCurrentView('statistics'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-1 ${currentView === 'statistics' && !selectedDept ? 'bg-slate-800 text-white font-semibold shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
              <div className="flex-shrink-0"><TrendingUp size={20} /></div>
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Дашборд</span>}
            </button>

            <div className="mt-2 space-y-1">
                {Object.values(ORGANIZATION_STRUCTURE).filter(d => d.id !== 'owner').map(dept => (
                  <button
                    key={dept.id}
                    onClick={() => { setSelectedDept(dept.id); setCurrentView('statistics'); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group ${currentView === 'statistics' && selectedDept === dept.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm" style={{ backgroundColor: dept.color }} />
                    {!isSidebarCollapsed && <span className="truncate">{dept.name}</span>}
                  </button>
                ))}
            </div>
          </div>

          {/* ADMIN SETTINGS */}
          {isAdmin && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                  {!isSidebarCollapsed && <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 animate-in fade-in">Конфигурация</p>}
                  <button onClick={() => { setCurrentView('settings'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-medium group relative ${currentView === 'settings' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
                      <div className="flex-shrink-0"><SettingsIcon size={20} /></div>
                      {!isSidebarCollapsed && <span className="whitespace-nowrap">Настройки</span>}
                  </button>
              </div>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-4">
            {!isSidebarCollapsed && isAdmin && (
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
      <main className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out h-full overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-200 px-4 md:px-8 py-4 flex justify-between items-center print:hidden h-[73px]">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"><Menu size={24} /></button>
            
            {/* SEARCH BAR (Global) */}
            {currentView !== 'settings' && (
                <div className="relative w-full max-w-xs md:max-w-md animate-in fade-in slide-in-from-left-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input type="text" placeholder="Поиск по имени или должности..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl outline-none transition-all text-sm md:text-base"/>
                </div>
            )}

            {/* ADMIN QUICK TOOLBAR */}
            {isAdmin && currentView !== 'settings' && (
                <div className="hidden md:flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl border border-slate-200/50 ml-4 animate-in fade-in">
                   <button onClick={handleAddClick} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition-all flex items-center gap-1.5" title="Новый сотрудник">
                      <Plus size={14}/> <span>Сотрудник</span>
                   </button>
                   <div className="w-px h-4 bg-slate-300 mx-1"></div>
                   <button onClick={() => { setCurrentView('statistics'); setSelectedDept(null); }} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg transition-all flex items-center gap-1.5" title="Перейти к управлению статистиками">
                      <TrendingUp size={14}/> <span>Дашборд</span>
                   </button>
                </div>
            )}
          </div>

          <div className="flex items-center gap-3">
             {/* Profile / Admin Badge */}
             <div className="flex items-center gap-2">
                 <div className="text-right hidden sm:block">
                     <p className="text-xs font-bold text-slate-800">{session?.user?.email}</p>
                     <p className="text-[10px] text-slate-400 font-medium">Текущая сессия</p>
                 </div>
                 <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold border-2 border-white shadow-sm ${isAdmin ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                     {isAdmin ? <Shield size={16}/> : <Lock size={16}/>}
                 </div>
             </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-4 md:p-8">
          {isLoading ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-400"><Loader2 className="animate-spin mb-2" size={32} /><p>Загрузка данных...</p></div>
          ) : (
            <>
              {currentView === 'org_chart' && <OrgChart employees={employees} onSelectEmployee={handleEditClick} />}
              {currentView === 'settings' && isAdmin && <Settings employees={employees} onImport={handleImportData} />}
              {currentView === 'statistics' && <StatisticsTab employees={employees} isOffline={isOffline} selectedDeptId={selectedDept} isAdmin={isAdmin} />}

              {currentView === 'employees' && isAdmin && (
                <div className="flex flex-col h-full">
                  <div className="flex flex-col md:flex-row justify-between md:items-end mb-6 gap-4">
                      {/* Tabs */}
                      <div className="flex border-b border-slate-200 overflow-x-auto">
                        <button onClick={() => setEmployeeSubView('list')} className={`px-4 md:px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${employeeSubView === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}><List size={16}/> Справочник</button>
                        <button onClick={() => setEmployeeSubView('birthdays')} className={`px-4 md:px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${employeeSubView === 'birthdays' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}><Cake size={16}/> Дни Рождения</button>
                      </div>

                      {/* NEW: Department Filter for List View */}
                      {employeeSubView === 'list' && (
                        <div className="flex items-center gap-2 animate-in fade-in">
                            <div className="relative">
                                <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                <select 
                                    value={deptFilter} 
                                    onChange={(e) => setDeptFilter(e.target.value)}
                                    className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none appearance-none cursor-pointer shadow-sm hover:border-blue-300 transition-colors"
                                >
                                    <option value="all">Все департаменты</option>
                                    <option disabled>──────────</option>
                                    {DEPT_SORT_ORDER.map(deptId => {
                                        const dept = ORGANIZATION_STRUCTURE[deptId];
                                        if(!dept) return null;
                                        return <option key={deptId} value={deptId}>{dept.name}</option>
                                    })}
                                </select>
                                <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                            </div>
                        </div>
                      )}
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                    {employeeSubView === 'list' && (
                      <div className="animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex justify-between items-end mb-6">
                          <div>
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800">Справочник сотрудников</h2>
                            <p className="text-slate-500 mt-1 text-sm">
                                Всего {filteredEmployees.length} записей
                                {deptFilter !== 'all' && <span className="ml-1 text-blue-600 font-medium">(Фильтр: {ORGANIZATION_STRUCTURE[deptFilter]?.name})</span>}
                            </p>
                          </div>
                        </div>
                        <EmployeeList employees={filteredEmployees} onEdit={handleEditClick} onDelete={handleDeleteEmployeeRequest} />
                      </div>
                    )}
                    {employeeSubView === 'birthdays' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-6">Календарь Дней Рождения</h2>
                            <Birthdays employees={employees} />
                        </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <EmployeeModal 
        isOpen={isModalOpen}
        isReadOnly={!isAdmin}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEmployee}
        initialData={editingEmployee}
      />
    </div>
  );
}

export default App;
