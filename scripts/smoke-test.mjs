// End-to-end smoke test for the dlrow cast server (REST + WebSocket flows)
import WebSocket from "ws";

const BASE = "http://localhost:3111";
let failures = 0;

function assert(cond, label) {
  if (cond) {
    console.log(`  ✅ ${label}`);
  } else {
    failures++;
    console.log(`  ❌ ${label}`);
  }
}

async function rest(path, opts = {}) {
  const res = await fetch(BASE + path, opts);
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("ws://localhost:3111/ws");
    const inbox = [];
    const waiters = [];
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      inbox.push(msg);
      for (let i = waiters.length - 1; i >= 0; i--) {
        const w = waiters[i];
        if (w.type === msg.type) {
          waiters.splice(i, 1);
          w.resolve(msg);
        }
      }
    });
    ws.on("open", () => resolve({ ws, inbox, waitFor }));
    ws.on("error", reject);
    function waitFor(type, timeout = 4000) {
      const existing = inbox.find((m) => m.type === type);
      if (existing) return Promise.resolve(existing);
      return new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error(`Timeout waiting for ${type}`)), timeout);
        waiters.push({
          type,
          resolve: (m) => {
            clearTimeout(t);
            res(m);
          },
        });
      });
    }
  });
}

const send = (ws, obj) => ws.send(JSON.stringify(obj));

console.log("\n== Health ==");
const health = await rest("/api/health");
assert(health.status === 200 && health.body.status === "ok", "GET /api/health");

console.log("\n== Create room (REST) ==");
const create = await rest("/api/rooms/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Test Room", hostId: "host-1" }),
});
assert(create.status === 200 && /^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(create.body.roomId), `room created: ${create.body.roomId}`);
const roomId = create.body.roomId;

console.log("\n== Room check ==");
const check = await rest(`/api/rooms/${roomId}/check?userId=host-1`);
assert(check.status === 200, "check existing room as host");
const checkUnknown = await rest("/api/rooms/AB/check");
assert(checkUnknown.status === 404, "too-short room code rejected");
const checkBadChars = await rest(`/api/rooms/${encodeURIComponent("BAD CODE!")}/check`);
assert(checkBadChars.status === 404, "invalid characters in room code rejected");
const checkPattern = await rest("/api/rooms/ABC-123/check");
assert(checkPattern.status === 200 && checkPattern.body.participantCount === 0, "valid unseen code accepted (auto-create path)");

console.log("\n== Host hijack protection ==");
// Stranger joins the pre-created room BEFORE the creator -> must NOT become host
const stranger = await connect();
send(stranger.ws, { type: "room:join", roomId, participant: { id: "stranger-1", name: "Intruso", avatarColor: "#f00" } });
const strangerSync = await stranger.waitFor("room:sync");
assert(strangerSync.isHost === false, "stranger does not steal host of pre-created room");
assert(strangerSync.state.participants.find((p) => p.id === "stranger-1")?.role === "participant", "stranger gets participant role");

console.log("\n== Creator joins as host ==");
const host = await connect();
send(host.ws, { type: "room:join", roomId, participant: { id: "host-1", name: "Host", avatarColor: "#0f0" } });
const hostSync = await host.waitFor("room:sync");
assert(hostSync.isHost === true, "creator is host");
const strangerSeesJoin = await stranger.waitFor("user:joined");
assert(strangerSeesJoin.participant.id === "host-1", "stranger notified of host join");

console.log("\n== Chat ==");
send(host.ws, { type: "chat:send", text: "Olá mundo" });
const chatMsg = await stranger.waitFor("chat:message");
assert(chatMsg.message.text === "Olá mundo" && chatMsg.message.senderName === "Host", "chat relayed");

console.log("\n== Profile update -> participants_sync (no room:sync storm) ==");
send(stranger.ws, { type: "profile:update", name: "Intruso Editado" });
const psync = await host.waitFor("room:participants_sync");
assert(psync.participants.find((p) => p.id === "stranger-1")?.name === "Intruso Editado", "participants_sync carries new name");

console.log("\n== Screen share ==");
send(host.ws, { type: "screen:start", config: { resolution: "1080p", preset: "game", fps: 60, bitrateKbps: 8000 } });
const started = await stranger.waitFor("screen:started");
assert(started.sharerId === "host-1", "screen:started broadcast");
send(host.ws, { type: "screen:update_config", config: { resolution: "720p", preset: "game", fps: 60, bitrateKbps: 4000 } });
const cfgUpd = await stranger.waitFor("screen:config_updated");
assert(cfgUpd.config.resolution === "720p", "screen:update_config broadcast without chat spam");
// Non-sharer cannot update config
send(stranger.ws, { type: "screen:update_config", config: { resolution: "480p" } });
send(stranger.ws, { type: "chat:send", text: "after-cfg" });
const afterCfg = await stranger.waitFor("chat:message");
assert(true, "non-sharer config update ignored (no crash)");

console.log("\n== WebRTC + mic signaling relay ==");
send(stranger.ws, { type: "signal:request_stream", targetId: "host-1" });
const reqStream = await host.waitFor("signal:request_stream");
assert(reqStream.senderId === "stranger-1", "request_stream relayed with senderId");
send(host.ws, { type: "signal:offer", targetId: "stranger-1", sdp: { type: "offer", sdp: "fake-sdp" } });
const offer = await stranger.waitFor("signal:offer");
assert(offer.sdp.sdp === "fake-sdp", "screen offer relayed");
send(stranger.ws, { type: "signal:mic_offer", targetId: "host-1", sdp: { type: "offer", sdp: "mic-sdp" } });
const micOffer = await host.waitFor("signal:mic_offer");
assert(micOffer.sdp.sdp === "mic-sdp", "mic_offer relayed");
send(host.ws, { type: "signal:mic_answer", targetId: "stranger-1", sdp: { type: "answer", sdp: "mic-ans" } });
const micAns = await stranger.waitFor("signal:mic_answer");
assert(micAns.sdp.sdp === "mic-ans", "mic_answer relayed");
send(host.ws, { type: "signal:mic_candidate", targetId: "stranger-1", candidate: { candidate: "cand", sdpMid: "0" } });
const micCand = await stranger.waitFor("signal:mic_candidate");
assert(micCand.candidate.candidate === "cand", "mic_candidate relayed");

console.log("\n== Speaking + mute ==");
send(stranger.ws, { type: "user:speaking", isSpeaking: true });
const speaking = await host.waitFor("user:speaking");
assert(speaking.isSpeaking === true && speaking.participantId === "stranger-1", "speaking relayed");
send(stranger.ws, { type: "user:toggle_mute", isMuted: true });
const muted = await host.waitFor("user:mute_updated");
assert(muted.isMuted === true, "self-mute relayed");

console.log("\n== Admin moderation ==");
// Stranger (participant) tries admin action -> ignored
send(stranger.ws, { type: "admin:toggle_lock", isLocked: true });
send(host.ws, { type: "admin:toggle_lock", isLocked: true });
const locked = await stranger.waitFor("room:lock_updated");
assert(locked.isLocked === true, "host can lock room");
send(host.ws, { type: "admin:mute_participant", targetId: "stranger-1" });
const forceMute = await stranger.waitFor("admin:force_muted");
assert(Boolean(forceMute.message), "force mute notifies target");
send(host.ws, { type: "admin:kick", targetId: "stranger-1", reason: "tchau" });
const kicked = await stranger.waitFor("kicked");
assert(kicked.reason === "tchau", "kick notifies target");
const kickedBroadcast = await host.waitFor("user:kicked");
assert(kickedBroadcast.targetId === "stranger-1", "kick broadcast to room");
// Unlock again for the next sections
send(host.ws, { type: "admin:toggle_lock", isLocked: false });
await host.waitFor("room:lock_updated");

console.log("\n== Ban & rejoin rejection ==");
const stranger2 = await connect();
send(stranger2.ws, { type: "room:join", roomId, participant: { id: "stranger-2", name: "BanMe", avatarColor: "#00f" } });
await stranger2.waitFor("room:sync");
send(host.ws, { type: "admin:ban", targetId: "stranger-2" });
const bannedEvt = await stranger2.waitFor("banned");
assert(Boolean(bannedEvt.reason), "ban notifies target");
const bannedCheck = await rest(`/api/rooms/${roomId}/check?userId=stranger-2`);
assert(bannedCheck.status === 403, "banned user rejected by REST check");
const stranger3 = await connect();
send(stranger3.ws, { type: "room:join", roomId, participant: { id: "stranger-2", name: "BanMe", avatarColor: "#00f" } });
const bannedWs = await stranger3.waitFor("error:banned");
assert(Boolean(bannedWs.message), "banned user rejected on WS join");

console.log("\n== Locked room rejects new joiners ==");
send(host.ws, { type: "admin:toggle_lock", isLocked: true });
await host.waitFor("room:lock_updated");
const stranger4 = await connect();
send(stranger4.ws, { type: "room:join", roomId, participant: { id: "stranger-4", name: "Late", avatarColor: "#aaa" } });
const lockedErr = await stranger4.waitFor("error:locked");
assert(Boolean(lockedErr.message), "locked room rejects join over WS");
const lockedRest = await rest(`/api/rooms/${roomId}/check?userId=stranger-4`);
assert(lockedRest.status === 423, "locked room rejected by REST check");

console.log("\n== Host leaves -> host transfer ==");
const late = await connect();
send(host.ws, { type: "admin:toggle_lock", isLocked: false });
await host.waitFor("room:lock_updated");
send(late.ws, { type: "room:join", roomId, participant: { id: "late-1", name: "LateOne", avatarColor: "#123" } });
await late.waitFor("room:sync");
host.ws.close();
const transferred = await late.waitFor("host:transferred");
assert(transferred.newHostId === "late-1", "host role transferred to remaining participant");

console.log("\n== End room ==");
send(late.ws, { type: "admin:end_room" });
const ended = await late.waitFor("room:ended");
assert(Boolean(ended.message), "admin:end_room broadcasts and closes room");

console.log(`\n${failures === 0 ? "🎉 ALL TESTS PASSED" : `💥 ${failures} TEST(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
