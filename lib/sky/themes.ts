export type ThemeMode = 'light' | 'dark' | 'evening';

export type Theme = {
  id: string;
  name: string;
  subtitle: string;
  mode: ThemeMode;
  top: string;
  bottom: string;
  tint: [number, number, number];
  nebula: string[];
  sparkle: boolean;
};

export const THEMES: Record<string, Theme> = {
  midnight: {
    id: 'midnight',
    name: 'Dark Space',
    subtitle: 'Deep obsidian & starry cosmos',
    mode: 'dark',
    top: '#050818',
    bottom: '#0f183d',
    tint: [1, 1, 1],
    nebula: ['#4a5cff', '#8a5cff', '#2aa6ff'],
    sparkle: false,
  },
  evening: {
    id: 'evening',
    name: 'Evening Twilight',
    subtitle: 'Golden sunset & violet horizon',
    mode: 'evening',
    top: '#181035',
    bottom: '#7a304e',
    tint: [1.08, 0.94, 0.98],
    nebula: ['#ff6584', '#ff9a5b', '#7e3077'],
    sparkle: false,
  },
  day: {
    id: 'day',
    name: 'White / Daylight',
    subtitle: 'Luminous sky & celestial daylight',
    mode: 'light',
    top: '#244888',
    bottom: '#92bcf6',
    tint: [1.0, 1.05, 1.2],
    nebula: ['#6898e8', '#8cb4f5', '#b0cdfa'],
    sparkle: false,
  },
  dawn: {
    id: 'dawn',
    name: 'Dawn Mist',
    subtitle: 'Morning rose & lavender twilight',
    mode: 'evening',
    top: '#1a2050',
    bottom: '#d98a8f',
    tint: [1.05, 0.98, 0.95],
    nebula: ['#ff9aa8', '#ffc38a', '#9ab0ff'],
    sparkle: false,
  },
  dusk: {
    id: 'dusk',
    name: 'Dusk',
    subtitle: 'Violet sunset twilight',
    mode: 'evening',
    top: '#140f33',
    bottom: '#6a3a7a',
    tint: [1.02, 0.96, 1.05],
    nebula: ['#c36bff', '#ff7a9a', '#6b7bff'],
    sparkle: false,
  },
  onam: {
    id: 'onam',
    name: 'Onam',
    subtitle: 'Golden harvest glow',
    mode: 'dark',
    top: '#071a14',
    bottom: '#2a5a3a',
    tint: [1.05, 1.03, 0.92],
    nebula: ['#ffd27a', '#7fe0a0', '#fff1c4'],
    sparkle: true,
  },
  diwali: {
    id: 'diwali',
    name: 'Diwali',
    subtitle: 'Warm festive sparklers',
    mode: 'dark',
    top: '#120808',
    bottom: '#5a2410',
    tint: [1.1, 0.98, 0.85],
    nebula: ['#ff9a3a', '#ff5a5a', '#ffd27a'],
    sparkle: true,
  },
  christmas: {
    id: 'christmas',
    name: 'Christmas',
    subtitle: 'Emerald and crimson lights',
    mode: 'dark',
    top: '#06140f',
    bottom: '#3a1218',
    tint: [1.0, 1.0, 1.0],
    nebula: ['#ff5a6a', '#5ae08a', '#ffffff'],
    sparkle: true,
  },
};

export function getTimeBasedThemeId(date = new Date()): 'day' | 'evening' | 'midnight' {
  const h = date.getHours();
  const m = date.getMinutes();
  const total = h * 60 + m;
  // 06:00 (360m) to 16:59 (1019m) -> Daylight / White
  if (total >= 360 && total < 1020) return 'day';
  // 17:00 (1020m) to 20:30 (1230m) -> Evening Sunset Twilight
  if (total >= 1020 && total <= 1230) return 'evening';
  // 20:31 to 05:59 -> Deep Space / Midnight
  return 'midnight';
}

export function getThemeScheduleDescription(): string {
  return '06:00–17:00 Daylight · 17:00–20:30 Sunset · 20:30–06:00 Dark Space';
}

export function resolveTheme(setting: string, date = new Date()): Theme {
  let key = setting;
  if (!key || key === 'auto') {
    key = getTimeBasedThemeId(date);
  } else if (key === 'white' || key === 'light') {
    key = 'day';
  } else if (key === 'dark') {
    key = 'midnight';
  } else if (key === 'sunset') {
    key = 'evening';
  }
  return THEMES[key] || THEMES.midnight;
}

export function applyThemeCss(t: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;
  root.style.setProperty('--sky-top', t.top);
  root.style.setProperty('--sky-bottom', t.bottom);
  const mode = t.mode || (t.id === 'day' ? 'light' : t.id === 'evening' ? 'evening' : 'dark');
  root.setAttribute('data-theme', mode);
  if (body) body.setAttribute('data-theme', mode);
}
