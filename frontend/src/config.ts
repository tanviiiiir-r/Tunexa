// API configuration - uses environment variable or falls back to local proxy
export const API_URL = import.meta.env.VITE_API_URL || '';

// Supabase configuration
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Helper to build API URLs
export const apiUrl = (path: string) => {
  // In production, prepend the API URL
  if (API_URL) {
    return `${API_URL}${path}`;
  }
  // In development, use the proxy (no prefix)
  return path;
};

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
};
