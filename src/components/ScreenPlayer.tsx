import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Maximize,
  Minimize,
  PictureInPicture2,
  Sliders,
  Volume2,
  VolumeX,
  Activity,
  Monitor,
  Check,
} from "lucide-react";
import { RoomState, StreamMetrics, ResolutionOption } from "../types";

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
  const hideControlsTimeoutRef = useRef<any>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showResMenu, setShowResMenu] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  // Attach stream to video tag
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
      video
        .play()
        .then(() => {
          setAudioBlocked(false);
        })
        .catch((err) => {
          console.warn("Autoplay blocked or waiting for user interaction:", err);
          if (!isLocalSharing) {
            setAudioBlocked(true);
          }
        });
    } else {
      video.srcObject = null;
    }
  }, [stream, isLocalSharing]);

  // Handle user activity to show/hide controls cleanly
  const handleUserActivity = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    hideControlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
      setShowResMenu(false);
    }, 2800);
  }, []);

  const handleMouseLeave = () => {
    setShowControls(false);
    setShowResMenu(false);
  };

  // Fullscreen listener
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

  const handleUnblockAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().catch(() => {});
      setAudioBlocked(false);
    }
  };

  const activeSharer = roomState?.participants.find((p) => p.id === roomState.activeScreenSharerId);
  const activeConfig = roomState?.activeScreenConfig;

  return (
    <div
      ref={containerRef}
      id="screen-player-container"
      onMouseMove={handleUserActivity}
      onMouseEnter={handleUserActivity}
      onMouseLeave={handleMouseLeave}
      className="relative flex-1 w-full h-full bg-black flex items-center justify-center overflow-hidden select-none p-2 sm:p-4"
    >
      {stream ? (
        <div className="relative w-full h-full flex items-center justify-center max-w-full max-h-full">
          {/* Main Video Stream - Centered with clean soft shadow and no outline */}
          <video
            ref={videoRef}
            id="main-screen-video"
            autoPlay
            playsInline
            muted={isLocalSharing || isMuted}
            onDoubleClick={toggleFullscreen}
            className="w-full h-full max-w-full max-h-full object-contain rounded-xl shadow-2xl shadow-black/80 transition-all cursor-pointer"
          />

          {/* Autoplay Audio Unblock Banner (if browser blocked unmuted sound) */}
          {audioBlocked && (
            <button
              onClick={handleUnblockAudio}
              className="absolute top-6 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-2 shadow-xl shadow-black/50 transition-transform active:scale-95 z-30"
            >
              <Volume2 className="w-4 h-4" />
              <span>Clique para ouvir o áudio da transmissão</span>
            </button>
          )}

          {/* Top Bar Floating Controls - Clean, auto-fades and uses subtle shadow */}
          <div
            className={`absolute top-4 left-4 right-4 flex items-center justify-between transition-opacity duration-300 z-20 pointer-events-none ${
              showControls ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Streamer Badge & Resolution Pill */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 backdrop-blur-md shadow-lg shadow-black/50 text-xs text-white">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-semibold text-zinc-100">
                  {isLocalSharing ? "Sua Tela" : activeSharer?.name || "Transmissão"}
                </span>

                <div className="h-3.5 w-px bg-zinc-800 mx-1" />

                {/* Resolution selector dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowResMenu(!showResMenu)}
                    className="flex items-center gap-1 font-mono uppercase font-semibold text-zinc-300 hover:text-white transition-colors"
                  >
                    <span>{activeConfig?.resolution.toUpperCase() || "1080P"}</span>
                    <Sliders className="w-3 h-3 text-zinc-400" />
                  </button>

                  {showResMenu && (
                    <div className="absolute top-full left-0 mt-2 w-36 py-1 bg-zinc-900/95 backdrop-blur-md rounded-xl shadow-2xl shadow-black/70 z-30 font-sans">
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
                          {activeConfig?.resolution === res && (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Top Right Utilities */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={() => setShowStats(!showStats)}
                className={`p-2 rounded-xl backdrop-blur-md text-xs font-mono transition-all flex items-center gap-1.5 shadow-lg shadow-black/50 ${
                  showStats
                    ? "bg-zinc-100 text-zinc-950 font-medium"
                    : "bg-zinc-900/90 text-zinc-300 hover:bg-zinc-800"
                }`}
                title="Estatísticas WebRTC"
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Métricas</span>
              </button>

              <button
                onClick={togglePiP}
                className="p-2 rounded-xl bg-zinc-900/90 backdrop-blur-md hover:bg-zinc-800 text-zinc-200 transition-colors shadow-lg shadow-black/50"
                title="Janela Flutuante (PiP)"
              >
                <PictureInPicture2 className="w-4 h-4" />
              </button>

              <button
                id="screen-fullscreen-btn"
                onClick={toggleFullscreen}
                className="px-3 py-2 rounded-xl bg-zinc-900/90 backdrop-blur-md hover:bg-zinc-800 text-zinc-100 font-medium text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-black/50"
                title="Alternar Tela Cheia"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                <span className="hidden sm:inline">{isFullscreen ? "Sair Tela Cheia" : "Tela Cheia"}</span>
              </button>
            </div>
          </div>

          {/* WebRTC Diagnostics Floating Box */}
          {showStats && (
            <div className="absolute top-16 left-4 p-4 rounded-xl bg-zinc-950/95 backdrop-blur-md shadow-2xl shadow-black/80 z-20 text-xs font-mono text-zinc-300 space-y-1.5 w-64">
              <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider pb-1 flex items-center justify-between border-b border-zinc-800/60">
                <span>Diagnóstico WebRTC</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-zinc-400">Latência:</span>
                <span className="text-emerald-400 font-bold">
                  {metrics.latencyMs !== undefined ? `${metrics.latencyMs} ms` : "Baixa latência"}
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-zinc-400">Taxa:</span>
                <span className="text-zinc-200 font-semibold">
                  {metrics.fps ? `${metrics.fps} FPS` : "60 FPS"}
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-zinc-400">Resolução:</span>
                <span className="text-zinc-200">
                  {metrics.width && metrics.height
                    ? `${metrics.width}x${metrics.height}`
                    : activeConfig?.resolution.toUpperCase() || "1080P"}
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-zinc-400">Bitrate:</span>
                <span className="text-sky-400 font-semibold">
                  {metrics.bitrateKbps ? `${(metrics.bitrateKbps / 1000).toFixed(1)} Mbps` : "6.0 Mbps"}
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-zinc-400">Perda de Pacotes:</span>
                <span className="text-zinc-200">{metrics.packetsLost ?? 0}</span>
              </div>
            </div>
          )}

          {/* Bottom Volume Controller for Viewer */}
          {!isLocalSharing && (
            <div
              className={`absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 backdrop-blur-md shadow-lg shadow-black/50 transition-opacity duration-300 z-20 ${
                showControls ? "opacity-100" : "opacity-0"
              }`}
            >
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-zinc-300 hover:text-white"
                title={isMuted ? "Desmutar áudio" : "Mutar áudio"}
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
        </div>
      ) : (
        /* Standby / No Stream State - Centered and clean */
        <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto z-10">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 shadow-xl shadow-black/50 flex items-center justify-center text-zinc-300 mb-4">
            <Monitor className="w-8 h-8" />
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-zinc-100 mb-2">
            Nenhuma transmissão ativa
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mb-6 leading-relaxed">
            Compartilhe sua tela em alta resolução e 60 FPS ou aguarde o anfitrião iniciar.
          </p>

          {canShare ? (
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button
                id="start-screen-share-btn"
                onClick={onStartShare}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 shadow-xl shadow-black/40 transition-all active:scale-[0.99]"
              >
                <Monitor className="w-4 h-4" />
                <span>Iniciar Transmissão</span>
              </button>

              <button
                onClick={onOpenQualityModal}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-medium text-xs shadow-lg shadow-black/40 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                <span>Qualidade</span>
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-zinc-900/90 shadow-lg shadow-black/40 text-zinc-400 text-xs">
              Apenas o anfitrião tem permissão para transmitir nesta sala.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
