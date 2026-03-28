// API configuration - uses environment variable or falls back to local proxy
export const API_URL = import.meta.env.VITE_API_URL || '';

// Helper to build API URLs
export const apiUrl = (path: string) => {
  // In production, prepend the API URL
  if (API_URL) {
    return `${API_URL}${path}`;
  }
  // In development, use the proxy (no prefix)
  return path;
};
