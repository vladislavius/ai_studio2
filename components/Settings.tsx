
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
        <div className="flex flex-col h-full bg-slate-50 p-6">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-200">
                    <SettingsIcon size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Настройки Системы</h1>
                    <p className="text-slate-500 text-sm">Управление профилем компании и резервными копиями</p>
                </div>
            </div>

            <div className="flex gap-2 mb-6 border-b border-slate-200 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('general')}
                    className={`px-6 py-3 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${activeTab === 'general' ? 'bg-white border-slate-800 text-slate-800 shadow-sm' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                >
                    <Globe size={18} />
                    Общие (Профиль)
                </button>
                <button 
                    onClick={() => setActiveTab('database')}
                    className={`px-6 py-3 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${activeTab === 'database' ? 'bg-white border-emerald-600 text-emerald-600 shadow-sm' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                >
                    <Database size={18} />
                    База Данных
                </button>
            </div>

            <div className="flex-1 bg-white rounded-b-2xl rounded-tr-2xl shadow-sm border border-slate-200 overflow-hidden relative -top-[1px]">
                {activeTab === 'general' && (
                    <div className="h-full overflow-y-auto p-8 custom-scrollbar animate-in fade-in">
                        <div className="max-w-2xl">
                            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Globe className="text-slate-400"/> Профиль Компании</h2>
                            
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Название Организации</label>
                                    <input 
                                        value={companyName} 
                                        onChange={e => setCompanyName(e.target.value)} 
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Основная Валюта</label>
                                        <select 
                                            value={currency}
                                            onChange={e => setCurrency(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                        >
                                            <option value="THB">THB (Тайский Бат)</option>
                                            <option value="USD">USD (Доллар США)</option>
                                            <option value="RUB">RUB (Рубль)</option>
                                            <option value="EUR">EUR (Евро)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Часовой пояс</label>
                                        <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-500" disabled>
                                            <option>Asia/Bangkok (GMT+7)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-100">
                                    <button className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg shadow-slate-200">
                                        <Save size={18} />
                                        Сохранить настройки
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'database' && (
                    <div className="h-full overflow-y-auto p-6 custom-scrollbar">
                        <ImportExport employees={employees} onImport={onImport} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;
