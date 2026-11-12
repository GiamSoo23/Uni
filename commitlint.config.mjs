// Conventional Commits: `tipo(scope): descripción`, por ejemplo `feat(web): Sync now button`.
// CI revisa cada commit de un pull request con esta configuración.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Las descripciones pueden empezar con un nombre propio (README, Simplify, Claude).
    'subject-case': [0],
    'scope-enum': [2, 'always', ['core', 'web', 'sheets', 'ai', 'infra', 'deps']],
  },
}
