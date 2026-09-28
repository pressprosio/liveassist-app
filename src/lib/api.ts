/** REST calls to the hub (sign-in, password, devices). Live chat traffic goes over the socket. */
import type { Agent, NotifyPrefs } from './types';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Accepts "chat.presspros.io", "https://chat.presspros.io/", etc. */
export function normalizeHubUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, '');
}

export function socketUrl(hubUrl: string): string {
  return `${hubUrl.replace(/^http/i, 'ws')}/agent/ws`;
}

async function request<T>(hubUrl: string, path: string, init: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${hubUrl}${path}`, {
      method: init.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the hub. Check the address and your internet connection.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new ApiError(data?.error || `The hub returned an error (${res.status}).`, res.status);
  return data as T;
}

export const api = {
  login: (hubUrl: string, email: string, password: string) =>
    request<{ token: string; agent: Agent; push: boolean }>(hubUrl, '/agent/login', { method: 'POST', body: { email, password } }),

  me: (hubUrl: string, token: string) => request<{ agent: Agent }>(hubUrl, '/agent/me', { token }),

  changePassword: (hubUrl: string, token: string, current: string, next: string) =>
    request<{ token: string; agent: Agent }>(hubUrl, '/agent/password', {
      method: 'POST', token, body: { current_password: current, new_password: next },
    }),

  registerDevice: (hubUrl: string, token: string, pushToken: string, platform: string) =>
    request<{ ok: true }>(hubUrl, '/agent/devices', { method: 'POST', token, body: { token: pushToken, platform } }),

  removeDevice: (hubUrl: string, token: string, pushToken: string) =>
    request<{ ok: true }>(hubUrl, '/agent/devices', { method: 'DELETE', token, body: { token: pushToken } }),

  updateNotifications: (hubUrl: string, token: string, prefs: NotifyPrefs) =>
    request<{ agent: Agent }>(hubUrl, '/agent/notifications', { method: 'PUT', token, body: prefs }),

  testPush: (hubUrl: string, token: string) =>
    request<{ ok: true; devices: number }>(hubUrl, '/agent/devices/test', { method: 'POST', token, body: {} }),
};
