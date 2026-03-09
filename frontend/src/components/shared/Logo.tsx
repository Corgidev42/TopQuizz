interface Props {
  size?: "sm" | "md" | "lg";
}

export default function Logo({ size = "md" }: Props) {
  const sizes = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-6xl",
  };

  return (
    <h1 className={`${sizes[size]} font-black tracking-tight`}>
      Master<span className="text-brand-orange">Quizz</span>
      <span className="text-neutral-500 text-[0.5em] ml-1">AI</span>
    </h1>
  );
}
