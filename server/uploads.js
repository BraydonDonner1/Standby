// uploads.js — handles background image upload, retrieval, and removal.
// Images are stored in client/uploads/ so Express static serves them directly.

const express = require('express');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', 'client', 'uploads');
const META_PATH   = path.join(UPLOADS_DIR, 'bg-meta.json');

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MIME_TO_EXT   = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

function readMeta() {
  try { return JSON.parse(fs.readFileSync(META_PATH, 'utf8')); } catch (_e) { return null; }
}

function deleteCurrent() {
  const meta = readMeta();
  if (meta?.filename) {
    try { fs.unlinkSync(path.join(UPLOADS_DIR, meta.filename)); } catch (_e) {}
  }
  try { fs.unlinkSync(META_PATH); } catch (_e) {}
}

// GET /background — returns the current background filename, or null if none is set
router.get('/background', (_req, res) => {
  res.json({ ok: true, background: readMeta() });
});

// POST /background — accepts a raw image body (JPEG / PNG / WebP / GIF, max 20 MB)
router.post(
  '/background',
  express.raw({ type: (req) => ALLOWED_TYPES.has((req.headers['content-type'] || '').split(';')[0].trim()), limit: '20mb' }),
  (req, res) => {
    const contentType = (req.get('Content-Type') || '').split(';')[0].trim();

    if (!ALLOWED_TYPES.has(contentType)) {
      return res.status(400).json({ ok: false, error: 'Unsupported type — use JPEG, PNG, WebP, or GIF' });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ ok: false, error: 'No image data received' });
    }

    try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (err) {
      logger.error('Could not create uploads dir:', err.message);
      return res.status(500).json({ ok: false, error: 'Server error' });
    }

    deleteCurrent();

    const filename = `bg.${MIME_TO_EXT[contentType] || 'jpg'}`;
    try {
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.body);
      fs.writeFileSync(META_PATH, JSON.stringify({ filename, type: contentType }));
    } catch (err) {
      logger.error('Failed to save background image:', err.message);
      return res.status(500).json({ ok: false, error: 'Failed to save image' });
    }

    logger.info(`Background uploaded: ${filename} (${req.body.length} bytes)`);
    return res.json({ ok: true, background: { filename, type: contentType } });
  }
);

// DELETE /background — removes the current background image
router.delete('/background', (_req, res) => {
  deleteCurrent();
  logger.info('Background removed');
  res.json({ ok: true });
});

module.exports = { router, UPLOADS_DIR };
