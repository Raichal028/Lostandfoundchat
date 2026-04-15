const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Item = require('../models/Item');
const User = require('../models/User');

const buildRoomId = (itemId, userA, userB) =>
  `chat:${itemId}:${[String(userA), String(userB)].sort().join(':')}`;

const getToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  const headerToken = socket.handshake.headers?.authorization;

  if (authToken) {
    return authToken;
  }

  if (headerToken?.startsWith('Bearer ')) {
    return headerToken.split(' ')[1];
  }

  return null;
};

const setupChatSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = getToken(socket);

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return next(new Error('Unauthorized'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user._id}`);

    socket.on('chat:join', ({ itemId, partnerId }) => {
      if (!itemId || !partnerId) {
        return;
      }

      socket.join(buildRoomId(itemId, socket.user._id, partnerId));
    });

    socket.on('chat:typing', ({ itemId, partnerId }) => {
      if (!itemId || !partnerId) {
        return;
      }

      socket
        .to(buildRoomId(itemId, socket.user._id, partnerId))
        .emit('chat:typing', { itemId, senderId: String(socket.user._id) });
    });

    socket.on('chat:send', async (payload, callback = () => {}) => {
      try {
        const { itemId, receiverId, message } = payload;

        if (!itemId || !receiverId || !message?.trim()) {
          return callback({ ok: false, message: 'Invalid message payload' });
        }

        const item = await Item.findById(itemId);

        if (!item) {
          return callback({ ok: false, message: 'Item not found' });
        }

        const chatMessage = await Message.create({
          sender: socket.user._id,
          receiver: receiverId,
          itemId,
          message: message.trim()
        });

        const populated = await Message.findById(chatMessage._id)
          .populate('sender', 'name profileImage')
          .populate('receiver', 'name profileImage');

        const roomId = buildRoomId(itemId, socket.user._id, receiverId);
        io.to(roomId).emit('chat:message', populated);
        io.to(`user:${receiverId}`).emit('notification', {
          type: 'message',
          title: 'New message',
          message: `${socket.user.name} sent you a message about "${item.title}".`,
          itemId
        });

        callback({ ok: true, message: populated });
      } catch (error) {
        callback({ ok: false, message: 'Could not send message' });
      }
    });

    socket.on('chat:seen', async ({ itemId, partnerId }) => {
      if (!itemId || !partnerId) {
        return;
      }

      await Message.updateMany(
        {
          itemId,
          sender: partnerId,
          receiver: socket.user._id,
          seen: false
        },
        { $set: { seen: true } }
      );

      io.to(buildRoomId(itemId, socket.user._id, partnerId)).emit('chat:seen', {
        itemId,
        participantId: String(socket.user._id)
      });
    });
  });
};

module.exports = setupChatSocket;
