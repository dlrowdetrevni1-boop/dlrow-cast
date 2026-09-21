import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Send,
  Volume2,
  VolumeX,
  Shield,
  Radio,
  Smile,
  AlertTriangle,
  Info,
} from "lucide-react";
import { ChatMessage, UserProfile, Participant } from "../types";
import { Avatar } from "./Avatar";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentUser: UserProfile;
  soundEnabled: boolean;
  onToggleSound: () => void;
  sharerId: string | null;
  participants?: Participant[];
}

const QUICK_EMOJIS = ["👏", "🔥", "🎮", "🚀", "❤️", "👍", "👀"];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  currentUser,
  soundEnabled,
  onToggleSound,
  sharerId,
  participants = [],
}) => {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const handleQuickEmoji = (emoji: string) => {
    onSendMessage(emoji);
  };

  return (
    <div
      id="chat-panel"
      className="w-full sm:w-80 md:w-96 h-full bg-zinc-950/95 backdrop-blur-xl flex flex-col z-30 fixed sm:relative right-0 top-0 shadow-2xl shadow-black/80"
    >
      {/* Chat Header */}
      <div className="h-16 px-4 flex items-center justify-between shadow-md shadow-black/30 bg-zinc-950">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-100">Chat da Sala</h2>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-900 shadow-sm text-zinc-400 font-mono">
            {messages.filter((m) => m.type === "chat").length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleSound}
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title={soundEnabled ? "Sons de notificação ativados" : "Sons de notificação desativados"}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-zinc-200" />
            ) : (
              <VolumeX className="w-4 h-4 text-zinc-500" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 text-xs">
            <Smile className="w-8 h-8 mb-2 text-zinc-600 stroke-1" />
            <p>Nenhuma mensagem ainda.</p>
            <p>Envie uma mensagem ou reação para o grupo!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser.id;
            const isSystem = msg.type === "system";
            const isModeration = msg.type === "moderation";
            const isSharer = msg.senderId === sharerId;

            if (isSystem || isModeration) {
              return (
                <div
                  key={msg.id}
                  className={`p-2.5 rounded-xl text-xs flex items-start gap-2 shadow-sm ${
                    isModeration
                      ? "bg-amber-500/10 text-amber-300"
                      : "bg-zinc-900/80 text-zinc-400"
                  }`}
                >
                  {isModeration ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 leading-relaxed">{msg.text}</div>
                </div>
              );
            }

            const sender = participants.find((p) => p.id === msg.senderId);
            const authorAvatarUrl = isMe ? currentUser.avatarUrl : sender?.avatarUrl;
            const authorAvatarColor = isMe ? currentUser.avatarColor : (sender?.avatarColor || "#71717a");

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[88%] ${
                  isMe ? "ml-auto" : "mr-auto"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-zinc-400">
                  <Avatar
                    name={msg.senderName}
                    avatarColor={authorAvatarColor}
                    avatarUrl={authorAvatarUrl}
                    size="xs"
                  />
                  <span className="font-semibold text-zinc-300">{isMe ? "Você" : msg.senderName}</span>
                  {msg.senderRole === "admin" && (
                    <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 font-semibold shadow-sm">
                      <Shield className="w-2.5 h-2.5" />
                      Host
                    </span>
                  )}
                  {isSharer && (
                    <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-400 font-semibold shadow-sm">
                      <Radio className="w-2.5 h-2.5" />
                      Live
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-md shadow-black/30 ${
                    isMe
                      ? "bg-zinc-800 text-zinc-100 rounded-tr-xs"
                      : "bg-zinc-900 text-zinc-200 rounded-tl-xs"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emojis Bar */}
      <div className="px-3 py-2 bg-zinc-950 shadow-inner shadow-black/40 flex items-center gap-1.5 overflow-x-auto">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleQuickEmoji(emoji)}
            className="p-1 text-sm hover:scale-125 transition-transform"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 shadow-lg shadow-black/50 bg-black flex items-center gap-2">
        <input
          id="chat-message-input"
          type="text"
          placeholder="Envie uma mensagem..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          maxLength={500}
          className="flex-1 bg-zinc-900 shadow-inner shadow-black/50 rounded-xl px-3 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
        />
        <button
          id="chat-send-btn"
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-xl bg-zinc-100 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-semibold shadow-md shadow-black/30 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
