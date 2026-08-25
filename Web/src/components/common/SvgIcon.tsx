'use client';

import React, { useEffect, useState } from 'react';

interface SvgIconProps {
  src: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

/**
 * Carga un SVG como inline para poder controlar su color via CSS.
 * Funciona con SVGs que usan fill="currentColor".
 */
export const SvgIcon: React.FC<SvgIconProps> = ({ src, size = 28, color = 'currentColor', style }) => {
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    fetch(src)
      .then((res) => res.text())
      .then((text) => {
        // Reemplazar width/height del SVG raíz para que sea controlable por CSS
        const cleaned = text
          .replace(/width="[^"]*"/, `width="${size}"`)
          .replace(/height="[^"]*"/, `height="${size}"`);
        setSvgContent(cleaned);
      })
      .catch(() => setSvgContent(null));
  }, [src, size]);

  if (!svgContent) {
    return <div style={{ width: size, height: size }} />;
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
        width: size,
        height: size,
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
};
