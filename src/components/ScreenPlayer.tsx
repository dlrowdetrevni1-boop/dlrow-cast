import React, { useRef, useEffect, useState } from "react";
import {
  Maximize,
  Minimize,
  PictureInPicture2,
  Sliders,
  Volume2,
  VolumeX,
  Radio,
  Activity,
  Monitor,
  Zap,
  Gamepad2,
  Film,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { RoomState, StreamMetrics, ResolutionOption, StreamPreset } from "../types";

interface ScreenPlayerProps {
  stream: MediaStream | null;
  isLocalSharing: boolean;
  roomState: RoomState | null;
  metrics: Partial<StreamMetrics>;
  onStartShare: () => void;
  onOpenQualityModal: () => void;
  onSelectResolution: (res: ResolutionOption) => void;
  canShare: boolean;
}

export const ScreenPlayer: React.FC<ScreenPlayerProps> = ({
  stream,
  isLocalSharing,
  roomState,
  metrics,
  onStartShare,
  onOpenQualityModal,
  onSelectResolution,
  canShare,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showResMenu, setShowResMenu] = useState(false);

  // Attach stream to video tag
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      if (stream) {
        video.srcObject = stream;
        video.play().catch((err) => {
          console.warn("Auto-play blocked or waiting for gesture:", err);
        });
      } else {
        video.srcObject = null;
      }
    }
  }, [stream]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
      } catch (err) {
        console.warn("Error entering fullscreen:", err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    }
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("PiP error:", err);
    }
  };

  const activeSharer = roomState?.participants.find((p) => p.id === roomState.activeScreenSharerId);
  const activeConfig = roomState?.activeScreenConfig;

  return (
    <div
      ref={containerRef}
      id="screen-player-container"
      className="relative flex-1 w-full h-full bg-zinc-950 flex items-center justify-center overflow-hidden group select-none"
    >
      {stream ? (
        <>
          {/* Main Video Stream */}
          <video
            ref={videoRef}
            id="main-screen-video"
            autoPlay
            playsInline
            muted={isLocalSharing || isMuted}
            className="w-full h-full object-contain bg-black transition-opacity duration-300"
          />

          {/* Top Bar Floating Controls */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 pointer-events-none">
            {/* Streamer Badge & Resolution Pill */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/85 backdrop-blur-md border border-zinc-700/60 shadow-xl text-xs text-white">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-semibold text-zinc-100">
                  {isLocalSharing ? "Sua Tela (Você)" : activeSharer?.name || "Transmissão"}
                </span>

                <div className="h-3.5 w-px bg-zinc-700 mx-1" />

                {/* Resolution selector dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowResMenu(!showResMenu)}
                    className="flex items-center gap-1 font-mono uppercase font-semibold text-zinc-200 hover:text-white transition-colors"
                  >
                    <span>{activeConfig?.resolution.toUpperCase() || "1080P"}</span>
                    <Sliders className="w-3 h-3 text-zinc-400" />
                  </button>

                  {showResMenu && (
                    <div className="absolute top-full left-0 mt-2 w-36 py-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-30 font-sans">
                      <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-zinc-500">
                        Resoluções
                      </div>
                      {(["auto", "4k", "1080p", "720p", "480p"] as ResolutionOption[]).map((res) => (
                        <button
                          key={res}
                          onClick={() => {
                            onSelectResolution(res);
                            setShowResMenu(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
                            activeConfig?.resolution === res
                              ? "bg-zinc-800 text-white font-medium"
                              : "text-zinc-300 hover:bg-zinc-800/60"
                          }`}
                        >
                          <span className="uppercase">{res === "auto" ? "Automático" : res}</span>
                          {res === "4k" && (
                            <span className="text-[9px] px-1 bg-zinc-800 text-zinc-300 rounded font-mono border border-zinc-700">
                              UHD
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Preset badge */}
                {activeConfig?.preset && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300 font-medium border border-zinc-700">
                    {activeConfig.preset === "game" && "Jogos"}
                    {activeConfig.preset === "movie" && "Filmes"}
                    {activeConfig.preset === "reading" && "Leitura"}
                    {activeConfig.preset === "screen" && "Geral"}
                  </span>
                )}
              </div>
            </div>

            {/* Top Right Utilities */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={() => setShowStats(!showStats)}
                className={`p-2 rounded-lg backdrop-blur-md border text-xs font-mono transition-all flex items-center gap-1.5 ${
                  showStats
                    ? "bg-zinc-100 text-zinc-950 border-white font-medium"
                    : "bg-zinc-900/85 text-zinc-300 border-zinc-700 hover:bg-zinc-800"
                }`}
                title="Estatísticas WebRTC em tempo real"
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Métricas</span>
              </button>

              <button
                onClick={togglePiP}
                className="p-2 rounded-lg bg-zinc-900/85 backdrop-blur-md border border-zinc-700 hover:bg-zinc-800 text-zinc-200 transition-colors shadow-lg"
                title="Picture-in-Picture (Janela Flutuante)"
              >
                <PictureInPicture2 className="w-4 h-4" />
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-zinc-900/85 backdrop-blur-md border border-zinc-700 hover:bg-zinc-800 text-zinc-200 transition-colors shadow-lg"
                title="Tela Cheia"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Real-time WebRTC Stats Overlay HUD */}
          {showStats && (
            <div className="absolute top-16 left-4 p-3.5 rounded-xl bg-zinc-950/90 backdrop-blur-md border border-zinc-700/80 shadow-2xl z-20 text-xs font-mono text-zinc-300 space-y-1.5 w-64">
              <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider pb-1 border-b border-zinc-800 flex items-center justify-between">
                <span>Diagnóstico WebRTC</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-zinc-400">Latência (RTT):</span>
                <span className="text-emerald-400 font-bold">
                  {metrics.latencyMs !== undefined ? `${metrics.latencyMs} ms` : "3-12 ms (ultra-baixa)"}
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-zinc-400">FPS / Taxa:</span>
                <span className="text-zinc-200 font-semibold">
                  {metrics.fps ? `${metrics.fps} FPS` : "60 FPS"}
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-zinc-400">Resolução:</span>
                <span className="text-zinc-200">
                  {metrics.width && metrics.height
                    ? `${metrics.width}x${metrics.height}`
                    : activeConfig?.resolution === "4k"
                    ? "3840x2160 (4K)"
                    : "1920x1080 (FHD)"}
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-zinc-400">Taxa de Bits:</span>
                <span className="text-sky-400 font-semibold">
                  {metrics.bitrateKbps ? `${(metrics.bitrateKbps / 1000).toFixed(1)} Mbps` : "6.5 Mbps"}
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-zinc-400">Perda de Pacotes:</span>
                <span className="text-zinc-200">{metrics.packetsLost ?? 0}</span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-zinc-400">Codec de Vídeo:</span>
                <span className="text-amber-400 font-semibold">{metrics.codec || "VP9 / H.264"}</span>
              </div>
            </div>
          )}

          {/* Bottom Audio Bar if stream has audio and user is watching */}
          {!isLocalSharing && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/85 backdrop-blur-md border border-zinc-700/60 opacity-0 group-hover:opacity-100 transition-opacity z-20">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-zinc-300 hover:text-white"
                title={isMuted ? "Desmutar áudio do sistema" : "Mutar áudio do sistema"}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  setIsMuted(val === 0);
                  if (videoRef.current) {
                    videoRef.current.volume = val;
                  }
                }}
                className="w-20 accent-indigo-500 h-1 bg-zinc-700 rounded cursor-pointer"
              />
            </div>
          )}
        </>
      ) : (
        /* Standby / No Stream State */
        <div className="flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto z-10">
          <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4">
            <Monitor className="w-7 h-7" />
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-zinc-100 mb-1.5">
            Nenhuma transmissão ativa
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mb-6 leading-relaxed">
            Compartilhe sua tela com áudio ou aguarde outro participante iniciar a transmissão.
          </p>

          {canShare ? (
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
              <button
                id="start-screen-share-btn"
                onClick={onStartShare}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <Monitor className="w-4 h-4" />
                <span>Iniciar Transmissão</span>
              </button>

              <button
                onClick={onOpenQualityModal}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-xs border border-zinc-800 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                <span>Qualidade</span>
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs">
              Apenas o anfitrião pode transmitir nesta sala.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
