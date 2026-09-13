import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

  // React Query handles loading states, caching, and errors automatically
  const { data: boards, isLoading, isError } = useQuery({
    queryKey: ['boards'],
    queryFn: async () => {
      const response = await api.get('/boards');
      return response.data;
    },
  });

  const createBoardMutation = useMutation({
    mutationFn: async (title) => {
      const response = await api.post('/boards', { title });
      return response.data;
    },
    onSuccess: (newBoard) => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      navigate(`/board/${newBoard._id}`);
    },
  });

  const handleCreateBoard = () => {
    const title = prompt('Enter new board title:', 'My Kanban Board');
    if (title) createBoardMutation.mutate(title);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (isLoading) return <div className="dashboard-page"><p className="muted">Loading boards...</p></div>;
  if (isError) return <div className="dashboard-page"><p className="modal-error">Failed to load boards.</p></div>;

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Your Boards</h1>
        <button className="logout-link" onClick={handleLogout}>Logout</button>
      </div>

      {boards?.length === 0 ? (
        <p className="muted">No boards found. Create one below!</p>
      ) : (
        <div className="boards-grid">
          {boards?.map((board) => (
            <div key={board._id} className="board-card" onClick={() => navigate(`/board/${board._id}`)}>
              <h3>{board.title}</h3>
              <p className="board-card-meta">
                {board.tier} Board &bull; Owner: {board.owner === currentUser?.id ? 'You' : 'Other'}
              </p>
            </div>
          ))}

          <button
            className="board-card board-card-add"
            onClick={handleCreateBoard}
            disabled={createBoardMutation.isPending}
          >
            {createBoardMutation.isPending ? 'Creating...' : '+ Create New Board'}
          </button>
        </div>
      )}
    </div>
  );
}
