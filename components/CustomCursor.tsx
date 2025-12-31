
import React, { useEffect, useState, useRef } from 'react';

interface Ripple {
  x: number;
  y: number;
  id: number;
}

export const CustomCursor: React.FC = () => {
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: -100, y: -100 });
  
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (!isVisible) setIsVisible(true);
      if (cursorDotRef.current) {
         cursorDotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
    };

    const onMouseOver = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target) return;
        
        const style = window.getComputedStyle(target);
        const isClickable = 
            target.tagName === 'BUTTON' ||
            target.tagName === 'A' ||
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.closest('button') !== null ||
            target.closest('a') !== null ||
            target.closest('[role="button"]') !== null ||
            style.cursor === 'pointer';
        
        setIsHovering(isClickable);
    };

    const onMouseClick = (e: MouseEvent) => {
        const newRipple = {
            x: e.clientX,
            y: e.clientY,
            id: Date.now()
        };
        setRipples(prev => [...prev, newRipple]);
        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== newRipple.id));
        }, 600); 
    };

    const onMouseLeave = () => setIsVisible(false);
    const onMouseEnter = () => setIsVisible(true);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseClick);
    document.addEventListener('mouseover', onMouseOver);
    document.documentElement.addEventListener('mouseleave', onMouseLeave);
    document.documentElement.addEventListener('mouseenter', onMouseEnter);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseClick);
      document.removeEventListener('mouseover', onMouseOver);
      document.documentElement.removeEventListener('mouseleave', onMouseLeave);
      document.documentElement.removeEventListener('mouseenter', onMouseEnter);
    };
  }, [isVisible]);

  if (!isVisible && mousePos.current.x < 0) return null;

  return (
    <>
      <style>{`
        * {
          cursor: none !important;
        }
        @keyframes rippleExpand {
            0% {
                transform: translate(-50%, -50%) scale(0.6);
                opacity: 0.8;
                border-width: 1px;
            }
            100% {
                transform: translate(-50%, -50%) scale(2.5);
                opacity: 0;
                border-width: 0px;
            }
        }
        .ripple {
            animation: rippleExpand 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
      `}</style>

      <div className={`fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div 
            ref={cursorDotRef}
            className="absolute top-0 left-0 will-change-transform"
        >
            <div className={`bg-white rounded-full transition-all duration-300 ease-out ${isHovering ? 'w-10 h-10 -translate-x-1/2 -translate-y-1/2 opacity-20' : 'w-3 h-3 -translate-x-1/2 -translate-y-1/2 opacity-100'}`} />
            {isHovering && <div className="absolute top-0 left-0 w-2 h-2 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />}
        </div>

        {ripples.map(ripple => (
             <div 
                key={ripple.id}
                className="absolute rounded-full border border-white/40 bg-white/5 ripple"
                style={{ 
                    left: ripple.x, 
                    top: ripple.y,
                    width: '30px',
                    height: '30px',
                }} 
             />
        ))}
      </div>
    </>
  );
};
