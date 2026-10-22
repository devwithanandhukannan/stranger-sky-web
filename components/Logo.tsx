import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
  priority?: boolean;
}

export default function Logo({ size = 48, className = '', glow = false }: LogoProps) {
  const borderRadius = Math.round(size * 0.22);

  return (
    <div
      className={`lumen-logo-wrap ${className}`}
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {glow && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: -size * 0.22,
            background: 'radial-gradient(circle, rgba(139, 123, 250, 0.5) 0%, rgba(120, 102, 235, 0.2) 50%, transparent 72%)',
            filter: 'blur(12px)',
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      <img
        src="/web-app-manifest-512x512.png"
        alt="Stranger Sky Mascot"
        width={size}
        height={size}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: `${borderRadius}px`,
          boxShadow: glow
            ? '0 12px 30px -4px rgba(100, 83, 219, 0.6), 0 0 16px rgba(255, 209, 102, 0.25)'
            : '0 4px 14px rgba(0, 0, 0, 0.4)',
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  );
}
