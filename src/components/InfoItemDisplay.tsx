import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface InfoItem {
  ten: string;
  moTa: string;
  status?: string;
  capDo?: string;
  diaDiemCha?: string;
}

interface InfoItemDisplayProps {
  item: InfoItem;
}

const popoverRoot = document.getElementById('popover-root');

const InfoItemDisplay: React.FC<InfoItemDisplayProps> = ({ item }) => {
  const [isPopoverVisible, setIsPopoverVisible] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const [popoverPosition, setPopoverPosition] = useState<'top' | 'bottom'>('top');
  
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isInactive = ['dead', 'used', 'lost', 'destroyed'].includes(item.status || '');

  const updatePopoverPosition = useCallback(() => {
    if (!isPopoverVisible || !buttonRef.current || !popoverRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = popoverRef.current.offsetWidth;
    const popoverHeight = popoverRef.current.offsetHeight;
    const margin = 10;

    let top: number;
    let pos: 'top' | 'bottom';

    if (buttonRect.top > popoverHeight + margin) {
      pos = 'top';
      top = buttonRect.top + window.scrollY - popoverHeight - margin;
    } else {
      pos = 'bottom';
      top = buttonRect.bottom + window.scrollY + margin;
    }

    // Center the popover horizontally
    const left = buttonRect.left + (buttonRect.width / 2) - (popoverWidth / 2);
    
    setPopoverPosition(pos);
    setPopoverStyle({
      position: 'absolute',
      top: `${top}px`,
      left: `${left}px`,
      width: `${popoverWidth}px`,
      zIndex: 100,
    });
  }, [isPopoverVisible]);

  useEffect(() => {
    if (isPopoverVisible) {
      // Delay slightly to allow popover to render and get its dimensions
      const timer = setTimeout(updatePopoverPosition, 0);
      window.addEventListener('scroll', updatePopoverPosition, true);
      window.addEventListener('resize', updatePopoverPosition);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('scroll', updatePopoverPosition, true);
        window.removeEventListener('resize', updatePopoverPosition);
      };
    }
  }, [isPopoverVisible, updatePopoverPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(event.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(event.target as Node)
      ) {
        setIsPopoverVisible(false);
      }
    };
    if (isPopoverVisible) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPopoverVisible]);

  const popoverContent = isPopoverVisible && popoverRoot ? createPortal(
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="w-64 p-3 bg-[var(--theme-bg-base)] rounded-lg shadow-2xl border border-[var(--theme-border)] text-sm text-[var(--theme-text-primary)] animate-fade-in-up"
      role="tooltip"
    >
      <p className="font-bold text-[var(--theme-accent-primary)] mb-1 break-words">{item.ten}</p>
      <p className="break-words">{item.moTa}</p>
      {item.capDo && <p className="text-sm mt-2 text-[var(--theme-text-secondary)]"><strong>Cấp độ:</strong> {item.capDo}</p>}
      {item.diaDiemCha && <p className="text-sm text-[var(--theme-text-secondary)]"><strong>Thuộc:</strong> {item.diaDiemCha}</p>}
      <div 
        className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent
                    ${popoverPosition === 'top' ? 'top-full border-t-8 border-t-[var(--theme-border)]' : 'bottom-full border-b-8 border-b-[var(--theme-border)]'}`}
      />
    </div>,
    popoverRoot
  ) : null;

  return (
    <div className="w-full">
      <button
        ref={buttonRef}
        onClick={() => setIsPopoverVisible(!isPopoverVisible)}
        className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 border
                    ${isInactive 
                      ? 'bg-[var(--theme-text-primary)]/10 text-[var(--theme-text-primary)]/50 border-[var(--theme-text-primary)]/30 line-through cursor-pointer'
                      : 'bg-[var(--theme-text-primary)] border-[var(--theme-text-primary)] text-[var(--theme-bg-surface)] hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--theme-bg-surface)] focus:ring-[var(--theme-accent-secondary)]'
                    }`}
        aria-haspopup="true"
        aria-expanded={isPopoverVisible}
      >
        {item.ten}
      </button>
      {popoverContent}
    </div>
  );
};

export default InfoItemDisplay;