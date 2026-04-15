.PHONY: up down pnpmlock

up:
	docker compose up --renew-anon-volumes --force-recreate --build --remove-orphans

down:
	docker compose down

pnpmlock:
	docker compose cp docmost:/app/pnpm-lock.yaml .
