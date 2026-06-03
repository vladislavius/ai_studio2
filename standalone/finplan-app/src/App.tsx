import React, { useEffect, useState } from 'react';
import { BarChart3, Calendar, PiggyBank, FileText, History, Target, Wallet, RotateCcw } from 'lucide-react';
import { loadStore, saveStore, resetStore, StoreShape } from './storage';
import { Dashboard } from './components/Dashboard';
import { WeeklyPlanView } from './components/WeeklyPlanView';
import { FP1View } from './components/FP1';
import { Reserves } from './components/Reserves';
import { Workflow } from './components/Workflow';
import { Archive } from './components/Archive';
import { ApprovalStage, PlanStatus, WeeklyPlan } from './types';
import { APPROVAL_PIPELINE } from './constants';

type Tab = 'dashboard' | 'plan' | 'fp1' | 'reserves' | 'workflow' | 'archive';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Дашборд',           icon: <BarChart3 size={16}/> },
  { id: 'plan',      label: 'Недельный план',    icon: <Calendar size={16}/> },
  { id: 'fp1',       label: 'ФП №1',             icon: <Target size={16}/> },
  { id: 'reserves',  label: 'Резервы',           icon: <PiggyBank size={16}/> },
  { id: 'workflow',  label: 'Регламент',         icon: <FileText size={16}/> },
  { id: 'archive',   label: 'Архив',             icon: <History size={16}/> },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [store, setStore] = useState<StoreShape>(() => loadStore());

  useEffect(() => { saveStore(store); }, [store]);

  const currentPlan = store.plans.find(p => p.id === store.current_plan_id) || store.plans[0];
  const archivePlans = store.plans.filter(p => p.id !== currentPlan?.id);
  const planForecasts = store.forecasts.filter(f => f.plan_id === currentPlan?.id);
  const planProposals = store.proposals.filter(p => p.plan_id === currentPlan?.id);

  const updPlan = (p: WeeklyPlan) => setStore(s => ({ ...s, plans: s.plans.map(x => x.id === p.id ? p : x) }));

  const advanceApproval = () => {
    if (!currentPlan) return;
    const order: ApprovalStage[] = ['dept_requests', 'budget_review', 'exec_decision', 'fin_allocation', 'done'];
    const idx = order.indexOf(currentPlan.approval_stage);
    const next = idx < order.length - 1 ? order[idx + 1] : 'done';
    updPlan({ ...currentPlan, approval_stage: next, updated_at: new Date().toISOString() });
  };

  const handleReset = () => {
    if (confirm('Сбросить все данные и вернуть демо?')) setStore(resetStore());
  };

  if (!currentPlan) return <div className="p-8">Загрузка...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-md">
              <Wallet size={20}/>
            </div>
            <div>
              <h1 className="font-black text-slate-800 text-base">Финпланирование</h1>
              <p className="text-[10px] text-slate-400">Туристическая компания · еженедельный цикл</p>
            </div>
          </div>
          <button onClick={handleReset} className="text-xs font-bold text-slate-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50">
            <RotateCcw size={12}/> Сбросить демо
          </button>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 pb-2 flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 md:px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${tab === t.id ? 'bg-slate-800 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>
              {t.icon}<span>{t.label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-16">
        {tab === 'dashboard' && (
          <Dashboard
            plan={currentPlan}
            forecasts={planForecasts}
            proposals={planProposals}
            reserves={store.reserves}
            fp1={store.fp1}
            svdHistory={store.svd_history}
            onSwitchTab={(t) => setTab(t as Tab)}
          />
        )}
        {tab === 'plan' && (
          <WeeklyPlanView
            plan={currentPlan}
            forecasts={planForecasts}
            proposals={planProposals}
            onUpdatePlan={updPlan}
            onUpdateForecasts={(fs) => setStore(s => ({ ...s, forecasts: [...s.forecasts.filter(f => f.plan_id !== currentPlan.id), ...fs] }))}
            onUpdateProposals={(ps) => setStore(s => ({ ...s, proposals: [...s.proposals.filter(p => p.plan_id !== currentPlan.id), ...ps] }))}
          />
        )}
        {tab === 'fp1' && (
          <FP1View
            fp1={store.fp1}
            svdHistory={store.svd_history}
            docs={store.docs}
            plan={currentPlan}
            forecasts={planForecasts}
            onUpdateFp1={(items) => setStore(s => ({ ...s, fp1: items }))}
            onUpdateDocs={(docs) => setStore(s => ({ ...s, docs }))}
            onAdvanceStage={advanceApproval}
          />
        )}
        {tab === 'reserves' && (
          <Reserves reserves={store.reserves} onUpdate={(rs) => setStore(s => ({ ...s, reserves: rs }))} />
        )}
        {tab === 'workflow' && (
          <Workflow plan={currentPlan} onAdvance={(st: PlanStatus) => updPlan({ ...currentPlan, status: st, updated_at: new Date().toISOString() })} />
        )}
        {tab === 'archive' && (
          <Archive plans={archivePlans} svdHistory={store.svd_history} />
        )}
      </main>
    </div>
  );
}
