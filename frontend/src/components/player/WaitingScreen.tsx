interface Props {
  message: string;
  emoji?: string;
}

export default function WaitingScreen({ message, emoji = "⏳" }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-6xl mb-4 animate-pulse-slow">{emoji}</div>
      <p className="text-xl font-semibold text-neutral-300 text-center">
        {message}
      </p>
    </div>
  );
}
