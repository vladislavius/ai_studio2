import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Calendar, Plus, Edit2, Trash2, Check, X,
  AlertTriangle, ShieldCheck, Layers, CircleDollarSign, Banknote, ArrowRight,
  ArrowLeftRight, FileText, ChevronDown, ChevronRight, Search, Filter, RotateCcw,
  Loader2, Save, History, Settings as SettingsIcon, Crown, ChevronLeft, ChevronUp,
  CheckCircle2, XCircle, Clock, PiggyBank, Target, Inbox, Send, Lock, BarChart3
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  WeeklyPlan, IncomeForecast, ExpenseProposal, ReserveAccount, BankTransaction,
  SolvencySnapshot, IncomeSource, ExpenseCategory, ExpensePriority, ExpenseStatus,
  PlanStatus, FinancialCondition, ReserveType, Employee
} from '../types';
import {
  INCOME_SOURCE_LABELS, EXPENSE_CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS,
  PLAN_STATUS_LABELS, RESERVE_TYPE_LABELS, FINANCIAL_CONDITION_LABELS,
  computeFinancialCondition, DEFAULT_RESERVE_ACCOUNTS, FIN_PLANNING_WORKFLOW,
  ORGANIZATION_STRUCTURE
} from '../constants';
import ConfirmationModal from './ConfirmationModal';

interface FinPlanProps {
  employees: Employee[];
  isOffline?: boolean;
  isAdmin?: boolean;
}

type FinTab = 'dashboard' | 'plan' | 'reserves' | 'archive' | 'reconcile' | 'workflow';

const fmtMoney = (n: number, currency = '₽'): string => {
  if (n === null || n === undefined || isNaN(n)) return `0 ${currency}`;
  const abs = Math.abs(n);
  let formatted: string;
  if (abs >= 1_000_000) formatted = (n / 1_000_000).toFixed(2) + ' млн';
  else if (abs >= 1_000) formatted = (n / 1_000).toFixed(1) + ' тыс';
  else formatted = n.toFixed(0);
  return `${formatted} ${currency}`;
};

const fmtFull = (n: number, currency = '₽'): string =>
  new Intl.NumberFormat('ru-RU').format(Math.round(n || 0)) + ' ' + currency;

const startOfWeek = (d: Date): Date => {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfWeek = (d: Date): Date => {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 6);
  return x;
};

const formatDate = (d: Date | string): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
};

const ruDate = (d: Date | string): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
};

const uid = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// ============================================================================
// DEMO DATA (для оффлайн-режима и старта)
// ============================================================================
const DEMO_PLAN_ID = 'demo-plan-current';

const generateDemoPlan = (): WeeklyPlan => {
  const now = new Date();
  const ws = startOfWeek(now);
  const we = endOfWeek(now);
  return {
    id: DEMO_PLAN_ID,
    week_start: formatDate(ws),
    week_end: formatDate(we),
    status: 'collecting',
    income_projected: 1850000,
    income_actual: 720000,
    expense_projected: 1420000,
    expense_actual: 380000,
    cash_on_hand_start: 2400000,
    notes: 'Высокий сезон, ожидаем рост заявок на групповые туры.',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
};

const generateDemoForecasts = (planId: string): IncomeForecast[] => [
  { id: uid(), plan_id: planId, source: 'group_tours',      description: 'Туры по горным маршрутам',     amount_projected: 720000, amount_actual: 340000, confidence: 'high' },
  { id: uid(), plan_id: planId, source: 'individual_tours', description: 'VIP-индивидуалы',              amount_projected: 350000, amount_actual: 120000, confidence: 'medium' },
  { id: uid(), plan_id: planId, source: 'excursions',       description: 'Городские экскурсии',          amount_projected: 220000, amount_actual: 95000,  confidence: 'high' },
  { id: uid(), plan_id: planId, source: 'transfers',        description: 'Аэропорт + межгород',          amount_projected: 180000, amount_actual: 70000,  confidence: 'high' },
  { id: uid(), plan_id: planId, source: 'partners',         description: 'Поток от агентов',             amount_projected: 250000, amount_actual: 95000,  confidence: 'medium' },
  { id: uid(), plan_id: planId, source: 'hotel_commission', description: 'Комиссия за бронирование',     amount_projected: 130000, amount_actual: 0,      confidence: 'low' },
];

const generateDemoProposals = (planId: string): ExpenseProposal[] => {
  const now = new Date().toISOString();
  return [
    { id: uid(), plan_id: planId, dept_id: 'dept3', category: 'payroll',      title: 'Зарплата за неделю', justification: 'Регулярная выплата сотрудникам',         amount: 480000, priority: 'critical', status: 'approved', proposer: 'Финансовый отдел', vendor: 'Штатные сотрудники', is_recurring: true,  created_at: now, updated_at: now },
    { id: uid(), plan_id: planId, dept_id: 'dept4', category: 'hotel_prepay', title: 'Предоплата отелю Х', justification: 'Бронирование группы 12 чел., заезд 21.06', amount: 285000, priority: 'critical', status: 'approved', proposer: 'Отдел брони',     vendor: 'Hotel X',           is_recurring: false, created_at: now, updated_at: now },
    { id: uid(), plan_id: planId, dept_id: 'dept4', category: 'transport',    title: 'ГСМ автопарк',       justification: 'Заправка для трансферов на неделю',         amount: 65000,  priority: 'high',     status: 'approved', proposer: 'Логистика',       vendor: 'АЗС',               is_recurring: true,  created_at: now, updated_at: now },
    { id: uid(), plan_id: planId, dept_id: 'dept2', category: 'marketing',    title: 'Рекламная кампания', justification: 'Таргет в соцсетях на летние туры',         amount: 120000, priority: 'high',     status: 'reviewed', proposer: 'Маркетолог',      vendor: 'Рекл. площадки',    is_recurring: false, created_at: now, updated_at: now },
    { id: uid(), plan_id: planId, dept_id: 'dept4', category: 'guides_fees',  title: 'Гонорары гидам',     justification: '6 экскурсий на неделе, 4 гида',             amount: 95000,  priority: 'high',     status: 'approved', proposer: 'Координатор',     vendor: 'Гиды-подрядчики',   is_recurring: true,  created_at: now, updated_at: now },
    { id: uid(), plan_id: planId, dept_id: 'dept1', category: 'training',     title: 'Семинар для гидов',  justification: 'Новая программа экскурсий, обучение 2 дня', amount: 45000,  priority: 'normal',   status: 'proposed', proposer: 'Директор по обуч.',vendor: 'Тренер',            is_recurring: false, created_at: now, updated_at: now },
    { id: uid(), plan_id: planId, dept_id: 'dept7', category: 'software',     title: 'Подписки SaaS',      justification: 'CRM, аналитика — месячная оплата',          amount: 28000,  priority: 'normal',   status: 'approved', proposer: 'ИТ-менеджер',     vendor: 'SaaS',              is_recurring: true,  created_at: now, updated_at: now },
    { id: uid(), plan_id: planId, dept_id: 'dept5', category: 'office',       title: 'Канцелярия и расх. материалы', justification: 'Запас на 2 недели',           amount: 12000,  priority: 'low',      status: 'proposed', proposer: 'Офис-менеджер',   vendor: 'Поставщик',         is_recurring: false, created_at: now, updated_at: now },
    { id: uid(), plan_id: planId, dept_id: 'dept6', category: 'pr',           title: 'Пресс-завтрак',      justification: 'Знакомство со СМИ, новая программа',        amount: 85000,  priority: 'normal',   status: 'proposed', proposer: 'PR-менеджер',     vendor: 'Подрядчик',         is_recurring: false, created_at: now, updated_at: now },
    { id: uid(), plan_id: planId, dept_id: 'dept3', category: 'taxes',        title: 'Авансовый платёж',   justification: 'Квартальный платёж по налогу',              amount: 180000, priority: 'critical', status: 'approved', proposer: 'Главбух',         vendor: 'ФНС',               is_recurring: true,  created_at: now, updated_at: now },
  ];
};

const generateDemoReserves = (): ReserveAccount[] => {
  const now = new Date().toISOString();
  const balances = [1850000, 720000, 540000, 1100000, 320000, 250000];
  return DEFAULT_RESERVE_ACCOUNTS.map((acc, i) => ({
    ...acc,
    id: uid(),
    balance: balances[i] || 0,
    target_balance: balances[i] * 1.5,
    created_at: now,
    updated_at: now,
  }));
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string; color?: string; trend?: 'up' | 'down' | 'flat' }> = ({ icon, label, value, sub, color = '#3b82f6', trend }) => (
  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all">
    <div className="flex items-start justify-between mb-3">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15`, color }}>
        {icon}
      </div>
      {trend && (
        <div className={`p-1 rounded-lg ${trend === 'up' ? 'bg-green-50 text-green-600' : trend === 'down' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
          {trend === 'up' ? <TrendingUp size={14}/> : trend === 'down' ? <TrendingDown size={14}/> : <ArrowRight size={14}/>}
        </div>
      )}
    </div>
    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
    <p className="text-2xl font-bold text-slate-800">{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
);

const Pill: React.FC<{ label: string; color: string; bg: string; size?: 'sm' | 'md' }> = ({ label, color, bg, size = 'sm' }) => (
  <span className={`inline-flex items-center font-bold rounded-md ${size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}`} style={{ color, backgroundColor: bg }}>
    {label}
  </span>
);

const ConditionBadge: React.FC<{ ratio: number; size?: 'sm' | 'md' | 'lg' }> = ({ ratio, size = 'md' }) => {
  const cond = computeFinancialCondition(ratio);
  const info = FINANCIAL_CONDITION_LABELS[cond];
  return (
    <div className={`inline-flex items-center gap-2 rounded-xl border font-bold ${size === 'lg' ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'}`} style={{ color: info.color, backgroundColor: info.bg, borderColor: info.color + '40' }}>
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} />
      {info.label}
      <span className="font-normal opacity-70">({ratio.toFixed(2)})</span>
    </div>
  );
};

// ============================================================================
// DASHBOARD TAB
// ============================================================================

const Dashboard: React.FC<{
  plan: WeeklyPlan | null;
  forecasts: IncomeForecast[];
  proposals: ExpenseProposal[];
  reserves: ReserveAccount[];
  onSwitchTab: (t: FinTab) => void;
}> = ({ plan, forecasts, proposals, reserves, onSwitchTab }) => {
  const totalReserves = reserves.reduce((s, r) => s + r.balance, 0);
  const totalPayable = proposals.filter(p => p.status === 'approved' || p.status === 'reviewed' || p.status === 'proposed').reduce((s, p) => s + p.amount, 0);
  const ratio = totalPayable > 0 ? totalReserves / totalPayable : 999;
  const cond = computeFinancialCondition(ratio);
  const condInfo = FINANCIAL_CONDITION_LABELS[cond];

  const totalIncomeProj = forecasts.reduce((s, f) => s + f.amount_projected, 0);
  const totalIncomeAct = forecasts.reduce((s, f) => s + f.amount_actual, 0);
  const totalExpAppr = proposals.filter(p => p.status === 'approved' || p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const totalExpPaid = proposals.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const incomeRate = totalIncomeProj > 0 ? (totalIncomeAct / totalIncomeProj) * 100 : 0;

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

  const margin = totalIncomeAct - totalExpPaid;

  return (
    <div className="space-y-6">
      {/* Главный индикатор — финансовое состояние */}
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

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp size={20}/>} color="#22c55e" label="Доход (план)"   value={fmtMoney(totalIncomeProj)} sub={`Факт: ${fmtMoney(totalIncomeAct)} (${incomeRate.toFixed(0)}%)`} trend={incomeRate >= 50 ? 'up' : 'down'} />
        <StatCard icon={<TrendingDown size={20}/>} color="#ef4444" label="Расходы (утв.)" value={fmtMoney(totalExpAppr)} sub={`Оплачено: ${fmtMoney(totalExpPaid)}`} />
        <StatCard icon={<PiggyBank size={20}/>} color="#8b5cf6" label="Резервы"       value={fmtMoney(totalReserves)} sub={`По ${reserves.length} счетам`} />
        <StatCard icon={<Wallet size={20}/>} color={margin >= 0 ? '#3b82f6' : '#ef4444'} label="Маржа недели" value={fmtMoney(margin)} sub={margin >= 0 ? 'Прибыль' : 'Дефицит'} trend={margin >= 0 ? 'up' : 'down'} />
      </div>

      {/* Текущий план */}
      {plan && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Текущий недельный план</p>
              <h3 className="text-lg font-bold text-slate-800">{ruDate(plan.week_start)} — {ruDate(plan.week_end)}</h3>
            </div>
            <Pill label={PLAN_STATUS_LABELS[plan.status].label} color={PLAN_STATUS_LABELS[plan.status].color} bg={PLAN_STATUS_LABELS[plan.status].bg} size="md" />
          </div>

          {/* Прогресс по доходам */}
          <div className="mb-4">
            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
              <span>Поступление доходов</span>
              <span>{incomeRate.toFixed(0)}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all" style={{ width: `${Math.min(100, incomeRate)}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>Факт: {fmtFull(totalIncomeAct)}</span>
              <span>План: {fmtFull(totalIncomeProj)}</span>
            </div>
          </div>

          {/* Прогресс по расходам */}
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
              <span>Исполнение расходов</span>
              <span>{totalExpAppr > 0 ? ((totalExpPaid / totalExpAppr) * 100).toFixed(0) : 0}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-300 to-red-500 transition-all" style={{ width: `${Math.min(100, totalExpAppr > 0 ? (totalExpPaid / totalExpAppr) * 100 : 0)}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>Оплачено: {fmtFull(totalExpPaid)}</span>
              <span>Утверждено: {fmtFull(totalExpAppr)}</span>
            </div>
          </div>

          <button onClick={() => onSwitchTab('plan')} className="mt-5 w-full md:w-auto px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
            Открыть план недели <ChevronRight size={16}/>
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Доходы по источникам */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-green-600"/>
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
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: info?.color || '#94a3b8' }}/>
                      <span className="font-medium text-slate-700">{info?.label || key}</span>
                    </span>
                    <span className="font-bold text-slate-800">{fmtMoney(val.act)} / {fmtMoney(val.proj)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: info?.color || '#94a3b8' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Расходы по категориям */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={18} className="text-red-600"/>
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
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: info?.color || '#94a3b8' }}/>
                      <span className="font-medium text-slate-700">{info?.label || key}</span>
                    </span>
                    <span className="font-bold text-slate-800">{fmtMoney(val)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: info?.color || '#94a3b8' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Резервы — обзор */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PiggyBank size={18} className="text-purple-600"/>
            <h3 className="font-bold text-slate-800">Резервные счета</h3>
          </div>
          <button onClick={() => onSwitchTab('reserves')} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
            Подробно <ChevronRight size={14}/>
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
                {r.target_balance ? (
                  <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: info.color }} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// WEEKLY PLAN TAB
// ============================================================================

const WeeklyPlanView: React.FC<{
  plan: WeeklyPlan | null;
  forecasts: IncomeForecast[];
  proposals: ExpenseProposal[];
  isAdmin?: boolean;
  onUpdatePlan: (p: WeeklyPlan) => void;
  onAddForecast: (f: IncomeForecast) => void;
  onUpdateForecast: (f: IncomeForecast) => void;
  onDeleteForecast: (id: string) => void;
  onAddProposal: (p: ExpenseProposal) => void;
  onUpdateProposal: (p: ExpenseProposal) => void;
  onDeleteProposal: (id: string) => void;
}> = ({ plan, forecasts, proposals, isAdmin, onUpdatePlan, onAddForecast, onUpdateForecast, onDeleteForecast, onAddProposal, onUpdateProposal, onDeleteProposal }) => {
  const [showForecastForm, setShowForecastForm] = useState(false);
  const [editingForecast, setEditingForecast] = useState<Partial<IncomeForecast> | null>(null);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Partial<ExpenseProposal> | null>(null);
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  if (!plan) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
        <Calendar size={48} className="text-slate-300 mx-auto mb-4"/>
        <h3 className="text-lg font-bold text-slate-700 mb-2">План на текущую неделю не создан</h3>
        <p className="text-sm text-slate-500 mb-5">Создайте недельный план, чтобы начать собирать заявки и прогноз дохода.</p>
        <button onClick={() => {
          const now = new Date();
          onUpdatePlan({
            id: uid(),
            week_start: formatDate(startOfWeek(now)),
            week_end: formatDate(endOfWeek(now)),
            status: 'draft',
            income_projected: 0, income_actual: 0,
            expense_projected: 0, expense_actual: 0,
            cash_on_hand_start: 0,
            created_at: now.toISOString(), updated_at: now.toISOString(),
          });
        }} className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700">
          Создать план на текущую неделю
        </button>
      </div>
    );
  }

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

  const handleAdvanceStatus = () => {
    const flow: PlanStatus[] = ['draft', 'collecting', 'review', 'approved', 'executing', 'closed'];
    const idx = flow.indexOf(plan.status);
    if (idx < flow.length - 1) {
      onUpdatePlan({ ...plan, status: flow[idx + 1], updated_at: new Date().toISOString() });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Calendar size={20} className="text-blue-600"/>
              <h2 className="text-xl font-bold text-slate-800">Неделя {ruDate(plan.week_start)} — {ruDate(plan.week_end)}</h2>
              <Pill label={PLAN_STATUS_LABELS[plan.status].label} color={PLAN_STATUS_LABELS[plan.status].color} bg={PLAN_STATUS_LABELS[plan.status].bg} size="md" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Доход (план)</p>
                <p className="font-bold text-green-600">{fmtFull(totalIncomeProj)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Доход (факт)</p>
                <p className="font-bold text-green-700">{fmtFull(totalIncomeAct)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Расходы (утв.)</p>
                <p className="font-bold text-red-600">{fmtFull(totalExpAppr)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Прогноз. маржа</p>
                <p className={`font-bold ${totalIncomeProj - totalExpAppr >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmtFull(totalIncomeProj - totalExpAppr)}</p>
              </div>
            </div>
          </div>
          {isAdmin && plan.status !== 'closed' && (
            <button onClick={handleAdvanceStatus} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 flex items-center gap-2 self-start">
              Перевести: {PLAN_STATUS_LABELS[(['draft','collecting','review','approved','executing','closed'] as PlanStatus[])[Math.min(5, (['draft','collecting','review','approved','executing','closed'] as PlanStatus[]).indexOf(plan.status) + 1)]].label}
              <ChevronRight size={16}/>
            </button>
          )}
        </div>
      </div>

      {/* ДОХОДЫ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-green-600"/>
            <h3 className="font-bold text-slate-800">Прогноз доходов</h3>
          </div>
          {isAdmin && (
            <button onClick={() => { setEditingForecast({ plan_id: plan.id, source: 'group_tours', amount_projected: 0, amount_actual: 0, confidence: 'medium' }); setShowForecastForm(true); }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 flex items-center gap-1.5">
              <Plus size={14}/> Источник дохода
            </button>
          )}
        </div>

        {forecasts.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-8">Источники дохода пока не указаны</p>
        ) : (
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
                  {isAdmin && <th className="text-center py-2 px-2">Действия</th>}
                </tr>
              </thead>
              <tbody>
                {forecasts.map(f => {
                  const info = INCOME_SOURCE_LABELS[f.source];
                  const pct = f.amount_projected > 0 ? (f.amount_actual / f.amount_projected) * 100 : 0;
                  return (
                    <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }}/>
                          <span className="font-medium text-slate-700">{info.label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-slate-500 text-xs">{f.description || '—'}</td>
                      <td className="py-3 px-2 text-right font-bold text-slate-700">{fmtFull(f.amount_projected)}</td>
                      <td className="py-3 px-2 text-right font-bold text-green-600">{fmtFull(f.amount_actual)}</td>
                      <td className="py-3 px-2 text-center">
                        <span className={`text-xs font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{pct.toFixed(0)}%</span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Pill label={f.confidence === 'high' ? 'Высокая' : f.confidence === 'medium' ? 'Средняя' : 'Низкая'} color={f.confidence === 'high' ? '#22c55e' : f.confidence === 'medium' ? '#f59e0b' : '#ef4444'} bg={f.confidence === 'high' ? '#f0fdf4' : f.confidence === 'medium' ? '#fffbeb' : '#fef2f2'} />
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-2 text-center">
                          <div className="inline-flex gap-1">
                            <button onClick={() => { setEditingForecast(f); setShowForecastForm(true); }} className="p-1 hover:bg-blue-50 text-blue-600 rounded"><Edit2 size={14}/></button>
                            <button onClick={() => onDeleteForecast(f.id)} className="p-1 hover:bg-red-50 text-red-500 rounded"><Trash2 size={14}/></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="text-sm font-bold border-t-2 border-slate-200">
                <tr>
                  <td colSpan={2} className="py-3 px-2 text-slate-700">Итого по неделе</td>
                  <td className="py-3 px-2 text-right text-slate-700">{fmtFull(totalIncomeProj)}</td>
                  <td className="py-3 px-2 text-right text-green-600">{fmtFull(totalIncomeAct)}</td>
                  <td className="py-3 px-2 text-center text-slate-700">{totalIncomeProj > 0 ? ((totalIncomeAct/totalIncomeProj)*100).toFixed(0) : 0}%</td>
                  <td colSpan={isAdmin ? 2 : 1}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* РАСХОДЫ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <TrendingDown size={18} className="text-red-600"/>
            <h3 className="font-bold text-slate-800">Заявки на расходы</h3>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{filteredProposals.length}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
              <option value="all">Все департаменты</option>
              {Object.values(ORGANIZATION_STRUCTURE).filter(d => d.id !== 'owner').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
              <option value="all">Любой статус</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {isAdmin && (
              <button onClick={() => { setEditingProposal({ plan_id: plan.id, dept_id: 'dept3', category: 'other', priority: 'normal', status: 'proposed', amount: 0 }); setShowProposalForm(true); }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 flex items-center gap-1.5">
                <Plus size={14}/> Заявка
              </button>
            )}
          </div>
        </div>

        {filteredProposals.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-8">Нет заявок по выбранным фильтрам</p>
        ) : (
          <div className="space-y-2">
            {filteredProposals.map(p => {
              const catInfo = EXPENSE_CATEGORY_LABELS[p.category];
              const prInfo = PRIORITY_LABELS[p.priority];
              const stInfo = STATUS_LABELS[p.status];
              const dept = ORGANIZATION_STRUCTURE[p.dept_id];
              return (
                <div key={p.id} className="border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 transition-all">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <h4 className="font-bold text-slate-800 text-sm">{p.title}</h4>
                        <Pill label={prInfo.label} color={prInfo.color} bg={prInfo.bg}/>
                        <Pill label={stInfo.label} color={stInfo.color} bg={stInfo.bg}/>
                        {p.is_recurring && <Pill label="Регулярный" color="#0891b2" bg="#ecfeff"/>}
                      </div>
                      <p className="text-xs text-slate-500 mb-1.5">{p.justification}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catInfo.color }}/>{catInfo.label}</span>
                        {dept && <span>· {dept.name}</span>}
                        {p.vendor && <span>· {p.vendor}</span>}
                        {p.proposer && <span>· {p.proposer}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-lg font-black text-slate-800">{fmtFull(p.amount)}</p>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          {p.status === 'proposed' && (
                            <button onClick={() => onUpdateProposal({ ...p, status: 'reviewed', updated_at: new Date().toISOString() })} className="px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-[11px] font-bold flex items-center gap-1">
                              <Inbox size={12}/> На рассмотрение
                            </button>
                          )}
                          {p.status === 'reviewed' && (
                            <>
                              <button onClick={() => onUpdateProposal({ ...p, status: 'approved', updated_at: new Date().toISOString() })} className="px-2.5 py-1 bg-green-50 text-green-600 hover:bg-green-100 rounded text-[11px] font-bold flex items-center gap-1">
                                <CheckCircle2 size={12}/> Утвердить
                              </button>
                              <button onClick={() => {
                                const reason = window.prompt('Причина отклонения');
                                if (reason !== null) onUpdateProposal({ ...p, status: 'rejected', rejection_reason: reason, updated_at: new Date().toISOString() });
                              }} className="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[11px] font-bold flex items-center gap-1">
                                <XCircle size={12}/> Отклонить
                              </button>
                            </>
                          )}
                          {p.status === 'approved' && (
                            <button onClick={() => onUpdateProposal({ ...p, status: 'paid', payment_date: formatDate(new Date()), updated_at: new Date().toISOString() })} className="px-2.5 py-1 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded text-[11px] font-bold flex items-center gap-1">
                              <Check size={12}/> Оплачено
                            </button>
                          )}
                          <button onClick={() => { setEditingProposal(p); setShowProposalForm(true); }} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded"><Edit2 size={12}/></button>
                          <button onClick={() => onDeleteProposal(p.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 size={12}/></button>
                        </div>
                      )}
                    </div>
                  </div>
                  {p.rejection_reason && (
                    <div className="mt-2 px-3 py-1.5 bg-red-50 rounded-lg text-[11px] text-red-700">
                      <strong>Причина отказа:</strong> {p.rejection_reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* МОДАЛКА ПРОГНОЗА */}
      {showForecastForm && editingForecast && (
        <Modal onClose={() => { setShowForecastForm(false); setEditingForecast(null); }} title={editingForecast.id ? 'Редактирование источника' : 'Новый источник дохода'}>
          <ForecastForm
            data={editingForecast}
            onSave={(f) => {
              if (f.id) onUpdateForecast(f as IncomeForecast);
              else onAddForecast({ ...f, id: uid() } as IncomeForecast);
              setShowForecastForm(false); setEditingForecast(null);
            }}
            onCancel={() => { setShowForecastForm(false); setEditingForecast(null); }}
          />
        </Modal>
      )}

      {/* МОДАЛКА ЗАЯВКИ */}
      {showProposalForm && editingProposal && (
        <Modal onClose={() => { setShowProposalForm(false); setEditingProposal(null); }} title={editingProposal.id ? 'Редактирование заявки' : 'Новая заявка на расход'}>
          <ProposalForm
            data={editingProposal}
            onSave={(p) => {
              const now = new Date().toISOString();
              if (p.id) onUpdateProposal({ ...p, updated_at: now } as ExpenseProposal);
              else onAddProposal({ ...p, id: uid(), created_at: now, updated_at: now } as ExpenseProposal);
              setShowProposalForm(false); setEditingProposal(null);
            }}
            onCancel={() => { setShowProposalForm(false); setEditingProposal(null); }}
          />
        </Modal>
      )}
    </div>
  );
};

// ============================================================================
// FORMS
// ============================================================================

const Modal: React.FC<{ onClose: () => void; title: string; children: React.ReactNode }> = ({ onClose, title, children }) => (
  <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
        <h3 className="font-bold text-slate-800">{title}</h3>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

const ForecastForm: React.FC<{ data: Partial<IncomeForecast>; onSave: (f: Partial<IncomeForecast>) => void; onCancel: () => void }> = ({ data, onSave, onCancel }) => {
  const [f, setF] = useState<Partial<IncomeForecast>>(data);
  return (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] font-bold text-slate-500 uppercase">Источник дохода</label>
        <select value={f.source} onChange={e => setF({ ...f, source: e.target.value as IncomeSource })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
          {Object.entries(INCOME_SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-500 uppercase">Описание</label>
        <input value={f.description || ''} onChange={e => setF({ ...f, description: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" placeholder="Например, групповые туры на июнь"/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase">План, ₽</label>
          <input type="number" value={f.amount_projected || 0} onChange={e => setF({ ...f, amount_projected: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"/>
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase">Факт, ₽</label>
          <input type="number" value={f.amount_actual || 0} onChange={e => setF({ ...f, amount_actual: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"/>
        </div>
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-500 uppercase">Уверенность в поступлении</label>
        <select value={f.confidence} onChange={e => setF({ ...f, confidence: e.target.value as 'high' | 'medium' | 'low' })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
          <option value="high">Высокая (подтверждённые брони/предоплаты)</option>
          <option value="medium">Средняя (заявки в работе)</option>
          <option value="low">Низкая (потенциальные лиды)</option>
        </select>
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-500 uppercase">Заметки</label>
        <textarea value={f.notes || ''} onChange={e => setF({ ...f, notes: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" rows={2}/>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Отмена</button>
        <button onClick={() => onSave(f)} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700">Сохранить</button>
      </div>
    </div>
  );
};

const ProposalForm: React.FC<{ data: Partial<ExpenseProposal>; onSave: (p: Partial<ExpenseProposal>) => void; onCancel: () => void }> = ({ data, onSave, onCancel }) => {
  const [p, setP] = useState<Partial<ExpenseProposal>>(data);
  return (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] font-bold text-slate-500 uppercase">Название заявки</label>
        <input value={p.title || ''} onChange={e => setP({ ...p, title: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" placeholder="Коротко — что покупаем/оплачиваем"/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase">Департамент</label>
          <select value={p.dept_id} onChange={e => setP({ ...p, dept_id: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
            {Object.values(ORGANIZATION_STRUCTURE).filter(d => d.id !== 'owner').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase">Категория</label>
          <select value={p.category} onChange={e => setP({ ...p, category: e.target.value as ExpenseCategory })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase">Сумма, ₽</label>
          <input type="number" value={p.amount || 0} onChange={e => setP({ ...p, amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"/>
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase">Приоритет</label>
          <select value={p.priority} onChange={e => setP({ ...p, priority: e.target.value as ExpensePriority })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-500 uppercase">Обоснование</label>
        <textarea value={p.justification || ''} onChange={e => setP({ ...p, justification: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" rows={2} placeholder="Зачем нужен этот расход — кратко и по делу"/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase">Кто подаёт</label>
          <input value={p.proposer || ''} onChange={e => setP({ ...p, proposer: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"/>
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase">Получатель</label>
          <input value={p.vendor || ''} onChange={e => setP({ ...p, vendor: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"/>
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={!!p.is_recurring} onChange={e => setP({ ...p, is_recurring: e.target.checked })}/>
        <span className="text-sm text-slate-600">Регулярный платёж (повторяется каждую неделю/месяц)</span>
      </label>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Отмена</button>
        <button onClick={() => onSave(p)} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700">Сохранить</button>
      </div>
    </div>
  );
};

// ============================================================================
// RESERVES TAB
// ============================================================================

const ReservesView: React.FC<{
  reserves: ReserveAccount[];
  isAdmin?: boolean;
  onUpdate: (r: ReserveAccount) => void;
  onAdd: (r: ReserveAccount) => void;
  onDelete: (id: string) => void;
}> = ({ reserves, isAdmin, onUpdate, onAdd, onDelete }) => {
  const [editingReserve, setEditingReserve] = useState<Partial<ReserveAccount> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const totalAllocation = reserves.reduce((s, r) => s + (r.allocation_percent || 0), 0);
  const totalBalance = reserves.reduce((s, r) => s + r.balance, 0);

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
          {isAdmin && (
            <button onClick={() => { setEditingReserve({ name: '', type: 'operational', balance: 0, allocation_percent: 0, is_active: true }); setShowForm(true); }} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 flex items-center gap-1.5">
              <Plus size={14}/> Счёт
            </button>
          )}
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
                <div className="flex items-center gap-4 text-[11px] text-slate-500 mt-2">
                  {r.allocation_percent !== undefined && <span><strong className="text-slate-700">{r.allocation_percent}%</strong> от вал. дохода</span>}
                  {r.min_balance ? <span>Неснижаемый: <strong className="text-slate-700">{fmtFull(r.min_balance)}</strong></span> : null}
                  {r.bank_name && <span>Банк: <strong className="text-slate-700">{r.bank_name}</strong></span>}
                </div>
                {r.target_balance ? (
                  <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: info.color }}/>
                  </div>
                ) : null}
                {isAdmin && (
                  <div className="flex gap-1 justify-end mt-3">
                    <button onClick={() => { setEditingReserve(r); setShowForm(true); }} className="px-2.5 py-1 hover:bg-slate-100 text-slate-600 rounded text-[11px] font-bold flex items-center gap-1">
                      <Edit2 size={12}/> Изменить
                    </button>
                    <button onClick={() => onDelete(r.id)} className="px-2.5 py-1 hover:bg-red-50 text-red-500 rounded text-[11px] font-bold flex items-center gap-1">
                      <Trash2 size={12}/> Удалить
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showForm && editingReserve && (
        <Modal onClose={() => { setShowForm(false); setEditingReserve(null); }} title={editingReserve.id ? 'Редактирование счёта' : 'Новый счёт'}>
          <ReserveForm
            data={editingReserve}
            onSave={(r) => {
              const now = new Date().toISOString();
              if (r.id) onUpdate({ ...r, updated_at: now } as ReserveAccount);
              else onAdd({ ...r, id: uid(), created_at: now, updated_at: now } as ReserveAccount);
              setShowForm(false); setEditingReserve(null);
            }}
            onCancel={() => { setShowForm(false); setEditingReserve(null); }}
          />
        </Modal>
      )}
    </div>
  );
};

const ReserveForm: React.FC<{ data: Partial<ReserveAccount>; onSave: (r: Partial<ReserveAccount>) => void; onCancel: () => void }> = ({ data, onSave, onCancel }) => {
  const [r, setR] = useState<Partial<ReserveAccount>>({ is_active: true, ...data });
  return (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] font-bold text-slate-500 uppercase">Название счёта</label>
        <input value={r.name || ''} onChange={e => setR({ ...r, name: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"/>
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-500 uppercase">Тип</label>
        <select value={r.type} onChange={e => setR({ ...r, type: e.target.value as ReserveType })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
          {Object.entries(RESERVE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.description}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-500 uppercase">Описание</label>
        <input value={r.description || ''} onChange={e => setR({ ...r, description: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase">Текущий остаток, ₽</label>
          <input type="number" value={r.balance || 0} onChange={e => setR({ ...r, balance: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"/>
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase">Целевой остаток, ₽</label>
          <input type="number" value={r.target_balance || 0} onChange={e => setR({ ...r, target_balance: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"/>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase">% от вал. дохода</label>
          <input type="number" value={r.allocation_percent || 0} onChange={e => setR({ ...r, allocation_percent: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"/>
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase">Неснижаемый остаток, ₽</label>
          <input type="number" value={r.min_balance || 0} onChange={e => setR({ ...r, min_balance: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"/>
        </div>
      </div>
      <div>
        <label className="text-[11px] font-bold text-slate-500 uppercase">Банк</label>
        <input value={r.bank_name || ''} onChange={e => setR({ ...r, bank_name: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"/>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={r.is_active !== false} onChange={e => setR({ ...r, is_active: e.target.checked })}/>
        <span className="text-sm text-slate-600">Активный счёт</span>
      </label>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Отмена</button>
        <button onClick={() => onSave(r)} className="px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700">Сохранить</button>
      </div>
    </div>
  );
};

// ============================================================================
// WORKFLOW TAB — регламент еженедельного финпланирования
// ============================================================================

const WorkflowView: React.FC<{ plan: WeeklyPlan | null; isAdmin?: boolean; onAdvance: (s: PlanStatus) => void }> = ({ plan, isAdmin, onAdvance }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Calendar className="text-blue-600" size={20}/> Регламент финансового планирования (недельный цикл)
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          Адаптировано из классической модели финансового планирования: ответственность за финплан несёт исполнительный комитет, действующий на основании рекомендаций бюджетного комитета, который, в свою очередь, получает заявки от руководителей отделов.
        </p>

        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {FIN_PLANNING_WORKFLOW.map((step, i) => {
            const isCurrent = plan?.status === step.phase;
            const stInfo = PLAN_STATUS_LABELS[step.phase];
            return (
              <div key={i} className="relative">
                <div className={`absolute -left-[22px] w-4 h-4 rounded-full border-2 ${isCurrent ? 'animate-pulse' : ''}`} style={{ borderColor: stInfo.color, backgroundColor: isCurrent ? stInfo.color : 'white' }}/>
                <div className={`border rounded-xl p-4 ${isCurrent ? 'border-blue-300 bg-blue-50/50 shadow-sm' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{step.day}</span>
                      <h3 className="font-bold text-slate-800">{step.title}</h3>
                    </div>
                    <Pill label={stInfo.label} color={stInfo.color} bg={stInfo.bg}/>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{step.description}</p>
                  <p className="text-[11px] text-slate-400"><strong>Ответственные:</strong> {step.role}</p>
                  {isCurrent && isAdmin && i < FIN_PLANNING_WORKFLOW.length - 1 && (
                    <button onClick={() => onAdvance(FIN_PLANNING_WORKFLOW[i + 1].phase)} className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5">
                      Перейти к следующему шагу <ChevronRight size={14}/>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-amber-50/50 rounded-2xl border border-amber-200 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0" size={20}/>
          <div>
            <h3 className="font-bold text-amber-900 mb-1">Базовые принципы</h3>
            <ul className="text-sm text-amber-800 space-y-1">
              <li>• Финансовое планирование — это способ обращения с деньгами и активами компании с целью поддерживать превышение дохода над расходами.</li>
              <li>• Платёжеспособность определяется тем, зарабатывает ли компания больше, чем тратит.</li>
              <li>• Никогда не управляйте делами на основе только статистики недели — всегда смотрите тренд.</li>
              <li>• Резервы наполняются ДО операционных трат. То, что попало в резерв — защищено от текущих расходов.</li>
              <li>• Каждый расход требует обоснования и привязки к ценному конечному продукту подразделения.</li>
              <li>• Утверждённые заявки исполняются строго; неутверждённые — не оплачиваются.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// ARCHIVE TAB
// ============================================================================

const ArchiveView: React.FC<{ plans: WeeklyPlan[] }> = ({ plans }) => {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><History size={18}/> Архив недельных планов</h3>
        {plans.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-8">Архив пуст</p>
        ) : (
          <div className="space-y-2">
            {plans.map(p => {
              const margin = p.income_actual - p.expense_actual;
              return (
                <div key={p.id} className="border border-slate-200 rounded-xl p-3.5 hover:border-slate-300">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">Неделя {ruDate(p.week_start)} — {ruDate(p.week_end)}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{p.notes || 'Без заметок'}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-600 font-bold">+{fmtMoney(p.income_actual)}</span>
                      <span className="text-red-600 font-bold">−{fmtMoney(p.expense_actual)}</span>
                      <span className={`font-black ${margin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmtMoney(margin)}</span>
                      <Pill label={PLAN_STATUS_LABELS[p.status].label} color={PLAN_STATUS_LABELS[p.status].color} bg={PLAN_STATUS_LABELS[p.status].bg}/>
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const FinPlan: React.FC<FinPlanProps> = ({ employees, isOffline, isAdmin }) => {
  const [tab, setTab] = useState<FinTab>('dashboard');
  const [plan, setPlan] = useState<WeeklyPlan | null>(generateDemoPlan());
  const [forecasts, setForecasts] = useState<IncomeForecast[]>(generateDemoForecasts(DEMO_PLAN_ID));
  const [proposals, setProposals] = useState<ExpenseProposal[]>(generateDemoProposals(DEMO_PLAN_ID));
  const [reserves, setReserves] = useState<ReserveAccount[]>(generateDemoReserves());
  const [archivePlans, setArchivePlans] = useState<WeeklyPlan[]>([]);
  const [loading, setLoading] = useState(false);

  // Load from Supabase if available
  useEffect(() => {
    if (isOffline || !supabase) return;
    const sb = supabase;
    const load = async () => {
      setLoading(true);
      try {
        const { data: planData } = await sb.from('fin_weekly_plans').select('*').order('week_start', { ascending: false });
        if (planData && planData.length > 0) {
          const today = formatDate(new Date());
          const current = planData.find((p: WeeklyPlan) => p.week_start <= today && p.week_end >= today);
          if (current) setPlan(current);
          setArchivePlans(planData.filter((p: WeeklyPlan) => p.id !== current?.id));

          if (current) {
            const { data: fc } = await sb.from('fin_income_forecasts').select('*').eq('plan_id', current.id);
            if (fc) setForecasts(fc);
            const { data: pr } = await sb.from('fin_expense_proposals').select('*').eq('plan_id', current.id);
            if (pr) setProposals(pr);
          }
        }
        const { data: res } = await sb.from('fin_reserve_accounts').select('*').order('created_at', { ascending: true });
        if (res && res.length > 0) setReserves(res);
      } catch (err) {
        console.warn('FinPlan: Supabase tables not available — using demo data', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOffline]);

  const upsertSupabase = async <T extends { id: string }>(table: string, row: T) => {
    if (isOffline || !supabase) return;
    try { await supabase.from(table).upsert(row); } catch (e) { console.warn(`Upsert to ${table} failed`, e); }
  };
  const deleteSupabase = async (table: string, id: string) => {
    if (isOffline || !supabase) return;
    try { await supabase.from(table).delete().eq('id', id); } catch (e) { console.warn(`Delete from ${table} failed`, e); }
  };

  const handleUpdatePlan = (p: WeeklyPlan) => { setPlan(p); upsertSupabase('fin_weekly_plans', p); };
  const handleAddForecast = (f: IncomeForecast) => { setForecasts(prev => [...prev, f]); upsertSupabase('fin_income_forecasts', f); };
  const handleUpdateForecast = (f: IncomeForecast) => { setForecasts(prev => prev.map(x => x.id === f.id ? f : x)); upsertSupabase('fin_income_forecasts', f); };
  const handleDeleteForecast = (id: string) => { setForecasts(prev => prev.filter(x => x.id !== id)); deleteSupabase('fin_income_forecasts', id); };
  const handleAddProposal = (p: ExpenseProposal) => { setProposals(prev => [...prev, p]); upsertSupabase('fin_expense_proposals', p); };
  const handleUpdateProposal = (p: ExpenseProposal) => { setProposals(prev => prev.map(x => x.id === p.id ? p : x)); upsertSupabase('fin_expense_proposals', p); };
  const handleDeleteProposal = (id: string) => { setProposals(prev => prev.filter(x => x.id !== id)); deleteSupabase('fin_expense_proposals', id); };
  const handleAddReserve = (r: ReserveAccount) => { setReserves(prev => [...prev, r]); upsertSupabase('fin_reserve_accounts', r); };
  const handleUpdateReserve = (r: ReserveAccount) => { setReserves(prev => prev.map(x => x.id === r.id ? r : x)); upsertSupabase('fin_reserve_accounts', r); };
  const handleDeleteReserve = (id: string) => { setReserves(prev => prev.filter(x => x.id !== id)); deleteSupabase('fin_reserve_accounts', id); };

  if (loading) {
    return <div className="flex flex-col items-center justify-center h-full text-slate-400"><Loader2 className="animate-spin mb-2" size={32}/><p>Загрузка финансовых данных...</p></div>;
  }

  const tabs: { id: FinTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard',  label: 'Дашборд',          icon: <BarChart3 size={16}/> },
    { id: 'plan',       label: 'Недельный план',   icon: <Calendar size={16}/> },
    { id: 'reserves',   label: 'Резервы',          icon: <PiggyBank size={16}/> },
    { id: 'workflow',   label: 'Регламент',        icon: <FileText size={16}/> },
    { id: 'archive',    label: 'Архив',            icon: <History size={16}/> },
  ];

  return (
    <div className="space-y-4 pb-12">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 flex flex-wrap gap-1 sticky top-[89px] md:top-2 z-10">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 md:px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${tab === t.id ? 'bg-slate-800 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>
            {t.icon} <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <Dashboard plan={plan} forecasts={forecasts} proposals={proposals} reserves={reserves} onSwitchTab={setTab}/>}
      {tab === 'plan' && (
        <WeeklyPlanView
          plan={plan}
          forecasts={forecasts}
          proposals={proposals}
          isAdmin={isAdmin}
          onUpdatePlan={handleUpdatePlan}
          onAddForecast={handleAddForecast}
          onUpdateForecast={handleUpdateForecast}
          onDeleteForecast={handleDeleteForecast}
          onAddProposal={handleAddProposal}
          onUpdateProposal={handleUpdateProposal}
          onDeleteProposal={handleDeleteProposal}
        />
      )}
      {tab === 'reserves' && <ReservesView reserves={reserves} isAdmin={isAdmin} onUpdate={handleUpdateReserve} onAdd={handleAddReserve} onDelete={handleDeleteReserve}/>}
      {tab === 'workflow' && <WorkflowView plan={plan} isAdmin={isAdmin} onAdvance={(s) => plan && handleUpdatePlan({ ...plan, status: s, updated_at: new Date().toISOString() })}/>}
      {tab === 'archive' && <ArchiveView plans={archivePlans}/>}
    </div>
  );
};

export default FinPlan;
