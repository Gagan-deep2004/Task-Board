const List = require('../models/List');
const Task = require('../models/Task');
const { assertListInBoard } = require('../services/permissions');

function emitToBoard(req, boardId, event, payload) {
  const io = req.app.get('io');
  if (io) io.to(`board:${boardId}`).emit(event, payload);
}

exports.createList = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const count = await List.countDocuments({ boardId });
    const newList = new List({ title, boardId, order: count });
    await newList.save();

    emitToBoard(req, boardId, 'list:created', { list: newList });
    res.status(201).json({ message: 'List created successfully', list: newList });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create list', details: error.message });
  }
};

// Rename and/or reorder a single list
exports.updateList = async (req, res) => {
  try {
    const { boardId, listId } = req.params;
    const { title, order } = req.body;

    const list = await assertListInBoard(listId, boardId);
    if (!list) return res.status(404).json({ error: 'List not found on this board' });

    if (title !== undefined) list.title = title;
    if (order !== undefined) list.order = order;

    await list.save();
    emitToBoard(req, boardId, 'list:updated', { list });
    res.status(200).json({ message: 'List updated successfully', list });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update list', details: error.message });
  }
};

// Delete a list and its tasks
exports.deleteList = async (req, res) => {
  try {
    const { boardId, listId } = req.params;

    const list = await assertListInBoard(listId, boardId);
    if (!list) return res.status(404).json({ error: 'List not found on this board' });

    await Task.deleteMany({ listId });
    await List.findByIdAndDelete(listId);

    emitToBoard(req, boardId, 'list:deleted', { listId });
    res.status(200).json({ message: 'List deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete list', details: error.message });
  }
};
