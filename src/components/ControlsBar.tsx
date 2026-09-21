import React from "react";
import {
  Mic,
  MicOff,
  ScreenShare,
  StopCircle,
  MessageSquare,
  Users,
  Shield,
  Sliders,
  LogOut,
  Share2,
} from "lucide-react";
import { ScreenConfig } from "../types";

interface ControlsBarProps {
  isMuted: boolean;
  isSpeaking: boolean;
  onToggleMute: () => void;
  isScreenSharing: boolean;
  onToggleScreenShare: () => void;
  screenConfig: ScreenConfig;
  onOpenQualityModal: () => void;
  isChatOpen: boolean;
  onToggleChat: () => void;
  unreadCount: number;
  isParticipantsOpen: boolean;
  onToggleParticipants: () => void;
  participantCount: number;
  isAdmin: boolean;
  onOpenAdmin: () => void;
  onLeaveRoom: () => void;
  canShare: boolean;
  onCopyRoomLink?: () => void;
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
  isMuted,
  isSpeaking,
  onToggleMute,
  isScreenSharing,
  onToggleScreenShare,
  screenConfig,
  onOpenQualityModal,
  isChatOpen,
  onToggleChat,
  unreadCount,
  isParticipantsOpen,
  onToggleParticipants,
  participantCount,
  isAdmin,
  onOpenAdmin,
  onLeaveRoom,
  canShare,
  onCopyRoomLink,
}) => {
  return (
    <div
      id="main-controls-bar"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 sm:gap-2.5 p-2 rounded-2xl bg-black/95 backdrop-blur-xl border border-zinc-800 shadow-2xl max-w-[95vw] overflow-x-auto"
    >
      {/* Microphone Toggle */}
      <button
        id="control-mic-toggle-btn"
        onClick={onToggleMute}
        className={`relative p-3 rounded-xl flex items-center justify-center transition-all ${
          isMuted
            ? "bg-zinc-900 text-zinc-500 border border-zinc-800"
            : isSpeaking
            ? "bg-zinc-100 text-zinc-950 font-bold ring-2 ring-zinc-400"
            : "bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800"
        }`}
        title={isMuted ? "Desmutar Microfone (M)" : "Mutar Microfone (M)"}
      >
        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        {isSpeaking && !isMuted && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
        )}
      </button>

      {/* Screen Share Toggle */}
      {canShare && (
        <button
          id="control-screen-share-btn"
          onClick={onToggleScreenShare}
          className={`px-3.5 py-3 rounded-xl flex items-center gap-2 text-xs font-semibold transition-all ${
            isScreenSharing
              ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30"
              : "bg-zinc-100 hover:bg-white text-zinc-950 font-semibold"
          }`}
          title={isScreenSharing ? "Parar Transmissão" : "Compartilhar Tela"}
        >
          {isScreenSharing ? (
            <>
              <StopCircle className="w-5 h-5" />
              <span className="hidden md:inline">Parar Transmissão</span>
            </>
          ) : (
            <>
              <ScreenShare className="w-5 h-5" />
              <span className="hidden md:inline">Transmitir</span>
            </>
          )}
        </button>
      )}

      {/* Quality & Preset Selector Button */}
      <button
        id="control-quality-btn"
        onClick={onOpenQualityModal}
        className="px-2.5 sm:px-3 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 flex items-center gap-1.5 text-xs transition-colors"
        title="Ajustar Resolução e Otimização"
      >
        <Sliders className="w-4 h-4 text-zinc-400" />
        <span className="font-mono uppercase font-bold text-[11px] text-zinc-100">
          {screenConfig.resolution}
        </span>
        <span className="hidden sm:inline text-zinc-500 text-[10px] uppercase font-semibold">
          {screenConfig.preset}
        </span>
      </button>

      <div className="h-6 w-px bg-zinc-800 mx-0.5" />

      {/* Participants Toggle */}
      <button
        id="control-participants-btn"
        onClick={onToggleParticipants}
        className={`relative p-3 rounded-xl flex items-center justify-center transition-colors ${
          isParticipantsOpen
            ? "bg-zinc-800 text-white border border-zinc-600"
            : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
        }`}
        title="Participantes"
      >
        <Users className="w-5 h-5" />
        <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-zinc-800 border border-zinc-700 text-zinc-200">
          {participantCount}
        </span>
      </button>

      {/* Chat Toggle */}
      <button
        id="control-chat-btn"
        onClick={onToggleChat}
        className={`relative p-3 rounded-xl flex items-center justify-center transition-colors ${
          isChatOpen
            ? "bg-zinc-800 text-white border border-zinc-600"
            : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
        }`}
        title="Chat"
      >
        <MessageSquare className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-950 shadow-md">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Share Link Button */}
      {onCopyRoomLink && (
        <button
          id="control-share-link-btn"
          onClick={onCopyRoomLink}
          className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
          title="Copiar Link de Convite da Sala"
        >
          <Share2 className="w-5 h-5 text-zinc-300" />
        </button>
      )}

      {/* Admin Panel Toggle */}
      {isAdmin && (
        <button
          id="control-admin-btn"
          onClick={onOpenAdmin}
          className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
          title="Painel de Moderação"
        >
          <Shield className="w-5 h-5 text-zinc-400" />
        </button>
      )}

      {/* Leave Room Button */}
      <button
        id="control-leave-btn"
        onClick={onLeaveRoom}
        className="p-3 rounded-xl bg-zinc-900 hover:bg-red-600 hover:text-white text-zinc-400 border border-zinc-800 transition-colors"
        title="Sair da Sala"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  );
};

