import mongoose from 'mongoose';

const CourseEntrySchema = new mongoose.Schema({
  courseCode: { type: String, required: true },
  courseName: { type: String, required: true },
  courseType: {
    type: String,
    enum: ['Theory', 'Practical', 'Theory cum Practical'],
    default: 'Theory'
  },
  courseNature: {
    type: String,
    enum: ['Core', 'Advanced/Elective'],
    default: 'Core'
  },
  isCommonCourse: { type: Boolean, default: false },
  formatEra: {
    type: String,
    enum: ['2026', '2022_LEGACY'],
    default: '2026'
  },
  formatProfile: {
    type: String,
    enum: ['REG2026_STRICT', 'LEGACY_COMPAT'],
    default: 'REG2026_STRICT'
  },
  currentVersionNo: { type: Number, default: 1 },
  latestReportSummary: {
    status: { type: String, enum: ['Compliant', 'Has Errors', 'Warnings only', 'Pending'], default: 'Pending' },
    errorCount: { type: Number, default: 0 },
    warningCount: { type: Number, default: 0 },
    notVerifiableCount: { type: Number, default: 0 },
    passCount: { type: Number, default: 0 }
  },
  versions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Version' }]
});

const SubmissionSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sourceFilename: { type: String, required: true },
  storagePath: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileHash: { type: String },
  totalPages: { type: Number, default: 1 },
  courses: [CourseEntrySchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Submission = mongoose.model('Submission', SubmissionSchema);
