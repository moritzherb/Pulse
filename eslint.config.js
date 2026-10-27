// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettier,
  {
    ignores: ['dist/*', 'design/*', 'supabase/functions/**', '.expo/*'],
  },
  {
    // Privacy boundary: only one module may read the device position.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/features/location/privacyBoundary.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'expo-location',
              message:
                'Only src/features/location/privacyBoundary.ts may read the position. Use acquireCoarseFix().',
            },
          ],
        },
      ],
    },
  },
]);
