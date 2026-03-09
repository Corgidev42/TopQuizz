import { useState } from "react";
import type { Question } from "../../types";

interface Props {
  question: Question;
  onSubmit: (answer: string) => void;
}

export default function AnswerInput({ question, onSubmit }: Props) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (value: string) => {
    if (submitted || !value.trim()) return;
    setSubmitted(true);
    onSubmit(value.trim());
  };

  // QCM mode — show options as buttons
  if (question.options) {
    return (
      <div className="w-full max-w-sm space-y-3 animate-slide-up">
        <p className="text-center text-neutral-400 text-sm mb-4">
          Choisis ta réponse :
        </p>
        {question.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleSubmit(opt)}
            disabled={submitted}
            className={`w-full py-4 px-6 rounded-xl font-bold text-lg text-left transition-all ${
              submitted
                ? "bg-surface-light text-neutral-500 cursor-not-allowed"
                : "bg-surface-light border border-neutral-700 hover:border-brand-orange active:scale-95"
            }`}
          >
            <span className="text-brand-orange mr-3">
              {String.fromCharCode(65 + i)}.
            </span>
            {opt}
          </button>
        ))}
      </div>
    );
  }

  // Text input mode
  return (
    <div className="w-full max-w-sm animate-slide-up">
      <p className="text-center text-neutral-400 text-sm mb-4">
        Tape ta réponse :
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(answer);
        }}
        className="space-y-3"
      >
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Ta réponse..."
          className="input-field text-center text-lg"
          autoFocus
          disabled={submitted}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={submitted || !answer.trim()}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            submitted
              ? "bg-neutral-700 text-neutral-500 cursor-not-allowed"
              : "btn-primary"
          }`}
        >
          {submitted ? "Envoyé ✓" : "Valider"}
        </button>
      </form>
    </div>
  );
}
