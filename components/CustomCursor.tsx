
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
      
      // Мгновенное обновление точки для максимальной отзывчивости
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
      // Плавное следование внешнего кольца
      const lerpAmount = 0.25;
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
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.6; }
          100% { transform: translate(-50%, -50%) scale(5); opacity: 0; }
        }
        .ripple {
          position: fixed; pointer-events: none; border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.4);
          z-index: 9998; animation: ripple-out 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none z-[9999]">
        {/* Мгновенная центральная точка — белый цвет с эффектом наложения */}
        <div ref={dotRef} className="absolute top-0 left-0 will-change-transform z-10">
          <div className="w-1.5 h-1.5 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_rgba(255,255,255,0.5)] mix-blend-difference" />
        </div>

        {/* Плавное внешнее кольцо — белый цвет с эффектом наложения */}
        <div ref={outlineRef} className="absolute top-0 left-0 will-change-transform">
          <div 
            className={`
              rounded-full border border-white/50 mix-blend-difference transition-all duration-150 ease-out -translate-x-1/2 -translate-y-1/2
              ${isHovering ? 'w-14 h-14 bg-white/10 border-white scale-110' : 'w-8 h-8'}
              ${isPressed ? 'scale-75 opacity-50' : 'scale-100 opacity-100'}
            `} 
          />
        </div>

        {ripples.map(r => (
          <div 
            key={r.id} 
            className="ripple mix-blend-difference" 
            style={{ left: r.x, top: r.y, width: '20px', height: '20px' }} 
          />
        ))}
      </div>
    </>
  );
};
