const List = require('../models/List');
const Task = require('../models/Task');

// board.owner / member.user may be a raw ObjectId or a populated user object
// (e.g. getBoard populates members.user for display) - normalize either way.
function idOf(value) {
  return (value && value._id ? value._id : value).toString();
}

// Returns 'Owner' | 'Admin' | 'Viewer' | null based on board.owner/members only
// (does not consider tier or per-task sharing - see getBoardAccess for that).
function getBoardRole(board, userId) {
  const uid = userId.toString();
  if (idOf(board.owner) === uid) return 'Owner';
  const member = board.members.find(m => idOf(m.user) === uid);
  return member ? member.role : null;
}

// True if the user is in `sharedWith` on any task that belongs to this board.
async function isSharedOnBoard(boardId, userId) {
  const lists = await List.find({ boardId }).select('_id').lean();
  if (lists.length === 0) return false;
  const listIds = lists.map(l => l._id);
  const shared = await Task.exists({ listId: { $in: listIds }, 'sharedWith.user': userId });
  return !!shared;
}

// Full read-access resolution: membership > public tier > per-task share.
// Returns { allowed: boolean, role: 'Owner'|'Admin'|'Viewer'|'Public'|'Shared'|null }
async function getBoardAccess(board, userId) {
  const role = getBoardRole(board, userId);
  if (role) return { allowed: true, role };
  if (board.tier === 'Public') return { allowed: true, role: 'Public' };
  const shared = await isSharedOnBoard(board._id, userId);
  if (shared) return { allowed: true, role: 'Shared' };
  return { allowed: false, role: null };
}

// Confirms a list actually belongs to the given board; returns the list or null.
async function assertListInBoard(listId, boardId) {
  const list = await List.findById(listId);
  if (!list || list.boardId.toString() !== boardId.toString()) return null;
  return list;
}

// Confirms a task actually belongs (via its list) to the given board; returns { task, list } or null.
async function assertTaskInBoard(taskId, boardId) {
  const task = await Task.findById(taskId);
  if (!task) return null;
  const list = await assertListInBoard(task.listId, boardId);
  if (!list) return null;
  return { task, list };
}

// Board Owner/Admin can edit any task; a user individually shared on this one
// task with the 'Editor' role can edit just that task's content.
function canEditTask(task, board, userId) {
  const boardRole = getBoardRole(board, userId);
  if (boardRole === 'Owner' || boardRole === 'Admin') return true;
  const uid = userId.toString();
  const share = task.sharedWith.find(s => idOf(s.user) === uid);
  return !!share && share.role === 'Editor';
}

module.exports = {
  getBoardRole,
  isSharedOnBoard,
  getBoardAccess,
  assertListInBoard,
  assertTaskInBoard,
  canEditTask,
};
