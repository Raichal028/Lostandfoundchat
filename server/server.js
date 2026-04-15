const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const chatRoutes = require('./routes/chatRoutes');
const claimRoutes = require('./routes/claimRoutes');
const setupChatSocket = require('./sockets/chatSocket');

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

setupChatSocket(io);
app.set('io', io);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' }
});

app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/messages', chatRoutes);
app.use('/api/claims', claimRoutes);

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/pages/login.html'));
});

app.get('/register', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/pages/register.html'));
});

app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/pages/dashboard.html'));
});

app.get('/item', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/pages/item.html'));
});

app.use(express.static(path.join(__dirname, '../public')));

app.use((error, _req, res, _next) => {
  if (error.message?.includes('Only JPG, PNG, and WEBP')) {
    return res.status(400).json({ message: error.message });
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File size must be under 5MB' });
  }

  return res.status(500).json({ message: 'Server error', error: error.message });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();
