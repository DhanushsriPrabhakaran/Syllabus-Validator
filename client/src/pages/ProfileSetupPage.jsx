import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

const DEPARTMENT_OPTIONS = [
  { code: 'CA', name: 'Computer Applications', programmes: ['CA'] },
  { code: 'CS', name: 'Computer Science and Engineering', programmes: ['CS', 'PD'] },
  { code: 'IT', name: 'Information Technology', programmes: ['IT'] },
  { code: 'CB', name: 'Computer Science and Business Systems', programmes: ['CB'] },
  { code: 'AM', name: 'CSE (AI and ML)', programmes: ['AM'] },
  { code: 'DS', name: 'Data Science', programmes: ['DS'] },
  { code: 'EE', name: 'Electrical and Electronics Engineering', programmes: ['EE'] },
  { code: 'EC', name: 'Electronics and Communication Engineering', programmes: ['EC', 'PC'] },
  { code: 'ME', name: 'Mechanical Engineering', programmes: ['ME'] },
  { code: 'CE', name: 'Civil Engineering', programmes: ['CE', 'PA', 'PB'] },
  { code: 'MT', name: 'Mechatronics', programmes: ['MT'] },
  { code: 'MATHS', name: 'Mathematics (Common Courses)', programmes: [] },
  { code: 'PHYSICS', name: 'Physics (Common Courses)', programmes: [] },
  { code: 'CHEMISTRY', name: 'Chemistry (Common Courses)', programmes: [] },
  { code: 'ENGLISH', name: 'English (Common Courses)', programmes: [] }
];

export default function ProfileSetupPage() {
  const { user, updateProfile } = useAuth();
  const [selectedDept, setSelectedDept] = useState(user?.department || 'CA');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const currentSelection = DEPARTMENT_OPTIONS.find(d => d.code === selectedDept);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      setIsSubmitting(true);
      await updateProfile(selectedDept);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="max-w-lg w-full bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 relative">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Department Affiliation</h1>
            <p className="text-xs text-slate-400">Welcome, {user?.name || user?.email}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 mb-6 text-xs text-slate-300">
          <p className="font-semibold text-slate-200 mb-1">Why is this required?</p>
          <p className="leading-relaxed">
            Per Regulation 2026 guidelines, syllabus course codes must contain your department's designated programme code (e.g. <span className="font-mono text-blue-400">26CA...</span> for Computer Applications or <span className="font-mono text-blue-400">26CS...</span> for Computer Science). The validator verifies course ownership against this setting.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Select Your Department
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {DEPARTMENT_OPTIONS.map((dept) => (
                <option key={dept.code} value={dept.code}>
                  {dept.code} — {dept.name}
                </option>
              ))}
            </select>
          </div>

          {currentSelection?.programmes?.length > 0 && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
              <span className="font-semibold">Associated Programme Codes: </span>
              {currentSelection.programmes.map(p => (
                <span key={p} className="font-mono font-bold bg-blue-500/20 px-1.5 py-0.5 rounded ml-1 text-blue-200">
                  {p}
                </span>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-4 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium text-sm shadow-lg shadow-blue-900/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Saving Profile...' : 'Confirm Department & Continue'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
