# Contribuir a Uni

Gracias por ayudar. Uni tiene una regla de diseño por encima de las demás: **cada persona corre su propia instancia con sus propias llaves y sus propios datos.** No se aceptan cambios que necesiten un servidor central. [PLAN.md](PLAN.md) explica el porqué de las decisiones.

## Correr el proyecto

```bash
npm install
npm run dev   # http://127.0.0.1:3000
```

## Cómo se trabaja

1. **Abre un issue primero**, tanto para bugs como para ideas, para acordar el cambio antes de escribir código.
2. Crea una rama desde `main`, nombrada por área: `core/…`, `web/…`, `sheets/…`, `ai/…`, `infra/…`, `fix/…`, `docs/…`.
3. Escribe [Conventional Commits](https://www.conventionalcommits.org/) en pasos pequeños.
4. Abre un pull request con `Closes #N`. Se integra con **Rebase and merge** cuando el CI está en verde.

## Commits

Formato: `tipo(scope): descripción`, en inglés y en minúscula, describiendo qué cambia para quien usa la app.

| Tipo       | Para qué                                     |
| ---------- | -------------------------------------------- |
| `feat`     | Funcionalidad nueva                          |
| `fix`      | Corrección de un bug                         |
| `docs`     | Solo documentación                           |
| `test`     | Solo pruebas                                 |
| `refactor` | Cambio interno sin cambiar el comportamiento |
| `style`    | Formato, sin cambiar la lógica               |
| `chore`    | Configuración, dependencias, herramientas    |
| `ci`       | GitHub Actions                               |

Scopes permitidos: `core`, `web`, `sheets`, `ai`, `infra`, `deps`. Un cambio que no pertenece a un área va sin scope, por ejemplo `docs: contributing guide`.

Ejemplos:

```
feat(web): a Sync now button that skips the weekly wait
fix(core): count "Arlington County, Arlington, VA" as a US location
ci: check commit messages on pull requests
```

Un hook local (husky) revisa el mensaje al hacer commit, y el CI revisa todos los commits del pull request.

## Revisiones

| Qué                           | Comando                |
| ----------------------------- | ---------------------- |
| Todo (lint, typecheck, tests) | `npm run check`        |
| Formato                       | `npm run format:check` |
| Build                         | `npm run build`        |

## Secretos y datos personales

Nunca subas llaves, contraseñas, un `.env` lleno, tu resume ni datos de tu Sheet. gitleaks revisa todo el historial en el CI. Para pruebas usa datos inventados.

## Código de conducta

Participar implica seguir el [Código de conducta](CODE_OF_CONDUCT.md).
