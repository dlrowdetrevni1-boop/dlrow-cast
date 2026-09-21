import React, { useState, useEffect, useRef } from "react";
import {
  X,
  User,
  Mic,
  Check,
  Camera,
  Upload,
  Link as LinkIcon,
  Trash2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { UserProfile } from "../types";
import { Avatar } from "./Avatar";
import { processAvatarFile } from "../utils/image";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSaveProfile: (updated: UserProfile) => void;
}

const PALETTE = [
  "#6366f1",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#27272a",
];

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
}) => {
  const [name, setName] = useState(profile.name);
  const [avatarColor, setAvatarColor] = useState(profile.avatarColor);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(profile.avatarUrl);
  const [micId, setMicId] = useState(profile.preferredMicId);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [testMicActive, setTestMicActive] = useState(false);
  const [testLevel, setTestLevel] = useState(0);

  // Photo upload states
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputText, setUrlInputText] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setName(profile.name);
    setAvatarColor(profile.avatarColor);
    setAvatarUrl(profile.avatarUrl);
    setMicId(profile.preferredMicId);
    setImageError(null);
    setShowUrlInput(false);
    setUrlInputText("");
  }, [profile, isOpen]);

  // Enumerate audio input devices
  useEffect(() => {
    if (isOpen) {
      navigator.mediaDevices
        ?.enumerateDevices()
        .then((devs) => {
          const audioInputs = devs.filter((d) => d.kind === "audioinput");
          setDevices(audioInputs);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Test microphone level meter
  useEffect(() => {
    let animId: number;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;

    if (testMicActive) {
      navigator.mediaDevices
        ?.getUserMedia({
          audio: micId && micId !== "default" ? { deviceId: { exact: micId } } : true,
        })
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
            setTestLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animId = requestAnimationFrame(update);
          };
          animId = requestAnimationFrame(update);
        })
        .catch(() => {
          setTestMicActive(false);
        });
    } else {
      setTestLevel(0);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (audioCtx) audioCtx.close().catch(() => {});
    };
  }, [testMicActive, micId]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setImageError(null);
    try {
      const dataUrl = await processAvatarFile(file, 256);
      setAvatarUrl(dataUrl);
    } catch (err: any) {
      setImageError(err?.message || "Não foi possível carregar esta imagem.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleApplyUrl = () => {
    const trimmed = urlInputText.trim();
    if (!trimmed) {
      setImageError("Por favor insira um link de imagem válido.");
      return;
    }
    setImageError(null);
    setAvatarUrl(trimmed);
    setShowUrlInput(false);
    setUrlInputText("");
  };

  const handleRemovePhoto = () => {
    setAvatarUrl(undefined);
    setImageError(null);
  };

  const handleSave = () => {
    onSaveProfile({
      ...profile,
      name: name.trim() || profile.name,
      avatarColor,
      avatarUrl: avatarUrl || undefined,
      preferredMicId: micId,
    });
    setTestMicActive(false);
    onClose();
  };

  return (
    <div
      id="profile-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-md bg-zinc-950 rounded-2xl shadow-2xl shadow-black/90 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 shadow-md shadow-black/30 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-2.5">
            <Avatar
              name={name}
              avatarColor={avatarColor}
              avatarUrl={avatarUrl}
              size="md"
            />
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-zinc-100">Perfil & Foto</h2>
              <p className="text-[11px] text-zinc-400">Personalize sua foto, nome e preferências</p>
            </div>
          </div>

          <button
            onClick={() => {
              setTestMicActive(false);
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto text-xs text-zinc-300">
          {/* Avatar Photo Section */}
          <div className="space-y-3">
            <label className="text-[11px] font-semibold text-zinc-400 block">
              Foto de Perfil
            </label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`p-4 rounded-2xl transition-all flex flex-col sm:flex-row items-center gap-4 ${
                isDragOver
                  ? "bg-zinc-800 shadow-lg shadow-black/40"
                  : "bg-zinc-900/60 shadow-md shadow-black/30"
              }`}
            >
              {/* Avatar Clickable Preview */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative group cursor-pointer shrink-0"
                title="Clique para escolher uma foto do seu dispositivo"
              >
                <Avatar
                  name={name}
                  avatarColor={avatarColor}
                  avatarUrl={avatarUrl}
                  size="xl"
                  className="transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-[10px] font-medium">
                  <Camera className="w-5 h-5 mb-0.5" />
                  <span>Trocar</span>
                </div>
              </div>

              {/* Photo Actions */}
              <div className="flex-1 w-full flex flex-col justify-center space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isProcessing ? "Carregando..." : "Carregar Foto"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Link da Imagem</span>
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors"
                      title="Remover foto e voltar para cor e inicial"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remover</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-zinc-500">
                  Suporta arquivos PNG, JPG, GIF ou WebP (arraste ou selecione).
                </p>

                {/* Preset Avatars Bar */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-zinc-500 font-medium">Exemplos:</span>
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(url)}
                      className={`w-6 h-6 rounded-full overflow-hidden shadow-sm transition-all ${
                        avatarUrl === url
                          ? "ring-2 ring-white scale-110"
                          : "opacity-70 hover:opacity-100"
                      }`}
                      title={`Foto predefinida ${idx + 1}`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* URL Input Form */}
            {showUrlInput && (
              <div className="p-3 rounded-xl bg-zinc-900 shadow-inner shadow-black/40 space-y-2">
                <span className="text-[11px] text-zinc-400 block font-medium">
                  Insira o link direto de uma foto:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={urlInputText}
                    onChange={(e) => setUrlInputText(e.target.value)}
                    placeholder="https://exemplo.com/minha-foto.jpg"
                    className="flex-1 bg-zinc-950 shadow-inner shadow-black/50 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs shadow-sm transition-colors"
                  >
                    Usar
                  </button>
                </div>
              </div>
            )}

            {imageError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 shadow-sm text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{imageError}</span>
              </div>
            )}
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 block">
              Nome de Exibição
            </label>
            <input
              id="profile-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              className="w-full bg-zinc-900 shadow-inner shadow-black/50 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
              placeholder="Digite seu nome..."
            />
          </div>

          {/* Fallback Color Picker (shown if user wants to customize their fallback color) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 block">
              Cor do Avatar (quando sem foto)
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                    avatarColor === color
                      ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-zinc-950"
                      : "hover:scale-105 shadow-sm"
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {avatarColor === color && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Microphone Device */}
          <div className="space-y-2 pt-2">
            <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-zinc-400" />
              <span>Microfone Principal</span>
            </label>

            <select
              value={micId}
              onChange={(e) => setMicId(e.target.value)}
              className="w-full bg-zinc-900 shadow-inner shadow-black/50 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
            >
              <option value="default">Padrão do Sistema</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microfone ${d.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>

            {/* Test Microphone Level Meter */}
            <div className="p-3 rounded-xl bg-zinc-900/60 shadow-inner shadow-black/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">Teste do Microfone</span>
                <button
                  type="button"
                  onClick={() => setTestMicActive(!testMicActive)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                    testMicActive
                      ? "bg-red-500/20 text-red-400 shadow-sm"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 shadow-sm"
                  }`}
                >
                  {testMicActive ? "Parar Teste" : "Testar Microfone"}
                </button>
              </div>

              {testMicActive && (
                <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-zinc-200 transition-all duration-75"
                    style={{ width: `${testLevel}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 shadow-lg shadow-black/40 bg-zinc-900/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setTestMicActive(false);
              onClose();
            }}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium shadow-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-md shadow-black/30 transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};
