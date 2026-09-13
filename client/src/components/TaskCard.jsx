import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function TaskCard({ task, listId, canDrag, canOpen, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._id,
    data: { type: 'task', listId },
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="task-card"
      onClick={() => canOpen && onOpen(task)}
    >
      {canDrag && (
        <span
          className="task-drag-handle"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          title="Drag to move"
        >
          ⠿
        </span>
      )}
      <div className="task-card-body">
        <span className="task-card-title">{task.title}</span>
        {task.sharedWith?.length > 0 && (
          <span className="task-share-badge" title={`Shared with ${task.sharedWith.length} user(s)`}>
            👥 {task.sharedWith.length}
          </span>
        )}
        {task.attachmentUrl && <span className="task-attachment-badge" title="Has an attachment">📎</span>}
      </div>
    </div>
  );
}
