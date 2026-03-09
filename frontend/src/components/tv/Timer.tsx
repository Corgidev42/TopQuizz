import { useEffect, useState } from "react";

interface Props {
  seconds: number;
  onExpire?: () => void;
}

export default function Timer({ seconds, onExpire }: Props) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.();
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, onExpire]);

  const pct = (remaining / seconds) * 100;
  const isLow = remaining <= 5;

  return (
    <div className="flex flex-col items-center">
      <div
        className={`text-5xl font-black ${
          isLow ? "text-red-500 animate-pulse" : "text-white"
        }`}
      >
        {remaining}
      </div>
      <div className="w-48 h-2 bg-surface-light rounded-full mt-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${
            isLow ? "bg-red-500" : "bg-brand-orange"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
