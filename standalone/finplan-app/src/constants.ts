import {
  IncomeSource, ExpenseCategory, ExpensePriority, ExpenseStatus,
  ReserveType, FinancialCondition, PlanStatus, FP1SectionKey,
  ApprovalStage, FP1DocKey, Department, ReserveAccount, FP1LineItem
} from './types';

export const DEPARTMENTS: Department[] = [
  { id: 'dept7', name: '7. Административный', color: '#0ea5e9' },
  { id: 'dept1', name: '1. Построения / HR',   color: '#fbbf24' },
  { id: 'dept2', name: '2. Коммерческий',      color: '#a855f7' },
  { id: 'dept3', name: '3. Финансовый',        color: '#ec4899' },
  { id: 'dept4', name: '4. Производства',      color: '#22c55e' },
  { id: 'dept5', name: '5. Качества',          color: '#64748b' },
  { id: 'dept6', name: '6. Расширения',        color: '#f97316' },
];

export const INCOME_SOURCE_LABELS: Record<IncomeSource, { label: string; color: string }> = {
  group_tours:      { label: 'Групповые туры',        color: '#3b82f6' },
  individual_tours: { label: 'Индивидуальные туры',   color: '#8b5cf6' },
  excursions:       { label: 'Экскурсии',             color: '#22c55e' },
  transfers:        { label: 'Трансферы',             color: '#06b6d4' },
  hotel_commission: { label: 'Комиссии отелей',       color: '#f59e0b' },
  partners:         { label: 'Партнёры и агенты',     color: '#ec4899' },
  corporate:        { label: 'Корпоративные клиенты', color: '#64748b' },
  other:            { label: 'Прочие поступления',    color: '#94a3b8' },
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, { label: string; color: string }> = {
  payroll:      { label: 'ФОТ (зарплаты)',       color: '#ef4444' },
  taxes:        { label: 'Налоги и взносы',      color: '#dc2626' },
  rent:         { label: 'Аренда',               color: '#a855f7' },
  utilities:    { label: 'Связь / ЖКХ',          color: '#6366f1' },
  marketing:    { label: 'Маркетинг и реклама',  color: '#ec4899' },
  hotel_prepay: { label: 'Предоплаты отелям',    color: '#f59e0b' },
  transport:    { label: 'Транспорт и ГСМ',      color: '#06b6d4' },
  guides_fees:  { label: 'Гонорары гидам',       color: '#10b981' },
  insurance:    { label: 'Страхование',          color: '#0891b2' },
  software:     { label: 'ПО и подписки',        color: '#8b5cf6' },
  office:       { label: 'Офисные расходы',      color: '#64748b' },
  maintenance:  { label: 'Обслуживание',         color: '#475569' },
  training:     { label: 'Обучение персонала',   color: '#22c55e' },
  pr:           { label: 'PR и репутация',       color: '#f97316' },
  legal:        { label: 'Юр. сопровождение',    color: '#334155' },
  bank_fees:    { label: 'Банковские комиссии',  color: '#94a3b8' },
  other:        { label: 'Прочие расходы',       color: '#cbd5e1' },
};

export const PRIORITY_LABELS: Record<ExpensePriority, { label: string; color: string; bg: string; order: number }> = {
  critical: { label: 'Критично',   color: '#dc2626', bg: '#fef2f2', order: 1 },
  high:     { label: 'Высокий',    color: '#f97316', bg: '#fff7ed', order: 2 },
  normal:   { label: 'Обычный',    color: '#3b82f6', bg: '#eff6ff', order: 3 },
  low:      { label: 'Низкий',     color: '#64748b', bg: '#f1f5f9', order: 4 },
};

export const STATUS_LABELS: Record<ExpenseStatus, { label: string; color: string; bg: string }> = {
  proposed: { label: 'Подана',       color: '#64748b', bg: '#f1f5f9' },
  reviewed: { label: 'Рассмотрена',  color: '#3b82f6', bg: '#eff6ff' },
  approved: { label: 'Утверждена',   color: '#22c55e', bg: '#f0fdf4' },
  rejected: { label: 'Отклонена',    color: '#ef4444', bg: '#fef2f2' },
  paid:     { label: 'Оплачена',     color: '#0ea5e9', bg: '#f0f9ff' },
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, { label: string; color: string; bg: string }> = {
  draft:      { label: 'Черновик',         color: '#94a3b8', bg: '#f1f5f9' },
  collecting: { label: 'Сбор заявок',      color: '#0ea5e9', bg: '#f0f9ff' },
  review:     { label: 'На рассмотрении',  color: '#f59e0b', bg: '#fffbeb' },
  approved:   { label: 'Утверждён',        color: '#22c55e', bg: '#f0fdf4' },
  executing:  { label: 'В исполнении',     color: '#8b5cf6', bg: '#f5f3ff' },
  closed:     { label: 'Закрыт',           color: '#64748b', bg: '#f8fafc' },
};

export const RESERVE_TYPE_LABELS: Record<ReserveType, { label: string; color: string; description: string }> = {
  operational: { label: 'Оборотный',      color: '#3b82f6', description: 'Текущие операции компании' },
  payroll:     { label: 'Зарплатный',     color: '#ef4444', description: 'Защищённые средства на ФОТ' },
  tax:         { label: 'Налоговый',      color: '#dc2626', description: 'Накопления для уплаты налогов' },
  growth:      { label: 'Развития',       color: '#22c55e', description: 'Инвестиции в рост' },
  investment:  { label: 'Инвестиционный', color: '#8b5cf6', description: 'Долгосрочные капитальные вложения' },
  emergency:   { label: 'Резервный',      color: '#f59e0b', description: 'Подушка безопасности' },
};

export const FINANCIAL_CONDITION_LABELS: Record<FinancialCondition, { label: string; color: string; bg: string; action: string }> = {
  crisis:    { label: 'Кризис',       color: '#7f1d1d', bg: '#fef2f2', action: 'Срочно сократить расходы, остановить все необязательные платежи, мобилизовать сбор дебиторки.' },
  danger:    { label: 'Опасность',    color: '#dc2626', bg: '#fef2f2', action: 'Заморозить новые траты, провести ревизию контрактов, увеличить активность по продажам.' },
  emergency: { label: 'Чрезвычайная', color: '#f97316', bg: '#fff7ed', action: 'Усилить продвижение и продажи, экономить, готовиться к спросу, укрепить дисциплину.' },
  normal:    { label: 'Норма',        color: '#22c55e', bg: '#f0fdf4', action: 'Не менять то, что работает. Изучать причины роста статистик.' },
  affluence: { label: 'Изобилие',     color: '#3b82f6', bg: '#eff6ff', action: 'Оплатить все счета. Инвестировать в средства производства. Усилить то, что вызвало рост.' },
  power:     { label: 'Могущество',   color: '#8b5cf6', bg: '#f5f3ff', action: 'Не разрывайте связей. Систематизируйте успешные процессы. Документируйте политики.' },
};

export const computeFinancialCondition = (ratio: number): FinancialCondition => {
  if (ratio < 0.5) return 'crisis';
  if (ratio < 1.0) return 'danger';
  if (ratio < 1.5) return 'emergency';
  if (ratio < 2.5) return 'normal';
  if (ratio < 4.0) return 'affluence';
  return 'power';
};

// === ФП №1 ===
export const FP1_SECTION_LABELS: Record<FP1SectionKey, { num: string; label: string; description: string; color: string }> = {
  personnel:   { num: '1', label: 'Персонал',                    description: 'Минимально необходимый штат и еженедельный ФОТ.', color: '#ef4444' },
  basic_needs: { num: '2', label: 'Базовые нужды компании',       description: 'Аренда, связь, ЖКХ, налоги, страхование, отчисления.', color: '#f59e0b' },
  promotion:   { num: '3', label: 'Базовое продвижение',          description: 'Реклама, рассылки, контент, обслуживание агентов.', color: '#ec4899' },
  comms:       { num: '4', label: 'Коммуникационные линии',       description: 'Отчисления HQ, внутренние документы, связь.', color: '#8b5cf6' },
  delivery:    { num: '5', label: 'Базовое предоставление услуг', description: 'Расходники, оборудование, гиды, методические материалы.', color: '#22c55e' },
  commodity:   { num: '6', label: 'Товарный счёт (отдельно)',     description: 'Сувениры, гайды, упаковка, новые наименования.', color: '#0ea5e9' },
};

export const FP1_DOC_PACKAGE: Record<FP1DocKey, { label: string; description: string; preparer: string }> = {
  bank_summary:        { label: 'Сводка по банковским счетам',       description: 'Остатки по всем счетам компании (без целевых)',                preparer: 'Финансовый отдел' },
  payables_summary:    { label: 'Сводка счетов к оплате',             description: 'Все неоплаченные счета + платежи по займам',                  preparer: 'Отдел расходов' },
  receivables_summary: { label: 'Сводка дебиторской задолженности',   description: 'Сумма к получению от клиентов и контрагентов',                preparer: 'Отдел доходов' },
  cash_on_hand:        { label: 'Расчёт «Деньги в наличии»',          description: 'Банк (последняя сверка) + касса на 14:00 четверга',          preparer: 'Финансовый отдел' },
  avg_svd:             { label: 'Средний СВД за 4 месяца',            description: 'Скорректированный валовой доход за 16 недель',                preparer: 'Бухгалтерия' },
  fp1_current:         { label: 'Текущий ФП №1',                       description: 'Актуальная версия программы базовых расходов',                preparer: 'Бюджетный комитет' },
  income_plan:         { label: 'План дохода на неделю',               description: 'Прогноз поступлений по источникам',                            preparer: 'Коммерческий отдел' },
  expense_plan:        { label: 'Проект финплана расходов',            description: 'Утверждаемый набор статей расходов недели',                    preparer: 'Бюджетный комитет' },
};

export const APPROVAL_PIPELINE: { stage: ApprovalStage; label: string; actor: string; role: string; description: string; color: string }[] = [
  { stage: 'dept_requests',  label: 'Заявки отделов',       actor: 'Руководители отделов',  role: 'Инициатор',     description: 'Подают заявки на приобретение с обоснованием и информацией о потребностях.',                          color: '#0ea5e9' },
  { stage: 'budget_review',  label: 'Бюджетный комитет',    actor: 'Главы 7 департаментов', role: 'Совещательный', description: 'Анализируют заявки, формируют план дохода и проект финплана расходов. Передают рекомендации выше.', color: '#f59e0b' },
  { stage: 'exec_decision',  label: 'Исполнительный комитет', actor: 'Топ-менеджмент',        role: 'Решающий',     description: 'Одобряет план, меняет суммы или возвращает на доработку. Несёт ответственность за платёжеспособность.', color: '#8b5cf6' },
  { stage: 'fin_allocation', label: 'Финансовый менеджер',   actor: 'Финансовый менеджер',  role: 'Контроль',     description: 'Проверяет связь расходов с ростом производства. При согласии выдаёт ассигнования.',                  color: '#22c55e' },
];

export const ALLOCATION_PRIORITIES = [
  { order: 1, label: 'Базовые расходы по ФП №1',        rule: '100% покрытия',           color: '#ef4444', description: 'Минимально необходимые расходы по разделам 1–5.' },
  { order: 2, label: 'Просроченные счета к оплате',     rule: '10–15% от СВД',           color: '#f97316', description: 'Если есть просрочка — обязательное еженедельное отчисление.' },
  { order: 3, label: 'Резервный счёт компании',         rule: '≥5% от СВД',              color: '#3b82f6', description: 'После погашения просрочки — обязательное накопление.' },
  { order: 4, label: 'Расширение и развитие',           rule: 'Свободный остаток',       color: '#22c55e', description: 'Усиление продвижения, увеличение штата, оборудование.' },
];

export const DEFAULT_FP1_LINES: Omit<FP1LineItem, 'id'>[] = [
  // Раздел 1
  { section: 'personnel',   sort_order: 1, title: 'ФОТ штатных сотрудников',           weekly_amount: 480000, notes: 'По утверждённой системе зарплат' },
  { section: 'personnel',   sort_order: 2, title: 'Премиальный фонд (производственный)', weekly_amount: 65000, notes: 'Бонусы за KPI' },
  { section: 'personnel',   sort_order: 3, title: 'Налоги и взносы с ФОТ',             weekly_amount: 145000, notes: 'НДФЛ + страховые' },
  // Раздел 2
  { section: 'basic_needs', sort_order: 1, title: 'Аренда офиса и складов',            weekly_amount: 87500 },
  { section: 'basic_needs', sort_order: 2, title: 'Связь, интернет, телефония',        weekly_amount: 12500 },
  { section: 'basic_needs', sort_order: 3, title: 'Электроэнергия и вода',             weekly_amount: 8200 },
  { section: 'basic_needs', sort_order: 4, title: 'Местные налоги и сборы',            weekly_amount: 14000 },
  { section: 'basic_needs', sort_order: 5, title: 'Юр. сопровождение',                 weekly_amount: 22000 },
  { section: 'basic_needs', sort_order: 6, title: 'Обслуживание помещений и техники', weekly_amount: 11500 },
  { section: 'basic_needs', sort_order: 7, title: 'Амортизация оборудования',          weekly_amount: 18000 },
  { section: 'basic_needs', sort_order: 8, title: 'Канцелярия и расходники',           weekly_amount: 6500 },
  { section: 'basic_needs', sort_order: 9, title: 'Страхование имущества',             weekly_amount: 9500 },
  { section: 'basic_needs', sort_order:10, title: 'Фонд компенсации потерь',           weekly_amount: 0, is_percent: true, percent_of_svd: 5, notes: '5% от СВД' },
  { section: 'basic_needs', sort_order:11, title: 'Инвестиционный фонд',               weekly_amount: 0, is_percent: true, percent_of_svd: 5, notes: '5% от СВД' },
  { section: 'basic_needs', sort_order:12, title: 'Резервный счёт компании',           weekly_amount: 0, is_percent: true, percent_of_svd: 5, notes: '≥5% от СВД' },
  // Раздел 3
  { section: 'promotion',   sort_order: 1, title: 'Таргетированная реклама в соцсетях',weekly_amount: 65000 },
  { section: 'promotion',   sort_order: 2, title: 'Контекстная реклама',               weekly_amount: 45000 },
  { section: 'promotion',   sort_order: 3, title: 'Рассылки коммерческих предложений', weekly_amount: 8500 },
  { section: 'promotion',   sort_order: 4, title: 'Дайджест постоянным клиентам',      weekly_amount: 6500 },
  { section: 'promotion',   sort_order: 5, title: 'Реклама входных экскурсий',         weekly_amount: 28000 },
  { section: 'promotion',   sort_order: 6, title: 'Программа лояльности',              weekly_amount: 12000 },
  { section: 'promotion',   sort_order: 7, title: 'Обслуживание партнёрской сети',     weekly_amount: 18500 },
  { section: 'promotion',   sort_order: 8, title: 'Производство контента',             weekly_amount: 22000 },
  // Раздел 4
  { section: 'comms',       sort_order: 1, title: 'Отчисления HQ',                     weekly_amount: 0, is_percent: true, percent_of_svd: 10, notes: '10% от СВД' },
  { section: 'comms',       sort_order: 2, title: 'Внутренние регламенты, печать',     weekly_amount: 4500 },
  { section: 'comms',       sort_order: 3, title: 'Курьерская доставка / почта',       weekly_amount: 3500 },
  { section: 'comms',       sort_order: 4, title: 'Подписки на ПО (CRM, аналитика)',   weekly_amount: 12500 },
  { section: 'comms',       sort_order: 5, title: 'Видео и презентации',               weekly_amount: 5500 },
  { section: 'comms',       sort_order: 6, title: 'Внешние тренеры для персонала',     weekly_amount: 11000 },
  // Раздел 5
  { section: 'delivery',    sort_order: 1, title: 'Расходники для туристов',           weekly_amount: 8500 },
  { section: 'delivery',    sort_order: 2, title: 'ГСМ и техосмотр транспорта',        weekly_amount: 65000 },
  { section: 'delivery',    sort_order: 3, title: 'Аудиогиды и оборудование',          weekly_amount: 9500 },
  { section: 'delivery',    sort_order: 4, title: 'Гонорары гидам (подрядчики)',       weekly_amount: 95000 },
  { section: 'delivery',    sort_order: 5, title: 'Гонорары водителям',                weekly_amount: 48000 },
  { section: 'delivery',    sort_order: 6, title: 'Печать бланков и чек-листов',       weekly_amount: 2500 },
  { section: 'delivery',    sort_order: 7, title: 'Методические бюллетени',            weekly_amount: 3500 },
  { section: 'delivery',    sort_order: 8, title: 'Контроль качества',                 weekly_amount: 7500 },
  { section: 'delivery',    sort_order: 9, title: 'Аптечки, первая помощь',            weekly_amount: 2200 },
  // Раздел 6
  { section: 'commodity',   sort_order: 1, title: 'Закупка сувенирной продукции',      weekly_amount: 35000 },
  { section: 'commodity',   sort_order: 2, title: 'Закупка путеводителей и книг',      weekly_amount: 12000 },
  { section: 'commodity',   sort_order: 3, title: 'Продвижение товаров',               weekly_amount: 8500 },
  { section: 'commodity',   sort_order: 4, title: 'Упаковка и отправка',               weekly_amount: 4500 },
  { section: 'commodity',   sort_order: 5, title: 'Резерв на новые наименования',      weekly_amount: 6000 },
];

export const DEFAULT_RESERVES: Omit<ReserveAccount, 'id'>[] = [
  { name: 'Оборотный счёт',      type: 'operational', description: 'Текущие операции',           balance: 1850000, target_balance: 2500000, allocation_percent: 35, is_active: true, bank_name: 'Точка' },
  { name: 'Зарплатный резерв',   type: 'payroll',     description: 'Защищённые средства на ФОТ', balance: 720000,  target_balance: 1000000, allocation_percent: 25, is_active: true, bank_name: 'Точка' },
  { name: 'Налоговый резерв',    type: 'tax',         description: 'Накопления на налоги',       balance: 540000,  target_balance: 800000,  allocation_percent: 15, is_active: true, bank_name: 'Сбер' },
  { name: 'Резервный фонд',      type: 'emergency',   description: 'Подушка 3–6 мес.',           balance: 1100000, target_balance: 2000000, allocation_percent: 10, is_active: true, bank_name: 'Сбер' },
  { name: 'Фонд развития',       type: 'growth',      description: 'Маркетинг, новые направления', balance: 320000, target_balance: 600000, allocation_percent: 10, is_active: true, bank_name: 'Тинькофф' },
  { name: 'Инвестиционный фонд', type: 'investment',  description: 'Капитальные вложения',       balance: 250000,  target_balance: 1500000, allocation_percent: 5,  is_active: true, bank_name: 'Тинькофф' },
];

export const FIN_WORKFLOW: { day: string; phase: PlanStatus; title: string; description: string; role: string }[] = [
  { day: 'Понедельник', phase: 'collecting', title: 'Сбор заявок и прогноза дохода',         description: 'Руководители отделов подают заявки. Финансовый менеджер собирает прогноз поступлений.', role: 'Руководители отделов + Финменеджер' },
  { day: 'Вторник',     phase: 'review',     title: 'Бюджетный комитет',                     description: 'Сортируют заявки по приоритету, проверяют обоснованность, готовят рекомендации.',       role: 'Бюджетный комитет' },
  { day: 'Среда',       phase: 'approved',   title: 'Исполнительный комитет утверждает',     description: 'Топ-менеджмент принимает финплан, утверждает расходы, аллокацию по резервам.',          role: 'Исполнительный комитет' },
  { day: 'Четверг',     phase: 'executing',  title: 'Исполнение платежей',                   description: 'Финансовая служба проводит утверждённые платежи.',                                       role: 'Финансовый отдел' },
  { day: 'Пятница',     phase: 'executing',  title: 'Доисполнение и сбор поступлений',       description: 'Завершение платежей. Активный сбор дебиторки. Учёт фактических поступлений.',          role: 'Финансовый + Коммерческий' },
  { day: 'Суббота',     phase: 'closed',     title: 'Сверка и отчёт',                        description: 'Банковская сверка. Расчёт «Резервы / Счета к оплате». Закрытие плана.',                 role: 'Финансовый менеджер' },
];
