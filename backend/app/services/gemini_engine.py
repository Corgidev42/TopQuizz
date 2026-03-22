import json
import re
import httpx
import asyncio
import time
from io import BytesIO
from PIL import Image
import google.generativeai as genai

from app.config import settings
from app.models.enums import Difficulty


class _TextResponse:
    def __init__(self, text: str):
        self.text = text


class GeminiEngine:
    def __init__(self):
        genai.configure(api_key=settings.gemini_api_key)
        self._model_name = settings.gemini_model or "gemini-2.0-flash"
        self._fallback_models = [
            m.strip()
            for m in (settings.gemini_fallback_models or "").split(",")
            if m.strip()
        ]
        if self._model_name not in self._fallback_models:
            self._fallback_models.insert(0, self._model_name)
        self.model = genai.GenerativeModel(self._model_name)

    def _is_quota_error(self, e: Exception) -> bool:
        msg = str(e).lower()
        return "429" in msg or "quota" in msg or "resourceexhausted" in msg

    async def _ollama_generate_text(self, prompt: str) -> str:  # deprecated
        raise RuntimeError(
            "L'intégration directe Ollama depuis GeminiEngine est désactivée. "
            "Utilise AIRouter/OllamaEngine à la place."
        )

    def _extract_retry_delay_seconds(self, e: Exception) -> float | None:
        msg = str(e)
        m = re.search(r"retry in\s+(\d+(?:\.\d+)?)s", msg, flags=re.IGNORECASE)
        if m:
            try:
                return float(m.group(1))
            except Exception:
                return None
        m = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", msg, flags=re.IGNORECASE)
        if m:
            try:
                return float(m.group(1))
            except Exception:
                return None
        return None

    async def _generate_content(self, payload):
        start = time.perf_counter()
        try:
            result = await self.model.generate_content_async(payload)
            elapsed = time.perf_counter() - start
            if elapsed >= 3.0:
                print(f"[AI] Gemini({self._model_name}) ok in {elapsed:.2f}s")
            return result
        except Exception as e:
            # Plus de fallback automatique vers Ollama ici :
            # si Gemini échoue, on remonte proprement l'erreur.
            if not self._is_quota_error(e):
                raise

            retry_delay = self._extract_retry_delay_seconds(e)
            if retry_delay:
                await asyncio.sleep(min(30.0, max(0.0, retry_delay)))

            for candidate in self._fallback_models:
                if candidate == self._model_name:
                    continue
                try:
                    self._model_name = candidate
                    self.model = genai.GenerativeModel(candidate)
                    result = await self.model.generate_content_async(payload)
                    elapsed = time.perf_counter() - start
                    if elapsed >= 3.0:
                        print(f"[AI] Gemini fallback({self._model_name}) ok in {elapsed:.2f}s")
                    return result
                except Exception as e2:
                    if self._is_quota_error(e2):
                        continue
                    raise
            raise

    def _parse_json(self, text: str):
        s = (text or "").strip()
        if not s:
            raise ValueError("Empty AI response")

        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", s)
        if match:
            s = match.group(1).strip()
        else:
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
        try:
            return json.loads(s)
        except Exception as e:
            preview = (text or "").strip().replace("\n", " ")
            preview = preview[:240]
            raise ValueError(f"Invalid JSON from AI: {e}. Preview: {preview}") from e

    async def _generate_json(self, payload):
        def with_strict_json(p):
            suffix = "\n\nIMPORTANT: Retourne UNIQUEMENT du JSON valide, sans markdown, sans texte."
            if isinstance(p, str):
                return p + suffix
            if isinstance(p, list) and p and isinstance(p[0], str):
                return [p[0] + suffix, *p[1:]]
            return None

        response = await self._generate_content(payload)
        try:
            return self._parse_json(response.text)
        except Exception:
            retry_payload = with_strict_json(payload)
            if retry_payload is None:
                raise
            response2 = await self._generate_content(retry_payload)
            return self._parse_json(response2.text)

    @staticmethod
    def _strip_option_prefix(text: str) -> str:
        """Remove leading letter prefixes like 'A.', 'B)', 'A -', 'A:' or 'A Option' from option text."""
        # This matches things like "A. ", "A) ", "A - ", "A: ", or just "A " followed by text
        return re.sub(r"^[A-Da-d][\.\)\-\:\s]\s*", "", text.strip())

    async def generate_quiz_questions(
        self, theme: str, num: int, difficulties: list[Difficulty]
    ) -> list[dict]:
        diff_str = ", ".join([d.value for d in difficulties])
        prompt = f"""Génère exactement {num} questions de quiz à choix multiples sur le thème "{theme}".
Chaque question doit avoir exactement 4 options et une seule bonne réponse.
Répartis les difficultés parmi : {diff_str}.

Retourne UNIQUEMENT un tableau JSON valide (pas d'autre texte) où chaque élément a :
{{
  "question": "Le texte de la question",
  "options": ["Texte de l'option 1", "Texte de l'option 2", "Texte de l'option 3", "Texte de l'option 4"],
  "correct_answer": "Le texte exact de la bonne option (sans préfixe lettre)",
  "difficulty": "easy|medium|hard|expert"
}}

IMPORTANT : Les options ne doivent PAS commencer par "A.", "B.", "C.", "D." ou tout autre préfixe lettre.
Les questions doivent être engageantes, fun et variées. En français."""

        raw = await self._generate_json(prompt)

        # Strip any letter prefixes the AI may have added despite instructions
        for q in raw:
            if q.get("options"):
                q["options"] = [self._strip_option_prefix(o) for o in q["options"]]
            if q.get("correct_answer"):
                q["correct_answer"] = self._strip_option_prefix(q["correct_answer"])

        return raw

    async def generate_memory_challenge(self, theme: str = "random") -> dict:
        """Generate a memory challenge: fetch image, analyze, generate questions."""
        import random

        seed = random.randint(1, 99999)
        image_url = f"https://picsum.photos/seed/{seed}/1920/1080"

        async with httpx.AsyncClient(follow_redirects=True) as client:
            resp = await client.get(image_url)
            img = Image.open(BytesIO(resp.content))

        analysis_prompt = """Analyse cette image en détail. Décris chaque élément visible :
- Objets, personnes, animaux
- Couleurs, positions, quantités
- Détails de l'arrière-plan
- Texte ou panneaux visibles
- Météo, éclairage, ambiance

Puis génère un set de questions d'observation/mémoire sur des détails spécifiques de cette image.
Objectif : blind test de mémoire, questions fun, précises et variées.
Contraintes :
- Génère entre 6 et 10 questions.
- Inclus exactement 1 question piège (sur un élément absent de l'image). La bonne réponse doit être "0" ou "Aucun" (selon ce qui est le plus naturel).
- Mélange des questions de type comptage (combien de...), détails (couleur, position), et scènes (qui fait quoi).
- Les questions doivent être en français.

Retourne UNIQUEMENT du JSON valide :
{
  "description": "Description détaillée de l'image",
  "questions": [
    {
      "question": "Question sur un détail précis",
      "correct_answer": "La bonne réponse",
      "difficulty": "easy|medium|hard|expert"
    }
  ]
}

En français."""

        data = await self._generate_json([analysis_prompt, img])
        data["image_url"] = str(resp.url)
        return data

    async def generate_face_challenges(
        self, num: int, categories: list[str] | None = None
    ) -> list[dict]:
        """Generate celebrity face recognition challenges."""
        cats = categories or ["cinéma", "musique", "sport", "TV", "internet", "politique", "histoire"]
        cats_str = ", ".join(cats)

        prompt = f"""Génère {num} noms de célébrités très connues pour un jeu de reconnaissance faciale.
Choisis des célébrités (hommes et femmes) bien connues dans ces catégories : {cats_str}.
Mélange différents niveaux de notoriété (de très facile à difficile).
Assure une bonne diversité (pas que des acteurs américains).

Retourne UNIQUEMENT un tableau JSON valide :
[
  {{
    "name": "Nom Complet",
    "category": "catégorie",
    "fun_fact": "Un fait marquant ou une anecdote amusante sur la personne",
    "difficulty": "easy|medium|hard|expert",
    "wikipedi-name": "Nom_Tel_Que_Dans_URL_Wikipedia_FR_ou_EN"
  }}
]

Inclus des célébrités internationales ET françaises. Le nom doit être celui le plus commun (ex: 'Zinédine Zidane', pas 'Zidane')."""

        celebrities = await self._generate_json(prompt)

        sem = asyncio.Semaphore(8)

        async def fetch_image_url(client: httpx.AsyncClient, wiki_name: str) -> str:
            async with sem:
                try:
                    resp = await client.get(
                        f"https://en.wikipedia.org/api/rest_v1/page/summary/{wiki_name}",
                        headers={"User-Agent": "TopQuizz/1.0"},
                    )
                    if resp.status_code != 200:
                        return ""
                    data = resp.json()
                    url = data.get("originalimage", {}).get("source", "")
                    if not url:
                        url = data.get("thumbnail", {}).get("source", "")
                    return url or ""
                except Exception:
                    return ""

        async with httpx.AsyncClient(timeout=8.0) as client:
            tasks = []
            for celeb in celebrities:
                wiki_name = celeb.get("wikipedia_name", celeb["name"].replace(" ", "_"))
                tasks.append(fetch_image_url(client, wiki_name))

            results = await asyncio.gather(*tasks, return_exceptions=True)
            for celeb, r in zip(celebrities, results):
                if isinstance(r, Exception):
                    celeb["image_url"] = ""
                else:
                    celeb["image_url"] = r

        return celebrities

    async def generate_commu_questions(self, num: int, theme: str | None = None) -> list[dict]:
        """Generate 'Une Famille en Or' style survey questions."""
        theme_line = f'Thème imposé : "{theme}". Les questions DOIVENT respecter ce thème.' if theme else "Aucun thème imposé : questions variées et dans l'air du temps."
        prompt = f"""Génère {num} questions de type sondage pour un jeu similaire à "Une Famille en Or".
{theme_line}
Chaque question doit commencer par "Citez...", "Nommez..." ou "Quel est...".
Pour chaque question, génère les 6 réponses les plus probables d'une communauté.
Classe les réponses par probabilité, la première recevant un score de 100.

Retourne UNIQUEMENT un tableau JSON valide :
[
  {{
    "question": "Citez quelque chose que les gens font le matin",
    "difficulty": "easy|medium|hard",
    "answers": [
      {{"answer": "Prendre un café", "score": 100}},
      {{"answer": "Se brosser les dents", "score": 85}},
      {{"answer": "Prendre une douche", "score": 72}},
      {{"answer": "Regarder son téléphone", "score": 60}},
      {{"answer": "Manger", "score": 45}},
      {{"answer": "S'habiller", "score": 30}}
    ]
  }}
]

En français. Questions fun et dans l'air du temps."""

        return await self._generate_json(prompt)

    async def check_answer(self, expected: str, given: str) -> bool:
        """Use Gemini to semantically check if an answer is correct despite typos."""
        prompt = f"""Dans un jeu de quiz, la bonne réponse est : "{expected}"
Le joueur a répondu : "{given}"

La réponse du joueur est-elle essentiellement correcte ? Considère :
- Les fautes d'orthographe mineures sont acceptables
- Les formulations alternatives ou abréviations sont acceptables
- Le sens fondamental doit correspondre

Réponds UNIQUEMENT par "YES" ou "NO"."""

        response = await self._generate_content(prompt)
        return "YES" in response.text.strip().upper()

    async def generate_blindtest_suggestions(
        self, num: int, theme: str | None = None
    ) -> list[dict]:
        """Generate popular song suggestions for blind test."""
        theme_part = f'sur le thème "{theme}"' if theme else "de hits populaires, iconiques et variés (années 80, 90, 2000, 2010, 2020, OST anime/film)"
        
        prompt = f"""Génère une liste de {num} chansons très connues pour un blind test {theme_part}.
Les chansons doivent être immédiatement reconnaissables.
Mélange les styles et les époques pour que ce soit amusant.

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
        """Generate dilemma starters for the Dilemme Parfait game mode."""
        tone = "positif (quelque chose de très désirable)" if positive else "négatif (quelque chose de très indésirable ou bizarre)"
        prompt = f"""Génère {count} début(s) de dilemme {tone} pour un jeu de société.
Chaque début doit être une proposition courte et percutante qui se termine par "mais...".
Le but est que les joueurs complètent avec la contrepartie.

Exemples positifs : "Tu as 10 millions d'euros mais...", "Tu peux voler mais..."
Exemples négatifs : "Tu es poilu comme Chewbacca mais...", "Tu sens le fromage 24h/24 mais..."

Retourne UNIQUEMENT un tableau JSON de strings :
["Premier dilemme...", "Deuxième dilemme..."]

En français, fun et créatif."""
        result = await self._generate_json(prompt)
        if isinstance(result, list):
            return result
        return [str(result)]

    async def check_commu_answer(
        self, expected_answers: list[dict], given: str
    ) -> dict | None:
        """Check if a player's answer matches any expected community answers."""
        answers_str = ", ".join([a["answer"] for a in expected_answers])

        prompt = f"""Dans un jeu "Famille en Or", les réponses attendues sont : {answers_str}
Le joueur a répondu : "{given}"

La réponse du joueur correspond-elle à UNE des réponses attendues ?
Considère les fautes, synonymes et formulations alternatives.

Réponds UNIQUEMENT avec le texte exact de la réponse correspondante, ou "NONE" si aucune ne correspond.
Ta réponse doit être exactement une des réponses attendues ou "NONE"."""

        response = await self._generate_content(prompt)
        result = (response.text or "").strip()

        if result == "NONE":
            return None

        for answer in expected_answers:
            if answer["answer"].lower() == result.lower():
                return answer

        return None


_instance: GeminiEngine | None = None


def get_gemini() -> GeminiEngine:
    global _instance
    if _instance is None:
        _instance = GeminiEngine()
    return _instance
