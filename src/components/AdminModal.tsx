import React, { useState } from "react";
import {
  X,
  Shield,
  Lock,
  Unlock,
  Monitor,
  Ban,
  UserX,
  MicOff,
  AlertTriangle,
  Power,
  Users,
  CheckCircle,
} from "lucide-react";
import { RoomState, Participant } from "../types";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomState: RoomState | null;
  currentUserId: string;
  onToggleLock: (isLocked: boolean) => void;
  onToggleScreenPermission: (allow: boolean) => void;
  onKickParticipant: (targetId: string, name: string) => void;
  onBanParticipant: (targetId: string, name: string) => void;
  onForceMuteParticipant: (targetId: string) => void;
  onEndRoom: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  roomState,
  currentUserId,
  onToggleLock,
  onToggleScreenPermission,
  onKickParticipant,
  onBanParticipant,
  onForceMuteParticipant,
  onEndRoom,
}) => {
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (!isOpen || !roomState) return null;

  const otherParticipants = roomState.participants.filter((p) => p.id !== currentUserId);

  return (
    <div
      id="admin-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-lg bg-zinc-950 rounded-2xl shadow-2xl shadow-black/90 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 shadow-md shadow-black/30 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 shadow-sm flex items-center justify-center text-amber-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-100">
                Painel de Moderação & Administração
              </h2>
              <p className="text-[11px] text-zinc-400">
                Controle total sobre segurança, acesso e participantes da sala
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-xs text-zinc-300">
          {/* Room Security Toggles */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Segurança da Sala
            </h3>

            {/* Lock Room Toggle */}
            <div className="p-3.5 rounded-xl bg-zinc-900/70 shadow-md shadow-black/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg shadow-sm ${
                    roomState.isLocked
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {roomState.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </div>
                <div>
                  <div className="font-semibold text-zinc-100">
                    {roomState.isLocked ? "Sala Trancada" : "Sala Aberta"}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {roomState.isLocked
                      ? "Nenhum novo participante pode entrar"
                      : "Qualquer pessoa com o link pode entrar"}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onToggleLock(!roomState.isLocked)}
                className={`px-3 py-1.5 rounded-lg font-semibold shadow-sm transition-colors ${
                  roomState.isLocked
                    ? "bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                }`}
              >
                {roomState.isLocked ? "Destrancar" : "Trancar Sala"}
              </button>
            </div>

            {/* Screen Share Permissions */}
            <div className="p-3.5 rounded-xl bg-zinc-900/70 shadow-md shadow-black/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg shadow-sm ${
                    roomState.allowParticipantScreenShare
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-zinc-100">Transmissão de Tela</div>
                  <div className="text-[11px] text-zinc-400">
                    {roomState.allowParticipantScreenShare
                      ? "Todos os participantes podem transmitir"
                      : "Apenas o Administrador pode transmitir"}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onToggleScreenPermission(!roomState.allowParticipantScreenShare)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium shadow-sm transition-colors"
              >
                {roomState.allowParticipantScreenShare ? "Limitar ao Host" : "Liberar a Todos"}
              </button>
            </div>
          </div>

          {/* Quick Participant Actions */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Gerenciar Participantes ({otherParticipants.length})
              </h3>
              {roomState.bannedCount > 0 && (
                <span className="text-[10px] text-red-400 font-mono">
                  {roomState.bannedCount} banido(s) nesta sala
                </span>
              )}
            </div>

            {otherParticipants.length === 0 ? (
              <div className="p-4 rounded-xl bg-zinc-900/40 shadow-inner text-center text-zinc-500 text-xs">
                Nenhum outro participante conectado no momento.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {otherParticipants.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-zinc-900/60 shadow-md shadow-black/30 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow"
                        style={{ backgroundColor: p.avatarColor }}
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-zinc-200">{p.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!p.isMuted && (
                        <button
                          onClick={() => onForceMuteParticipant(p.id)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 shadow-sm transition-colors"
                          title="Silenciar Microfone"
                        >
                          <MicOff className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onKickParticipant(p.id, p.name)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-orange-500/20 text-orange-400 shadow-sm transition-colors"
                        title="Expulsar da Reunião"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onBanParticipant(p.id, p.name)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-red-400 shadow-sm transition-colors"
                        title="Banir Permanentemente"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="pt-2 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Zona Crítica
            </h3>

            {!confirmEnd ? (
              <button
                onClick={() => setConfirmEnd(true)}
                className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-black/40 transition-colors"
              >
                <Power className="w-4 h-4" />
                <span>Encerrar Reunião para Todos</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-red-500/20 shadow-md shadow-black/40 space-y-2">
                <p className="text-red-300 font-medium text-xs">
                  Tem certeza? Isso desconectará todos os participantes e encerrará a transmissão.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onEndRoom}
                    className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition-colors"
                  >
                    Sim, Encerrar Reunião
                  </button>
                  <button
                    onClick={() => setConfirmEnd(false)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 font-medium text-xs shadow-sm transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
