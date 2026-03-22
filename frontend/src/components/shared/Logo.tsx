import { motion } from "framer-motion";
import logoSvg from "../../assets/logo.svg";

interface Props {
  size?: "sm" | "md" | "lg";
  animate?: boolean;
}

const SIZES = {
  sm: "h-8",
  md: "h-12",
  lg: "h-20",
};

export default function Logo({ size = "md", animate = true }: Props) {
  if (animate) {
    return (
      <motion.img
        src={logoSvg}
        alt="TopQuizz"
        className={SIZES[size]}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    );
  }

  return <img src={logoSvg} alt="TopQuizz" className={SIZES[size]} />;
}
