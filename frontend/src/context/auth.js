import { createContext, useContext } from "react";

// Auth state lives in <AuthProvider> (AuthContext.jsx); components
// read it with useAuth(): { user, loading, can, login, logout, … }.
export const AuthContext = createContext(null);

// Where each role lands after logging in.
export const HOME_BY_ROLE = {
  CITIZEN: "/citizen",
  AUTHORITY: "/authority",
  ADMIN: "/admin",
};

export function useAuth() {
  return useContext(AuthContext);
}
