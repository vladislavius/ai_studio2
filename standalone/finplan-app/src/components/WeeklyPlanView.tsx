import React, { useState } from 'react';
import { Calendar, Plus, Edit2, Trash2, CheckCircle2, XCircle, Check, Inbox, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { WeeklyPlan, IncomeForecast, ExpenseProposal, IncomeSource, ExpenseCategory, ExpensePriority, ExpenseStatus, PlanStatus } from '../types';
import { INCOME_SOURCE_LABELS, EXPENSE_CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, PLAN_STATUS_LABELS, DEPARTMENTS } from '../constants';
import { fmtFull, fmtMoney, ruDate } from '../utils';
import { Pill, Modal, Field, Input, Select, Textarea, Button } from './ui';
import { uid } from '../storage';

interface Props {
  plan: WeeklyPlan;
  forecasts: IncomeForecast[];
  proposals: ExpenseProposal[];
  onUpdatePlan: (p: WeeklyPlan) => void;
  onUpdateForecasts: (fs: IncomeForecast[]) => void;
  onUpdateProposals: (ps: ExpenseProposal[]) => void;
}

export const WeeklyPlanView: React.FC<Props> = ({ plan, forecasts, proposals, onUpdatePlan, onUpdateForecasts, onUpdateProposals }) => {
  const [editingForecast, setEditingForecast] = useState<IncomeForecast | null>(null);
  const [creatingForecast, setCreatingForecast] = useState(false);
  const [editingProp, setEditingProp] = useState<ExpenseProposal | null>(null);
  const [creatingProp, setCreatingProp] = useState(false);
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const totalIncomeProj = forecasts.reduce((s, f) => s + f.amount_projected, 0);
  const totalIncomeAct = forecasts.reduce((s, f) => s + f.amount_actual, 0);
  const totalExpAppr = proposals.filter(p => p.status === 'approved' || p.status === 'paid').reduce((s, p) => s + p.amount, 0);

  const filteredProposals = proposals.filter(p =>
    (filterDept === 'all' || p.dept_id === filterDept) &&
    (filterStatus === 'all' || p.status === filterStatus)
  ).sort((a, b) => {
    const pa = PRIORITY_LABELS[a.priority].order;
    const pb = PRIORITY_LABELS[b.priority].order;
    if (pa !== pb) return pa - pb;
    return b.amount - a.amount;
  });

  const advanceStatus = () => {
    const flow: PlanStatus[] = ['draft', 'collecting', 'review', 'approved', 'executing', 'closed'];
    const idx = flow.indexOf(plan.status);
    if (idx < flow.length - 1) onUpdatePlan({ ...plan, status: flow[idx + 1], updated_at: new Date().toISOString() });
  };

  const saveForecast = (f: IncomeForecast) => {
    onUpdateForecasts(forecasts.some(x => x.id === f.id) ? forecasts.map(x => x.id === f.id ? f : x) : [...forecasts, f]);
    setEditingForecast(null); setCreatingForecast(false);
  };
  const delForecast = (id: string) => { if (confirm('Удалить?')) onUpdateForecasts(forecasts.filter(f => f.id !== id)); };

  const saveProp = (p: ExpenseProposal) => {
    onUpdateProposals(proposals.some(x => x.id === p.id) ? proposals.map(x => x.id === p.id ? p : x) : [...proposals, p]);
    setEditingProp(null); setCreatingProp(false);
  };
  const delProp = (id: string) => { if (confirm('Удалить?')) onUpdateProposals(proposals.filter(p => p.id !== id)); };
  const setStatus = (p: ExpenseProposal, status: ExpenseStatus, extra?: Partial<ExpenseProposal>) => {
    saveProp({ ...p, status, ...extra, updated_at: new Date().toISOString() });
  };

  return (
    <div className="space-y-6">
      {/* Шапка плана */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Calendar size={20} className="text-blue-600" />
              <h2 className="text-xl font-bold text-slate-800">Неделя {ruDate(plan.week_start)} — {ruDate(plan.week_end)}</h2>
              <Pill label={PLAN_STATUS_LABELS[plan.status].label} color={PLAN_STATUS_LABELS[plan.status].color} bg={PLAN_STATUS_LABELS[plan.status].bg} size="md" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div><p className="text-[10px] text-slate-400 uppercase font-bold">Доход (план)</p><p className="font-bold text-green-600">{fmtFull(totalIncomeProj)}</p></div>
              <div><p className="text-[10px] text-slate-400 uppercase font-bold">Доход (факт)</p><p className="font-bold text-green-700">{fmtFull(totalIncomeAct)}</p></div>
              <div><p className="text-[10px] text-slate-400 uppercase font-bold">Расходы (утв.)</p><p className="font-bold text-red-600">{fmtFull(totalExpAppr)}</p></div>
              <div><p className="text-[10px] text-slate-400 uppercase font-bold">Прогнозируемая маржа</p><p className={`font-bold ${totalIncomeProj - totalExpAppr >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmtFull(totalIncomeProj - totalExpAppr)}</p></div>
            </div>
          </div>
          {plan.status !== 'closed' && (
            <Button onClick={advanceStatus}>
              Передать дальше <ChevronRight size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Доходы */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-green-600" />
            <h3 className="font-bold text-slate-800">Прогноз доходов</h3>
          </div>
          <Button onClick={() => setCreatingForecast(true)}><Plus size={14} /> Источник</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase text-slate-400 font-bold border-b border-slate-100">
              <tr>
                <th className="text-left py-2 px-2">Источник</th>
                <th className="text-left py-2 px-2">Описание</th>
                <th className="text-right py-2 px-2">План</th>
                <th className="text-right py-2 px-2">Факт</th>
                <th className="text-center py-2 px-2">%</th>
                <th className="text-center py-2 px-2">Уверен.</th>
                <th className="text-center py-2 px-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map(f => {
                const info = INCOME_SOURCE_LABELS[f.source];
                const pct = f.amount_projected > 0 ? (f.amount_actual / f.amount_projected) * 100 : 0;
                return (
                  <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-3 px-2"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} /><span className="font-medium text-slate-700">{info.label}</span></div></td>
                    <td className="py-3 px-2 text-slate-500 text-xs">{f.description || '—'}</td>
                    <td className="py-3 px-2 text-right font-bold text-slate-700">{fmtFull(f.amount_projected)}</td>
                    <td className="py-3 px-2 text-right font-bold text-green-600">{fmtFull(f.amount_actual)}</td>
                    <td className="py-3 px-2 text-center"><span className={`text-xs font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{pct.toFixed(0)}%</span></td>
                    <td className="py-3 px-2 text-center"><Pill label={f.confidence === 'high' ? 'Высокая' : f.confidence === 'medium' ? 'Средняя' : 'Низкая'} color={f.confidence === 'high' ? '#22c55e' : f.confidence === 'medium' ? '#f59e0b' : '#ef4444'} bg={f.confidence === 'high' ? '#f0fdf4' : f.confidence === 'medium' ? '#fffbeb' : '#fef2f2'} /></td>
                    <td className="py-3 px-2 text-center">
                      <div className="inline-flex gap-1">
                        <button onClick={() => setEditingForecast(f)} className="p-1 hover:bg-blue-50 text-blue-600 rounded"><Edit2 size={13} /></button>
                        <button onClick={() => delForecast(f.id)} className="p-1 hover:bg-red-50 text-red-500 rounded"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="text-sm font-bold border-t-2 border-slate-200">
              <tr>
                <td colSpan={2} className="py-3 px-2 text-slate-700">Итого по неделе</td>
                <td className="py-3 px-2 text-right text-slate-700">{fmtFull(totalIncomeProj)}</td>
                <td className="py-3 px-2 text-right text-green-600">{fmtFull(totalIncomeAct)}</td>
                <td className="py-3 px-2 text-center text-slate-700">{totalIncomeProj > 0 ? ((totalIncomeAct / totalIncomeProj) * 100).toFixed(0) : 0}%</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Заявки */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <TrendingDown size={18} className="text-red-600" />
            <h3 className="font-bold text-slate-800">Заявки на расходы</h3>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{filteredProposals.length}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
              <option value="all">Все департаменты</option>
              {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
              <option value="all">Любой статус</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <Button variant="danger" onClick={() => setCreatingProp(true)}><Plus size={14} /> Заявка</Button>
          </div>
        </div>
        <div className="space-y-2">
          {filteredProposals.map(p => {
            const cat = EXPENSE_CATEGORY_LABELS[p.category];
            const pr = PRIORITY_LABELS[p.priority];
            const st = STATUS_LABELS[p.status];
            const dept = DEPARTMENTS.find(d => d.id === p.dept_id);
            return (
              <div key={p.id} className="border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 transition-all">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <h4 className="font-bold text-slate-800 text-sm">{p.title}</h4>
                      <Pill label={pr.label} color={pr.color} bg={pr.bg} />
                      <Pill label={st.label} color={st.color} bg={st.bg} />
                      {p.is_recurring && <Pill label="Регулярный" color="#0891b2" bg="#ecfeff" />}
                    </div>
                    <p className="text-xs text-slate-500 mb-1.5">{p.justification}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />{cat.label}</span>
                      {dept && <span>· {dept.name}</span>}
                      {p.vendor && <span>· {p.vendor}</span>}
                      {p.proposer && <span>· {p.proposer}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-lg font-black text-slate-800">{fmtFull(p.amount)}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {p.status === 'proposed' && (
                        <button onClick={() => setStatus(p, 'reviewed')} className="px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-[11px] font-bold flex items-center gap-1"><Inbox size={12}/>На рассмотрение</button>
                      )}
                      {p.status === 'reviewed' && (<>
                        <button onClick={() => setStatus(p, 'approved')} className="px-2.5 py-1 bg-green-50 text-green-600 hover:bg-green-100 rounded text-[11px] font-bold flex items-center gap-1"><CheckCircle2 size={12}/>Утвердить</button>
                        <button onClick={() => { const r = prompt('Причина отклонения'); if (r !== null) setStatus(p, 'rejected', { rejection_reason: r }); }} className="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[11px] font-bold flex items-center gap-1"><XCircle size={12}/>Отклонить</button>
                      </>)}
                      {p.status === 'approved' && (
                        <button onClick={() => setStatus(p, 'paid', { payment_date: new Date().toISOString().slice(0, 10) })} className="px-2.5 py-1 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded text-[11px] font-bold flex items-center gap-1"><Check size={12}/>Оплачено</button>
                      )}
                      <button onClick={() => setEditingProp(p)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded"><Edit2 size={12}/></button>
                      <button onClick={() => delProp(p.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 size={12}/></button>
                    </div>
                  </div>
                </div>
                {p.rejection_reason && <div className="mt-2 px-3 py-1.5 bg-red-50 rounded-lg text-[11px] text-red-700"><strong>Причина отказа:</strong> {p.rejection_reason}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Формы */}
      {(editingForecast || creatingForecast) && (
        <Modal onClose={() => { setEditingForecast(null); setCreatingForecast(false); }} title={editingForecast ? 'Источник дохода' : 'Новый источник'}>
          <ForecastForm initial={editingForecast || { id: uid(), plan_id: plan.id, source: 'group_tours', amount_projected: 0, amount_actual: 0, confidence: 'medium' }} onSave={saveForecast} onCancel={() => { setEditingForecast(null); setCreatingForecast(false); }} />
        </Modal>
      )}
      {(editingProp || creatingProp) && (
        <Modal onClose={() => { setEditingProp(null); setCreatingProp(false); }} title={editingProp ? 'Заявка на расход' : 'Новая заявка'}>
          <ProposalForm initial={editingProp || { id: uid(), plan_id: plan.id, dept_id: 'dept3', category: 'other', title: '', justification: '', amount: 0, priority: 'normal', status: 'proposed', proposer: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }} onSave={saveProp} onCancel={() => { setEditingProp(null); setCreatingProp(false); }} />
        </Modal>
      )}
    </div>
  );
};

const ForecastForm: React.FC<{ initial: IncomeForecast; onSave: (f: IncomeForecast) => void; onCancel: () => void }> = ({ initial, onSave, onCancel }) => {
  const [f, setF] = useState(initial);
  return (
    <div className="space-y-3">
      <Field label="Источник дохода">
        <Select value={f.source} onChange={e => setF({ ...f, source: e.target.value as IncomeSource })}>
          {Object.entries(INCOME_SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </Field>
      <Field label="Описание"><Input value={f.description || ''} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="План, ₽"><Input type="number" value={f.amount_projected} onChange={e => setF({ ...f, amount_projected: parseFloat(e.target.value) || 0 })} /></Field>
        <Field label="Факт, ₽"><Input type="number" value={f.amount_actual} onChange={e => setF({ ...f, amount_actual: parseFloat(e.target.value) || 0 })} /></Field>
      </div>
      <Field label="Уверенность">
        <Select value={f.confidence} onChange={e => setF({ ...f, confidence: e.target.value as 'high' | 'medium' | 'low' })}>
          <option value="high">Высокая (подтверждённые брони)</option>
          <option value="medium">Средняя (заявки в работе)</option>
          <option value="low">Низкая (потенциал)</option>
        </Select>
      </Field>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="ghost" onClick={onCancel}>Отмена</Button>
        <Button onClick={() => onSave(f)}>Сохранить</Button>
      </div>
    </div>
  );
};

const ProposalForm: React.FC<{ initial: ExpenseProposal; onSave: (p: ExpenseProposal) => void; onCancel: () => void }> = ({ initial, onSave, onCancel }) => {
  const [p, setP] = useState(initial);
  return (
    <div className="space-y-3">
      <Field label="Название заявки"><Input value={p.title} onChange={e => setP({ ...p, title: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Департамент"><Select value={p.dept_id} onChange={e => setP({ ...p, dept_id: e.target.value })}>{DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        <Field label="Категория"><Select value={p.category} onChange={e => setP({ ...p, category: e.target.value as ExpenseCategory })}>{Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Сумма, ₽"><Input type="number" value={p.amount} onChange={e => setP({ ...p, amount: parseFloat(e.target.value) || 0 })} /></Field>
        <Field label="Приоритет"><Select value={p.priority} onChange={e => setP({ ...p, priority: e.target.value as ExpensePriority })}>{Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
      </div>
      <Field label="Обоснование"><Textarea rows={2} value={p.justification} onChange={e => setP({ ...p, justification: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Кто подаёт"><Input value={p.proposer} onChange={e => setP({ ...p, proposer: e.target.value })} /></Field>
        <Field label="Получатель"><Input value={p.vendor || ''} onChange={e => setP({ ...p, vendor: e.target.value })} /></Field>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={!!p.is_recurring} onChange={e => setP({ ...p, is_recurring: e.target.checked })} />
        <span className="text-sm text-slate-600">Регулярный платёж</span>
      </label>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="ghost" onClick={onCancel}>Отмена</Button>
        <Button onClick={() => onSave(p)}>Сохранить</Button>
      </div>
    </div>
  );
};
