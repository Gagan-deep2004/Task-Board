const express = require('express');
const router = express.Router();

const verifyToken = require('../middlewares/verifyToken');
const requireBoardAdmin = require('../middlewares/requireBoardAdmin');
const upload = require('../config/upload');

const {
  getAllBoards, createBoard, getBoard, updateBoard, deleteBoard,
  addMember, removeMember
} = require('../controllers/boardController');

const {
  createTask, updateTask, deleteTask, shareTask, unshareTask, uploadAttachment
} = require('../controllers/taskController');

const {
  createList, updateList, deleteList
} = require('../controllers/listController');

// Boards
router.get('/', verifyToken, getAllBoards);
router.post('/', verifyToken, createBoard);
router.get('/:id', verifyToken, getBoard);
router.put('/:id', verifyToken, requireBoardAdmin, updateBoard);
router.delete('/:id', verifyToken, requireBoardAdmin, deleteBoard);

// Members (Admin/Owner only)
router.post('/:id/members', verifyToken, requireBoardAdmin, addMember);
router.delete('/:id/members/:userId', verifyToken, requireBoardAdmin, removeMember);

// Lists (Admin/Owner only)
router.post('/:boardId/lists', verifyToken, requireBoardAdmin, createList);
router.put('/:boardId/lists/:listId', verifyToken, requireBoardAdmin, updateList);
router.delete('/:boardId/lists/:listId', verifyToken, requireBoardAdmin, deleteList);

// Tasks (Admin/Owner only, except updateTask which also allows a per-task
// Editor share - see taskController.updateTask for that check)
router.post('/:boardId/tasks', verifyToken, requireBoardAdmin, createTask);
router.put('/:boardId/tasks/:taskId', verifyToken, updateTask);
router.delete('/:boardId/tasks/:taskId', verifyToken, requireBoardAdmin, deleteTask);
router.post('/:boardId/tasks/:taskId/share', verifyToken, requireBoardAdmin, shareTask);
router.delete('/:boardId/tasks/:taskId/share/:userId', verifyToken, requireBoardAdmin, unshareTask);
router.post(
  '/:boardId/tasks/:taskId/attachment',
  verifyToken,
  requireBoardAdmin,
  upload.single('file'),
  uploadAttachment
);

module.exports = router;
