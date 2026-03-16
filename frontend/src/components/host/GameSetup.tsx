import { useEffect, useState } from "react";
import Spinner from "../shared/Spinner";
import type { Player, Preset, ModuleConfig, ModuleType, Difficulty } from "../../types";
import { MODULE_LABELS, MODULE_ICONS } from "../../types";
import ModuleSelector from "./ModuleSelector";
import { QRCodeSVG } from "qrcode.react";
import { useGameStore } from "../../stores/gameStore";

interface Props {
  gameId: string;
  presets: Preset[];
  players: Record<string, Player>;
  joinUrl: string;
  onStart: (config: {
    preset?: string;
    modules?: ModuleConfig[];
    ai?: { provider: "gemini" | "ollama"; ollama_model?: string };
  }) => void;
}

export default function GameSetup({
  gameId,
  presets,
  players,
  joinUrl,
  onStart,
}: Props) {
  const lastErrorAt = useGameStore((s) => s.lastErrorAt);
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

  // AI selection (persisted)
  const [aiProvider, setAiProvider] = useState<"gemini" | "ollama">(
    (localStorage.getItem("topquizz_ai_provider") as "gemini" | "ollama") || "gemini"
  );
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaModel, setOllamaModel] = useState<string>(
    localStorage.getItem("topquizz_ollama_model") || ""
  );
  const [loadingModels, setLoadingModels] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Si une erreur IA survient pendant la génération, on libère le bouton
  useEffect(() => {
    if (lastErrorAt && loading) {
      setLoading(false);
    }
  }, [lastErrorAt]);

  const loadOllamaModels = async () => {
    setLoadingModels(true);
    try {
      const resp = await fetch("/api/ai/ollama/models");
      const data = await resp.json();
      const models: string[] = Array.isArray(data?.models) ? data.models : [];
      setOllamaModels(models);
      if (!ollamaModel && models[0]) setOllamaModel(models[0]);
    } catch {
      setOllamaModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Game info */}
      <div className="card">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">
              Partie{" "}
              <span className="text-brand-orange">{gameId}</span>
            </h2>
            <p className="text-neutral-400 text-sm break-all">{joinUrl}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-brand-orange">
              {playerCount}
            </div>
            <div className="text-neutral-400 text-sm">joueur(s)</div>
          </div>
        </div>

        {/* Join actions */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => {
              navigator.clipboard?.writeText(joinUrl).catch(() => {});
            }}
          >
            Copier le lien mobile
          </button>
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => setShowQr((v) => !v)}
          >
            {showQr ? "Masquer le QR" : "Afficher le QR"}
          </button>
        </div>

        {showQr && (
          <div className="mt-4 text-center">
            <div className="bg-white p-4 rounded-xl inline-block">
              <QRCodeSVG value={joinUrl} size={180} level="M" />
            </div>
          </div>
        )}

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

      {/* AI selection */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">IA</h3>
            <p className="text-neutral-400 text-sm">
              Choisis le moteur utilisé pour générer les questions.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-neutral-400 mb-1 block">
              Provider
            </label>
            <select
              className="input-field"
              value={aiProvider}
              onChange={(e) => {
                const v = e.target.value as "gemini" | "ollama";
                setAiProvider(v);
                localStorage.setItem("topquizz_ai_provider", v);
                if (v === "ollama" && ollamaModels.length === 0) {
                  void loadOllamaModels();
                }
              }}
            >
              <option value="gemini">Gemini</option>
              <option value="ollama">Ollama (local)</option>
            </select>
          </div>

          {aiProvider === "ollama" && (
            <div>
              <label className="text-sm text-neutral-400 mb-1 block">
                Modèle Ollama
              </label>
              <div className="flex gap-2">
                <select
                  className="input-field flex-1"
                  value={ollamaModel}
                  onChange={(e) => {
                    setOllamaModel(e.target.value);
                    localStorage.setItem("topquizz_ollama_model", e.target.value);
                  }}
                  disabled={loadingModels}
                >
                  {(ollamaModels.length ? ollamaModels : [""]).map((m) => (
                    <option key={m || "empty"} value={m}>
                      {m || (loadingModels ? "Chargement..." : "Aucun modèle détecté")}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary whitespace-nowrap"
                  onClick={() => void loadOllamaModels()}
                  disabled={loadingModels}
                >
                  {loadingModels ? "..." : "Rafraîchir"}
                </button>
              </div>
            </div>
          )}
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
          const ai =
            aiProvider === "ollama"
              ? { provider: "ollama" as const, ollama_model: ollamaModel || undefined }
              : { provider: "gemini" as const };
          if (mode === "preset") {
            onStart({ preset: selectedPreset, ai });
          } else {
            onStart({ modules: customModules, ai });
          }
        }}
        disabled={playerCount === 0 || loading}
        className={`w-full py-4 rounded-xl font-bold text-xl transition-all flex items-center justify-center ${
          playerCount === 0 || loading
            ? "bg-neutral-700 text-neutral-500 cursor-not-allowed"
            : "btn-primary"
        }`}
      >
        {loading ? (
          <><Spinner /> <span className="ml-3">Génération en cours...</span></>
        ) : playerCount === 0 ? (
          "En attente de joueurs..."
        ) : (
          `Lancer la partie (${playerCount} joueur${playerCount > 1 ? "s" : ""}) 🚀`
        )}
      </button>
    </div>
  );
}
