import React from 'react';
import { History } from 'lucide-react';
import { WeeklyPlan, SVDHistoryPoint } from '../types';
import { PLAN_STATUS_LABELS } from '../constants';
import { fmtMoney, fmtFull, ruDate } from '../utils';
import { Pill } from './ui';

interface Props {
  plans: WeeklyPlan[];
  svdHistory: SVDHistoryPoint[];
}

export const Archive: React.FC<Props> = ({ plans, svdHistory }) => {
  const sorted = [...plans].sort((a, b) => b.week_start.localeCompare(a.week_start));
  const maxSvd = Math.max(...svdHistory.map(p => p.adjusted_income), 1);

  return (
    <div className="space-y-6">
      {/* График СВД */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-3">Динамика СВД (последние {svdHistory.length} нед.)</h3>
        <div className="flex items-end gap-1 h-32 mt-4">
          {svdHistory.map((p, i) => {
            const grossH = (p.gross_income / maxSvd) * 100;
            const adjH = (p.adjusted_income / maxSvd) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 group" title={`${p.week_start}: вал ${fmtFull(p.gross_income)}, СВД ${fmtFull(p.adjusted_income)}`}>
                <div className="w-full bg-blue-200 rounded-t" style={{ height: `${grossH}%` }} />
                <div className="w-full bg-blue-600 rounded-t -mt-1" style={{ height: `${adjH * 0.9}%`, marginTop: `-${adjH * 0.9}%` }} />
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-200"/>Валовой доход</span>
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-600"/>СВД (с поправками)</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><History size={18}/> Архив недельных планов</h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-8">Архив пуст</p>
        ) : (
          <div className="space-y-2">
            {sorted.map(p => {
              const margin = p.income_actual - p.expense_actual;
              const st = PLAN_STATUS_LABELS[p.status];
              return (
                <div key={p.id} className="border border-slate-200 rounded-xl p-3.5 hover:border-slate-300">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">Неделя {ruDate(p.week_start)} — {ruDate(p.week_end)}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{p.notes || 'Без заметок'}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <span className="text-green-600 font-bold">+{fmtMoney(p.income_actual)}</span>
                      <span className="text-red-600 font-bold">−{fmtMoney(p.expense_actual)}</span>
                      <span className={`font-black ${margin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmtMoney(margin)}</span>
                      <Pill label={st.label} color={st.color} bg={st.bg}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
