
export interface Employee {
  id: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  position: string;
  nickname?: string;
  birth_date?: string;
  join_date?: string;
  email?: string;
  email2?: string;
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  actual_address?: string;
  registration_address?: string;
  bank_name?: string;
  bank_details?: string;
  crypto_wallet?: string;
  crypto_currency?: string;
  crypto_network?: string;
  inn?: string;
  passport_number?: string;
  passport_date?: string;
  passport_issuer?: string;
  foreign_passport?: string;
  foreign_passport_date?: string;
  foreign_passport_issuer?: string;
  photo_url?: string;
  additional_info?: string;
  department?: string[]; // IDs
  subdepartment?: string[]; // IDs
  emergency_contacts: EmergencyContact[];
  custom_fields: CustomField[];
  attachments: Attachment[];
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
  telegram?: string;
}

export interface CustomField {
  label: string;
  value: string;
}

export interface Attachment {
  id: string;
  employee_id?: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  public_url: string;
  uploaded_at: string;
}

export interface Department {
  id: string;
  name: string;
  fullName: string;
  color: string;
  icon: string;
  description: string;
  longDescription?: string; // New: Detailed description
  functions?: string[]; // New: List of functions
  mainStat?: string; // New: Main Statistic name
  manager: string;
  goal?: string; // Цель
  vfp?: string; // Ценный Конечный Продукт (ЦКП)
  troubleSigns?: string[]; // New: Признаки проблем
  developmentActions?: string[]; // New: Действия по развитию
  departments?: Record<string, SubDepartment>;
}

export interface SubDepartment {
  id: string;
  name: string;
  code: string;
  manager: string;
  description?: string; // New
  vfp?: string; // New
}

// --- Statistics Types ---

export type StatOwnerType = 'company' | 'department' | 'employee';

export type WiseCondition = 'non_existence' | 'danger' | 'emergency' | 'normal' | 'affluence' | 'power' | 'power_change';

export interface StatisticDefinition {
  id: string;
  created_at?: string;
  title: string;
  description?: string; // Общее описание
  calculation_method?: string; // Методика расчета
  purpose?: string; // Цель/ЦКП
  type: StatOwnerType;
  owner_id?: string; // employee_id or dept_id
  inverted?: boolean; // true if lower is better
  is_favorite?: boolean; // New field for favorites
  is_double?: boolean; // New field for Double Statistics (Two lines)
}

export interface StatisticValue {
  id: string;
  definition_id: string;
  date: string; // YYYY-MM-DD
  value: number;
  value2?: number; // Second value for double stats
  condition?: WiseCondition;
  notes?: string;
}

export type ViewMode = 'employees' | 'org_chart' | 'statistics' | 'finplan' | 'settings';

// ============================================================================
// ФИНАНСОВОЕ ПЛАНИРОВАНИЕ (адаптация серии "Финансы" под турбизнес)
// ============================================================================

export type PlanStatus = 'draft' | 'collecting' | 'review' | 'approved' | 'executing' | 'closed';

export interface WeeklyPlan {
  id: string;
  week_start: string; // YYYY-MM-DD (понедельник)
  week_end: string;   // воскресенье
  status: PlanStatus;
  income_projected: number;
  income_actual: number;
  expense_projected: number;
  expense_actual: number;
  cash_on_hand_start: number;
  cash_on_hand_end?: number;
  solvency_ratio?: number; // Резервы / Счета к оплате
  notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export type IncomeSource =
  | 'group_tours'        // Групповые туры
  | 'individual_tours'   // Индивидуальные туры
  | 'excursions'         // Экскурсии
  | 'transfers'          // Трансферы
  | 'hotel_commission'   // Комиссии от отелей
  | 'partners'           // Партнёрский поток
  | 'corporate'          // Корпоративные клиенты
  | 'other';

export interface IncomeForecast {
  id: string;
  plan_id: string;
  source: IncomeSource;
  description?: string;
  amount_projected: number;
  amount_actual: number;
  confidence: 'high' | 'medium' | 'low'; // степень уверенности в поступлении
  notes?: string;
}

export type ExpensePriority = 'critical' | 'high' | 'normal' | 'low';
export type ExpenseStatus = 'proposed' | 'reviewed' | 'approved' | 'rejected' | 'paid';

export type ExpenseCategory =
  | 'payroll'            // ФОТ
  | 'taxes'              // Налоги и взносы
  | 'rent'               // Аренда
  | 'utilities'          // Связь, интернет, ЖКХ
  | 'marketing'          // Реклама и продвижение
  | 'hotel_prepay'       // Предоплаты отелям
  | 'transport'          // Транспорт, ГСМ
  | 'guides_fees'        // Гонорары гидам/подрядчикам
  | 'insurance'          // Страхование
  | 'software'           // ПО, подписки
  | 'office'             // Канцелярия, офис
  | 'maintenance'        // Обслуживание оборудования
  | 'training'           // Обучение персонала
  | 'pr'                 // PR
  | 'legal'              // Юр. сопровождение
  | 'bank_fees'          // Банковские комиссии
  | 'other';

export interface ExpenseProposal {
  id: string;
  plan_id: string;
  dept_id: string;          // подразделение-инициатор
  category: ExpenseCategory;
  title: string;            // короткое название
  justification: string;    // обоснование
  amount: number;
  priority: ExpensePriority;
  status: ExpenseStatus;
  proposer?: string;        // ФИО инициатора
  reviewed_by?: string;     // бюджетный комитет
  approved_by?: string;     // исполнительный комитет
  rejection_reason?: string;
  payment_date?: string;
  vendor?: string;          // получатель/поставщик
  is_recurring?: boolean;   // регулярный платёж
  created_at: string;
  updated_at: string;
}

export type ReserveType = 'operational' | 'tax' | 'growth' | 'emergency' | 'investment' | 'payroll';

export interface ReserveAccount {
  id: string;
  name: string;
  type: ReserveType;
  description?: string;
  balance: number;
  target_balance?: number;     // целевой остаток
  min_balance?: number;        // неснижаемый остаток
  allocation_percent?: number; // % от валового дохода направляется сюда
  bank_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AllocationRule {
  id: string;
  account_id: string;       // → ReserveAccount.id
  account_name: string;
  percent: number;          // доля от валового дохода
  priority: number;         // порядок наполнения
  notes?: string;
}

export type TxType = 'income' | 'expense' | 'transfer';

export interface BankTransaction {
  id: string;
  plan_id?: string;
  date: string;
  type: TxType;
  amount: number;
  category?: ExpenseCategory | IncomeSource;
  counterparty?: string;
  description?: string;
  account_id?: string;       // ReserveAccount.id (со/на какой счёт)
  reconciled: boolean;       // сверено с банком
  bank_ref?: string;         // номер операции в банке
  proposal_id?: string;      // если связано с заявкой
  created_at: string;
}

export interface SolvencySnapshot {
  id: string;
  date: string;
  cash_on_hand: number;        // деньги в наличии
  accounts_receivable: number; // дебиторская
  accounts_payable: number;    // кредиторская
  reserves_total: number;      // суммарные резервы
  solvency_ratio: number;      // Резервы / Счета к оплате
  notes?: string;
}

// Состояние недельного плана по формуле "Резервы / Счета к оплате"
export type FinancialCondition = 'crisis' | 'danger' | 'emergency' | 'normal' | 'affluence' | 'power';

