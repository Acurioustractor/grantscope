import type { ReactNode } from 'react';
import { BriefingControlPanel } from '@/app/components/briefing-control-panel';
import { BriefingGeneratorControls } from '@/app/components/briefing-generator-controls';

interface BriefingEntrySectionProps {
  action: ReactNode;
  children: ReactNode;
  className?: string;
  error?: string;
  footer?: ReactNode;
  header?: ReactNode;
  note?: string;
  rowClassName?: string;
  title: string;
}

export function BriefingEntrySection({
  action,
  children,
  className,
  error,
  footer,
  header,
  note,
  rowClassName,
  title,
}: BriefingEntrySectionProps) {
  return (
    <BriefingControlPanel title={title} className={className} note={note} error={error}>
      <BriefingGeneratorControls header={header} footer={footer} action={action} rowClassName={rowClassName}>
        {children}
      </BriefingGeneratorControls>
    </BriefingControlPanel>
  );
}
