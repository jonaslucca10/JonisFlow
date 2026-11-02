#!/usr/bin/env bash
# =============================================================================
# JonisFlow — alerta de indisponibilidade para o celular
# UptimeRobot/Better Stack → dispara este script (HTTP POST ao endpoint /run).
# Envia alerta por Telegram (basta) — extensível para WhatsApp/SMS via provider.
# =============================================================================
set -euo pipefail

MESSAGE="${1:-JonisFlow: API indisponível — verifique https://status.jonisflow.example.com}"

if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  curl -sf -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H 'Content-Type: application/json' \
    -d "{\"chat_id\":\"${TELEGRAM_CHAT_ID}\",\"text\":\"⚠️ ${MESSAGE}\",\"disable_web_page_preview\":true}" \
    && echo "alerta Telegram enviado" || echo "FALHA ao enviar alerta Telegram"
else
  echo "TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID não configurados — alerta não enviado"
fi

# Better Stack: criar monitor HTTPS apontando https://joisflow.example.com/api/health
#   com alerta ao e-mail/WhatsApp/SMS diretamente na plataforma (alternativa ao script).
# UptimeRobot: monitor HTTP(S) com "Alert via: Custom Notification" (webhook → /run).
