
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, Mail, ArrowRight, Loader2, ShieldCheck, WifiOff } from 'lucide-react';

interface AuthProps {
  onBypass: () => void;
}

export default function Auth({ onBypass }: AuthProps) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!supabase) {
        setMessage({ type: 'error', text: 'Ошибка подключения к базе данных.' });
        setLoading(false);
        return;
    }

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Успешный вход перехватывается в App.tsx через onAuthStateChange
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Ссылка для сброса пароля отправлена на ваш Email.' });
      }
    } catch (error: any) {
      const isNetworkError = error.message === 'Failed to fetch' || error.message.includes('SSL');
      
      if (isNetworkError) {
           setMessage({ type: 'error', text: 'Нет соединения с сервером.' });
      } else if (error.message.includes('Invalid login credentials')) {
           setMessage({ type: 'error', text: 'Неверный Email или пароль.' });
      } else {
           setMessage({ type: 'error', text: error.message || 'Ошибка входа' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-800 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-slate-700 opacity-20 transform -skew-y-6 scale-150 origin-top-left"></div>
            <div className="relative z-10">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg border border-white/10">
                    <ShieldCheck className="text-white" size={32} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">HR System Pro</h1>
                <p className="text-slate-300 text-sm">Корпоративный доступ</p>
            </div>
        </div>

        {/* Body */}
        <div className="p-8">
            <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-slate-700">
                    {mode === 'login' && 'Вход в систему'}
                    {mode === 'forgot' && 'Восстановление доступа'}
                </h2>
                <p className="text-sm text-slate-400">
                    {mode === 'login' && 'Введите свои учетные данные'}
                    {mode === 'forgot' && 'Введите email для сброса пароля'}
                </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-5">
                {message && (
                    <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="flex-1 break-words">{message.text}</span>
                    </div>
                )}

                {/* Кнопка оффлайн режима появляется ТОЛЬКО при ошибке сети */}
                {message && message.text.includes('Нет соединения') && (
                    <button 
                        type="button"
                        onClick={onBypass}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all animate-in fade-in slide-in-from-top-2"
                    >
                        <WifiOff size={16} />
                        Войти в оффлайн-режиме
                    </button>
                )}

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="email" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-slate-800"
                            placeholder="employee@company.com"
                        />
                    </div>
                </div>

                {mode !== 'forgot' && (
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Пароль</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="password" 
                                required 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-slate-800"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
                >
                    {loading ? (
                        <Loader2 className="animate-spin" size={20} />
                    ) : (
                        <>
                            {mode === 'login' && <>Войти <ArrowRight size={18} /></>}
                            {mode === 'forgot' && <>Отправить ссылку <ArrowRight size={18} /></>}
                        </>
                    )}
                </button>
            </form>

            <button
                type="button"
                onClick={onBypass}
                className="w-full mt-3 py-2.5 border-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
            >
                <WifiOff size={16} />
                Демо-режим (посмотреть прототип ЗРС в чате)
            </button>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                {mode === 'login' ? (
                    <button 
                        type="button"
                        onClick={() => { setMode('forgot'); setMessage(null); }}
                        className="text-sm text-slate-400 hover:text-blue-600 transition-colors font-medium"
                    >
                        Забыли пароль?
                    </button>
                ) : (
                    <button 
                        type="button"
                        onClick={() => { setMode('login'); setMessage(null); }}
                        className="text-sm text-slate-400 hover:text-blue-600 transition-colors font-medium"
                    >
                        Вернуться ко входу
                    </button>
                )}
            </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">© 2024 HR System Pro.</p>
        </div>
      </div>
    </div>
  );
}
