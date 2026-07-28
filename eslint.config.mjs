import next from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
    {
        ignores: ['.next/**', 'node_modules/**', 'out/**', 'public/**'],
    },
    ...next,
    {
        rules: {
            // Reading persisted state (localStorage/theme) must happen inside an
            // effect to stay SSR-safe and avoid hydration mismatches, so relax
            // this rule from error to warning for those intentional patterns.
            'react-hooks/set-state-in-effect': 'warn',
        },
    },
];

export default eslintConfig;
