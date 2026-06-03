import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, PiggyBank, Wallet, ChevronRight, Target, AlertTriangle } from 'lucide-react';
import { WeeklyPlan, IncomeForecast, ExpenseProposal, ReserveAccount, FP1LineItem, SVDHistoryPoint, IncomeSource, ExpenseCategory } from '../types';
import {
  INCOME_SOURCE_LABELS, EXPENSE_CATEGORY_LABELS, RESERVE_TYPE_LABELS,
  FINANCIAL_CONDITION_LABELS, computeFinancialCondition, PLAN_STATUS_LABELS
} from '../constants';
import { fmtMoney, fmtFull, ruDate } from '../utils';
import { Pill, StatCard } from './ui';

interface Props {
  plan: WeeklyPlan;
  forecasts: IncomeForecast[];
  proposals: ExpenseProposal[];
  reserves: ReserveAccount[];
  fp1: FP1LineItem[];
  svdHistory: SVDHistoryPoint[];
  onSwitchTab: (t: string) => void;
}

export const Dashboard: React.FC<Props> = ({ plan, forecasts, proposals, reserves, fp1, svdHistory, onSwitchTab }) => {
  const totalReserves = reserves.reduce((s, r) => s + r.balance, 0);
  const totalPayable = proposals
    .filter(p => p.status === 'approved' || p.status === 'reviewed' || p.status === 'proposed')
    .reduce((s, p) => s + p.amount, 0);
  const ratio = totalPayable > 0 ? totalReserves / totalPayable : 999;
  const cond = computeFinancialCondition(ratio);
  const condInfo = FINANCIAL_CONDITION_LABELS[cond];

  const totalIncomeProj = forecasts.reduce((s, f) => s + f.amount_projected, 0);
  const totalIncomeAct = forecasts.reduce((s, f) => s + f.amount_actual, 0);
  const totalExpAppr = proposals.filter(p => p.status === 'approved' || p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const totalExpPaid = proposals.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const incomeRate = totalIncomeProj > 0 ? (totalIncomeAct / totalIncomeProj) * 100 : 0;
  const margin = totalIncomeAct - totalExpPaid;

  // Break-even = сумма базовых расходов ФП №1 (с учётом % от СВД)
  const avgSVD = svdHistory.length ? svdHistory.reduce((s, p) => s + p.adjusted_income, 0) / svdHistory.length : 0;
  const breakEven = fp1
    .filter(l => l.section !== 'commodity')
    .reduce((s, l) => s + (l.is_percent ? avgSVD * (l.percent_of_svd || 0) / 100 : l.weekly_amount), 0);
  const breakEvenStatus: 'below' | 'at' | 'above' = totalIncomeProj < breakEven * 0.95 ? 'below' : totalIncomeProj < breakEven * 1.05 ? 'at' : 'above';

  const incomeBySource = useMemo(() => {
    const m: Record<string, { proj: number; act: number }> = {};
    forecasts.forEach(f => {
      if (!m[f.source]) m[f.source] = { proj: 0, act: 0 };
      m[f.source].proj += f.amount_projected;
      m[f.source].act += f.amount_actual;
    });
    return m;
  }, [forecasts]);

  const expenseByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    proposals.filter(p => p.status !== 'rejected').forEach(p => {
      m[p.category] = (m[p.category] || 0) + p.amount;
    });
    return m;
  }, [proposals]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border-2 p-6 shadow-md" style={{ borderColor: condInfo.color + '40', background: `linear-gradient(135deg, ${condInfo.bg}, white)` }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: condInfo.color }}>Финансовое состояние компании</p>
            <h2 className="text-3xl font-black mb-2" style={{ color: condInfo.color }}>{condInfo.label}</h2>
            <p className="text-sm text-slate-600 max-w-2xl">{condInfo.action}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-1">Резервы / Счета к оплате</p>
            <p className="text-4xl font-black" style={{ color: condInfo.color }}>{ratio.toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-1">{fmtMoney(totalReserves)} / {fmtMoney(totalPayable)}</p>
          </div>
        </div>
      </div>

      {/* Break-even ФП №1 */}
      <div className={`rounded-2xl border-2 p-5 ${breakEvenStatus === 'below' ? 'border-red-300 bg-red-50/50' : breakEvenStatus === 'at' ? 'border-amber-300 bg-amber-50/50' : 'border-emerald-300 bg-emerald-50/50'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target size={16} className={breakEvenStatus === 'below' ? 'text-red-600' : breakEvenStatus === 'at' ? 'text-amber-600' : 'text-emerald-600'} />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Жизнеспособность по ФП №1</p>
            </div>
            <h3 className="font-bold text-slate-800">
              {breakEvenStatus === 'below' && '⚠ Доход ниже переломной точки — компания тратит больше, чем зарабатывает'}
              {breakEvenStatus === 'at'    && 'Доход вблизи переломной точки — нужен запас прочности'}
              {breakEvenStatus === 'above' && '✓ Доход выше переломной точки — компания прибыльна'}
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Переломная точка (ФП №1) = базовые еженедельные расходы по разделам 1–5. Средний СВД за {svdHistory.length} нед. = <strong>{fmtFull(avgSVD)}</strong>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">План дохода</p>
              <p className="font-black text-slate-800">{fmtMoney(totalIncomeProj)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Переломная</p>
              <p className="font-black text-slate-800">{fmtMoney(breakEven)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Запас</p>
              <p className={`font-black ${totalIncomeProj - breakEven >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtMoney(totalIncomeProj - breakEven)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp size={20} />}  color="#22c55e" label="Доход (план)"   value={fmtMoney(totalIncomeProj)} sub={`Факт: ${fmtMoney(totalIncomeAct)} (${incomeRate.toFixed(0)}%)`} trend={incomeRate >= 50 ? 'up' : 'down'} />
        <StatCard icon={<TrendingDown size={20} />} color="#ef4444" label="Расходы (утв.)" value={fmtMoney(totalExpAppr)}     sub={`Оплачено: ${fmtMoney(totalExpPaid)}`} />
        <StatCard icon={<PiggyBank size={20} />}    color="#8b5cf6" label="Резервы"       value={fmtMoney(totalReserves)}    sub={`По ${reserves.length} счетам`} />
        <StatCard icon={<Wallet size={20} />}       color={margin >= 0 ? '#3b82f6' : '#ef4444'} label="Маржа недели" value={fmtMoney(margin)} sub={margin >= 0 ? 'Прибыль' : 'Дефицит'} trend={margin >= 0 ? 'up' : 'down'} />
      </div>

      {/* Текущий план */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Текущий недельный план</p>
            <h3 className="text-lg font-bold text-slate-800">{ruDate(plan.week_start)} — {ruDate(plan.week_end)}</h3>
          </div>
          <Pill label={PLAN_STATUS_LABELS[plan.status].label} color={PLAN_STATUS_LABELS[plan.status].color} bg={PLAN_STATUS_LABELS[plan.status].bg} size="md" />
        </div>
        <div className="mb-4">
          <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
            <span>Поступление доходов</span><span>{incomeRate.toFixed(0)}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all" style={{ width: `${Math.min(100, incomeRate)}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>Факт: {fmtFull(totalIncomeAct)}</span><span>План: {fmtFull(totalIncomeProj)}</span>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
            <span>Исполнение расходов</span><span>{totalExpAppr > 0 ? ((totalExpPaid / totalExpAppr) * 100).toFixed(0) : 0}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-300 to-red-500 transition-all" style={{ width: `${Math.min(100, totalExpAppr > 0 ? (totalExpPaid / totalExpAppr) * 100 : 0)}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>Оплачено: {fmtFull(totalExpPaid)}</span><span>Утверждено: {fmtFull(totalExpAppr)}</span>
          </div>
        </div>
        <button onClick={() => onSwitchTab('plan')} className="mt-5 px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors flex items-center gap-2">
          Открыть план недели <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-green-600" />
            <h3 className="font-bold text-slate-800">Доходы по источникам</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(incomeBySource).sort(([, a], [, b]) => b.proj - a.proj).map(([key, val]) => {
              const info = INCOME_SOURCE_LABELS[key as IncomeSource];
              const pct = val.proj > 0 ? (val.act / val.proj) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: info.color }} />
                      <span className="font-medium text-slate-700">{info.label}</span>
                    </span>
                    <span className="font-bold text-slate-800">{fmtMoney(val.act)} / {fmtMoney(val.proj)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: info.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={18} className="text-red-600" />
            <h3 className="font-bold text-slate-800">Расходы по категориям</h3>
          </div>
          <div className="space-y-2.5">
            {Object.entries(expenseByCategory).sort(([, a], [, b]) => b - a).slice(0, 8).map(([key, val]) => {
              const info = EXPENSE_CATEGORY_LABELS[key as ExpenseCategory];
              const total = Object.values(expenseByCategory).reduce((s, v) => s + v, 0);
              const pct = total > 0 ? (val / total) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: info.color }} />
                      <span className="font-medium text-slate-700">{info.label}</span>
                    </span>
                    <span className="font-bold text-slate-800">{fmtMoney(val)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: info.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PiggyBank size={18} className="text-purple-600" />
            <h3 className="font-bold text-slate-800">Резервные счета</h3>
          </div>
          <button onClick={() => onSwitchTab('reserves')} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
            Подробно <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reserves.map(r => {
            const info = RESERVE_TYPE_LABELS[r.type];
            const pct = r.target_balance && r.target_balance > 0 ? (r.balance / r.target_balance) * 100 : 100;
            return (
              <div key={r.id} className="border border-slate-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: info.color }}>{info.label}</span>
                  {r.allocation_percent !== undefined && <span className="text-[10px] font-bold text-slate-400">{r.allocation_percent}%</span>}
                </div>
                <p className="text-lg font-black text-slate-800">{fmtFull(r.balance)}</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{r.name}</p>
                <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: info.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
