import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-[var(--theme-bg-surface)] mt-auto">
      <div className="container mx-auto px-4 py-6 text-center text-[var(--theme-text-secondary)]">
        <p>&copy; {new Date().getFullYear()} Trình Đọc Truyện. Một sản phẩm demo.</p>
      </div>
    </footer>
  );
};

export default Footer;