
import React, { useState } from 'react';
import { BookOpen, ArrowRight, Loader2, AlertCircle, User, CheckCircle } from 'lucide-react';
import { db } from '../services/db';
import { User as UserType, Book } from '../types';

interface AuthProps {
  onLogin: (user: UserType, books: Book[]) => void;
  onGuestLogin: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin, onGuestLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Initial basic validation
    if (!email.trim() || !password.trim() || (isRegistering && !name.trim())) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      if (isRegistering) {
        // 1. Try Register
        await db.register(email, password, name);
        
        // 2. Try Auto-Login (works if Email Confirm is OFF)
        const session = await db.getSession();
        
        if (session) {
            onLogin(session.user, session.books);
        } else {
            // 3. If no session, it means Email Confirm is ON
            setIsRegistering(false); // Switch to sign in view
            setSuccessMessage("Account created! Please check your email to confirm your registration before logging in.");
            setPassword(""); // Clear password for security
        }
      } else {
        const data = await db.login(email, password);
        onLogin(data.user, data.books);
      }
    } catch (err: any) {
      console.error(err);
      // Ensure error is a readable string
      const displayError = err?.message || "Authentication failed. Please check your credentials.";
      setError(displayError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-stone-50 dark:bg-stone-950 p-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-200/20 dark:bg-blue-900/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-orange-200/20 dark:bg-orange-900/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-100 dark:border-stone-800 p-8 relative z-10 animate-scale-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-stone-900 dark:bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg transform rotate-3">
            <BookOpen size={32} className="text-white dark:text-stone-900" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-800 dark:text-stone-100 mb-2">B.Nook</h1>
          <p className="text-stone-500 dark:text-stone-400">Your personal digital sanctuary.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <div className="space-y-1 animate-fade-in-up">
              <label className="text-xs font-bold text-stone-400 uppercase ml-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:ring-2 focus:ring-stone-500 transition-all text-stone-800 dark:text-stone-100"
                placeholder="John Doe"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-400 uppercase ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:ring-2 focus:ring-stone-500 transition-all text-stone-800 dark:text-stone-100"
              placeholder="hello@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-400 uppercase ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:ring-2 focus:ring-stone-500 transition-all text-stone-800 dark:text-stone-100"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in-up">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in-up border border-emerald-100 dark:border-emerald-800">
              <CheckCircle size={16} />
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 py-3 rounded-xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                {isRegistering ? 'Create Account' : 'Sign In'}
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800">
             <button 
                onClick={onGuestLogin}
                className="w-full py-3 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
             >
                 <User size={18} />
                 Continue as Guest
             </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
                setIsRegistering(!isRegistering);
                setError(null);
                setSuccessMessage(null);
            }}
            className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 text-sm font-medium transition-colors"
          >
            {isRegistering
              ? "Already have an account? Sign In"
              : "New here? Create an account"}
          </button>
        </div>
      </div>
    </div>
  );
};
