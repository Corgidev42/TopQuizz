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
        raise RuntimeError(
            "Ollama a renvoyé une réponse vide. Vérifie que le modèle est bien compatible et chargé."
        )

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

    async def _generate_text(
        self,
        prompt: str,
        *,
        num_predict: int | None = None,
        num_ctx: int | None = None,
    ) -> str:
        url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
        opts = {
            "temperature": 0.2,
            "num_predict": num_predict if num_predict is not None else 900,
            "num_ctx": num_ctx if num_ctx is not None else 4096,
        }
        async with httpx.AsyncClient(timeout=180.0) as client:
            try:
                resp = await client.post(
                    url,
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "keep_alive": "10m",
                        "options": opts,
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

    async def _generate_json(
        self,
        prompt: str,
        *,
        num_predict: int | None = None,
        num_ctx: int | None = None,
    ):
        text = await self._generate_text(
            prompt
            + "\n\nIMPORTANT: Retourne UNIQUEMENT du JSON valide, sans markdown, sans texte.",
            num_predict=num_predict,
            num_ctx=num_ctx,
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

    async def generate_dilemme_start(self, positive: bool, count: int = 1) -> list[str]:
        tone = "positif (quelque chose de très désirable)" if positive else "négatif (quelque chose de très indésirable ou bizarre)"
        prompt = f"""Génère {count} début(s) de dilemme {tone} pour un jeu de société.
Chaque début doit être une proposition courte et percutante qui se termine par "mais...".

Exemples positifs : "Tu as 10 millions d'euros mais...", "Tu peux voler mais..."
Exemples négatifs : "Tu es poilu comme Chewbacca mais...", "Tu sens le fromage 24h/24 mais..."

Retourne UNIQUEMENT un tableau JSON de strings :
["Premier dilemme...", "Deuxième dilemme..."]

En français, fun et créatif."""
        result = await self._generate_json(prompt)
        if isinstance(result, list):
            return result
        return [str(result)]

    def _strip_option_prefix(self, text: str) -> str:
        return re.sub(r"^[A-Da-d][\.\)\-\:\s]\s*", "", (text or "").strip())

    def _normalize_ttmc_question_dict(self, q: dict) -> dict:
        if q.get("options"):
            q["options"] = [self._strip_option_prefix(o) for o in q["options"]]
        if q.get("correct_answer"):
            q["correct_answer"] = self._strip_option_prefix(q["correct_answer"])
        return q

    async def generate_ttmc_full_rounds(self, base_theme: str, num_rounds: int) -> list[dict]:
        """Un seul appel Ollama pour tout le module TTMC (même contrat que Gemini)."""
        n = max(1, min(20, int(num_rounds)))
        prompt = f"""Tu conçois un pack pour le jeu « Tu te mets combien ? » (TTMC).
Thème général : « {base_theme} ».
Nombre de manches (rounds) : exactement {n}.

Pour chaque manche :
- Choisis un sous-thème court, précis et amusant, dérivé du thème général.
- Génère exactement 10 questions QCM à 4 options, difficulté croissante du niveau 1 (très facile) au niveau 10 (expert).
- Une seule bonne réponse par question. Les options ne doivent PAS commencer par « A. », « B) », etc.

Retourne UNIQUEMENT un objet JSON de cette forme :
{{
  "rounds": [
    {{
      "theme": "Sous-thème de la manche 1",
      "questions": [
        {{"level": 1, "question": "...", "options": ["...", "...", "...", "..."], "correct_answer": "..."}}
      ]
    }}
  ]
}}

Contraintes strictes :
- Le tableau « rounds » contient exactement {n} objets.
- Chaque « questions » contient exactement 10 objets, levels 1 à 10 dans l'ordre.
- En français."""
        raw = await self._generate_json(
            prompt,
            num_predict=min(32000, 8000 + n * 3500),
            num_ctx=32768,
        )
        if isinstance(raw, list):
            rounds = raw
        elif isinstance(raw, dict):
            rounds = raw.get("rounds") or []
        else:
            rounds = []

        normalized: list[dict] = []
        for r in rounds:
            if not isinstance(r, dict):
                continue
            theme = (r.get("theme") or base_theme).strip() or base_theme
            qs_in = r.get("questions") or []
            questions: list[dict] = []
            for q in qs_in:
                if not isinstance(q, dict):
                    continue
                questions.append(self._normalize_ttmc_question_dict(dict(q)))
            normalized.append({"theme": theme, "questions": questions})

        while len(normalized) < n:
            normalized.append({"theme": base_theme, "questions": []})
        return normalized[:n]

    async def check_answer(self, expected: str, given: str) -> bool:
        prompt = f"""Dans un jeu de quiz, la bonne réponse est : "{expected}"
Le joueur a répondu : "{given}"

La réponse du joueur est-elle essentiellement correcte ?
Réponds UNIQUEMENT par "YES" ou "NO"."""
        text = (await self._generate_text(prompt)).strip().upper()
        return "YES" in text and "NO" not in text

    async def check_answers_batch(self, question: str, entries: list[dict]) -> dict[str, dict]:
        payload = {
            "question": question,
            "entries": entries,
        }
        prompt = f"""Tu es arbitre de quiz.
Évalue chaque réponse de joueur par rapport à sa bonne réponse attendue.

Règles :
- Sois flexible : tolère fautes d'orthographe mineures, typos, abréviations et formulations proches.
- Marque "correct": true uniquement si le sens est globalement correct.
- "score" vaut "max_points" si correct, sinon 0.
- Retourne UNIQUEMENT un JSON valide.

Format de sortie strict :
{{
  "<player_id>": {{
    "correct": true,
    "score": 10
  }}
}}

Données à évaluer :
{json.dumps(payload, ensure_ascii=False)}
"""
        raw = await self._generate_json(prompt, num_predict=4096, num_ctx=16384)
        if not isinstance(raw, dict):
            return {}
        out: dict[str, dict] = {}
        for item in entries:
            sid = str(item.get("player_id", ""))
            max_points = int(item.get("max_points", 0) or 0)
            data = raw.get(sid, {}) if sid else {}
            correct = bool(data.get("correct", False)) if isinstance(data, dict) else False
            score = int(data.get("score", max_points if correct else 0) or 0) if isinstance(data, dict) else 0
            out[sid] = {
                "correct": correct,
                "score": max(0, min(max_points, score if correct else 0)),
            }
        return out

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

    async def generate_ttmc_questions(self, theme: str) -> list[dict]:
        """Une seule manche TTMC (10 niveaux) — préférer generate_ttmc_full_rounds pour un module complet."""
        pack = await self.generate_ttmc_full_rounds(theme, 1)
        return pack[0].get("questions", []) if pack else []

    async def generate_ttmc_full_rounds(self, base_theme: str, num_rounds: int) -> list[dict]:
        if self.provider == "ollama":
            return await self.ollama.generate_ttmc_full_rounds(base_theme, num_rounds)
        return await self.gemini.generate_ttmc_full_rounds(base_theme, num_rounds)

    async def generate_commu_questions(self, *args, **kwargs):
        if self.provider == "ollama":
            return await self.ollama.generate_commu_questions(*args, **kwargs)
        return await self.gemini.generate_commu_questions(*args, **kwargs)

    async def generate_blindtest_suggestions(self, *args, **kwargs):
        if self.provider == "ollama":
            return await self.ollama.generate_blindtest_suggestions(*args, **kwargs)
        return await self.gemini.generate_blindtest_suggestions(*args, **kwargs)

    async def generate_dilemme_start(self, *args, **kwargs):
        if self.provider == "ollama":
            return await self.ollama.generate_dilemme_start(*args, **kwargs)
        return await self.gemini.generate_dilemme_start(*args, **kwargs)

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

    async def check_answers_batch(self, *args, **kwargs):
        if self.provider == "ollama":
            return await self.ollama.check_answers_batch(*args, **kwargs)
        return await self.gemini.check_answers_batch(*args, **kwargs)

    async def check_commu_answer(self, *args, **kwargs):
        if self.provider == "ollama":
            return await self.ollama.check_commu_answer(*args, **kwargs)
        return await self.gemini.check_commu_answer(*args, **kwargs)


def get_ai_for_session(session) -> AIRouter:
    provider = getattr(session, "ai_provider", "gemini") or "gemini"
    ollama_model = getattr(session, "ollama_model", None)
    return AIRouter(provider=provider, ollama_model=ollama_model)

