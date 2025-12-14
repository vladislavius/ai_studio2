
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, Mail, ArrowRight, Loader2, ShieldCheck, UserPlus, Key, Zap, WifiOff } from 'lucide-react';

interface AuthProps {
  onBypass: () => void;
}

export default function Auth({ onBypass }: AuthProps) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secretCode, setSecretCode] = useState(''); // Protection for registration
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  // HARDCODED SECRET KEY FOR REGISTRATION
  const REGISTRATION_KEY = 'HR2024';

  const handleQuickAdminAccess = async () => {
    const demoEmail = 'admin@hrsystem.com';
    const demoPass = 'admin123';
    
    setLoading(true);
    setMessage(null);
    
    // Visually update form
    setEmail(demoEmail);
    setPassword(demoPass);
    if (mode === 'signup') setSecretCode(REGISTRATION_KEY);

    if (!supabase) {
        setMessage({ type: 'error', text: 'Database connection failed. Check configuration.' });
        setLoading(false);
        return;
    }

    try {
        // 1. Try to Login first
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: demoEmail,
            password: demoPass,
        });

        if (signInError) {
             // IMMEDIATE CHECK FOR NETWORK ERROR
             // If we can't even login due to network/SSL, don't try to register.
             const isNetworkError = 
                signInError.message === 'Failed to fetch' || 
                signInError.message.includes('SSL') || 
                signInError.message.includes('Network request failed');
            
             if (isNetworkError) {
                 console.log('Network error detected during login, switching to offline mode automatically...');
                 setMessage({ type: 'success', text: 'Server unreachable. Switching to Offline Mode...' });
                 setTimeout(() => {
                     onBypass();
                 }, 1500);
                 return;
             }
             
             // If error is NOT network (e.g. Invalid Login Credentials), proceed to Registration attempt
             console.log("Quick access login failed (credentials?), attempting registration...", signInError.message);
        } else {
            return; // Success! App.tsx handles redirect
        }

        // 2. If Login fails, maybe user doesn't exist? Try to Register.
        const { error: signUpError } = await supabase.auth.signUp({
            email: demoEmail,
            password: demoPass,
        });

        if (signUpError) {
            const isNetworkError = 
                signUpError.message === 'Failed to fetch' || 
                signUpError.message.includes('SSL') || 
                signUpError.message.includes('Network request failed');

            if (isNetworkError) {
                 console.log('Network error detected during signup, switching to offline mode...');
                 setMessage({ type: 'success', text: 'Server unreachable. Switching to Offline Mode...' });
                 setTimeout(() => {
                     onBypass();
                 }, 1500);
                 return;
            }
            
            if (signUpError.message.toLowerCase().includes("registered")) {
                 throw new Error("Admin user exists, but password 'admin123' is incorrect.");
            }
            throw signUpError;
        }

        // 3. Registration Success
        setMessage({ type: 'success', text: 'Admin account created! You can now login.' });
        setMode('login');
        
        // Auto-login retry
        const { error: retryError } = await supabase.auth.signInWithPassword({
            email: demoEmail,
            password: demoPass,
        });
        
        if (!retryError) return;

    } catch (err: any) {
        console.error("Quick Access Exception:", err);
        // Catch-all for "Failed to fetch" if it threw instead of returning error object
        if (err.message === 'Failed to fetch' || err.message.includes('Network request failed')) {
             setMessage({ type: 'success', text: 'Connection failed. Starting Offline Mode...' });
             setTimeout(onBypass, 1000);
             return;
        }
        setMessage({ type: 'error', text: err.message || 'Quick access failed.' });
    } finally {
        setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!supabase) {
        setMessage({ type: 'error', text: 'Database connection failed' });
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
      } else if (mode === 'signup') {
        // Security Check
        if (secretCode !== REGISTRATION_KEY) {
            throw new Error('Invalid Access Code. Registration restricted.');
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Registration successful! Please check your email to confirm.' });
        
        setTimeout(() => {
            setMode('login');
        }, 1500);

      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Password reset link sent to your email.' });
      }
    } catch (error: any) {
      // Check for network error here too
      const isNetworkError = error.message === 'Failed to fetch' || error.message.includes('SSL');
      if (isNetworkError) {
           setMessage({ type: 'error', text: 'Server connection failed. Try "Quick Admin Access" to go Offline.' });
      } else {
           setMessage({ type: 'error', text: error.message || 'An error occurred' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-blue-600 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-blue-500 opacity-20 transform -skew-y-6 scale-150 origin-top-left"></div>
            <div className="relative z-10">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <ShieldCheck className="text-white" size={32} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">HR System Pro</h1>
                <p className="text-blue-100 text-sm">Secure Corporate Access</p>
            </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100">
            <button 
                onClick={() => { setMode('login'); setMessage(null); }}
                className={`flex-1 py-4 text-sm font-semibold transition-colors ${mode === 'login' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Login
            </button>
            <button 
                onClick={() => { setMode('signup'); setMessage(null); }}
                className={`flex-1 py-4 text-sm font-semibold transition-colors ${mode === 'signup' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Register
            </button>
        </div>

        {/* Body */}
        <div className="p-8">
            <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-slate-700">
                    {mode === 'login' && 'Employee Login'}
                    {mode === 'signup' && 'New Account'}
                    {mode === 'forgot' && 'Reset Password'}
                </h2>
                <p className="text-sm text-slate-400">
                    {mode === 'login' && 'Please sign in to continue'}
                    {mode === 'signup' && 'Enter details and access code'}
                    {mode === 'forgot' && 'Enter email to receive reset link'}
                </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-5">
                {message && (
                    <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="flex-1 break-words">{message.text}</span>
                    </div>
                )}

                {/* Offline Bypass Option - Only shows if there's an error */}
                {message && message.type === 'error' && (
                    <button 
                        type="button"
                        onClick={onBypass}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all animate-in fade-in slide-in-from-top-2"
                    >
                        <WifiOff size={16} />
                        Continue in Offline Mode
                    </button>
                )}

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="email" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-slate-800"
                            placeholder="name@company.com"
                        />
                    </div>
                </div>

                {mode !== 'forgot' && (
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="password" 
                                required 
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-slate-800"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>
                )}

                {mode === 'signup' && (
                    <div className="space-y-1.5 animate-in slide-in-from-top-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                            Access Code
                            <span className="text-blue-500 font-normal normal-case">Required</span>
                        </label>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text" 
                                required 
                                value={secretCode}
                                onChange={(e) => setSecretCode(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-slate-800"
                                placeholder="Enter corporate code"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 text-right">Ask administrator for the code (Default: HR2024)</p>
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
                            {mode === 'login' && <>Sign In <ArrowRight size={18} /></>}
                            {mode === 'signup' && <>Create Account <UserPlus size={18} /></>}
                            {mode === 'forgot' && <>Send Reset Link <ArrowRight size={18} /></>}
                        </>
                    )}
                </button>
            </form>

             {/* Smart One-Click Test Button */}
             <div className="mt-6 pt-6 border-t border-slate-100">
                <button 
                    type="button" 
                    onClick={handleQuickAdminAccess}
                    disabled={loading}
                    className="w-full py-3 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all flex items-center justify-center gap-2 border border-blue-200 hover:shadow-md"
                >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} fill="currentColor" />}
                    ⚡ Quick Admin Access (Auto Login/Reg)
                </button>
                <p className="text-[10px] text-center text-slate-400 mt-2">
                    Automatically logs in or creates account for 'admin@hrsystem.com'.<br/>
                    <span className="text-amber-500 font-medium">Will switch to Offline Mode if server is unreachable.</span>
                </p>
            </div>

            <div className="mt-4 text-center">
                {mode === 'login' ? (
                    <button 
                        type="button"
                        onClick={() => { setMode('forgot'); setMessage(null); }}
                        className="text-sm text-slate-400 hover:text-blue-600 transition-colors font-medium"
                    >
                        Forgot your password?
                    </button>
                ) : (
                    <button 
                        type="button"
                        onClick={() => { setMode('login'); setMessage(null); }}
                        className="text-sm text-slate-400 hover:text-blue-600 transition-colors font-medium"
                    >
                        Back to Login
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
