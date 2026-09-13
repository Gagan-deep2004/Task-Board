const Task = require('../models/Task');
const { createBoardWithDefaultLists } = require('./boardFactory');

// [listIndex, title, description] - spread across To Do (0) / In Progress (1) / Done (2)
const WELCOME_TASKS = [
  [0, 'Welcome to your Task Board!', 'This is a sample task - click it to edit, share, or delete.'],
  [0, 'Try dragging this card to "In Progress"', ''],
  [1, 'Click "Share" on a task to invite a teammate', 'They will need an existing account.'],
  [1, 'Create your own list with "+ Add List"', ''],
  [2, "Delete this card when you're ready to start fresh", ''],
];

async function seedWelcomeBoard(userId) {
  const { lists } = await createBoardWithDefaultLists({ ownerId: userId, title: 'My First Board' });

  const orderByList = new Map();
  const tasks = WELCOME_TASKS.map(([listIndex, title, description]) => {
    const listId = lists[listIndex]._id;
    const order = orderByList.get(listIndex) || 0;
    orderByList.set(listIndex, order + 1);
    return { title, description, listId, order };
  });

  await Task.insertMany(tasks);
}

module.exports = { seedWelcomeBoard };
