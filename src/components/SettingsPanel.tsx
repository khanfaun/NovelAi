
import React from 'react';
import type { ReadingSettings } from '@/types';
import { themePresets } from '@/hooks/useReadingSettings';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReadingSettings;
  onSettingsChange: (newSettings: ReadingSettings) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, settings, onSettingsChange }) => {
  if (!isOpen) {
    return null;
  }

  const handleSettingChange = <K extends keyof ReadingSettings>(key: K, value: ReadingSettings[K]) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  const handleModeChange = (mode: ReadingSettings['themeMode']) => {
    const preset = themePresets[mode];
    onSettingsChange({
      ...settings, // Giữ lại font và kích thước chữ
      themeMode: mode,
      backgroundColor: preset.surfaceColor,
      textColor: preset.textColor,
      titleColor: preset.titleColor,
      highlightColor: preset.highlightColor,
    });
  };
  
  const defaultSettings = { ...themePresets.dark, backgroundColor: themePresets.dark.surfaceColor, themeMode: 'dark' as const, fontSize: 20, fontFamily: "'Readex Pro', sans-serif" };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center" onClick={onClose}>
      <div 
        className="bg-[var(--theme-bg-surface)] rounded-lg shadow-2xl w-full max-w-sm flex flex-col m-4 border border-[var(--theme-border)] animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)]">
          <h2 className="text-xl font-bold text-[var(--theme-text-primary)]">Tùy Chỉnh Giao Diện</h2>
          <button onClick={onClose} className="text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] text-3xl leading-none">&times;</button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Theme Mode */}
          <div>
            <label htmlFor="themeMode" className="block text-sm font-medium text-[var(--theme-text-secondary)] mb-2">
              Chế độ màu
            </label>
            <select
              id="themeMode"
              value={settings.themeMode}
              onChange={e => handleModeChange(e.target.value as ReadingSettings['themeMode'])}
              className="w-full bg-[var(--theme-bg-base)] border border-[var(--theme-border)] rounded-md p-2 text-[var(--theme-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent-primary)]"
            >
              <option value="dark">Chế độ Tối</option>
              <option value="light">Chế độ Sáng</option>
              <option value="midnight">Chế độ Ban đêm</option>
            </select>
          </div>

          {/* Font Size */}
          <div>
            <label htmlFor="fontSize" className="block text-sm font-medium text-[var(--theme-text-secondary)] mb-2">
              Kích thước chữ: <span className="font-bold text-[var(--theme-accent-primary)]">{settings.fontSize}px</span>
            </label>
            <input
              id="fontSize"
              type="range"
              min="14"
              max="32"
              value={settings.fontSize}
              onChange={e => handleSettingChange('fontSize', parseInt(e.target.value, 10))}
              className="w-full h-2 bg-[var(--theme-bg-base)] rounded-lg appearance-none cursor-pointer accent-[var(--theme-accent-primary)]"
            />
          </div>
          
          {/* Font Family */}
          <div>
            <label htmlFor="fontFamily" className="block text-sm font-medium text-[var(--theme-text-secondary)] mb-2">
              Font chữ
            </label>
            <select
              id="fontFamily"
              value={settings.fontFamily}
              onChange={e => handleSettingChange('fontFamily', e.target.value)}
              className="w-full bg-[var(--theme-bg-base)] border border-[var(--theme-border)] rounded-md p-2 text-[var(--theme-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent-primary)]"
            >
              <option value="'Readex Pro', sans-serif">Readex Pro (Mặc định)</option>
              <option value="'Merriweather', serif">Merriweather (Có chân)</option>
              <option value="'Lora', serif">Lora (Thanh lịch)</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="Verdana, sans-serif">Verdana</option>
            </select>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center">
              <label htmlFor="bgColor" className="text-sm font-medium text-[var(--theme-text-secondary)] mb-2">Màu nền</label>
              <input
                id="bgColor"
                type="color"
                value={settings.backgroundColor}
                onChange={e => handleSettingChange('backgroundColor', e.target.value)}
                className="w-16 h-10 p-1 bg-transparent border border-[var(--theme-border)] rounded-md cursor-pointer"
              />
            </div>
             <div className="flex flex-col items-center">
              <label htmlFor="textColor" className="text-sm font-medium text-[var(--theme-text-secondary)] mb-2">Màu chữ</label>
              <input
                id="textColor"
                type="color"
                value={settings.textColor}
                onChange={e => handleSettingChange('textColor', e.target.value)}
                className="w-16 h-10 p-1 bg-transparent border border-[var(--theme-border)] rounded-md cursor-pointer"
              />
            </div>
             <div className="flex flex-col items-center">
              <label htmlFor="titleColor" className="text-sm font-medium text-[var(--theme-text-secondary)] mb-2">Màu nhấn chính</label>
              <input
                id="titleColor"
                type="color"
                value={settings.titleColor}
                onChange={e => handleSettingChange('titleColor', e.target.value)}
                className="w-16 h-10 p-1 bg-transparent border border-[var(--theme-border)] rounded-md cursor-pointer"
              />
            </div>
             <div className="flex flex-col items-center">
              <label htmlFor="highlightColor" className="text-sm font-medium text-[var(--theme-text-secondary)] mb-2">Màu nhấn phụ</label>
              <input
                id="highlightColor"
                type="color"
                value={settings.highlightColor}
                onChange={e => handleSettingChange('highlightColor', e.target.value)}
                className="w-16 h-10 p-1 bg-transparent border border-[var(--theme-border)] rounded-md cursor-pointer"
              />
            </div>
          </div>
          
          <button
            onClick={() => onSettingsChange(defaultSettings)}
            className="w-full mt-4 bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
          >
            Khôi phục mặc định
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;