'use client';

import React, { useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Shown at the left of the top row, opposite the close button. Omitted on a first step. */
  onBack?: () => void;
  backLabel?: string;
}

/**
 * The top row carries navigation only: back on the left, close on the right. The title sits
 * under it rather than beside the close button, so a step's heading does not have to share a
 * line with two controls that mean different things.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  onBack,
  backLabel,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-panel border border-border rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="-ml-1 inline-flex cursor-pointer items-center gap-1.5 rounded border-none bg-transparent p-1 text-xs text-muted hover:text-main"
            >
              <ArrowLeft size={14} /> {backLabel || 'Back'}
            </button>
          ) : (
            /* Holds the row's height so the title sits at the same offset on every step. */
            <span aria-hidden="true" className="block h-[26px]" />
          )}
          <button
            aria-label="Close"
            className="-mr-1 rounded border-none bg-transparent p-1 text-muted hover:text-main cursor-pointer"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <h3 className="m-0 px-6 pb-1 pt-2 text-lg font-medium text-main">{title}</h3>
        <div className="p-6 pt-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
