import { UserProfile, SessionHistoryItem, ResolutionOption, StreamPreset } from "../types";

const PROFILE_KEY = "streamcast_user_profile";
const HISTORY_KEY = "streamcast_session_history";

const AVATAR_COLORS = [
  "#6366f1", // Indigo
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#ec4899", // Pink
  "#8b5cf6", // Purple
];

export function getRandomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}

  const defaultId = `usr-${Math.random().toString(36).substring(2, 8)}`;
  const defaultProfile: UserProfile = {
    id: defaultId,
    name: `Usuário ${Math.floor(100 + Math.random() * 900)}`,
    avatarColor: getRandomAvatarColor(),
    preferredMicId: "default",
    preferredResolution: "1080p",
    preferredPreset: "game",
  };

  saveUserProfile(defaultProfile);
  return defaultProfile;
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {}
}

export function loadSessionHistory(): SessionHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [];
}

export function addSessionToHistory(session: Omit<SessionHistoryItem, "id">): void {
  try {
    const history = loadSessionHistory();
    const item: SessionHistoryItem = {
      ...session,
      id: `hist-${Date.now()}`,
    };
    // Keep last 30 sessions
    const updated = [item, ...history.filter((h) => h.roomId !== session.roomId)].slice(0, 30);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {}
}

export function clearSessionHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {}
}
