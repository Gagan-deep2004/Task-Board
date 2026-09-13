import { create } from 'zustand';

// Drives the task detail/edit modal in BoardView.
export const useBoardStore = create((set) => ({
  activeTask: null,
  isEditModalOpen: false,

  openEditModal: (task) => set({ activeTask: task, isEditModalOpen: true }),
  closeEditModal: () => set({ activeTask: null, isEditModalOpen: false }),
}));
