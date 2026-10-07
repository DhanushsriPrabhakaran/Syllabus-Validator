import mongoose from 'mongoose';

const FindingSchema = new mongoose.Schema({
  ruleId: { type: String, required: true },
  field: { type: String, required: true },
  status: { type: String, enum: ['pass', 'fail', 'warn', 'not_verifiable'], required: true },
  severity: { type: String, enum: ['error', 'warning', 'info'], required: true },
  extractedValue: { type: mongoose.Schema.Types.Mixed },
  expected: { type: String, required: true },
  reason: { type: String, required: true },
  guidelineRef: { type: String, default: '' },
  howToFix: { type: String, default: '' },
  location: {
    page: { type: Number },
    bbox: [{ type: Number }] // [x, y, width, height]
  }
}, { _id: false });

const VersionSchema = new mongoose.Schema({
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    required: true,
    index: true
  },
  courseCode: { type: String, required: true },
  versionNo: { type: Number, required: true, default: 1 },
  originalFilename: { type: String, required: true },
  pdfPath: { type: String, required: true },
  extractedFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  locations: { type: mongoose.Schema.Types.Mixed, default: {} },
  extractionConfidence: { type: mongoose.Schema.Types.Mixed, default: {} },
  editedFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  report: {
    summary: {
      status: { type: String, enum: ['Compliant', 'Has Errors', 'Warnings only', 'Pending'], default: 'Pending' },
      errorCount: { type: Number, default: 0 },
      warningCount: { type: Number, default: 0 },
      notVerifiableCount: { type: Number, default: 0 },
      passCount: { type: Number, default: 0 }
    },
    findings: [FindingSchema]
  },
  rulesConfigVersion: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now }
});

export const Version = mongoose.model('Version', VersionSchema);
