const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const { verifyJwt } = require('../utils/jwt');
const Board = require('../models/Board');
const { getBoardAccess } = require('../services/permissions');
const presence = require('../services/presenceStore');

const HEARTBEAT_STALE_MS = 45000;
const SWEEP_INTERVAL_MS = 30000;

async function attachRedisAdapter(io) {
  if (!process.env.REDIS_URL) {
    console.warn('REDIS_URL not set - Socket.io running in single-instance mode.');
    return;
  }
  try {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    pubClient.on('error', (err) => console.error('Redis pub client error:', err.message));
    subClient.on('error', (err) => console.error('Redis sub client error:', err.message));
    await pubClient.connect();
    await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));
    presence.configure(pubClient);
    console.log('Socket.io Redis adapter connected - ready to scale across instances.');
  } catch (err) {
    console.warn('Redis unavailable, falling back to single-instance mode:', err.message);
  }
}

async function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  await attachRedisAdapter(io);

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      socket.user = verifyJwt(token);
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  const activeBoardRooms = new Set();

  io.on('connection', (socket) => {
    let joinedBoardId = null;

    socket.on('join-board', async (boardId) => {
      try {
        const board = await Board.findById(boardId).lean();
        if (!board) return socket.emit('error-message', 'Board not found');

        const access = await getBoardAccess(board, socket.user.id);
        if (!access.allowed) return socket.emit('error-message', 'Forbidden');

        if (joinedBoardId && joinedBoardId !== boardId) {
          socket.leave(`board:${joinedBoardId}`);
          await presence.remove(joinedBoardId, socket.id);
          io.to(`board:${joinedBoardId}`).emit('presence:update', await presence.list(joinedBoardId));
        }

        joinedBoardId = boardId;
        activeBoardRooms.add(boardId);
        socket.join(`board:${boardId}`);
        await presence.touch(boardId, socket.id, socket.user.id, socket.user.username);
        io.to(`board:${boardId}`).emit('presence:update', await presence.list(boardId));
      } catch (err) {
        socket.emit('error-message', 'Failed to join board');
      }
    });

    socket.on('heartbeat', async () => {
      if (!joinedBoardId) return;
      await presence.touch(joinedBoardId, socket.id, socket.user.id, socket.user.username);
    });

    socket.on('disconnect', async () => {
      if (!joinedBoardId) return;
      await presence.remove(joinedBoardId, socket.id);
      io.to(`board:${joinedBoardId}`).emit('presence:update', await presence.list(joinedBoardId));
    });
  });

  // Safety net for tabs/sockets that vanish without a clean disconnect event.
  setInterval(async () => {
    for (const boardId of activeBoardRooms) {
      const users = await presence.list(boardId, HEARTBEAT_STALE_MS);
      io.to(`board:${boardId}`).emit('presence:update', users);
      if (users.length === 0) activeBoardRooms.delete(boardId);
    }
  }, SWEEP_INTERVAL_MS);

  return io;
}

module.exports = { initSockets };
