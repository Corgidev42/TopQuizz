import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { DilemmeState } from "../../types";
import { DILEMME_SUB_MODE_LABELS } from "../../types";

interface Props {
  dilemme: DilemmeState;
  phase: string;
  mySid: string | null;
  onSubmit: (text: string) => void;
  onVote: (vote: boolean) => void;
}

const SUBMIT_TIMEOUT = 30;

const PLACEHOLDERS: Record<string, string> = {
  ai_start: "...tu ne peux plus manger de pizza",
  vous_aimez: "Vous aimez dormir avec des chaussettes ?",
  pourriez_vous: "Pourriez-vous vivre sans internet pendant 1 an ?",
  libre: "Tu es immortel mais tu ne peux plus rire",
};

export default function DilemmeInput({ dilemme, phase, mySid, onSubmit, onVote }: Props) {
  const [text, setText] = useState("");
  const [timeLeft, setTimeLeft] = useState(SUBMIT_TIMEOUT);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const alreadySubmitted = dilemme.submissions.some((s) => s.sid === mySid);

  useEffect(() => {
    setHasVoted(false);
  }, [dilemme.current_submission_index]);

  useEffect(() => {
    if (phase === "dilemme_submit" && !alreadySubmitted && !hasSubmitted) {
      setTimeLeft(SUBMIT_TIMEOUT);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase, alreadySubmitted, hasSubmitted]);

  if (phase === "dilemme_submit") {
    if (alreadySubmitted || hasSubmitted) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="card text-center"
          >
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold">Réponse envoyée !</h2>
            <p className="text-neutral-400 mt-2">En attente des autres joueurs...</p>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col p-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-brand-orange">
            {DILEMME_SUB_MODE_LABELS[dilemme.sub_mode]}
          </h2>
          <span className={`text-3xl font-black ${timeLeft <= 5 ? "text-red-500 animate-pulse" : "text-brand-orange"}`}>
            {timeLeft}s
          </span>
        </div>

        {dilemme.prompt && (
          <div className="card mb-4 bg-brand-orange/10 border-brand-orange/20">
            <p className="text-lg font-bold text-center">{dilemme.prompt}</p>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDERS[dilemme.sub_mode] || "Votre réponse..."}
            className="input-field h-32 resize-none text-lg mb-4"
            autoFocus
          />
          <button
            onClick={() => {
              if (text.trim()) {
                setHasSubmitted(true);
                onSubmit(text.trim());
              }
            }}
            disabled={!text.trim()}
            className={`btn-primary text-xl w-full ${!text.trim() ? "opacity-50" : ""}`}
          >
            Envoyer
          </button>
        </div>
      </div>
    );
  }

  if (phase === "dilemme_vote") {
    const current = dilemme.submissions[dilemme.current_submission_index];
    if (!current) return null;

    const isMySubmission = current.sid === mySid;

    if (isMySubmission) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <div className="card text-center">
            <div className="text-5xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold">C'est ton dilemme !</h2>
            <p className="text-neutral-400 mt-2">Les autres votent...</p>
          </div>
        </div>
      );
    }

    if (hasVoted) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <div className="card text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold">Vote enregistré !</h2>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="card text-center mb-6">
          <p className="text-sm text-neutral-400 mb-2">{current.pseudo} propose :</p>
          {dilemme.prompt && (
            <p className="text-lg text-neutral-400 mb-1">{dilemme.prompt}</p>
          )}
          <p className="text-xl font-bold">{current.text}</p>
        </div>

        <div className="flex gap-6 w-full max-w-md">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { setHasVoted(true); onVote(true); }}
            className="flex-1 py-8 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-black text-2xl transition-colors"
          >
            👍 OUI
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { setHasVoted(true); onVote(false); }}
            className="flex-1 py-8 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-2xl transition-colors"
          >
            👎 NON
          </motion.button>
        </div>
      </div>
    );
  }

  if (phase === "dilemme_vote_result") {
    const current = dilemme.submissions[dilemme.current_submission_index];
    if (!current) return null;
    const yesPct = current.yes_pct ?? 0;
    const points = current.points ?? 0;
    const isMySubmission = current.sid === mySid;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="card text-center">
          <p className="text-lg mb-2">{current.text}</p>
          <div className="text-3xl font-black mb-2">
            👍 {yesPct.toFixed(0)}% / 👎 {(100 - yesPct).toFixed(0)}%
          </div>
          {isMySubmission && (
            <div className="text-2xl font-black text-brand-orange mt-2">
              +{points} pts
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
