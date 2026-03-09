import { motion } from "framer-motion";

interface Props {
  onBuzz: () => void;
  disabled: boolean;
}

export default function Buzzer({ onBuzz, disabled }: Props) {
  return (
    <motion.button
      onClick={onBuzz}
      disabled={disabled}
      className={`w-52 h-52 rounded-full font-black text-3xl shadow-2xl transition-colors select-none ${
        disabled
          ? "bg-neutral-700 text-neutral-500 cursor-not-allowed"
          : "bg-brand-orange text-white active:bg-brand-orange-dark"
      }`}
      whileTap={disabled ? {} : { scale: 0.85 }}
      whileHover={disabled ? {} : { scale: 1.05 }}
      style={{
        boxShadow: disabled
          ? "none"
          : "0 0 40px rgba(249, 115, 22, 0.4), 0 10px 30px rgba(0,0,0,0.5)",
      }}
    >
      {disabled ? "⏳" : "BUZZ!"}
    </motion.button>
  );
}
