import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  CheckCircle,
  AlertTriangle,
  Save,
  ArrowRight,
  BookOpen,
  FileText,
  Calendar,
  Users,
  Layers,
  ChevronRight
} from 'lucide-react';

export default function ReviewPage({ submissionId, versionNo = 1, onValidate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('header');
  const [editedFields, setEditedFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchVersionData();
  }, [submissionId, versionNo]);

  async function fetchVersionData() {
    try {
      setLoading(true);
      const res = await axios.get(`/api/submissions/${submissionId}/versions/${versionNo}`, { withCredentials: true });
      setData(res.data);
      // Initialize edited fields with extracted fields
      setEditedFields(res.data.version.editedFields && Object.keys(res.data.version.editedFields).length > 0
        ? res.data.version.editedFields
        : res.data.version.extractedFields);
    } catch (err) {
      console.error('Failed to load version details', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveFields() {
    try {
      setSaving(true);
      await axios.put(`/api/submissions/${submissionId}/versions/${versionNo}/fields`, {
        editedFields
      }, { withCredentials: true });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      alert('Failed to save field corrections');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs text-slate-400 font-medium tracking-wider uppercase">Loading Extracted Fields...</p>
        </div>
      </div>
    );
  }

  const { version, courseMeta } = data;
  const fields = editedFields;
  const confidence = version.extractionConfidence || {};

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <span className="font-mono font-bold text-sm bg-blue-600/30 border border-blue-500/40 text-blue-300 px-2.5 py-1 rounded-lg">
            {fields.courseCode || 'COURSE'}
          </span>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              {fields.courseName || 'Extraction Review'}
            </h1>
            <p className="text-xs text-slate-400">
              Version {version.versionNo} • {version.originalFilename} • Review and correct fields before audit
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSaveFields}
            disabled={saving}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
          >
            <Save className="w-3.5 h-3.5 text-blue-400" />
            <span>{saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Corrections'}</span>
          </button>

          <button
            onClick={() => onValidate ? onValidate(submissionId, version.versionNo) : alert('Ready for validation in Phase 5!')}
            className="inline-flex items-center space-x-2 px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xs font-semibold shadow-md transition"
          >
            <span>Proceed to Validation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main 2-Pane Split Screen */}
      <div className="flex-1 flex overflow-hidden h-[calc(100vh-65px)]">
        {/* Left Pane: PDF Viewer Embed / Stream */}
        <div className="w-1/2 bg-slate-800 border-r border-slate-300 flex flex-col relative overflow-hidden">
          <div className="bg-slate-900/90 px-4 py-2 text-xs font-medium text-slate-400 border-b border-slate-700 flex justify-between items-center">
            <span>Original Uploaded PDF</span>
            <span className="text-[11px] text-slate-500">Page Navigation Active</span>
          </div>
          <iframe
            src={`/api/submissions/${submissionId}/pdf#toolbar=1&navpanes=0`}
            className="w-full h-full border-none"
            title="Uploaded Syllabus PDF"
          />
        </div>

        {/* Right Pane: Tabbed Field Editor */}
        <div className="w-1/2 bg-white flex flex-col overflow-y-auto">
          {/* Section Navigation Tabs */}
          <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 pt-3 space-x-1 shrink-0">
            {[
              { id: 'header', label: 'Course Header', icon: Layers },
              { id: 'preamble', label: 'Preamble', icon: FileText },
              { id: 'cos', label: 'Course Outcomes', icon: CheckCircle },
              { id: 'assessment', label: 'Assessment Pattern', icon: Layers },
              { id: 'modules', label: 'Modules', icon: BookOpen },
              { id: 'books', label: 'Books', icon: BookOpen },
              { id: 'schedule', label: 'Lecture Schedule', icon: Calendar },
              { id: 'designers', label: 'Designers', icon: Users }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition whitespace-nowrap border-b-2 ${
                    isActive
                      ? 'bg-white text-blue-700 border-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Form Content Area */}
          <div className="p-6 flex-1">
            {/* Tab: Course Header */}
            {activeTab === 'header' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">Course Metadata & Header Row</h3>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Confidence: {(confidence.header * 100 || 98).toFixed(0)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Course Code</label>
                    <input
                      type="text"
                      value={fields.courseCode || ''}
                      onChange={e => setEditedFields({ ...fields, courseCode: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                    <input
                      type="text"
                      value={fields.category || 'PC'}
                      onChange={e => setEditedFields({ ...fields, category: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Course Name</label>
                  <input
                    type="text"
                    value={fields.courseName || ''}
                    onChange={e => setEditedFields({ ...fields, courseName: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Lecture (L)</label>
                    <input
                      type="number"
                      value={fields.L ?? 3}
                      onChange={e => setEditedFields({ ...fields, L: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tutorial (T)</label>
                    <input
                      type="number"
                      value={fields.T ?? 0}
                      onChange={e => setEditedFields({ ...fields, T: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Practical (P)</label>
                    <input
                      type="number"
                      value={fields.P ?? 0}
                      onChange={e => setEditedFields({ ...fields, P: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Credits</label>
                    <input
                      type="number"
                      value={fields.credits ?? 3}
                      onChange={e => setEditedFields({ ...fields, credits: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 text-xs font-bold text-blue-700 rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Preamble */}
            {activeTab === 'preamble' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">Course Preamble</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono">
                      Word Count: {fields.preamble?.wordCount || 0}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                      Lines: {fields.preamble?.lineCount || 0}
                    </span>
                  </div>
                </div>

                <textarea
                  rows={6}
                  value={fields.preamble?.text || ''}
                  onChange={e => {
                    const text = e.target.value;
                    const wordCount = text.split(/\s+/).filter(Boolean).length;
                    setEditedFields({
                      ...fields,
                      preamble: { ...fields.preamble, text, wordCount }
                    });
                  }}
                  className="w-full p-3 text-xs leading-relaxed rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter 60 to 90 word preamble paragraph..."
                />
              </div>
            )}

            {/* Tab: Course Outcomes */}
            {activeTab === 'cos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">
                    Course Outcomes ({fields.courseOutcomes?.length || 0})
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Regulation 2026 requires 6 to 8 COs with TPS, PI, & Weightage
                  </span>
                </div>

                <div className="space-y-3">
                  {(fields.courseOutcomes || []).map((co, idx) => (
                    <div key={co.id || idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                          {co.id}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] text-slate-500 font-medium">Verb: <strong>{co.firstVerb || 'None'}</strong></span>
                          {co.bloomLabel && (
                            <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">
                              Bloom: {co.bloomLabel}
                            </span>
                          )}
                          {co.tpsLevel && (
                            <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                              TPS {co.tpsLevel}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 leading-normal">{co.statement}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Assessment Pattern */}
            {activeTab === 'assessment' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">Assessment Pattern</h3>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-medium">
                    Layout: {fields.assessmentPattern?.type || 'Not Detected'}
                  </span>
                </div>

                {fields.assessmentPattern?.type === 'BLOOM_WISE' ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 border-b border-slate-200 font-semibold text-slate-700">
                        <tr>
                          <th className="p-2.5">Cognitive Level</th>
                          <th className="p-2.5">CAT 1</th>
                          <th className="p-2.5">CAT 2</th>
                          <th className="p-2.5">CAT 3</th>
                          <th className="p-2.5">Terminal Exam</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(fields.assessmentPattern.rows || []).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2.5 font-medium text-slate-800">{r.level}</td>
                            <td className="p-2.5 font-mono">{r.cat1}%</td>
                            <td className="p-2.5 font-mono">{r.cat2}%</td>
                            <td className="p-2.5 font-mono">{r.cat3}%</td>
                            <td className="p-2.5 font-mono">{r.terminal}%</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                        <tr>
                          <td className="p-2.5">Total</td>
                          <td className="p-2.5 font-mono">{fields.assessmentPattern.columnSums?.CAT1}%</td>
                          <td className="p-2.5 font-mono">{fields.assessmentPattern.columnSums?.CAT2}%</td>
                          <td className="p-2.5 font-mono">{fields.assessmentPattern.columnSums?.CAT3}%</td>
                          <td className="p-2.5 font-mono">{fields.assessmentPattern.columnSums?.Terminal}%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">CO-wise assessment grid extracted.</p>
                )}
              </div>
            )}

            {/* Tab: Books */}
            {activeTab === 'books' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">
                    Learning Resources ({fields.allBooks?.length || 0} Books)
                  </h3>
                  <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                    fields.booksSplit ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {fields.booksSplit ? 'Split: Text & References' : 'Single Numbered List (Legacy)'}
                  </span>
                </div>

                <div className="space-y-3">
                  {(fields.allBooks || []).map((b, i) => (
                    <div key={i} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">"{b.title}"</span>
                        <div className="flex items-center space-x-2">
                          {b.edition && (
                            <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                              {b.edition}
                            </span>
                          )}
                          <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                            {b.year || 'No Year'}
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-600">Authors: {b.authors || 'Unknown'}</p>
                      {b.publisher && <p className="text-slate-500 text-[11px]">Publisher: {b.publisher}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Lecture Schedule */}
            {activeTab === 'schedule' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">Course Contents & Schedule</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-mono font-semibold">
                      Leaf Hours Sum: {fields.leafHoursSum}
                    </span>
                    <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                      Stated Total: {fields.totalPeriodsStated}
                    </span>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                  {(fields.lectureSchedule || []).map((row, idx) => (
                    <div key={idx} className={`p-2 flex items-center justify-between ${row.isModuleHeader ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'}`}>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-slate-600 w-12">{row.moduleNo}</span>
                        <span className="text-slate-800">{row.topics}</span>
                      </div>
                      <span className="font-mono text-slate-700 shrink-0 ml-4 font-semibold">
                        {row.isModuleHeader ? '-' : `${row.periods} hrs`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Course Designers */}
            {activeTab === 'designers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">Course Designers</h3>
                </div>

                <div className="space-y-3">
                  {(fields.courseDesigners || []).map((d, i) => (
                    <div key={i} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{d.name}</span>
                        <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{d.email}</span>
                      </div>
                      <p className="text-slate-500 text-[11px]">
                        Designation: {d.designation || '<Not Specified>'} • Dept: {d.department || '<Not Specified>'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Modules */}
            {activeTab === 'modules' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">Syllabus Modules ({fields.modules?.length || 0})</h3>
                </div>

                <div className="space-y-3">
                  {(fields.modules || []).map((m, i) => (
                    <div key={i} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">
                          Module {m.number}
                        </span>
                        <span className="font-semibold text-slate-800">{m.title}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed line-clamp-3">{m.topics}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
