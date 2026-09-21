import { ResolutionOption, StreamPreset, ScreenConfig, StreamMetrics } from "../types";

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

// Resolution settings mapping
export const RESOLUTION_CONSTRAINTS: Record<
  ResolutionOption,
  { width: number; height: number; idealFps: number; maxBitrate: number }
> = {
  "4k": {
    width: 3840,
    height: 2160,
    idealFps: 60,
    maxBitrate: 18000000, // 18 Mbps
  },
  "1080p": {
    width: 1920,
    height: 1080,
    idealFps: 60,
    maxBitrate: 8000000, // 8 Mbps
  },
  "720p": {
    width: 1280,
    height: 720,
    idealFps: 60,
    maxBitrate: 4000000, // 4 Mbps
  },
  "480p": {
    width: 854,
    height: 480,
    idealFps: 30,
    maxBitrate: 1500000, // 1.5 Mbps
  },
  auto: {
    width: 1920,
    height: 1080,
    idealFps: 60,
    maxBitrate: 8000000,
  },
};

export const PRESET_CONFIGS: Record<
  StreamPreset,
  {
    name: string;
    description: string;
    contentHint: "motion" | "detail" | "text" | "";
    recommendedFps: number;
    recommendedResolution: ResolutionOption;
  }
> = {
  game: {
    name: "Jogos",
    description: "60 FPS fluídos com ultra-baixa latência e prioridade para movimento rápido",
    contentHint: "motion",
    recommendedFps: 60,
    recommendedResolution: "1080p",
  },
  movie: {
    name: "Filmes / Vídeo",
    description: "Cores ricas, som estéreo sincronizado e compressão suave",
    contentHint: "motion",
    recommendedFps: 60,
    recommendedResolution: "1080p",
  },
  reading: {
    name: "Leitura / Código",
    description: "Nitidez máxima para textos finos, linhas e fontes nítidas sem borrões",
    contentHint: "detail",
    recommendedFps: 30,
    recommendedResolution: "1080p",
  },
  screen: {
    name: "Geral",
    description: "Equilíbrio perfeito para reuniões, apresentações e navegação",
    contentHint: "detail",
    recommendedFps: 60,
    recommendedResolution: "1080p",
  },
};

// Generate media constraints based on selected resolution and preset
export function getMediaTrackConstraints(resolution: ResolutionOption, preset: StreamPreset) {
  const res = RESOLUTION_CONSTRAINTS[resolution] || RESOLUTION_CONSTRAINTS["1080p"];
  const presetInfo = PRESET_CONFIGS[preset] || PRESET_CONFIGS.screen;

  const fps = preset === "reading" ? 30 : res.idealFps;

  const videoConstraints: MediaTrackConstraints = {
    frameRate: { ideal: fps, max: 60 },
  };

  if (resolution !== "auto") {
    videoConstraints.width = { ideal: res.width, max: res.width };
    videoConstraints.height = { ideal: res.height, max: res.height };
  } else {
    videoConstraints.width = { ideal: 1920 };
    videoConstraints.height = { ideal: 1080 };
  }

  return {
    video: videoConstraints,
    audio: {
      echoCancellation: false, // system audio should not be cancelled
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 2,
    },
  };
}

// Request Display Media with fallback if 4K or high resolution isn't supported directly by OS/browser
export async function captureScreenStream(config: ScreenConfig): Promise<MediaStream> {
  const constraints = getMediaTrackConstraints(config.resolution, config.preset);

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: constraints.video,
      audio: true, // Screen audio
    });

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      // Set content hint for browser encoder optimization
      const presetInfo = PRESET_CONFIGS[config.preset];
      if (presetInfo?.contentHint && "contentHint" in videoTrack) {
        (videoTrack as any).contentHint = presetInfo.contentHint;
      }
    }

    return stream;
  } catch (err: any) {
    // If user cancelled or error
    if (err.name === "NotAllowedError") {
      throw new Error("Compartilhamento de tela cancelado pelo usuário.");
    }
    // Fallback without strict dimensions
    return await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
  }
}

// Apply Bitrate and Encodings onto RTCRtpSender
export async function tuneSenderBitrate(sender: RTCRtpSender, config: ScreenConfig) {
  try {
    const parameters = sender.getParameters();
    if (!parameters.encodings || parameters.encodings.length === 0) {
      parameters.encodings = [{}];
    }

    const res = RESOLUTION_CONSTRAINTS[config.resolution] || RESOLUTION_CONSTRAINTS["1080p"];
    parameters.encodings[0].maxBitrate = res.maxBitrate;

    if (config.preset === "game") {
      parameters.encodings[0].priority = "high";
      parameters.encodings[0].networkPriority = "high";
    }

    await sender.setParameters(parameters);
  } catch (e) {
    console.warn("Could not tune sender bitrate:", e);
  }
}

// Collect real-time WebRTC stats for latency, FPS, and bitrate
export async function extractPeerStats(
  pc: RTCPeerConnection,
  prevBytes: { current: number; timestamp: number }
): Promise<Partial<StreamMetrics>> {
  try {
    const stats = await pc.getStats();
    let metrics: Partial<StreamMetrics> = {};

    stats.forEach((report) => {
      // Inbound RTP (Viewer receiving stream)
      if (report.type === "inbound-rtp" && report.kind === "video") {
        metrics.fps = report.framesPerSecond || 0;
        metrics.packetsLost = report.packetsLost || 0;
        metrics.jitterMs = Math.round((report.jitter || 0) * 1000);
        metrics.codec = report.codecId || "H264/VP9";

        // Bitrate calculation
        if (report.bytesReceived !== undefined) {
          const now = report.timestamp;
          if (prevBytes.timestamp > 0) {
            const timeDiff = (now - prevBytes.timestamp) / 1000;
            const bytesDiff = report.bytesReceived - prevBytes.current;
            if (timeDiff > 0 && bytesDiff >= 0) {
              metrics.bitrateKbps = Math.round((bytesDiff * 8) / (timeDiff * 1000));
            }
          }
          prevBytes.current = report.bytesReceived;
          prevBytes.timestamp = now;
        }
      }

      // Outbound RTP (Host sending stream)
      if (report.type === "outbound-rtp" && report.kind === "video") {
        metrics.fps = report.framesPerSecond || 0;
        if (report.bytesSent !== undefined) {
          const now = report.timestamp;
          if (prevBytes.timestamp > 0) {
            const timeDiff = (now - prevBytes.timestamp) / 1000;
            const bytesDiff = report.bytesSent - prevBytes.current;
            if (timeDiff > 0 && bytesDiff >= 0) {
              metrics.bitrateKbps = Math.round((bytesDiff * 8) / (timeDiff * 1000));
            }
          }
          prevBytes.current = report.bytesSent;
          prevBytes.timestamp = now;
        }
      }

      // Candidate Pair (Latency RTT)
      if (report.type === "candidate-pair" && report.state === "succeeded") {
        if (report.currentRoundTripTime !== undefined) {
          metrics.latencyMs = Math.round(report.currentRoundTripTime * 1000);
        }
      }

      // Track resolution
      if (report.type === "track" && report.kind === "video") {
        if (report.frameWidth) metrics.width = report.frameWidth;
        if (report.frameHeight) metrics.height = report.frameHeight;
      }
    });

    return metrics;
  } catch {
    return {};
  }
}
