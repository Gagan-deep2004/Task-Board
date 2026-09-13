import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useBoardStore } from '../store/useBoardStore';
import ListColumn from '../components/ListColumn';
import TaskCard from '../components/TaskCard';
import TaskEditModal from '../components/TaskEditModal';

function findTask(board, taskId) {
  for (const list of board.lists) {
    const task = list.tasks.find((t) => t._id === taskId);
    if (task) return { task, list };
  }
  return null;
}

export default function BoardView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openEditModal = useBoardStore((s) => s.openEditModal);
  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

  const [activeDrag, setActiveDrag] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Viewer');
  const [settingsError, setSettingsError] = useState(null);
  const [presentUsers, setPresentUsers] = useState([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: board, isLoading, isError } = useQuery({
    queryKey: ['board', id],
    queryFn: async () => {
      const response = await api.get(`/boards/${id}`);
      return response.data;
    },
  });

  const canWrite = board?.myRole === 'Owner' || board?.myRole === 'Admin';

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['board', id] });

  // ---- Real-time sync: join this board's room, refetch on any change ----
  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    socket.emit('join-board', id);

    const onBoardChange = () => invalidate();
    const onBoardDeleted = () => navigate('/dashboard');
    const onPresence = (users) => setPresentUsers(users);

    socket.on('task:created', onBoardChange);
    socket.on('task:updated', onBoardChange);
    socket.on('task:deleted', onBoardChange);
    socket.on('list:created', onBoardChange);
    socket.on('list:updated', onBoardChange);
    socket.on('list:deleted', onBoardChange);
    socket.on('board:updated', onBoardChange);
    socket.on('board:deleted', onBoardDeleted);
    socket.on('presence:update', onPresence);

    const heartbeat = setInterval(() => socket.emit('heartbeat'), 15000);

    return () => {
      clearInterval(heartbeat);
      socket.off('task:created', onBoardChange);
      socket.off('task:updated', onBoardChange);
      socket.off('task:deleted', onBoardChange);
      socket.off('list:created', onBoardChange);
      socket.off('list:updated', onBoardChange);
      socket.off('list:deleted', onBoardChange);
      socket.off('board:updated', onBoardChange);
      socket.off('board:deleted', onBoardDeleted);
      socket.off('presence:update', onPresence);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---- Board-level mutations ----
  const updateBoardMutation = useMutation({
    mutationFn: async (fields) => {
      const response = await api.put(`/boards/${id}`, fields);
      return response.data;
    },
    onSuccess: invalidate,
  });

  const deleteBoardMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/boards/${id}`);
    },
    onSuccess: () => navigate('/dashboard'),
  });

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/boards/${id}/members`, { email: inviteEmail.trim(), role: inviteRole });
      return response.data;
    },
    onSuccess: () => {
      setInviteEmail('');
      setSettingsError(null);
      invalidate();
    },
    onError: (err) => setSettingsError(err.response?.data?.error || 'Failed to add member'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId) => {
      await api.delete(`/boards/${id}/members/${userId}`);
    },
    onSuccess: invalidate,
  });

  // ---- List mutations ----
  const createListMutation = useMutation({
    mutationFn: async (title) => {
      const response = await api.post(`/boards/${id}/lists`, { title });
      return response.data;
    },
    onSuccess: () => {
      setNewListTitle('');
      setIsAddingList(false);
      invalidate();
    },
  });

  const renameListHandler = async (list) => {
    const title = prompt('Rename list:', list.title);
    if (!title || title === list.title) return;
    await api.put(`/boards/${id}/lists/${list._id}`, { title });
    invalidate();
  };

  const deleteListHandler = async (list) => {
    if (!window.confirm(`Delete "${list.title}" and all of its tasks?`)) return;
    await api.delete(`/boards/${id}/lists/${list._id}`);
    invalidate();
  };

  // ---- Task mutations ----
  const createTaskMutation = useMutation({
    mutationFn: async ({ listId, title }) => {
      const listTasks = board.lists.find((l) => l._id === listId)?.tasks || [];
      const response = await api.post(`/boards/${id}/tasks`, {
        title,
        listId,
        order: listTasks.length,
      });
      return response.data;
    },
    onSuccess: invalidate,
  });

  const canEditTask = (task) => {
    if (canWrite) return true;
    const share = task.sharedWith?.find((s) => (s.user?._id || s.user) === currentUser?.id);
    return share?.role === 'Editor';
  };

  const handleOpenTask = (task) => {
    openEditModal(task);
  };

  // ---- Drag and drop (Owner/Admin only) ----
  const handleDragStart = (event) => {
    const { active } = event;
    setActiveDrag({ ...active.data.current, id: active.id });
  };

  const handleDragCancel = () => setActiveDrag(null);

  const persistListOrder = async (orderedLists) => {
    await Promise.allSettled(
      orderedLists.map((list, index) =>
        list.order !== index ? api.put(`/boards/${id}/lists/${list._id}`, { order: index }) : Promise.resolve()
      )
    );
    invalidate();
  };

  const persistTaskMove = async (updatedLists, movedTaskId, destListId, sourceListId) => {
    const destList = updatedLists.find((l) => l._id === destListId);
    const sourceList = sourceListId !== destListId ? updatedLists.find((l) => l._id === sourceListId) : null;
    const requests = [];

    destList.tasks.forEach((t, index) => {
      if (t._id === movedTaskId) {
        requests.push(api.put(`/boards/${id}/tasks/${t._id}`, { order: index, listId: destListId }));
      } else if (t.order !== index) {
        requests.push(api.put(`/boards/${id}/tasks/${t._id}`, { order: index }));
      }
    });

    if (sourceList) {
      sourceList.tasks.forEach((t, index) => {
        if (t.order !== index) {
          requests.push(api.put(`/boards/${id}/tasks/${t._id}`, { order: index }));
        }
      });
    }

    await Promise.allSettled(requests);
    invalidate();
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDrag(null);
    if (!over || !board) return;

    const activeType = active.data.current?.type;

    if (activeType === 'list') {
      if (active.id === over.id) return;
      const oldIndex = board.lists.findIndex((l) => l._id === active.id);
      const newIndex = board.lists.findIndex((l) => l._id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(board.lists, oldIndex, newIndex);
      queryClient.setQueryData(['board', id], (old) => ({ ...old, lists: reordered }));
      persistListOrder(reordered);
      return;
    }

    if (activeType === 'task') {
      if (active.id === over.id) return;
      const sourceListId = active.data.current.listId;
      const overType = over.data.current?.type;
      const destListId = over.data.current?.listId;
      if (!destListId) return;

      const lists = board.lists.map((l) => ({ ...l, tasks: [...l.tasks] }));
      const sourceList = lists.find((l) => l._id === sourceListId);
      const destList = lists.find((l) => l._id === destListId);
      const sourceIndex = sourceList.tasks.findIndex((t) => t._id === active.id);
      const [movedTask] = sourceList.tasks.splice(sourceIndex, 1);

      let destIndex;
      if (overType === 'task') {
        destIndex = destList.tasks.findIndex((t) => t._id === over.id);
        if (destIndex === -1) destIndex = destList.tasks.length;
      } else {
        destIndex = destList.tasks.length;
      }
      destList.tasks.splice(destIndex, 0, movedTask);

      if (sourceListId === destListId && sourceIndex === destIndex) return;

      queryClient.setQueryData(['board', id], (old) => ({ ...old, lists }));
      persistTaskMove(lists, active.id, destListId, sourceListId);
    }
  };

  if (isLoading) return <div style={{ padding: '2rem' }}>Loading workspace...</div>;
  if (isError) return <div style={{ padding: '2rem', color: 'red' }}>Failed to load workspace.</div>;

  const listIds = board.lists.map((l) => l._id);
  const activeTaskPreview = activeDrag?.type === 'task' ? findTask(board, activeDrag.id) : null;

  return (
    <div className="board-view">
      <button className="back-link" onClick={() => navigate('/dashboard')}>&larr; Boards</button>

      {presentUsers.length > 0 && (
        <p className="presence-row">
          👀 Viewing now: {presentUsers.map((u) => u.username).join(', ')}
        </p>
      )}

      <div className="board-header">
        <h1>
          {board.title} <span className="board-tier-badge">({board.tier})</span>
        </h1>
        {canWrite && (
          <div className="board-header-actions">
            <button onClick={() => setShowSettings((s) => !s)}>Board Settings</button>
            <button
              className="btn-danger"
              onClick={() => window.confirm('Are you sure you want to delete this board?') && deleteBoardMutation.mutate()}
            >
              Delete Board
            </button>
          </div>
        )}
      </div>

      {canWrite && showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Board Settings</h3>
            {settingsError && <p className="modal-error">{settingsError}</p>}

            <label className="modal-label">Visibility</label>
            <select
              className="visibility-select"
              value={board.tier}
              onChange={(e) => updateBoardMutation.mutate({ tier: e.target.value })}
            >
              <option value="Private">Private</option>
              <option value="Shared">Shared</option>
              <option value="Public">Public</option>
            </select>

            <div className="modal-section">
              <h4>Members</h4>
              <ul className="share-list">
                {board.members.map((m) => (
                  <li key={m._id}>
                    <span>{m.user?.username || m.user?.email} &middot; {m.role}</span>
                    {m.user?._id !== board.owner && (
                      <button className="icon-btn" onClick={() => removeMemberMutation.mutate(m.user._id)} title="Remove">×</button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="share-form">
                <input
                  type="email"
                  placeholder="teammate@example.com"
                  className="input-field"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="Viewer">Viewer</option>
                  <option value="Admin">Admin</option>
                </select>
                <button
                  className="btn-small btn-primary"
                  onClick={() => inviteEmail.trim() && addMemberMutation.mutate()}
                  disabled={addMemberMutation.isPending}
                >
                  Invite
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-small" onClick={() => setShowSettings(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={listIds} strategy={rectSortingStrategy}>
          <div className="board-lists">
            {board.lists.map((list) => (
              <ListColumn
                key={list._id}
                list={list}
                canWrite={canWrite}
                canOpenTask={true}
                onOpenTask={handleOpenTask}
                onAddTask={(listId, title) => createTaskMutation.mutate({ listId, title })}
                onRenameList={renameListHandler}
                onDeleteList={deleteListHandler}
              />
            ))}

            {canWrite && (
              <div className="list-column add-list-column">
                {isAddingList ? (
                  <div className="add-task-form">
                    <input
                      type="text"
                      placeholder="List title..."
                      value={newListTitle}
                      onChange={(e) => setNewListTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && newListTitle.trim() && createListMutation.mutate(newListTitle.trim())}
                      autoFocus
                    />
                    <div className="add-task-actions">
                      <button
                        className="btn-small btn-primary"
                        onClick={() => newListTitle.trim() && createListMutation.mutate(newListTitle.trim())}
                      >
                        Save
                      </button>
                      <button className="btn-small" onClick={() => { setIsAddingList(false); setNewListTitle(''); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="add-task-trigger" onClick={() => setIsAddingList(true)}>+ Add List</button>
                )}
              </div>
            )}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeTaskPreview ? (
            <TaskCard task={activeTaskPreview.task} listId={activeTaskPreview.list._id} canDrag={false} canOpen={false} onOpen={() => {}} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskEditModal boardId={id} canManageSharing={canWrite} canEditTaskFn={canEditTask} />
    </div>
  );
}
