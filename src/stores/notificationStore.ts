import { create } from 'zustand';

interface NotificationStore {
  unreadOrdersCount: number;
  setUnreadOrdersCount: (count: number) => void;
  clearUnreadOrdersCount: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  unreadOrdersCount: 0,
  setUnreadOrdersCount: (count: number) => set({ unreadOrdersCount: count }),
  clearUnreadOrdersCount: () => set({ unreadOrdersCount: 0 }),
}));

