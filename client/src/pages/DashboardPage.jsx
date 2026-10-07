import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Upload, ShieldCheck, User, Building, BookOpen } from 'lucide-react';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* TCE Top Header */}
      <header className="bg-tce-navy text-white px-6 py-4 shadow-md flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-700 to-red-600 flex items-center justify-center font-bold text-lg shadow-md">
            TCE
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">TCE Syllabus Validator</h1>
            <p className="text-xs text-slate-400">Regulation 2026 Academic Course-Design Audit</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs text-slate-300">
            <Building className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-white">Dept: {user?.department || 'Not Set'}</span>
            <span className="text-slate-500">•</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 capitalize font-mono text-[11px]">
              {user?.role}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700"></div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-300 font-medium">{user?.name}</span>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Faculty Dashboard</h2>
            <p className="text-sm text-slate-500 mt-1">
              Upload, review, and deterministically validate Regulation 2026 course syllabi.
            </p>
          </div>

          <button
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-md transition"
            onClick={() => alert('Upload feature activated in Phase 3!')}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Syllabus PDF</span>
          </button>
        </div>

        {/* Phase 2 Authentication Status Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Authenticated Staff Session Active</h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Domain Verified: @tce.edu
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                You are securely signed in as <span className="font-semibold text-slate-800">{user?.email}</span> with department code <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{user?.department}</span>. All uploaded syllabi will be cross-checked against your department programme codes.
              </p>
            </div>
          </div>
        </div>

        {/* Previous Submissions Placeholder */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-slate-700">No syllabus submissions yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Phase 3 will introduce syllabus PDF upload, coordinate extraction, and multi-course booklet segmentation.
          </p>
        </div>
      </main>
    </div>
  );
}
