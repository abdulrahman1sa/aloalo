"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    Mic, MicOff, Headphones, Video, Share2, PhoneOff,
    UserPlus, MessageSquare, Settings, ShieldCheck, Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

// ─────────────────────────────────────────────────────────
// TODO: Replace with real auth session
// ─────────────────────────────────────────────────────────
const SESSION_USER = {
    name: "أنت",
    avatarSeed: "user-default",
    color: "from-blue-500 to-indigo-600",
};

interface PeerUser {
    id: string;
    name: string;
    avatarSeed: string;
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

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
};

function AudioNode({ stream }: { stream: MediaStream }) {
    const ref = useRef<HTMLAudioElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.srcObject = stream;
    }, [stream]);
    return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

interface VoiceRoomProps {
    roomId: string;
    roomName: string;
}

export function VoiceRoom({ roomId, roomName }: VoiceRoomProps) {
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [participants, setParticipants] = useState<PeerUser[]>([]);
    const [status, setStatus] = useState<"connecting" | "ready" | "error">("connecting");

    const socketRef = useRef<Socket | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const peersRef = useRef<Record<string, RTCPeerConnection>>({});

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }

                localStreamRef.current = stream;

                setParticipants([{
                    id: "local",
                    name: SESSION_USER.name,
                    avatarSeed: SESSION_USER.avatarSeed,
                    color: SESSION_USER.color,
                    stream,
                    isLocal: true,
                    isSpeaking: false,
                }]);

                socketRef.current = io("http://localhost:3001");
                const socket = socketRef.current;

                socket.on("connect", () => {
                    if (!mounted) return;
                    setStatus("ready");
                    socket.emit("join-voice", roomId, { name: SESSION_USER.name, avatarSeed: SESSION_USER.avatarSeed });
                });

                socket.on("connect_error", () => { if (mounted) setStatus("error"); });

                socket.on("user-joined-voice", async ({ socketId, user }: { socketId: string; user: any }) => {
                    const peer = createPeer(socketId, user);
                    peersRef.current[socketId] = peer;
                    const offer = await peer.createOffer();
                    await peer.setLocalDescription(offer);
                    socket.emit("voice-offer", { target: socketId, caller: socket.id, sdp: peer.localDescription, user: { name: SESSION_USER.name, avatarSeed: SESSION_USER.avatarSeed } });
                });

                socket.on("voice-offer", async ({ caller, sdp, user }: { target: string; caller: string; sdp: any; user: any }) => {
                    const peer = createPeer(caller, user);
                    peersRef.current[caller] = peer;
                    await peer.setRemoteDescription(new RTCSessionDescription(sdp));
                    const answer = await peer.createAnswer();
                    await peer.setLocalDescription(answer);
                    socket.emit("voice-answer", { target: caller, responder: socket.id, sdp: peer.localDescription });
                });

                socket.on("voice-answer", async ({ responder, sdp }: { target: string; responder: string; sdp: any }) => {
                    const peer = peersRef.current[responder];
                    if (peer) await peer.setRemoteDescription(new RTCSessionDescription(sdp));
                });

                socket.on("voice-ice-candidate", async ({ sender, candidate }: { target: string; sender: string; candidate: any }) => {
                    const peer = peersRef.current[sender];
                    if (peer && candidate) await peer.addIceCandidate(new RTCIceCandidate(candidate));
                });

                socket.on("user-left-voice", (socketId: string) => {
                    peersRef.current[socketId]?.close();
                    delete peersRef.current[socketId];
                    setParticipants(prev => prev.filter(p => p.id !== socketId));
                });

            } catch (err) {
                console.error("VoiceRoom init error:", err);
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

            peer.ontrack = (ev) => {
                const remoteStream = ev.streams[0];
                setParticipants(prev => {
                    const exists = prev.find(p => p.id === targetId);
                    if (exists) return prev.map(p => p.id === targetId ? { ...p, stream: remoteStream } : p);
                    return [...prev, {
                        id: targetId,
                        name: remoteUser?.name ?? "مجهول",
                        avatarSeed: remoteUser?.avatarSeed ?? targetId,
                        color: PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)],
                        stream: remoteStream,
                        isLocal: false,
                    }];
                });
            };

            return peer;
        };

        init();

        return () => {
            mounted = false;
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            Object.values(peersRef.current).forEach(p => p.close());
            peersRef.current = {};
            socketRef.current?.disconnect();
        };
    }, [roomId]);

    const toggleMute = () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setIsMuted(!track.enabled);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background relative overflow-hidden" dir="rtl">

            {/* Remote audio nodes */}
            {!isDeafened && participants.map(p =>
                !p.isLocal && p.stream
                    ? <AudioNode key={p.id} stream={p.stream} />
                    : null
            )}

            {/* ──── Header ──── */}
            <header className="h-14 px-5 flex items-center justify-between border-b border-white/5 glass-premium z-20">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        status === "ready" ? "bg-success shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" :
                            status === "error" ? "bg-accent" : "bg-yellow-400 animate-pulse"
                    )} />
                    <h2 className="font-bold text-[14px] text-foreground">{roomName}</h2>
                    <span className="text-[10px] text-gray-500 font-medium">
                        {status === "ready" ? `${participants.length} مشارك` :
                            status === "error" ? "خطأ في الاتصال" : "جاري الاتصال..."}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success rounded-xl border border-success/20 text-xs font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        خصوصية WebRTC
                    </div>
                    <button aria-label="دعوة" className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-all border border-primary/20">
                        <UserPlus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">دعوة</span>
                    </button>
                    <button aria-label="إعدادات" className="p-2 text-gray-400 hover:text-foreground transition-colors">
                        <Settings className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* ──── Participants Grid ──── */}
            <div className="flex-1 p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 auto-rows-fr overflow-y-auto no-scrollbar">

                {status === "connecting" && (
                    <div className="col-span-full flex flex-col items-center justify-center gap-4 h-full">
                        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">جاري الاتصال...</p>
                    </div>
                )}

                {status === "error" && (
                    <div className="col-span-full flex flex-col items-center justify-center gap-4 h-full opacity-60">
                        <Users className="w-16 h-16 text-gray-600" strokeWidth={1} />
                        <p className="text-gray-500 font-bold text-sm text-center">
                            تعذّر الوصول للميكروفون أو السيرفر.<br />
                            تأكد من الأذونات وتشغيل: <code className="text-primary">npm run server</code>
                        </p>
                    </div>
                )}

                {status === "ready" && (
                    <AnimatePresence>
                        {participants.map((user) => (
                            <motion.div
                                key={user.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ type: "spring", stiffness: 220, damping: 22 }}
                                className={cn(
                                    "relative rounded-[32px] overflow-hidden glass-premium flex flex-col items-center justify-center min-h-[220px] border-2 transition-all duration-300",
                                    user.isSpeaking ? "border-primary/40 shadow-[0_0_30px_rgba(99,102,241,0.1)]" : "border-white/5",
                                    user.isLocal && isMuted ? "opacity-75 border-accent/20" : ""
                                )}
                            >
                                {/* Gradient overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                                <div className="relative z-10 flex flex-col items-center gap-5 p-5 w-full">
                                    <motion.div
                                        animate={user.isSpeaking ? { scale: [1, 1.04, 1] } : {}}
                                        transition={{ repeat: Infinity, duration: 1.5 }}
                                        className={cn("w-24 h-24 rounded-full p-[2px] bg-gradient-to-tr shadow-xl", user.color)}
                                    >
                                        <div className="w-full h-full rounded-full bg-background overflow-hidden border-2 border-background/50">
                                            <img
                                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}`}
                                                alt={user.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </motion.div>

                                    <div className="text-center">
                                        <p className="font-bold text-base text-foreground">{user.name}</p>
                                        {user.isLocal && (
                                            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">أنت</span>
                                        )}
                                    </div>
                                </div>

                                {/* Mute badge */}
                                {user.isLocal && isMuted && (
                                    <div className="absolute bottom-4 left-4 bg-accent/25 backdrop-blur border border-accent/30 p-1.5 rounded-xl">
                                        <MicOff className="w-4 h-4 text-accent" />
                                    </div>
                                )}

                                {/* Signal quality indicator */}
                                <div className="absolute top-4 right-4 flex gap-[2px] items-end h-3.5">
                                    {[35, 65, 100, 65].map((h, i) => (
                                        <div key={i} style={{ height: `${h}%` }} className="w-1 bg-success/60 rounded-full" />
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* ──── Control Bar ──── */}
            <footer className="h-20 px-6 border-t border-white/5 bg-background/70 backdrop-blur-xl flex items-center justify-center gap-3 z-20">
                <button
                    aria-label={isMuted ? "إلغاء الكتم" : "كتم الميكروفون"}
                    onClick={toggleMute}
                    className={cn("p-3.5 rounded-2xl transition-all", isMuted ? "bg-accent/20 border border-accent/20 text-accent" : "bg-white/10 hover:bg-white/15 text-white")}
                >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                    aria-label={isDeafened ? "إلغاء الصمم" : "كتم السماعة"}
                    onClick={() => setIsDeafened(!isDeafened)}
                    className={cn("p-3.5 rounded-2xl transition-all", isDeafened ? "bg-accent/20 border border-accent/20 text-accent" : "bg-white/10 hover:bg-white/15 text-white")}
                >
                    <Headphones className="w-5 h-5" />
                </button>

                <button aria-label="تشغيل الكاميرا" className="p-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white transition-all border border-transparent hover:border-white/10">
                    <Video className="w-5 h-5" />
                </button>

                <div className="w-[1px] h-6 bg-white/10 mx-1" />

                <button aria-label="مشاركة الشاشة" className="p-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white transition-all border border-transparent hover:border-white/10">
                    <Share2 className="w-5 h-5" />
                </button>

                <button
                    aria-label="مغادرة الغرفة"
                    onClick={() => {
                        localStreamRef.current?.getTracks().forEach(t => t.stop());
                        socketRef.current?.disconnect();
                    }}
                    className="p-4 bg-accent hover:bg-red-500 text-white rounded-2xl shadow-lg transition-all hover:scale-105"
                >
                    <PhoneOff className="w-6 h-6" />
                </button>

                <button aria-label="فتح الدردشة" className="p-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white transition-all border border-transparent hover:border-white/10">
                    <MessageSquare className="w-5 h-5" />
                </button>
            </footer>
        </div>
    );
}
