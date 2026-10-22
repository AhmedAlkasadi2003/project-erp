const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
    try {
      const errorBody = (await response.json()) as { message?: string };
      if (errorBody?.message) {
        errorMessage = errorBody.message;
      }
    } catch {
      // Ignore json parsing error for non-json responses
    }
    throw new ApiError(response.status, response.statusText, errorMessage);
  }

  return (await response.json()) as T;
}
