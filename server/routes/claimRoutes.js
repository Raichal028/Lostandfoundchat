const express = require('express');
const { createClaim, getClaims, updateClaimStatus } = require('../controllers/itemController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, createClaim);
router.get('/', protect, getClaims);
router.put('/:id/status', protect, updateClaimStatus);

module.exports = router;
