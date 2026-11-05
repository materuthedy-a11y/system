import { create } from 'zustand';
import { authAPI, AuthUser, getApiError, RegisterRequest, tokenStorage } from '@/lib/api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  idleExpiresAt: string | null;
  absoluteExpiresAt: string | null;
  idleTimeoutSeconds: number;
  error: string | null;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  expireSession: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  clearError: () => void;
  syncToken: () => void;
  updateUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  idleExpiresAt: null,
  absoluteExpiresAt: null,
  idleTimeoutSeconds: 30 * 60,
  error: null,

  initialize: async () => {
    const savedUser = tokenStorage.readUser();
    set({ status: 'loading', accessToken: tokenStorage.readAccess(), error: null });
    try {
      let accessToken = tokenStorage.readAccess();
      if (!accessToken) {
        const session = await authAPI.refreshSession();
        tokenStorage.updateTokens(session.accessToken, session);
        accessToken = session.accessToken;
      }
      const profile = await authAPI.getProfile();
      const current = savedUser || useAuthStore.getState().user;
      const sessionExpiry = tokenStorage.readSessionExpiry();
      set({
        status: 'authenticated',
        accessToken,
        idleExpiresAt: sessionExpiry.idleExpiresAt,
        absoluteExpiresAt: sessionExpiry.absoluteExpiresAt,
        idleTimeoutSeconds: sessionExpiry.idleTimeoutSeconds,
        user: { ...current, ...profile, businessName: profile.businessName || current?.businessName },
      });
    } catch {
      tokenStorage.clear();
      set({ status: 'anonymous', user: null, accessToken: null, idleExpiresAt: null, absoluteExpiresAt: null, idleTimeoutSeconds: 30 * 60, error: null });
    }
  },

  login: async (email, password) => {
    set({ status: 'loading', error: null });
    try {
      const result = await authAPI.login({ email: email.trim(), password });
      tokenStorage.save(result.accessToken, result.user, result);
      set({ status: 'authenticated', user: result.user, accessToken: result.accessToken, idleExpiresAt: result.idleExpiresAt, absoluteExpiresAt: result.absoluteExpiresAt, idleTimeoutSeconds: result.idleTimeoutSeconds, error: null });
    } catch (error) {
      const message = getApiError(error, 'Sign in failed. Check your details and try again.');
      set({ status: 'anonymous', error: message });
      throw new Error(message);
    }
  },

  register: async (input) => {
    set({ status: 'loading', error: null });
    try {
      const result = await authAPI.register(input);
      tokenStorage.save(result.accessToken, result.user, result);
      set({ status: 'authenticated', user: result.user, accessToken: result.accessToken, idleExpiresAt: result.idleExpiresAt, absoluteExpiresAt: result.absoluteExpiresAt, idleTimeoutSeconds: result.idleTimeoutSeconds, error: null });
    } catch (error) {
      const message = getApiError(error, 'We could not create your account. Please try again.');
      set({ status: 'anonymous', error: message });
      throw new Error(message);
    }
  },

  logout: async () => {
    try {
      if (tokenStorage.readAccess()) await authAPI.logout();
    } catch {
      // Local sign out still completes if the API is unavailable or the session expired.
    } finally {
      tokenStorage.notifySessionEnded();
      tokenStorage.clear();
      set({ status: 'anonymous', user: null, accessToken: null, idleExpiresAt: null, absoluteExpiresAt: null, idleTimeoutSeconds: 30 * 60, error: null });
    }
  },

  expireSession: () => {
    tokenStorage.clear();
    set({ status: 'anonymous', user: null, accessToken: null, idleExpiresAt: null, absoluteExpiresAt: null, idleTimeoutSeconds: 30 * 60, error: null });
  },

  changePassword: async (currentPassword, newPassword) => {
    await authAPI.changePassword(currentPassword, newPassword);
    tokenStorage.notifySessionEnded();
    tokenStorage.clear();
    set({ status: 'anonymous', user: null, accessToken: null, idleExpiresAt: null, absoluteExpiresAt: null, idleTimeoutSeconds: 30 * 60, error: null });
  },

  clearError: () => set({ error: null }),
  syncToken: () => set({ accessToken: tokenStorage.readAccess(), ...tokenStorage.readSessionExpiry() }),
  updateUser: (user) => {
    tokenStorage.updateUser(user);
    set({ user });
  },
}));
