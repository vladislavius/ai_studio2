
import React, { useState, useEffect } from 'react';
import { StatisticDefinition, StatisticValue } from '../types';
import { supabase } from '../supabaseClient';
import { ORGANIZATION_STRUCTURE } from '../constants';
import { Edit2, Trash2, Plus, X, Search, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const StatisticsEngineering: React.FC = () => {
  const [definitions, setDefinitions] = useState<StatisticDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit State for Definition
  const [editingDef, setEditingDef] = useState<Partial<StatisticDefinition> | null>(null);
  
  // Value Management State
  const [selectedStatForValues, setSelectedStatForValues] = useState<StatisticDefinition | null>(null);
  const [statValues, setStatValues] = useState<StatisticValue[]>([]);
  const [editingValue, setEditingValue] = useState<Partial<StatisticValue> | null>(null);

  useEffect(() => {
    fetchDefinitions();
  }, []);

  const fetchDefinitions = async () => {
    setLoading(true);
    if (!supabase) return;
    const { data } = await supabase.from('statistics_definitions').select('*').order('title');
    if (data) setDefinitions(data);
    setLoading(false);
  };

  const fetchValues = async (statId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('statistics_values').select('*').eq('definition_id', statId).order('date', { ascending: false });
    if (data) setStatValues(data);
  };

  // --- DEFINITION CRUD ---
  const handleSaveDef = async () => {
    if (!editingDef || !supabase) return;
    if (!editingDef.title || !editingDef.owner_id) { alert("Title and Owner are required"); return; }
    if (editingDef.id) { await supabase.from('statistics_definitions').update(editingDef).eq('id', editingDef.id); } 
    else { await supabase.from('statistics_definitions').insert([editingDef]); }
    setEditingDef(null);
    fetchDefinitions();
  };

  const handleDeleteDef = async (id: string) => {
      if(!confirm("УДАЛЕНИЕ СТАТИСТИКИ\n\nВы уверены? Это удалит саму статистику и ВСЕ её исторические значения безвозвратно.")) return;
      if (!supabase) return;
      await supabase.from('statistics_values').delete().eq('definition_id', id);
      await supabase.from('statistics_definitions').delete().eq('id', id);
      fetchDefinitions();
  };

  // --- VALUE CRUD ---
  const handleOpenValues = (stat: StatisticDefinition) => {
      setSelectedStatForValues(stat);
      fetchValues(stat.id);
      setEditingValue({ definition_id: stat.id, date: new Date().toISOString().split('T')[0], value: 0 });
  };

  const handleSaveValue = async () => {
      if (!editingValue || !supabase) return;
      if (editingValue.id) { await supabase.from('statistics_values').update({ value: editingValue.value, date: editingValue.date }).eq('id', editingValue.id); } 
      else { await supabase.from('statistics_values').insert([{ definition_id: selectedStatForValues?.id, date: editingValue.date, value: editingValue.value }]); }
      if (selectedStatForValues) fetchValues(selectedStatForValues.id);
      setEditingValue({ definition_id: selectedStatForValues?.id, date: new Date().toISOString().split('T')[0], value: 0 });
  };

  const handleDeleteValue = async (id: string) => {
      if (!confirm("Удалить это значение?")) return;
      if (!supabase) return;
      await supabase.from('statistics_values').delete().eq('id', id);
      if (selectedStatForValues) fetchValues(selectedStatForValues.id);
  };

  const filteredDefs = definitions.filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase()));

  const getOwnerName = (id?: string) => {
      if (!id) return '-';
      if (ORGANIZATION_STRUCTURE[id]) return ORGANIZATION_STRUCTURE[id].fullName;
      for (const key in ORGANIZATION_STRUCTURE) {
          const dept = ORGANIZATION_STRUCTURE[key];
          if (dept.departments && dept.departments[id]) return `${dept.name} -> ${dept.departments[id].name}`;
      }
      return id; 
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in">
        <div className="flex justify-between items-center mb-6 gap-6 px-1">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="Поиск по названию..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={() => setEditingDef({ title: '', type: 'department', inverted: false, is_favorite: false })} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 hover:-translate-y-0.5 transition-all">
                <Plus size={18}/> Создать Статистику
            </button>
        </div>

        <div className="flex gap-6 flex-1 overflow-hidden">
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase sticky top-0 z-10 border-b border-slate-200">
                            <tr><th className="px-6 py-4">Название</th><th className="px-6 py-4">Владелец</th><th className="px-6 py-4">Тип</th><th className="px-6 py-4 text-right">Действия</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredDefs.map(def => (
                                <tr key={def.id} className="hover:bg-blue-50/50 transition-colors group">
                                    <td className="px-6 py-4"><div className="font-bold text-slate-800 text-base">{def.title}</div>{def.is_favorite && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold mr-2">ГСД</span>}{def.inverted && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">Обратная</span>}</td>
                                    <td className="px-6 py-4 text-slate-600 font-medium">{getOwnerName(def.owner_id)}</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold uppercase">{def.type}</span></td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenValues(def)} className="p-2 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100" title="Данные"><Calendar size={16}/></button>
                                        <button onClick={() => setEditingDef(def)} className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" title="Изменить"><Edit2 size={16}/></button>
                                        <button onClick={() => handleDeleteDef(def.id)} className="p-2 bg-red-50 text-red-600 rounded hover:bg-red-100" title="Удалить"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {editingDef && (
                <div className="w-96 bg-white rounded-2xl border border-slate-200 shadow-xl p-6 flex flex-col animate-in slide-in-from-right-10 z-20">
                    <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg">{editingDef.id ? 'Редактировать' : 'Новая Статистика'}</h3><button onClick={() => setEditingDef(null)}><X className="text-slate-400 hover:text-slate-600"/></button></div>
                    <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Название</label><input value={editingDef.title || ''} onChange={e => setEditingDef({...editingDef, title: e.target.value})} className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm" placeholder="Например: Валовый Доход" /></div>
                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Владелец</label><select value={editingDef.owner_id || ''} onChange={e => setEditingDef({...editingDef, owner_id: e.target.value})} className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"><option value="">Выберите владельца...</option>{Object.values(ORGANIZATION_STRUCTURE).map(dept => (<React.Fragment key={dept.id}><option value={dept.id} className="font-bold text-slate-900">⭐ {dept.fullName}</option>{dept.departments && Object.values(dept.departments).map(sub => (<option key={sub.id} value={sub.id} className="text-slate-600">&nbsp;&nbsp;&nbsp;↳ {sub.name}</option>))}</React.Fragment>))}</select></div>
                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Описание</label><textarea value={editingDef.description || ''} onChange={e => setEditingDef({...editingDef, description: e.target.value})} className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-xl min-h-[100px] focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm" placeholder="Краткое описание статистики..." /></div>
                        <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={editingDef.is_favorite || false} onChange={e => setEditingDef({...editingDef, is_favorite: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-blue-600" /><span className="text-sm font-medium text-slate-700">ГСД (Главная статистика)</span></label>
                            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={editingDef.inverted || false} onChange={e => setEditingDef({...editingDef, inverted: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-blue-600" /><span className="text-sm font-medium text-slate-700">Обратная (Меньше = Лучше)</span></label>
                            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={editingDef.is_double || false} onChange={e => setEditingDef({...editingDef, is_double: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-blue-600" /><span className="text-sm font-medium text-slate-700">Двойная (2 графика)</span></label>
                        </div>
                    </div>
                    <button onClick={handleSaveDef} className="mt-6 w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5">Сохранить изменения</button>
                </div>
            )}

            {selectedStatForValues && !editingDef && (
                <div className="w-96 bg-white rounded-2xl border border-slate-200 shadow-xl p-6 flex flex-col animate-in slide-in-from-right-10 z-20">
                     <div className="flex justify-between items-center mb-4 pb-4 border-b"><div><h3 className="font-bold text-slate-800 leading-tight">{selectedStatForValues.title}</h3><p className="text-xs text-slate-400">История значений</p></div><button onClick={() => setSelectedStatForValues(null)}><X className="text-slate-400 hover:text-slate-600"/></button></div>
                    <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-100">
                        <div className="flex gap-2 mb-2"><input type="date" value={editingValue?.date || ''} onChange={e => setEditingValue({...editingValue, date: e.target.value})} className="w-32 border border-slate-300 bg-white rounded-lg px-2 py-1.5 text-sm" /><input type="number" value={editingValue?.value || 0} onChange={e => setEditingValue({...editingValue, value: parseFloat(e.target.value)})} className="flex-1 border border-slate-300 bg-white rounded-lg px-2 py-1.5 text-sm font-bold" /></div>
                        <div className="flex justify-end gap-2">{editingValue?.id && <button onClick={() => setEditingValue({ definition_id: selectedStatForValues.id, date: new Date().toISOString().split('T')[0], value: 0 })} className="text-xs text-slate-400 underline">Отмена</button>}<button onClick={handleSaveValue} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-blue-700">ОК</button></div>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                        {statValues.map(val => (
                            <div key={val.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded border-b border-transparent hover:border-slate-100 group"><div><div className="text-sm font-bold text-slate-700">{val.value.toLocaleString()}</div><div className="text-xs text-slate-400">{format(new Date(val.date), 'dd.MM.yyyy')}</div></div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => setEditingValue(val)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={12}/></button><button onClick={() => handleDeleteValue(val.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={12}/></button></div></div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default StatisticsEngineering;
