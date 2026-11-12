# Uni

Uni reúne las internships abiertas en una sola página, oculta las que no aceptan estudiantes internacionales y te da el link directo para aplicar.

> Estado: fase 1. La bandeja web con datos de Simplify funciona. La sincronización con Google Sheets y la evaluación con Claude vienen después. El plan completo está en [PLAN.md](PLAN.md).

## Qué hace hoy

- Descarga el `listings.json` del repo [SimplifyJobs/Summer2027-Internships](https://github.com/SimplifyJobs/Summer2027-Internships). Lo actualiza una vez por semana o cuando presionas **Sync ahora**, y usa ETag para no volver a bajar ~13 MB si nada cambió.
- Valida cada registro con Zod y descarta los que no cumplen el esquema. Si falla la descarga, sigue mostrando la última copia buena.
- Filtra por temporada, categoría, región (EE. UU. y remoto US), fecha de publicación y texto.
- Oculta los roles donde Simplify indica "Does Not Offer Sponsorship" o "U.S. Citizenship is Required".

Simplify marca casi todos los roles como "Other" en sponsorship, así que hoy ese filtro descarta pocos. La fase 5 agrega la lectura de cada descripción con Claude.

## Requisitos

- Node.js 24 (ver `.nvmrc`)
- npm 11

## Uso local

```bash
npm install
cp .env.example apps/web/.env.local   # opcional
npm run dev                            # http://127.0.0.1:3000
```

La primera visita descarga los datos y tarda unos segundos. La copia queda en `apps/web/.cache/`, que está fuera del repo.

## Comandos

| Comando          | Qué hace                                    |
| ---------------- | ------------------------------------------- |
| `npm run dev`    | Servidor de desarrollo                      |
| `npm run check`  | Lint, typecheck y tests de todo el monorepo |
| `npm run build`  | Build de producción                         |
| `npm run format` | Formatea con Prettier                       |

## Estructura

```
apps/web/        Next.js 16: bandeja de roles, filtros y "Sync ahora"
packages/core/   Dominio: esquema de Simplify, normalización, filtros, caché
scripts/         setup-github.sh crea labels y milestones con gh
.github/         CI, escaneo con gitleaks, revisión de commits y plantillas
.husky/          Hook local que revisa el mensaje de cada commit
```

## Datos y privacidad

- El repo de Simplify no declara licencia. Uni no redistribuye sus datos: cada instancia los descarga directamente.
- Tu resume, tu Sheet y tus credenciales nunca deben entrar al repo. `.gitignore` excluye `.env*`, `service-account*.json` y `resume*.pdf`, y gitleaks revisa cada PR.

## Contribuir

Lee [CONTRIBUTING.md](CONTRIBUTING.md). Los commits siguen Conventional Commits y se revisan en tu máquina (husky) y en el CI (commitlint). Para reportar un problema de seguridad, usa [SECURITY.md](SECURITY.md).

## Créditos

Los datos de ofertas vienen de [Simplify](https://simplify.jobs) y [Pitt CSC](https://github.com/SimplifyJobs/Summer2027-Internships).
