import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const DEFAULT_AMBIENT = '40 100% 56%';

interface ThemeContextValue {
  karaokeFilterEnabled: boolean;
  setKaraokeFilterEnabled: (enabled: boolean) => void;
  setVideoId: (videoId: string | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

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

async function extractColorsFromThumbnail(videoId: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(DEFAULT_AMBIENT);
        return;
      }

      const size = 50;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);

      const pixels = ctx.getImageData(0, 0, size, size).data;
      const colorCounts: Record<string, { count: number; r: number; g: number; b: number }> = {};

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const brightness = (r + g + b) / 3;
        if (brightness < 30 || brightness > 225) continue;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        if (saturation < 0.2) continue;

        const key = `${Math.floor(r / 32)}-${Math.floor(g / 32)}-${Math.floor(b / 32)}`;
        if (!colorCounts[key]) {
          colorCounts[key] = { count: 0, r, g, b };
        }
        colorCounts[key].count++;
      }

      const dominant = Object.values(colorCounts).sort((a, b) => b.count - a.count)[0];
      if (!dominant) {
        resolve(DEFAULT_AMBIENT);
        return;
      }

      const [h, s, l] = rgbToHsl(dominant.r, dominant.g, dominant.b);
      resolve(`${h} ${Math.min(s + 20, 100)}% ${Math.max(Math.min(l + 10, 65), 45)}%`);
    };

    img.onerror = () => resolve(DEFAULT_AMBIENT);
    img.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  });
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [karaokeFilterEnabled, setKaraokeFilterEnabledState] = useState(true);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [ambient, setAmbient] = useState(DEFAULT_AMBIENT);
  const extractionRef = useRef<string | null>(null);

  const setKaraokeFilterEnabled = useCallback((enabled: boolean) => {
    setKaraokeFilterEnabledState(enabled);
    try {
      localStorage.setItem('karaoke_search_filter', enabled ? 'true' : 'false');
    } catch {
      // Search still works if storage is unavailable.
    }
  }, []);

  useEffect(() => {
    try {
      const savedFilter = localStorage.getItem('karaoke_search_filter');
      if (savedFilter !== null) {
        setKaraokeFilterEnabledState(savedFilter === 'true');
      }
    } catch {
      // Keep default when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    if (!videoId) {
      extractionRef.current = null;
      setAmbient(DEFAULT_AMBIENT);
      return;
    }
    if (extractionRef.current === videoId) return;
    extractionRef.current = videoId;

    extractColorsFromThumbnail(videoId).then((extracted) => {
      if (extractionRef.current === videoId) {
        setAmbient(extracted);
      }
    });
  }, [videoId]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--ambient', ambient);
    return () => root.style.removeProperty('--ambient');
  }, [ambient]);

  return (
    <ThemeContext.Provider value={{
      karaokeFilterEnabled,
      setKaraokeFilterEnabled,
      setVideoId,
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
