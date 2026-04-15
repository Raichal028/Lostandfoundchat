const express = require('express');
const { getMessagesByItem, getConversations, markSeen } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/conversations/list', protect, getConversations);
router.get('/:itemId', protect, getMessagesByItem);
router.put('/:itemId/seen', protect, markSeen);

module.exports = router;
