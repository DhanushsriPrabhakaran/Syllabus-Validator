import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RulesConfig } from '../models/RulesConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULTS_PATH = path.resolve(__dirname, '../config/rules.defaults.json');

export function loadDefaultRulesConfig() {
  const content = fs.readFileSync(DEFAULTS_PATH, 'utf-8');
  return JSON.parse(content);
}

export async function seedRulesConfig(force = false) {
  const count = await RulesConfig.countDocuments();
  if (count === 0 || force) {
    const defaults = loadDefaultRulesConfig();
    const existing = await RulesConfig.findOne({ version: defaults.version });
    if (!existing) {
      const created = await RulesConfig.create(defaults);
      return created;
    }
  }
  return RulesConfig.findOne({ isActive: true }).sort({ version: -1 });
}

export async function getActiveRulesConfig() {
  try {
    const config = await RulesConfig.findOne({ isActive: true }).sort({ version: -1 }).lean();
    if (config) return config;
  } catch (err) {
    // In unit testing environments where DB might not be connected yet
  }
  return loadDefaultRulesConfig();
}
