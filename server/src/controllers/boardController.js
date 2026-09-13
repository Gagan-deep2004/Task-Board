const Board = require('../models/Board');
const List = require('../models/List');
const Task = require('../models/Task');
const User = require('../models/User');
const { createBoardWithDefaultLists } = require('../services/boardFactory');
const { getBoardAccess } = require('../services/permissions');

function emitToBoard(req, boardId, event, payload) {
  const io = req.app.get('io');
  if (io) io.to(`board:${boardId}`).emit(event, payload);
}

exports.createBoard = async (req, res) => {
  try {
    const { title } = req.body;
    const { board } = await createBoardWithDefaultLists({ ownerId: req.user.id, title });
    res.status(201).json(board);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create board', details: error.message });
  }
};

exports.getBoard = async (req, res) => {
  try {
    const board = await Board.findById(req.params.id)
      .populate('members.user', 'username email')
      .lean();
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const access = await getBoardAccess(board, req.user.id);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Forbidden: you do not have access to this board.' });
    }

    const lists = await List.find({ boardId: board._id }).sort('order').lean();
    for (let list of lists) {
      list.tasks = await Task.find({ listId: list._id })
        .sort('order')
        .populate('sharedWith.user', 'username email')
        .lean();
    }

    res.status(200).json({
      ...board,
      lists,
      myRole: access.role,
    });
  } catch (error) {
    console.error('Error fetching board:', error);
    res.status(500).json({ error: 'Failed to fetch board', details: error.message });
  }
};

// Get all boards owned by, or explicitly shared as a member with, the logged-in
// user. A Public board is viewable by anyone who navigates to it directly
// (see getBoardAccess/getBoard) but does NOT get auto-listed on everyone's
// dashboard - only an explicit member invite adds it there.
exports.getAllBoards = async (req, res) => {
  try {
    const boards = await Board.find({
      $or: [
        { owner: req.user.id },
        { 'members.user': req.user.id }
      ]
    });
    res.status(200).json(boards);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch boards', details: error.message });
  }
};

// Update board settings (title/tier only - membership changes go through the
// dedicated addMember/removeMember endpoints so we can validate them properly)
exports.updateBoard = async (req, res) => {
  try {
    const { title, tier } = req.body;
    const board = req.board; // set by requireBoardAdmin

    if (title !== undefined) board.title = title;
    if (tier !== undefined) board.tier = tier;

    await board.save();
    emitToBoard(req, board._id, 'board:updated', { board });
    res.status(200).json({ message: 'Board updated successfully', board });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update board', details: error.message });
  }
};

// Delete a board and its associated lists/tasks
exports.deleteBoard = async (req, res) => {
  try {
    const board = req.board; // set by requireBoardAdmin

    const lists = await List.find({ boardId: board._id });
    for (let list of lists) {
      await Task.deleteMany({ listId: list._id });
    }
    await List.deleteMany({ boardId: board._id });
    await Board.findByIdAndDelete(board._id);

    emitToBoard(req, board._id, 'board:deleted', { boardId: board._id });
    res.status(200).json({ message: 'Board deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete board', details: error.message });
  }
};

// Invite an existing registered user onto the board
exports.addMember = async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const board = req.board; // set by requireBoardAdmin

    const targetUser = await User.findOne({ email });
    if (!targetUser) return res.status(404).json({ error: 'No registered user with that email' });

    const alreadyMember = board.members.find(m => m.user.toString() === targetUser._id.toString());
    if (alreadyMember) {
      alreadyMember.role = role === 'Admin' ? 'Admin' : 'Viewer';
    } else {
      board.members.push({ user: targetUser._id, role: role === 'Admin' ? 'Admin' : 'Viewer' });
    }

    await board.save();
    await board.populate('members.user', 'username email');
    emitToBoard(req, board._id, 'board:updated', { board });
    res.status(200).json({ message: 'Member added successfully', board });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add member', details: error.message });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const { userId } = req.params;
    const board = req.board; // set by requireBoardAdmin

    board.members = board.members.filter(m => m.user.toString() !== userId);

    await board.save();
    await board.populate('members.user', 'username email');
    emitToBoard(req, board._id, 'board:updated', { board });
    res.status(200).json({ message: 'Member removed successfully', board });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove member', details: error.message });
  }
};
