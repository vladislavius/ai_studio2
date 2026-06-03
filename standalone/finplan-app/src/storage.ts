// Универсальный localStorage helper + первичная инициализация демо-данными
import {
  WeeklyPlan, IncomeForecast, ExpenseProposal, ReserveAccount, FP1LineItem,
  SVDHistoryPoint, FP1DocStatus, FP1DocKey
} from './types';
import { DEFAULT_FP1_LINES, DEFAULT_RESERVES } from './constants';

const KEY = 'finplan/v1';

export interface StoreShape {
  plans: WeeklyPlan[];
  forecasts: IncomeForecast[];
  proposals: ExpenseProposal[];
  reserves: ReserveAccount[];
  fp1: FP1LineItem[];
  svd_history: SVDHistoryPoint[];
  docs: FP1DocStatus[];
  current_plan_id: string;
}

export const uid = () => `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const startOfWeek = (d: Date): Date => {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  x.setHours(0, 0, 0, 0);
  return x;
};
export const endOfWeek = (d: Date): Date => {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 6);
  return x;
};
export const fmtDate = (d: Date | string): string => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toISOString().slice(0, 10);
};

function buildDemoData(): StoreShape {
  const now = new Date();
  const ws = startOfWeek(now);
  const we = endOfWeek(now);
  const planId = 'plan-current';

  // Прошлые недели (4 — для расчёта среднего СВД за 4 месяца, упрощённо берём 4 недели)
  const svd_history: SVDHistoryPoint[] = [];
  for (let i = 16; i >= 1; i--) {
    const d = new Date(ws);
    d.setDate(d.getDate() - i * 7);
    const base = 1450000;
    const seasonal = Math.sin(i / 4) * 200000;
    const noise = (Math.random() - 0.5) * 100000;
    const gross = Math.round(base + seasonal + noise);
    const adjusted = Math.round(gross * 0.92); // СВД ≈ доход − комиссии и возвраты
    svd_history.push({ week_start: fmtDate(d), gross_income: gross, adjusted_income: adjusted });
  }

  const currentPlan: WeeklyPlan = {
    id: planId,
    week_start: fmtDate(ws),
    week_end: fmtDate(we),
    status: 'review',
    income_projected: 1850000,
    income_actual: 720000,
    expense_projected: 1420000,
    expense_actual: 380000,
    cash_on_hand_start: 2400000,
    notes: 'Высокий сезон. Ожидаем рост по групповым турам и партнёрской сети.',
    approval_stage: 'budget_review',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // 3 архивных плана
  const archivePlans: WeeklyPlan[] = [-1, -2, -3].map(off => {
    const s = new Date(ws); s.setDate(s.getDate() + off * 7);
    const e = endOfWeek(s);
    const incomeAct = 1450000 + Math.round(Math.random() * 400000 - 100000);
    const expAct = 1200000 + Math.round(Math.random() * 300000 - 100000);
    return {
      id: `plan-${off}`,
      week_start: fmtDate(s),
      week_end: fmtDate(e),
      status: 'closed' as const,
      income_projected: incomeAct + 100000,
      income_actual: incomeAct,
      expense_projected: expAct + 50000,
      expense_actual: expAct,
      cash_on_hand_start: 2200000,
      cash_on_hand_end: 2300000 + Math.round(Math.random() * 200000),
      notes: '',
      approval_stage: 'done' as const,
      created_at: new Date(s).toISOString(),
      updated_at: new Date(e).toISOString(),
    };
  });

  const forecasts: IncomeForecast[] = [
    { id: uid(), plan_id: planId, source: 'group_tours',      description: 'Туры по горным маршрутам',  amount_projected: 720000, amount_actual: 340000, confidence: 'high' },
    { id: uid(), plan_id: planId, source: 'individual_tours', description: 'VIP-индивидуалы',           amount_projected: 350000, amount_actual: 120000, confidence: 'medium' },
    { id: uid(), plan_id: planId, source: 'excursions',       description: 'Городские экскурсии',       amount_projected: 220000, amount_actual: 95000,  confidence: 'high' },
    { id: uid(), plan_id: planId, source: 'transfers',        description: 'Аэропорт + межгород',       amount_projected: 180000, amount_actual: 70000,  confidence: 'high' },
    { id: uid(), plan_id: planId, source: 'partners',         description: 'Поток от агентов',          amount_projected: 250000, amount_actual: 95000,  confidence: 'medium' },
    { id: uid(), plan_id: planId, source: 'hotel_commission', description: 'Комиссия за бронирование',  amount_projected: 130000, amount_actual: 0,      confidence: 'low' },
  ];

  const t = now.toISOString();
  const proposals: ExpenseProposal[] = [
    { id: uid(), plan_id: planId, dept_id: 'dept3', category: 'payroll',      title: 'Зарплата за неделю',     justification: 'Регулярная выплата сотрудникам',           amount: 480000, priority: 'critical', status: 'approved', proposer: 'Финансовый отдел', vendor: 'Штатные сотрудники', is_recurring: true,  created_at: t, updated_at: t },
    { id: uid(), plan_id: planId, dept_id: 'dept4', category: 'hotel_prepay', title: 'Предоплата отелю «Альпина»', justification: 'Бронирование группы 14 чел., заезд 21.06', amount: 285000, priority: 'critical', status: 'approved', proposer: 'Отдел брони',     vendor: 'Альпина',           is_recurring: false, created_at: t, updated_at: t },
    { id: uid(), plan_id: planId, dept_id: 'dept4', category: 'transport',    title: 'ГСМ автопарк',           justification: 'Заправка для трансферов на неделю',        amount: 65000,  priority: 'high',     status: 'approved', proposer: 'Логистика',       vendor: 'Лукойл',            is_recurring: true,  created_at: t, updated_at: t },
    { id: uid(), plan_id: planId, dept_id: 'dept2', category: 'marketing',    title: 'Таргет VK + Instagram',  justification: 'Кампания на летние туры, охват 40K',       amount: 120000, priority: 'high',     status: 'reviewed', proposer: 'Маркетолог',      vendor: 'Реклам. сети',      is_recurring: false, created_at: t, updated_at: t },
    { id: uid(), plan_id: planId, dept_id: 'dept4', category: 'guides_fees',  title: 'Гонорары гидам',         justification: '6 экскурсий на неделе, 4 гида',            amount: 95000,  priority: 'high',     status: 'approved', proposer: 'Координатор',     vendor: 'Гиды-подрядчики',   is_recurring: true,  created_at: t, updated_at: t },
    { id: uid(), plan_id: planId, dept_id: 'dept1', category: 'training',     title: 'Семинар для гидов',      justification: 'Новая программа экскурсий, обучение 2 дня', amount: 45000, priority: 'normal',  status: 'proposed', proposer: 'Директор по обуч.',vendor: 'Тренер Иванов',    is_recurring: false, created_at: t, updated_at: t },
    { id: uid(), plan_id: planId, dept_id: 'dept7', category: 'software',     title: 'Подписки SaaS',          justification: 'CRM, аналитика, рассылки — месячная оплата', amount: 28000, priority: 'normal',  status: 'approved', proposer: 'ИТ-менеджер',     vendor: 'SaaS-провайдеры',  is_recurring: true,  created_at: t, updated_at: t },
    { id: uid(), plan_id: planId, dept_id: 'dept5', category: 'office',       title: 'Канцелярия',             justification: 'Запас на 2 недели',                         amount: 12000, priority: 'low',     status: 'proposed', proposer: 'Офис-менеджер',   vendor: 'Комус',             is_recurring: false, created_at: t, updated_at: t },
    { id: uid(), plan_id: planId, dept_id: 'dept6', category: 'pr',           title: 'Пресс-завтрак',          justification: 'Знакомство со СМИ, новая программа',        amount: 85000, priority: 'normal',  status: 'proposed', proposer: 'PR-менеджер',     vendor: 'Подрядчик ивентов', is_recurring: false, created_at: t, updated_at: t },
    { id: uid(), plan_id: planId, dept_id: 'dept3', category: 'taxes',        title: 'Авансовый платёж',       justification: 'Квартальный платёж по налогу',              amount: 180000, priority: 'critical', status: 'approved', proposer: 'Главбух',         vendor: 'ФНС',               is_recurring: true,  created_at: t, updated_at: t },
    { id: uid(), plan_id: planId, dept_id: 'dept6', category: 'marketing',    title: 'SEO-оптимизация сайта',  justification: 'Подрядчик, увеличение органики',            amount: 35000,  priority: 'normal',  status: 'reviewed', proposer: 'Маркетолог',      vendor: 'SEO-агентство',     is_recurring: true,  created_at: t, updated_at: t },
    { id: uid(), plan_id: planId, dept_id: 'dept4', category: 'maintenance',  title: 'ТО микроавтобуса №2',    justification: 'Плановое обслуживание, замена масла и колодок', amount: 22000, priority: 'high',  status: 'approved', proposer: 'Логист',          vendor: 'СТО',               is_recurring: false, created_at: t, updated_at: t },
  ];

  const fp1: FP1LineItem[] = DEFAULT_FP1_LINES.map(l => ({ ...l, id: uid() }));
  const reserves: ReserveAccount[] = DEFAULT_RESERVES.map(r => ({ ...r, id: uid() }));

  const docs: FP1DocStatus[] = (['bank_summary','payables_summary','receivables_summary','cash_on_hand','avg_svd','fp1_current','income_plan','expense_plan'] as FP1DocKey[]).map(k => {
    const ready = ['bank_summary','cash_on_hand','avg_svd','fp1_current','income_plan'].includes(k);
    return { key: k, ready, prepared_by: ready ? 'Финансовый отдел' : undefined, prepared_at: ready ? t : undefined };
  });

  return {
    plans: [currentPlan, ...archivePlans],
    forecasts,
    proposals,
    reserves,
    fp1,
    svd_history,
    docs,
    current_plan_id: planId,
  };
}

export function loadStore(): StoreShape {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const demo = buildDemoData();
  saveStore(demo);
  return demo;
}

export function saveStore(s: StoreShape) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function resetStore(): StoreShape {
  localStorage.removeItem(KEY);
  return loadStore();
}
