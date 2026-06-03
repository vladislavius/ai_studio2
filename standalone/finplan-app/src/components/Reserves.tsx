import React, { useState } from 'react';
import { PiggyBank, Plus, Edit2, Trash2, Target, Layers } from 'lucide-react';
import { ReserveAccount, ReserveType } from '../types';
import { RESERVE_TYPE_LABELS } from '../constants';
import { fmtMoney, fmtFull } from '../utils';
import { Pill, Modal, Field, Input, Select, Button, StatCard } from './ui';
import { uid } from '../storage';

interface Props {
  reserves: ReserveAccount[];
  onUpdate: (rs: ReserveAccount[]) => void;
}

export const Reserves: React.FC<Props> = ({ reserves, onUpdate }) => {
  const [editing, setEditing] = useState<ReserveAccount | null>(null);
  const [creating, setCreating] = useState(false);

  const totalAllocation = reserves.reduce((s, r) => s + (r.allocation_percent || 0), 0);
  const totalBalance = reserves.reduce((s, r) => s + r.balance, 0);

  const save = (r: ReserveAccount) => {
    onUpdate(reserves.some(x => x.id === r.id) ? reserves.map(x => x.id === r.id ? r : x) : [...reserves, r]);
    setEditing(null); setCreating(false);
  };
  const del = (id: string) => { if (confirm('Удалить счёт?')) onUpdate(reserves.filter(r => r.id !== id)); };

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard icon={<PiggyBank size={20}/>} color="#8b5cf6" label="Сумма по резервам" value={fmtMoney(totalBalance)} sub={`По ${reserves.length} счетам`} />
        <StatCard icon={<Target size={20}/>} color={totalAllocation === 100 ? '#22c55e' : '#f59e0b'} label="Аллокация" value={`${totalAllocation}%`} sub={totalAllocation === 100 ? 'Корректно' : 'Должно быть 100%'} />
        <StatCard icon={<Layers size={20}/>} color="#0ea5e9" label="Типов счетов" value={String(new Set(reserves.map(r => r.type)).size)} sub="Уникальных" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PiggyBank size={18} className="text-purple-600"/>
            <h3 className="font-bold text-slate-800">Резервные счета и правила распределения</h3>
          </div>
          <Button onClick={() => setCreating(true)}><Plus size={14}/> Счёт</Button>
        </div>
        <div className="space-y-3">
          {reserves.map(r => {
            const info = RESERVE_TYPE_LABELS[r.type];
            const pct = r.target_balance && r.target_balance > 0 ? (r.balance / r.target_balance) * 100 : 100;
            return (
              <div key={r.id} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-bold text-slate-800">{r.name}</h4>
                      <Pill label={info.label} color={info.color} bg={info.color + '15'}/>
                      {!r.is_active && <Pill label="Архив" color="#94a3b8" bg="#f1f5f9"/>}
                    </div>
                    <p className="text-xs text-slate-500">{r.description || info.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-800">{fmtFull(r.balance)}</p>
                    {r.target_balance ? <p className="text-[11px] text-slate-400">цель: {fmtFull(r.target_balance)}</p> : null}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-slate-500 mt-2 flex-wrap">
                  {r.allocation_percent !== undefined && <span><strong className="text-slate-700">{r.allocation_percent}%</strong> от вал. дохода</span>}
                  {r.min_balance ? <span>Неснижаемый: <strong className="text-slate-700">{fmtFull(r.min_balance)}</strong></span> : null}
                  {r.bank_name && <span>Банк: <strong className="text-slate-700">{r.bank_name}</strong></span>}
                </div>
                {r.target_balance ? (
                  <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: info.color }}/>
                  </div>
                ) : null}
                <div className="flex gap-1 justify-end mt-3">
                  <button onClick={() => setEditing(r)} className="px-2.5 py-1 hover:bg-slate-100 text-slate-600 rounded text-[11px] font-bold flex items-center gap-1"><Edit2 size={12}/>Изменить</button>
                  <button onClick={() => del(r.id)} className="px-2.5 py-1 hover:bg-red-50 text-red-500 rounded text-[11px] font-bold flex items-center gap-1"><Trash2 size={12}/>Удалить</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(editing || creating) && (
        <Modal onClose={() => { setEditing(null); setCreating(false); }} title={editing ? 'Редактирование счёта' : 'Новый счёт'}>
          <ReserveForm initial={editing || { id: uid(), name: '', type: 'operational', balance: 0, allocation_percent: 0, is_active: true }} onSave={save} onCancel={() => { setEditing(null); setCreating(false); }} />
        </Modal>
      )}
    </div>
  );
};

const ReserveForm: React.FC<{ initial: ReserveAccount; onSave: (r: ReserveAccount) => void; onCancel: () => void }> = ({ initial, onSave, onCancel }) => {
  const [r, setR] = useState(initial);
  return (
    <div className="space-y-3">
      <Field label="Название счёта"><Input value={r.name} onChange={e => setR({ ...r, name: e.target.value })} /></Field>
      <Field label="Тип">
        <Select value={r.type} onChange={e => setR({ ...r, type: e.target.value as ReserveType })}>
          {Object.entries(RESERVE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.description}</option>)}
        </Select>
      </Field>
      <Field label="Описание"><Input value={r.description || ''} onChange={e => setR({ ...r, description: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Текущий остаток, ₽"><Input type="number" value={r.balance} onChange={e => setR({ ...r, balance: parseFloat(e.target.value) || 0 })} /></Field>
        <Field label="Целевой остаток, ₽"><Input type="number" value={r.target_balance || 0} onChange={e => setR({ ...r, target_balance: parseFloat(e.target.value) || 0 })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="% от вал. дохода"><Input type="number" value={r.allocation_percent || 0} onChange={e => setR({ ...r, allocation_percent: parseFloat(e.target.value) || 0 })} /></Field>
        <Field label="Неснижаемый остаток, ₽"><Input type="number" value={r.min_balance || 0} onChange={e => setR({ ...r, min_balance: parseFloat(e.target.value) || 0 })} /></Field>
      </div>
      <Field label="Банк"><Input value={r.bank_name || ''} onChange={e => setR({ ...r, bank_name: e.target.value })} /></Field>
      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={r.is_active} onChange={e => setR({ ...r, is_active: e.target.checked })}/><span className="text-sm text-slate-600">Активный счёт</span></label>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="ghost" onClick={onCancel}>Отмена</Button>
        <Button onClick={() => onSave(r)}>Сохранить</Button>
      </div>
    </div>
  );
};
