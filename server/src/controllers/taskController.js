const Task = require('../models/Task');
const User = require('../models/User');
const Board = require('../models/Board');
const cloudinary = require('../config/cloudinary');
const { assertListInBoard, assertTaskInBoard, canEditTask } = require('../services/permissions');

// Broadcasts to everyone currently viewing this board; a no-op if sockets
// never initialized (e.g. during tests), so callers don't need to guard.
function emitToBoard(req, boardId, event, payload) {
  const io = req.app.get('io');
  if (io) io.to(`board:${boardId}`).emit(event, payload);
}

exports.createTask = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { title, description, listId, order } = req.body;

    if (!listId) return res.status(400).json({ error: 'listId is required' });

    // Make sure the destination list actually belongs to this board.
    const list = await assertListInBoard(listId, boardId);
    if (!list) return res.status(404).json({ error: 'List not found on this board' });

    const newTask = new Task({ title, description, listId, order });
    await newTask.save();

    emitToBoard(req, boardId, 'task:created', { task: newTask, listId });
    res.status(201).json({ message: 'Task created successfully', task: newTask });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task', details: error.message });
  }
};

// Route-level middleware only checks board Admin/Owner; a task-specific
// Editor share also needs write access, so that check happens here where we
// already have the individual task loaded.
exports.updateTask = async (req, res) => {
  try {
    const { boardId, taskId } = req.params;
    // We expect the frontend to send the current __v it has, for optimistic concurrency control
    const { title, description, order, listId, __v } = req.body;

    const board = await Board.findById(boardId);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const found = await assertTaskInBoard(taskId, boardId);
    if (!found) return res.status(404).json({ error: 'Task not found on this board' });
    const { task } = found;

    if (!canEditTask(task, board, req.user.id)) {
      return res.status(403).json({ error: 'Forbidden: you do not have edit access to this task.' });
    }

    // Explicit OCC check: the client's copy must match what's currently stored,
    // otherwise someone else edited this task since the client last loaded it.
    if (__v !== undefined && task.__v !== __v) {
      return res.status(409).json({
        error: 'Another user has updated this task. Please refresh to see their changes.'
      });
    }

    // If the task is moving to a different list, that list must belong to the same board too.
    if (listId && listId !== task.listId.toString()) {
      const destinationList = await assertListInBoard(listId, boardId);
      if (!destinationList) return res.status(404).json({ error: 'Destination list not found on this board' });
      task.listId = listId;
    }

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (order !== undefined) task.order = order;

    // Triggers Mongoose's own version check as a secondary guard against the
    // (very short) race between the assertTaskInBoard read above and this save.
    await task.save();

    emitToBoard(req, boardId, 'task:updated', { task });
    res.status(200).json({ message: 'Task updated successfully', task });
  } catch (error) {
    if (error.name === 'VersionError') {
      return res.status(409).json({
        error: 'Another user has updated this task. Please refresh to see their changes.'
      });
    }
    res.status(500).json({ error: 'Failed to update task', details: error.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const { boardId, taskId } = req.params;

    const found = await assertTaskInBoard(taskId, boardId);
    if (!found) return res.status(404).json({ error: 'Task not found on this board' });

    await Task.findByIdAndDelete(taskId);

    emitToBoard(req, boardId, 'task:deleted', { taskId, listId: found.list._id });
    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task', details: error.message });
  }
};

// Invite an existing registered user onto a single task
exports.shareTask = async (req, res) => {
  try {
    const { boardId, taskId } = req.params;
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const found = await assertTaskInBoard(taskId, boardId);
    if (!found) return res.status(404).json({ error: 'Task not found on this board' });
    const { task } = found;

    const targetUser = await User.findOne({ email });
    if (!targetUser) return res.status(404).json({ error: 'No registered user with that email' });

    const existing = task.sharedWith.find(s => s.user.toString() === targetUser._id.toString());
    if (existing) {
      existing.role = role === 'Editor' ? 'Editor' : 'Viewer';
    } else {
      task.sharedWith.push({ user: targetUser._id, role: role === 'Editor' ? 'Editor' : 'Viewer' });
    }

    await task.save();
    await task.populate('sharedWith.user', 'username email');
    emitToBoard(req, boardId, 'task:updated', { task });
    res.status(200).json({ message: 'Task shared successfully', task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to share task', details: error.message });
  }
};

exports.unshareTask = async (req, res) => {
  try {
    const { boardId, taskId, userId } = req.params;

    const found = await assertTaskInBoard(taskId, boardId);
    if (!found) return res.status(404).json({ error: 'Task not found on this board' });
    const { task } = found;

    task.sharedWith = task.sharedWith.filter(s => s.user.toString() !== userId);

    await task.save();
    await task.populate('sharedWith.user', 'username email');
    emitToBoard(req, boardId, 'task:updated', { task });
    res.status(200).json({ message: 'Task unshared successfully', task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unshare task', details: error.message });
  }
};

// Streams the uploaded file straight to Cloudinary (never touches local
// disk) and stores the resulting URL on the task.
exports.uploadAttachment = async (req, res) => {
  try {
    const { boardId, taskId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const found = await assertTaskInBoard(taskId, boardId);
    if (!found) return res.status(404).json({ error: 'Task not found on this board' });
    const { task } = found;

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder: 'task-board' },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    task.attachmentUrl = uploadResult.secure_url;
    await task.save();
    await task.populate('sharedWith.user', 'username email');

    emitToBoard(req, boardId, 'task:updated', { task });
    res.status(200).json({ message: 'Attachment uploaded successfully', task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload attachment', details: error.message });
  }
};
