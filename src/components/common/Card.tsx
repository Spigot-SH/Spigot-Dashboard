'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  hoverable?: boolean;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({
  children,
  header,
  padding = 'md',
  className = '',
  hoverable = false,
  style,
}) => {
  const paddingMap = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-8',
  };

  return (
    <div
      className={`bg-panel rounded-lg border border-border backdrop-blur-md ${hoverable ? 'hover:bg-panel-hover hover:border-white/20' : ''} ${className}`}
      style={style}
    >
      {header && (
        <div className="px-5 py-4 border-b border-border text-main font-medium">{header}</div>
      )}
      <div className={paddingMap[padding]}>{children}</div>
    </div>
  );
};
