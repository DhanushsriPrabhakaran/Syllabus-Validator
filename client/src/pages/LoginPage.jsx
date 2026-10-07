import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { ShieldCheck, AlertCircle, LogIn, Sparkles, Building2 } from 'lucide-react';

export default function LoginPage() {
  const { loginWithGoogle, devLogin, error: authError } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [devEmail, setDevEmail] = useState('psaca@tce.edu');
  const [devName, setDevName] = useState('Dr. P. Sharmila');
  const [devDept, setDevDept] = useState('CA');
  const [devRole, setDevRole] = useState('staff');

  const activeError = errorMessage || authError;

  async function handleGoogleSuccess(credentialResponse) {
    try {
      setErrorMessage('');
      setIsSubmitting(true);
      await loginWithGoogle(credentialResponse.credential);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGoogleFailure() {
    setErrorMessage('Google sign-in popup was cancelled or failed to initialize.');
  }

  async function handleDevLogin(e) {
    e.preventDefault();
    try {
      setErrorMessage('');
      setIsSubmitting(true);
      await devLogin(devEmail, devName, devDept, devRole);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      {/* Background radial gradient accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-red-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-md w-full">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-800 to-red-600 shadow-xl shadow-red-950/50 mb-4 border border-red-500/30">
            <span className="text-white font-extrabold text-2xl tracking-wider">TCE</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Thiagarajar College of Engineering</h1>
          <p className="text-sm text-slate-400 mt-1">Autonomous Institution • Madurai, Tamil Nadu</p>
          <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs text-blue-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
            Regulation 2026 Syllabus Validator
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">Faculty Sign In</h2>
            <p className="text-xs text-slate-400 mt-1">
              Please authenticate using your institutional Google Workspace account.
            </p>
          </div>

          {/* Strict domain reminder */}
          <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-200">Domain Restriction:</span>
              <p className="text-amber-300/90 mt-0.5">
                Only institutional staff accounts with <span className="font-mono bg-amber-500/20 px-1 py-0.5 rounded text-amber-200">@tce.edu</span> are permitted. Personal Gmail and student subdomains will be rejected.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {activeError && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start space-x-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-red-200">Access Denied:</span>
                <p className="mt-0.5">{activeError}</p>
              </div>
            </div>
          )}

          {/* Google Sign In Component */}
          <div className="flex justify-center mb-6">
            <div className="w-full flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleFailure}
                shape="rectangular"
                theme="filled_blue"
                size="large"
                text="signin_with"
                width="100%"
              />
            </div>
          </div>

          {/* Dev Quick Sign-In Panel (for fast local developer testing) */}
          <div className="mt-8 pt-6 border-t border-slate-700/60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-blue-400" />
                Local Dev Sign-In
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Non-Prod
              </span>
            </div>

            <form onSubmit={handleDevLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email (@tce.edu)</label>
                <input
                  type="email"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Department</label>
                  <select
                    value={devDept}
                    onChange={(e) => setDevDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="CA">CA - Computer Applications</option>
                    <option value="CS">CS - Computer Science & Engg</option>
                    <option value="IT">IT - Information Technology</option>
                    <option value="EE">EE - Electrical & Electronics</option>
                    <option value="EC">EC - Electronics & Comm</option>
                    <option value="ME">ME - Mechanical Engg</option>
                    <option value="CE">CE - Civil Engg</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Role</label>
                  <select
                    value={devRole}
                    onChange={(e) => setDevRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="staff">Staff (Faculty)</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium text-xs shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Authenticating...' : 'Sign In as Staff / Admin'}</span>
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          © 2026 Thiagarajar College of Engineering. Academic Quality & Accreditation Cell.
        </p>
      </div>
    </div>
  );
}
