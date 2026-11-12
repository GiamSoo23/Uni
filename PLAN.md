# Uni: plan del proyecto

Última actualización: 12 nov 2026.

## Decisiones tomadas

| Tema             | Decisión                                                                         |
| ---------------- | -------------------------------------------------------------------------------- |
| Nombre           | Uni                                                                              |
| Forma            | Web app desde el inicio (Next.js). Sin pasos solo de CLI                         |
| Prioridad        | Descubrir roles abiertos que encajen y acepten internacionales                   |
| Fuente principal | `listings.json` del repo SimplifyJobs/Summer2027-Internships                     |
| Frecuencia       | Sync automático semanal, más el botón "Sync ahora"                               |
| Google Sheet     | La app puede modificarlo: agrega la columna `Job ID` y crea la pestaña Companies |
| Acceso a Google  | Service account (el Sheet se comparte con su correo)                             |
| IA               | Claude con la llave de cada usuario. Modo sin IA disponible                      |
| Fuera de v1      | Automatizar Handshake o LinkedIn, autocompletar formularios, leer el correo      |

## Flujo objetivo

1. Subes tu resume una vez y la app saca tus intereses.
2. Cada semana, o con "Sync ahora", trae los roles nuevos, descarta los que no te sirven y ordena el resto.
3. Ves cada rol con su link directo para aplicar.
4. "Marcar como aplicado" agrega la fila en tu Sheet con tu formato.
5. Una pestaña Companies mantiene 100 a 150 empresas con su portal de carreras, y la app avisa cuando una sin rol abre uno.

## Datos verificados (11 nov 2026)

- `listings.json`: 17,658 registros, 828 roles de Software activos para Summer 2027 de 378 empresas, unos 87 nuevos por semana.
- El campo `sponsorship` dice "Other" en 5,339 de 5,354 roles activos. Hay que leer la descripción.
- El repo no declara licencia: no se redistribuyen sus datos.
- Portales en esos 828 roles: Workday 286, otros 232, Greenhouse 113, Ashby 66, iCIMS 47, Oracle 34, Lever 19.
- El endpoint JSON de Workday (`/wday/cxs/...`) devuelve la descripción, pero no es oficial.
- Tu Sheet: 13 columnas, 192 empresas, 35 notas sobre sponsorship. 49 celdas son hipervínculos que el CSV pierde, así que se leen con la API de Sheets.
- API de Sheets: gratis, 300 lecturas y 300 escrituras por minuto por proyecto, 60 por usuario.
- USCIS publica los datos H-1B por empleador en CSV.

## Cómo se decide si "acepta internacionales"

| Prioridad | Señal                   | Fuente                                                                                  |
| --------- | ----------------------- | --------------------------------------------------------------------------------------- |
| 1         | Lo que tú registraste   | Notas de tu Sheet                                                                       |
| 2         | Lo que dice la oferta   | Descripción leída por Claude, con la cita exacta                                        |
| 3         | Campo de Simplify       | `sponsorship`                                                                           |
| 4         | Historial de la empresa | CSV H-1B de USCIS (señal débil: indica patrocinio futuro, no aceptación en la pasantía) |

Las ofertas que dicen "no" explícitamente se ocultan. Las que no dicen nada se muestran con su etiqueta.

## Fases (a 4 h por semana)

| #   | Fase                                                                                                | Horas | Estado                                |
| --- | --------------------------------------------------------------------------------------------------- | ----- | ------------------------------------- |
| 0   | Base: monorepo, TS estricto, lint, Vitest, gitleaks, CI, labels y milestones                        | 3-4   | Hecho (falta crear el repo en GitHub) |
| 1   | Fuente Simplify y bandeja web: caché con ETag, Zod, filtros, Sync ahora                             | 6-8   | Hecho                                 |
| 2   | Google Sheets: service account, hipervínculos, Marcar como aplicado, `Job ID`, ocultar ya aplicados | 6-8   | Siguiente                             |
| 3   | Bandeja completa: No me interesa (Postgres + Prisma), estados                                       | 6-8   |                                       |
| 4   | Perfil desde el resume con Claude, elegibilidad, llave propia                                       | 5-6   |                                       |
| 5   | Evaluación: descripciones por ATS, sponsorship con cita, puntaje, caché, Batch                      | 8-10  |                                       |
| 6   | Señales de empresa: notas del Sheet y CSV H-1B                                                      | 4-5   |                                       |
| 7   | Empresas: portales derivados de los links, top 100-150, pestaña Companies, seguimiento de NO ROLE   | 6-8   |                                       |
| 8   | AWS con CDK: Scheduler semanal, Lambda, SQS, DLQ, Budgets, OIDC                                     | 10-12 |                                       |
| 9   | Alertas: resumen semanal por webhook a Discord                                                      | 3-4   |                                       |
| 10  | Open source v0.1: README, ARCHITECTURE.md, guía de adaptadores, Sheet de ejemplo                    | 5-6   |                                       |

## Costos

- Simplify, APIs de ATS, Sheets, USCIS, AWS free tier y Neon: $0.
- Claude (Haiku 4.5 a $1 y $5 por millón de tokens): cerca de $3 para evaluar los roles actuales y unos $0.30 por semana. Es una estimación. La app registrará los tokens reales.

## Riesgos

| Riesgo                                            | Mitigación                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| Simplify cambia el formato del JSON               | Zod falla con mensaje claro y se sigue usando la última copia buena     |
| Workday cambia su endpoint                        | La oferta se muestra sin evaluación, con su link                        |
| Pocas ofertas mencionan sponsorship               | Etiqueta "sin indicar" y señales de empresa, nunca exclusión automática |
| Ediciones manuales y de la app chocan en el Sheet | La app solo agrega filas y actualiza las suyas por `Job ID`             |
| Datos personales en el repo                       | gitleaks, `.gitignore`, datos de ejemplo                                |
