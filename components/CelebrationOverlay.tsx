import React from 'react';

export const CelebrationOverlay: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none animate-celebration">
      {/* Primary Aurora Layer */}
      <div 
        className="absolute inset-0 opacity-60 dark:opacity-40 mix-blend-screen dark:mix-blend-overlay"
        style={{
          background: 'linear-gradient(45deg, #ff0080, #ff8c00, #40e0d0)',
          backgroundSize: '400% 400%',
          animation: 'aurora 3s ease infinite'
        }}
      />
      
      {/* Secondary Shimmer Layer */}
      <div 
        className="absolute inset-0 opacity-40 dark:opacity-30 mix-blend-soft-light"
        style={{
          background: 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)',
          backgroundSize: '400% 400%',
          animation: 'aurora 4s ease infinite reverse'
        }}
      />

      {/* Flash overlay for impact */}
      <div className="absolute inset-0 bg-white/20 dark:bg-white/10 mix-blend-overlay animate-pulse" />
    </div>
  );
};