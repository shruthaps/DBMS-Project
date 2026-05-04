import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Change this to your local IP when running on a physical device ──
export const BASE_URL = 'http://localhost:3000/api';

/** Returns headers with the stored JWT, or plain JSON headers if no token. */
export const authHeaders = async () => {
  const token = await AsyncStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

/** Thin wrapper around fetch that always resolves with { data, error }. */
export const apiFetch = async (path, options = {}) => {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${BASE_URL}${path}`, {
      headers,
      ...options,
      ...(options.body ? { body: JSON.stringify(options.body) } : {})
    });
    const data = await res.json();
    if (!res.ok) return { data: null, error: data.message || 'Something went wrong' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: 'Network error — is the server running?' };
  }
};
