const mongoose = require('mongoose');
const Message = require('../models/Message');
const Item = require('../models/Item');

const getMessagesByItem = async (req, res) => {
  try {
    const { participantId } = req.query;
    const { itemId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: 'Invalid item id' });
    }

    const item = await Item.findById(itemId).populate('postedBy', 'name email profileImage');

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const partnerId = participantId || String(item.postedBy._id);

    const messages = await Message.find({
      itemId,
      $or: [
        { sender: req.user._id, receiver: partnerId },
        { sender: partnerId, receiver: req.user._id }
      ]
    })
      .populate('sender', 'name profileImage')
      .populate('receiver', 'name profileImage')
      .sort({ createdAt: 1 });

    await Message.updateMany(
      { itemId, sender: partnerId, receiver: req.user._id, seen: false },
      { $set: { seen: true } }
    );

    res.json({
      item,
      participantId: partnerId,
      messages
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch messages', error: error.message });
  }
};

const getConversations = async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }]
    })
      .populate('sender', 'name profileImage')
      .populate('receiver', 'name profileImage')
      .populate('itemId', 'title image type location')
      .sort({ createdAt: -1 });

    const map = new Map();

    messages.forEach((message) => {
      if (!message.itemId) {
        return;
      }

      const partner =
        String(message.sender._id) === String(req.user._id) ? message.receiver : message.sender;
      const key = `${message.itemId._id}:${partner._id}`;

      if (!map.has(key)) {
        map.set(key, {
          item: message.itemId,
          participant: partner,
          lastMessage: message,
          unreadCount: 0
        });
      }

      if (String(message.receiver._id) === String(req.user._id) && !message.seen) {
        map.get(key).unreadCount += 1;
      }
    });

    res.json({
      conversations: Array.from(map.values()).sort(
        (a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
      )
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch conversations', error: error.message });
  }
};

const markSeen = async (req, res) => {
  try {
    const { participantId } = req.body;
    const { itemId } = req.params;

    await Message.updateMany(
      {
        itemId,
        sender: participantId,
        receiver: req.user._id,
        seen: false
      },
      { $set: { seen: true } }
    );

    const io = req.app.get('io');
    io.to(`user:${participantId}`).emit('chat:seen', {
      itemId,
      participantId: String(req.user._id)
    });

    res.json({ message: 'Messages marked as seen' });
  } catch (error) {
    res.status(500).json({ message: 'Could not update message state', error: error.message });
  }
};

module.exports = { getMessagesByItem, getConversations, markSeen };
