import React, { useState } from "react";
import {
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Shield,
  Radio,
  UserX,
  Ban,
  Sliders,
  MoreVertical,
} from "lucide-react";
import { Participant, UserProfile } from "../types";
import { Avatar } from "./Avatar";

interface ParticipantsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  currentUser: UserProfile;
  isAdmin: boolean;
  activeSharerId: string | null;
  participantVolumes: Record<string, number>;
  participantMutes: Record<string, boolean>;
  onSetVolume: (participantId: string, volume: number) => void;
  onToggleParticipantMute: (participantId: string) => void;
  onKickParticipant: (targetId: string, name: string) => void;
  onBanParticipant: (targetId: string, name: string) => void;
  onForceMuteParticipant: (targetId: string) => void;
}

export const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({
  isOpen,
  onClose,
  participants,
  currentUser,
  isAdmin,
  activeSharerId,
  participantVolumes,
  participantMutes,
  onSetVolume,
  onToggleParticipantMute,
  onKickParticipant,
  onBanParticipant,
  onForceMuteParticipant,
}) => {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div
      id="participants-panel"
      className="w-full sm:w-80 md:w-96 h-full bg-zinc-950/95 backdrop-blur-xl flex flex-col z-30 fixed sm:relative right-0 top-0 shadow-2xl shadow-black/80"
    >
      {/* Panel Header */}
      <div className="h-16 px-4 flex items-center justify-between shadow-md shadow-black/30 bg-zinc-950">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-zinc-100">Participantes</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 shadow-sm text-zinc-300 font-mono font-semibold">
            {participants.length}
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Participants List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
        {participants.map((p) => {
          const isMe = p.id === currentUser.id;
          const isSharer = p.id === activeSharerId;
          const isUserAdmin = p.role === "admin";
          const volume = participantVolumes[p.id] ?? 100;
          const isLocallyMuted = participantMutes[p.id] ?? false;

          return (
            <div
              key={p.id}
              className="p-3.5 rounded-2xl bg-zinc-900/60 shadow-md shadow-black/30 hover:bg-zinc-900/80 transition-all space-y-2.5"
            >
              <div className="flex items-center justify-between">
                {/* Avatar & Name */}
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <Avatar
                      name={p.name}
                      avatarColor={p.avatarColor}
                      avatarUrl={p.avatarUrl}
                      size="lg"
                      isSpeaking={p.isSpeaking && !p.isMuted}
                    />
                    {p.isSpeaking && !p.isMuted && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-zinc-100 max-w-[120px] truncate">
                        {p.name}
                      </span>
                      {isMe && <span className="text-[10px] text-zinc-500">(Você)</span>}
                    </div>

                    <div className="flex items-center gap-1 mt-0.5">
                      {isUserAdmin && (
                        <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-400 font-semibold shadow-sm">
                          <Shield className="w-2.5 h-2.5" />
                          Host
                        </span>
                      )}
                      {isSharer && (
                        <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-full bg-red-500/15 text-red-400 font-semibold shadow-sm">
                          <Radio className="w-2.5 h-2.5" />
                          Transmitindo
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status & Menu */}
                <div className="flex items-center gap-1.5">
                  {p.isMuted ? (
                    <span className="p-1 rounded bg-red-500/10 text-red-400" title="Microfone Silenciado">
                      <MicOff className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span
                      className={`p-1 rounded ${
                        p.isSpeaking ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-500"
                      }`}
                      title={p.isSpeaking ? "Falando agora" : "Microfone Aberto"}
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </span>
                  )}

                  {/* Admin moderation actions menu */}
                  {isAdmin && !isMe && (
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === p.id ? null : p.id)}
                        className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                        title="Ações de Moderação"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {menuOpenId === p.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 py-1.5 bg-zinc-900 rounded-2xl shadow-2xl shadow-black/80 z-30 text-xs">
                          {!p.isMuted && (
                            <button
                              onClick={() => {
                                onForceMuteParticipant(p.id);
                                setMenuOpenId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                            >
                              <MicOff className="w-3.5 h-3.5 text-amber-400" />
                              <span>Silenciar Participante</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              onKickParticipant(p.id, p.name);
                              setMenuOpenId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                          >
                            <UserX className="w-3.5 h-3.5 text-orange-400" />
                            <span>Remover da Sala</span>
                          </button>
                          <button
                            onClick={() => {
                              onBanParticipant(p.id, p.name);
                              setMenuOpenId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors font-medium"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Banir Permanentemente</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Per-Participant Volume & Individual Mute (Available to anyone for remote participants) */}
              {!isMe && (
                <div className="pt-2 flex items-center gap-2 text-xs">
                  <button
                    onClick={() => onToggleParticipantMute(p.id)}
                    className={`p-1 rounded transition-colors ${
                      isLocallyMuted ? "text-red-400 hover:text-red-300" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                    title={isLocallyMuted ? "Desmutar para mim" : "Mutar para mim"}
                  >
                    {isLocallyMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="5"
                    disabled={isLocallyMuted}
                    value={isLocallyMuted ? 0 : volume}
                    onChange={(e) => onSetVolume(p.id, parseInt(e.target.value, 10))}
                    className="flex-1 accent-indigo-500 h-1 bg-zinc-700 rounded cursor-pointer disabled:opacity-40"
                  />

                  <span className="font-mono text-[10px] text-zinc-400 w-9 text-right font-medium">
                    {isLocallyMuted ? "0%" : `${volume}%`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
