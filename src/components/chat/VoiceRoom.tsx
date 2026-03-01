"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    Mic, MicOff, Headphones, Video, Share2, PhoneOff,
    UserPlus, MessageSquare, Settings, ShieldCheck, Users, HeadphoneOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { InviteModal } from "@/components/ui/InviteModal";
import { useUser } from "@clerk/nextjs";

interface PeerUser {
    id: string;
    name: string;
    avatarUrl: string;
    color: string;
    stream?: MediaStream;
    isLocal?: boolean;
    isSpeaking?: boolean;
}

const PEER_COLORS = [
    "from-emerald-500 to-teal-600",
    "from-purple-500 to-pink-600",
    "from-orange-500 to-red-600",
    "from-cyan-500 to-blue-600",
    "from-rose-500 to-pink-600",
    "from-yellow-500 to-orange-600",
];

// ── جودة صوت عالية ──────────────────────────────────────
const HIGH_QUALITY_AUDIO: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    sampleSize: 16,
    channelCount: 1,
};

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
    ],
    iceTransportPolicy: "all",
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
};

function RemoteAudio({ stream, muted }: { stream: MediaStream; muted: boolean }) {
    const ref = useRef<HTMLAudioElement>(null);
    useEffect(() => {
        if (ref.current) {
            ref.current.srcObject = stream;
            ref.current.volume = muted ? 0 : 1;
        }
    }, [stream, muted]);
    return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

interface VoiceRoomProps {
    roomId: string;
    roomName: string;
}

export function VoiceRoom({ roomId, roomName }: VoiceRoomProps) {
    const { user } = useUser();
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [isCamOn, setIsCamOn] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [participants, setParticipants] = useState<PeerUser[]>([]);
    const [status, setStatus] = useState<"connecting" | "ready" | "error">("connecting");
    const [connectionTime, setConnectionTime] = useState(0);

    const socketRef = useRef<Socket | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const peersRef = useRef<Record<string, RTCPeerConnection>>({});
    const analyserRef = useRef<Record<string, { analyser: AnalyserNode; data: Uint8Array }>>({});
    const speakingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const myName = user?.username ?? user?.firstName ?? "مستخدم";
    const myAvatar = user?.imageUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id ?? "default"}`;
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

    // ── كشف الكلام بـ AudioContext ────────────────────────
    const setupSpeakingDetection = useCallback((stream: MediaStream, userId: string) => {
        try {
            const ctx = new AudioContext();
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.3;
            source.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            analyserRef.current[userId] = { analyser, data };
        } catch { /* AudioContext not supported */ }
    }, []);

    useEffect(() => {
        // مؤقت وقت الاتصال
        speakingTimerRef.current = setInterval(() => {
            Object.entries(analyserRef.current).forEach(([userId, { analyser, data }]) => {
                analyser.getByteFrequencyData(data);
                const avg = data.reduce((a, b) => a + b, 0) / data.length;
                const speaking = avg > 15;
                setParticipants(prev =>
                    prev.map(p => p.id === userId ? { ...p, isSpeaking: speaking } : p)
                );
            });
        }, 100);

        return () => {
            if (speakingTimerRef.current) clearInterval(speakingTimerRef.current);
        };
    }, []);

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                // طلب الميكروفون بجودة عالية
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: HIGH_QUALITY_AUDIO,
                    video: false,
                });

                if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
                localStreamRef.current = stream;
                setupSpeakingDetection(stream, "local");

                setParticipants([{
                    id: "local",
                    name: myName,
                    avatarUrl: myAvatar,
                    color: "from-blue-500 to-indigo-600",
                    stream,
                    isLocal: true,
                    isSpeaking: false,
                }]);

                socketRef.current = io(serverUrl, {
                    reconnectionAttempts: 5,
                    timeout: 8000,
                    transports: ["websocket", "polling"],
                });
                const socket = socketRef.current;

                socket.on("connect", () => {
                    if (!mounted) return;
                    setStatus("ready");
                    // بدء مؤقت الاتصال
                    timerRef.current = setInterval(() => setConnectionTime(t => t + 1), 1000);
                    socket.emit("join-voice", roomId, { name: myName, avatarUrl: myAvatar });
                });

                socket.on("connect_error", () => { if (mounted) setStatus("error"); });

                socket.on("user-joined-voice", async ({ socketId, user }: { socketId: string; user: any }) => {
                    if (!mounted) return;
                    const peer = createPeer(socketId, user);
                    peersRef.current[socketId] = peer;
                    const offer = await peer.createOffer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: false,
                    });
                    await peer.setLocalDescription(offer);
                    socket.emit("voice-offer", {
                        target: socketId, caller: socket.id,
                        sdp: peer.localDescription, user: { name: myName, avatarUrl: myAvatar }
                    });
                });

                socket.on("voice-offer", async ({ caller, sdp, user }: any) => {
                    if (!mounted) return;
                    const peer = createPeer(caller, user);
                    peersRef.current[caller] = peer;
                    await peer.setRemoteDescription(new RTCSessionDescription(sdp));
                    const answer = await peer.createAnswer();
                    await peer.setLocalDescription(answer);
                    socket.emit("voice-answer", { target: caller, responder: socket.id, sdp: peer.localDescription });
                });

                socket.on("voice-answer", async ({ responder, sdp }: any) => {
                    const peer = peersRef.current[responder];
                    if (peer) await peer.setRemoteDescription(new RTCSessionDescription(sdp));
                });

                socket.on("voice-ice-candidate", async ({ sender, candidate }: any) => {
                    const peer = peersRef.current[sender];
                    if (peer && candidate) {
                        try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch { }
                    }
                });

                socket.on("user-left-voice", (socketId: string) => {
                    peersRef.current[socketId]?.close();
                    delete peersRef.current[socketId];
                    delete analyserRef.current[socketId];
                    setParticipants(prev => prev.filter(p => p.id !== socketId));
                });

            } catch (err) {
                console.error("VoiceRoom error:", err);
                if (mounted) setStatus("error");
            }
        };

        const createPeer = (targetId: string, remoteUser: any): RTCPeerConnection => {
            const peer = new RTCPeerConnection(ICE_SERVERS);

            localStreamRef.current?.getTracks().forEach(track => {
                peer.addTrack(track, localStreamRef.current!);
            });

            peer.onicecandidate = (ev) => {
                if (ev.candidate) {
                    socketRef.current?.emit("voice-ice-candidate", {
                        target: targetId,
                        sender: socketRef.current.id,
                        candidate: ev.candidate,
                    });
                }
            };

            peer.onconnectionstatechange = () => {
                console.log(`Peer ${targetId} state:`, peer.connectionState);
            };

            peer.ontrack = (ev) => {
                const remoteStream = ev.streams[0];
                setupSpeakingDetection(remoteStream, targetId);
                setParticipants(prev => {
                    const exists = prev.find(p => p.id === targetId);
                    if (exists) return prev.map(p => p.id === targetId ? { ...p, stream: remoteStream } : p);
                    return [...prev, {
                        id: targetId,
                        name: remoteUser?.name ?? "مجهول",
                        avatarUrl: remoteUser?.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetId}`,
                        color: PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)],
                        stream: remoteStream,
                        isLocal: false,
                        isSpeaking: false,
                    }];
                });
            };

            return peer;
        };

        init();

        return () => {
            mounted = false;
            if (timerRef.current) clearInterval(timerRef.current);
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            Object.values(peersRef.current).forEach(p => p.close());
            peersRef.current = {};
            analyserRef.current = {};
            socketRef.current?.disconnect();
        };
    }, [roomId, myName, myAvatar, serverUrl]);

    const toggleMute = () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
    };

    const toggleVideo = () => {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (track) { track.enabled = !track.enabled; setIsCamOn(track.enabled); }
    };

    const leaveRoom = () => {
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        socketRef.current?.disconnect();
    };

    const formatTime = (s: number) =>
        `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    return (
        <div className="flex flex-col h-full bg-background relative overflow-hidden" dir="rtl">

            <InviteModal
                isOpen={showInvite}
                onClose={() => setShowInvite(false)}
                channelId={roomId}
                channelName={roomName}
                channelType="voice"
            />

            {/* Remote audio */}
            {!isDeafened && participants.map(p =>
                !p.isLocal && p.stream
                    ? <RemoteAudio key={p.id} stream={p.stream} muted={isDeafened} />
                    : null
            )}

            {/* ──── Header ──── */}
            <header className="h-14 px-5 flex items-center justify-between border-b border-white/5 glass-premium z-20">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        status === "ready" ? "bg-success shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" :
                            status === "error" ? "bg-red-500" : "bg-yellow-400 animate-pulse"
                    )} />
                    <h2 className="font-bold text-[14px] text-foreground">{roomName}</h2>
                    <span className="text-[10px] text-gray-500 font-medium">
                        {status === "ready"
                            ? `${participants.length} مشارك · ${formatTime(connectionTime)}`
                            : status === "error" ? "خطأ في الاتصال" : "جاري الاتصال..."}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success rounded-xl border border-success/20 text-xs font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        WebRTC مشفّر
                    </div>
                    <button
                        onClick={() => setShowInvite(true)}
                        aria-label="دعوة"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-all border border-primary/20"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">دعوة</span>
                    </button>
                    <button aria-label="إعدادات" className="p-2 text-gray-400 hover:text-foreground transition-colors">
                        <Settings className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* ──── Participants ──── */}
            <div className="flex-1 p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 auto-rows-fr overflow-y-auto no-scrollbar">

                {status === "connecting" && (
                    <div className="col-span-full flex flex-col items-center justify-center gap-4 h-full">
                        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="text-gray-400 font-bold text-sm tracking-widest">جاري الاتصال...</p>
                    </div>
                )}

                {status === "error" && (
                    <div className="col-span-full flex flex-col items-center justify-center gap-4 h-full opacity-60">
                        <Users className="w-16 h-16 text-gray-600" strokeWidth={1} />
                        <div className="text-center space-y-1">
                            <p className="text-gray-400 font-bold text-sm">تعذّر الاتصال</p>
                            <p className="text-gray-600 text-xs">تأكد من تشغيل: <code className="text-primary">npm run server</code></p>
                            <p className="text-gray-600 text-xs">وأن المتصفح منحك إذن الميكروفون</p>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-primary/15 hover:bg-primary/25 text-primary rounded-xl text-xs font-bold border border-primary/20 transition-all"
                        >
                            إعادة المحاولة
                        </button>
                    </div>
                )}

                {status === "ready" && (
                    <AnimatePresence>
                        {participants.map((u) => (
                            <motion.div
                                key={u.id}
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.92 }}
                                transition={{ type: "spring", stiffness: 240, damping: 22 }}
                                className={cn(
                                    "relative rounded-[32px] overflow-hidden glass-premium flex flex-col items-center justify-center min-h-[220px] border-2 transition-all duration-200",
                                    u.isSpeaking
                                        ? "border-primary/60 shadow-[0_0_40px_rgba(99,102,241,0.2)]"
                                        : "border-white/5",
                                    u.isLocal && isMuted ? "opacity-60 border-accent/20" : ""
                                )}
                            >
                                {/* Speaking ring animation */}
                                {u.isSpeaking && (
                                    <div className="absolute inset-0 border-2 border-primary/30 rounded-[32px] animate-ping pointer-events-none" />
                                )}

                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                                <div className="relative z-10 flex flex-col items-center gap-4 p-5 w-full">
                                    {/* Avatar */}
                                    <motion.div
                                        animate={u.isSpeaking ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                                        transition={{ repeat: u.isSpeaking ? Infinity : 0, duration: 0.8 }}
                                        className={cn("w-24 h-24 rounded-full p-[2.5px] bg-gradient-to-tr shadow-xl", u.color)}
                                    >
                                        <div className="w-full h-full rounded-full bg-background overflow-hidden border-2 border-background/50">
                                            {u.stream && u.stream.getVideoTracks().length > 0 && ((u.isLocal && isCamOn) || !u.isLocal) ? (
                                                <video
                                                    ref={node => { if (node && u.stream) node.srcObject = u.stream; }}
                                                    autoPlay playsInline muted={u.isLocal}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                    </motion.div>

                                    {/* Name */}
                                    <div className="text-center">
                                        <p className="font-bold text-base text-foreground">{u.name}</p>
                                        <div className="flex items-center justify-center gap-1 mt-0.5">
                                            {u.isLocal && (
                                                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">أنت</span>
                                            )}
                                            {u.isSpeaking && (
                                                <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded-full font-bold animate-pulse">🎙 يتحدث</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Mute icon */}
                                {u.isLocal && isMuted && (
                                    <div className="absolute bottom-4 left-4 bg-accent/25 backdrop-blur border border-accent/30 p-1.5 rounded-xl">
                                        <MicOff className="w-4 h-4 text-accent" />
                                    </div>
                                )}

                                {/* Signal bars */}
                                <div className="absolute top-4 right-4 flex gap-[2px] items-end h-3.5">
                                    {[35, 65, 100, 65].map((h, i) => (
                                        <div
                                            key={i}
                                            style={{ height: `${h}%` }}
                                            className={cn("w-1 rounded-full transition-all",
                                                u.isSpeaking ? "bg-success" : "bg-success/50"
                                            )}
                                        />
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* ──── Controls ──── */}
            <footer className="h-20 px-6 border-t border-white/5 bg-background/70 backdrop-blur-xl flex items-center justify-center gap-3 z-20">
                <button
                    aria-label={isMuted ? "إلغاء الكتم" : "كتم الميكروفون"}
                    onClick={toggleMute}
                    className={cn("p-3.5 rounded-2xl transition-all active:scale-95",
                        isMuted ? "bg-accent/20 border border-accent/20 text-accent" : "bg-white/10 hover:bg-white/15 text-white"
                    )}
                >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                    aria-label={isDeafened ? "إلغاء الإسكات" : "إسكات السماعة"}
                    onClick={() => setIsDeafened(!isDeafened)}
                    className={cn("p-3.5 rounded-2xl transition-all active:scale-95",
                        isDeafened ? "bg-accent/20 border border-accent/20 text-accent" : "bg-white/10 hover:bg-white/15 text-white"
                    )}
                >
                    {isDeafened ? <HeadphoneOff className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
                </button>

                <button
                    aria-label={isCamOn ? "إيقاف الكاميرا" : "تشغيل الكاميرا"}
                    onClick={toggleVideo}
                    className={cn("p-3.5 rounded-2xl transition-all active:scale-95",
                        isCamOn ? "bg-white/15 border border-white/20 text-white" : "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
                    )}
                >
                    <Video className="w-5 h-5" />
                </button>

                <div className="w-[1px] h-6 bg-white/10 mx-1" />

                <button
                    aria-label="مشاركة"
                    onClick={() => setShowInvite(true)}
                    className="p-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-primary transition-all border border-transparent hover:border-primary/20"
                >
                    <Share2 className="w-5 h-5" />
                </button>

                <button
                    aria-label="مغادرة الغرفة"
                    onClick={leaveRoom}
                    className="p-4 bg-accent hover:bg-red-500 text-white rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95"
                >
                    <PhoneOff className="w-6 h-6" />
                </button>

                <button aria-label="الدردشة" className="p-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white transition-all">
                    <MessageSquare className="w-5 h-5" />
                </button>
            </footer>
        </div>
    );
}
