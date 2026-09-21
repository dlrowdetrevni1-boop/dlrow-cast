import React, { useState } from "react";
import {
  Share2,
  Check,
  Shield,
  Users,
  History,
  User,
  Radio,
  Lock,
  Wifi,
  Sparkles,
  Sliders,
} from "lucide-react";
import { RoomState, UserProfile, StreamMetrics } from "../types";
import { Avatar } from "./Avatar";
import { getShareableRoomUrl, copyToClipboard } from "../utils/share";

interface HeaderProps {
  roomState: RoomState | null;
  currentUser: UserProfile;
  metrics: Partial<StreamMetrics>;
  onOpenProfile: () => void;
  onOpenHistory: () => void;
  onOpenAdmin: () => void;
  onOpenQualityModal: () => void;
  isAdmin: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  roomState,
  currentUser,
  metrics,
  onOpenProfile,
  onOpenHistory,
  onOpenAdmin,
  onOpenQualityModal,
  isAdmin,
}) => {
  const [copied, setCopied] = useState(false);

  const copyRoomLink = async () => {
    if (!roomState) return;
    const url = getShareableRoomUrl(roomState.id);
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const activeSharer = roomState?.participants.find((p) => p.id === roomState.activeScreenSharerId);

  return (
    <header className="h-16 shadow-lg shadow-black/50 bg-zinc-950/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30">
      {/* Brand & Room Info */}
      <div className="flex items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 shadow-md shadow-black/40 flex items-center justify-center text-zinc-200">
            <Radio className="w-4 h-4 text-zinc-200" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-zinc-100 tracking-tight">
              dlrow cast
            </h1>
          </div>
        </div>

        {roomState && (
          <div className="hidden sm:flex items-center gap-2 pl-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 shadow-md shadow-black/30">
              <span className="text-xs text-zinc-400">Sala:</span>
              <span className="font-mono text-xs font-semibold text-zinc-200 tracking-wider">
                {roomState.id}
              </span>
              {roomState.isLocked && (
                <span title="Sala trancada">
                  <Lock className="w-3 h-3 text-amber-400 ml-1" />
                </span>
              )}
            </div>

            <button
              id="header-copy-link-btn"
              onClick={copyRoomLink}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                copied
                  ? "bg-zinc-800 text-zinc-200 shadow-inner"
                  : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 shadow-md shadow-black/30"
              }`}
              title="Copiar link para convidar"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? "Link Copiado" : "Copiar Link"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Center Live Quality / Latency Status */}
      {roomState?.activeScreenSharerId && (
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 shadow-md shadow-black/30 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-zinc-400 text-[11px] uppercase">Ao Vivo:</span>
            <span className="text-zinc-200 font-medium">{activeSharer?.name || "Transmissor"}</span>
          </div>
          <span className="text-zinc-700">•</span>
          <button
            onClick={onOpenQualityModal}
            className="text-zinc-400 hover:text-zinc-200 font-mono flex items-center gap-1 transition-colors uppercase text-[11px]"
          >
            <span>{roomState.activeScreenConfig?.resolution || "1080P"}</span>
            <span className="text-zinc-500 font-sans text-[10px]">
              ({roomState.activeScreenConfig?.preset || "jogo"})
            </span>
            <Sliders className="w-3 h-3 ml-0.5 text-zinc-500" />
          </button>
          {metrics.latencyMs !== undefined && (
            <>
              <span className="text-zinc-700">•</span>
              <div className="flex items-center gap-1 text-zinc-400 font-mono text-[11px]">
                <Wifi className="w-3 h-3 text-zinc-400" />
                <span>{metrics.latencyMs}ms</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Right Controls & Profile */}
      <div className="flex items-center gap-2">
        {isAdmin && (
          <button
            id="header-admin-btn"
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 shadow-md shadow-black/30 hover:bg-amber-500/20 transition-colors"
            title="Painel de Administração da Reunião"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        )}

        <button
          id="header-history-btn"
          onClick={onOpenHistory}
          className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 shadow-md shadow-black/30 transition-colors"
          title="Histórico de Sessões"
        >
          <History className="w-4 h-4" />
        </button>

        <button
          id="header-profile-btn"
          onClick={onOpenProfile}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 shadow-md shadow-black/30 transition-colors"
          title="Editar Perfil"
        >
          <Avatar
            name={currentUser.name}
            avatarColor={currentUser.avatarColor}
            avatarUrl={currentUser.avatarUrl}
            size="sm"
          />
          <span className="text-xs font-medium max-w-[100px] truncate hidden sm:inline">
            {currentUser.name}
          </span>
        </button>
      </div>
    </header>
  );
};
