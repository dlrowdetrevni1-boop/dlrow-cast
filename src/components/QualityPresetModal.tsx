import React from "react";
import {
  X,
  Sliders,
  Gamepad2,
  Film,
  BookOpen,
  Monitor,
  Sparkles,
  Check,
  Zap,
} from "lucide-react";
import { ResolutionOption, StreamPreset, ScreenConfig } from "../types";
import { RESOLUTION_CONSTRAINTS, PRESET_CONFIGS } from "../utils/webrtc";

interface QualityPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ScreenConfig;
  onChangeConfig: (newConfig: ScreenConfig) => void;
  isTransmitting: boolean;
}

const RESOLUTIONS: { id: ResolutionOption; title: string; subtitle: string; tag?: string }[] = [
  { id: "auto", title: "Automático / Adaptativo", subtitle: "Ajusta taxa e resolução conforme a conexão", tag: "Recomendado" },
  { id: "4k", title: "4K Ultra HD (2160p)", subtitle: "3840 x 2160 • Máxima nitidez e detalhe", tag: "Ultra HD" },
  { id: "1080p", title: "1080p Full HD", subtitle: "1920 x 1080 • Alta definição fluída a 60 FPS" },
  { id: "720p", title: "720p HD", subtitle: "1280 x 720 • Econômico e estável" },
  { id: "480p", title: "480p SD", subtitle: "854 x 480 • Menor consumo de dados" },
];

const PRESETS: { id: StreamPreset; icon: any; title: string; desc: string; fps: number }[] = [
  {
    id: "game",
    icon: Gamepad2,
    title: "Modo Jogos",
    desc: "Prioridade para 60 FPS e tempo de resposta instantâneo (ultra-baixa latência).",
    fps: 60,
  },
  {
    id: "movie",
    icon: Film,
    title: "Modo Filmes & Vídeo",
    desc: "Cores fiéis e sincronização de áudio estéreo imersiva de alta qualidade.",
    fps: 60,
  },
  {
    id: "reading",
    icon: BookOpen,
    title: "Modo Leitura & Código",
    desc: "Texto cristalino e zero compressão em fontes pequenas e gráficos finos.",
    fps: 30,
  },
  {
    id: "screen",
    icon: Monitor,
    title: "Modo Geral",
    desc: "Ideal para apresentações, reuniões do trabalho e navegação cotidiana.",
    fps: 60,
  },
];

export const QualityPresetModal: React.FC<QualityPresetModalProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  isTransmitting,
}) => {
  if (!isOpen) return null;

  const handleSelectRes = (resolution: ResolutionOption) => {
    const resDetails = RESOLUTION_CONSTRAINTS[resolution];
    onChangeConfig({
      ...config,
      resolution,
      fps: resDetails.idealFps,
      bitrateKbps: Math.round(resDetails.maxBitrate / 1000),
    });
  };

  const handleSelectPreset = (preset: StreamPreset) => {
    const presetInfo = PRESET_CONFIGS[preset];
    onChangeConfig({
      ...config,
      preset,
      fps: presetInfo.recommendedFps,
    });
  };

  return (
    <div
      id="quality-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none"
    >
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-zinc-100">
                Qualidade de Transmissão
              </h2>
              <p className="text-[11px] text-zinc-400">
                Resolução de saída e taxas de quadros da tela
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

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-6 text-xs text-zinc-300">
          {/* Resolution Selection */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
              <span>Resolução</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RESOLUTIONS.map((res) => {
                const isSelected = config.resolution === res.id;
                return (
                  <button
                    key={res.id}
                    onClick={() => handleSelectRes(res.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? "bg-zinc-800 border-zinc-500 text-white"
                        : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs">{res.title}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-zinc-200" />}
                      {res.tag && !isSelected && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                          {res.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">{res.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Profile Selection */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
              <span>Modos de Otimização</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isSelected = config.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      isSelected
                        ? "bg-zinc-800 border-zinc-500 text-white"
                        : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-300"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isSelected ? "bg-zinc-700 text-white" : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-xs text-zinc-100">{preset.title}</span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {preset.fps} FPS
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">{preset.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">
            {isTransmitting
              ? "As alterações serão aplicadas imediatamente."
              : "Configurações salvas para a próxima transmissão."}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
