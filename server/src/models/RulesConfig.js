import mongoose from 'mongoose';

const DepartmentSchema = new mongoose.Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  programmeCodes: [{ type: String }]
}, { _id: false });

const RulesConfigSchema = new mongoose.Schema({
  version: { type: Number, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  currentRegulation: { type: String, default: '26' },
  currentYear: { type: Number, default: 2026 },
  departments: [DepartmentSchema],
  commonCourseDepts: [{ type: String }],
  categoryCodes: [{ type: String }],
  electiveCategories: [{ type: String }],
  bloomToTpsMapping: { type: mongoose.Schema.Types.Mixed },
  actionVerbs: {
    tps2: [{ type: String }],
    tps3: [{ type: String }],
    tps4: [{ type: String }],
    tps5: [{ type: String }]
  },
  thresholds: {
    coCountTheoryMin: { type: Number, default: 6 },
    coCountTheoryMax: { type: Number, default: 8 },
    coCountLabMin: { type: Number, default: 6 },
    coCountLabMax: { type: Number, default: 7 },
    tpsMinAllowed: { type: Number, default: 2 },
    coTps3PlusPercentageMin: { type: Number, default: 70 },
    coWeightageMin: { type: Number, default: 8 },
    coWeightageMax: { type: Number, default: 20 },
    coWeightageTotal: { type: Number, default: 100 },
    preambleWordMin: { type: Number, default: 60 },
    preambleWordMax: { type: Number, default: 90 },
    preambleLineMin: { type: Number, default: 3 },
    preambleLineMax: { type: Number, default: 4 },
    preambleCoOverlapThreshold: { type: Number, default: 0.60 },
    periodsPerCredit: { type: Number, default: 12 },
    courseNameMaxLen: { type: Number, default: 60 },
    bookRecencyCoreYears: { type: Number, default: 10 },
    bookRecencyElectiveYears: { type: Number, default: 5 },
    textBooksCountMin: { type: Number, default: 1 },
    textBooksCountMax: { type: Number, default: 2 },
    referenceBooksCountMin: { type: Number, default: 3 },
    referenceBooksCountMax: { type: Number, default: 6 }
  },
  assessmentComponentMarks: { type: mongoose.Schema.Types.Mixed },
  domainToSdgMapping: { type: mongoose.Schema.Types.Mixed },
  updatedAt: { type: Date, default: Date.now }
});

export const RulesConfig = mongoose.model('RulesConfig', RulesConfigSchema);
