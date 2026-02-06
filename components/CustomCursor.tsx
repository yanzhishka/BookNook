
import React, { useEffect, useState, useRef } from 'react';

interface Ripple {
  x: number;
  y: number;
  id: number;
}

export const CustomCursor: React.FC = () => {
  const outlineRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  
  const mousePos = useRef({ x: -100, y: -100 });
  const delayedPos = useRef({ x: -100, y: -100 });
  
  const [isHovering, setIsHovering] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      setIsPressed(true);
      const newRipple = { x: e.clientX, y: e.clientY, id: Date.now() };
      setRipples(prev => [...prev, newRipple]);
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== newRipple.id));
      }, 800);
    };

    const onMouseUp = () => {
      setIsPressed(false);
    };

    const animate = () => {
      const lerpAmount = 0.22;
      delayedPos.current.x += (mousePos.current.x - delayedPos.current.x) * lerpAmount;
      delayedPos.current.y += (mousePos.current.y - delayedPos.current.y) * lerpAmount;

      if (outlineRef.current) {
        outlineRef.current.style.transform = `translate3d(${delayedPos.current.x}px, ${delayedPos.current.y}px, 0)`;
      }
      requestAnimationFrame(animate);
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      setIsHovering(!!target.closest('button, a, input, textarea, [role="button"], .cursor-pointer'));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mouseover', onMouseOver);
    const raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mouseover', onMouseOver);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <style>{`
        html, body, *, *:before, *:after { cursor: none !important; }
        @keyframes ripple-out {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.4; }
          100% { transform: translate(-50%, -50%) scale(5); opacity: 0; }
        }
        .ripple {
          position: fixed; pointer-events: none; border-radius: 50%;
          border: 1px solid currentColor;
          z-index: 9998; animation: ripple-out 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none z-[9999]">
        {/* Central Core: Black in light, White in dark */}
        <div ref={dotRef} className="absolute top-0 left-0 translate-z-0">
          <div className={`
            w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2 transition-colors duration-500
            bg-stone-950 dark:bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)] dark:shadow-[0_0_12px_rgba(0,0,0,0.5)]
          `} />
        </div>

        {/* Liquid Glass Outer Ring - Updated for readability */}
        <div ref={outlineRef} className="absolute top-0 left-0 translate-z-0">
          <div 
            className={`
              rounded-full border transition-all duration-300 ease-out -translate-x-1/2 -translate-y-1/2
              border-stone-950/20 dark:border-white/30
              ${isHovering ? 'w-16 h-16 border-stone-950 dark:border-white scale-110' : 'w-10 h-10'}
              ${isPressed ? 'scale-75 opacity-50' : 'scale-100 opacity-100'}
            `} 
            style={{ 
              // Removed blur to prevent obscuring text
              backgroundColor: isHovering ? 'rgba(0,0,0,0.02)' : 'transparent',
              boxShadow: isHovering ? '0 0 20px rgba(0,0,0,0.05)' : 'none'
            }}
          />
        </div>

        {ripples.map(r => (
          <div 
            key={r.id} 
            className="ripple text-stone-950 dark:text-white" 
            style={{ left: r.x, top: r.y, width: '20px', height: '20px' }} 
          />
        ))}
      </div>
    </>
  );
};
