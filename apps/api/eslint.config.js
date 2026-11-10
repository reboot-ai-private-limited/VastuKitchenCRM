import base from '@vastu/config/eslint.base.cjs';

/**
 * ESLint is the fast editor echo of the module boundary; `.dependency-cruiser.cjs` is the
 * authority (it resolves real paths and sees cycles; ESLint only sees the import string).
 */
export default [
  ...base,
  {
    files: ['src/**/*.ts'],
    rules: {
      // Log messages must be static strings; data goes in the object argument. pino's `redact`
      // matches object paths and cannot see inside a string.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='logger'][arguments.0.type='TemplateLiteral'][arguments.0.expressions.length>0]",
          message: "Log messages must be static. Use logger.info({ value }, 'message').",
        },
        {
          selector:
            "CallExpression[callee.object.name='logger'][arguments.0.type='BinaryExpression'][arguments.0.operator='+']",
          message: "Log messages must be static. Use logger.info({ value }, 'message').",
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/modules/*/domain/*',
                '@/modules/*/application/*',
                '@/modules/*/infrastructure/*',
                '@/modules/*/interface/*',
                '@/modules/*/*.container*',
              ],
              message: "A module's internals are private. Import its '<name>.public.js' contract.",
            },
          ],
        },
      ],
    },
  },
  {
    // Composition roots: building every container and wiring them IS their job.
    files: ['src/container.ts', 'src/app.ts', 'src/server.ts', 'src/scripts/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
];
