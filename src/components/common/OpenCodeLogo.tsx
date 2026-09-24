import React from 'react';

/**
 * OpenCode (opencode.ai) official mark.
 * Minimalist retro terminal square pixel logo.
 */
export const OpenCodeLogo: React.FC<{
  size?: number;
  className?: string;
  title?: string;
  fill?: string;
}> = ({ size = 24, className = '', title = 'OpenCode', fill = 'currentColor' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : true}
    fill={fill}
    fillRule="evenodd"
    shapeRendering="geometricPrecision"
  >
    <path d="M16 6H8v12h8V6zm4 16H4V2h16v20z" />
  </svg>
);

export default OpenCodeLogo;
