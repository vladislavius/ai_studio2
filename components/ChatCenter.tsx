import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Send, Plus, Search, Check, X, MessageSquare, Palmtree, CalendarDays, Plane,
  Wallet, Lightbulb, ShoppingCart, FileText, ChevronLeft, Filter, Paperclip,
  CheckCircle2, XCircle, Clock, AlertCircle, ArrowLeft
} from 'lucide-react';
import { Employee, ChatRoom, ChatMessage, ZrsRequest, ZrsType, ZrsStatus } from '../types';

// ---------- ZRS type catalogue ----------

const ZRS_TYPES: { key: ZrsType; label: string; icon: React.ComponentType<any>; tone: string }[] = [
  { key: 'vacation',   label: 'Отпуск',      icon: Palmtree,     tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'dayoff',     label: 'Выходной',    icon: CalendarDays, tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  { key: 'absence',    label: 'Отсутствие',  icon: Plane,        tone: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'advance',    label: 'Аванс',       icon: Wallet,       tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'initiative', label: 'Инициатива',  icon: Lightbulb,    tone: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
  { key: 'purchase',   label: 'Закупка',     icon: ShoppingCart, tone: 'bg-orange-50 text-orange-700 border-orange-200' },
  { key: 'other',      label: 'Прочее',      icon: FileText,     tone: 'bg-slate-50 text-slate-700 border-slate-200' },
];

const ZRS_TYPE_MAP = Object.fromEntries(ZRS_TYPES.map(t => [t.key, t]));

const STATUS_META: Record<ZrsStatus, { label: string; tone: string; icon: React.ComponentType<any> }> = {
  draft:     { label: 'Черновик',     tone: 'bg-slate-100 text-slate-600 border-slate-200',     icon: FileText },
  sent:      { label: 'Отправлено',   tone: 'bg-blue-50 text-blue-700 border-blue-200',         icon: Clock },
  in_review: { label: 'На рассмотрении', tone: 'bg-blue-50 text-blue-700 border-blue-200',      icon: Clock },
  need_info: { label: 'Нужны уточнения', tone: 'bg-amber-50 text-amber-700 border-amber-200',   icon: AlertCircle },
  approved:  { label: 'Одобрено',     tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rejected:  { label: 'Отклонено',    tone: 'bg-rose-50 text-rose-700 border-rose-200',         icon: XCircle },
  cancelled: { label: 'Отменено',     tone: 'bg-slate-100 text-slate-500 border-slate-200',     icon: XCircle },
};

const PLACEHOLDERS: Record<ZrsType, { situation: string; data: string; solution: string }> = {
  vacation:   { situation: 'Опиши когда и почему хочешь отпуск. Пример: «Прошу отпуск с 10.10 по 20.10 по личным обстоятельствам»', data: 'Что закроешь до отпуска, кому передашь дела, как с тобой связаться в emergency.', solution: 'Предлагаю утвердить отпуск с DD.MM по DD.MM с учётом указанных мер передачи дел' },
  dayoff:     { situation: 'Когда и почему нужен выходной. Пример: «Прошу выходной 12.10 — семейные обстоятельства»', data: 'Что закроешь, кому передашь дела.', solution: 'Предлагаю утвердить выходной DD.MM с отработкой / без' },
  absence:    { situation: 'Опиши когда и почему будешь отсутствовать.', data: 'Кому передаются задачи, контакт для срочной связи.', solution: 'Предлагаю согласовать отсутствие с DD.MM по DD.MM' },
  advance:    { situation: 'Опиши причину запроса аванса.', data: 'Сумма, дата возврата / удержания.', solution: 'Предлагаю выдать аванс в размере N руб. с удержанием из ЗП за MM.YYYY' },
  initiative: { situation: 'Опиши проблему / возможность.', data: 'Что нужно для реализации, риски.', solution: 'Предлагаю сделать X для получения Y. Ресурсы: ...' },
  purchase:   { situation: 'Что нужно купить и зачем.', data: 'Где, сколько стоит, ссылки.', solution: 'Предлагаю одобрить закупку на сумму N руб.' },
  other:      { situation: 'Опиши ситуацию.', data: 'Дополнительные данные.', solution: 'Предлагаю...' },
};

// ---------- helpers ----------

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const initials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

const Avatar: React.FC<{ name?: string; photo?: string; size?: number }> = ({ name = '?', photo, size = 36 }) => {
  if (photo) return <img src={photo} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover flex-shrink-0" />;
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, hsl(${(name.charCodeAt(0) * 13) % 360} 70% 55%), hsl(${(name.charCodeAt(1) * 17) % 360} 70% 45%))`,
        fontSize: size * 0.4
      }}
    >{initials(name)}</div>
  );
};

// ---------- demo seed ----------

interface ChatCenterProps {
  employees: Employee[];
  currentUserEmail?: string;
}

const ChatCenter: React.FC<ChatCenterProps> = ({ employees, currentUserEmail }) => {
  // Pick "current user" — first employee or stub
  const me: Employee = useMemo(() => {
    if (employees.length > 0) return employees[0];
    return {
      id: 'me', full_name: 'Алёна Сидорова', position: 'Руководитель персонала',
      created_at: '', updated_at: '', emergency_contacts: [], custom_fields: [], attachments: [],
    } as Employee;
  }, [employees]);

  const manager: Employee = useMemo(() => {
    if (employees.length > 1) return employees[1];
    return {
      id: 'mgr', full_name: 'Максим Куртов', position: 'Владелец',
      photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
      created_at: '', updated_at: '', emergency_contacts: [], custom_fields: [], attachments: [],
    } as Employee;
  }, [employees]);

  const others: Employee[] = useMemo(() => {
    const pool = employees.slice(2, 6);
    if (pool.length >= 2) return pool;
    return [
      { id: 'hr',  full_name: 'Ирина Власова', position: 'HR', created_at: '', updated_at: '', emergency_contacts: [], custom_fields: [], attachments: [] } as Employee,
      { id: 'fin', full_name: 'Сергей Финн',   position: 'Финдир', created_at: '', updated_at: '', emergency_contacts: [], custom_fields: [], attachments: [] } as Employee,
    ];
  }, [employees]);

  const allPeople = useMemo(() => [me, manager, ...others], [me, manager, others]);
  const peopleById = useMemo(() => Object.fromEntries(allPeople.map(p => [p.id, p])), [allPeople]);

  // Seed: a DM with manager containing an existing ZRS thread
  const initialZrs: ZrsRequest = {
    id: 'zrs-1', type: 'vacation', status: 'in_review',
    author_id: me.id, recipient_id: manager.id,
    situation: 'Прошу отпуск с 10.10 по 20.10 по личным обстоятельствам — семейная поездка, билеты куплены.',
    data: 'До отпуска закрою найм 2 человек в dept1, передам ведение онбординга Ирине, на срочное — telegram @alyona.',
    solution: 'Предлагаю утвердить отпуск с 10.10 по 20.10. Возврат к работе 21.10.',
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  };

  const [zrsMap, setZrsMap] = useState<Record<string, ZrsRequest>>({ [initialZrs.id]: initialZrs });
  const [rooms, setRooms] = useState<ChatRoom[]>([
    { id: 'room-1', kind: 'dm', participant_ids: [me.id, manager.id] },
    { id: 'room-2', kind: 'dm', participant_ids: [me.id, others[0].id] },
  ]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'm0', room_id: 'room-1', author_id: me.id, kind: 'text', body: 'Привет! Хочу согласовать отпуск.', created_at: new Date(Date.now() - 1000 * 60 * 40).toISOString() },
    { id: 'm1', room_id: 'room-1', author_id: me.id, kind: 'zrs', zrs_id: 'zrs-1', created_at: initialZrs.created_at },
    { id: 'm2', room_id: 'room-1', author_id: manager.id, kind: 'text', body: 'Принял, посмотрю и вернусь до конца дня.', created_at: new Date(Date.now() - 1000 * 60 * 28).toISOString() },
    { id: 'm3', room_id: 'room-2', author_id: others[0].id, kind: 'text', body: 'Передай, пожалуйста, доступ к шаблонам онбординга.', created_at: new Date(Date.now() - 1000 * 60 * 200).toISOString() },
  ]);

  const [activeRoomId, setActiveRoomId] = useState<string>('room-1');
  const [filter, setFilter] = useState<'all' | 'zrs' | 'unread'>('all');
  const [composer, setComposer] = useState('');
  const [zrsModal, setZrsModal] = useState<{ stage: 'closed' | 'pick-type' | 'form'; type?: ZrsType }>({ stage: 'closed' });
  const [decisionModal, setDecisionModal] = useState<{ zrsId: string; action: 'approve' | 'reject' | 'need_info' } | null>(null);

  const activeRoom = rooms.find(r => r.id === activeRoomId)!;
  const counterpart = (room: ChatRoom) => peopleById[room.participant_ids.find(id => id !== me.id)!];

  const roomMessages = useMemo(
    () => messages.filter(m => m.room_id === activeRoomId).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages, activeRoomId]
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [roomMessages.length, activeRoomId]);

  const filteredRooms = useMemo(() => {
    if (filter === 'zrs') return rooms.filter(r => messages.some(m => m.room_id === r.id && m.kind === 'zrs'));
    return rooms;
  }, [rooms, messages, filter]);

  // simulate "current user" being employee Алёна. To preview manager actions, toggle:
  const [viewAs, setViewAs] = useState<'employee' | 'manager'>('employee');
  const effectiveMeId = viewAs === 'employee' ? me.id : manager.id;

  // ---------- actions ----------
  const sendText = () => {
    if (!composer.trim()) return;
    setMessages(prev => [...prev, {
      id: `m-${Date.now()}`, room_id: activeRoomId, author_id: effectiveMeId, kind: 'text',
      body: composer.trim(), created_at: new Date().toISOString(),
    }]);
    setComposer('');
  };

  const submitZrs = (data: { type: ZrsType; situation: string; dataText: string; solution: string }) => {
    const id = `zrs-${Date.now()}`;
    const zrs: ZrsRequest = {
      id, type: data.type, status: 'sent',
      author_id: me.id, recipient_id: counterpart(activeRoom).id,
      situation: data.situation, data: data.dataText, solution: data.solution,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setZrsMap(prev => ({ ...prev, [id]: zrs }));
    setMessages(prev => [...prev,
      { id: `m-${Date.now()}`, room_id: activeRoomId, author_id: me.id, kind: 'zrs', zrs_id: id, created_at: zrs.created_at },
    ]);
    setZrsModal({ stage: 'closed' });
  };

  const applyDecision = (zrsId: string, action: 'approve' | 'reject' | 'need_info', comment?: string) => {
    const newStatus: ZrsStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'need_info';
    setZrsMap(prev => ({ ...prev, [zrsId]: { ...prev[zrsId], status: newStatus, decision_comment: comment, updated_at: new Date().toISOString() } }));
    const sys = action === 'approve' ? `✅ ${peopleById[effectiveMeId].full_name} одобрил(а) ЗРС`
              : action === 'reject'  ? `❌ ${peopleById[effectiveMeId].full_name} отклонил(а) ЗРС`
              :                         `💬 ${peopleById[effectiveMeId].full_name} запросил(а) уточнения`;
    setMessages(prev => [...prev, {
      id: `m-${Date.now()}`, room_id: activeRoomId, author_id: '', kind: 'system',
      body: comment ? `${sys}: «${comment}»` : sys, created_at: new Date().toISOString(),
    }]);
    setDecisionModal(null);
  };

  // ---------- render ----------
  return (
    <div className="flex h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Left: rooms list */}
      <aside className="w-80 border-r border-slate-200 flex flex-col bg-slate-50/40">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Чат</h2>
            <p className="text-xs text-slate-400">Комм-центр</p>
          </div>
          <button
            onClick={() => setZrsModal({ stage: 'pick-type' })}
            className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700 flex items-center gap-1.5"
            title="Новый ЗРС"
          >
            <Plus size={14}/> ЗРС
          </button>
        </div>

        <div className="px-3 pt-3 pb-2 flex gap-1">
          {(['all', 'zrs', 'unread'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${filter === f ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-200/60'}`}>
              {f === 'all' ? 'Все' : f === 'zrs' ? 'ЗРС' : 'Непрочитанные'}
            </button>
          ))}
        </div>

        <div className="px-3 pb-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Поиск" className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-slate-200 text-sm outline-none focus:border-blue-400" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredRooms.map(room => {
            const cp = counterpart(room);
            const lastMsg = [...messages].reverse().find(m => m.room_id === room.id);
            const lastZrs = lastMsg?.kind === 'zrs' && lastMsg.zrs_id ? zrsMap[lastMsg.zrs_id] : null;
            const isActive = activeRoomId === room.id;
            return (
              <button key={room.id} onClick={() => setActiveRoomId(room.id)}
                className={`w-full px-3 py-3 flex gap-3 items-center transition border-l-2 ${isActive ? 'bg-blue-50 border-blue-500' : 'border-transparent hover:bg-slate-100'}`}>
                <Avatar name={cp.full_name} photo={cp.photo_url} />
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 truncate text-sm">{cp.full_name}</span>
                    {lastMsg && <span className="text-[10px] text-slate-400">{fmtTime(lastMsg.created_at)}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                    {lastZrs && (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${STATUS_META[lastZrs.status].tone}`}>
                        ЗРС
                      </span>
                    )}
                    <span className="truncate">
                      {lastMsg?.kind === 'zrs' && lastZrs ? `${ZRS_TYPE_MAP[lastZrs.type].label}: ${lastZrs.situation}` :
                       lastMsg?.kind === 'system' ? lastMsg.body :
                       lastMsg?.body || 'нет сообщений'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* View-as toggle for prototype */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Прототип · смотреть как</p>
          <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button onClick={() => setViewAs('employee')} className={`flex-1 py-1.5 rounded ${viewAs === 'employee' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Сотрудник</button>
            <button onClick={() => setViewAs('manager')} className={`flex-1 py-1.5 rounded ${viewAs === 'manager' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Руководитель</button>
          </div>
        </div>
      </aside>

      {/* Right: thread */}
      <section className="flex-1 flex flex-col min-w-0">
        <header className="p-4 border-b border-slate-200 flex items-center gap-3 bg-white">
          <Avatar name={counterpart(activeRoom).full_name} photo={counterpart(activeRoom).photo_url} />
          <div className="flex-1">
            <h3 className="font-bold text-slate-800">{counterpart(activeRoom).full_name}</h3>
            <p className="text-xs text-slate-400">{counterpart(activeRoom).position} · в сети</p>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3 bg-gradient-to-b from-slate-50/50 to-white">
          {roomMessages.map(m => {
            if (m.kind === 'system') {
              return (
                <div key={m.id} className="flex justify-center">
                  <div className="text-[11px] text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">{m.body}</div>
                </div>
              );
            }
            const isMine = m.author_id === effectiveMeId;
            const author = peopleById[m.author_id];
            if (m.kind === 'zrs' && m.zrs_id) {
              const z = zrsMap[m.zrs_id];
              return <ZrsCardView key={m.id} zrs={z} isMine={isMine} viewAs={viewAs}
                                  onAction={(action) => setDecisionModal({ zrsId: z.id, action })} />;
            }
            return (
              <div key={m.id} className={`flex gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                {!isMine && <Avatar name={author?.full_name || '?'} photo={author?.photo_url} size={28} />}
                <div className={`max-w-[70%] px-4 py-2 rounded-2xl ${isMine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'}`}>
                  <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-blue-100' : 'text-slate-400'}`}>{fmtTime(m.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <footer className="p-3 border-t border-slate-200 bg-white">
          <div className="flex items-end gap-2 bg-slate-50 rounded-2xl p-2 border border-slate-200 focus-within:border-blue-400 transition">
            <button onClick={() => setZrsModal({ stage: 'pick-type' })}
              className="p-2.5 rounded-xl text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition flex-shrink-0"
              title="Отправить ЗРС">
              <Plus size={18}/>
            </button>
            <button className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-200 flex-shrink-0" title="Прикрепить">
              <Paperclip size={18}/>
            </button>
            <textarea
              value={composer}
              onChange={e => setComposer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
              placeholder="Сообщение..."
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none py-2 text-sm max-h-32"
            />
            <button onClick={sendText} disabled={!composer.trim()}
              className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition flex-shrink-0">
              <Send size={18}/>
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 text-center">
            <span className="font-semibold">Enter</span> — отправить · <span className="font-semibold">Shift+Enter</span> — новая строка · <span className="font-semibold">+</span> — отправить ЗРС
          </p>
        </footer>
      </section>

      {/* ZRS modals */}
      {zrsModal.stage === 'pick-type' && (
        <ZrsTypePicker
          onPick={(t) => setZrsModal({ stage: 'form', type: t })}
          onClose={() => setZrsModal({ stage: 'closed' })}
          recipient={counterpart(activeRoom)}
        />
      )}
      {zrsModal.stage === 'form' && zrsModal.type && (
        <ZrsForm
          type={zrsModal.type}
          recipient={counterpart(activeRoom)}
          onSubmit={submitZrs}
          onBack={() => setZrsModal({ stage: 'pick-type' })}
          onClose={() => setZrsModal({ stage: 'closed' })}
          onChangeType={(t) => setZrsModal({ stage: 'form', type: t })}
        />
      )}
      {decisionModal && (
        <DecisionModal
          action={decisionModal.action}
          zrs={zrsMap[decisionModal.zrsId]}
          onSubmit={(comment) => applyDecision(decisionModal.zrsId, decisionModal.action, comment)}
          onClose={() => setDecisionModal(null)}
        />
      )}
    </div>
  );
};

// ---------- ZRS card embedded in chat ----------

const ZrsCardView: React.FC<{
  zrs: ZrsRequest;
  isMine: boolean;
  viewAs: 'employee' | 'manager';
  onAction: (action: 'approve' | 'reject' | 'need_info') => void;
}> = ({ zrs, isMine, viewAs, onAction }) => {
  const t = ZRS_TYPE_MAP[zrs.type];
  const s = STATUS_META[zrs.status];
  const TypeIcon = t.icon;
  const StatusIcon = s.icon;
  const canDecide = viewAs === 'manager' && (zrs.status === 'sent' || zrs.status === 'in_review' || zrs.status === 'need_info');

  const borderColor =
    zrs.status === 'approved'  ? 'border-emerald-300' :
    zrs.status === 'rejected'  ? 'border-rose-300' :
    zrs.status === 'need_info' ? 'border-amber-300' :
                                  'border-blue-300';

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`w-full max-w-md rounded-2xl border-2 ${borderColor} bg-white shadow-md overflow-hidden`}>
        <div className={`px-4 py-2.5 flex items-center gap-2 border-b ${t.tone}`}>
          <TypeIcon size={16}/>
          <span className="font-bold text-xs uppercase tracking-wide">ЗРС · {t.label}</span>
          <span className="ml-auto text-[10px] font-mono opacity-70">#{zrs.id.slice(-5)}</span>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ситуация</p>
            <p className="text-sm text-slate-800">{zrs.situation}</p>
          </div>
          {zrs.data && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Данные</p>
              <p className="text-sm text-slate-700">{zrs.data}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Решение</p>
            <p className="text-sm text-slate-800 font-medium">{zrs.solution}</p>
          </div>
          {zrs.decision_comment && (
            <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Комментарий решения</p>
              <p className="text-sm text-slate-700 italic">«{zrs.decision_comment}»</p>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${s.tone}`}>
              <StatusIcon size={12}/> {s.label}
            </span>
            <span className="text-[10px] text-slate-400">{fmtTime(zrs.created_at)}</span>
          </div>
        </div>
        {canDecide && (
          <div className="grid grid-cols-3 border-t border-slate-200 divide-x divide-slate-200">
            <button onClick={() => onAction('approve')} className="py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center justify-center gap-1.5">
              <Check size={14}/> Одобрить
            </button>
            <button onClick={() => onAction('need_info')} className="py-2.5 text-xs font-bold text-amber-700 hover:bg-amber-50 flex items-center justify-center gap-1.5">
              <AlertCircle size={14}/> Уточнить
            </button>
            <button onClick={() => onAction('reject')} className="py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center justify-center gap-1.5">
              <X size={14}/> Отклонить
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- ZRS Type picker ----------

const ZrsTypePicker: React.FC<{ onPick: (t: ZrsType) => void; onClose: () => void; recipient: Employee }> = ({ onPick, onClose, recipient }) => (
  <Modal onClose={onClose} title="Новый ЗРС" subtitle={`Получатель: ${recipient.full_name}`}>
    <p className="text-sm text-slate-500 mb-4">Выберите тип:</p>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {ZRS_TYPES.map(t => {
        const Icon = t.icon;
        return (
          <button key={t.key} onClick={() => onPick(t.key)}
            className={`p-4 rounded-xl border-2 ${t.tone} hover:scale-[1.02] transition text-left`}>
            <Icon size={22} className="mb-2"/>
            <p className="font-bold text-sm">{t.label}</p>
          </button>
        );
      })}
    </div>
  </Modal>
);

// ---------- ZRS Form ----------

const ZrsForm: React.FC<{
  type: ZrsType;
  recipient: Employee;
  onSubmit: (data: { type: ZrsType; situation: string; dataText: string; solution: string }) => void;
  onBack: () => void;
  onClose: () => void;
  onChangeType: (t: ZrsType) => void;
}> = ({ type, recipient, onSubmit, onBack, onClose }) => {
  const t = ZRS_TYPE_MAP[type];
  const ph = PLACEHOLDERS[type];
  const [situation, setSituation] = useState('');
  const [dataText, setDataText] = useState('');
  const [solution, setSolution] = useState('');
  const TypeIcon = t.icon;

  const canSend = situation.trim().length > 0 && solution.trim().length > 0;

  return (
    <Modal onClose={onClose} title="Новый ЗРС" subtitle={`Получатель: ${recipient.full_name} · ${recipient.position}`}>
      <div className={`p-3 rounded-xl border-2 ${t.tone} flex items-center gap-3 mb-5`}>
        <TypeIcon size={20}/>
        <span className="font-bold">{t.label}</span>
        <button onClick={onBack} className="ml-auto text-xs font-bold opacity-70 hover:opacity-100">Сменить тип</button>
      </div>

      <div className="space-y-4">
        <Field label="Ситуация" required>
          <textarea value={situation} onChange={e => setSituation(e.target.value)} placeholder={ph.situation}
            rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 text-sm resize-none"/>
        </Field>
        <Field label="Данные">
          <textarea value={dataText} onChange={e => setDataText(e.target.value)} placeholder={ph.data}
            rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 text-sm resize-none"/>
        </Field>
        <Field label="Решение" required>
          <textarea value={solution} onChange={e => setSolution(e.target.value)} placeholder={ph.solution}
            rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 text-sm resize-none"/>
        </Field>

        <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 border border-slate-200">
          <Avatar name={recipient.full_name} photo={recipient.photo_url} size={36}/>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-800">{recipient.full_name}</p>
            <p className="text-xs text-slate-500">{recipient.position}</p>
          </div>
          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded">по оргсхеме</span>
        </div>
        <p className="text-[11px] text-slate-400">
          ЗРС будет отправлено в текущий диалог как карточка. Адресат получит уведомление и сможет одобрить, отклонить или запросить уточнения прямо из чата.
        </p>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50">
          Назад
        </button>
        <button onClick={() => onSubmit({ type, situation, dataText, solution })} disabled={!canSend}
          className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2">
          <Send size={16}/> Отправить и открыть в чате
        </button>
      </div>
    </Modal>
  );
};

// ---------- Decision modal ----------

const DecisionModal: React.FC<{
  action: 'approve' | 'reject' | 'need_info';
  zrs: ZrsRequest;
  onSubmit: (comment?: string) => void;
  onClose: () => void;
}> = ({ action, zrs, onSubmit, onClose }) => {
  const [comment, setComment] = useState('');
  const titles = {
    approve:   { title: 'Одобрить ЗРС', cta: 'Одобрить', tone: 'bg-emerald-600 hover:bg-emerald-700', placeholder: 'Комментарий (необязательно). Например: «согласовано, передай дела Ирине»' },
    reject:    { title: 'Отклонить ЗРС', cta: 'Отклонить', tone: 'bg-rose-600 hover:bg-rose-700', placeholder: 'Причина отказа' },
    need_info: { title: 'Запросить уточнения', cta: 'Запросить', tone: 'bg-amber-600 hover:bg-amber-700', placeholder: 'Что нужно уточнить' },
  }[action];
  return (
    <Modal onClose={onClose} title={titles.title} subtitle={`${ZRS_TYPE_MAP[zrs.type].label} · ${zrs.situation.slice(0, 60)}...`}>
      <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder={titles.placeholder}
        rows={4} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 text-sm resize-none"/>
      <div className="flex gap-3 mt-4">
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50">
          Отмена
        </button>
        <button onClick={() => onSubmit(comment.trim() || undefined)}
          className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold text-sm ${titles.tone}`}>
          {titles.cta}
        </button>
      </div>
    </Modal>
  );
};

// ---------- shared ----------

const Modal: React.FC<{ onClose: () => void; title: string; subtitle?: string; children: React.ReactNode }> = ({ onClose, title, subtitle, children }) => (
  <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar p-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18}/></button>
      </div>
      {children}
    </div>
  </div>
);

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div>
    <label className="text-xs font-bold text-slate-600 mb-1.5 inline-block">
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
  </div>
);

export default ChatCenter;
