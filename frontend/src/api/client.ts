const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    message: string,
    public readonly validationErrors: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorizedCallback(callback: () => void) {
  onUnauthorizedCallback = callback;
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem('erp_token');
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem('erp_token', token);
    } else {
      localStorage.removeItem('erp_token');
    }
  } catch {
    // Ignore localStorage access errors
  }
}

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
    let validationErrors: string[] = [];

    try {
      const errorBody = (await response.json()) as {
        message?: string | string[];
        error?: string;
        statusCode?: number;
      };

      if (Array.isArray(errorBody?.message)) {
        validationErrors = errorBody.message;
        errorMessage = errorBody.message.join(', ');
      } else if (typeof errorBody?.message === 'string') {
        errorMessage = errorBody.message;
      }
    } catch {
      // Non-JSON response
    }

    if (response.status === 401 && onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }

    throw new ApiError(response.status, response.statusText, errorMessage, validationErrors);
  }

  // Handle empty responses (like 204 No Content)
  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}
