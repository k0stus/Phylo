// Replace with your deployed Worker URL
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://phylo-server.your-subdomain.workers.dev';

export const WS_BASE_URL = API_BASE_URL.replace(/^https?:\/\//, (s) =>
  s.startsWith('https') ? 'wss://' : 'ws://'
);
