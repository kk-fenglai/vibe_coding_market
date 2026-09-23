/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--bgElevated)',
        text: 'var(--text)',
        muted: 'var(--textMuted)',
        border: 'var(--border)',
        primary: 'var(--primary)',
        accent: 'var(--accent)',
        accent2: 'var(--accent2)',
        // Studio brand palette (blue / cyan / violet)
        brand: {
          DEFAULT: '#2563eb',   // electric blue
          light: '#3b82f6',
          dark: '#1e40af',
          ink: '#0b1220',
          cyan: '#22d3ee',
          violet: '#a78bfa',
        },
        // BuildHub Figma palette (warm orange theme)
        hub: {
          primary: '#ff6b00',   // orange CTA
          logo: '#a04100',      // burnt-orange logo / active nav
          border: '#e2bfb0',    // warm card border
          heading: '#0b1c30',   // dark heading
          body: '#5a4136',      // warm brown body text
          footer: '#213145',    // dark footer bg
        },
      },
      boxShadow: {
        // Borderless card separation — soft ambient + contact shadow (Contra-style)
        soft: '0 1px 2px rgba(16, 24, 40, 0.04), 0 12px 32px rgba(16, 24, 40, 0.06)',
        lift: '0 2px 4px rgba(16, 24, 40, 0.06), 0 20px 44px rgba(16, 24, 40, 0.10)',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        serif: ['Source Serif Pro', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
