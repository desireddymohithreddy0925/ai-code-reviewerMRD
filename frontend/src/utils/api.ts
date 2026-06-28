const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
let sessionRequest: Promise<void> | null = null;
let csrfToken: string | null = null;

const ensureApiSession = async () => {
  if (!sessionRequest) {
    sessionRequest = fetch(`${API_BASE_URL}/api/session`, {
      method: "POST",
      credentials: "include",
    }).then(async (response) => {
      if (response.status === 401) {
        const apiKey = window.prompt("Enter the RepoSage backend API key:");
        if (!apiKey) {
          throw new Error("Backend API key is required to continue.");
        }

        const loginResponse = await fetch(`${API_BASE_URL}/api/session`, {
          method: "POST",
          credentials: "include",
          headers: {
            "x-api-key": apiKey,
          },
        });

        if (!loginResponse.ok) {
          throw new Error("Invalid backend API key.");
        }
        const loginData = await loginResponse.json();
        if (loginData.csrfToken) {
          csrfToken = loginData.csrfToken;
        }
        return;
      }

      if (!response.ok) {
        throw new Error("Could not initialize a secure API session.");
      }
      const data = await response.json();
      if (data.csrfToken) {
        csrfToken = data.csrfToken;
      }
    }).catch((error) => {
      sessionRequest = null;
      throw error;
    });
  }

  return sessionRequest;
};

const getCsrfToken = (): string | null => {
  if (csrfToken) return csrfToken;
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match ? match[1] : null;
};

export const apiFetch = async (path: string, options: RequestInit = {}, timeoutMs = 60000) => {
  await ensureApiSession();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const method = (options.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const token = getCsrfToken();
    if (token) {
      headers.set("X-CSRF-Token", token);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds. Backend might be hanging.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
