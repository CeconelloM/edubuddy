import { useState } from "react";
import { ArrowLeft, Mic, Send, Users, Sparkles, Plane, Film, Coffee } from "lucide-react";

type Room = {
  id: string;
  title: string;
  topic: string;
  online: number;
  emoji: string;
  tint: string;
  Icon: typeof Sparkles;
};

const ROOMS: Room[] = [
  { id: "weekend", title: "Weekend Plans", topic: "Today's Topic ☀️", online: 15, emoji: "☀️", tint: "bg-brand-orange-soft text-brand-orange", Icon: Sparkles },
  { id: "movies", title: "Movie Discussions", topic: "Now showing 🎬", online: 8, emoji: "🎬", tint: "bg-brand-blue-soft text-brand-blue", Icon: Film },
  { id: "travel", title: "Travel Stories", topic: "Across the world ✈️", online: 42, emoji: "✈️", tint: "bg-brand-green-soft text-brand-green", Icon: Plane },
  { id: "coffee", title: "Coffee Chat", topic: "Casual small talk ☕", online: 6, emoji: "☕", tint: "bg-brand-orange-soft text-brand-orange", Icon: Coffee },
];

const AVATARS = [
  { name: "Mystery_Fox", color: "bg-orange-400", text: "text-orange-700", msg: "Hey everyone! Any plans for Saturday?" },
  { name: "Pixel_Panda", color: "bg-teal-400", text: "text-teal-700", msg: "I'm going hiking in the mountains 🏔️" },
  { name: "Cosmic_Otter", color: "bg-sky-400", text: "text-sky-700", msg: "Sounds amazing! How long is the trail?" },
  { name: "Mystery_Fox", color: "bg-orange-400", text: "text-orange-700", msg: "I might join a cooking class — never tried it before." },
];

export function Community() {
  const [room, setRoom] = useState<Room | null>(null);

  if (room) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="flex items-center gap-3 border-b border-border bg-surface px-4 pt-10 pb-3">
          <button onClick={() => setRoom(null)} className="grid size-9 place-items-center rounded-full hover:bg-muted">
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-foreground">{room.title}</h2>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3" /> {room.online} online · anonymous
            </p>
          </div>
        </header>

        <main className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          {AVATARS.map((m, i) => (
            <div key={i} className="flex gap-3">
              <div className={`grid size-9 shrink-0 place-items-center rounded-full ${m.color} text-xs font-bold text-white`}>
                {m.name.split("_")[1].charAt(0)}
              </div>
              <div className="min-w-0">
                <p className={`text-[11px] font-bold ${m.text}`}>{m.name}</p>
                <div className="mt-1 inline-block rounded-2xl rounded-tl-sm bg-surface px-3 py-2 text-sm text-foreground ring-1 ring-border">
                  {m.msg}
                </div>
              </div>
            </div>
          ))}
        </main>

        <div className="sticky bottom-16 border-t border-border bg-surface p-3">
          <div className="flex items-center gap-2">
            <input
              placeholder="Say something kind..."
              className="h-11 min-w-0 flex-1 rounded-full bg-muted px-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-green/30"
            />
            <button aria-label="Voice" className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-blue-soft text-brand-blue">
              <Mic className="size-5" />
            </button>
            <button className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand-green px-4 text-sm font-semibold text-primary-foreground shadow-md shadow-brand-green/20">
              <Send className="size-4" /> Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="px-6 pt-10 pb-4">
        <h1 className="text-2xl font-semibold text-foreground">Community Hub</h1>
        <p className="mt-1 text-sm text-muted-foreground">Practice together with learners worldwide.</p>
      </header>

      <div className="flex-1 space-y-3 px-6 pb-6">
        {ROOMS.map((r) => (
          <button
            key={r.id}
            onClick={() => setRoom(r)}
            className="flex w-full items-center gap-4 rounded-2xl bg-surface p-4 text-left ring-1 ring-border transition-all hover:ring-brand-green/30"
          >
            <div className={`grid size-12 shrink-0 place-items-center rounded-xl ${r.tint}`}>
              <r.Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{r.title}</p>
              <p className="truncate text-xs text-muted-foreground">{r.topic}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-brand-green-soft px-2.5 py-1 text-[11px] font-semibold text-brand-green">
              <span className="size-1.5 rounded-full bg-brand-green" /> {r.online}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
