import { useEffect, useMemo, useState } from "react";

type MemoryPreviewData = {
  image_url?: string | null;
  started_at: number;
  countdown_seconds: number;
  show_seconds: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function MemoryPreview({ data }: { data: MemoryPreviewData }) {
  const [now, setNow] = useState(() => Date.now() / 1000);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 200);
    return () => clearInterval(id);
  }, []);

  const { stage, countdownLeft, showLeft, totalLeft } = useMemo(() => {
    const elapsed = now - data.started_at;
    const countdownLeftRaw = data.countdown_seconds - elapsed;
    const showElapsed = elapsed - data.countdown_seconds;
    const showLeftRaw = data.show_seconds - showElapsed;
    const totalLeftRaw = data.countdown_seconds + data.show_seconds - elapsed;

    const countdownLeft = clamp(Math.ceil(countdownLeftRaw), 0, data.countdown_seconds);
    const showLeft = clamp(Math.ceil(showLeftRaw), 0, data.show_seconds);
    const totalLeft = Math.max(0, Math.ceil(totalLeftRaw));

    const stage =
      elapsed < data.countdown_seconds
        ? "countdown"
        : elapsed < data.countdown_seconds + data.show_seconds
          ? "show"
          : "done";

    return { stage, countdownLeft, showLeft, totalLeft };
  }, [data.countdown_seconds, data.show_seconds, data.started_at, now]);

  if (stage === "countdown") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-7xl font-black mb-6">Préparez-vous</div>
        <div className="text-[140px] leading-none font-black text-brand-orange">
          {countdownLeft}
        </div>
        <div className="text-neutral-400 text-2xl mt-6">
          L'image arrive dans {countdownLeft}s
        </div>
      </div>
    );
  }

  if (stage === "show" && data.image_url) {
    return (
      <div className="min-h-screen relative flex items-center justify-center bg-black">
        <img
          src={data.image_url}
          className="max-h-screen max-w-screen object-contain"
        />
        <div className="absolute top-6 right-6 px-5 py-3 rounded-2xl bg-black/60 border border-white/10 text-white text-2xl font-black">
          {showLeft}s
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-6xl font-black mb-4">Observation terminée</div>
      <div className="text-neutral-400 text-2xl">
        Attente du lancement des questions...
      </div>
      <div className="text-neutral-600 mt-6">({totalLeft}s)</div>
    </div>
  );
}

