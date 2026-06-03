// Node-окружение не имеет localStorage — копируем buildDemoData без storage.
import { WeeklyPlan, IncomeForecast, ExpenseProposal, ReserveAccount, FP1LineItem, SVDHistoryPoint, FP1DocStatus, FP1DocKey } from '../src/types';
import { DEFAULT_FP1_LINES, DEFAULT_RESERVES } from '../src/constants';

const uid = () => `id-${Math.random().toString(36).slice(2, 10)}`;
const startOfWeek = (d: Date): Date => { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day)); x.setHours(0,0,0,0); return x; };
const endOfWeek = (d: Date): Date => { const x = startOfWeek(d); x.setDate(x.getDate() + 6); return x; };
const fmtDate = (d: Date): string => d.toISOString().slice(0, 10);

export function loadStoreInit() {
  const now = new Date();
  const ws = startOfWeek(now);
  const we = endOfWeek(now);
  const planId = 'plan-current';

  const svd_history: SVDHistoryPoint[] = [];
  for (let i = 16; i >= 1; i--) {
    const d = new Date(ws); d.setDate(d.getDate() - i * 7);
    const base = 1450000;
    const seasonal = Math.sin(i / 4) * 200000;
    const gross = Math.round(base + seasonal);
    svd_history.push({ week_start: fmtDate(d), gross_income: gross, adjusted_income: Math.round(gross * 0.92) });
  }

  const currentPlan: WeeklyPlan = {
    id: planId, week_start: fmtDate(ws), week_end: fmtDate(we), status: 'review',
    income_projected: 1850000, income_actual: 720000, expense_projected: 1420000, expense_actual: 380000,
    cash_on_hand_start: 2400000, notes: 'Высокий сезон.', approval_stage: 'budget_review',
    created_at: now.toISOString(), updated_at: now.toISOString(),
  };

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
    { id: uid(), plan_id: planId, dept_id: 'dept3', category: 'taxes',        title: 'Авансовый платёж',       justification: 'Квартальный платёж по налогу',              amount: 180000, priority: 'critical', status: 'approved', proposer: 'Главбух',         vendor: 'ФНС',               is_recurring: true,  created_at: t, updated_at: t },
  ];

  const fp1: FP1LineItem[] = DEFAULT_FP1_LINES.map(l => ({ ...l, id: uid() }));
  const reserves: ReserveAccount[] = DEFAULT_RESERVES.map(r => ({ ...r, id: uid() }));
  const docs: FP1DocStatus[] = (['bank_summary','payables_summary','receivables_summary','cash_on_hand','avg_svd','fp1_current','income_plan','expense_plan'] as FP1DocKey[]).map(k => {
    const ready = ['bank_summary','cash_on_hand','avg_svd','fp1_current','income_plan'].includes(k);
    return { key: k, ready, prepared_by: ready ? 'Финансовый отдел' : undefined, prepared_at: ready ? t : undefined };
  });

  return { plans: [currentPlan], forecasts, proposals, reserves, fp1, svd_history, docs, current_plan_id: planId };
}
