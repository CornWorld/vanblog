import { useEffect, useState } from 'react';
import { throttle } from 'lodash';

export const scrollToTop = () => {
  const currentPosition = document.documentElement.scrollTop || document.body.scrollTop;
  if (currentPosition > 0) {
    window.requestAnimationFrame(scrollToTop);
    window.scrollTo(0, currentPosition - currentPosition / 8);
  }
};

interface BackToTopProps {
  className?: string;
}

export default function BackToTop(props: BackToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showButton = throttle(() => {
      const scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
      setVisible(scrollTop > 300);
    }, 300);

    window.addEventListener('scroll', showButton);
    return () => window.removeEventListener('scroll', showButton);
  }, []);

  const handleClick = () => {
    scrollToTop();
  };

  return (
    <button
      type="button"
      className={`fixed right-8 bottom-8 z-90 rounded-full p-2 cursor-pointer shadow-[0_0_10px_rgba(0,0,0,0.05)] outline-none ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
      } transition-all duration-300 ${props.className || ''}`}
      onClick={handleClick}
    >
      <svg className="w-8 h-8" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}
