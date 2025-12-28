
import React, { useEffect, useState, useRef } from 'react';

interface Ripple {
  x: number;
  y: number;
  id: number;
}

export const CustomCursor: React.FC = () => {
  // Direct DOM ref for high-performance updates
  const cursorDotRef = useRef<HTMLDivElement>(null);
  
  // Mutable state for physics coordinates
  const mousePos = useRef({ x: -100, y: -100 });
  
  // UI State for styling
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  // Ripples State
  const [ripples, setRipples] = useState<Ripple[]>([]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      
      // Make visible on first move
      if (!isVisible) setIsVisible(true);
      
      // Move the center dot instantly
      if (cursorDotRef.current) {
         cursorDotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
    };

    const onMouseOver = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        // Check if element is interactive
        const isClickable = 
            target.tagName === 'BUTTON' ||
            target.tagName === 'A' ||
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.closest('button') !== null ||
            target.closest('a') !== null ||
            target.closest('[role="button"]') !== null ||
            window.getComputedStyle(target).cursor === 'pointer';
        
        setIsHovering(isClickable);
    };

    const onMouseClick = (e: MouseEvent) => {
        const newRipple = {
            x: e.clientX,
            y: e.clientY,
            id: Date.now()
        };
        
        setRipples(prev => [...prev, newRipple]);

        // Cleanup ripple after animation
        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== newRipple.id));
        }, 800); 
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
        body, a, button, input, textarea, [role="button"] {
          cursor: none !important;
        }
        @keyframes rippleExpand {
            0% {
                transform: translate(-50%, -50%) scale(0.5);
                opacity: 1;
                border-width: 2px;
            }
            100% {
                transform: translate(-50%, -50%) scale(4);
                opacity: 0;
                border-width: 0px;
            }
        }
        .ripple {
            animation: rippleExpand 0.8s cubic-bezier(0.215, 0.61, 0.355, 1) forwards;
        }
      `}</style>

      <div className={`fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        {/* Main Dot */}
        <div 
            ref={cursorDotRef}
            className="absolute top-0 left-0 will-change-transform"
        >
            <div className={`bg-white rounded-full w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${isHovering ? 'scale-[2.5] opacity-50' : 'scale-100'}`} />
        </div>

        {/* Click Ripples */}
        {ripples.map(ripple => (
             <div 
                key={ripple.id}
                className="absolute rounded-full border border-white bg-white/10 ripple backdrop-blur-[1px]"
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
