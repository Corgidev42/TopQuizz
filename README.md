# 🎮 TopQuizz

Plateforme locale de quiz événementiel propulsée par l'IA (Google Gemini). Inspirée du format Gotaga/CordJordan, conçue pour une diffusion **Mac → TV** avec contrôle par **smartphones** (type Kahoot/Buzzer).

![Stack](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![Stack](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![Stack](https://img.shields.io/badge/Socket.IO-010101?style=flat&logo=socket.io&logoColor=white)
![Stack](https://img.shields.io/badge/Gemini_AI-8E75B2?style=flat&logo=google&logoColor=white)
![Stack](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)

---

## 🧩 Modules de Jeu

| Module | Description | Mécanique |
|--------|-------------|-----------|
| 🧠 **MasterQuiz** | QCM par thème généré par Gemini | Buzz → choix parmis 4 options |
| 👁️ **Master Mémoire** | Image affichée puis disparition | Questions de détails sur l'image |
| 🎭 **Master Face** | Photo de célébrité floutée | Révélation progressive, buzz pour deviner |
| 👥 **Master Commu** | "Une Famille en Or" version IA | Trouver les réponses les plus populaires |
| 🎵 **Blind Test** | Lecture de MP3/MP4 locaux | Taper sa réponse (tolérance aux fautes) |

## 🏗️ Architecture

```
┌──────────────┐     WebSocket      ┌──────────────────┐
│   Frontend   │◄──────────────────►│     Backend      │
│  React/Vite  │    Socket.IO       │     FastAPI      │
│  Port 3000   │                    │    Port 8000     │
└──────┬───────┘                    └────────┬─────────┘
       │                                     │
  3 interfaces :                        Services :
  • /host  (Mac)                    • Gemini Engine
  • /tv    (HDMI)                   • Game Manager
  • /play  (Mobile)                 • Fuzzy Matching
```

Tout est conteneurisé avec **Docker Compose** — zéro dépendance locale.

## 🚀 Démarrage Rapide

### Prérequis
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- Une clé API [Google Gemini](https://aistudio.google.com/app/apikey)

### Installation

```bash
# 1. Clone le repo
git clone <url-du-repo>
cd TopQuizz

# 2. Configure la clé API
cp .env.example .env
# Édite .env et ajoute ta clé GEMINI_API_KEY

# 3. Lance l'application via le Makefile (Recommandé)
make build
```

### Commandes utiles (Makefile)

Un `Makefile` est disponible pour simplifier la gestion des conteneurs :

| Commande | Action |
|----------|--------|
| `make up` | Démarre les conteneurs en arrière-plan |
| `make down` | Arrête et supprime les conteneurs |
| `make restart` | Redémarre tous les services |
| `make logs` | Affiche les logs en temps réel |
| `make build` | Reconstruit et démarre les conteneurs |
| `make ps` | Liste les conteneurs actifs |
| `make clean` | Nettoie les images et volumes inutilisés |
| `make help` | Affiche la liste complète des commandes |

### Accès

| Interface | URL | Usage |
|-----------|-----|-------|
| **Host** | `http://localhost:3000/host` | Contrôle la partie depuis ton Mac |
| **TV** | `http://localhost:3000/tv?game=CODE` | Affichage HDMI grand écran |
| **Joueur** | Scanne le QR Code sur la TV | Buzzer + réponses depuis le téléphone |

## 🎯 Système de Scoring

| Difficulté | Points |
|-----------|--------|
| Facile | 1 pt |
| Moyen | 2 pts |
| Difficile | 3 pts |
| Expert | 5 pts |

### Règles du Buzzer
- **Seul le premier à buzzer répond**
- Mauvaise réponse → **éliminé** pour cette question
- Les autres joueurs peuvent alors buzzer
- Si tout le monde se trompe → personne ne marque
- **Tolérance aux fautes d'orthographe** (fuzzy matching + validation Gemini)

### Égalité
En cas d'égalité en fin de partie → **10 questions de départage** automatiques.

## 📁 Structure du Projet

```
TopQuizz/
├── docker-compose.yml
├── .env.example
├── media/blindtest/            # Dépose tes MP3/MP4 ici
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI + Socket.IO
│       ├── config.py           # Settings & IP auto-detect
│       ├── models/             # Pydantic models
│       ├── services/
│       │   ├── gemini_engine.py  # Intégration complète Gemini
│       │   ├── game_manager.py   # Sessions, buzzer, scores, presets
│       │   └── fuzzy_match.py    # Tolérance orthographique
│       ├── sockets/events.py   # Événements temps réel
│       └── routes/             # API REST
│
└── frontend/
    ├── Dockerfile
    └── src/
        ├── views/              # TV, Player, Host, Join
        ├── components/
        │   ├── tv/             # QR Code, Questions, Scoreboard
        │   ├── player/         # Buzzer, Input réponses
        │   ├── host/           # Setup, Contrôle, Score manager
        │   └── shared/         # Logo, Animations
        ├── stores/             # Zustand (état global)
        ├── hooks/              # Socket.IO hook
        └── themes/             # Thèmes visuels (extensible)
```

## 🎵 Blind Test — Fichiers Media

Dépose tes fichiers audio/vidéo dans `media/blindtest/` :

```
media/blindtest/
├── Artiste - Titre.mp3
├── Daft Punk - Get Lucky.mp3
├── Queen - Bohemian Rhapsody.mp4
└── ...
```

Le format de nommage `Artiste - Titre.ext` permet la correction automatique des réponses.

## ⚙️ Configuration

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Clé API Google Gemini (obligatoire) |

## 🎨 Presets de Partie

| Preset | Modules |
|--------|---------|
| **Soirée Classique** | MasterQuiz (5q) → Master Face (3q) → Master Commu (3q) → Blind Test (5q) |
| **Speed Quiz** | MasterQuiz Pop Culture (10q) → MasterQuiz Science (5q expert) |
| **Full Experience** | MasterQuiz (8q) → Mémoire (3q) → Face (5q) → Commu (4q) → Blind Test (5q) |

Le Host peut aussi **créer un programme personnalisé** en choisissant les modules, thèmes, nombre de questions et niveaux de difficulté.

## 🛠️ Stack Technique

- **Backend :** Python 3.12, FastAPI, python-socketio, google-generativeai, thefuzz, Pydantic
- **Frontend :** React 18, Vite, TypeScript, Tailwind CSS, Zustand, Framer Motion, Socket.IO Client
- **IA :** Google Gemini 1.5 Flash
- **Infra :** Docker Compose

## 🚧 Features à Venir

- 👤 Comptes joueurs (email + avatar + statistiques)
- 🏆 Classement all-time et historique des parties
- 🕵️ **Mode "Alibi"** — Inspiré du concept de Squeezie : investigation et débat entre joueurs
- 🎨 Thèmes visuels personnalisables
- 🖼️ Avatars et personnalisation du profil
- Ajout d'une IA tres fort pour la partie Blindtest qui va vraiment chercher sur internet les morceaux tendance, ou des ost d'anime connu etc... fin un truc bien quoi, qui va ensuite telecharger les audios pour que pendant le lancement sa soit nickel, ou alors pas besoin de les telecharger et juste lire directement l'audio ? car c'est vrai que je vois pas l'interet de dl la musique

## 🐞 Bugs Corrigés / Améliorations Récentes

- ✅ **Correction du Buzzer** : La file d'attente est désormais réinitialisée après une mauvaise réponse, permettant aux autres joueurs de rebuzzer immédiatement.
- ✅ **Timer de réponse (Backend + Frontend)** : Ajout d'un timer de 3s côté client et d'un timeout de sécurité côté serveur pour éviter les blocages si un joueur ne répond pas.
- ✅ **Nettoyage des options IA** : Amélioration du filtrage des préfixes (A, B, C, D) dans les questions générées par Gemini pour éviter les doublons à l'affichage.

---

**Built with ❤️ and AI**
