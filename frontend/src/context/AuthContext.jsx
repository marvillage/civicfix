import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import {
  clearToken,
  getToken,
  setToken,
} from "../lib/session";
import { AuthContext, HOME_BY_ROLE, useAuth } from "./auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!getToken());

  useEffect(() => {
    if (!getToken()) {
      return;
    }

    api
      .get("/auth/me")
      .then((response) => {
        setUser(response.data.user);
      })
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = useCallback((token, userData) => {
    setToken(token);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((current) =>
      current ? { ...current, ...patch } : current
    );
  }, []);

  // The server sends the user's effective permissions; the UI only
  // uses them to decide what to show. The API enforces them again.
  const can = useCallback(
    (permission) =>
      !!user?.permissions?.includes(permission),
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      updateUser,
      can,
      isAuthenticated: !!user,
      homePath: user ? HOME_BY_ROLE[user.role] || "/" : "/",
    }),
    [user, loading, login, logout, updateUser, can]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// <Can permission="bulletin:publish">…</Can>
export function Can({ permission, children, fallback = null }) {
  const { can } = useAuth();

  return can(permission) ? children : fallback;
}
