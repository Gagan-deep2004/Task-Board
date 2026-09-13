import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useBoardStore } from '../store/useBoardStore';

export default function TaskEditModal({ boardId, canManageSharing, canEditTaskFn }) {
  const { activeTask, isEditModalOpen, closeEditModal } = useBoardStore();
  const canEditContent = activeTask ? (canEditTaskFn ? canEditTaskFn(activeTask) : canManageSharing) : false;
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('Viewer');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (activeTask) {
      setTitle(activeTask.title || '');
      setDescription(activeTask.description || '');
      setError(null);
      setShareEmail('');
    }
  }, [activeTask?._id]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['board', boardId] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await api.put(`/boards/${boardId}/tasks/${activeTask._id}`, {
        title,
        description,
        __v: activeTask.__v,
      });
      return response.data;
    },
    onSuccess: () => {
      invalidate();
      closeEditModal();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to save task'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/boards/${boardId}/tasks/${activeTask._id}`);
    },
    onSuccess: () => {
      invalidate();
      closeEditModal();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to delete task'),
  });

  const shareMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/boards/${boardId}/tasks/${activeTask._id}/share`, {
        email: shareEmail.trim(),
        role: shareRole,
      });
      return response.data;
    },
    onSuccess: (data) => {
      useBoardStore.setState({ activeTask: data.task });
      setShareEmail('');
      invalidate();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to share task'),
  });

  const unshareMutation = useMutation({
    mutationFn: async (userId) => {
      const response = await api.delete(`/boards/${boardId}/tasks/${activeTask._id}/share/${userId}`);
      return response.data;
    },
    onSuccess: (data) => {
      useBoardStore.setState({ activeTask: data.task });
      invalidate();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to remove share'),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post(
        `/boards/${boardId}/tasks/${activeTask._id}/attachment`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    },
    onSuccess: (data) => {
      useBoardStore.setState({ activeTask: data.task });
      invalidate();
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to upload attachment'),
  });

  if (!isEditModalOpen || !activeTask) return null;

  return (
    <div className="modal-backdrop" onClick={closeEditModal}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Task Details</h3>
        {error && <p className="modal-error">{error}</p>}

        <label className="modal-label">Title</label>
        <input
          className="input-field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!canEditContent}
        />

        <label className="modal-label">Description</label>
        <textarea
          className="input-field"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={!canEditContent}
        />

        <div className="modal-section">
          <label className="modal-label">Attachment</label>
          {activeTask.attachmentUrl ? (
            <a href={activeTask.attachmentUrl} target="_blank" rel="noreferrer" className="attachment-link">
              View current attachment
            </a>
          ) : (
            <p className="muted">No attachment yet.</p>
          )}
          {canManageSharing && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadMutation.mutate(file);
                  e.target.value = '';
                }}
              />
              <button
                className="btn-small"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Upload File'}
              </button>
            </>
          )}
        </div>

        <div className="modal-actions">
          {canEditContent && (
            <button className="btn-small btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          )}
          <button className="btn-small" onClick={closeEditModal}>Close</button>
        </div>

        {canManageSharing && (
          <div className="modal-section">
            <h4>Shared With</h4>
            {(!activeTask.sharedWith || activeTask.sharedWith.length === 0) && (
              <p className="muted">Not shared with anyone yet.</p>
            )}
            <ul className="share-list">
              {activeTask.sharedWith?.map((s) => (
                <li key={s._id || s.user?._id}>
                  <span>{s.user?.username || s.user?.email} &middot; {s.role}</span>
                  <button className="icon-btn" onClick={() => unshareMutation.mutate(s.user?._id)} title="Remove access">
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="share-form">
              <input
                type="email"
                placeholder="teammate@example.com"
                className="input-field"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
              />
              <select value={shareRole} onChange={(e) => setShareRole(e.target.value)}>
                <option value="Viewer">Viewer</option>
                <option value="Editor">Editor</option>
              </select>
              <button
                className="btn-small btn-primary"
                onClick={() => shareEmail.trim() && shareMutation.mutate()}
                disabled={shareMutation.isPending}
              >
                Share
              </button>
            </div>
          </div>
        )}

        {canManageSharing && (
          <div className="modal-section">
            <button className="btn-small btn-danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              Delete Task
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
