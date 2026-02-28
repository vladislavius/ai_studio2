
import React, { useState, useEffect } from 'react';
import {
  BookOpen, Plus, X, Edit2, Trash2, Check, ChevronDown, ChevronRight,
  Award, AlertTriangle, Users, Search, GraduationCap, FileText,
  Lightbulb, MessageSquare, Layers, ClipboardCheck, ChevronUp, Lock
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Course, ChecksheetItem, ChecksheetItemType, CourseEnrollment, ChecksheetCompletion } from '../types';
import { Employee } from '../types';

// --- Hubbard Study Tech Item Types ---
const ITEM_TYPE_META: Record<ChecksheetItemType, { label: string; color: string; icon: React.ReactNode; hint: string }> = {
  read:       { label: 'Читать',      color: 'bg-blue-100 text-blue-700',    icon: <BookOpen size={12}/>,      hint: 'Изучите указанный материал' },
  word_clear: { label: 'МС (Слова)',  color: 'bg-amber-100 text-amber-700',  icon: <MessageSquare size={12}/>, hint: 'Прояснение слов — устраните непонятые слова прежде чем идти дальше' },
  demo:       { label: 'Демо',        color: 'bg-emerald-100 text-emerald-700', icon: <Lightbulb size={12}/>, hint: 'Покажите понимание с помощью предметов' },
  clay_demo:  { label: 'Глин. демо', color: 'bg-orange-100 text-orange-700', icon: <Layers size={12}/>,       hint: 'Создайте демонстрацию из пластилина' },
  drill:      { label: 'Упражнение', color: 'bg-purple-100 text-purple-700', icon: <ClipboardCheck size={12}/>,hint: 'Практическое упражнение до уверенного выполнения' },
  essay:      { label: 'Сочинение',  color: 'bg-pink-100 text-pink-700',    icon: <FileText size={12}/>,      hint: 'Напишите эссе по теме' },
  exam:       { label: 'Зачёт',      color: 'bg-red-100 text-red-700',       icon: <Award size={12}/>,         hint: 'Сдайте зачёт супервайзеру' },
};

// Three Barriers to Study (Hubbard)
const BARRIERS_INFO = [
  { title: 'Отсутствие массы', color: 'text-orange-600 bg-orange-50', icon: '🧱', desc: 'Если тема кажется «туманной» или вызывает усталость — нужно демо или глиняное демо.' },
  { title: 'Слишком крутой градиент', color: 'text-red-600 bg-red-50', icon: '📈', desc: 'Если материал кажется непосильным — вернитесь на шаг назад и убедитесь, что предыдущая ступень освоена.' },
  { title: 'Непонятое слово', color: 'text-amber-600 bg-amber-50', icon: '🔤', desc: 'Если вы чувствуете пустоту, желание уйти или невозможность сосредоточиться — найдите и прояните непонятое слово.' },
];

interface CoursesTabProps {
  employees: Employee[];
  isAdmin: boolean;
  currentUserId?: string;
}

const CoursesTab: React.FC<CoursesTabProps> = ({ employees, isAdmin, currentUserId }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [checksheet, setChecksheet] = useState<ChecksheetItem[]>([]);
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [completions, setCompletions] = useState<ChecksheetCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Admin: editing states
  const [editingCourse, setEditingCourse] = useState<Partial<Course> | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<ChecksheetItem> | null>(null);
  const [showBarriers, setShowBarriers] = useState(false);

  // Student: selected enrollment
  const [myEnrollment, setMyEnrollment] = useState<CourseEnrollment | null>(null);

  useEffect(() => { fetchCourses(); }, []);
  useEffect(() => {
    if (selectedCourse) {
      fetchChecksheet(selectedCourse.id);
      fetchEnrollments(selectedCourse.id);
    }
  }, [selectedCourse]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      if (!supabase) return;
      const { data, error } = await supabase.from('courses').select('*').order('title');
      if (error) console.error('[CoursesTab] fetchCourses error:', error.message);
      else if (data) setCourses(data);
    } catch (err) {
      console.error('[CoursesTab] fetchCourses crash:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChecksheet = async (courseId: string) => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('checksheet_items')
        .select('*')
        .eq('course_id', courseId)
        .order('order_num');
      if (error) console.error('[CoursesTab] fetchChecksheet error:', error.message);
      else if (data) setChecksheet(data);
    } catch (err) {
      console.error('[CoursesTab] fetchChecksheet crash:', err);
    }
  };

  const fetchEnrollments = async (courseId: string) => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('course_id', courseId);
      if (error) console.error('[CoursesTab] fetchEnrollments error:', error.message);
      else if (data) {
        setEnrollments(data);
        const mine = data.find(e => e.employee_id === currentUserId);
        setMyEnrollment(mine || null);
        if (mine) fetchCompletions(mine.id);
      }
    } catch (err) {
      console.error('[CoursesTab] fetchEnrollments crash:', err);
    }
  };

  const fetchCompletions = async (enrollmentId: string) => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('checksheet_completions')
        .select('*')
        .eq('enrollment_id', enrollmentId);
      if (error) console.error('[CoursesTab] fetchCompletions error:', error.message);
      else if (data) setCompletions(data);
    } catch (err) {
      console.error('[CoursesTab] fetchCompletions crash:', err);
    }
  };

  // --- COURSE CRUD (Admin) ---
  const handleSaveCourse = async () => {
    if (!editingCourse || !supabase) return;
    if (!editingCourse.title) { alert('Название курса обязательно'); return; }
    try {
      const payload = { ...editingCourse, is_active: editingCourse.is_active ?? true };
      const { error } = editingCourse.id
        ? await supabase.from('courses').update(payload).eq('id', editingCourse.id)
        : await supabase.from('courses').insert([payload]);
      if (error) { console.error('[CoursesTab] handleSaveCourse error:', error.message); return; }
      setEditingCourse(null);
      fetchCourses();
    } catch (err) {
      console.error('[CoursesTab] handleSaveCourse crash:', err);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!confirm('Удалить курс и все его контрольные листы?')) return;
    if (!supabase) return;
    try {
      await supabase.from('checksheet_items').delete().eq('course_id', id);
      await supabase.from('course_enrollments').delete().eq('course_id', id);
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) { console.error('[CoursesTab] handleDeleteCourse error:', error.message); return; }
      if (selectedCourse?.id === id) setSelectedCourse(null);
      fetchCourses();
    } catch (err) {
      console.error('[CoursesTab] handleDeleteCourse crash:', err);
    }
  };

  // --- CHECKSHEET ITEM CRUD (Admin) ---
  const handleSaveItem = async () => {
    if (!editingItem || !selectedCourse || !supabase) return;
    if (!editingItem.content || !editingItem.type) { alert('Тип и содержание обязательны'); return; }
    try {
      const payload = {
        ...editingItem,
        course_id: selectedCourse.id,
        order_num: editingItem.order_num ?? checksheet.length + 1,
      };
      const { error } = editingItem.id
        ? await supabase.from('checksheet_items').update(payload).eq('id', editingItem.id)
        : await supabase.from('checksheet_items').insert([payload]);
      if (error) { console.error('[CoursesTab] handleSaveItem error:', error.message); return; }
      setEditingItem(null);
      fetchChecksheet(selectedCourse.id);
    } catch (err) {
      console.error('[CoursesTab] handleSaveItem crash:', err);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Удалить этот шаг контрольного листа?')) return;
    if (!supabase || !selectedCourse) return;
    try {
      const { error } = await supabase.from('checksheet_items').delete().eq('id', id);
      if (error) { console.error('[CoursesTab] handleDeleteItem error:', error.message); return; }
      fetchChecksheet(selectedCourse.id);
    } catch (err) {
      console.error('[CoursesTab] handleDeleteItem crash:', err);
    }
  };

  const handleMoveItem = async (item: ChecksheetItem, direction: 'up' | 'down') => {
    if (!supabase || !selectedCourse) return;
    const idx = checksheet.findIndex(i => i.id === item.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= checksheet.length) return;
    const other = checksheet[swapIdx];
    try {
      await supabase.from('checksheet_items').update({ order_num: other.order_num }).eq('id', item.id);
      await supabase.from('checksheet_items').update({ order_num: item.order_num }).eq('id', other.id);
      fetchChecksheet(selectedCourse.id);
    } catch (err) {
      console.error('[CoursesTab] handleMoveItem crash:', err);
    }
  };

  // --- ENROLLMENT ---
  const handleEnroll = async () => {
    if (!selectedCourse || !currentUserId || !supabase) return;
    try {
      const { data, error } = await supabase.from('course_enrollments').insert([{
        course_id: selectedCourse.id,
        employee_id: currentUserId,
        enrolled_at: new Date().toISOString(),
        status: 'active',
      }]).select().single();
      if (error) { console.error('[CoursesTab] handleEnroll error:', error.message); return; }
      setMyEnrollment(data);
      fetchEnrollments(selectedCourse.id);
    } catch (err) {
      console.error('[CoursesTab] handleEnroll crash:', err);
    }
  };

  // --- CHECKSHEET COMPLETION (Student) ---
  const isItemCompleted = (itemId: string) =>
    completions.some(c => c.item_id === itemId);

  const handleToggleCompletion = async (item: ChecksheetItem) => {
    if (!myEnrollment || !supabase) return;
    const existing = completions.find(c => c.item_id === item.id);
    try {
      if (existing) {
        const { error } = await supabase.from('checksheet_completions').delete().eq('id', existing.id);
        if (error) { console.error('[CoursesTab] toggleCompletion delete error:', error.message); return; }
      } else {
        const { error } = await supabase.from('checksheet_completions').insert([{
          enrollment_id: myEnrollment.id,
          item_id: item.id,
          completed_at: new Date().toISOString(),
        }]);
        if (error) { console.error('[CoursesTab] toggleCompletion insert error:', error.message); return; }
      }
      fetchCompletions(myEnrollment.id);
    } catch (err) {
      console.error('[CoursesTab] handleToggleCompletion crash:', err);
    }
  };

  const getEnrolledCount = (courseId: string) =>
    enrollments.filter(e => e.course_id === courseId).length;

  const completionPercent = checksheet.length > 0
    ? Math.round((completions.length / checksheet.length) * 100)
    : 0;

  const filteredCourses = courses.filter(c =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full animate-in fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 gap-4 px-1">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
            placeholder="Поиск курсов..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowBarriers(!showBarriers)}
          className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-700 font-bold rounded-xl hover:bg-amber-100 transition-all text-sm"
        >
          <AlertTriangle size={16} /> 3 Барьера
        </button>
        {isAdmin && (
          <button
            onClick={() => setEditingCourse({ title: '', is_active: true })}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 hover:-translate-y-0.5 transition-all"
          >
            <Plus size={18} /> Создать курс
          </button>
        )}
      </div>

      {/* Three Barriers Info Panel */}
      {showBarriers && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 animate-in slide-in-from-top-2">
          {BARRIERS_INFO.map(b => (
            <div key={b.title} className={`p-4 rounded-xl border ${b.color} border-current/20`}>
              <div className="text-xl mb-1">{b.icon}</div>
              <div className="font-bold text-sm mb-1">{b.title}</div>
              <div className="text-xs leading-relaxed opacity-80">{b.desc}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-6 flex-1 overflow-hidden">
        {/* Course List */}
        <div className="w-80 flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase">
              <GraduationCap size={14} /> Курсы ({filteredCourses.length})
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">Курсов пока нет</div>
            ) : (
              filteredCourses.map(course => (
                <div
                  key={course.id}
                  onClick={() => { setSelectedCourse(course); setEditingItem(null); }}
                  className={`p-4 cursor-pointer border-b border-slate-50 hover:bg-blue-50/50 transition-colors group ${selectedCourse?.id === course.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-sm leading-tight truncate">{course.title}</div>
                      {course.objective && <div className="text-xs text-slate-400 mt-0.5 truncate">{course.objective}</div>}
                      <div className="flex items-center gap-2 mt-1.5">
                        {!course.is_active && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">Неактивен</span>}
                        <span className="text-[10px] text-slate-400 flex items-center gap-1"><Users size={10}/>{getEnrolledCount(course.id)} уч.</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={e => { e.stopPropagation(); setEditingCourse(course); }} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Edit2 size={12}/></button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteCourse(course.id); }} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 size={12}/></button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Course Detail / Checksheet */}
        {selectedCourse ? (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            {/* Course Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-bold text-xl text-slate-800">{selectedCourse.title}</h2>
                  {selectedCourse.objective && (
                    <p className="text-sm text-slate-500 mt-1">ЦКП: <span className="font-medium text-slate-700">{selectedCourse.objective}</span></p>
                  )}
                  {selectedCourse.description && (
                    <p className="text-xs text-slate-400 mt-1 max-w-2xl">{selectedCourse.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {myEnrollment ? (
                    <div className="text-right">
                      <div className="text-xs text-slate-500 mb-1">Прогресс: {completionPercent}%</div>
                      <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${completionPercent}%` }} />
                      </div>
                    </div>
                  ) : currentUserId ? (
                    <button onClick={handleEnroll} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow transition-all">
                      Записаться
                    </button>
                  ) : null}
                  {isAdmin && (
                    <button
                      onClick={() => setEditingItem({ course_id: selectedCourse.id, type: 'read', order_num: checksheet.length + 1, requires_verification: false })}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 shadow transition-all"
                    >
                      <Plus size={14} /> Добавить шаг
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Checksheet */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Контрольный лист</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {checksheet.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <BookOpen className="mx-auto mb-3 opacity-30" size={40} />
                  <p className="text-sm">Контрольный лист пуст</p>
                  {isAdmin && <p className="text-xs mt-1">Нажмите «Добавить шаг» чтобы начать</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  {checksheet.map((item, idx) => {
                    const meta = ITEM_TYPE_META[item.type];
                    const completed = isItemCompleted(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${completed ? 'bg-emerald-50 border-emerald-200 opacity-80' : 'bg-white border-slate-200 hover:border-blue-200'}`}
                      >
                        {/* Step number / checkbox */}
                        <div className="flex-shrink-0 flex flex-col items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-400">{idx + 1}</span>
                          {myEnrollment ? (
                            <button
                              onClick={() => handleToggleCompletion(item)}
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-blue-400'}`}
                            >
                              {completed && <Check size={12} />}
                            </button>
                          ) : (
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200'}`}>
                              {completed && <Check size={12} />}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>
                              {meta.icon} {meta.label}
                            </span>
                            {item.requires_verification && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                <Lock size={9} /> Проверка СВ
                              </span>
                            )}
                          </div>
                          <p className={`text-sm font-medium leading-snug ${completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.content}</p>
                          {item.source_ref && <p className="text-xs text-slate-400 mt-1">📖 {item.source_ref}</p>}
                          <p className="text-xs text-slate-400 mt-1 italic">{meta.hint}</p>
                        </div>

                        {/* Admin controls */}
                        {isAdmin && (
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button onClick={() => handleMoveItem(item, 'up')} disabled={idx === 0} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-20"><ChevronUp size={14}/></button>
                            <button onClick={() => handleMoveItem(item, 'down')} disabled={idx === checksheet.length - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-20"><ChevronDown size={14}/></button>
                            <button onClick={() => setEditingItem(item)} className="p-1 text-blue-400 hover:text-blue-600"><Edit2 size={14}/></button>
                            <button onClick={() => handleDeleteItem(item.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <GraduationCap className="mx-auto mb-3 opacity-30" size={48} />
              <p className="text-sm">Выберите курс слева</p>
            </div>
          </div>
        )}
      </div>

      {/* ADMIN: Edit Course Modal */}
      {editingCourse && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-lg">{editingCourse.id ? 'Редактировать курс' : 'Новый курс'}</h3>
              <button onClick={() => setEditingCourse(null)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Название курса *</label>
                <input
                  value={editingCourse.title || ''}
                  onChange={e => setEditingCourse({ ...editingCourse, title: e.target.value })}
                  className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                  placeholder="Например: Курс по управлению персоналом"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ЦКП (Цель курса)</label>
                <input
                  value={editingCourse.objective || ''}
                  onChange={e => setEditingCourse({ ...editingCourse, objective: e.target.value })}
                  className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                  placeholder="Чего достигнет выпускник?"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Описание</label>
                <textarea
                  value={editingCourse.description || ''}
                  onChange={e => setEditingCourse({ ...editingCourse, description: e.target.value })}
                  className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-xl min-h-[80px] focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                  placeholder="Краткое описание курса..."
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl">
                <input
                  type="checkbox"
                  checked={editingCourse.is_active ?? true}
                  onChange={e => setEditingCourse({ ...editingCourse, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span className="text-sm font-medium text-slate-700">Курс активен (виден слушателям)</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingCourse(null)} className="flex-1 py-3 border border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-50">Отмена</button>
              <button onClick={handleSaveCourse} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN: Edit Checksheet Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-lg">{editingItem.id ? 'Редактировать шаг' : 'Новый шаг контрольного листа'}</h3>
              <button onClick={() => setEditingItem(null)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Тип шага *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(ITEM_TYPE_META) as ChecksheetItemType[]).map(t => {
                    const meta = ITEM_TYPE_META[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setEditingItem({ ...editingItem, type: t })}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-xs font-bold transition-all ${editingItem.type === t ? 'border-blue-500 ' + meta.color : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      >
                        {meta.icon} {meta.label}
                      </button>
                    );
                  })}
                </div>
                {editingItem.type && (
                  <p className="text-xs text-slate-400 mt-2 italic">{ITEM_TYPE_META[editingItem.type as ChecksheetItemType]?.hint}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Содержание / задание *</label>
                <textarea
                  value={editingItem.content || ''}
                  onChange={e => setEditingItem({ ...editingItem, content: e.target.value })}
                  className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-xl min-h-[80px] focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                  placeholder="Что должен сделать слушатель?"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Источник / ссылка на материал</label>
                <input
                  value={editingItem.source_ref || ''}
                  onChange={e => setEditingItem({ ...editingItem, source_ref: e.target.value })}
                  className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                  placeholder="Книга, стр. 45 / Ссылка на статью..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Порядковый номер</label>
                <input
                  type="number"
                  value={editingItem.order_num || ''}
                  onChange={e => setEditingItem({ ...editingItem, order_num: parseInt(e.target.value) })}
                  className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl">
                <input
                  type="checkbox"
                  checked={editingItem.requires_verification || false}
                  onChange={e => setEditingItem({ ...editingItem, requires_verification: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">Требует проверки супервайзера (СВ)</span>
                  <p className="text-xs text-slate-400">Шаг считается завершённым только после подтверждения СВ</p>
                </div>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingItem(null)} className="flex-1 py-3 border border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-50">Отмена</button>
              <button onClick={handleSaveItem} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursesTab;
