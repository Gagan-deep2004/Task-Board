const Board = require('../models/Board');
const List = require('../models/List');

const DEFAULT_LIST_TITLES = ['To Do', 'In Progress', 'Done'];

// Shared by the "create a board" flow and the new-user welcome-board seeder,
// so the default-lists logic only lives in one place.
async function createBoardWithDefaultLists({ ownerId, title, tier = 'Private' }) {
  const board = new Board({
    title: title || 'My New Workspace',
    owner: ownerId,
    tier,
    members: [{ user: ownerId, role: 'Admin' }],
  });
  await board.save();

  const lists = await List.insertMany(
    DEFAULT_LIST_TITLES.map((t, i) => ({ title: t, boardId: board._id, order: i }))
  );

  return { board, lists };
}

module.exports = { createBoardWithDefaultLists, DEFAULT_LIST_TITLES };
