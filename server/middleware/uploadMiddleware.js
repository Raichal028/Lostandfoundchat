const fs = require('fs');
const path = require('path');
const multer = require('multer');

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

const ensureDir = (folder) => {
  const dir = path.join(__dirname, '../../uploads', folder);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const createUploader = (folder) => {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, ensureDir(folder));
    },
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/\s+/g, '-').toLowerCase();
      cb(null, `${Date.now()}-${safeName}`);
    }
  });

  return multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(new Error('Only JPG, PNG, and WEBP images are allowed'));
      }

      cb(null, true);
    }
  });
};

module.exports = { createUploader };
