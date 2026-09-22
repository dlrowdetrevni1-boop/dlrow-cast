import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const server = http.createServer(app);
// Respect the PORT injected by the host platform (Render, Railway, Fly...), fallback to 3000
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

interface Participant {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl?: string;
  role: "admin" | "participant";
  isMuted: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
  joinedAt: number;
  ws?: WebSocket;
  ip?: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: "admin" | "participant" | "system";
  text: string;
  timestamp: number;
  type: "chat" | "system" | "moderation";
}

interface ScreenConfig {
  resolution: "4k" | "1080p" | "720p" | "480p" | "auto";
  preset: "game" | "movie" | "reading" | "screen";
  fps: number;
  bitrateKbps: number;
}

interface Room {
  id: string;
  name: string;
  hostId: string;
  isLocked: boolean;
  allowParticipantScreenShare: boolean;
  bannedUserIds: Set<string>;
  bannedNames: Set<string>;
  participants: Map<string, Participant>;
  activeScreenSharerId: string | null;
  activeScreenConfig: ScreenConfig | null;
  chatMessages: ChatMessage[];
  createdAt: number;
}

const rooms = new Map<string, Room>();

// Helper to sanitize room state for clients
function getSanitizedRoomState(room: Room) {
  const participantsList = Array.from(room.participants.values()).map((p) => ({
    id: p.id,
    name: p.name,
    avatarColor: p.avatarColor,
    avatarUrl: p.avatarUrl,
    role: p.role,
    isMuted: p.isMuted,
    isSpeaking: p.isSpeaking,
    isScreenSharing: p.isScreenSharing,
    joinedAt: p.joinedAt,
  }));

  return {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    isLocked: room.isLocked,
    allowParticipantScreenShare: room.allowParticipantScreenShare,
    activeScreenSharerId: room.activeScreenSharerId,
    activeScreenConfig: room.activeScreenConfig,
    participants: participantsList,
    chatMessages: room.chatMessages.slice(-100),
    bannedCount: room.bannedUserIds.size,
    createdAt: room.createdAt,
  };
}

// Broadcast helper to send to all participants in a room
function broadcastToRoom(room: Room, message: any, excludeId?: string) {
  const payload = JSON.stringify(message);
  for (const [id, participant] of room.participants.entries()) {
    if (excludeId && id === excludeId) continue;
    if (participant.ws && participant.ws.readyState === WebSocket.OPEN) {
      participant.ws.send(payload);
    }
  }
}

// Send message to a specific participant
function sendToParticipant(room: Room, participantId: string, message: any) {
  const participant = room.participants.get(participantId);
  if (participant?.ws && participant.ws.readyState === WebSocket.OPEN) {
    participant.ws.send(JSON.stringify(message));
  }
}

// REST Endpoints
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", activeRooms: rooms.size, timestamp: Date.now() });
});

// Check if room exists and user can join (or initialize if accessing directly via valid link)
app.get("/api/rooms/:roomId/check", (req, res) => {
  const roomId = req.params.roomId.toUpperCase().trim();
  let room = rooms.get(roomId);

  const userId = req.query.userId as string;

  if (!room) {
    // If user opens a shared link where the room wasn't pre-created or host is waiting
    // If it's a valid code pattern (e.g. ABC-123 or at least 3 chars), allow entry and it will be created on WS join
    if (roomId.length >= 3 && /^[A-Z0-9-]+$/.test(roomId)) {
      return res.json({
        id: roomId,
        name: `Sala ${roomId}`,
        isLocked: false,
        participantCount: 0,
        activeScreenSharerId: null,
      });
    }
    return res.status(404).json({ error: "Código de sala inválido ou sala não encontrada" });
  }

  if (userId && room.bannedUserIds.has(userId)) {
    return res.status(403).json({ error: "Você foi banido desta sala pelo moderador" });
  }

  if (room.isLocked && userId !== room.hostId) {
    return res.status(423).json({ error: "Esta sala está trancada pelo administrador" });
  }

  res.json({
    id: room.id,
    name: room.name,
    isLocked: room.isLocked,
    participantCount: room.participants.size,
    activeScreenSharerId: room.activeScreenSharerId,
  });
});

// Create a new room
app.post("/api/rooms/create", (req, res) => {
  const { name, hostName, hostId, avatarColor } = req.body;
  const randomChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
  }
  const roomId = `${code.slice(0, 3)}-${code.slice(3, 6)}`;

  const newRoom: Room = {
    id: roomId,
    name: name || `Sala de Transmissão ${roomId}`,
    hostId: hostId,
    isLocked: false,
    allowParticipantScreenShare: true,
    bannedUserIds: new Set(),
    bannedNames: new Set(),
    participants: new Map(),
    activeScreenSharerId: null,
    activeScreenConfig: null,
    chatMessages: [
      {
        id: `sys-${Date.now()}`,
        senderId: "system",
        senderName: "Sistema",
        senderRole: "system",
        text: `Sala criada com sucesso! Código: ${roomId}. Convide participantes compartilhando o link.`,
        timestamp: Date.now(),
        type: "system",
      },
    ],
    createdAt: Date.now(),
  };

  rooms.set(roomId, newRoom);
  res.json({ roomId, name: newRoom.name, hostId });
});

// WebSocket Server for Signaling, State, Chat, and Moderation
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : "";
  if (pathname === "/ws" || pathname === "/ws/") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    // If not matching /ws, let Vite handle its own websocket or ignore
  }
});

wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
  let currentRoomId: string | null = null;
  let currentParticipantId: string | null = null;

  // Prevent an unhandled 'error' event on the socket from crashing the process
  ws.on("error", (err) => {
    console.warn("WebSocket connection error:", err?.message || err);
  });

  ws.on("message", (data: string) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        // Participant joins a room
        case "room:join": {
          const { roomId, participant } = msg;
          const cleanRoomId = (roomId || "").toUpperCase().trim();
          let room = rooms.get(cleanRoomId);

          if (!room) {
            // Auto-create room if entering directly with link
            room = {
              id: cleanRoomId,
              name: `Sala ${cleanRoomId}`,
              hostId: participant.id, // first joiner becomes host
              isLocked: false,
              allowParticipantScreenShare: true,
              bannedUserIds: new Set(),
              bannedNames: new Set(),
              participants: new Map(),
              activeScreenSharerId: null,
              activeScreenConfig: null,
              chatMessages: [
                {
                  id: `sys-${Date.now()}`,
                  senderId: "system",
                  senderName: "Sistema",
                  senderRole: "system",
                  text: `Sala iniciada. Conexão WebRTC de ultra-baixa latência ativa.`,
                  timestamp: Date.now(),
                  type: "system",
                },
              ],
              createdAt: Date.now(),
            };
            rooms.set(cleanRoomId, room);
          }

          // Check banned
          if (room.bannedUserIds.has(participant.id) || room.bannedNames.has(participant.name.toLowerCase())) {
            ws.send(
              JSON.stringify({
                type: "error:banned",
                message: "Você foi banido permanentemente desta sala pelo administrador.",
              })
            );
            ws.close();
            return;
          }

          // Check locked (allow host to rejoin)
          if (room.isLocked && participant.id !== room.hostId) {
            ws.send(
              JSON.stringify({
                type: "error:locked",
                message: "Esta sala está trancada pelo administrador.",
              })
            );
            ws.close();
            return;
          }

          currentRoomId = cleanRoomId;
          currentParticipantId = participant.id;

          // Only the registered host (room creator or auto-created owner) is admin.
          // Prevents a stranger from hijacking host role by joining a pre-created room first.
          const isHost = room.hostId === participant.id;
          if (isHost && room.participants.size === 0) {
            room.hostId = participant.id;
          }

          const newParticipant: Participant = {
            id: participant.id,
            name: participant.name || `Participante ${room.participants.size + 1}`,
            avatarColor: participant.avatarColor || "#6366f1",
            avatarUrl: participant.avatarUrl || undefined,
            role: isHost ? "admin" : "participant",
            isMuted: participant.isMuted ?? false,
            isSpeaking: false,
            isScreenSharing: false,
            joinedAt: Date.now(),
            ws,
          };

          room.participants.set(participant.id, newParticipant);

          // Add system message
          const joinMessage: ChatMessage = {
            id: `sys-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            senderId: "system",
            senderName: "Sistema",
            senderRole: "system",
            text: `${newParticipant.name} ${isHost ? "(Administrador)" : ""} entrou na sala`,
            timestamp: Date.now(),
            type: "system",
          };
          room.chatMessages.push(joinMessage);

          // Send full room state to the newly joined client
          ws.send(
            JSON.stringify({
              type: "room:sync",
              state: getSanitizedRoomState(room),
              selfId: participant.id,
              isHost,
            })
          );

          // Broadcast to everyone else that a user joined
          broadcastToRoom(
            room,
            {
              type: "user:joined",
              participant: {
                id: newParticipant.id,
                name: newParticipant.name,
                avatarColor: newParticipant.avatarColor,
                role: newParticipant.role,
                isMuted: newParticipant.isMuted,
                isSpeaking: false,
                isScreenSharing: false,
                joinedAt: newParticipant.joinedAt,
              },
              systemMessage: joinMessage,
            },
            participant.id
          );
          break;
        }

        // WebRTC Signaling: Offer, Answer, ICE Candidate, Stream Request
        case "signal:offer":
        case "signal:answer":
        case "signal:candidate":
        case "signal:request_stream":
        case "signal:mic_offer":
        case "signal:mic_answer":
        case "signal:mic_candidate": {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const { targetId } = msg;
          if (targetId) {
            sendToParticipant(room, targetId, {
              ...msg,
              senderId: currentParticipantId,
            });
          }
          break;
        }

        // Chat message
        case "chat:send": {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.participants.get(currentParticipantId);
          if (!sender) return;

          const text = (msg.text || "").trim();
          if (!text) return;

          const chatMsg: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            senderId: sender.id,
            senderName: sender.name,
            senderRole: sender.role,
            text,
            timestamp: Date.now(),
            type: "chat",
          };

          room.chatMessages.push(chatMsg);
          if (room.chatMessages.length > 200) room.chatMessages.shift();

          broadcastToRoom(room, {
            type: "chat:message",
            message: chatMsg,
          });
          break;
        }

        // Speaking indicator update
        case "user:speaking": {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const participant = room.participants.get(currentParticipantId);
          if (participant) {
            participant.isSpeaking = Boolean(msg.isSpeaking);
            broadcastToRoom(
              room,
              {
                type: "user:speaking",
                participantId: currentParticipantId,
                isSpeaking: participant.isSpeaking,
              },
              currentParticipantId
            );
          }
          break;
        }

        // Self Mute / Unmute
        case "user:toggle_mute": {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const participant = room.participants.get(currentParticipantId);
          if (participant) {
            participant.isMuted = Boolean(msg.isMuted);
            broadcastToRoom(room, {
              type: "user:mute_updated",
              participantId: currentParticipantId,
              isMuted: participant.isMuted,
            });
          }
          break;
        }

        // Profile update (name, avatarColor, avatarUrl)
        case "profile:update": {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const participant = room.participants.get(currentParticipantId);
          if (participant) {
            if (msg.name) participant.name = msg.name;
            if (msg.avatarColor) participant.avatarColor = msg.avatarColor;
            if (msg.avatarUrl !== undefined) participant.avatarUrl = msg.avatarUrl;
            // Lightweight participants-only sync: avoids replaying join sounds,
            // resetting session timers and re-requesting active streams on every edit.
            broadcastToRoom(room, {
              type: "room:participants_sync",
              participants: getSanitizedRoomState(room).participants,
            });
          }
          break;
        }

        // Screen share started
        case "screen:start": {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.participants.get(currentParticipantId);
          if (!sender) return;

          // Check permissions if restricted
          if (!room.allowParticipantScreenShare && sender.role !== "admin") {
            ws.send(
              JSON.stringify({
                type: "error:permission_denied",
                message: "Apenas o administrador tem permissão para transmitir a tela nesta sala.",
              })
            );
            return;
          }

          // If someone else was sharing, update them
          if (room.activeScreenSharerId && room.activeScreenSharerId !== currentParticipantId) {
            const previousSharer = room.participants.get(room.activeScreenSharerId);
            if (previousSharer) previousSharer.isScreenSharing = false;
          }

          sender.isScreenSharing = true;
          room.activeScreenSharerId = currentParticipantId;
          room.activeScreenConfig = msg.config || {
            resolution: "1080p",
            preset: "screen",
            fps: 60,
            bitrateKbps: 6000,
          };

          const sysMsg: ChatMessage = {
            id: `sys-${Date.now()}`,
            senderId: "system",
            senderName: "Sistema",
            senderRole: "system",
            text: `${sender.name} iniciou o compartilhamento de tela (${room.activeScreenConfig?.resolution.toUpperCase()} - Modo ${room.activeScreenConfig?.preset.toUpperCase()})`,
            timestamp: Date.now(),
            type: "system",
          };
          room.chatMessages.push(sysMsg);

          broadcastToRoom(room, {
            type: "screen:started",
            sharerId: currentParticipantId,
            sharerName: sender.name,
            config: room.activeScreenConfig,
            systemMessage: sysMsg,
          });
          break;
        }

        // Screen share quality/config updated on the fly (no new system message)
        case "screen:update_config": {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          // Only the active sharer can change the live stream config
          if (room.activeScreenSharerId !== currentParticipantId) return;

          room.activeScreenConfig = msg.config || room.activeScreenConfig;

          broadcastToRoom(room, {
            type: "screen:config_updated",
            sharerId: currentParticipantId,
            config: room.activeScreenConfig,
          });
          break;
        }

        // Screen share stopped
        case "screen:stop": {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const sender = room.participants.get(currentParticipantId);
          if (sender) sender.isScreenSharing = false;

          if (room.activeScreenSharerId === currentParticipantId) {
            room.activeScreenSharerId = null;
            room.activeScreenConfig = null;

            const sysMsg: ChatMessage = {
              id: `sys-${Date.now()}`,
              senderId: "system",
              senderName: "Sistema",
              senderRole: "system",
              text: `${sender?.name || "Participante"} encerrou o compartilhamento de tela`,
              timestamp: Date.now(),
              type: "system",
            };
            room.chatMessages.push(sysMsg);

            broadcastToRoom(room, {
              type: "screen:stopped",
              sharerId: currentParticipantId,
              systemMessage: sysMsg,
            });
          }
          break;
        }

        // Admin: Kick Participant
        case "admin:kick": {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const admin = room.participants.get(currentParticipantId);
          if (admin?.role !== "admin") return;

          const targetId = msg.targetId;
          const target = room.participants.get(targetId);
          if (!target || target.role === "admin") return;

          const modMsg: ChatMessage = {
            id: `mod-${Date.now()}`,
            senderId: "system",
            senderName: "Moderação",
            senderRole: "system",
            text: `${target.name} foi removido da sala pelo administrador.`,
            timestamp: Date.now(),
            type: "moderation",
          };
          room.chatMessages.push(modMsg);

          // Notify target
          if (target.ws && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(
              JSON.stringify({
                type: "kicked",
                reason: msg.reason || "Você foi removido da sala pelo administrador.",
              })
            );
            target.ws.close();
          }

          room.participants.delete(targetId);
          if (room.activeScreenSharerId === targetId) {
            room.activeScreenSharerId = null;
            room.activeScreenConfig = null;
          }

          broadcastToRoom(room, {
            type: "user:kicked",
            targetId,
            targetName: target.name,
            systemMessage: modMsg,
          });
          break;
        }

        // Admin: Ban Participant
        case "admin:ban": {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const admin = room.participants.get(currentParticipantId);
          if (admin?.role !== "admin") return;

          const targetId = msg.targetId;
          const target = room.participants.get(targetId);
          if (!target || target.role === "admin") return;

          room.bannedUserIds.add(targetId);
          room.bannedNames.add(target.name.toLowerCase());

          const modMsg: ChatMessage = {
            id: `mod-${Date.now()}`,
            senderId: "system",
            senderName: "Moderação",
            senderRole: "system",
            text: `${target.name} foi banido permanentemente da sala pelo administrador.`,
            timestamp: Date.now(),
            type: "moderation",
          };
          room.chatMessages.push(modMsg);

          // Notify target and disconnect
          if (target.ws && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(
              JSON.stringify({
                type: "banned",
                reason: msg.reason || "Você foi banido desta reunião pelo administrador.",
              })
            );
            target.ws.close();
          }

          room.participants.delete(targetId);
          if (room.activeScreenSharerId === targetId) {
            room.activeScreenSharerId = null;
            room.activeScreenConfig = null;
          }

          broadcastToRoom(room, {
            type: "user:banned",
            targetId,
            targetName: target.name,
            systemMessage: modMsg,
          });
          break;
        }

        // Admin: Force Mute Participant
        case "admin:mute_participant": {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const admin = room.participants.get(currentParticipantId);
          if (admin?.role !== "admin") return;

          const targetId = msg.targetId;
          const target = room.participants.get(targetId);
          if (!target) return;

          target.isMuted = true;
          target.isSpeaking = false;

          sendToParticipant(room, targetId, {
            type: "admin:force_muted",
            message: "O administrador silenciou seu microfone.",
          });

          broadcastToRoom(room, {
            type: "user:mute_updated",
            participantId: targetId,
            isMuted: true,
          });
          break;
        }

        // Admin: Toggle Lock Room
        case "admin:toggle_lock": {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const admin = room.participants.get(currentParticipantId);
          if (admin?.role !== "admin") return;

          room.isLocked = Boolean(msg.isLocked);

          const lockMsg: ChatMessage = {
            id: `mod-${Date.now()}`,
            senderId: "system",
            senderName: "Moderação",
            senderRole: "system",
            text: room.isLocked
              ? "A sala foi trancada. Novos participantes não poderão entrar."
              : "A sala foi destrancada. Novos participantes podem entrar normalmente.",
            timestamp: Date.now(),
            type: "moderation",
          };
          room.chatMessages.push(lockMsg);

          broadcastToRoom(room, {
            type: "room:lock_updated",
            isLocked: room.isLocked,
            systemMessage: lockMsg,
          });
          break;
        }

        // Admin: Toggle screen share permission for non-admins
        case "admin:toggle_screen_permission": {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const admin = room.participants.get(currentParticipantId);
          if (admin?.role !== "admin") return;

          room.allowParticipantScreenShare = Boolean(msg.allow);
          broadcastToRoom(room, {
            type: "room:screen_permission_updated",
            allowParticipantScreenShare: room.allowParticipantScreenShare,
          });
          break;
        }

        // Admin: End room for everyone
        case "admin:end_room": {
          if (!currentRoomId || !currentParticipantId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const admin = room.participants.get(currentParticipantId);
          if (admin?.role !== "admin") return;

          broadcastToRoom(room, {
            type: "room:ended",
            message: "O administrador encerrou a reunião para todos os participantes.",
          });

          for (const p of room.participants.values()) {
            if (p.ws && p.ws.readyState === WebSocket.OPEN) {
              p.ws.close();
            }
          }
          rooms.delete(currentRoomId);
          break;
        }
      }
    } catch (err) {
      console.error("Error processing websocket message:", err);
    }
  });

  ws.on("close", () => {
    if (!currentRoomId || !currentParticipantId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const departingUser = room.participants.get(currentParticipantId);
    room.participants.delete(currentParticipantId);

    if (room.activeScreenSharerId === currentParticipantId) {
      room.activeScreenSharerId = null;
      room.activeScreenConfig = null;
    }

    if (room.participants.size === 0) {
      // Clean up empty room after 10 minutes to conserve memory
      setTimeout(() => {
        const check = rooms.get(currentRoomId!);
        if (check && check.participants.size === 0) {
          rooms.delete(currentRoomId!);
        }
      }, 10 * 60 * 1000);
    } else {
      // If host left, appoint oldest remaining participant as new host
      if (room.hostId === currentParticipantId) {
        const nextHost = room.participants.values().next().value;
        if (nextHost) {
          nextHost.role = "admin";
          room.hostId = nextHost.id;

          const hostMsg: ChatMessage = {
            id: `sys-${Date.now()}`,
            senderId: "system",
            senderName: "Sistema",
            senderRole: "system",
            text: `${nextHost.name} agora é o novo Administrador da sala`,
            timestamp: Date.now(),
            type: "system",
          };
          room.chatMessages.push(hostMsg);

          broadcastToRoom(room, {
            type: "host:transferred",
            newHostId: nextHost.id,
            newHostName: nextHost.name,
            systemMessage: hostMsg,
          });
        }
      }

      if (departingUser) {
        const leaveMsg: ChatMessage = {
          id: `sys-${Date.now()}`,
          senderId: "system",
          senderName: "Sistema",
          senderRole: "system",
          text: `${departingUser.name} saiu da sala`,
          timestamp: Date.now(),
          type: "system",
        };
        room.chatMessages.push(leaveMsg);

        broadcastToRoom(room, {
          type: "user:left",
          participantId: currentParticipantId,
          participantName: departingUser.name,
          systemMessage: leaveMsg,
        });
      }
    }
  });
});

// Setup Vite or static serving
async function start() {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    (typeof __filename !== "undefined" && __filename.includes("dist"));

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // The dev server runs behind reverse proxies (Render, AI Studio, previews),
        // so accept any Host header and origin.
        allowedHosts: true,
        cors: true,
        // Attach Vite's HMR websocket to this same HTTP server so hot module
        // replacement works through the public port/proxy (Vite 8 API).
        ws: { server },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`dlrow cast Server running on port ${PORT}`);
  });
}

start();
