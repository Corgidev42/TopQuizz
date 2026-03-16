import httpx
import re
import json

from app.config import settings
from app.services.gemini_engine import get_gemini, GeminiEngine


def _strip_code_fences(text: str) -> str:
    s = (text or "").strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", s, flags=re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return s


def _parse_json(text: str):
    s = _strip_code_fences(text)
    if not s:
        raise ValueError("Empty AI response")

    first_obj = s.find("{")
    first_arr = s.find("[")
    candidates = [i for i in (first_obj, first_arr) if i != -1]
    if candidates:
        start = min(candidates)
        last_obj = s.rfind("}")
        last_arr = s.rfind("]")
        end = max(last_obj, last_arr)
        if end > start:
            s = s[start : end + 1].strip()

    s = re.sub(r",\s*(\}|\])", r"\1", s)
    return json.loads(s)


class OllamaEngine:
    def __init__(self, model: str | None = None):
        self.model = (model or settings.ollama_model).strip()

    async def _generate_text(self, prompt: str) -> str:
        url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
        async with httpx.AsyncClient(timeout=180.0) as client:
            try:
                resp = await client.post(
                    url,
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "keep_alive": "10m",
                        "options": {
                            "temperature": 0.2,
                            "num_predict": 900,
                            "num_ctx": 4096,
                        },
                    },
                )
            except httpx.RequestError as e:
                raise RuntimeError(
                    f"Ollama injoignable sur {url}. Vérifie que Ollama tourne bien et que OLLAMA_BASE_URL est correct."
                ) from e

            if resp.status_code == 404:
                raise RuntimeError(
                    f"Ollama a répondu 404 sur {url}. La route /api/generate n'existe pas sur ce serveur."
                )

            resp.raise_for_status()
            data = resp.json() or {}
            return (data.get("response") or "").strip()

    async def _generate_json(self, prompt: str):
        text = await self._generate_text(
            prompt
            + "\n\nIMPORTANT: Retourne UNIQUEMENT du JSON valide, sans markdown, sans texte."
        )
        return _parse_json(text)

    async def generate_quiz_questions(self, theme: str, num: int, difficulties):
        diff_str = ", ".join([d.value if hasattr(d, "value") else str(d) for d in difficulties])
        prompt = f"""Génère exactement {num} questions de quiz à choix multiples sur le thème "{theme}".
Chaque question doit avoir exactement 4 options et une seule bonne réponse.
Répartis les difficultés parmi : {diff_str}.

Retourne UNIQUEMENT un tableau JSON valide où chaque élément a :
{{
  "question": "Le texte de la question",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "correct_answer": "Le texte exact de la bonne option",
  "difficulty": "easy|medium|hard|expert"
}}

Les questions doivent être engageantes, fun et variées. En français."""
        return await self._generate_json(prompt)

    async def generate_commu_questions(self, num: int, theme: str | None = None):
        theme_line = (
            f'Thème imposé : "{theme}". Les questions DOIVENT respecter ce thème.'
            if theme
            else "Aucun thème imposé : questions variées et dans l'air du temps."
        )
        prompt = f"""Génère {num} questions de type sondage pour un jeu similaire à "Une Famille en Or".
{theme_line}
Chaque question doit commencer par "Citez...", "Nommez..." ou "Quel est...".
Pour chaque question, génère les 6 réponses les plus probables d'une communauté.
Classe les réponses par probabilité, la première recevant un score de 100.

Retourne UNIQUEMENT un tableau JSON valide :
[
  {{
    "question": "...",
    "difficulty": "easy|medium|hard",
    "answers": [
      {{"answer": "...", "score": 100}}
    ]
  }}
]
En français."""
        return await self._generate_json(prompt)

    async def generate_blindtest_suggestions(self, num: int, theme: str | None = None):
        theme_part = f'sur le thème "{theme}"' if theme else "de hits populaires, iconiques et variés"
        prompt = f"""Génère une liste de {num} chansons très connues pour un blind test {theme_part}.
Retourne UNIQUEMENT un tableau JSON valide :
[
  {{
    "artist": "Nom de l'artiste",
    "title": "Titre de la chanson",
    "search_query": "Artiste - Titre (Official Audio)"
  }}
]"""
        return await self._generate_json(prompt)

    async def check_answer(self, expected: str, given: str) -> bool:
        prompt = f"""Dans un jeu de quiz, la bonne réponse est : "{expected}"
Le joueur a répondu : "{given}"

La réponse du joueur est-elle essentiellement correcte ?
Réponds UNIQUEMENT par "YES" ou "NO"."""
        text = (await self._generate_text(prompt)).strip().upper()
        return "YES" in text and "NO" not in text

    async def check_commu_answer(self, expected_answers: list[dict], given: str) -> dict | None:
        answers_str = ", ".join([a["answer"] for a in expected_answers])
        prompt = f"""Dans un jeu "Famille en Or", les réponses attendues sont : {answers_str}
Le joueur a répondu : "{given}"

La réponse du joueur correspond-elle à UNE des réponses attendues ?
Réponds UNIQUEMENT avec le texte exact de la réponse correspondante, ou "NONE"."""
        result = (await self._generate_text(prompt)).strip()
        if result == "NONE":
            return None
        for a in expected_answers:
            if a["answer"].lower() == result.lower():
                return a
        return None


class AIRouter:
    def __init__(self, provider: str = "gemini", ollama_model: str | None = None):
        self.provider = provider
        self.ollama_model = ollama_model
        self._gemini: GeminiEngine | None = None
        self._ollama: OllamaEngine | None = None

    @property
    def gemini(self) -> GeminiEngine:
        if self._gemini is None:
            self._gemini = get_gemini()
        return self._gemini

    @property
    def ollama(self) -> OllamaEngine:
        if self._ollama is None:
            self._ollama = OllamaEngine(model=self.ollama_model)
        return self._ollama

    # Generation routes
    async def generate_quiz_questions(self, *args, **kwargs):
        if self.provider == "ollama":
            return await self.ollama.generate_quiz_questions(*args, **kwargs)
        return await self.gemini.generate_quiz_questions(*args, **kwargs)

    async def generate_commu_questions(self, *args, **kwargs):
        if self.provider == "ollama":
            return await self.ollama.generate_commu_questions(*args, **kwargs)
        return await self.gemini.generate_commu_questions(*args, **kwargs)

    async def generate_blindtest_suggestions(self, *args, **kwargs):
        if self.provider == "ollama":
            return await self.ollama.generate_blindtest_suggestions(*args, **kwargs)
        return await self.gemini.generate_blindtest_suggestions(*args, **kwargs)

    # Always Gemini for vision / external fetch flows (memory/face)
    async def generate_memory_challenge(self, *args, **kwargs):
        return await self.gemini.generate_memory_challenge(*args, **kwargs)

    async def generate_face_challenges(self, *args, **kwargs):
        return await self.gemini.generate_face_challenges(*args, **kwargs)

    # Answer checking routes
    async def check_answer(self, *args, **kwargs):
        if self.provider == "ollama":
            return await self.ollama.check_answer(*args, **kwargs)
        return await self.gemini.check_answer(*args, **kwargs)

    async def check_commu_answer(self, *args, **kwargs):
        if self.provider == "ollama":
            return await self.ollama.check_commu_answer(*args, **kwargs)
        return await self.gemini.check_commu_answer(*args, **kwargs)


def get_ai_for_session(session) -> AIRouter:
    provider = getattr(session, "ai_provider", "gemini") or "gemini"
    ollama_model = getattr(session, "ollama_model", None)
    return AIRouter(provider=provider, ollama_model=ollama_model)

