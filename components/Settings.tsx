
import React, { useState } from 'react';
import ImportExport from './ImportExport';
import { Employee } from '../types';
import { Database, Settings as SettingsIcon, Globe, Save } from 'lucide-react';

interface SettingsProps {
    employees: Employee[];
    onImport: (data: Employee[]) => void;
}

const Settings: React.FC<SettingsProps> = ({ employees, onImport }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'database'>('general');
    
    // Mock settings state
    const [companyName, setCompanyName] = useState('Остров Сокровищ');
    const [currency, setCurrency] = useState('THB');

    return (
        <div className="flex flex-col h-full animate-in fade-in space-y-4">
            
            {/* Header / Tabs Container (Matches Stats Header Style) */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-3 px-1">
                    <div className="p-2 bg-slate-800 text-white rounded-lg shadow-sm">
                        <SettingsIcon size={18} />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">Настройки</h1>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">Система и данные</p>
                    </div>
                </div>

                <div className="relative">
                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 -mx-1 px-1">
                        <button 
                            onClick={() => setActiveTab('general')}
                            className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-lg transition-all border flex items-center gap-2 ${activeTab === 'general' ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}
                        >
                            <Globe size={14} />
                            Профиль
                        </button>
                        <button 
                            onClick={() => setActiveTab('database')}
                            className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-lg transition-all border flex items-center gap-2 ${activeTab === 'database' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}
                        >
                            <Database size={14} />
                            База Данных
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
                {activeTab === 'general' && (
                    <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar animate-in fade-in">
                        <div className="max-w-xl mx-auto space-y-6">
                            
                            {/* Card Style Input Group */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Название Организации</label>
                                    <input 
                                        value={companyName} 
                                        onChange={e => setCompanyName(e.target.value)} 
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 text-sm shadow-sm"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Основная Валюта</label>
                                        <select 
                                            value={currency}
                                            onChange={e => setCurrency(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 text-sm shadow-sm appearance-none cursor-pointer"
                                        >
                                            <option value="THB">THB (Тайский Бат)</option>
                                            <option value="USD">USD (Доллар США)</option>
                                            <option value="RUB">RUB (Рубль)</option>
                                            <option value="EUR">EUR (Евро)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Часовой пояс</label>
                                        <div className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-500 text-sm flex items-center justify-between opacity-70">
                                            <span>Asia/Bangkok (GMT+7)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 flex justify-end">
                                <button className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg shadow-slate-200 text-sm">
                                    <Save size={16} />
                                    Сохранить настройки
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'database' && (
                    <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar">
                        <ImportExport employees={employees} onImport={onImport} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;
