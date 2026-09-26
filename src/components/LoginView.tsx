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
          <img
            src="/logo.png"
            alt="MeetingMind"
            className="w-14 h-14 rounded-2xl mx-auto mb-3 shadow-md object-cover"
          />
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
            MeetingMind
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Your local AI meeting delegate
          </p>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded bg-zinc-100 border border-black text-xs text-black font-medium">
            {error}
          </div>
        )}

        {/* Google Sign-In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md border border-black bg-white hover:bg-zinc-50 text-xs font-medium text-black transition-colors shadow-2xs"
        >
          <svg className="w-4 h-4 fill-current text-black" viewBox="0 0 24 24">
            <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" />
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
