import { useState, useEffect, useCallback } from 'react';
import type { ReadingSettings } from '@/types';

const SETTINGS_KEY = 'truyenReaderSettings';

export const themePresets = {
  dark: { // Modern Dark Theme
    backgroundColor: '#141414', // rgb(20, 20, 20)
    surfaceColor: '#1e1e1e',   // rgb(30, 30, 30)
    textColor: '#e5e7eb',     // gray-200
    titleColor: '#622eff',      // RGB(98, 46, 255)
    highlightColor: '#f59e0b', // amber-500
  },
  light: { // Crisp Light
    backgroundColor: '#f8fafc', // slate-50
    surfaceColor: '#ffffff',   // white
    textColor: '#0f172a',     // slate-900
    titleColor: '#0284c7',      // sky-600
    highlightColor: '#f97316', // orange-500
  },
  midnight: { // Sepia / "Vàng ngà"
    backgroundColor: '#f5eeda', // Parchment
    surfaceColor: '#faf6eb',   // Lighter Parchment
    textColor: '#5c4033',     // Dark Brown
    titleColor: '#8b4513',      // Saddle Brown
    highlightColor: '#a0522d', // Sienna
  }
};


const defaultSettings: ReadingSettings = {
  themeMode: 'dark',
  ...themePresets.dark,
  backgroundColor: themePresets.dark.surfaceColor,
  fontSize: 20,
  fontFamily: "'Readex Pro', sans-serif",
};

// Helper to lighten/darken a hex color
function adjustColor(hex: string, percent: number): string {
    if (!hex || !hex.startsWith('#')) return hex;
    try {
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);

        const amount = Math.round(2.55 * percent);

        r = Math.max(0, Math.min(255, r + amount));
        g = Math.max(0, Math.min(255, g + amount));
        b = Math.max(0, Math.min(255, b + amount));

        const toHex = (c: number) => ('0' + c.toString(16)).slice(-2);

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch (e) {
        console.error("Lỗi điều chỉnh màu:", e);
        return hex; // Trả về màu gốc nếu có lỗi
    }
}


export const useReadingSettings = (): [ReadingSettings, (settings: ReadingSettings) => void] => {
  const [settings, setSettings] = useState<ReadingSettings>(() => {
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        return { ...defaultSettings, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      console.error("Lỗi khi tải cài đặt đọc:", error);
    }
    return defaultSettings;
  });

  const updateSettings = useCallback((newSettings: ReadingSettings) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error("Lỗi khi lưu cài đặt đọc:", error);
    }
  }, []);
  
  // Áp dụng cài đặt vào :root khi settings thay đổi
  useEffect(() => {
    const root = document.documentElement;
    const currentPreset = themePresets[settings.themeMode] || themePresets.dark;

    const isLightMode = settings.themeMode === 'light' || settings.themeMode === 'midnight';

    // Tính toán màu phụ (border, secondary text) dựa trên màu người dùng chọn
    const borderColor = adjustColor(settings.backgroundColor, isLightMode ? -10 : 15);
      
    const secondaryTextColor = adjustColor(currentPreset.textColor, isLightMode ? 35 : -25);


    // Global Theme Variables
    root.style.setProperty('--theme-bg-base', currentPreset.backgroundColor);
    // Áp dụng màu nền tùy chỉnh cho tất cả các panel (bề mặt)
    root.style.setProperty('--theme-bg-surface', settings.backgroundColor);
    root.style.setProperty('--theme-border', borderColor);
    root.style.setProperty('--theme-text-primary', currentPreset.textColor);
    root.style.setProperty('--theme-text-secondary', secondaryTextColor);
    root.style.setProperty('--theme-accent-primary', settings.titleColor);
    root.style.setProperty('--theme-accent-secondary', settings.highlightColor);

    // Reader-specific Variables
    root.style.setProperty('--reader-bg', settings.backgroundColor);
    root.style.setProperty('--reader-text', settings.textColor);
    root.style.setProperty('--reader-title', settings.highlightColor);
    root.style.setProperty('--reader-highlight', settings.highlightColor);
    root.style.setProperty('--reader-font-size', `${settings.fontSize}px`);
    root.style.setProperty('--reader-font-family', settings.fontFamily);
  }, [settings]);

  return [settings, updateSettings];
};