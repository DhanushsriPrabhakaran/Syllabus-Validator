import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import rulesDefaults from '../src/config/rules.defaults.json';

describe('Phase 1: Scaffold & Environment Verification', () => {
  let app;

  beforeAll(async () => {
    app = createApp();
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('GET /api/health returns ok status with correct regulation and domain', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toContain('TCE Syllabus Validator');
    expect(res.body.allowedDomain).toBe('tce.edu');
    expect(res.body.regulation).toBe('26');
  });

  it('validates integrity of rules.defaults.json configuration', () => {
    expect(rulesDefaults.version).toBe(1);
    expect(rulesDefaults.currentRegulation).toBe('26');
    expect(Array.isArray(rulesDefaults.departments)).toBe(true);
    expect(rulesDefaults.departments.length).toBeGreaterThan(0);

    // Verify critical departments exist
    const deptCodes = rulesDefaults.departments.map(d => d.code);
    expect(deptCodes).toContain('CS');
    expect(deptCodes).toContain('CA');
    expect(deptCodes).toContain('EE');
    expect(deptCodes).toContain('EC');

    // Verify Bloom to TPS mapping
    expect(rulesDefaults.bloomToTpsMapping['Apply']).toBe(3);
    expect(rulesDefaults.bloomToTpsMapping['Analyze']).toBe(4);
    expect(rulesDefaults.bloomToTpsMapping['Evaluate']).toBe(5);

    // Verify thresholds
    expect(rulesDefaults.thresholds.coCountTheoryMin).toBe(6);
    expect(rulesDefaults.thresholds.coCountTheoryMax).toBe(8);
    expect(rulesDefaults.thresholds.periodsPerCredit).toBe(12);
  });
});
