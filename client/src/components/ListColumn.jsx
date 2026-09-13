import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TaskCard from './TaskCard';

export default function ListColumn({
  list,
  canWrite,
  canOpenTask,
  onOpenTask,
  onAddTask,
  onRenameList,
  onDeleteList,
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list._id,
    data: { type: 'list' },
    disabled: !canWrite,
  });

  // Separate droppable for the task area, so dropping on empty space still
  // registers this list as the destination even with no tasks to land on.
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `list-drop-${list._id}`,
    data: { type: 'list', listId: list._id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const taskIds = list.tasks?.map((t) => t._id) || [];

  const submitAdd = () => {
    if (!taskTitle.trim()) return;
    onAddTask(list._id, taskTitle.trim());
    setTaskTitle('');
    setIsAdding(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="list-column">
      <div className="list-column-header">
        {canWrite && (
          <span className="list-drag-handle" {...attributes} {...listeners} title="Drag to reorder">
            ⠿
          </span>
        )}
        <h3>{list.title}</h3>
        {canWrite && (
          <div className="list-header-actions">
            <button className="icon-btn" onClick={() => onRenameList(list)} title="Rename list">
              ✎
            </button>
            <button className="icon-btn" onClick={() => onDeleteList(list)} title="Delete list">
              ×
            </button>
          </div>
        )}
      </div>

      <div ref={setDroppableRef} className="list-tasks">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {list.tasks?.length === 0 ? (
            <p className="list-empty-hint">No tasks yet</p>
          ) : (
            list.tasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                listId={list._id}
                canDrag={canWrite}
                canOpen={canOpenTask}
                onOpen={onOpenTask}
              />
            ))
          )}
        </SortableContext>
      </div>

      {canWrite && (
        isAdding ? (
          <div className="add-task-form">
            <input
              type="text"
              placeholder="Enter task title..."
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
              autoFocus
            />
            <div className="add-task-actions">
              <button className="btn-small btn-primary" onClick={submitAdd}>Save</button>
              <button className="btn-small" onClick={() => { setIsAdding(false); setTaskTitle(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="add-task-trigger" onClick={() => setIsAdding(true)}>+ Add Task</button>
        )
      )}
    </div>
  );
}
