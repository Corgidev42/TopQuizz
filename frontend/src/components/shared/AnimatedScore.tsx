import { motion, AnimatePresence } from "framer-motion";

interface Props {
  score: number;
  change?: number;
}

export default function AnimatedScore({ score, change }: Props) {
  return (
    <div className="relative inline-flex items-center">
      <motion.span
        key={score}
        initial={{ scale: 1.3, color: "#F97316" }}
        animate={{ scale: 1, color: "#FAFAFA" }}
        transition={{ duration: 0.4 }}
        className="text-4xl font-black"
      >
        {score}
      </motion.span>
      <AnimatePresence>
        {change != null && change !== 0 && (
          <motion.span
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -30 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className={`absolute -right-10 text-lg font-bold ${
              change > 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {change > 0 ? `+${change}` : change}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
