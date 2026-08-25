module.exports = {
  presets: [require('nativewind/preset')],
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          primary: '#061126',
          secondary: '#020B1B',
          overlay: 'rgba(2, 6, 23, 0.82)',
        },
        surface: {
          DEFAULT: '#07162C',
          default: '#07162C',
          raised: '#0D1D3B',
          interactive: '#10213E',
          selected: '#202E6B',
          disabled: '#111D32',
        },
        border: {
          DEFAULT: '#1A3155',
          default: '#1A3155',
          subtle: '#13284A',
          active: '#09ACF4',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#C9D7EA',
          muted: '#8FA7C7',
          inverse: '#061126',
          disabled: '#60799C',
        },
        brand: {
          student: '#09ACF4',
          teacher: '#09ACF4',
          admin: '#A78BFA',
        },
        action: {
          admin: '#7C3AED',
          'admin-pressed': '#6D28D9',
        },
        semantic: {
          success: '#34D399',
          warning: '#F59E0B',
          danger: '#FB7185',
          info: '#38BDF8',
        },
        'semantic-surface': {
          success: '#0D2F29',
          warning: '#332A10',
          danger: '#351420',
          info: '#0D2848',
        },
        gamification: {
          xp: '#FBBF24',
          streak: '#F97316',
          badge: '#09ACF4',
        },
        rank: {
          bronze: '#CD7F32',
          silver: '#CBD5E1',
          gold: '#FBBF24',
          platinum: '#67E8F9',
          diamond: '#A78BFA',
        },
      },
    },
  },
  plugins: [],
}
