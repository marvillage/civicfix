import axios from "axios";
import { clearToken, getToken } from "../lib/session";

// Set VITE_API_URL in the hosting provider, e.g.
// https://fixity-api.onrender.com  (no trailing slash)
export const API_ORIGIN =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

// Demo mode (VITE_DEMO=1): every request is answered from recorded
// sample data in src/demo, so no backend is needed. The demo code is
// only downloaded when the flag is on.
export const DEMO_MODE = import.meta.env.VITE_DEMO === "1";

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
});

if (DEMO_MODE) {
  api.defaults.adapter = async (config) => {
    const { demoAdapter } = await import(
      "../demo/demoAdapter.js"
    );

    return demoAdapter(config);
  };
}

// Public link for an issue. The API serves a share page with link
// preview tags; the static demo links straight to the issue page.
export function issueShareUrl(issueId) {
  return DEMO_MODE
    ? `${window.location.origin}/issues/${issueId}`
    : `${API_ORIGIN}/share/issue/${issueId}`;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";

    const isAuthAttempt =
      url.includes("/auth/login") ||
      url.includes("/auth/register");

    if (status === 401 && !isAuthAttempt) {
      clearToken();

      if (
        window.location.pathname !== "/login"
      ) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

api.interceptors.request.use(
  (config) => {
    const token = getToken();

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    // Let Axios/browser automatically set
    // multipart/form-data with the correct boundary
    if (!(config.data instanceof FormData)) {
      config.headers["Content-Type"] =
        "application/json";
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;