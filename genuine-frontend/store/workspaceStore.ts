import { create } from 'zustand';
import type { WorkspaceLocation } from '@/lib/api/workspace';

interface WorkspaceState {
  activeLocation: WorkspaceLocation | null;
  setActiveLocation: (location: WorkspaceLocation, businessId: string, userId: string) => void;
  clearActiveLocation: () => void;
}

const storageKey = (businessId: string, userId: string) => `genuine.activeLocation.${businessId}.${userId}`;

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeLocation: null,
  setActiveLocation: (location, businessId, userId) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(storageKey(businessId, userId), location.id);
    set({ activeLocation: location });
  },
  clearActiveLocation: () => set({ activeLocation: null }),
}));

export function readSavedLocationId(businessId: string, userId: string) {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(storageKey(businessId, userId));
}
