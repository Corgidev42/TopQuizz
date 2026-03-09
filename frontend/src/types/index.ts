export type GamePhase =
  | "lobby"
  | "playing"
  | "module_intro"
  | "buzzer_open"
  | "answering"
  | "question_result"
  | "module_result"
  | "tiebreaker"
  | "final_results";

export type ModuleType =
  | "master_quiz"
  | "master_memory"
  | "master_face"
  | "master_commu"
  | "blind_test";

export type Difficulty = "easy" | "medium" | "hard" | "expert";

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
  media_path?: string;
  extra_data?: Record<string, unknown>;
}

export interface ScoreEntry {
  sid: string;
  pseudo: string;
  color: string;
  score: number;
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
  tiebreaker_scores: Record<string, number>;
}

export interface ModuleConfig {
  module_type: ModuleType;
  num_questions: number;
  theme?: string;
  difficulty_mix: Difficulty[];
}

export interface Preset {
  name: string;
  description: string;
  modules: ModuleConfig[];
}

export const MODULE_LABELS: Record<ModuleType, string> = {
  master_quiz: "MasterQuiz",
  master_memory: "Master Mémoire",
  master_face: "Master Face",
  master_commu: "Master Commu",
  blind_test: "Blind Test",
};

export const MODULE_ICONS: Record<ModuleType, string> = {
  master_quiz: "🧠",
  master_memory: "👁️",
  master_face: "🎭",
  master_commu: "👥",
  blind_test: "🎵",
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
