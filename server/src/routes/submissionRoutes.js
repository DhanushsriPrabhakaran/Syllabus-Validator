import express from 'express';
import fs from 'fs';
import crypto from 'crypto';
import { upload, validatePdfMagicNumber } from '../middleware/uploadMiddleware.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { extractSyllabusDocument } from '../extractor/index.js';
import { Submission } from '../models/Submission.js';
import { Version } from '../models/Version.js';
import { validateSyllabus } from '../rules/index.js';
import pino from 'pino';

const logger = pino({ name: 'submissionRoutes' });
const router = express.Router();

/**
 * POST /api/submissions
 * Uploads PDF, extracts coordinates and structured fields, and saves Version 1.
 */
router.post('/', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const filePath = req.file.path;

    // Validate magic number (%PDF-)
    try {
      validatePdfMagicNumber(filePath);
    } catch (err) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: err.message });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Run extractor pipeline
    const { totalPages, courses } = await extractSyllabusDocument(fileBuffer);

    // Create Submission document
    const submission = new Submission({
      owner: req.user._id,
      sourceFilename: req.file.originalname,
      storagePath: filePath,
      fileSize: req.file.size,
      fileHash,
      totalPages,
      courses: []
    });

    for (const c of courses) {
      const courseProfile = req.body.formatProfile || 'REG2026_STRICT';
      const courseNature = req.body.courseNature || 'Core';
      const isCommonCourse = req.body.isCommonCourse === 'true' || false;

      // Validate extracted fields deterministically
      const report = await validateSyllabus(c.extractedFields, {
        userDept: req.user.department,
        uploaderEmail: req.user.email,
        profile: courseProfile,
        courseType: c.courseType,
        courseNature,
        isCommonCourse,
        locations: c.locations
      });

      const version = new Version({
        submissionId: submission._id,
        courseCode: c.courseCode,
        versionNo: 1,
        originalFilename: req.file.originalname,
        pdfPath: filePath,
        extractedFields: c.extractedFields,
        locations: c.locations,
        extractionConfidence: c.extractionConfidence,
        report,
        rulesConfigVersion: report.rulesConfigVersion
      });

      await version.save();

      submission.courses.push({
        courseCode: c.courseCode,
        courseName: c.courseName,
        courseType: c.courseType,
        courseNature,
        isCommonCourse,
        formatEra: c.formatEra,
        formatProfile: courseProfile,
        currentVersionNo: 1,
        versions: [version._id]
      });
    }

    await submission.save();
    logger.info({ submissionId: submission._id, courseCount: submission.courses.length }, 'Submission created and validated');

    return res.status(201).json({
      message: 'Syllabus uploaded and extracted successfully',
      submission: {
        id: submission._id,
        sourceFilename: submission.sourceFilename,
        totalPages: submission.totalPages,
        fileSize: submission.fileSize,
        courses: submission.courses
      }
    });
  } catch (err) {
    logger.error({ err }, 'Error during syllabus upload and extraction');
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    next(err);
  }
});

/**
 * GET /api/submissions
 * Lists submissions for the logged in staff member (or all for admin)
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { owner: req.user._id };
    const submissions = await Submission.find(filter)
      .sort({ createdAt: -1 })
      .populate('owner', 'name email department')
      .lean();

    return res.json({ submissions });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/submissions/:id
 * Fetches single submission details with courses
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('owner', 'name email department')
      .populate('courses.versions')
      .lean();

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (req.user.role !== 'admin' && submission.owner._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied to this submission' });
    }

    return res.json({ submission });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/submissions/:id/versions/:v
 * Returns version fields, locations, and confidence for a specific version
 */
router.get('/:id/versions/:v', requireAuth, async (req, res, next) => {
  try {
    const { id, v } = req.params;
    const versionNo = parseInt(v, 10);
    const courseCode = req.query.courseCode;

    const submission = await Submission.findById(id);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (req.user.role !== 'admin' && submission.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const query = { submissionId: id, versionNo };
    if (courseCode) {
      query.courseCode = courseCode;
    }

    const version = await Version.findOne(query).lean();
    if (!version) {
      return res.status(404).json({ error: `Version ${v} not found for this submission` });
    }

    const courseMeta = submission.courses.find(c => c.courseCode === version.courseCode);

    return res.json({
      version,
      courseMeta,
      submission: {
        id: submission._id,
        sourceFilename: submission.sourceFilename,
        totalPages: submission.totalPages
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/submissions/:id/versions/:v/fields
 * Saves faculty corrections to extracted fields before re-validation
 */
router.put('/:id/versions/:v/fields', requireAuth, async (req, res, next) => {
  try {
    const { id, v } = req.params;
    const versionNo = parseInt(v, 10);
    const { editedFields, courseCode } = req.body;

    const submission = await Submission.findById(id);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (req.user.role !== 'admin' && submission.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const query = { submissionId: id, versionNo };
    if (courseCode) {
      query.courseCode = courseCode;
    }

    const version = await Version.findOne(query);
    if (!version) {
      return res.status(404).json({ error: `Version ${v} not found` });
    }

    version.editedFields = editedFields;
    await version.save();

    return res.json({
      message: 'Fields updated successfully',
      version
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/submissions/:id/versions/:v/validate
 * Deterministically validates fields (including faculty edits), updates report,
 * and optionally creates an incremented version.
 */
router.post('/:id/versions/:v/validate', requireAuth, async (req, res, next) => {
  try {
    const { id, v } = req.params;
    const versionNo = parseInt(v, 10);
    const { courseCode, profile, courseNature, isCommonCourse, courseType, createNewVersion } = req.body;

    const submission = await Submission.findById(id);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (req.user.role !== 'admin' && submission.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const query = { submissionId: id, versionNo };
    if (courseCode) {
      query.courseCode = courseCode;
    }

    const currentVersion = await Version.findOne(query);
    if (!currentVersion) {
      return res.status(404).json({ error: `Version ${v} not found for this submission` });
    }

    const courseIndex = submission.courses.findIndex(c => c.courseCode === currentVersion.courseCode);
    const courseMeta = courseIndex >= 0 ? submission.courses[courseIndex] : {};

    const activeProfile = profile || courseMeta.formatProfile || 'REG2026_STRICT';
    const activeNature = courseNature || courseMeta.courseNature || 'Core';
    const activeCommon = isCommonCourse !== undefined ? isCommonCourse : (courseMeta.isCommonCourse || false);
    const activeType = courseType || courseMeta.courseType || 'Theory';

    // Merge original extracted fields with any faculty edits
    const fieldsToValidate = {
      ...currentVersion.extractedFields,
      ...(currentVersion.editedFields || {})
    };

    const report = await validateSyllabus(fieldsToValidate, {
      userDept: req.user.department,
      uploaderEmail: req.user.email,
      profile: activeProfile,
      courseNature: activeNature,
      isCommonCourse: activeCommon,
      courseType: activeType,
      locations: currentVersion.locations
    });

    let targetVersion = currentVersion;
    if (createNewVersion) {
      const nextVersionNo = (courseMeta.currentVersionNo || versionNo) + 1;
      targetVersion = new Version({
        submissionId: id,
        courseCode: currentVersion.courseCode,
        versionNo: nextVersionNo,
        originalFilename: currentVersion.originalFilename,
        pdfPath: currentVersion.pdfPath,
        extractedFields: fieldsToValidate,
        editedFields: {},
        locations: currentVersion.locations,
        extractionConfidence: currentVersion.extractionConfidence,
        report,
        rulesConfigVersion: report.rulesConfigVersion
      });
      await targetVersion.save();

      if (courseIndex >= 0) {
        submission.courses[courseIndex].currentVersionNo = nextVersionNo;
        submission.courses[courseIndex].versions.push(targetVersion._id);
        if (profile) submission.courses[courseIndex].formatProfile = profile;
        await submission.save();
      }
    } else {
      currentVersion.report = report;
      currentVersion.rulesConfigVersion = report.rulesConfigVersion;
      await currentVersion.save();
    }

    logger.info({ submissionId: id, versionNo: targetVersion.versionNo, status: report.summary.status }, 'Version validated');

    return res.json({
      message: 'Validation executed successfully',
      version: targetVersion,
      report
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/submissions/:id/pdf
 * Streams original uploaded PDF with byte-range support for react-pdf
 */
router.get('/:id/pdf', requireAuth, async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (req.user.role !== 'admin' && submission.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(submission.storagePath)) {
      return res.status(404).json({ error: 'PDF file not found on disk' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${submission.sourceFilename}"`);
    fs.createReadStream(submission.storagePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
