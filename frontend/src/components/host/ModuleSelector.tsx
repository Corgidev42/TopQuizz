import type { ModuleConfig, ModuleType, Difficulty, DilemmeSubMode } from "../../types";
import { MODULE_LABELS, MODULE_ICONS, DILEMME_SUB_MODE_LABELS } from "../../types";

const ALL_MODULES: ModuleType[] = [
  "master_quiz",
  "master_memory",
  "master_face",
  "master_commu",
  "blind_test",
  "dilemme_parfait",
  "ttmc",
];

const ALL_DILEMME_MODES: DilemmeSubMode[] = [
  "ai_start",
  "vous_aimez",
  "pourriez_vous",
  "libre",
];

const ALL_DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];

interface Props {
  modules: ModuleConfig[];
  onChange: (modules: ModuleConfig[]) => void;
}

export default function ModuleSelector({ modules, onChange }: Props) {
  const addModule = () => {
    onChange([
      ...modules,
      {
        module_type: "master_quiz",
        num_questions: 5,
        theme: "",
        difficulty_mix: ["easy", "medium", "hard"],
      },
    ]);
  };

  const removeModule = (index: number) => {
    onChange(modules.filter((_, i) => i !== index));
  };

  const updateModule = (index: number, partial: Partial<ModuleConfig>) => {
    onChange(
      modules.map((m, i) => (i === index ? { ...m, ...partial } : m))
    );
  };

  return (
    <div className="space-y-4">
      {modules.map((mod, i) => (
        <div key={i} className="card space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-neutral-400 font-semibold">
              Module #{i + 1}
            </span>
            <button
              onClick={() => removeModule(i)}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              Supprimer
            </button>
          </div>

          {/* Module type */}
          <select
            value={mod.module_type}
            onChange={(e) =>
              updateModule(i, { module_type: e.target.value as ModuleType })
            }
            className="input-field"
          >
            {ALL_MODULES.map((mt) => (
              <option key={mt} value={mt}>
                {MODULE_ICONS[mt]} {MODULE_LABELS[mt]}
              </option>
            ))}
          </select>

          {(mod.module_type === "master_quiz" ||
            mod.module_type === "master_commu" ||
            mod.module_type === "blind_test" ||
            mod.module_type === "ttmc") && (
            <input
              type="text"
              value={mod.theme ?? ""}
              onChange={(e) => updateModule(i, { theme: e.target.value })}
              placeholder={
                mod.module_type === "master_commu"
                  ? "Thème (ex: nourriture, sport, vacances...)"
                  : mod.module_type === "blind_test"
                    ? "Thème (ex: anime, hits 2000, rap FR...)"
                    : mod.module_type === "ttmc"
                      ? "Thème global (ex: Culture Générale, Sport, Cinéma...)"
                      : "Thème (ex: Pop Culture, Science...)"
              }
              className="input-field"
            />
          )}

          {mod.module_type === "ttmc" && (
            <p className="text-xs text-neutral-500 italic">
              En TTMC, chaque round génère 10 questions (niveaux 1 à 10). Le nombre de rounds définit combien de thèmes seront joués.
            </p>
          )}

          {mod.module_type !== "master_memory" && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-neutral-400 whitespace-nowrap">
                {mod.module_type === "dilemme_parfait" ? "Manches :" : mod.module_type === "ttmc" ? "Rounds :" : "Questions :"}
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={mod.num_questions}
                onChange={(e) =>
                  updateModule(i, {
                    num_questions: parseInt(e.target.value) || 1,
                  })
                }
                className="input-field w-24"
              />
            </div>
          )}

          {mod.module_type !== "master_memory" && mod.module_type !== "dilemme_parfait" && mod.module_type !== "ttmc" && (
            <div>
              <label className="text-sm text-neutral-400 mb-1 block">
                Difficultés :
              </label>
              <div className="flex gap-2">
                {ALL_DIFFICULTIES.map((d) => {
                  const active = mod.difficulty_mix.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        const newMix = active
                          ? mod.difficulty_mix.filter((x) => x !== d)
                          : [...mod.difficulty_mix, d];
                        if (newMix.length > 0) {
                          updateModule(i, { difficulty_mix: newMix });
                        }
                      }}
                      className={`badge transition-colors cursor-pointer ${
                        active
                          ? d === "easy"
                            ? "bg-green-500/30 text-green-400"
                            : d === "medium"
                              ? "bg-yellow-500/30 text-yellow-400"
                              : d === "hard"
                                ? "bg-red-500/30 text-red-400"
                                : "bg-purple-500/30 text-purple-400"
                          : "bg-surface-light text-neutral-500"
                      }`}
                    >
                      {d === "easy"
                        ? "Facile"
                        : d === "medium"
                          ? "Moyen"
                          : d === "hard"
                            ? "Dur"
                            : "Expert"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mod.module_type === "dilemme_parfait" && (
            <div>
              <label className="text-sm text-neutral-400 mb-1 block">
                Sous-modes :
              </label>
              <div className="flex gap-2 flex-wrap">
                {ALL_DILEMME_MODES.map((dm) => {
                  const active = (mod.dilemme_sub_modes ?? ALL_DILEMME_MODES).includes(dm);
                  return (
                    <button
                      key={dm}
                      onClick={() => {
                        const current = mod.dilemme_sub_modes ?? ALL_DILEMME_MODES;
                        const newModes = active
                          ? current.filter((x) => x !== dm)
                          : [...current, dm];
                        if (newModes.length > 0) {
                          updateModule(i, { dilemme_sub_modes: newModes });
                        }
                      }}
                      className={`badge transition-colors cursor-pointer ${
                        active
                          ? "bg-brand-orange/30 text-brand-orange"
                          : "bg-surface-light text-neutral-500"
                      }`}
                    >
                      {DILEMME_SUB_MODE_LABELS[dm]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}

      <button onClick={addModule} className="btn-secondary w-full">
        + Ajouter un module
      </button>
    </div>
  );
}
