import uuid
from pydantic import BaseModel, Field


class Player(BaseModel):
    sid: str
    pseudo: str
    color: str
    score: int = 0
    is_eliminated: bool = False
    is_connected: bool = True
    token: str = Field(default_factory=lambda: uuid.uuid4().hex)


PLAYER_COLORS: list[str] = [
    "#F97316", "#3B82F6", "#10B981", "#EF4444", "#8B5CF6",
    "#EC4899", "#14B8A6", "#F59E0B", "#6366F1", "#84CC16",
    "#06B6D4", "#E11D48", "#7C3AED", "#059669", "#D97706",
    "#0EA5E9", "#A855F7", "#22C55E", "#F43F5E", "#FACC15",
]
