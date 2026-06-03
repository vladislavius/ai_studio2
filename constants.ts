import { Department, WiseCondition, IncomeSource, ExpenseCategory, ExpensePriority, ExpenseStatus, ReserveType, FinancialCondition, PlanStatus, ReserveAccount, AllocationRule } from './types';

// --- SECURITY CONFIGURATION ---
export const ADMIN_EMAILS = ['hrtisland@gmail.com'];

export const WISE_CONDITIONS: Record<WiseCondition, { label: string, color: string, bg: string }> = {
  'non_existence': { label: 'Несуществование', color: '#94a3b8', bg: '#f1f5f9' },
  'danger': { label: 'Опасность', color: '#ef4444', bg: '#fef2f2' },
  'emergency': { label: 'Чрезвычайное положение', color: '#f97316', bg: '#fff7ed' },
  'normal': { label: 'Нормальная деятельность', color: '#22c55e', bg: '#f0fdf4' },
  'affluence': { label: 'Изобилие', color: '#3b82f6', bg: '#eff6ff' },
  'power': { label: 'Могущество', color: '#8b5cf6', bg: '#f5f3ff' },
  'power_change': { label: 'Смена власти', color: '#a855f7', bg: '#faf5ff' },
};

export const CONDITION_FORMULAS: Record<WiseCondition, string[]> = {
    'non_existence': ["1. Найдите линии коммуникации.", "2. Добейтесь, чтобы о вас узнали.", "3. Выясните, что другим требуется.", "4. Делайте, производите и предоставляйте это."],
    'danger': ["1. Обойдите привычки.", "2. Справьтесь с ситуацией.", "3. Назначьте состояние Опасности.", "4. Введите собственную этику.", "5. Реорганизуйте жизнь.", "6. Примите твёрдое правило."],
    'emergency': ["1. Продвигайте!", "2. Измените образ действий.", "3. Экономьте.", "4. Приготовьтесь предоставлять.", "5. Укрепите дисциплину."],
    'normal': ["1. Ничего не меняйте.", "2. Этика очень мягкая.", "3. Изучите, что улучшило статистику.", "4. Если падает — быстро выясните причину."],
    'affluence': ["1. Экономьте.", "2. Оплатите все счета.", "3. Вложите в средства производства.", "4. Укрепите то, что вызвало рост."],
    'power': ["1. Не разрывайте связей.", "2. Составьте описание своей должности."],
    'power_change': ["1. Примите должность.", "2. Следуйте формуле Несуществования."]
};

export const ORGANIZATION_STRUCTURE: { [key: string]: Department } = {
  "owner": {
      id: "owner",
      name: "Учредитель",
      fullName: "Офис Учредителя",
      color: "#f59e0b",
      icon: "crown",
      description: "Стратегическое управление и замыслы.",
      manager: "Владелец",
      departments: {} 
  },
  "dept7": {
      id: "dept7",
      name: "7. Административный",
      fullName: "7. Административный Департамент",
      color: "#0ea5e9",
      icon: "building",
      description: "Стратегическое планирование и надзор.",
      manager: "Исполнительный Директор (ИД)",
      departments: {
          "dept7_19": { id: "dept7_19", name: "Отдел 7.19 - ГД", code: "19", manager: "ИД", vfp: "Жизнеспособная компания" },
          "dept7_20": { id: "dept7_20", name: "Отдел 7.20 - Юр. вопросы", code: "20", manager: "Юрист", vfp: "Безопасность" },
          "dept7_21": { id: "dept7_21", name: "Отдел 7.21 - Офис совета", code: "21", manager: "Учредитель", vfp: "Активы" }
      }
  },
  "dept1": {
      id: "dept1",
      name: "1. Построения",
      fullName: "1. Департамент Построения",
      color: "#fbbf24",
      icon: "users",
      description: "Строители Организации и кадров.",
      manager: "Директор по персоналу",
      departments: {
          "dept1_1": { id: "dept1_1", name: "Отдел 1.1 - Найм", code: "1", manager: "Нач. Найма", vfp: "Продуктивный штат" },
          "dept1_2": { id: "dept1_2", name: "Отдел 1.2 - Коммуникации", code: "2", manager: "Офис-менеджер", vfp: "Линии связи" },
          "dept1_3": { id: "dept1_3", name: "Отдел 1.3 - Инспекция", code: "3", manager: "Инспектор", vfp: "Эффективность" }
      }
  },
  "dept2": {
      id: "dept2",
      name: "2. Коммерческий",
      fullName: "2. Коммерческий Департамент",
      color: "#a855f7",
      icon: "briefcase",
      description: "Продажи и Продвижение.",
      manager: "Коммерческий директор",
      departments: {
          "dept2_4": { id: "dept2_4", name: "Отдел 2.4 - Маркетинг", code: "4", manager: "Маркетолог", vfp: "Лиды" },
          "dept2_5": { id: "dept2_5", name: "Отдел 2.5 - Контент", code: "5", manager: "Контент-менеджер", vfp: "Понимание продукта" },
          "dept2_6": { id: "dept2_6", name: "Отдел 2.6 - Продажи", code: "6", manager: "РОП", vfp: "Доход" }
      }
  },
  "dept3": {
      id: "dept3",
      name: "3. Финансовый",
      fullName: "3. Финансовый Департамент",
      color: "#ec4899",
      icon: "trending-up",
      description: "Учет и распределение средств.",
      manager: "Фин. директор",
      departments: {
          "dept3_7": { id: "dept3_7", name: "Отдел 3.7 - Доходы", code: "7", manager: "Кассир", vfp: "Собранные деньги" },
          "dept3_8": { id: "dept3_8", name: "Отдел 3.8 - Расходы", code: "8", manager: "Фин. менеджер", vfp: "Оплаченные счета" },
          "dept3_9": { id: "dept3_9", name: "Отдел 3.9 - Бухгалтерия", code: "9", manager: "Главбух", vfp: "Точный учет" }
      }
  },
  "dept4": {
      id: "dept4",
      name: "4. Производства",
      fullName: "4. Департамент Производства",
      color: "#22c55e",
      icon: "settings",
      description: "Создание продукта и сервис.",
      manager: "Директор по производству",
      departments: {
          "dept4_10": { id: "dept4_10", name: "Отдел 4.10 - Бронирование", code: "10", manager: "Менеджер", vfp: "Заказы" },
          "dept4_11": { id: "dept4_11", name: "Отдел 4.11 - Транспорт", code: "11", manager: "Логист", vfp: "Трансферы" },
          "dept4_12": { id: "dept4_12", name: "Отдел 4.12 - Предоставление", code: "12", manager: "Координатор", vfp: "Исполненные услуги" }
      }
  },
  "dept5": {
      id: "dept5",
      name: "5. Качества",
      fullName: "5. Департамент Качества",
      color: "#64748b",
      icon: "award",
      description: "Контроль и обучение.",
      manager: "Директор по качеству",
      departments: {
          "dept5_13": { id: "dept5_13", name: "Отдел 5.13 - Контроль", code: "13", manager: "ОКК", vfp: "Безупречный продукт" },
          "dept5_14": { id: "dept5_14", name: "Отдел 5.14 - Обучение", code: "14", manager: "Тренер", vfp: "Компетентные кадры" },
          "dept5_15": { id: "dept5_15", name: "Отдел 5.15 - Методология", code: "15", manager: "Методист", vfp: "Стандарты" }
      }
  },
  "dept6": {
      id: "dept6",
      name: "6. Расширения",
      fullName: "6. Департамент Расширения",
      color: "#f97316",
      icon: "globe",
      description: "PR и новые рынки.",
      manager: "Директор по развитию",
      departments: {
          "dept6_16": { id: "dept6_16", name: "Отдел 6.16 - PR", code: "16", manager: "PR-менеджер", vfp: "Известность" },
          "dept6_17": { id: "dept6_17", name: "Отдел 6.17 - Вводные услуги", code: "17", manager: "Менеджер", vfp: "Новые клиенты" },
          "dept6_18": { id: "dept6_18", name: "Отдел 6.18 - Партнеры", code: "18", manager: "Партнер-менеджер", vfp: "Поток от агентов" }
      }
  }
};

// ROLE_STAT_TEMPLATES is used as a fallback for statistic templates based on sub-department IDs to fix the import error in EmployeeModal.tsx.
export const ROLE_STAT_TEMPLATES: Record<string, any[]> = {};

export const HANDBOOK_STATISTICS = [
    // --- 7. АДМИНИСТРАТИВНЫЙ (10 статистик) ---
    { owner_id: "dept7", title: "Соотношение Резервы / Счета (ГСД)", is_favorite: true, is_double: true },
    { owner_id: "dept7", title: "Валовая выручка компании (ГСД)", is_favorite: true },
    { owner_id: "dept7", title: "Завершенные задачи по стратегии (ГСД)", is_favorite: true },
    { owner_id: "dept7", title: "Количество совещаний комитета", is_favorite: false },
    { owner_id: "dept7_19", title: "Маржинальная прибыль (ГСД)", is_favorite: true },
    { owner_id: "dept7_19", title: "Индекс жизнеспособности", is_favorite: false },
    { owner_id: "dept7_20", title: "Баллы по юр. вопросам (ГСД)", is_favorite: true },
    { owner_id: "dept7_20", title: "Пункты чек-листа безопасности", is_favorite: false },
    { owner_id: "dept7_21", title: "Кол-во стратегических партнеров (ГСД)", is_favorite: true },
    { owner_id: "dept7_21", title: "Рост стоимости активов", is_favorite: false },

    // --- 1. ПОСТРОЕНИЯ (10 статистик) ---
    { owner_id: "dept1", title: "Кол-во штатных сотрудников (ГСД)", is_favorite: true },
    { owner_id: "dept1", title: "Процент персонала на постах (ГСД)", is_favorite: true },
    { owner_id: "dept1", title: "Кол-во сотрудников с растущими статами (ГСД)", is_favorite: true },
    { owner_id: "dept1", title: "Обнаруженные/улаженные этики (ГСД)", is_favorite: true, is_double: true, inverted: true },
    { owner_id: "dept1_1", title: "Новые введенные в должность (ГСД)", is_favorite: true },
    { owner_id: "dept1_1", title: "Баллы за должностные инструкции", is_favorite: false },
    { owner_id: "dept1_2", title: "Бесперебойность систем IT (ГСД)", is_favorite: true },
    { owner_id: "dept1_2", title: "Кол-во внутренних сообщений", is_favorite: false },
    { owner_id: "dept1_3", title: "Баллы по инспекциям (ГСД)", is_favorite: true },
    { owner_id: "dept1_3", title: "Завершенные доклады об исполнении", is_favorite: false },

    // --- 2. КОММЕРЧЕСКИЙ (15 статистик) ---
    { owner_id: "dept2", title: "Общий валовой доход (ГСД)", is_favorite: true },
    { owner_id: "dept2", title: "Общее кол-во лидов (ГСД)", is_favorite: true },
    { owner_id: "dept2", title: "Конверсия в оплату (ГСД)", is_favorite: true },
    { owner_id: "dept2", title: "Кол-во новых оплат (ГСД)", is_favorite: true },
    { owner_id: "dept2_4", title: "Кол-во новых лидов маркетинга (ГСД)", is_favorite: true },
    { owner_id: "dept2_4", title: "Стоимость лида (CPL) (ГСД)", is_favorite: true, inverted: true },
    { owner_id: "dept2_4", title: "Кол-во рекламных откликов", is_favorite: false },
    { owner_id: "dept2_4", title: "Баллы за охват в соцсетях", is_favorite: false },
    { owner_id: "dept2_5", title: "Кол-во консультаций (ГСД)", is_favorite: true },
    { owner_id: "dept2_5", title: "Кол-во отправленных предложений (ГСД)", is_favorite: true },
    { owner_id: "dept2_5", title: "Баллы за полезный контент", is_favorite: false },
    { owner_id: "dept2_6", title: "Личный объем продаж THB (ГСД)", is_favorite: true },
    { owner_id: "dept2_6", title: "Кол-во повторных продаж (ГСД)", is_favorite: true },
    { owner_id: "dept2_6", title: "Сумма предоплат", is_favorite: false },
    { owner_id: "dept2_6", title: "Средний чек сделки", is_favorite: false },

    // --- 3. ФИНАНСОВЫЙ (10 статистик) ---
    { owner_id: "dept3", title: "Сумма собранных денег (ГСД)", is_favorite: true },
    { owner_id: "dept3", title: "Дебиторская задолженность (ГСД)", is_favorite: true, inverted: true },
    { owner_id: "dept3", title: "Коэффициент ликвидности", is_favorite: false },
    { owner_id: "dept3_7", title: "Своевременные поступления (ГСД)", is_favorite: true },
    { owner_id: "dept3_7", title: "Кол-во выставленных счетов", is_favorite: false },
    { owner_id: "dept3_8", title: "Кредиторская задолженность (ГСД)", is_favorite: true, inverted: true },
    { owner_id: "dept3_8", title: "Сумма сэкономленных средств", is_favorite: false },
    { owner_id: "dept3_9", title: "Точность учета % (ГСД)", is_favorite: true },
    { owner_id: "dept3_9", title: "Сданные вовремя отчеты", is_favorite: false },
    { owner_id: "dept3_9", title: "Баллы за аудит документов", is_favorite: false },

    // --- 4. ПРОИЗВОДСТВА (10 статистик) ---
    { owner_id: "dept4", title: "Объем оказанных услуг (ГСД)", is_favorite: true },
    { owner_id: "dept4", title: "Кол-во довольных клиентов (ГСД)", is_favorite: true },
    { owner_id: "dept4", title: "Индекс загрузки ресурсов", is_favorite: false },
    { owner_id: "dept4_10", title: "Подтвержденные брони (ГСД)", is_favorite: true },
    { owner_id: "dept4_10", title: "Процент отмен бронирований", is_favorite: false, inverted: true },
    { owner_id: "dept4_11", title: "Успешные трансферы (ГСД)", is_favorite: true },
    { owner_id: "dept4_11", title: "Километраж без сбоев", is_favorite: false },
    { owner_id: "dept4_12", title: "Кол-во проведенных экскурсий (ГСД)", is_favorite: true },
    { owner_id: "dept4_12", title: "Сумма выплат подрядчикам", is_favorite: false },
    { owner_id: "dept4_12", title: "Баллы за техническое состояние", is_favorite: false },

    // --- 5. КАЧЕСТВА (10 статистик) ---
    { owner_id: "dept5", title: "Индекс NPS (ГСД)", is_favorite: true },
    { owner_id: "dept5", title: "Кол-во аттестованных сотрудников (ГСД)", is_favorite: true },
    { owner_id: "dept5", title: "Процент продукта без брака (ГСД)", is_favorite: true },
    { owner_id: "dept5_13", title: "Кол-во проверок ОКК (ГСД)", is_favorite: true },
    { owner_id: "dept5_13", title: "Улаженные претензии", is_favorite: false },
    { owner_id: "dept5_14", title: "Завершенные курсы обучения (ГСД)", is_favorite: true },
    { owner_id: "dept5_14", title: "Баллы за проф. подготовку", is_favorite: false },
    { owner_id: "dept5_15", title: "Внедренные улучшения (ГСД)", is_favorite: true },
    { owner_id: "dept5_15", title: "Исправленные ошибки процессов", is_favorite: false },
    { owner_id: "dept5_15", title: "Обновленные инструкции (Шт.)", is_favorite: false },

    // --- 6. РАСШИРЕНИЯ (10 статистик) ---
    { owner_id: "dept6", title: "Кол-во новых имен в базе (ГСД)", is_favorite: true },
    { owner_id: "dept6", title: "Индекс узнаваемости бренда (ГСД)", is_favorite: true },
    { owner_id: "dept6_16", title: "Упоминания в СМИ/блогах (ГСД)", is_favorite: true },
    { owner_id: "dept6_16", title: "Охват целевой аудитории", is_favorite: false },
    { owner_id: "dept6_17", title: "Продано вводных услуг (ГСД)", is_favorite: true },
    { owner_id: "dept6_17", title: "Доход от вводных услуг", is_favorite: false },
    { owner_id: "dept6_18", title: "Кол-во активных агентов (ГСД)", is_favorite: true },
    { owner_id: "dept6_18", title: "Доход от партнерской сети", is_favorite: false },
    { owner_id: "dept6_18", title: "Кол-во встреч с партнерами", is_favorite: false },
    { owner_id: "dept6_18", title: "Новые заключенные договора", is_favorite: false }
];

// ============================================================================
// ФИНАНСОВОЕ ПЛАНИРОВАНИЕ — справочники
// ============================================================================

export const INCOME_SOURCE_LABELS: Record<IncomeSource, { label: string; color: string; icon: string }> = {
  group_tours:      { label: 'Групповые туры',      color: '#3b82f6', icon: 'users' },
  individual_tours: { label: 'Индивидуальные туры', color: '#8b5cf6', icon: 'user' },
  excursions:       { label: 'Экскурсии',           color: '#22c55e', icon: 'map' },
  transfers:        { label: 'Трансферы',           color: '#06b6d4', icon: 'car' },
  hotel_commission: { label: 'Комиссии отелей',     color: '#f59e0b', icon: 'building' },
  partners:         { label: 'Партнёры и агенты',   color: '#ec4899', icon: 'handshake' },
  corporate:        { label: 'Корпоративные клиенты', color: '#64748b', icon: 'briefcase' },
  other:            { label: 'Прочие поступления',  color: '#94a3b8', icon: 'circle' },
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, { label: string; color: string }> = {
  payroll:      { label: 'ФОТ (зарплаты)',          color: '#ef4444' },
  taxes:        { label: 'Налоги и взносы',         color: '#dc2626' },
  rent:         { label: 'Аренда',                  color: '#a855f7' },
  utilities:    { label: 'Связь / ЖКХ',             color: '#6366f1' },
  marketing:    { label: 'Маркетинг и реклама',     color: '#ec4899' },
  hotel_prepay: { label: 'Предоплаты отелям',       color: '#f59e0b' },
  transport:    { label: 'Транспорт и ГСМ',         color: '#06b6d4' },
  guides_fees:  { label: 'Гонорары гидам',          color: '#10b981' },
  insurance:    { label: 'Страхование',             color: '#0891b2' },
  software:     { label: 'ПО и подписки',           color: '#8b5cf6' },
  office:       { label: 'Офисные расходы',         color: '#64748b' },
  maintenance:  { label: 'Обслуживание',            color: '#475569' },
  training:     { label: 'Обучение персонала',      color: '#22c55e' },
  pr:           { label: 'PR и репутация',          color: '#f97316' },
  legal:        { label: 'Юр. сопровождение',       color: '#334155' },
  bank_fees:    { label: 'Банковские комиссии',     color: '#94a3b8' },
  other:        { label: 'Прочие расходы',          color: '#cbd5e1' },
};

export const PRIORITY_LABELS: Record<ExpensePriority, { label: string; color: string; bg: string; order: number }> = {
  critical: { label: 'Критично',   color: '#dc2626', bg: '#fef2f2', order: 1 },
  high:     { label: 'Высокий',    color: '#f97316', bg: '#fff7ed', order: 2 },
  normal:   { label: 'Обычный',    color: '#3b82f6', bg: '#eff6ff', order: 3 },
  low:      { label: 'Низкий',     color: '#64748b', bg: '#f1f5f9', order: 4 },
};

export const STATUS_LABELS: Record<ExpenseStatus, { label: string; color: string; bg: string }> = {
  proposed: { label: 'Подана',     color: '#64748b', bg: '#f1f5f9' },
  reviewed: { label: 'Рассмотрена',color: '#3b82f6', bg: '#eff6ff' },
  approved: { label: 'Утверждена', color: '#22c55e', bg: '#f0fdf4' },
  rejected: { label: 'Отклонена',  color: '#ef4444', bg: '#fef2f2' },
  paid:     { label: 'Оплачена',   color: '#0ea5e9', bg: '#f0f9ff' },
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, { label: string; color: string; bg: string; order: number }> = {
  draft:      { label: 'Черновик',         color: '#94a3b8', bg: '#f1f5f9', order: 1 },
  collecting: { label: 'Сбор заявок',      color: '#0ea5e9', bg: '#f0f9ff', order: 2 },
  review:     { label: 'На рассмотрении',  color: '#f59e0b', bg: '#fffbeb', order: 3 },
  approved:   { label: 'Утверждён',        color: '#22c55e', bg: '#f0fdf4', order: 4 },
  executing:  { label: 'В исполнении',     color: '#8b5cf6', bg: '#f5f3ff', order: 5 },
  closed:     { label: 'Закрыт',           color: '#64748b', bg: '#f8fafc', order: 6 },
};

export const RESERVE_TYPE_LABELS: Record<ReserveType, { label: string; color: string; description: string }> = {
  operational: { label: 'Оборотный',      color: '#3b82f6', description: 'Текущие операции компании' },
  payroll:     { label: 'Зарплатный',     color: '#ef4444', description: 'Защищённые средства на ФОТ' },
  tax:         { label: 'Налоговый',      color: '#dc2626', description: 'Накопления для уплаты налогов' },
  growth:      { label: 'Развития',       color: '#22c55e', description: 'Инвестиции в рост (маркетинг, новые продукты)' },
  investment:  { label: 'Инвестиционный', color: '#8b5cf6', description: 'Долгосрочные капитальные вложения' },
  emergency:   { label: 'Резервный',      color: '#f59e0b', description: 'Подушка безопасности на форс-мажор' },
};

// Финансовое состояние — формула: Резервы / Кредиторская задолженность.
// Чем выше коэффициент, тем устойчивее компания. Адаптация условий из источника.
export const FINANCIAL_CONDITION_LABELS: Record<FinancialCondition, { label: string; color: string; bg: string; threshold: number; action: string }> = {
  crisis:    { label: 'Кризис',         color: '#7f1d1d', bg: '#fef2f2', threshold: 0.5, action: 'Срочно сократить расходы, остановить все необязательные платежи, мобилизовать сбор дебиторки.' },
  danger:    { label: 'Опасность',      color: '#dc2626', bg: '#fef2f2', threshold: 1.0, action: 'Заморозить новые траты, провести ревизию всех контрактов, увеличить активность по продажам.' },
  emergency: { label: 'Чрезвычайная',   color: '#f97316', bg: '#fff7ed', threshold: 1.5, action: 'Усилить продвижение и продажи, экономить, готовиться к спросу, укрепить дисциплину.' },
  normal:    { label: 'Норма',          color: '#22c55e', bg: '#f0fdf4', threshold: 2.5, action: 'Не менять то, что работает. Изучать причины роста статистик.' },
  affluence: { label: 'Изобилие',       color: '#3b82f6', bg: '#eff6ff', threshold: 4.0, action: 'Оплатить все счета. Инвестировать в средства производства. Усилить то, что вызвало рост.' },
  power:     { label: 'Могущество',     color: '#8b5cf6', bg: '#f5f3ff', threshold: 999,  action: 'Не разрывайте связей. Систематизируйте успешные процессы. Документируйте политики.' },
};

export const computeFinancialCondition = (ratio: number): FinancialCondition => {
  if (ratio < 0.5) return 'crisis';
  if (ratio < 1.0) return 'danger';
  if (ratio < 1.5) return 'emergency';
  if (ratio < 2.5) return 'normal';
  if (ratio < 4.0) return 'affluence';
  return 'power';
};

// Базовый набор счетов резервов и правила распределения (можно редактировать в UI)
export const DEFAULT_RESERVE_ACCOUNTS: Omit<ReserveAccount, 'id' | 'created_at' | 'updated_at'>[] = [
  { name: 'Оборотный счёт',        type: 'operational', description: 'Текущие операции',                  balance: 0, target_balance: 0, allocation_percent: 35, is_active: true },
  { name: 'Зарплатный резерв',     type: 'payroll',     description: 'Защищённые средства на ФОТ',        balance: 0, target_balance: 0, allocation_percent: 25, is_active: true },
  { name: 'Налоговый резерв',      type: 'tax',         description: 'Накопления для уплаты налогов',      balance: 0, target_balance: 0, allocation_percent: 15, is_active: true },
  { name: 'Резервный фонд',        type: 'emergency',   description: 'Подушка безопасности 3-6 мес.',      balance: 0, target_balance: 0, allocation_percent: 10, is_active: true },
  { name: 'Фонд развития',         type: 'growth',      description: 'Маркетинг, новые направления',       balance: 0, target_balance: 0, allocation_percent: 10, is_active: true },
  { name: 'Инвестиционный фонд',   type: 'investment',  description: 'Капитальные вложения, имущество',    balance: 0, target_balance: 0, allocation_percent: 5,  is_active: true },
];

// Регламент финпланирования — рабочая неделя (адаптировано из источника)
export const FIN_PLANNING_WORKFLOW: { day: string; phase: PlanStatus; title: string; description: string; role: string }[] = [
  { day: 'Понедельник', phase: 'collecting', title: 'Сбор заявок и прогноза дохода',
    description: 'Руководители отделов подают заявки на расходы по своим подразделениям. Финансовый менеджер собирает прогноз поступлений по источникам (туры, экскурсии, трансферы, партнёры).',
    role: 'Руководители отделов + Финансовый менеджер' },
  { day: 'Вторник',     phase: 'review',     title: 'Рассмотрение в бюджетном комитете',
    description: 'Бюджетный комитет (главы департаментов) сортирует заявки по приоритету, проверяет обоснованность, сопоставляет с прогнозом дохода. Готовит рекомендации.',
    role: 'Бюджетный комитет' },
  { day: 'Среда',       phase: 'approved',   title: 'Утверждение исполнительным комитетом',
    description: 'Исполнительный комитет (руководство компании) принимает финплан на неделю: утверждает расходы, аллокацию по резервам, подписывает приказ.',
    role: 'Исполнительный комитет' },
  { day: 'Четверг',     phase: 'executing',  title: 'Исполнение платежей',
    description: 'Финансовая служба проводит утверждённые платежи. Каждая операция фиксируется и сверяется с заявкой.',
    role: 'Финансовый отдел' },
  { day: 'Пятница',     phase: 'executing',  title: 'Доисполнение и сбор поступлений',
    description: 'Завершение платежей недели. Активный сбор дебиторской задолженности. Учёт фактических поступлений.',
    role: 'Финансовый отдел + Коммерческий отдел' },
  { day: 'Суббота',     phase: 'closed',     title: 'Сверка с банком, отчёт по платёжеспособности',
    description: 'Банковская сверка всех операций. Расчёт коэффициента «Резервы / Счета к оплате». Закрытие недельного плана. Передача данных в архив.',
    role: 'Финансовый менеджер' },
];
