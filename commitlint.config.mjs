// Conventional Commits: `type(scope): description`, for example `feat(web): Sync now button`.
// CI checks every commit in a pull request with this configuration.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Descriptions may start with a proper noun (README, Simplify, Claude).
    'subject-case': [0],
    'scope-enum': [2, 'always', ['core', 'web', 'sheets', 'ai', 'infra', 'deps']],
  },
}
