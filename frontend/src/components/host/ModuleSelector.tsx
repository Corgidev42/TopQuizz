import type { ModuleConfig, ModuleType, Difficulty } from "../../types";
import { MODULE_LABELS, MODULE_ICONS } from "../../types";

const ALL_MODULES: ModuleType[] = [
  "master_quiz",
  "master_memory",
  "master_face",
  "master_commu",
  "blind_test",
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
            mod.module_type === "blind_test") && (
            <input
              type="text"
              value={mod.theme ?? ""}
              onChange={(e) => updateModule(i, { theme: e.target.value })}
              placeholder={
                mod.module_type === "master_commu"
                  ? "Thème (ex: nourriture, sport, vacances...)"
                  : mod.module_type === "blind_test"
                    ? "Thème (ex: anime, hits 2000, rap FR...)"
                    : "Thème (ex: Pop Culture, Science...)"
              }
              className="input-field"
            />
          )}

          {mod.module_type !== "master_memory" && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-neutral-400 whitespace-nowrap">
                Questions :
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

          {mod.module_type !== "master_memory" && (
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
        </div>
      ))}

      <button onClick={addModule} className="btn-secondary w-full">
        + Ajouter un module
      </button>
    </div>
  );
}
