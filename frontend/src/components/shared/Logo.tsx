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
      Top<span className="text-brand-orange">Quizz</span>
    </h1>
  );
}
