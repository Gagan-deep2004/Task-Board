const Board = require('../models/Board');
const { getBoardRole } = require('../services/permissions');

// Permission check: only the board's Owner or an Admin member may proceed.
// Boards are addressed as either :boardId (task/list sub-routes) or :id
// (board routes themselves) depending on which router this runs under.
module.exports = async function (req, res, next) {
  try {
    const boardId = req.params.boardId || req.params.id || req.body.boardId;
    const board = await Board.findById(boardId);

    if (!board) return res.status(404).json({ error: 'Board not found' });

    const role = getBoardRole(board, req.user.id);
    if (role !== 'Owner' && role !== 'Admin') {
      return res.status(403).json({ error: 'Forbidden: You do not have admin rights for this board.' });
    }

    // Stash so downstream controllers don't need to re-fetch the board.
    req.board = board;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authorization check failed' });
  }
};
