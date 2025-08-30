import React, { useState, useEffect } from 'react';

interface ScrollToTopButtonProps {
  isReading?: boolean;
  isBottomNavVisible?: boolean;
}

const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({ isReading = false, isBottomNavVisible = false }) => {
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = () => {
    if (window.scrollY > 300) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    window.addEventListener('scroll', toggleVisibility);
    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, []);

  const bottomPosition = isReading && isBottomNavVisible ? 'bottom-24' : 'bottom-6';

  return (
    <button
      onClick={scrollToTop}
      className={`fixed ${bottomPosition} right-6 w-14 h-14 rounded-full flex items-center justify-center
                  shadow-lg z-40 transition-all duration-300
                  ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-0 pointer-events-none'}
                  bg-[var(--theme-bg-base)]/50 backdrop-blur-sm ring-2 ring-[var(--theme-accent-primary)] text-[var(--theme-accent-primary)]
                  hover:bg-[var(--theme-accent-primary)] hover:text-white`}
      aria-label="Cuộn lên đầu trang"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
};

export default ScrollToTopButton;