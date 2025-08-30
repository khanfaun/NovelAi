import React from 'react';

interface PanelToggleButtonProps {
  onClick: () => void;
  isPanelOpen: boolean;
  isBottomNavVisible: boolean;
}

const PanelToggleButton: React.FC<PanelToggleButtonProps> = ({ onClick, isPanelOpen, isBottomNavVisible }) => {
  const bottomClass = isBottomNavVisible ? 'bottom-40' : 'bottom-24';

  return (
    <button
      onClick={onClick}
      className={`fixed ${bottomClass} right-6 bg-[var(--theme-accent-primary)] hover:brightness-90 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-50 transition-all duration-300 transform hover:scale-110`}
      aria-label={isPanelOpen ? "Đóng bảng nhân vật" : "Mở bảng nhân vật"}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    </button>
  );
};

export default PanelToggleButton;