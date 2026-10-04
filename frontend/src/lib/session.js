import { STORAGE_KEYS } from "../brand";

// localStorage can throw (private mode, blocked storage), so every
// access goes through these helpers.

export function getToken() {
  try {
    return localStorage.getItem(STORAGE_KEYS.token);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(STORAGE_KEYS.token, token);
  } catch {
    // Session lasts until reload.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(STORAGE_KEYS.token);
  } catch {
    // Nothing stored.
  }
}

export function readPref(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preference not remembered; harmless.
  }
}
