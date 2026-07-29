import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { isSupabaseConfigured, useAuth } from '../contexts/AuthContext';
import { Hexagon } from 'lucide-react';

export default function LoginPage() {
  const { user, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  if (user) return <Navigate to={from} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020914] via-[#06172B] to-[#020914] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Hexagon size={24} className="text-fusion-blue-light" />
          <span className="text-xl font-bold text-white tracking-wider">F44X</span>
        </div>
        <div className="bg-white rounded-xl shadow-xl p-6">
          <h2 className="text-lg font-bold text-fusion-text mb-1">Sign in</h2>
          <p className="text-sm text-fusion-text-muted mb-6">Access your Fusion 44X dashboard</p>

          {!isSupabaseConfigured && (
            <div className="bg-amber-50 text-amber-900 text-sm rounded-lg px-3 py-2 mb-4">
              Supabase env vars are missing in this deployment, so sign-in is disabled until
              `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are added in Netlify.
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue focus:border-transparent"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-fusion-blue text-white font-semibold py-2 rounded-lg hover:bg-fusion-blue-light transition-colors disabled:opacity-50"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-sm text-fusion-text-muted text-center mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-fusion-blue font-semibold hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
