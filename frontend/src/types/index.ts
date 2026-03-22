export type GamePhase =
  | "lobby"
  | "playing"
  | "memory_preview"
  | "module_intro"
  | "buzzer_open"
  | "answering"
  | "question_result"
  | "module_result"
  | "tiebreaker"
  | "final_results"
  | "dilemme_submit"
  | "dilemme_vote"
  | "dilemme_vote_result";

export type ModuleType =
  | "master_quiz"
  | "master_memory"
  | "master_face"
  | "master_commu"
  | "blind_test"
  | "dilemme_parfait";

export type Difficulty = "easy" | "medium" | "hard" | "expert";

export type DilemmeSubMode =
  | "ai_start"
  | "vous_aimez"
  | "pourriez_vous"
  | "libre";

export interface Player {
  pseudo: string;
  color: string;
  score: number;
  is_eliminated: boolean;
  is_connected: boolean;
}

export interface Question {
  id: string;
  text: string;
  module_type: ModuleType;
  difficulty: Difficulty;
  points: number;
  correct_answer: string;
  options?: string[];
  image_url?: string;
  blur_level?: number;
  pixelation_level?: number;
  media_path?: string;
  extra_data?: Record<string, unknown>;
}

export interface ScoreEntry {
  sid: string;
  pseudo: string;
  color: string;
  score: number;
}

export interface DilemmeSubmission {
  sid: string;
  pseudo: string;
  color: string;
  text: string;
  yes_count?: number;
  no_count?: number;
  yes_pct?: number;
  points?: number;
}

export interface DilemmeState {
  sub_mode: DilemmeSubMode;
  prompt: string | null;
  submissions: DilemmeSubmission[];
  current_submission_index: number;
  votes: Record<string, boolean>;
  round_index: number;
  total_rounds: number;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  players: Record<string, Player>;
  current_module: ModuleType | null;
  current_module_index: number;
  total_modules: number;
  current_question_index: number;
  total_questions: number;
  current_question: Question | null;
  scores: ScoreEntry[];
  active_answerer: string | null;
  buzzer_open: boolean;
  eliminated_this_question: string[];
  commu_revealed: string[];
  memory_preview?: {
    image_url?: string | null;
    started_at: number;
    countdown_seconds: number;
    show_seconds: number;
  } | null;
  tiebreaker_scores: Record<string, number>;
  dilemme?: DilemmeState;
}

export interface ModuleConfig {
  module_type: ModuleType;
  num_questions: number;
  theme?: string;
  difficulty_mix: Difficulty[];
  dilemme_sub_modes?: DilemmeSubMode[];
}

export interface Preset {
  name: string;
  description: string;
  modules: ModuleConfig[];
}

export const MODULE_LABELS: Record<ModuleType, string> = {
  master_quiz: "TopQuizz",
  master_memory: "TopMémoire",
  master_face: "TopFace",
  master_commu: "TopCommu",
  blind_test: "TopBlindtest",
  dilemme_parfait: "TopDilemme",
};

export const MODULE_ICONS: Record<ModuleType, string> = {
  master_quiz: "🧠",
  master_memory: "👁️",
  master_face: "🎭",
  master_commu: "👥",
  blind_test: "🎵",
  dilemme_parfait: "⚖️",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Facile",
  medium: "Moyen",
  hard: "Difficile",
  expert: "Expert",
};

export const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
  expert: 5,
};

export const DILEMME_SUB_MODE_LABELS: Record<DilemmeSubMode, string> = {
  ai_start: "Dilemme IA",
  vous_aimez: "Vous aimez...",
  pourriez_vous: "Pourriez-vous...",
  libre: "Dilemme Libre",
};
