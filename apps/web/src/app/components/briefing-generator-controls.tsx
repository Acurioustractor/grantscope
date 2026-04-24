'use client';

import type { ReactNode } from 'react';

interface BriefingGeneratorControlsProps {
  action: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  header?: ReactNode;
  rowClassName?: string;
}

export function BriefingGeneratorControls({
  action,
  children,
  footer,
  header,
  rowClassName = 'flex flex-wrap gap-4 items-end',
}: BriefingGeneratorControlsProps) {
  return (
    <>
      {header}
      <div className={rowClassName}>
        {children}
        {action}
      </div>
      {footer}
    </>
  );
}
