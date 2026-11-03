
import React, { useEffect, useState, useRef } from 'react';

interface Ripple {
  x: number;
  y: number;
  id: number;
}

export const CustomCursor: React.FC = () => {
  const layerRef = useRef<HTMLDivElement>(null);
  const outlineRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  
  const mousePos = useRef({ x: -100, y: -100 });
  const delayedPos = useRef({ x: -100, y: -100 });
  
  const [isHovering, setIsHovering] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  useEffect(() => {
    const layer = layerRef.current;
    const pointer = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animationFrame = 0;
    // A normal z-index cannot paint above showModal() dialogs. A non-interactive
    // manual popover shares their browser top layer without taking focus.
    if (!layer || typeof layer.showPopover !== 'function') return;
    layer.setAttribute('popover', 'manual');
    const raiseCursor = () => {
      if (!pointer.matches || reducedMotion.matches) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        if (layer.matches(':popover-open')) layer.hidePopover();
        document.documentElement.classList.remove('custom-cursor-enabled');
        return;
      }
      if (layer.matches(':popover-open')) layer.hidePopover();
      layer.showPopover();
      document.documentElement.classList.add('custom-cursor-enabled');
    };
    const dialogs = new MutationObserver(records => {
      if (records.some(record => record.target instanceof HTMLDialogElement)) raiseCursor();
    });
    dialogs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
    const onToggle = (event: Event) => {
      if (event.target !== layer && event.target instanceof HTMLElement && event.target.hasAttribute('popover') &&
        (event as Event & { newState?: string }).newState === 'open') raiseCursor();
    };
    document.addEventListener('toggle', onToggle, true);
    pointer.addEventListener('change', raiseCursor);
    reducedMotion.addEventListener('change', raiseCursor);
    raiseCursor();
    const rippleTimers = new Set<number>();

    const onMouseMove = (e: MouseEvent) => {
      if (!pointer.matches || reducedMotion.matches) return;
      mousePos.current = { x: e.clientX, y: e.clientY };
      
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
      if (!animationFrame) animationFrame = requestAnimationFrame(animate);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!pointer.matches || reducedMotion.matches) return;
      setIsPressed(true);
      const newRipple = { x: e.clientX, y: e.clientY, id: Date.now() };
      setRipples(prev => [...prev, newRipple]);
      const timeout = window.setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== newRipple.id));
        rippleTimers.delete(timeout);
      }, 800);
      rippleTimers.add(timeout);
    };

    const onMouseUp = () => {
      setIsPressed(false);
    };

    const animate = () => {
      animationFrame = 0;
      const lerpAmount = 0.22;
      delayedPos.current.x += (mousePos.current.x - delayedPos.current.x) * lerpAmount;
      delayedPos.current.y += (mousePos.current.y - delayedPos.current.y) * lerpAmount;

      if (outlineRef.current) {
        outlineRef.current.style.transform = `translate3d(${delayedPos.current.x}px, ${delayedPos.current.y}px, 0)`;
      }
      // Stop once the ring catches up. Idle tabs and touch devices should not
      // run a permanent animation loop just to keep an unmoving cursor visible.
      if (Math.abs(mousePos.current.x - delayedPos.current.x) > 0.1 ||
          Math.abs(mousePos.current.y - delayedPos.current.y) > 0.1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target;
      setIsHovering(target instanceof Element && !!target.closest('button, a, input, textarea, [role="button"], .cursor-pointer'));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onMouseUp);
    document.addEventListener('mouseover', onMouseOver);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onMouseUp);
      document.removeEventListener('mouseover', onMouseOver);
      cancelAnimationFrame(animationFrame);
      rippleTimers.forEach(window.clearTimeout);
      dialogs.disconnect();
      pointer.removeEventListener('change', raiseCursor);
      reducedMotion.removeEventListener('change', raiseCursor);
      document.removeEventListener('toggle', onToggle, true);
      if (layer.matches(':popover-open')) layer.hidePopover();
      document.documentElement.classList.remove('custom-cursor-enabled');
    };
  }, []);

  return (
    <>
      <style>{`
        html.custom-cursor-enabled, .custom-cursor-enabled *,
        .custom-cursor-enabled *::before, .custom-cursor-enabled *::after,
        .custom-cursor-enabled dialog::backdrop { cursor: none !important; }
        .custom-cursor-layer {
          position: fixed; inset: 0; width: 100%; height: 100%;
          max-width: none; max-height: none; margin: 0; padding: 0;
          border: 0; background: transparent; overflow: visible;
          pointer-events: none; z-index: 9999;
        }
        .custom-cursor-layer::backdrop { background: transparent; pointer-events: none; }
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

      <div ref={layerRef} className="custom-cursor-layer" data-custom-cursor="true" aria-hidden="true">
        {/* Central Core: Black in light, White in dark */}
        <div ref={dotRef} className="absolute top-0 left-0 translate-z-0" style={{ transform: 'translate3d(-100px,-100px,0)' }}>
          <div className={`
            w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2 transition-colors duration-500
            bg-stone-950 dark:bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)] dark:shadow-[0_0_12px_rgba(0,0,0,0.5)]
          `} />
        </div>

        {/* Liquid Glass Outer Ring - Updated for readability */}
        <div ref={outlineRef} className="absolute top-0 left-0 translate-z-0" style={{ transform: 'translate3d(-100px,-100px,0)' }}>
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
