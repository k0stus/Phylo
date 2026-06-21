/**
 * Handles deep links: phylo://battle/invite/CODE
 * Expo Router resolves these before navigation. We parse the path and
 * redirect to the Battle tab with the invite code as a param.
 */
export function redirectSystemPath({ path }: { path: string | null }) {
  if (!path) return '/';

  // phylo://battle/invite/ABC123
  const inviteMatch = path.match(/^\/battle\/invite\/([A-Z0-9]+)$/i);
  if (inviteMatch) {
    return `/(tabs)/battle?invite_code=${inviteMatch[1]}`;
  }

  return '/';
}
