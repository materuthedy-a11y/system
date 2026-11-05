import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Keep browser traffic same-origin. Next.js rewrites /api/v1 to the configured backend,
// so HttpOnly refresh cookies work without third-party cookies or browser-exposed API tokens.
export const API_URL = '/api/v1';

const LEGACY_ACCESS_TOKEN_KEY = 'genuine.accessToken';
const LEGACY_REFRESH_TOKEN_KEY = 'genuine.refreshToken';
const USER_KEY = 'genuine.user';
const AUTH_CHANNEL = 'mizania-auth';

let accessTokenInMemory: string | null = null;
let sessionExpiryInMemory: { idleExpiresAt: string | null; absoluteExpiresAt: string | null; idleTimeoutSeconds: number } = {
  idleExpiresAt: null,
  absoluteExpiresAt: null,
  idleTimeoutSeconds: 30 * 60,
};

type ApiEnvelope<T> = { data?: T; message?: string | string[] };

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  firstName: string;
  lastName: string;
  businessId: string;
  businessName?: string;
  roles: string[];
  permissions: string[];
  avatar?: string | null;
}

export interface ActiveAuthSession {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  absoluteExpiresAt: string;
  isCurrent: boolean;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  idleTimeoutSeconds: number;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  user: AuthUser;
}

type RetriableRequest = InternalAxiosRequestConfig & { _authRetry?: boolean };

export const tokenStorage = {
  readAccess: () => accessTokenInMemory,
  readSessionExpiry: () => sessionExpiryInMemory,
  readUser: () => {
    if (typeof window === 'undefined') return null;
    try {
      const value = localStorage.getItem(USER_KEY);
      return value ? (JSON.parse(value) as AuthUser) : null;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  },
  save(accessToken: string, user: AuthUser, session?: { idleExpiresAt: string; absoluteExpiresAt: string; idleTimeoutSeconds: number }) {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
    accessTokenInMemory = accessToken;
    sessionExpiryInMemory = {
      idleExpiresAt: session?.idleExpiresAt || null,
      absoluteExpiresAt: session?.absoluteExpiresAt || null,
      idleTimeoutSeconds: session?.idleTimeoutSeconds || 30 * 60,
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  updateAccess(accessToken: string) {
    accessTokenInMemory = accessToken;
  },
  updateTokens(accessToken: string, session: { idleExpiresAt: string; absoluteExpiresAt: string; idleTimeoutSeconds: number }) {
    accessTokenInMemory = accessToken;
    sessionExpiryInMemory = session;
  },
  updateUser(user: AuthUser) {
    if (typeof window !== 'undefined') localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  notifySessionEnded() {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.postMessage({ type: 'session-ended' });
    channel.close();
  },
  clear() {
    if (typeof window === 'undefined') return;
    accessTokenInMemory = null;
    sessionExpiryInMemory = { idleExpiresAt: null, absoluteExpiresAt: null, idleTimeoutSeconds: 30 * 60 };
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
    document.cookie = 'genuine-session=; Path=/; Max-Age=0; SameSite=Lax';
  },
};

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.readAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshInFlight: Promise<{ accessToken: string; expiresIn: number; idleTimeoutSeconds: number; idleExpiresAt: string; absoluteExpiresAt: string }> | null = null;

async function rotateRefreshToken(): Promise<{ accessToken: string; expiresIn: number; idleTimeoutSeconds: number; idleExpiresAt: string; absoluteExpiresAt: string }> {
  const rotate = async () => {
    const response = await apiClient.post<ApiEnvelope<{ accessToken: string; expiresIn: number; idleTimeoutSeconds: number; idleExpiresAt: string; absoluteExpiresAt: string }>>(
      '/auth/refresh',
      {},
    );
    const payload = response.data.data ?? (response.data as unknown as { accessToken: string; expiresIn: number; idleTimeoutSeconds: number; idleExpiresAt: string; absoluteExpiresAt: string });
    if (!payload?.accessToken || !payload.idleExpiresAt || !payload.absoluteExpiresAt || !payload.idleTimeoutSeconds) {
      throw new Error('Refresh response did not include session details');
    }
    tokenStorage.updateTokens(payload.accessToken, payload);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('genuine:token-refreshed', { detail: payload }));
    return payload;
  };

  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('genuine-auth-token-refresh', rotate);
  }
  return rotate();
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const original = error.config as RetriableRequest | undefined;
    const isAuthEntryRequest = /\/auth\/(login|register|refresh|forgot-password|reset-password)(\?|$)/.test(
      original?.url || '',
    );

    if (error.response?.status === 401 && original && !original._authRetry && !isAuthEntryRequest) {
      if (typeof window !== 'undefined') {
        original._authRetry = true;
        try {
          refreshInFlight ??= rotateRefreshToken().finally(() => {
            refreshInFlight = null;
          });
          const session = await refreshInFlight;
          original.headers.Authorization = `Bearer ${session.accessToken}`;
          return apiClient(original);
        } catch {
          tokenStorage.notifySessionEnded();
          tokenStorage.clear();
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.assign('/login?reason=session-expired');
          }
        }
      }
    }
    return Promise.reject(error);
  },
);

export function unwrap<T>(response: { data: ApiEnvelope<T> | T }): T {
  const body = response.data as ApiEnvelope<T>;
  return body && typeof body === 'object' && 'data' in body
    ? (body.data as T)
    : (body as T);
}

export function getApiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string' && message.trim()) return message;
    if (error.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
    if (!error.response) return 'Could not connect to the server. Check your connection and try again.';
  }
  return fallback;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  businessName: string;
  businessType: string;
}

export interface UserProfile extends AuthUser {
  phone?: string;
  avatar?: string;
}

export const authAPI = {
  async refreshSession() {
    return rotateRefreshToken();
  },
  async login(data: { email: string; password: string }) {
    return unwrap<AuthResponse>(await apiClient.post('/auth/login', data));
  },
  async register(data: RegisterRequest) {
    return unwrap<AuthResponse>(await apiClient.post('/auth/register', data));
  },
  async forgotPassword(email: string) {
    return unwrap<{ message: string }>(await apiClient.post('/auth/forgot-password', { email }));
  },
  async resetPassword(token: string, newPassword: string) {
    return unwrap<{ message: string }>(await apiClient.post('/auth/reset-password', { token, newPassword }));
  },
  async changePassword(currentPassword: string, newPassword: string) {
    return unwrap<{ message: string }>(await apiClient.patch('/auth/change-password', { currentPassword, newPassword }));
  },
  async getProfile() {
    return unwrap<UserProfile>(await apiClient.get('/auth/me'));
  },
  async updateAvatar(avatar: string) {
    return unwrap<{ avatar: string | null }>(await apiClient.patch('/auth/profile/avatar', { avatar }));
  },
  async getAvatar() {
    return (await apiClient.get('/auth/profile/avatar', { responseType: 'blob' })).data as Blob;
  },
  async logout() {
    return unwrap<{ message: string }>(await apiClient.post('/auth/logout', {}));
  },
  async listSessions() {
    return unwrap<ActiveAuthSession[]>(await apiClient.get('/auth/sessions'));
  },
  async revokeSession(sessionId: string) {
    return unwrap<{ message: string }>(await apiClient.delete(`/auth/sessions/${encodeURIComponent(sessionId)}`));
  },
};
