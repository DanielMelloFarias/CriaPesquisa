#!/usr/bin/env sh
# Backup do banco de produção (docker-compose.prod.yml).
#
# O Postgres de produção não publica porta no host, então o dump roda dentro do
# próprio contêiner e sai pelo stdout. Agende no servidor, por exemplo:
#
#   0 3 * * * cd /opt/criapesquisa && ./scripts/backup-docker.sh >> /var/log/criapesquisa-backup.log 2>&1
#
# Variáveis: BACKUP_DIR (padrão: backups), BACKUP_RETENCAO (padrão: 30 dumps).
set -eu

cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-backups}"
BACKUP_RETENCAO="${BACKUP_RETENCAO:-30}"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"

# Lê usuário e banco do .env.prod, sem carregar as senhas no ambiente do shell.
PG_USER=$(grep '^POSTGRES_USER=' .env.prod | cut -d= -f2-)
PG_DB=$(grep '^POSTGRES_DB=' .env.prod | cut -d= -f2-)

mkdir -p "$BACKUP_DIR"
ARQUIVO="$BACKUP_DIR/criapesquisa-$(date +%Y-%m-%d-%H%M%S).dump"
PARCIAL="$ARQUIVO.parcial"

# Grava num nome provisório e só renomeia se o pg_dump terminar bem: um dump
# interrompido nunca fica com cara de backup válido.
$COMPOSE exec -T postgres pg_dump -Fc -U "$PG_USER" "$PG_DB" > "$PARCIAL"
mv "$PARCIAL" "$ARQUIVO"
echo "$(date '+%F %T') backup gerado: $ARQUIVO ($(wc -c < "$ARQUIVO") bytes)"

# Retenção: mantém os BACKUP_RETENCAO mais recentes (nunca apaga o que acabou de gerar).
ls -1t "$BACKUP_DIR"/criapesquisa-*.dump | tail -n +"$((BACKUP_RETENCAO + 1))" | while read -r antigo; do
  rm -f -- "$antigo"
  echo "$(date '+%F %T') removido pela retenção: $antigo"
done
