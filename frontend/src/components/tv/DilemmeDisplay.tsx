import { motion, AnimatePresence } from "framer-motion";
import type { DilemmeState, DilemmeSubmission } from "../../types";
import { DILEMME_SUB_MODE_LABELS } from "../../types";

interface Props {
  dilemme: DilemmeState;
  phase: string;
  scores: { sid: string; pseudo: string; color: string; score: number }[];
}

function SubmitPhase({ dilemme }: { dilemme: DilemmeState }) {
  const placeholder: Record<string, string> = {
    ai_start: "Complétez le dilemme...",
    vous_aimez: "Proposez un 'Vous aimez...'",
    pourriez_vous: "Proposez un 'Pourriez-vous...'",
    libre: "Écrivez votre dilemme !",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center max-w-3xl"
      >
        <div className="text-7xl mb-6">⚖️</div>
        <h1 className="text-4xl font-black mb-4">
          {DILEMME_SUB_MODE_LABELS[dilemme.sub_mode]}
        </h1>

        {dilemme.prompt && (
          <div className="card bg-gradient-to-r from-brand-orange/20 to-purple-500/20 border-brand-orange/30 mb-6">
            <p className="text-3xl font-bold text-white">{dilemme.prompt}</p>
          </div>
        )}

        <p className="text-xl text-neutral-400 mb-8">
          {placeholder[dilemme.sub_mode] || "Envoyez vos réponses !"}
        </p>

        <div className="flex justify-center gap-3 flex-wrap">
          {dilemme.submissions.map((s, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ backgroundColor: s.color }}
            >
              {s.pseudo[0]}
            </motion.div>
          ))}
        </div>

        <p className="text-neutral-500 mt-4">
          {dilemme.submissions.length} réponse(s) reçue(s)
        </p>
      </motion.div>
    </div>
  );
}

function VotePhase({ dilemme }: { dilemme: DilemmeState }) {
  const current = dilemme.submissions[dilemme.current_submission_index];
  if (!current) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <AnimatePresence mode="wait">
        <motion.div
          key={dilemme.current_submission_index}
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -100, opacity: 0 }}
          className="text-center max-w-3xl w-full"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <div
              className="w-8 h-8 rounded-full"
              style={{ backgroundColor: current.color }}
            />
            <span className="text-xl font-bold">{current.pseudo}</span>
          </div>

          {dilemme.prompt && (
            <p className="text-2xl text-neutral-400 mb-2">{dilemme.prompt}</p>
          )}

          <div className="card bg-gradient-to-r from-brand-orange/10 to-purple-500/10 border-brand-orange/20 mb-8">
            <p className="text-3xl font-bold">{current.text}</p>
          </div>

          <div className="flex justify-center gap-8">
            <div className="text-center">
              <div className="text-5xl mb-2">👍</div>
              <p className="text-xl font-bold text-green-400">OUI</p>
            </div>
            <div className="text-5xl text-neutral-600">VS</div>
            <div className="text-center">
              <div className="text-5xl mb-2">👎</div>
              <p className="text-xl font-bold text-red-400">NON</p>
            </div>
          </div>

          <p className="text-neutral-500 mt-6">
            Votez sur vos téléphones !
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function VoteResultPhase({ dilemme, scores }: { dilemme: DilemmeState; scores: Props["scores"] }) {
  const current = dilemme.submissions[dilemme.current_submission_index];
  if (!current) return null;

  const yesPct = current.yes_pct ?? 0;
  const noPct = 100 - yesPct;
  const points = current.points ?? 0;
  const isPerfect = Math.abs(yesPct - 50) < 1;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center max-w-3xl w-full"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <div
            className="w-8 h-8 rounded-full"
            style={{ backgroundColor: current.color }}
          />
          <span className="text-xl font-bold">{current.pseudo}</span>
        </div>

        <p className="text-2xl font-bold mb-6">{current.text}</p>

        {/* Vote bar */}
        <div className="w-full h-16 rounded-2xl overflow-hidden flex mb-4">
          <motion.div
            initial={{ width: "50%" }}
            animate={{ width: `${yesPct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="bg-green-500 flex items-center justify-center"
          >
            <span className="font-black text-xl">
              👍 {current.yes_count} ({yesPct.toFixed(0)}%)
            </span>
          </motion.div>
          <motion.div
            initial={{ width: "50%" }}
            animate={{ width: `${noPct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="bg-red-500 flex items-center justify-center"
          >
            <span className="font-black text-xl">
              👎 {current.no_count} ({noPct.toFixed(0)}%)
            </span>
          </motion.div>
        </div>

        {isPerfect && (
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="text-5xl font-black text-brand-orange mb-4"
          >
            50/50 PARFAIT !
          </motion.div>
        )}

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-4xl font-black text-brand-orange"
        >
          +{points} pts
        </motion.div>

        {/* Mini scoreboard */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {scores.map((s) => (
            <div
              key={s.sid}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                s.sid === current.sid ? "ring-2 ring-brand-orange" : ""
              }`}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="font-semibold">{s.pseudo}</span>
              <span className="text-brand-orange font-bold">{s.score}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default function DilemmeDisplay({ dilemme, phase, scores }: Props) {
  if (phase === "dilemme_submit") {
    return <SubmitPhase dilemme={dilemme} />;
  }
  if (phase === "dilemme_vote") {
    return <VotePhase dilemme={dilemme} />;
  }
  if (phase === "dilemme_vote_result") {
    return <VoteResultPhase dilemme={dilemme} scores={scores} />;
  }
  return null;
}
