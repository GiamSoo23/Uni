#!/usr/bin/env bash
# Crea labels y milestones del proyecto en el repo de GitHub actual.
# Requiere `gh auth login`. Se puede correr varias veces: actualiza lo que ya existe.
set -euo pipefail

label() { gh label create "$1" --color "$2" --description "$3" --force; }

label "type:feature" "1d76db" "Funcionalidad nueva"
label "type:bug" "d73a4a" "Algo no funciona"
label "type:chore" "cfd3d7" "Mantenimiento, dependencias, configuración"
label "type:docs" "0075ca" "Documentación"
label "type:test" "bfdadc" "Pruebas"

label "area:core" "5319e7" "packages/core: dominio, fuentes y filtros"
label "area:web" "0e8a16" "apps/web: interfaz Next.js"
label "area:sheets" "fbca04" "Sincronización con Google Sheets"
label "area:ai" "c5def5" "Integración con Claude"
label "area:infra" "006b75" "AWS, CDK y despliegue"
label "area:ci" "ededed" "GitHub Actions y calidad"
label "area:docs" "0052cc" "README, PLAN, guías"
label "security" "b60205" "Seguridad o privacidad"

label "priority:high" "b60205" "Bloquea el uso diario"
label "priority:medium" "d93f0b" "Importante, no urgente"
label "priority:low" "c2e0c6" "Cuando haya tiempo"

milestone() {
  local title="$1" description="$2"
  if gh api "repos/{owner}/{repo}/milestones?state=all&per_page=100" --jq '.[].title' | grep -Fxq "$title"; then
    echo "Milestone ya existe: $title"
  else
    gh api "repos/{owner}/{repo}/milestones" -f title="$title" -f description="$description" >/dev/null
    echo "Milestone creado: $title"
  fi
}

milestone "M0 · Base y calidad" "Monorepo, TypeScript estricto, lint, tests, gitleaks y CI"
milestone "M1 · Fuente Simplify y bandeja web" "Descarga con caché, filtros duros, bandeja de roles y Sync ahora"
milestone "M2 · En línea, solo para mí" "Vercel con Vercel Authentication en todos los deployments"
milestone "M3 · Google Sheets" "Service account, lectura de hipervínculos, Marcar como aplicado"
milestone "M4 · Bandeja completa" "No me interesa, cruce con el Sheet, estados"
milestone "M5 · Perfil desde el resume" "PDF a perfil con Claude, elegibilidad, llave propia"
milestone "M6 · Evaluación con Claude" "Descripciones por ATS, sponsorship con cita, puntaje"
milestone "M7 · Señales de empresa" "Notas del Sheet y datos H-1B de USCIS"
milestone "M8 · Empresas y portales" "Top 100-150 empresas, pestaña Companies, seguimiento de NO ROLE"
milestone "M9 · AWS" "CDK, Scheduler semanal, Lambda, SQS, DLQ, Budgets, OIDC"
milestone "M10 · Alertas" "Resumen semanal por webhook"
milestone "M11 · Open source v0.1" "README, ARCHITECTURE.md, guía de adaptadores, release"
