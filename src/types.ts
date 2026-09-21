export type ResolutionOption = "4k" | "1080p" | "720p" | "480p" | "auto";
export type StreamPreset = "game" | "movie" | "reading" | "screen";

export interface ScreenConfig {
  resolution: ResolutionOption;
  preset: StreamPreset;
  fps: number;
  bitrateKbps: number;
}

export interface Participant {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl?: string;
  role: "admin" | "participant";
  isMuted: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: "admin" | "participant" | "system";
  text: string;
  timestamp: number;
  type: "chat" | "system" | "moderation";
}

export interface RoomState {
  id: string;
  name: string;
  hostId: string;
  isLocked: boolean;
  allowParticipantScreenShare: boolean;
  activeScreenSharerId: string | null;
  activeScreenConfig: ScreenConfig | null;
  participants: Participant[];
  chatMessages: ChatMessage[];
  bannedCount: number;
  createdAt: number;
}

export interface StreamMetrics {
  fps: number;
  width: number;
  height: number;
  bitrateKbps: number;
  latencyMs: number;
  packetsLost: number;
  jitterMs: number;
  codec: string;
}

export interface UserProfile {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl?: string;
  preferredMicId: string;
  preferredResolution: ResolutionOption;
  preferredPreset: StreamPreset;
}

export interface SessionHistoryItem {
  id: string;
  roomId: string;
  roomName: string;
  joinedAt: number;
  leftAt: number;
  durationSeconds: number;
  role: "admin" | "participant";
  maxParticipants: number;
  streamQualityUsed?: string;
}
