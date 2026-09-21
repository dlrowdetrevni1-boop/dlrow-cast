import React, { useState, useEffect } from "react";
import {
  Radio,
  Plus,
  LogIn,
  Gamepad2,
  Film,
  BookOpen,
  Monitor,
  Mic,
  MicOff,
  History,
  ArrowRight,
  ExternalLink,
  Share2,
  Check,
} from "lucide-react";
import { UserProfile, SessionHistoryItem, StreamPreset } from "../types";
import { Avatar } from "./Avatar";
import { getPublicBaseUrl, copyToClipboard } from "../utils/share";

interface LobbyViewProps {
  currentUser: UserProfile;
  onOpenProfile: () => void;
  onOpenHistory: () => void;
  onCreateRoom: (roomName?: string) => void;
  onJoinRoom: (roomId: string) => void;
  recentSessions: SessionHistoryItem[];
  initialRoomCode?: string;
  error?: string | null;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  currentUser,
  onOpenProfile,
  onOpenHistory,
  onCreateRoom,
  onJoinRoom,
  recentSessions,
  initialRoomCode = "",
  error,
}) => {
  const [joinCode, setJoinCode] = useState(initialRoomCode);
  const [roomTitle, setRoomTitle] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<StreamPreset>("game");
  const [micActive, setMicActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);

  useEffect(() => {
    if (initialRoomCode) {
      setJoinCode(initialRoomCode);
    }
  }, [initialRoomCode]);

  // Microphone test detector
  useEffect(() => {
    let animId: number;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;

    if (micActive) {
      navigator.mediaDevices
        ?.getUserMedia({ audio: true })
        .then((s) => {
          stream = s;
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          audioCtx = new AudioCtx();
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 128;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const data = new Uint8Array(analyser.frequencyBinCount);
          const update = () => {
            analyser.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            const avg = sum / data.length;
            setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animId = requestAnimationFrame(update);
          };
          animId = requestAnimationFrame(update);
        })
        .catch(() => {
          setMicActive(false);
        });
    } else {
      setMicLevel(0);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (audioCtx) audioCtx.close().catch(() => {});
    };
  }, [micActive]);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    let cleanCode = joinCode.trim();
    if (cleanCode.includes("room=")) {
      const match = cleanCode.match(/room=([A-Z0-9-]+)/i);
      if (match) cleanCode = match[1];
    }
    onJoinRoom(cleanCode.toUpperCase());
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-black text-zinc-100">
      {/* Top Bar */}
      <header className="h-16 shadow-lg shadow-black/60 px-4 sm:px-6 flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 shadow-md shadow-black/40 flex items-center justify-center text-zinc-200">
            <Radio className="w-4 h-4 text-zinc-200" />
          </div>
          <div>
            <span className="font-bold text-sm sm:text-base tracking-tight text-white">
              dlrow cast
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const url = getPublicBaseUrl();
              const success = await copyToClipboard(url);
              if (success) {
                setCopiedAppUrl(true);
                setTimeout(() => setCopiedAppUrl(false), 2500);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white shadow-md shadow-black/30 transition-colors text-xs font-medium"
            title="Copiar link do site para enviar para amigos"
          >
            {copiedAppUrl ? <Check className="w-3.5 h-3.5 text-zinc-200" /> : <Share2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedAppUrl ? "Link Copiado" : "Compartilhar Site"}</span>
          </button>

          <button
            onClick={() => window.open(window.location.href, "_blank")}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white shadow-md shadow-black/30 transition-colors text-xs font-medium"
            title="Abrir em Nova Aba para compartilhamento de tela sem restrições de iframe"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Nova Aba</span>
          </button>

          <button
            onClick={onOpenHistory}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 shadow-md shadow-black/30 transition-colors"
            title="Histórico de Sessões"
          >
            <History className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 shadow-md shadow-black/30 transition-colors text-xs font-medium"
          >
            <Avatar
              name={currentUser.name}
              avatarColor={currentUser.avatarColor}
              avatarUrl={currentUser.avatarUrl}
              size="sm"
            />
            <span className="max-w-[110px] truncate">{currentUser.name}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl mx-auto px-4 py-8 sm:py-14 flex-1 flex flex-col">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-zinc-900 shadow-lg shadow-black/50 text-zinc-200 text-xs font-medium flex items-center justify-between">
            <span>{error}</span>
          </div>
        )}

        {/* Headline */}
        <div className="mb-8 sm:mb-10 text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
            dlrow cast
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
            Crie ou entre em uma sala para transmitir áudio e tela com baixa latência.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {/* Create Room Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/60 shadow-xl shadow-black/50 flex flex-col justify-between transition-all">
            <div>
              <div className="w-9 h-9 rounded-lg bg-zinc-800 shadow-md shadow-black/40 text-zinc-200 flex items-center justify-center mb-4">
                <Plus className="w-4 h-4" />
              </div>
              <h2 className="text-base font-semibold text-white mb-1">Criar Sala</h2>
              <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                Inicie uma nova sessão exclusiva como anfitrião e compartilhe o link ou código da reunião.
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
                    Nome da Sala (Opcional)
                  </label>
                  <input
                    id="lobby-room-name-input"
                    type="text"
                    placeholder="Ex: Apresentação, Transmissão ou Jogo"
                    value={roomTitle}
                    onChange={(e) => setRoomTitle(e.target.value)}
                    className="w-full bg-zinc-950 shadow-inner shadow-black/60 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
                    Modo Inicial
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPreset("game")}
                      className={`p-2.5 rounded-xl text-left text-xs transition-all flex items-center gap-2 ${
                        selectedPreset === "game"
                          ? "bg-zinc-800 text-white font-semibold shadow-md shadow-black/50"
                          : "bg-zinc-950/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 shadow-sm shadow-black/30"
                      }`}
                    >
                      <Gamepad2 className="w-3.5 h-3.5" />
                      <span>Jogos (60 FPS)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPreset("movie")}
                      className={`p-2.5 rounded-xl text-left text-xs transition-all flex items-center gap-2 ${
                        selectedPreset === "movie"
                          ? "bg-zinc-800 text-white font-semibold shadow-md shadow-black/50"
                          : "bg-zinc-950/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 shadow-sm shadow-black/30"
                      }`}
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>Vídeo & Filmes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPreset("reading")}
                      className={`p-2.5 rounded-xl text-left text-xs transition-all flex items-center gap-2 ${
                        selectedPreset === "reading"
                          ? "bg-zinc-800 text-white font-semibold shadow-md shadow-black/50"
                          : "bg-zinc-950/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 shadow-sm shadow-black/30"
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Texto & Leitura</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPreset("screen")}
                      className={`p-2.5 rounded-xl text-left text-xs transition-all flex items-center gap-2 ${
                        selectedPreset === "screen"
                          ? "bg-zinc-800 text-white font-semibold shadow-md shadow-black/50"
                          : "bg-zinc-950/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 shadow-sm shadow-black/30"
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>Geral</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              id="lobby-create-room-btn"
              onClick={() => onCreateRoom(roomTitle)}
              className="w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-black/30 transition-all active:scale-[0.99]"
            >
              <span>Criar Sala e Iniciar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Join Room Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/60 shadow-xl shadow-black/50 flex flex-col justify-between transition-all">
            <div>
              <div className="w-9 h-9 rounded-lg bg-zinc-800 shadow-md shadow-black/40 text-zinc-200 flex items-center justify-center mb-4">
                <LogIn className="w-4 h-4" />
              </div>
              <h2 className="text-base font-semibold text-white mb-1">Entrar na Sala</h2>
              <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                Digite o código da sala ou cole o link compartilhado pelo anfitrião.
              </p>

              <form onSubmit={handleJoinSubmit} className="space-y-4 mb-6">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
                    Código ou Link
                  </label>
                  <input
                    id="lobby-join-code-input"
                    type="text"
                    placeholder="Ex: ABC-123 ou cole a URL"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="w-full bg-zinc-950 shadow-inner shadow-black/60 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
                  />
                </div>

                {/* Pre-Call Microphone Test */}
                <div className="p-3 rounded-xl bg-zinc-950 shadow-inner shadow-black/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-zinc-300">
                      {micActive ? (
                        <Mic className="w-3.5 h-3.5 text-zinc-200" />
                      ) : (
                        <MicOff className="w-3.5 h-3.5 text-zinc-500" />
                      )}
                      <span>Testar Microfone</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMicActive(!micActive)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                        micActive
                          ? "bg-zinc-800 text-red-400 shadow-sm"
                          : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 shadow-sm"
                      }`}
                    >
                      {micActive ? "Desativar" : "Testar"}
                    </button>
                  </div>

                  {micActive && (
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-zinc-300 transition-all duration-75"
                        style={{ width: `${micLevel}%` }}
                      />
                    </div>
                  )}
                </div>
              </form>
            </div>

            <button
              id="lobby-join-room-btn"
              onClick={handleJoinSubmit}
              disabled={!joinCode.trim()}
              className="w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-white disabled:bg-zinc-800/80 disabled:text-zinc-500 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-black/30 transition-all active:scale-[0.99]"
            >
              <span>Entrar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/40 shadow-xl shadow-black/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-zinc-400" />
                <span>Salas Recentes</span>
              </span>
              <button
                onClick={onOpenHistory}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Ver histórico
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {recentSessions.slice(0, 3).map((s) => (
                <button
                  key={s.id}
                  onClick={() => onJoinRoom(s.roomId)}
                  className="p-3.5 rounded-xl bg-zinc-950/80 shadow-md shadow-black/40 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="font-mono text-xs font-bold text-zinc-200 group-hover:text-white transition-colors">
                      {s.roomId}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {new Date(s.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
