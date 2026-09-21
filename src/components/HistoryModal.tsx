import React, { useState } from "react";
import {
  X,
  History,
  Calendar,
  Clock,
  Users,
  Shield,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Share2,
} from "lucide-react";
import { SessionHistoryItem } from "../types";
import { getShareableRoomUrl, copyToClipboard } from "../utils/share";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: SessionHistoryItem[];
  onRejoinRoom: (roomId: string) => void;
  onClearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onRejoinRoom,
  onClearHistory,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyCode = async (roomId: string) => {
    const url = getShareableRoomUrl(roomId);
    const success = await copyToClipboard(url);
    if (success) {
      setCopiedId(roomId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  return (
    <div
      id="history-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-lg bg-zinc-950 rounded-2xl shadow-2xl shadow-black/90 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 shadow-md shadow-black/30 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 shadow-md shadow-black/40 flex items-center justify-center text-zinc-300">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-100">Histórico de Sessões</h2>
              <p className="text-[11px] text-zinc-400">Suas reuniões e transmissões recentes</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 text-xs">
          {history.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-zinc-500">
              <Clock className="w-10 h-10 mb-2 text-zinc-600 stroke-1" />
              <p className="font-semibold text-zinc-400">Nenhuma sessão registrada</p>
              <p className="text-[11px] mt-1">
                Quando você entrar ou criar uma transmissão, ela aparecerá aqui.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-zinc-900/60 shadow-md shadow-black/30 hover:bg-zinc-900/90 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-zinc-100 text-sm">{item.roomId}</span>
                    {item.role === "admin" && (
                      <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-400 font-semibold shadow-sm">
                        <Shield className="w-2.5 h-2.5" />
                        Host
                      </span>
                    )}
                    {item.streamQualityUsed && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-400 font-mono font-semibold uppercase">
                        {item.streamQualityUsed}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-zinc-400 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-zinc-500" />
                      {new Date(item.joinedAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {formatDuration(item.durationSeconds)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-zinc-500" />
                      {item.maxParticipants} part.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyCode(item.roomId)}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 shadow-sm transition-colors"
                    title="Copiar Link de Convite"
                  >
                    {copiedId === item.roomId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      onRejoinRoom(item.roomId);
                      onClose();
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold flex items-center gap-1.5 shadow-md shadow-black/30 transition-colors"
                  >
                    <span>Entrar</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-3.5 shadow-lg shadow-black/40 bg-zinc-900/60 flex items-center justify-between">
            <button
              onClick={onClearHistory}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Histórico</span>
            </button>
            <span className="text-[11px] text-zinc-500 font-mono">
              {history.length} sessões salvas localmente
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
