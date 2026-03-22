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
    DILEMME_SUBMIT = "dilemme_submit"
    DILEMME_VOTE = "dilemme_vote"
    DILEMME_VOTE_RESULT = "dilemme_vote_result"


class ModuleType(str, Enum):
    MASTER_QUIZ = "master_quiz"
    MASTER_MEMORY = "master_memory"
    MASTER_FACE = "master_face"
    MASTER_COMMU = "master_commu"
    BLIND_TEST = "blind_test"
    DILEMME_PARFAIT = "dilemme_parfait"


class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"


class DilemmeSubMode(str, Enum):
    AI_START = "ai_start"
    VOUS_AIMEZ = "vous_aimez"
    POURRIEZ_VOUS = "pourriez_vous"
    LIBRE = "libre"


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
    ModuleType.DILEMME_PARFAIT: "TopDilemme",
}
