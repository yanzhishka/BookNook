
import React from 'react';
import { classNames } from '../utils/classNames';
import styles from './Identicon.module.css';

interface IdenticonProps {
  seed: string;
  size?: number;
  className?: string;
}

export const Identicon: React.FC<IdenticonProps> = ({ seed, size = 40, className = '' }) => {
  // Simple hash function to get deterministic values from seed
  const hashString = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const hash = hashString(seed);
  
  // Generate visual parameters based on hash
  const hue = hash % 360;
  const saturation = 50 + (hash % 30);
  const lightness = 40 + (hash % 20);
  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  const secondaryColor = `hsl(${(hue + 40) % 360}, ${saturation}%, ${lightness + 10}%)`;

  // Deterministic shapes
  const shapeType = hash % 4; // 0: circles, 1: rects, 2: triangles, 3: mixed
  
  return (
    <div className={classNames(styles.identicon, className)}>
      <svg
        className={styles.svg}
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" fill={color} />
        {shapeType === 0 && (
          <>
            <circle cx="50" cy="50" r="30" fill={secondaryColor} fillOpacity="0.5" />
            <circle cx={20 + (hash % 60)} cy={20 + (hash % 60)} r="15" fill="white" fillOpacity="0.3" />
          </>
        )}
        {shapeType === 1 && (
          <>
            <rect x="25" y="25" width="50" height="50" rx="8" fill={secondaryColor} fillOpacity="0.5" transform={`rotate(${hash % 90}, 50, 50)`} />
            <rect x="10" y="10" width="20" height="20" rx="4" fill="white" fillOpacity="0.3" />
          </>
        )}
        {shapeType === 2 && (
          <path d="M50 20L80 80H20L50 20Z" fill={secondaryColor} fillOpacity="0.5" transform={`rotate(${hash % 360}, 50, 50)`} />
        )}
        {shapeType === 3 && (
          <>
            <rect x="20" y="20" width="60" height="20" fill={secondaryColor} fillOpacity="0.4" />
            <circle cx="50" cy="70" r="20" fill="white" fillOpacity="0.2" />
          </>
        )}
      </svg>
    </div>
  );
};
