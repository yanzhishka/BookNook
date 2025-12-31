
import React, { useEffect, useState, useRef } from 'react';

interface Ripple {
  x: number;
  y: number;
  id: number;
}

export const CustomCursor: React.FC = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: -100, y: -100 });
  const delayedPos = useRef({ x: -100, y: -100 });
  
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (!isVisible) setIsVisible(true);
    };

    const onMouseDown = (e: MouseEvent) => {
      const newRipple = { x: e.clientX, y: e.clientY, id: Date.now() };
      setRipples(prev => [...prev, newRipple]);
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== newRipple.id));
      }, 600);
    };

    const animate = () => {
      // Плавное следование (Lerp)
      const lerpAmount = 0.2;
      delayedPos.current.x += (mousePos.current.x - delayedPos.current.x) * lerpAmount;
      delayedPos.current.y += (mousePos.current.y - delayedPos.current.y) * lerpAmount;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${delayedPos.current.x}px, ${delayedPos.current.y}px, 0)`;
      }

      requestAnimationFrame(animate);
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, textarea, [role="button"]')) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    const handleEnter = () => setIsVisible(true);
    const handleLeave = () => setIsVisible(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('mouseenter', handleEnter);
    document.addEventListener('mouseleave', handleLeave);
    
    const raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseover', onMouseOver);
      document.removeEventListener('mouseenter', handleEnter);
      document.removeEventListener('mouseleave', handleLeave);
      cancelAnimationFrame(raf);
    };
  }, [isVisible]);

  return (
    <>
      <style>{`
        html, body, *, *:before, *:after {
          cursor: none !important;
        }
        @keyframes rippleExpand {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
        }
        .cursor-ripple {
          position: fixed;
          pointer-events: none;
          border: 1px solid white;
          border-radius: 50%;
          z-index: 9998;
          mix-blend-difference;
          animation: rippleExpand 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className={`fixed inset-0 pointer-events-none z-[9999] transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div 
          ref={cursorRef}
          className="absolute top-0 left-0 will-change-transform"
        >
          <div 
            className={`rounded-full bg-white mix-blend-difference transition-all duration-300 -translate-x-1/2 -translate-y-1/2 shadow-lg ${
              isHovering ? 'w-4 h-4 opacity-50' : 'w-3 h-3 opacity-100'
            }`}
          />
        </div>

        {ripples.map(ripple => (
          <div 
            key={ripple.id}
            className="cursor-ripple"
            style={{ 
              left: ripple.x, 
              top: ripple.y,
              width: '20px',
              height: '20px',
            }} 
          />
        ))}
      </div>
    </>
  );
};
