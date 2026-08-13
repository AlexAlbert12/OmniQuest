/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset')],
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          primary: 'var(--omni-background-primary)',
          secondary: 'var(--omni-background-secondary)',
          overlay: 'var(--omni-background-overlay)',
        },
        surface: {
          DEFAULT: 'var(--omni-surface-default)',
          default: 'var(--omni-surface-default)',
          raised: 'var(--omni-surface-raised)',
          interactive: 'var(--omni-surface-interactive)',
          selected: 'var(--omni-surface-selected)',
          disabled: 'var(--omni-surface-disabled)',
        },
        border: {
          DEFAULT: 'var(--omni-border-default)',
          default: 'var(--omni-border-default)',
          subtle: 'var(--omni-border-subtle)',
          active: 'var(--omni-border-active)',
        },
        text: {
          primary: 'var(--omni-text-primary)',
          secondary: 'var(--omni-text-secondary)',
          muted: 'var(--omni-text-muted)',
          inverse: 'var(--omni-text-inverse)',
          disabled: 'var(--omni-text-disabled)',
        },
        brand: {
          student: 'var(--omni-brand-student)',
          teacher: 'var(--omni-brand-teacher)',
          admin: 'var(--omni-brand-admin)',
        },
        action: {
          admin: 'var(--omni-action-admin)',
          'admin-pressed': 'var(--omni-action-admin-pressed)',
        },
        semantic: {
          success: 'var(--omni-semantic-success)',
          warning: 'var(--omni-semantic-warning)',
          danger: 'var(--omni-semantic-danger)',
          info: 'var(--omni-semantic-info)',
        },
        'semantic-surface': {
          success: 'var(--omni-semantic-surface-success)',
          warning: 'var(--omni-semantic-surface-warning)',
          danger: 'var(--omni-semantic-surface-danger)',
          info: 'var(--omni-semantic-surface-info)',
        },
        gamification: {
          xp: 'var(--omni-gamification-xp)',
          streak: 'var(--omni-gamification-streak)',
          badge: 'var(--omni-gamification-badge)',
        },
        rank: {
          bronze: 'var(--omni-rank-bronze)',
          silver: 'var(--omni-rank-silver)',
          gold: 'var(--omni-rank-gold)',
          platinum: 'var(--omni-rank-platinum)',
          diamond: 'var(--omni-rank-diamond)',
        },
      },
    },
  },
  plugins: [],
}
