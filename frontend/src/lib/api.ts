import { auth } from './firebase';
import type { ApiResponse, ApiError } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

/**
 * Custom error class that wraps API error responses.
 * Extends Error so that `err instanceof Error` checks work throughout the app,
 * while also preserving the structured ApiError payload.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly errorType: string;
  readonly detail: string;
  readonly apiError: ApiError;

  constructor(apiError: ApiError) {
    super(apiError.error.detail);
    this.name = 'ApiRequestError';
    this.status = apiError.error.status;
    this.errorType = apiError.error.type;
    this.detail = apiError.error.detail;
    this.apiError = apiError;
  }
}

class ApiClient {
  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE}${path}`, { headers: await this.getHeaders() });
    if (!res.ok) throw await this.handleError(res);
    return res.json();
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw await this.handleError(res);
    return res.json();
  }

  async put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: await this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await this.handleError(res);
    return res.json();
  }

  async delete(path: string): Promise<void> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });
    if (!res.ok) throw await this.handleError(res);
  }

  private async handleError(res: Response): Promise<ApiRequestError> {
    try {
      const body: ApiError = await res.json();
      return new ApiRequestError(body);
    } catch {
      return new ApiRequestError({
        error: { type: 'unknown', status: res.status, detail: res.statusText },
      });
    }
  }
}

export const api = new ApiClient();
