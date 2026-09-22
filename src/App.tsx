import React, { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "./components/Header";
import { ScreenPlayer } from "./components/ScreenPlayer";
import { ControlsBar } from "./components/ControlsBar";
import { ChatPanel } from "./components/ChatPanel";
import { ParticipantsPanel } from "./components/ParticipantsPanel";
import { AdminModal } from "./components/AdminModal";
import { QualityPresetModal } from "./components/QualityPresetModal";
import { ProfileModal } from "./components/ProfileModal";
import { HistoryModal } from "./components/HistoryModal";
import { LobbyView } from "./components/LobbyView";

import {
  RoomState,
  UserProfile,
  ScreenConfig,
  StreamMetrics,
  ResolutionOption,
  ChatMessage,
  SessionHistoryItem,
} from "./types";
import {
  loadUserProfile,
  saveUserProfile,
  loadSessionHistory,
  addSessionToHistory,
  clearSessionHistory,
} from "./utils/storage";
import {
  captureScreenStream,
  tuneSenderBitrate,
  extractPeerStats,
  RTC_CONFIG,
} from "./utils/webrtc";
import {
  VoiceActivityDetector,
  ParticipantAudioNode,
  playNotificationSound,
} from "./utils/audio";
import { getShareableRoomUrl, copyToClipboard } from "./utils/share";

export default function App() {
  // State
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => loadUserProfile());
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [history, setHistory] = useState<SessionHistoryItem[]>(() => loadSessionHistory());

  // WebRTC & Audio
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [localMicStream, setLocalMicStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [metrics, setMetrics] = useState<Partial<StreamMetrics>>({});

  // Individual Participant Volume & Mute (0% - 200%)
  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>({});
  const [participantMutes, setParticipantMutes] = useState<Record<string, boolean>>({});

  // Quality & Presets
  const [screenConfig, setScreenConfig] = useState<ScreenConfig>({
    resolution: currentUser.preferredResolution || "1080p",
    preset: currentUser.preferredPreset || "game",
    fps: 60,
    bitrateKbps: 8000,
  });

  // UI Panels & Modals
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isQualityModalOpen, setIsQualityModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const audioNodesRef = useRef<Map<string, ParticipantAudioNode>>(new Map());
  const prevBytesRef = useRef<{ current: number; timestamp: number }>({ current: 0, timestamp: 0 });
  const metricsIntervalRef = useRef<any>(null);

  // Voice mesh (participant <-> participant microphone audio)
  const micPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingMicIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pendingMicOffersRef = useRef<Map<string, any>>(new Map());
  const micReadyRef = useRef<"pending" | "ready" | "failed">("pending");

  // Connection lifecycle
  const intentionalCloseRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<any>(null);

  // Refs mirroring state, so websocket callbacks never work with stale closures
  const roomStateRef = useRef<RoomState | null>(null);
  const sessionStartTimeRef = useRef<number>(0);
  const currentRoomIdRef = useRef<string | null>(null);
  const localMicStreamRef = useRef<MediaStream | null>(null);
  const isMutedRef = useRef(false);
  const isChatOpenRef = useRef(false);
  const soundEnabledRef = useRef(true);
  const screenConfigRef = useRef<ScreenConfig>(screenConfig);
  const participantVolumesRef = useRef<Record<string, number>>({});
  const participantMutesRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    localScreenStreamRef.current = localScreenStream;
  }, [localScreenStream]);
  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);
  useEffect(() => {
    sessionStartTimeRef.current = sessionStartTime;
  }, [sessionStartTime]);
  useEffect(() => {
    currentRoomIdRef.current = currentRoomId;
  }, [currentRoomId]);
  useEffect(() => {
    localMicStreamRef.current = localMicStream;
  }, [localMicStream]);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);
  useEffect(() => {
    screenConfigRef.current = screenConfig;
  }, [screenConfig]);
  useEffect(() => {
    participantVolumesRef.current = participantVolumes;
  }, [participantVolumes]);
  useEffect(() => {
    participantMutesRef.current = participantMutes;
  }, [participantMutes]);

  // Check URL on load for room code
  const [initialRoomFromUrl, setInitialRoomFromUrl] = useState<string>("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromQuery = params.get("room");
    if (roomFromQuery) {
      setInitialRoomFromUrl(roomFromQuery.toUpperCase());
    }
  }, []);

  // Update URL search query
  const updateUrlParam = (roomId: string | null) => {
    const url = new URL(window.location.href);
    if (roomId) {
      url.searchParams.set("room", roomId);
    } else {
      url.searchParams.delete("room");
    }
    window.history.pushState({}, "", url.toString());
  };

  // Connect WebSocket when entering room
  const connectWebSocket = useCallback(
    (roomId: string) => {
      intentionalCloseRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        // Mark the old socket's close as intentional so it doesn't trigger reconnect
        const oldWs = wsRef.current;
        (oldWs as any).__intentional = true;
        oldWs.onclose = null;
        oldWs.close();
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send join event
        ws.send(
          JSON.stringify({
            type: "room:join",
            roomId,
            participant: {
              id: currentUser.id,
              name: currentUser.name,
              avatarColor: currentUser.avatarColor,
              avatarUrl: currentUser.avatarUrl,
              isMuted: isMutedRef.current,
            },
          })
        );
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "room:sync": {
              const isReconnect = roomStateRef.current?.id === data.state.id;
              setRoomState(data.state);
              setCurrentRoomId(data.state.id);
              if (!isReconnect) {
                setSessionStartTime(Date.now());
              }
              updateUrlParam(data.state.id);
              reconnectAttemptsRef.current = 0;
              if (soundEnabled) playNotificationSound("join");

              // If someone is already screen sharing in this room, immediately request stream
              if (
                data.state.activeScreenSharerId &&
                data.state.activeScreenSharerId !== currentUser.id
              ) {
                setTimeout(() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(
                      JSON.stringify({
                        type: "signal:request_stream",
                        targetId: data.state.activeScreenSharerId,
                      })
                    );
                  }
                }, 300);
              }

              // (Re)establish voice mesh with participants that have a "greater" id than ours
              ensureMicOffers(data.state.participants);

              // If we were sharing our screen before a disconnect, announce and re-offer
              if (isReconnect && localScreenStreamRef.current) {
                ws.send(
                  JSON.stringify({
                    type: "screen:start",
                    config: screenConfigRef.current,
                  })
                );
                for (const p of data.state.participants) {
                  if (p.id !== currentUser.id) {
                    createPeerConnectionAndOffer(p.id, localScreenStreamRef.current);
                  }
                }
              }
              break;
            }

            // Lightweight participants refresh (e.g. someone edited their profile)
            case "room:participants_sync": {
              setRoomState((prev) => {
                if (!prev) return null;
                return { ...prev, participants: data.participants };
              });
              break;
            }

            // Live stream quality config changed by the sharer
            case "screen:config_updated": {
              setRoomState((prev) => {
                if (!prev) return null;
                return { ...prev, activeScreenConfig: data.config };
              });
              break;
            }

            case "user:joined": {
              setRoomState((prev) => {
                if (!prev) return null;
                const existing = prev.participants.filter((p) => p.id !== data.participant.id);
                return {
                  ...prev,
                  participants: [...existing, data.participant],
                  chatMessages: [...prev.chatMessages, data.systemMessage],
                };
              });

              if (soundEnabled) playNotificationSound("join");

              // If I am currently screen sharing, create WebRTC offer for this new participant
              if (localScreenStreamRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
                createPeerConnectionAndOffer(data.participant.id, localScreenStreamRef.current);
              }

              // Voice mesh: the participant with the "smaller" id initiates the mic connection
              if (
                currentUser.id < data.participant.id &&
                micReadyRef.current !== "pending" &&
                !micPeersRef.current.has(data.participant.id)
              ) {
                createMicOffer(data.participant.id);
              }
              break;
            }

            case "user:left": {
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  participants: prev.participants.filter((p) => p.id !== data.participantId),
                  chatMessages: [...prev.chatMessages, data.systemMessage],
                  activeScreenSharerId:
                    prev.activeScreenSharerId === data.participantId ? null : prev.activeScreenSharerId,
                };
              });

              // Clean up peer connection for left user
              const pc = peerConnectionsRef.current.get(data.participantId);
              if (pc) {
                pc.close();
                peerConnectionsRef.current.delete(data.participantId);
              }
              pendingIceCandidatesRef.current.delete(data.participantId);

              // Clean up voice mesh connection for left user
              closeMicPeer(data.participantId);
              pendingMicOffersRef.current.delete(data.participantId);

              if (soundEnabled) playNotificationSound("leave");
              break;
            }

            case "user:speaking": {
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  participants: prev.participants.map((p) =>
                    p.id === data.participantId ? { ...p, isSpeaking: data.isSpeaking } : p
                  ),
                };
              });
              break;
            }

            case "user:mute_updated": {
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  participants: prev.participants.map((p) =>
                    p.id === data.participantId ? { ...p, isMuted: data.isMuted } : p
                  ),
                };
              });
              break;
            }

            case "chat:message": {
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  // Cap local history so long sessions don't grow unbounded
                  chatMessages: [...prev.chatMessages, data.message].slice(-300),
                };
              });

              if (data.message.senderId !== currentUser.id) {
                if (!isChatOpenRef.current) {
                  setUnreadCount((c) => c + 1);
                }
                if (soundEnabled) playNotificationSound("message");
              }
              break;
            }

            case "screen:started": {
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  activeScreenSharerId: data.sharerId,
                  activeScreenConfig: data.config,
                  chatMessages: [...prev.chatMessages, data.systemMessage],
                };
              });
              if (soundEnabled) playNotificationSound("message");

              // If someone else started sharing, ask for the stream
              if (data.sharerId !== currentUser.id) {
                setTimeout(() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(
                      JSON.stringify({
                        type: "signal:request_stream",
                        targetId: data.sharerId,
                      })
                    );
                  }
                }, 350);
              }
              break;
            }

            case "screen:stopped": {
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  activeScreenSharerId: null,
                  activeScreenConfig: null,
                  chatMessages: [...prev.chatMessages, data.systemMessage],
                };
              });
              setRemoteScreenStream(null);

              // Close the now-dead screen connection to the former sharer
              const sharerPc = peerConnectionsRef.current.get(data.sharerId);
              if (sharerPc) {
                try {
                  sharerPc.close();
                } catch {}
                peerConnectionsRef.current.delete(data.sharerId);
              }
              pendingIceCandidatesRef.current.delete(data.sharerId);
              break;
            }

            // WebRTC Signaling: Stream Request (from viewer to sharer)
            case "signal:request_stream": {
              const { senderId } = data;
              if (localScreenStreamRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
                createPeerConnectionAndOffer(senderId, localScreenStreamRef.current);
              }
              break;
            }

            // WebRTC Signaling: Offer
            case "signal:offer": {
              const { senderId, sdp } = data;
              const pc = getOrCreatePeerConnection(senderId);
              await pc.setRemoteDescription(new RTCSessionDescription(sdp));

              // Drain any queued ICE candidates
              const queued = pendingIceCandidatesRef.current.get(senderId);
              if (queued && queued.length > 0) {
                for (const cand of queued) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (err) {
                    console.warn("Could not add queued ice candidate in offer:", err);
                  }
                }
                pendingIceCandidatesRef.current.delete(senderId);
              }

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              ws.send(
                JSON.stringify({
                  type: "signal:answer",
                  targetId: senderId,
                  sdp: answer,
                })
              );
              break;
            }

            // WebRTC Signaling: Answer
            case "signal:answer": {
              const { senderId, sdp } = data;
              const pc = peerConnectionsRef.current.get(senderId);
              if (pc && pc.signalingState !== "closed") {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));

                // Drain any queued ICE candidates
                const queued = pendingIceCandidatesRef.current.get(senderId);
                if (queued && queued.length > 0) {
                  for (const cand of queued) {
                    try {
                      await pc.addIceCandidate(new RTCIceCandidate(cand));
                    } catch (err) {
                      console.warn("Could not add queued ice candidate in answer:", err);
                    }
                  }
                  pendingIceCandidatesRef.current.delete(senderId);
                }
              }
              break;
            }

            // WebRTC Signaling: ICE Candidate
            case "signal:candidate": {
              const { senderId, candidate } = data;
              if (!candidate) break;
              const pc = peerConnectionsRef.current.get(senderId);
              if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                  console.warn("Could not add ice candidate immediately:", err);
                }
              } else {
                const list = pendingIceCandidatesRef.current.get(senderId) || [];
                list.push(candidate);
                pendingIceCandidatesRef.current.set(senderId, list);
              }
              break;
            }

            // Voice Mesh Signaling: Mic Offer (participant -> participant audio)
            case "signal:mic_offer": {
              const { senderId, sdp } = data;
              if (micReadyRef.current === "pending") {
                // Our microphone isn't resolved yet; queue and answer once ready
                pendingMicOffersRef.current.set(senderId, sdp);
                break;
              }
              await acceptMicOffer(senderId, sdp);
              break;
            }

            // Voice Mesh Signaling: Mic Answer
            case "signal:mic_answer": {
              const { senderId, sdp } = data;
              const micPc = micPeersRef.current.get(senderId);
              if (micPc && micPc.signalingState !== "closed") {
                try {
                  await micPc.setRemoteDescription(new RTCSessionDescription(sdp));
                  const queuedMic = pendingMicIceRef.current.get(senderId);
                  if (queuedMic && queuedMic.length > 0) {
                    for (const cand of queuedMic) {
                      try {
                        await micPc.addIceCandidate(new RTCIceCandidate(cand));
                      } catch (err) {
                        console.warn("Could not add queued mic ice candidate:", err);
                      }
                    }
                    pendingMicIceRef.current.delete(senderId);
                  }
                } catch (err) {
                  console.warn("Failed to apply mic answer:", err);
                }
              }
              break;
            }

            // Voice Mesh Signaling: Mic ICE Candidate
            case "signal:mic_candidate": {
              const { senderId, candidate } = data;
              if (!candidate) break;
              const micPc = micPeersRef.current.get(senderId);
              if (micPc && micPc.remoteDescription && micPc.remoteDescription.type) {
                try {
                  await micPc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                  console.warn("Could not add mic ice candidate immediately:", err);
                }
              } else {
                const list = pendingMicIceRef.current.get(senderId) || [];
                list.push(candidate);
                pendingMicIceRef.current.set(senderId, list);
              }
              break;
            }

            // Moderation Events
            case "admin:force_muted": {
              setIsMuted(true);
              if (localMicStreamRef.current) {
                localMicStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
              }
              if (soundEnabled) playNotificationSound("moderation");
              alert(data.message || "Seu microfone foi silenciado pelo administrador.");
              break;
            }

            case "kicked": {
              if (soundEnabled) playNotificationSound("moderation");
              alert(data.reason || "Você foi removido da sala pelo administrador.");
              leaveRoom();
              break;
            }

            case "banned": {
              if (soundEnabled) playNotificationSound("moderation");
              alert(data.reason || "Você foi banido permanentemente desta sala pelo administrador.");
              leaveRoom();
              break;
            }

            case "user:kicked":
            case "user:banned": {
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  participants: prev.participants.filter((p) => p.id !== data.targetId),
                  chatMessages: [...prev.chatMessages, data.systemMessage],
                  bannedCount:
                    data.type === "user:banned" ? prev.bannedCount + 1 : prev.bannedCount,
                };
              });
              if (soundEnabled) playNotificationSound("moderation");
              break;
            }

            case "room:lock_updated": {
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  isLocked: data.isLocked,
                  chatMessages: [...prev.chatMessages, data.systemMessage],
                };
              });
              if (soundEnabled) playNotificationSound("moderation");
              break;
            }

            case "room:screen_permission_updated": {
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  allowParticipantScreenShare: data.allowParticipantScreenShare,
                };
              });
              break;
            }

            case "room:ended": {
              if (soundEnabled) playNotificationSound("moderation");
              alert(data.message || "A reunião foi encerrada pelo administrador.");
              leaveRoom();
              break;
            }

            case "host:transferred": {
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  hostId: data.newHostId,
                  participants: prev.participants.map((p) =>
                    p.id === data.newHostId ? { ...p, role: "admin" } : p
                  ),
                  chatMessages: [...prev.chatMessages, data.systemMessage],
                };
              });
              break;
            }

            case "error:banned":
            case "error:locked": {
              setErrorMessage(data.message);
              leaveRoom();
              break;
            }
          }
        } catch (err) {
          console.error("Error processing ws payload:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        if (intentionalCloseRef.current) return;

        // Unexpected drop: tear down dead media connections but keep the UI,
        // then try to rejoin automatically with exponential backoff.
        peerConnectionsRef.current.forEach((pc) => {
          try {
            pc.close();
          } catch {}
        });
        peerConnectionsRef.current.clear();
        pendingIceCandidatesRef.current.clear();
        closeAllMicPeers();
        setRemoteScreenStream(null);

        const attempt = reconnectAttemptsRef.current;
        if (attempt < 5 && currentRoomIdRef.current) {
          reconnectAttemptsRef.current = attempt + 1;
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
          console.log(`Reconnecting to room in ${delay}ms (attempt ${attempt + 1})`);
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            if (!intentionalCloseRef.current && currentRoomIdRef.current) {
              connectWebSocket(currentRoomIdRef.current);
            }
          }, delay);
        } else {
          setErrorMessage("Conexão perdida com o servidor. Tente entrar novamente.");
          leaveRoom();
        }
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  // Helper: get or create RTCPeerConnection for viewer
  const getOrCreatePeerConnection = (targetId: string): RTCPeerConnection => {
    let pc = peerConnectionsRef.current.get(targetId);
    // Recreate when closed or stuck mid-negotiation (e.g. duplicate offer after reconnect)
    if (pc && pc.signalingState !== "closed" && pc.signalingState !== "stable") {
      try {
        pc.close();
      } catch {}
      peerConnectionsRef.current.delete(targetId);
      pendingIceCandidatesRef.current.delete(targetId);
      pc = undefined;
    }
    if (!pc || pc.signalingState === "closed") {
      pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current.set(targetId, pc);

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "signal:candidate",
              targetId,
              candidate: event.candidate,
            })
          );
        }
      };

      pc.ontrack = (event) => {
        let stream = event.streams && event.streams[0];
        if (!stream) {
          stream = new MediaStream([event.track]);
        }
        if (event.track.kind === "video") {
          setRemoteScreenStream(stream);
        }
        // Note: the screen stream's system audio is played by the <video> element.
        // Creating an extra audio node here would play it twice (echo).
      };
    }
    return pc;
  };

  // Helper: create WebRTC offer to viewer
  const createPeerConnectionAndOffer = async (targetId: string, stream: MediaStream) => {
    const existing = peerConnectionsRef.current.get(targetId);
    if (existing) {
      try {
        existing.close();
      } catch (e) {}
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current.set(targetId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "signal:candidate",
            targetId,
            candidate: event.candidate,
          })
        );
      }
    };

    // Add all tracks from screen stream
    stream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, stream);
      if (track.kind === "video") {
        tuneSenderBitrate(sender, screenConfig);
      }
    });

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      wsRef.current?.send(
        JSON.stringify({
          type: "signal:offer",
          targetId,
          sdp: offer,
        })
      );
    } catch (err) {
      console.warn("Failed to create offer:", err);
    }
  };

  // ------------------------------------------------------------------
  // Voice Mesh: participant <-> participant microphone audio (full mesh)
  // ------------------------------------------------------------------

  // Create (or reuse) a per-participant audio node honoring current volume/mute
  const attachRemoteAudioNode = (participantId: string, stream: MediaStream) => {
    let audioNode = audioNodesRef.current.get(participantId);
    if (!audioNode) {
      audioNode = new ParticipantAudioNode(stream);
      audioNodesRef.current.set(participantId, audioNode);
      const savedVolume = participantVolumesRef.current[participantId];
      if (savedVolume !== undefined) audioNode.setVolume(savedVolume);
      if (participantMutesRef.current[participantId]) audioNode.setMute(true);
    }
    return audioNode;
  };

  const wireMicPeer = (pc: RTCPeerConnection, peerId: string) => {
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "signal:mic_candidate",
            targetId: peerId,
            candidate: event.candidate,
          })
        );
      }
    };

    pc.ontrack = (event) => {
      if (event.track.kind === "audio") {
        const stream = event.streams[0] || new MediaStream([event.track]);
        attachRemoteAudioNode(peerId, stream);
      }
    };
  };

  const addLocalMicTracks = (pc: RTCPeerConnection) => {
    const stream = localMicStreamRef.current;
    if (!stream || pc.getSenders().length > 0) return;
    stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));
  };

  // Initiate a mic connection towards a participant (we only initiate towards "greater" ids)
  const createMicOffer = async (targetId: string) => {
    const existing = micPeersRef.current.get(targetId);
    if (existing && existing.signalingState !== "closed") return;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    micPeersRef.current.set(targetId, pc);
    wireMicPeer(pc, targetId);
    addLocalMicTracks(pc);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current?.send(
        JSON.stringify({
          type: "signal:mic_offer",
          targetId,
          sdp: offer,
        })
      );
    } catch (err) {
      console.warn("Failed to create mic offer:", err);
    }
  };

  // Answer an incoming mic offer (also handles re-offers/renegotiation)
  const acceptMicOffer = async (senderId: string, sdp: any) => {
    let pc = micPeersRef.current.get(senderId);
    if (!pc || pc.signalingState === "closed") {
      pc = new RTCPeerConnection(RTC_CONFIG);
      micPeersRef.current.set(senderId, pc);
      wireMicPeer(pc, senderId);
    }
    addLocalMicTracks(pc);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      const queued = pendingMicIceRef.current.get(senderId);
      if (queued && queued.length > 0) {
        for (const cand of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (err) {
            console.warn("Could not add queued mic ice candidate in offer:", err);
          }
        }
        pendingMicIceRef.current.delete(senderId);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsRef.current?.send(
        JSON.stringify({
          type: "signal:mic_answer",
          targetId: senderId,
          sdp: answer,
        })
      );
    } catch (err) {
      console.warn("Failed to answer mic offer:", err);
    }
  };

  const closeMicPeer = (peerId: string) => {
    const pc = micPeersRef.current.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch {}
      micPeersRef.current.delete(peerId);
    }
    pendingMicIceRef.current.delete(peerId);
    const audioNode = audioNodesRef.current.get(peerId);
    if (audioNode) {
      audioNode.dispose();
      audioNodesRef.current.delete(peerId);
    }
  };

  const closeAllMicPeers = () => {
    for (const peerId of Array.from(micPeersRef.current.keys())) {
      closeMicPeer(peerId);
    }
    pendingMicOffersRef.current.clear();
  };

  // Offer mic connections to every participant with a "greater" id that doesn't have one yet
  const ensureMicOffers = (participants: { id: string }[]) => {
    if (micReadyRef.current === "pending") return;
    for (const p of participants) {
      if (p.id !== currentUser.id && currentUser.id < p.id && !micPeersRef.current.has(p.id)) {
        createMicOffer(p.id);
      }
    }
  };

  // Answer offers that arrived while our microphone was still being resolved
  const drainPendingMicOffers = async () => {
    for (const [senderId, sdp] of Array.from(pendingMicOffersRef.current.entries())) {
      pendingMicOffersRef.current.delete(senderId);
      await acceptMicOffer(senderId, sdp);
    }
  };

  // Start microphone and speaking detector
  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio:
          currentUser.preferredMicId && currentUser.preferredMicId !== "default"
            ? { deviceId: { exact: currentUser.preferredMicId } }
            : true,
      });
      setLocalMicStream(stream);
      localMicStreamRef.current = stream;
      micReadyRef.current = "ready";

      // Apply current mute state to the fresh track
      stream.getAudioTracks().forEach((t) => (t.enabled = !isMutedRef.current));

      // Voice Activity Detector
      const vad = new VoiceActivityDetector((speaking) => {
        setIsSpeaking(speaking);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "user:speaking",
              isSpeaking: speaking,
            })
          );
        }
      });
      vad.start(stream);
      vadRef.current = vad;
    } catch (err) {
      console.warn("Microphone access not granted or unavailable:", err);
      micReadyRef.current = "failed";
    } finally {
      // Even without a mic we must answer pending offers so we can hear others,
      // and initiate offers that were waiting for our mic to resolve.
      await drainPendingMicOffers();
      const rs = roomStateRef.current;
      if (rs) ensureMicOffers(rs.participants);
    }
  };

  // Toggle Mute / Unmute
  const handleToggleMute = () => {
    const nextMuted = !isMutedRef.current;
    setIsMuted(nextMuted);

    if (localMicStreamRef.current) {
      localMicStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "user:toggle_mute",
          isMuted: nextMuted,
        })
      );
    }
  };

  // Start Screen Sharing
  const handleStartScreenShare = async () => {
    try {
      const stream = await captureScreenStream(screenConfig);
      setLocalScreenStream(stream);

      // When user clicks the browser native "Stop Sharing" button
      stream.getVideoTracks()[0].onended = () => {
        handleStopScreenShare();
      };

      // Broadcast to room
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "screen:start",
            config: screenConfig,
          })
        );
      }

      // Create WebRTC offer for all other connected participants
      if (roomState) {
        for (const p of roomState.participants) {
          if (p.id !== currentUser.id) {
            createPeerConnectionAndOffer(p.id, stream);
          }
        }
      }
    } catch (err: any) {
      console.warn("Error starting screen share:", err);
    }
  };

  // Stop Screen Sharing
  const handleStopScreenShare = () => {
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((t) => t.stop());
      setLocalScreenStream(null);

      // Close the screen peer connections we had open towards viewers
      peerConnectionsRef.current.forEach((pc) => {
        try {
          pc.close();
        } catch {}
      });
      peerConnectionsRef.current.clear();
      pendingIceCandidatesRef.current.clear();
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "screen:stop",
        })
      );
    }
  };

  const handleToggleScreenShare = () => {
    if (localScreenStream) {
      handleStopScreenShare();
    } else {
      handleStartScreenShare();
    }
  };

  // Leave room and cleanup
  const leaveRoom = () => {
    const activeRoom = roomStateRef.current;
    if (activeRoom && sessionStartTimeRef.current > 0) {
      // Save session to history
      const durationSeconds = Math.round((Date.now() - sessionStartTimeRef.current) / 1000);
      addSessionToHistory({
        roomId: activeRoom.id,
        roomName: activeRoom.name,
        joinedAt: sessionStartTimeRef.current,
        leftAt: Date.now(),
        durationSeconds: Math.max(1, durationSeconds),
        role: activeRoom.hostId === currentUser.id ? "admin" : "participant",
        maxParticipants: activeRoom.participants.length,
        streamQualityUsed: activeRoom.activeScreenConfig?.resolution,
      });
      setHistory(loadSessionHistory());
    }

    // Stop streams
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((t) => t.stop());
      setLocalScreenStream(null);
    }
    if (localMicStreamRef.current) {
      localMicStreamRef.current.getTracks().forEach((t) => t.stop());
      setLocalMicStream(null);
      localMicStreamRef.current = null;
    }
    micReadyRef.current = "pending";
    if (vadRef.current) {
      vadRef.current.stop();
      vadRef.current = null;
    }

    // Close peer connections (screen + voice mesh)
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    closeAllMicPeers();

    // Close websocket (mark intentional so no reconnect is attempted)
    intentionalCloseRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    reconnectAttemptsRef.current = 0;

    setRoomState(null);
    setCurrentRoomId(null);
    setRemoteScreenStream(null);
    setIsSpeaking(false);
    updateUrlParam(null);
  };

  // Actions
  const handleCreateRoom = async (roomName?: string) => {
    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName,
          hostName: currentUser.name,
          hostId: currentUser.id,
          avatarColor: currentUser.avatarColor,
        }),
      });
      const data = await res.json();
      connectWebSocket(data.roomId);
      startMicrophone();
    } catch (err) {
      console.error("Error creating room:", err);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    try {
      setErrorMessage(null);
      // Pre-check room
      const res = await fetch(`/api/rooms/${roomId}/check?userId=${currentUser.id}`);
      if (!res.ok) {
        const errorData = await res.json();
        setErrorMessage(errorData.error || "Não foi possível entrar na sala.");
        return;
      }
      connectWebSocket(roomId);
      startMicrophone();
    } catch (err) {
      setErrorMessage("Erro ao conectar à sala. Verifique sua conexão.");
    }
  };

  const handleSendMessage = (text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "chat:send",
          text,
        })
      );
    }
  };

  // Individual Participant Volume & Mute Handlers (0% to 200%)
  const handleSetVolume = (participantId: string, volume: number) => {
    setParticipantVolumes((prev) => ({ ...prev, [participantId]: volume }));
    const audioNode = audioNodesRef.current.get(participantId);
    if (audioNode) {
      audioNode.setVolume(volume);
    }
  };

  const handleToggleParticipantMute = (participantId: string) => {
    const next = !participantMutes[participantId];
    setParticipantMutes((prev) => ({ ...prev, [participantId]: next }));
    const audioNode = audioNodesRef.current.get(participantId);
    if (audioNode) {
      audioNode.setMute(next);
    }
  };

  // Admin Moderation Handlers
  const handleKickParticipant = (targetId: string, name: string) => {
    if (confirm(`Deseja remover ${name} da sala?`)) {
      wsRef.current?.send(
        JSON.stringify({
          type: "admin:kick",
          targetId,
          reason: "Removido da reunião pelo moderador.",
        })
      );
    }
  };

  const handleBanParticipant = (targetId: string, name: string) => {
    if (confirm(`Deseja banir ${name} permanentemente desta reunião? Ele não poderá retornar.`)) {
      wsRef.current?.send(
        JSON.stringify({
          type: "admin:ban",
          targetId,
          reason: "Banido permanentemente pelo moderador.",
        })
      );
    }
  };

  const handleForceMuteParticipant = (targetId: string) => {
    wsRef.current?.send(
      JSON.stringify({
        type: "admin:mute_participant",
        targetId,
      })
    );
  };

  const handleToggleLock = (isLocked: boolean) => {
    wsRef.current?.send(
      JSON.stringify({
        type: "admin:toggle_lock",
        isLocked,
      })
    );
  };

  const handleToggleScreenPermission = (allow: boolean) => {
    wsRef.current?.send(
      JSON.stringify({
        type: "admin:toggle_screen_permission",
        allow,
      })
    );
  };

  const handleEndRoom = () => {
    wsRef.current?.send(
      JSON.stringify({
        type: "admin:end_room",
      })
    );
    setIsAdminModalOpen(false);
    leaveRoom();
  };

  // Apply a new screen config (resolution/preset/fps) on the fly without restarting the stream
  const handleApplyScreenConfig = (newConfig: ScreenConfig) => {
    setScreenConfig(newConfig);
    if (!localScreenStreamRef.current) return;

    // Re-tune sender bitrates for all connected peers
    peerConnectionsRef.current.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === "video") {
          tuneSenderBitrate(sender, newConfig);
        }
      });
    });
    // Notify room (dedicated message: no chat spam)
    wsRef.current?.send(
      JSON.stringify({
        type: "screen:update_config",
        config: newConfig,
      })
    );
  };

  // Change resolution on the fly
  const handleSelectResolution = (res: ResolutionOption) => {
    handleApplyScreenConfig({ ...screenConfigRef.current, resolution: res });
  };

  // Keyboard shortcuts (M for mute, Spacebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in chat or input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        handleToggleMute();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMuted, localMicStream]);

  // Periodic metrics collector for WebRTC HUD
  useEffect(() => {
    if (roomState?.activeScreenSharerId) {
      metricsIntervalRef.current = setInterval(async () => {
        // Collect from first available active peer connection
        for (const [_, pc] of peerConnectionsRef.current) {
          if (pc.iceConnectionState === "connected" || pc.connectionState === "connected") {
            const currentStats = await extractPeerStats(pc, prevBytesRef.current);
            setMetrics((prev) => ({ ...prev, ...currentStats }));
            break;
          }
        }
      }, 1000);
    } else {
      setMetrics({});
    }

    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, [roomState?.activeScreenSharerId]);

  const isAdmin = Boolean(roomState && roomState.hostId === currentUser.id);
  const canShare = Boolean(
    roomState && (roomState.allowParticipantScreenShare || roomState.hostId === currentUser.id)
  );

  // Active stream displayed in main player: local if sharing, or remote if viewer
  const displayedStream = localScreenStream || remoteScreenStream;

  return (
    <div className="min-h-screen w-full bg-black text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-zinc-100">
      {!roomState ? (
        <LobbyView
          currentUser={currentUser}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          recentSessions={history}
          initialRoomCode={initialRoomFromUrl}
          error={errorMessage}
        />
      ) : (
        <div className="h-screen w-screen flex flex-col overflow-hidden relative bg-black">
          {/* Top Bar */}
          <Header
            roomState={roomState}
            currentUser={currentUser}
            metrics={metrics}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            onOpenHistory={() => setIsHistoryModalOpen(true)}
            onOpenAdmin={() => setIsAdminModalOpen(true)}
            onOpenQualityModal={() => setIsQualityModalOpen(true)}
            isAdmin={isAdmin}
          />

          {/* Main Stage & Sidebars */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Main Stage Screen Player */}
            <ScreenPlayer
              stream={displayedStream}
              isLocalSharing={Boolean(localScreenStream)}
              roomState={roomState}
              metrics={metrics}
              onStartShare={handleStartScreenShare}
              onOpenQualityModal={() => setIsQualityModalOpen(true)}
              onSelectResolution={handleSelectResolution}
              canShare={canShare}
            />

            {/* Participants Panel */}
            <ParticipantsPanel
              isOpen={isParticipantsOpen}
              onClose={() => setIsParticipantsOpen(false)}
              participants={roomState.participants}
              currentUser={currentUser}
              isAdmin={isAdmin}
              activeSharerId={roomState.activeScreenSharerId}
              participantVolumes={participantVolumes}
              participantMutes={participantMutes}
              onSetVolume={handleSetVolume}
              onToggleParticipantMute={handleToggleParticipantMute}
              onKickParticipant={handleKickParticipant}
              onBanParticipant={handleBanParticipant}
              onForceMuteParticipant={handleForceMuteParticipant}
            />

            {/* Chat Panel */}
            <ChatPanel
              isOpen={isChatOpen}
              onClose={() => setIsChatOpen(false)}
              messages={roomState.chatMessages}
              onSendMessage={handleSendMessage}
              currentUser={currentUser}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled(!soundEnabled)}
              sharerId={roomState.activeScreenSharerId}
              participants={roomState.participants}
            />
          </div>

          {/* Floating Controls Bar */}
          <ControlsBar
            isMuted={isMuted}
            isSpeaking={isSpeaking}
            onToggleMute={handleToggleMute}
            isScreenSharing={Boolean(localScreenStream)}
            onToggleScreenShare={handleToggleScreenShare}
            screenConfig={screenConfig}
            onOpenQualityModal={() => setIsQualityModalOpen(true)}
            isChatOpen={isChatOpen}
            onToggleChat={() => {
              setIsChatOpen(!isChatOpen);
              if (!isChatOpen) setUnreadCount(0);
            }}
            unreadCount={unreadCount}
            isParticipantsOpen={isParticipantsOpen}
            onToggleParticipants={() => setIsParticipantsOpen(!isParticipantsOpen)}
            participantCount={roomState.participants.length}
            isAdmin={isAdmin}
            onOpenAdmin={() => setIsAdminModalOpen(true)}
            onLeaveRoom={leaveRoom}
            canShare={canShare}
            onCopyRoomLink={async () => {
              if (roomState) {
                const url = getShareableRoomUrl(roomState.id);
                await copyToClipboard(url);
              }
            }}
          />
        </div>
      )}

      {/* Modals */}
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        roomState={roomState}
        currentUserId={currentUser.id}
        onToggleLock={handleToggleLock}
        onToggleScreenPermission={handleToggleScreenPermission}
        onKickParticipant={handleKickParticipant}
        onBanParticipant={handleBanParticipant}
        onForceMuteParticipant={handleForceMuteParticipant}
        onEndRoom={handleEndRoom}
      />

      <QualityPresetModal
        isOpen={isQualityModalOpen}
        onClose={() => setIsQualityModalOpen(false)}
        config={screenConfig}
        onChangeConfig={(newConfig) => {
          handleApplyScreenConfig(newConfig);
        }}
        isTransmitting={Boolean(localScreenStream)}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={currentUser}
        onSaveProfile={(updated) => {
          setCurrentUser(updated);
          saveUserProfile(updated);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "profile:update",
                name: updated.name,
                avatarColor: updated.avatarColor,
                avatarUrl: updated.avatarUrl || null,
              })
            );
          }
        }}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        history={history}
        onRejoinRoom={(roomId) => {
          handleJoinRoom(roomId);
        }}
        onClearHistory={() => {
          clearSessionHistory();
          setHistory([]);
        }}
      />
    </div>
  );
}
