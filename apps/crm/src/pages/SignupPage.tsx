import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { isSupabaseConfigured, useAuth } from '../contexts/AuthContext';
import { Hexagon } from 'lucide-react';
import type { Role } from '../types';

const roles: { value: Role; label: string; desc: string }[] = [
  { value: 'admin', label: 'Main Account Admin', desc: 'Full platform access & user management' },
  { value: 'manufacturer', label: 'Main Account', desc: 'Primary CRM workspace' },
  { value: 'distributor', label: 'Sub-Account', desc: 'Distribution portal & lead handling' },
];

export default function SignupPage() {
  const { user, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState<Role>('manufacturer');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signUp(email, password, fullName, role, company);
    if (error) setError(error);
    else setSuccess(true);
    setSubmitting(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#020914] via-[#06172B] to-[#020914] flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-fusion-success/10 flex items-center justify-center mx-auto mb-3">
            <Hexagon size={20} className="text-fusion-success" />
          </div>
          <h2 className="text-lg font-bold text-fusion-text mb-1">Check your email</h2>
          <p className="text-sm text-fusion-text-muted mb-4">We sent a confirmation link to <strong>{email}</strong></p>
          <Link to="/login" className="text-fusion-blue font-semibold text-sm hover:underline">Go to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020914] via-[#06172B] to-[#020914] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Hexagon size={24} className="text-fusion-blue-light" />
          <span className="text-xl font-bold text-white tracking-wider">F44X</span>
        </div>
        <div className="bg-white rounded-xl shadow-xl p-6">
          <h2 className="text-lg font-bold text-fusion-text mb-1">Create account</h2>
          <p className="text-sm text-fusion-text-muted mb-6">Join the Fusion 44X ecosystem</p>

          {!isSupabaseConfigured && (
            <div className="bg-amber-50 text-amber-900 text-sm rounded-lg px-3 py-2 mb-4">
              Supabase env vars are missing in this deployment, so account creation is disabled
              until `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are added in Netlify.
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue focus:border-transparent"
                placeholder="Jane Smith"
              />
            </div>
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
                minLength={6}
                className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue focus:border-transparent"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Company / Organization</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue focus:border-transparent"
                placeholder="Your company name"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-fusion-text-muted uppercase tracking-wider block mb-2">Role</label>
              <div className="space-y-2">
                {roles.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      role === r.value
                        ? 'border-fusion-blue bg-fusion-blue/5'
                        : 'border-fusion-border-light hover:border-fusion-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={role === r.value}
                      onChange={() => setRole(r.value)}
                      className="accent-fusion-blue"
                    />
                    <div>
                      <span className="text-sm font-semibold text-fusion-text block">{r.label}</span>
                      <span className="text-[11px] text-fusion-text-muted">{r.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-fusion-blue text-white font-semibold py-2 rounded-lg hover:bg-fusion-blue-light transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-sm text-fusion-text-muted text-center mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-fusion-blue font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
