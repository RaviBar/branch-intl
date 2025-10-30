const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const db = require('./db/database');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/messages', require('./routes/messages')(io));
app.use('/api/agents', require('./routes/agents')(io));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Join agent room when agent logs in
  socket.on('agent-login', (agentId) => {
    socket.join(`agent-${agentId}`);
    console.log(`Agent ${agentId} joined room`);
  });
  
  // Join conversation room to listen for updates
  socket.on('join-conversation', (customerId) => {
    socket.join(`conversation-${customerId}`);
    console.log(`Client joined conversation ${customerId}`);
  });
  
  // Leave conversation room
  socket.on('leave-conversation', (customerId) => {
    socket.leave(`conversation-${customerId}`);
    console.log(`Client left conversation ${customerId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`WebSocket server ready`);
});

module.exports = { app, io };

