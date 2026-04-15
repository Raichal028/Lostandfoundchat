const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { createUploader } = require('../middleware/uploadMiddleware');

const router = express.Router();
const upload = createUploader('profiles');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many authentication attempts. Please try again later.' }
});

router.post('/register', authLimiter, upload.single('profileImage'), register);
router.post('/login', authLimiter, login);
router.get('/me', protect, getMe);

module.exports = router;
