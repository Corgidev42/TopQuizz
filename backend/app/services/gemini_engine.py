import json
import re
import httpx
from io import BytesIO
from PIL import Image
import google.generativeai as genai

from app.config import settings
from app.models.enums import Difficulty


class GeminiEngine:
    def __init__(self):
        genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel("gemini-2.0-flash")

    def _parse_json(self, text: str):
        """Extract JSON from Gemini response, handling markdown code blocks."""
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if match:
            return json.loads(match.group(1).strip())
        return json.loads(text.strip())

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

        response = await self.model.generate_content_async(prompt)
        raw = self._parse_json(response.text)

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

Puis génère 5 questions d'observation/mémoire sur des détails spécifiques de cette image.
Les questions doivent tester l'observation fine.

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

        response = await self.model.generate_content_async([analysis_prompt, img])
        data = self._parse_json(response.text)
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

        response = await self.model.generate_content_async(prompt)
        celebrities = self._parse_json(response.text)

        async with httpx.AsyncClient() as client:
            for celeb in celebrities:
                wiki_name = celeb.get(
                    "wikipedia_name", celeb["name"].replace(" ", "_")
                )
                try:
                    resp = await client.get(
                        f"https://en.wikipedia.org/api/rest_v1/page/summary/{wiki_name}",
                        headers={"User-Agent": "TopQuizz/1.0"},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        celeb["image_url"] = data.get("originalimage", {}).get(
                            "source", ""
                        )
                        if not celeb["image_url"]:
                            celeb["image_url"] = data.get("thumbnail", {}).get(
                                "source", ""
                            )
                    else:
                        celeb["image_url"] = ""
                except Exception:
                    celeb["image_url"] = ""

        return celebrities

    async def generate_commu_questions(self, num: int) -> list[dict]:
        """Generate 'Une Famille en Or' style survey questions."""
        prompt = f"""Génère {num} questions de type sondage pour un jeu similaire à "Une Famille en Or".
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

        response = await self.model.generate_content_async(prompt)
        return self._parse_json(response.text)

    async def check_answer(self, expected: str, given: str) -> bool:
        """Use Gemini to semantically check if an answer is correct despite typos."""
        prompt = f"""Dans un jeu de quiz, la bonne réponse est : "{expected}"
Le joueur a répondu : "{given}"

La réponse du joueur est-elle essentiellement correcte ? Considère :
- Les fautes d'orthographe mineures sont acceptables
- Les formulations alternatives ou abréviations sont acceptables
- Le sens fondamental doit correspondre

Réponds UNIQUEMENT par "YES" ou "NO"."""

        response = await self.model.generate_content_async(prompt)
        return "YES" in response.text.strip().upper()

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

        response = await self.model.generate_content_async(prompt)
        result = response.text.strip()

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
