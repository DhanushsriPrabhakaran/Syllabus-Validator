import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import rulesDefaults from '../config/rules.defaults.json';

const router = express.Router();

// Valid department codes from rules config
const ALLOWED_DEPARTMENTS = rulesDefaults.departments.map(d => d.code);
const COMMON_COURSE_DEPTS = rulesDefaults.commonCourseDepts || [];
const ALL_VALID_DEPTS = [...ALLOWED_DEPARTMENTS, ...COMMON_COURSE_DEPTS];

/**
 * GET /api/profile
 * Returns user profile and list of selectable departments
 */
router.get('/', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture,
      department: req.user.department,
      role: req.user.role
    },
    departments: rulesDefaults.departments,
    commonCourseDepts: COMMON_COURSE_DEPTS
  });
});

/**
 * PUT /api/profile
 * Updates faculty department
 */
router.put('/', requireAuth, async (req, res) => {
  const { department } = req.body;

  if (!department) {
    return res.status(400).json({ error: 'Department code is required' });
  }

  const upperDept = department.trim().toUpperCase();
  if (!ALL_VALID_DEPTS.includes(upperDept)) {
    return res.status(400).json({
      error: `Invalid department code: ${department}. Allowed: ${ALL_VALID_DEPTS.join(', ')}`
    });
  }

  req.user.department = upperDept;
  await req.user.save();

  res.json({
    message: 'Profile updated successfully',
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture,
      department: req.user.department,
      role: req.user.role
    }
  });
});

export default router;
