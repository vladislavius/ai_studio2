import React, { useMemo, useState } from 'react';
import { Target, Plus, Edit2, Trash2, Calculator, TrendingUp, AlertTriangle, FileCheck, CheckCircle2, Circle, ArrowRight, Percent, Info } from 'lucide-react';
import { FP1LineItem, FP1SectionKey, SVDHistoryPoint, FP1DocStatus, FP1DocKey, WeeklyPlan, IncomeForecast } from '../types';
import { FP1_SECTION_LABELS, FP1_DOC_PACKAGE, APPROVAL_PIPELINE, ALLOCATION_PRIORITIES } from '../constants';
import { fmtFull, fmtMoney } from '../utils';
import { Modal, Field, Input, Select, Button, Pill } from './ui';
import { uid } from '../storage';

interface Props {
  fp1: FP1LineItem[];
  svdHistory: SVDHistoryPoint[];
  docs: FP1DocStatus[];
  plan: WeeklyPlan;
  forecasts: IncomeForecast[];
  onUpdateFp1: (items: FP1LineItem[]) => void;
  onUpdateDocs: (docs: FP1DocStatus[]) => void;
  onAdvanceStage: () => void;
}

export const FP1View: React.FC<Props> = ({ fp1, svdHistory, docs, plan, forecasts, onUpdateFp1, onUpdateDocs, onAdvanceStage }) => {
  const [editing, setEditing] = useState<FP1LineItem | null>(null);
  const [creating, setCreating] = useState<FP1SectionKey | null>(null);
  const [overduePct, setOverduePct] = useState(12); // % от СВД на просрочку
  const [overdueExists, setOverdueExists] = useState(true);
  const [reservePct, setReservePct] = useState(5); // % от СВД на резерв

  const avgSVD = useMemo(() => {
    if (!svdHistory.length) return 0;
    return svdHistory.reduce((s, p) => s + p.adjusted_income, 0) / svdHistory.length;
  }, [svdHistory]);

  const lineAmount = (l: FP1LineItem): number => l.is_percent ? avgSVD * (l.percent_of_svd || 0) / 100 : l.weekly_amount;

  const sectionTotals = useMemo(() => {
    const m: Record<FP1SectionKey, number> = { personnel: 0, basic_needs: 0, promotion: 0, comms: 0, delivery: 0, commodity: 0 };
    fp1.forEach(l => { m[l.section] += lineAmount(l); });
    return m;
  }, [fp1, avgSVD]);

  const breakEven = (['personnel', 'basic_needs', 'promotion', 'comms', 'delivery'] as FP1SectionKey[])
    .reduce((s, k) => s + sectionTotals[k], 0);
  const commodityTotal = sectionTotals.commodity;

  const plannedIncome = forecasts.reduce((s, f) => s + f.amount_projected, 0);
  const breakEvenGap = plannedIncome - breakEven;
  const breakEvenStatus: 'below' | 'at' | 'above' = breakEvenGap < -avgSVD * 0.05 ? 'below' : breakEvenGap < avgSVD * 0.05 ? 'at' : 'above';

  // Распределение свободного остатка
  const overdueAmt = overdueExists ? avgSVD * overduePct / 100 : 0;
  const reserveAmt = avgSVD * reservePct / 100;
  const freeForExpansion = Math.max(0, plannedIncome - breakEven - overdueAmt - reserveAmt);

  const docsReady = docs.filter(d => d.ready).length;
  const allDocsReady = docsReady === docs.length;

  const saveLine = (l: FP1LineItem) => {
    onUpdateFp1(fp1.some(x => x.id === l.id) ? fp1.map(x => x.id === l.id ? l : x) : [...fp1, l]);
    setEditing(null); setCreating(null);
  };
  const delLine = (id: string) => {
    if (!confirm('Удалить строку ФП №1?')) return;
    onUpdateFp1(fp1.filter(x => x.id !== id));
  };
  const toggleDoc = (k: FP1DocKey) => {
    onUpdateDocs(docs.map(d => d.key === k ? { ...d, ready: !d.ready, prepared_at: !d.ready ? new Date().toISOString() : d.prepared_at } : d));
  };

  const currentStageIdx = APPROVAL_PIPELINE.findIndex(s => s.stage === plan.approval_stage);

  return (
    <div className="space-y-6">
      {/* Переломная точка */}
      <div className={`rounded-2xl border-2 p-6 ${breakEvenStatus === 'below' ? 'border-red-300 bg-red-50/50' : breakEvenStatus === 'at' ? 'border-amber-300 bg-amber-50/50' : 'border-emerald-300 bg-emerald-50/50'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Target size={20} className={breakEvenStatus === 'below' ? 'text-red-600' : breakEvenStatus === 'at' ? 'text-amber-600' : 'text-emerald-600'} />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Переломная точка по ФП №1</p>
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-1">{fmtFull(breakEven)} / неделя</h2>
            <p className="text-sm text-slate-600">
              Минимально необходимый доход для покрытия базовых расходов (разделы 1–5).
              {breakEvenStatus === 'below' && <span className="text-red-700 font-bold"> Доход НИЖЕ переломной — урезайте расходы.</span>}
              {breakEvenStatus === 'at'    && <span className="text-amber-700 font-bold"> Доход на грани — нужен запас прочности.</span>}
              {breakEvenStatus === 'above' && <span className="text-emerald-700 font-bold"> Доход выше — компания зарабатывает на расширение.</span>}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">План дохода</p>
              <p className="font-black text-lg text-slate-800">{fmtMoney(plannedIncome)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Средний СВД</p>
              <p className="font-black text-lg text-slate-800">{fmtMoney(avgSVD)}</p>
              <p className="text-[9px] text-slate-400">за {svdHistory.length} нед.</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Запас</p>
              <p className={`font-black text-lg ${breakEvenGap >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtMoney(breakEvenGap)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Калькулятор распределения */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <Calculator size={18} className="text-blue-600" />
          <h3 className="font-bold text-slate-800">Калькулятор распределения дохода (приоритеты по регламенту)</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">Поправки А/Б/В из регламента ФП №1: средний СВД, урезание при превышении, отчисления на просрочку и резерв.</p>

        <div className="grid md:grid-cols-2 gap-3 mb-4 p-3 bg-slate-50 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={overdueExists} onChange={e => setOverdueExists(e.target.checked)} />
            <span className="text-slate-700">У компании есть просроченные счета</span>
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">% на просрочку:</span>
            <input type="number" min={10} max={15} value={overduePct} onChange={e => setOverduePct(parseFloat(e.target.value) || 10)} className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-sm" />
            <span className="text-slate-400">(норма 10–15)</span>
          </div>
          <div className="flex items-center gap-2 text-sm md:col-span-2">
            <span className="text-slate-600">% на резерв:</span>
            <input type="number" min={5} max={20} value={reservePct} onChange={e => setReservePct(parseFloat(e.target.value) || 5)} className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-sm" />
            <span className="text-slate-400">(минимум 5)</span>
          </div>
        </div>

        <div className="space-y-2">
          {[
            { ...ALLOCATION_PRIORITIES[0], amount: breakEven, share: plannedIncome > 0 ? (breakEven / plannedIncome) * 100 : 0 },
            { ...ALLOCATION_PRIORITIES[1], amount: overdueAmt, share: plannedIncome > 0 ? (overdueAmt / plannedIncome) * 100 : 0 },
            { ...ALLOCATION_PRIORITIES[2], amount: reserveAmt, share: plannedIncome > 0 ? (reserveAmt / plannedIncome) * 100 : 0 },
            { ...ALLOCATION_PRIORITIES[3], amount: freeForExpansion, share: plannedIncome > 0 ? (freeForExpansion / plannedIncome) * 100 : 0 },
          ].map(p => (
            <div key={p.order} className="border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white" style={{ backgroundColor: p.color }}>{p.order}</div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{p.label}</p>
                  <p className="text-xs text-slate-500">{p.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-slate-800">{fmtFull(p.amount)}</p>
                <p className="text-[10px] text-slate-400">{p.rule} · {p.share.toFixed(1)}% дохода</p>
              </div>
              <div className="w-20">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full" style={{ width: `${Math.min(100, p.share)}%`, backgroundColor: p.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Разделы ФП №1 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Программа ФП №1 — 6 разделов расчёта</h3>
            <p className="text-xs text-slate-500 mt-0.5">Разделы 1–5 = переломная точка. Раздел 6 ведётся отдельно.</p>
          </div>
        </div>

        <div className="space-y-4">
          {(Object.keys(FP1_SECTION_LABELS) as FP1SectionKey[]).map(key => {
            const info = FP1_SECTION_LABELS[key];
            const lines = fp1.filter(l => l.section === key).sort((a, b) => a.sort_order - b.sort_order);
            const total = sectionTotals[key];
            return (
              <div key={key} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: info.color + '12' }}>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: info.color }}>Раздел {info.num}</p>
                    <h4 className="font-bold text-slate-800">{info.label}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{info.description}</p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Итого</p>
                      <p className="font-black text-lg" style={{ color: info.color }}>{fmtFull(total)}</p>
                    </div>
                    <Button variant="ghost" onClick={() => setCreating(key)} className="!p-2">
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase text-slate-400 font-bold bg-slate-50">
                    <tr>
                      <th className="text-left py-2 px-3">Статья</th>
                      <th className="text-left py-2 px-3">Комментарий</th>
                      <th className="text-right py-2 px-3">Сумма</th>
                      <th className="text-center py-2 px-3 w-20">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(l => (
                      <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">{l.title}</span>
                            {l.is_percent && <Pill label={`${l.percent_of_svd}% СВД`} color="#8b5cf6" bg="#f5f3ff" />}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-500">{l.notes || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">{fmtFull(lineAmount(l))}</td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex gap-1">
                            <button onClick={() => setEditing(l)} className="p-1 hover:bg-blue-50 text-blue-600 rounded"><Edit2 size={13} /></button>
                            <button onClick={() => delLine(l.id)} className="p-1 hover:bg-red-50 text-red-500 rounded"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!lines.length && (
                      <tr><td colSpan={4} className="text-center text-slate-400 text-xs py-4 italic">Строк нет — нажмите ＋ чтобы добавить</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <div className="mt-5 p-4 bg-slate-50 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Переломная точка (разделы 1–5)</p>
            <p className="text-2xl font-black text-slate-800">{fmtFull(breakEven)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Товарный счёт (раздел 6, отдельно)</p>
            <p className="text-lg font-bold text-cyan-700">{fmtFull(commodityTotal)}</p>
          </div>
        </div>
      </div>

      {/* Пайплайн утверждения */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRight size={18} className="text-blue-600" />
          <h3 className="font-bold text-slate-800">Пайплайн утверждения недельного финплана</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {APPROVAL_PIPELINE.map((s, i) => {
            const isCurrent = i === currentStageIdx;
            const isPast = i < currentStageIdx || plan.approval_stage === 'done';
            const isDone = plan.approval_stage === 'done' || isPast;
            return (
              <div key={s.stage} className={`relative border-2 rounded-xl p-4 transition-all ${isCurrent ? 'shadow-md' : ''}`} style={{ borderColor: isDone ? s.color : isCurrent ? s.color : '#e2e8f0', backgroundColor: isDone || isCurrent ? s.color + '08' : 'white' }}>
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{ backgroundColor: s.color }}>
                    {isDone ? <CheckCircle2 size={14}/> : i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 text-sm">{s.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{s.actor}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-snug">{s.description}</p>
                {isCurrent && (
                  <button onClick={onAdvanceStage} className="mt-3 w-full px-3 py-1.5 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5" style={{ backgroundColor: s.color }}>
                    Передать дальше <ArrowRight size={12} />
                  </button>
                )}
                {isDone && !isCurrent && (
                  <p className="mt-3 text-[10px] font-bold text-emerald-600 uppercase">✓ Стадия пройдена</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Пакет документов */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileCheck size={18} className="text-emerald-600" />
            <h3 className="font-bold text-slate-800">Пакет документов для финпланирования</h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${allDocsReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{docsReady}/{docs.length}</span>
          </div>
          {!allDocsReady && <Pill label="Не все документы готовы" color="#b45309" bg="#fef3c7" size="md" />}
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {docs.map(d => {
            const info = FP1_DOC_PACKAGE[d.key];
            return (
              <button key={d.key} onClick={() => toggleDoc(d.key)} className={`text-left border rounded-xl p-3 transition-all ${d.ready ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="flex items-start gap-2.5">
                  {d.ready ? <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" /> : <Circle size={18} className="text-slate-300 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 text-sm">{info.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{info.description}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Готовит: <strong>{info.preparer}</strong>{d.prepared_at && d.ready ? ` · ${new Date(d.prepared_at).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Формы добавления/редактирования */}
      {(editing || creating) && (
        <Modal onClose={() => { setEditing(null); setCreating(null); }} title={editing ? 'Редактирование строки ФП №1' : `Новая строка — ${FP1_SECTION_LABELS[creating!].label}`} size="md">
          <LineForm
            initial={editing || { id: uid(), section: creating!, title: '', weekly_amount: 0, sort_order: 999 }}
            onSave={saveLine}
            onCancel={() => { setEditing(null); setCreating(null); }}
          />
        </Modal>
      )}
    </div>
  );
};

const LineForm: React.FC<{ initial: FP1LineItem; onSave: (l: FP1LineItem) => void; onCancel: () => void }> = ({ initial, onSave, onCancel }) => {
  const [l, setL] = useState<FP1LineItem>(initial);
  return (
    <div className="space-y-3">
      <Field label="Раздел">
        <Select value={l.section} onChange={e => setL({ ...l, section: e.target.value as FP1SectionKey })}>
          {(Object.keys(FP1_SECTION_LABELS) as FP1SectionKey[]).map(k => (
            <option key={k} value={k}>{FP1_SECTION_LABELS[k].num}. {FP1_SECTION_LABELS[k].label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Название статьи"><Input value={l.title} onChange={e => setL({ ...l, title: e.target.value })} placeholder="Например, аренда офиса" /></Field>
      <Field label="Комментарий"><Input value={l.notes || ''} onChange={e => setL({ ...l, notes: e.target.value })} /></Field>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={!!l.is_percent} onChange={e => setL({ ...l, is_percent: e.target.checked, weekly_amount: e.target.checked ? 0 : l.weekly_amount })} />
        <span className="text-sm text-slate-700">Процентное отчисление от СВД</span>
      </label>
      {l.is_percent ? (
        <Field label="% от СВД"><Input type="number" value={l.percent_of_svd || 0} onChange={e => setL({ ...l, percent_of_svd: parseFloat(e.target.value) || 0 })} /></Field>
      ) : (
        <Field label="Еженедельная сумма, ₽"><Input type="number" value={l.weekly_amount} onChange={e => setL({ ...l, weekly_amount: parseFloat(e.target.value) || 0 })} /></Field>
      )}
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="ghost" onClick={onCancel}>Отмена</Button>
        <Button onClick={() => onSave(l)}>Сохранить</Button>
      </div>
    </div>
  );
};
