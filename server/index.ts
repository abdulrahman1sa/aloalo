import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// ─── Supabase Client (Server-side) ────────────────────
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Express ──────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
});

// ─── Socket.io ────────────────────────────────────────
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

io.on("connection", (socket) => {
    console.log("⚡ اتصال جديد:", socket.id);

    // ── الشات النصي ───────────────────────────────────
    socket.on("join-channel", async (channelId: string) => {
        socket.join(channelId);
        console.log(`📡 ${socket.id} دخل القناة: ${channelId}`);

        // جلب آخر 100 رسالة من Supabase
        const { data, error } = await supabase
            .from("messages")
            .select("*")
            .eq("channel_id", channelId)
            .order("created_at", { ascending: true })
            .limit(100);

        if (error) {
            console.error("❌ خطأ في جلب الرسائل:", error.message);
        } else {
            socket.emit("history", data ?? []);
            console.log(`📚 أُرسل ${data?.length ?? 0} رسالة سابقة`);
        }
    });

    socket.on("message", async (data: {
        text: string;
        sender: string;
        avatar?: string;
        channel_id: string;
    }) => {
        const msg = {
            id: uuidv4(),
            text: data.text,
            sender: data.sender,
            avatar: data.avatar ?? null,
            channel_id: data.channel_id,
            created_at: new Date().toISOString(),
        };

        // حفظ في Supabase
        const { error } = await supabase.from("messages").insert(msg);
        if (error) {
            console.error("❌ خطأ في حفظ الرسالة:", error.message);
            return;
        }

        // بث للجميع في القناة
        io.to(data.channel_id).emit("message", msg);
        console.log(`💬 ${data.sender} في ${data.channel_id}: ${data.text.substring(0, 30)}`);
    });

    socket.on("typing", (data: { channel_id: string; user: string; typing: boolean }) => {
        socket.to(data.channel_id).emit("typing", data);
    });

    // ── WebRTC Signaling ──────────────────────────────
    socket.on("join-voice", (roomId: string, user: { name: string; avatarSeed: string }) => {
        socket.join(roomId);
        console.log(`🎙️ ${socket.id} دخل الغرفة الصوتية: ${roomId}`);
        socket.to(roomId).emit("user-joined-voice", { socketId: socket.id, user });
    });

    socket.on("voice-offer", (data: { target: string; caller: string; sdp: any; user: any }) => {
        socket.to(data.target).emit("voice-offer", data);
    });

    socket.on("voice-answer", (data: { target: string; responder: string; sdp: any }) => {
        socket.to(data.target).emit("voice-answer", data);
    });

    socket.on("voice-ice-candidate", (data: { target: string; sender: string; candidate: any }) => {
        socket.to(data.target).emit("voice-ice-candidate", data);
    });

    socket.on("disconnect", () => {
        console.log("👤 قطع الاتصال:", socket.id);
        socket.broadcast.emit("user-left-voice", socket.id);
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`\n🚀 السيرفر يعمل على: http://localhost:${PORT}`);
    console.log(`🗄️  Supabase: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
    console.log(`📡 Socket.io جاهز لاستقبال الاتصالات\n`);
});
