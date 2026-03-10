import { useState } from "react";
import Spinner from "../shared/Spinner";
import type { Player, Preset, ModuleConfig, ModuleType, Difficulty } from "../../types";
import { MODULE_LABELS, MODULE_ICONS } from "../../types";
import ModuleSelector from "./ModuleSelector";

interface Props {
  gameId: string;
  presets: Preset[];
  players: Record<string, Player>;
  joinUrl: string;
  onStart: (config: { preset?: string; modules?: ModuleConfig[] }) => void;
}

export default function GameSetup({
  gameId,
  presets,
  players,
  joinUrl,
  onStart,
}: Props) {
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [selectedPreset, setSelectedPreset] = useState<string>(
    presets[0]?.name ?? ""
  );
  const [customModules, setCustomModules] = useState<ModuleConfig[]>([
    {
      module_type: "master_quiz" as ModuleType,
      num_questions: 5,
      theme: "Culture Générale",
      difficulty_mix: ["easy", "medium", "hard"] as Difficulty[],
    },
  ]);

  const [loading, setLoading] = useState(false);
  const playerCount = Object.keys(players).length;

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex justify-center items-center py-6">
          <Spinner />
          <span className="ml-3 text-brand-orange font-semibold">Génération de la partie...</span>
        </div>
      )}
      {/* Game info */}
      <div className="card">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">
              Partie{" "}
              <span className="text-brand-orange">{gameId}</span>
            </h2>
            <p className="text-neutral-400 text-sm">{joinUrl}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-brand-orange">
              {playerCount}
            </div>
            <div className="text-neutral-400 text-sm">joueur(s)</div>
          </div>
        </div>

        {/* Player chips */}
        <div className="flex flex-wrap gap-2 mt-4">
          {Object.entries(players).map(([sid, p]) => (
            <div
              key={sid}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-light text-sm"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {p.pseudo}
            </div>
          ))}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("preset")}
          className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
            mode === "preset"
              ? "bg-brand-orange text-white"
              : "bg-surface-light text-neutral-400"
          }`}
        >
          Presets
        </button>
        <button
          onClick={() => setMode("custom")}
          className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
            mode === "custom"
              ? "bg-brand-orange text-white"
              : "bg-surface-light text-neutral-400"
          }`}
        >
          Personnalisé
        </button>
      </div>

      {/* Preset selection */}
      {mode === "preset" && (
        <div className="space-y-3">
          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => setSelectedPreset(preset.name)}
              className={`w-full card text-left transition-colors ${
                selectedPreset === preset.name
                  ? "border-brand-orange"
                  : "border-neutral-800 hover:border-neutral-600"
              }`}
            >
              <h3 className="font-bold text-lg">{preset.name}</h3>
              <p className="text-neutral-400 text-sm mb-2">
                {preset.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {preset.modules.map((m, i) => (
                  <span
                    key={i}
                    className="text-xs bg-surface-light px-2 py-1 rounded-full"
                  >
                    {MODULE_ICONS[m.module_type]}{" "}
                    {MODULE_LABELS[m.module_type]} ({m.num_questions}q)
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Custom module builder */}
      {mode === "custom" && (
        <ModuleSelector
          modules={customModules}
          onChange={setCustomModules}
        />
      )}

      {/* Start button */}
      <button
        onClick={() => {
          setLoading(true);
          if (mode === "preset") {
            onStart({ preset: selectedPreset });
          } else {
            onStart({ modules: customModules });
          }
        }}
        disabled={playerCount === 0 || loading}
        className={`w-full py-4 rounded-xl font-bold text-xl transition-all ${
          playerCount === 0 || loading
            ? "bg-neutral-700 text-neutral-500 cursor-not-allowed"
            : "btn-primary"
        }`}
      >
        {playerCount === 0
          ? "En attente de joueurs..."
          : `Lancer la partie (${playerCount} joueur${playerCount > 1 ? "s" : ""}) 🚀`}
      </button>
    </div>
  );
}
