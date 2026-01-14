import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

// Theme presets
export type ThemePreset = 'auto' | 'neon' | 'ocean' | 'sunset' | 'forest' | 'galaxy' | 'retro' | 'midnight' | 'candy' | 'ember';
export type BackgroundEffect = 'none' | 'beat-sync' | 'particles' | 'neon-grid' | 'wave-form';
export type AutoSyncMode = 'off' | 'immediate' | 'after-song';

interface ThemeColors {
  primary: string;   // HSL format: "280 100% 65%"
  secondary: string;
  accent: string;
}

interface ThemeContextValue {
  preset: ThemePreset;
  setPreset: (preset: ThemePreset) => void;
  backgroundEffect: BackgroundEffect;
  setBackgroundEffect: (effect: BackgroundEffect) => void;
  karaokeFilterEnabled: boolean;
  setKaraokeFilterEnabled: (enabled: boolean) => void;
  privacyMode: boolean;
  setPrivacyMode: (enabled: boolean) => void;
  autoSyncOnJoin: AutoSyncMode;
  setAutoSyncOnJoin: (mode: AutoSyncMode) => void;
  hideLyricsWhenNotFound: boolean;
  setHideLyricsWhenNotFound: (hide: boolean) => void;
  setVideoId: (videoId: string | null) => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Preset color definitions (HSL values)
const PRESET_COLORS: Record<Exclude<ThemePreset, 'auto'>, ThemeColors> = {
  neon: { primary: '280 100% 65%', secondary: '200 100% 55%', accent: '320 100% 60%' },
  ocean: { primary: '200 100% 55%', secondary: '210 100% 50%', accent: '190 95% 50%' },
  sunset: { primary: '0 85% 55%', secondary: '35 100% 55%', accent: '20 100% 55%' },
  forest: { primary: '150 80% 50%', secondary: '170 75% 45%', accent: '160 85% 45%' },
  galaxy: { primary: '240 80% 60%', secondary: '270 90% 65%', accent: '260 85% 65%' },
  retro: { primary: '280 90% 70%', secondary: '185 90% 55%', accent: '330 90% 65%' },
  midnight: { primary: '250 75% 55%', secondary: '230 85% 60%', accent: '220 80% 50%' },
  candy: { primary: '340 85% 65%', secondary: '330 80% 70%', accent: '350 90% 60%' },
  ember: { primary: '20 90% 55%', secondary: '35 95% 55%', accent: '0 85% 50%' },
};

const DEFAULT_COLORS: ThemeColors = PRESET_COLORS.neon;

// RGB to HSL conversion
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

// Extract colors from YouTube thumbnail
async function extractColorsFromThumbnail(videoId: string): Promise<ThemeColors> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(DEFAULT_COLORS);
        return;
      }

      const size = 50;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size);
      const pixels = imageData.data;

      // Color bucket extraction
      const colorCounts: Record<string, { count: number; r: number; g: number; b: number }> = {};

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        // Skip very dark or very light colors
        const brightness = (r + g + b) / 3;
        if (brightness < 30 || brightness > 225) continue;

        // Skip low saturation colors
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        if (saturation < 0.2) continue;

        // Quantize to reduce color variations
        const key = `${Math.floor(r / 32)}-${Math.floor(g / 32)}-${Math.floor(b / 32)}`;
        if (!colorCounts[key]) {
          colorCounts[key] = { count: 0, r, g, b };
        }
        colorCounts[key].count++;
      }

      const sortedColors = Object.values(colorCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      if (sortedColors.length < 1) {
        resolve(DEFAULT_COLORS);
        return;
      }

      const c1 = sortedColors[0];
      const c2 = sortedColors[1] || { r: c1.g, g: c1.b, b: c1.r };
      const c3 = sortedColors[2] || { r: c1.b, g: c1.r, b: c1.g };

      const [h1, s1, l1] = rgbToHsl(c1.r, c1.g, c1.b);
      const [h2, s2, l2] = rgbToHsl(c2.r, c2.g, c2.b);
      const [h3, s3, l3] = rgbToHsl(c3.r, c3.g, c3.b);

      resolve({
        primary: `${h1} ${Math.min(s1 + 20, 100)}% ${Math.max(Math.min(l1 + 10, 65), 45)}%`,
        secondary: `${h2} ${Math.min(s2 + 20, 100)}% ${Math.max(Math.min(l2 + 10, 60), 45)}%`,
        accent: `${h3} ${Math.min(s3 + 20, 100)}% ${Math.max(Math.min(l3 + 10, 55), 45)}%`,
      });
    };

    img.onerror = () => resolve(DEFAULT_COLORS);
    img.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  });
}

// Apply theme colors to CSS variables
function applyThemeToDOM(colors: ThemeColors) {
  const root = document.documentElement;
  const { primary, secondary, accent } = colors;

  // Core colors
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--secondary', secondary);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--ring', primary);

  // Neon color aliases
  root.style.setProperty('--neon-purple', primary);
  root.style.setProperty('--neon-blue', secondary);
  root.style.setProperty('--neon-pink', accent);

  // Computed gradients and shadows
  root.style.setProperty('--gradient-neon', `linear-gradient(135deg, hsl(${primary}), hsl(${accent}), hsl(${secondary}))`);
  root.style.setProperty('--gradient-glow', `radial-gradient(ellipse at center, hsl(${primary} / 0.3), transparent 70%)`);
  root.style.setProperty('--shadow-neon', `0 0 20px hsl(${primary} / 0.5), 0 0 40px hsl(${accent} / 0.3)`);
  root.style.setProperty('--shadow-glow', `0 4px 30px hsl(${primary} / 0.4)`);
}

// Clear inline theme styles (restore to CSS defaults)
function clearThemeFromDOM() {
  const root = document.documentElement;
  const vars = [
    '--primary', '--secondary', '--accent', '--ring',
    '--neon-purple', '--neon-blue', '--neon-pink',
    '--gradient-neon', '--gradient-glow', '--shadow-neon', '--shadow-glow'
  ];
  vars.forEach(v => root.style.removeProperty(v));
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [preset, setPresetState] = useState<ThemePreset>('neon');
  const [backgroundEffect, setBackgroundEffectState] = useState<BackgroundEffect>('beat-sync');
  const [karaokeFilterEnabled, setKaraokeFilterEnabledState] = useState<boolean>(true);
  const [privacyMode, setPrivacyModeState] = useState<boolean>(true); // Default ON for privacy
  const [autoSyncOnJoin, setAutoSyncOnJoinState] = useState<AutoSyncMode>('off');
  const [hideLyricsWhenNotFound, setHideLyricsWhenNotFoundState] = useState<boolean>(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [autoColors, setAutoColors] = useState<ThemeColors | null>(null);
  const extractionRef = useRef<string | null>(null);

  // Compute effective colors
  const colors: ThemeColors = preset === 'auto' && autoColors
    ? autoColors
    : PRESET_COLORS[preset === 'auto' ? 'neon' : preset];

  // Handle preset changes with persistence
  const setPreset = useCallback((newPreset: ThemePreset) => {
    setPresetState(newPreset);
    try {
      localStorage.setItem('karaoke_theme_preset', newPreset);
    } catch {}
  }, []);

  const setBackgroundEffect = useCallback((effect: BackgroundEffect) => {
    setBackgroundEffectState(effect);
    try {
      localStorage.setItem('karaoke_background_effect', effect);
    } catch {}
  }, []);

  const setKaraokeFilterEnabled = useCallback((enabled: boolean) => {
    setKaraokeFilterEnabledState(enabled);
    try {
      localStorage.setItem('karaoke_search_filter', enabled ? 'true' : 'false');
    } catch {}
  }, []);

  const setPrivacyMode = useCallback((enabled: boolean) => {
    setPrivacyModeState(enabled);
    try {
      localStorage.setItem('karaoke_privacy_mode', enabled ? 'true' : 'false');
    } catch {}
  }, []);

  const setAutoSyncOnJoin = useCallback((mode: AutoSyncMode) => {
    setAutoSyncOnJoinState(mode);
    try {
      localStorage.setItem('karaoke_auto_sync_on_join', mode);
    } catch {}
  }, []);

  const setHideLyricsWhenNotFound = useCallback((hide: boolean) => {
    setHideLyricsWhenNotFoundState(hide);
    try {
      localStorage.setItem('karaoke_hide_lyrics_missing', hide ? 'true' : 'false');
    } catch {}
  }, []);

  // Load saved preset on mount
  useEffect(() => {
    try {
      const savedPreset = localStorage.getItem('karaoke_theme_preset') as ThemePreset | null;
      if (savedPreset && (savedPreset === 'auto' || PRESET_COLORS[savedPreset])) {
        setPresetState(savedPreset);
      }
      
      const savedEffect = localStorage.getItem('karaoke_background_effect') as BackgroundEffect | null;
      if (savedEffect && ['none', 'beat-sync', 'particles', 'neon-grid', 'wave-form'].includes(savedEffect)) {
        setBackgroundEffectState(savedEffect);
      }

      const savedFilter = localStorage.getItem('karaoke_search_filter');
      if (savedFilter !== null) {
        setKaraokeFilterEnabledState(savedFilter === 'true');
      }

      const savedPrivacy = localStorage.getItem('karaoke_privacy_mode');
      if (savedPrivacy !== null) {
        setPrivacyModeState(savedPrivacy === 'true');
      }

      const savedAutoSync = localStorage.getItem('karaoke_auto_sync_on_join') as AutoSyncMode | null;
      if (savedAutoSync && ['off', 'immediate', 'after-song'].includes(savedAutoSync)) {
        setAutoSyncOnJoinState(savedAutoSync);
      }

      const savedHideLyrics = localStorage.getItem('karaoke_hide_lyrics_missing');
      if (savedHideLyrics !== null) {
        setHideLyricsWhenNotFoundState(savedHideLyrics === 'true');
      }
    } catch {}
  }, []);

  // Extract colors when videoId changes and preset is 'auto'
  useEffect(() => {
    if (preset !== 'auto' || !videoId) {
      setAutoColors(null);
      return;
    }

    // Prevent duplicate extraction
    if (extractionRef.current === videoId) return;
    extractionRef.current = videoId;

    extractColorsFromThumbnail(videoId).then(extracted => {
      if (extractionRef.current === videoId) {
        setAutoColors(extracted);
      }
    });
  }, [preset, videoId]);

  // Apply theme to DOM whenever colors change
  useEffect(() => {
    applyThemeToDOM(colors);
    return () => clearThemeFromDOM();
  }, [colors]);

  return (
    <ThemeContext.Provider value={{ 
      preset, 
      setPreset, 
      backgroundEffect, 
      setBackgroundEffect, 
      karaokeFilterEnabled,
      setKaraokeFilterEnabled,
      privacyMode,
      setPrivacyMode,
      autoSyncOnJoin,
      setAutoSyncOnJoin,
      hideLyricsWhenNotFound,
      setHideLyricsWhenNotFound,
      setVideoId, 
      colors 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
};

// Export preset info for the picker component
export const THEME_PRESETS: { id: ThemePreset; name: string; colors: string[] }[] = [
  { id: 'auto', name: 'Match Thumbnail', colors: [] },
  { id: 'neon', name: 'Neon Night', colors: ['#a855f7', '#ec4899', '#3b82f6'] },
  { id: 'ocean', name: 'Ocean Wave', colors: ['#06b6d4', '#0ea5e9', '#3b82f6'] },
  { id: 'sunset', name: 'Sunset Glow', colors: ['#f97316', '#ef4444', '#f59e0b'] },
  { id: 'forest', name: 'Forest Mist', colors: ['#22c55e', '#10b981', '#14b8a6'] },
  { id: 'galaxy', name: 'Galaxy', colors: ['#8b5cf6', '#6366f1', '#a855f7'] },
  { id: 'retro', name: 'Retro Wave', colors: ['#f472b6', '#c084fc', '#22d3ee'] },
  { id: 'midnight', name: 'Midnight Blue', colors: ['#1e3a8a', '#3730a3', '#4f46e5'] },
  { id: 'candy', name: 'Candy Pop', colors: ['#f43f5e', '#fb7185', '#fda4af'] },
  { id: 'ember', name: 'Ember Glow', colors: ['#dc2626', '#ea580c', '#f59e0b'] },
];