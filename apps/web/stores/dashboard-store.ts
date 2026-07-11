import { create } from "zustand";

interface DashboardState {
  activeHref: string;
  acknowledgedTasks: string[];
  notificationCount: number;
  message: string | null;
  navigate: (href: string) => void;
  acknowledgeTask: (title: string) => void;
  clearNotifications: () => void;
  showMessage: (message: string) => void;
  clearMessage: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  activeHref: "#",
  acknowledgedTasks: [],
  notificationCount: 1,
  message: null,
  navigate: (href) => set({ activeHref: href }),
  acknowledgeTask: (title) =>
    set((state) => ({
      acknowledgedTasks: state.acknowledgedTasks.includes(title)
        ? state.acknowledgedTasks
        : [...state.acknowledgedTasks, title],
      message: `“${title}” marked as reviewed.`,
    })),
  clearNotifications: () => set({ notificationCount: 0 }),
  showMessage: (message) => set({ message }),
  clearMessage: () => set({ message: null }),
}));
