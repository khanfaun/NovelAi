import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Entity {
  ten: string;
  moTa: string;
  status?: string;
  capDo?: string;
  diaDiemCha?: string;
}

interface EntityTooltipProps {
  entity: Entity;
  children: React.ReactNode;
}

const popoverRoot = document.getElementById('popover-root');

const EntityTooltip: React.FC<EntityTooltipProps> = ({ entity, children }) => {
  const [isPopoverVisible, setIsPopoverVisible] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const [popoverPosition, setPopoverPosition] = useState<'top' | 'bottom'>('top');
  
  const spanRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePopoverPosition = useCallback(() => {
    if (!isPopoverVisible || !spanRef.current || !popoverRef.current) return;

    const spanRect = spanRef.current.getBoundingClientRect();
    const popoverWidth = popoverRef.current.offsetWidth;
    const popoverHeight = popoverRef.current.offsetHeight;
    const margin = 10;

    let top: number;
    let pos: 'top' | 'bottom';

    if (spanRect.top > popoverHeight + margin) {
      pos = 'top';
      top = spanRect.top + window.scrollY - popoverHeight - margin;
    } else {
      pos = 'bottom';
      top = spanRect.bottom + window.scrollY + margin;
    }

    let left = spanRect.left + window.scrollX + (spanRect.width / 2) - (popoverWidth / 2);
    
    // Đảm bảo popover không tràn ra ngoài màn hình theo chiều ngang
    if (left < margin) left = margin;
    if (left + popoverWidth > window.innerWidth - margin) {
      left = window.innerWidth - popoverWidth - margin;
    }
    
    setPopoverPosition(pos);
    setPopoverStyle({
      position: 'absolute',
      top: `${top}px`,
      left: `${left}px`,
      width: `${Math.min(popoverWidth, 256)}px`, // max-width of 256px
      zIndex: 100,
    });
  }, [isPopoverVisible]);

  useEffect(() => {
    if (isPopoverVisible) {
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
        spanRef.current && !spanRef.current.contains(event.target as Node) &&
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
      <p className="font-bold text-[var(--theme-accent-primary)] mb-1 break-words">{entity.ten}</p>
      <p className="break-words">{entity.moTa}</p>
      {entity.capDo && <p className="text-sm mt-2 text-[var(--theme-text-secondary)]"><strong>Cấp độ:</strong> {entity.capDo}</p>}
      {entity.diaDiemCha && <p className="text-sm text-[var(--theme-text-secondary)]"><strong>Thuộc:</strong> {entity.diaDiemCha}</p>}
      <div 
        className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent
                    ${popoverPosition === 'top' ? 'top-full border-t-8 border-t-[var(--theme-border)]' : 'bottom-full border-b-8 border-b-[var(--theme-border)]'}`}
      />
    </div>,
    popoverRoot
  ) : null;

  return (
    <>
      <span
        ref={spanRef}
        onClick={() => setIsPopoverVisible(!isPopoverVisible)}
        className="cursor-pointer border-b border-dashed border-[var(--theme-accent-primary)]/70 hover:border-solid hover:border-[var(--theme-accent-primary)] transition-colors"
        role="button"
        tabIndex={0}
        aria-haspopup="true"
        aria-expanded={isPopoverVisible}
      >
        {children}
      </span>
      {popoverContent}
    </>
  );
};

export default EntityTooltip;
