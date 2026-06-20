import { useEffect } from "react";
import { motion } from "motion/react";

type SplashScreenProps = {
  onComplete: () => void;
};

export function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 2600);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeInOut" }}
      className="absolute inset-0 z-[60] flex flex-col items-center justify-center px-10"
      style={{ background: "#FFFFFF" }}
    >
      <motion.img
        src="/darin-logo.png"
        alt="Darin — Your first motherhood companion"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="w-full max-w-[280px] h-auto select-none"
        draggable={false}
      />
    </motion.div>
  );
}
