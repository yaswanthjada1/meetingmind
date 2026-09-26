import React, { useState } from 'react';
import { loginWithGoogle, loginWithEmail, signUpWithEmail, AuthUser } from '../services/firebase';
import { Sparkles, ArrowRight, ShieldCheck, Lock } from 'lucide-react';

interface LoginViewProps {
  onSuccess: (user: AuthUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const user = await loginWithGoogle();
      onSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Google sign-in error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError('');
    try {
      let user: AuthUser;
      if (isSignUp) {
        user = await signUpWithEmail(email, password, name);
      } else {
        user = await loginWithEmail(email, password);
      }
      onSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 font-sans text-zinc-800">
      <div className="bg-white border border-zinc-200 rounded-xl max-w-sm w-full p-8 shadow-xs">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
            MeetingMind
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Your local AI meeting delegate
          </p>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Google Sign-In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 transition-colors shadow-2xs"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-white px-2 text-zinc-400 font-mono">or email</span>
          </div>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-[11px] font-mono text-zinc-500 uppercase mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Yaswanth"
                className="w-full text-xs px-3 py-2 rounded-md border border-zinc-200 focus:outline-hidden focus:border-zinc-400"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono text-zinc-500 uppercase mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-md border border-zinc-200 focus:outline-hidden focus:border-zinc-400"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-zinc-500 uppercase mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-md border border-zinc-200 focus:outline-hidden focus:border-zinc-400"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition-colors shadow-2xs"
          >
            {loading ? 'Signing in...' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {/* Toggle sign in / sign up */}
        <div className="mt-6 text-center text-xs text-zinc-500">
          {isSignUp ? (
            <span>
              Already have an account?{' '}
              <button
                onClick={() => setIsSignUp(false)}
                className="text-zinc-900 font-medium hover:underline"
              >
                Sign in
              </button>
            </span>
          ) : (
            <span>
              Don't have an account?{' '}
              <button
                onClick={() => setIsSignUp(true)}
                className="text-zinc-900 font-medium hover:underline"
              >
                Create account
              </button>
            </span>
          )}
        </div>

        {/* Local Privacy Note */}
        <div className="mt-8 pt-4 border-t border-zinc-100 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 font-mono">
          <Lock className="w-3 h-3 text-zinc-400" />
          <span>Local-first storage in IndexedDB</span>
        </div>
      </div>
    </div>
  );
};
