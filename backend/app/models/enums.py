from enum import Enum


class GamePhase(str, Enum):
    LOBBY = "lobby"
    PLAYING = "playing"
    MEMORY_PREVIEW = "memory_preview"
    MODULE_INTRO = "module_intro"
    BUZZER_OPEN = "buzzer_open"
    ANSWERING = "answering"
    QUESTION_RESULT = "question_result"
    MODULE_RESULT = "module_result"
    TIEBREAKER = "tiebreaker"
    FINAL_RESULTS = "final_results"


class ModuleType(str, Enum):
    MASTER_QUIZ = "master_quiz"
    MASTER_MEMORY = "master_memory"
    MASTER_FACE = "master_face"
    MASTER_COMMU = "master_commu"
    BLIND_TEST = "blind_test"


class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"


DIFFICULTY_POINTS: dict[Difficulty, int] = {
    Difficulty.EASY: 1,
    Difficulty.MEDIUM: 2,
    Difficulty.HARD: 3,
    Difficulty.EXPERT: 5,
}

MODULE_LABELS: dict[ModuleType, str] = {
    ModuleType.MASTER_QUIZ: "TopQuizz",
    ModuleType.MASTER_MEMORY: "TopMémoire",
    ModuleType.MASTER_FACE: "TopFace",
    ModuleType.MASTER_COMMU: "TopCommu",
    ModuleType.BLIND_TEST: "TopBlindtest",
}
