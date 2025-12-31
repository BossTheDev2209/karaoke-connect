import { useState, useEffect } from 'react';

interface ExtractedColors {
  primary: string;
  secondary: string;
  accent: string;
}

// Convert RGB to HSL
const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
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
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
};

// Extract dominant colors from an image
const extractColors = (imageUrl: string): Promise<ExtractedColors> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(getDefaultColors());
        return;
      }

      // Use smaller size for faster processing
      const size = 50;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size);
      const pixels = imageData.data;

      // Simple color extraction - get vibrant colors
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

        // Quantize colors
        const key = `${Math.floor(r / 32)}-${Math.floor(g / 32)}-${Math.floor(b / 32)}`;
        if (!colorCounts[key]) {
          colorCounts[key] = { count: 0, r, g, b };
        }
        colorCounts[key].count++;
      }

      // Sort by count and get top colors
      const sortedColors = Object.values(colorCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      if (sortedColors.length < 1) {
        resolve(getDefaultColors());
        return;
      }

      const primary = sortedColors[0] || { r: 168, g: 85, b: 247 };
      const secondary = sortedColors[1] || { r: primary.g, g: primary.b, b: primary.r };
      const accent = sortedColors[2] || { r: primary.b, g: primary.r, b: primary.g };

      const [h1, s1, l1] = rgbToHsl(primary.r, primary.g, primary.b);
      const [h2, s2, l2] = rgbToHsl(secondary.r, secondary.g, secondary.b);
      const [h3, s3, l3] = rgbToHsl(accent.r, accent.g, accent.b);

      resolve({
        primary: `${h1} ${Math.min(s1 + 20, 100)}% ${Math.min(l1 + 10, 65)}%`,
        secondary: `${h2} ${Math.min(s2 + 20, 100)}% ${Math.min(l2 + 10, 60)}%`,
        accent: `${h3} ${Math.min(s3 + 20, 100)}% ${Math.min(l3 + 10, 55)}%`,
      });
    };

    img.onerror = () => {
      resolve(getDefaultColors());
    };

    img.src = imageUrl;
  });
};

const getDefaultColors = (): ExtractedColors => ({
  primary: '320 100% 60%',
  secondary: '280 100% 65%',
  accent: '200 100% 55%',
});

export const useThemeFromThumbnail = (videoId: string | null, isEnabled: boolean) => {
  const [colors, setColors] = useState<ExtractedColors | null>(null);

  useEffect(() => {
    if (!videoId || !isEnabled) {
      setColors(null);
      return;
    }

    // YouTube thumbnail URL
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    
    extractColors(thumbnailUrl).then(setColors);
  }, [videoId, isEnabled]);

  return colors;
};
