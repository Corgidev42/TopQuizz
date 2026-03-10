# Makefile for TopQuizz

.PHONY: help up down restart logs build ps shell-backend shell-frontend clean

# Colors
BLUE = \033[36m
RESET = \033[0m

help:
	@echo "$(BLUE)TopQuizz Commands:$(RESET)"
	@echo "  make up              - Start the application in detached mode"
	@echo "  make down            - Stop and remove containers"
	@echo "  make restart         - Restart all containers"
	@echo "  make logs            - Follow logs from all containers"
	@echo "  make build           - Rebuild containers"
	@echo "  make ps              - List running containers"
	@echo "  make shell-backend   - Open a shell in the backend container"
	@echo "  make shell-frontend  - Open a shell in the frontend container"
	@echo "  make clean           - Remove unused Docker images and volumes"

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

build:
	docker compose up -d --build

ps:
	docker compose ps

shell-backend:
	docker compose exec backend sh

shell-frontend:
	docker compose exec frontend sh

clean:
	docker system prune -f
	docker volume prune -f
