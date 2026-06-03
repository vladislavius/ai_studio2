// ============================================================================
// ФИНАНСОВОЕ ПЛАНИРОВАНИЕ — типы
// ============================================================================

export type PlanStatus = 'draft' | 'collecting' | 'review' | 'approved' | 'executing' | 'closed';

export interface WeeklyPlan {
  id: string;
  week_start: string;
  week_end: string;
  status: PlanStatus;
  income_projected: number;
  income_actual: number;
  expense_projected: number;
  expense_actual: number;
  cash_on_hand_start: number;
  cash_on_hand_end?: number;
  notes?: string;
  approval_stage: ApprovalStage;
  created_at: string;
  updated_at: string;
}

export type IncomeSource = 'group_tours' | 'individual_tours' | 'excursions' | 'transfers' | 'hotel_commission' | 'partners' | 'corporate' | 'other';

export interface IncomeForecast {
  id: string;
  plan_id: string;
  source: IncomeSource;
  description?: string;
  amount_projected: number;
  amount_actual: number;
  confidence: 'high' | 'medium' | 'low';
}

export type ExpensePriority = 'critical' | 'high' | 'normal' | 'low';
export type ExpenseStatus = 'proposed' | 'reviewed' | 'approved' | 'rejected' | 'paid';
export type ExpenseCategory =
  | 'payroll' | 'taxes' | 'rent' | 'utilities' | 'marketing' | 'hotel_prepay'
  | 'transport' | 'guides_fees' | 'insurance' | 'software' | 'office' | 'maintenance'
  | 'training' | 'pr' | 'legal' | 'bank_fees' | 'other';

export interface ExpenseProposal {
  id: string;
  plan_id: string;
  dept_id: string;
  category: ExpenseCategory;
  title: string;
  justification: string;
  amount: number;
  priority: ExpensePriority;
  status: ExpenseStatus;
  proposer: string;
  vendor?: string;
  is_recurring?: boolean;
  rejection_reason?: string;
  payment_date?: string;
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
  target_balance?: number;
  min_balance?: number;
  allocation_percent?: number;
  bank_name?: string;
  is_active: boolean;
}

export type FinancialCondition = 'crisis' | 'danger' | 'emergency' | 'normal' | 'affluence' | 'power';

// === ФП №1 ===
export type FP1SectionKey = 'personnel' | 'basic_needs' | 'promotion' | 'comms' | 'delivery' | 'commodity';

export interface FP1LineItem {
  id: string;
  section: FP1SectionKey;
  title: string;
  weekly_amount: number;
  notes?: string;
  is_percent?: boolean;
  percent_of_svd?: number;
  sort_order: number;
}

export type ApprovalStage = 'dept_requests' | 'budget_review' | 'exec_decision' | 'fin_allocation' | 'done';

export type FP1DocKey =
  | 'bank_summary' | 'payables_summary' | 'receivables_summary' | 'cash_on_hand'
  | 'avg_svd' | 'fp1_current' | 'income_plan' | 'expense_plan';

export interface FP1DocStatus {
  key: FP1DocKey;
  ready: boolean;
  prepared_by?: string;
  prepared_at?: string;
}

export interface Department {
  id: string;
  name: string;
  color: string;
}

export interface SVDHistoryPoint {
  week_start: string;
  gross_income: number;
  adjusted_income: number;
}
