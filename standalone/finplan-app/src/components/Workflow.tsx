import React from 'react';
import { Calendar, AlertTriangle, ChevronRight } from 'lucide-react';
import { WeeklyPlan, PlanStatus } from '../types';
import { FIN_WORKFLOW, PLAN_STATUS_LABELS } from '../constants';
import { Pill } from './ui';

interface Props {
  plan: WeeklyPlan;
  onAdvance: (s: PlanStatus) => void;
}

export const Workflow: React.FC<Props> = ({ plan, onAdvance }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Calendar className="text-blue-600" size={20}/> Регламент финансового планирования
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          Адаптировано из методологии финпланирования: ответственность за финплан несёт исполнительный комитет,
          действующий на основании рекомендаций бюджетного комитета, который получает заявки от руководителей отделов.
        </p>
        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {FIN_WORKFLOW.map((step, i) => {
            const isCurrent = plan.status === step.phase;
            const st = PLAN_STATUS_LABELS[step.phase];
            return (
              <div key={i} className="relative">
                <div className={`absolute -left-[22px] w-4 h-4 rounded-full border-2 ${isCurrent ? 'animate-pulse' : ''}`} style={{ borderColor: st.color, backgroundColor: isCurrent ? st.color : 'white' }}/>
                <div className={`border rounded-xl p-4 ${isCurrent ? 'border-blue-300 bg-blue-50/50 shadow-sm' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{step.day}</span>
                      <h3 className="font-bold text-slate-800">{step.title}</h3>
                    </div>
                    <Pill label={st.label} color={st.color} bg={st.bg}/>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{step.description}</p>
                  <p className="text-[11px] text-slate-400"><strong>Ответственные:</strong> {step.role}</p>
                  {isCurrent && i < FIN_WORKFLOW.length - 1 && (
                    <button onClick={() => onAdvance(FIN_WORKFLOW[i + 1].phase)} className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5">
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
              <li>• Финансовое планирование — способ обращения с деньгами и активами компании ради превышения дохода над расходами.</li>
              <li>• Платёжеспособность = зарабатывает ли компания больше, чем тратит.</li>
              <li>• Никогда не управляйте делами по одной точке статистики — смотрите тренд.</li>
              <li>• Резервы наполняются ДО операционных трат.</li>
              <li>• Каждый расход требует обоснования и привязки к ценному конечному продукту.</li>
              <li>• Утверждённые заявки исполняются строго; неутверждённые — не оплачиваются.</li>
              <li>• Чем меньше доход — тем тщательнее планирование.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
