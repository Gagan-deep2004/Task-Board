// Tracks who is currently viewing each board. Backed by Redis when available
// so presence is consistent across multiple scaled server instances; falls
// back to an in-memory Map for single-instance/local dev when Redis isn't
// configured or couldn't connect.
let redisClient = null;
const memoryStore = new Map(); // boardId -> Map(socketId -> { userId, username, lastSeen })

function configure(client) {
  redisClient = client;
}

function memoryBoard(boardId) {
  if (!memoryStore.has(boardId)) memoryStore.set(boardId, new Map());
  return memoryStore.get(boardId);
}

async function touch(boardId, socketId, userId, username) {
  const entry = { userId, username, lastSeen: Date.now() };
  if (redisClient) {
    await redisClient.hSet(`presence:${boardId}`, socketId, JSON.stringify(entry));
  } else {
    memoryBoard(boardId).set(socketId, entry);
  }
}

async function remove(boardId, socketId) {
  if (redisClient) {
    await redisClient.hDel(`presence:${boardId}`, socketId);
  } else {
    memoryBoard(boardId).delete(socketId);
  }
}

// Returns the de-duplicated (by user) list of currently-present users for a
// board, purging any entries that haven't sent a heartbeat within staleMs.
async function list(boardId, staleMs = 45000) {
  const now = Date.now();
  let entries;
  if (redisClient) {
    const raw = await redisClient.hGetAll(`presence:${boardId}`);
    entries = Object.entries(raw).map(([socketId, json]) => [socketId, JSON.parse(json)]);
  } else {
    entries = Array.from(memoryBoard(boardId).entries());
  }

  const fresh = [];
  const staleSocketIds = [];
  for (const [socketId, data] of entries) {
    if (now - data.lastSeen > staleMs) {
      staleSocketIds.push(socketId);
    } else {
      fresh.push(data);
    }
  }

  if (staleSocketIds.length) {
    await Promise.all(staleSocketIds.map((sid) => remove(boardId, sid)));
  }

  const byUser = new Map();
  for (const entry of fresh) byUser.set(entry.userId, entry);
  return Array.from(byUser.values());
}

module.exports = { configure, touch, remove, list };
