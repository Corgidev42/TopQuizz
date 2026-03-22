from pydantic import BaseModel, model_validator
from typing import Optional

from app.models.enums import ModuleType, Difficulty, DilemmeSubMode, DIFFICULTY_POINTS


class Question(BaseModel):
    id: str
    module_type: ModuleType
    text: str
    options: Optional[list[str]] = None
    correct_answer: str
    difficulty: Difficulty
    points: int = 0
    image_url: Optional[str] = None
    media_path: Optional[str] = None
    extra_data: Optional[dict] = None
    blur_level: Optional[int] = None
    pixelation_level: Optional[int] = None

    @model_validator(mode="after")
    def set_points_from_difficulty(self):
        if self.points == 0:
            self.points = DIFFICULTY_POINTS.get(self.difficulty, 1)
        return self


class ModuleConfig(BaseModel):
    module_type: ModuleType
    num_questions: int = 5
    theme: Optional[str] = None
    difficulty_mix: list[Difficulty] = [
        Difficulty.EASY,
        Difficulty.MEDIUM,
        Difficulty.HARD,
    ]
    dilemme_sub_modes: Optional[list[DilemmeSubMode]] = None


class GamePreset(BaseModel):
    name: str
    description: str
    modules: list[ModuleConfig]
