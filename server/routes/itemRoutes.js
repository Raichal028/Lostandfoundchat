const express = require('express');
const {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem
} = require('../controllers/itemController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { createUploader } = require('../middleware/uploadMiddleware');

const router = express.Router();
const upload = createUploader('items');

router.get('/', optionalAuth, getItems);
router.get('/:id', optionalAuth, getItemById);
router.post('/', protect, upload.single('image'), createItem);
router.put('/:id', protect, upload.single('image'), updateItem);
router.delete('/:id', protect, deleteItem);

module.exports = router;
