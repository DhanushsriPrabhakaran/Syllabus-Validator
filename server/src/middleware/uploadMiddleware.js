import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const UPLOAD_DIR = path.resolve('uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    const uniqueId = crypto.randomUUID();
    cb(null, `${uniqueId}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Only PDF documents are permitted'), false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit
  },
  fileFilter
});

/**
 * Validates PDF magic number (%PDF-)
 */
export function validatePdfMagicNumber(filePath) {
  const buffer = Buffer.alloc(5);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 5, 0);
  fs.closeSync(fd);

  const header = buffer.toString('utf-8');
  if (!header.startsWith('%PDF-')) {
    throw new Error('Corrupt or invalid PDF file format (missing %PDF- header)');
  }
  return true;
}

export { upload, UPLOAD_DIR };
