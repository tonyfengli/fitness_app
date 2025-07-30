"use client";

import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { ModalButton } from './ModalButton';

export interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (note: string) => void;
  isLoading?: boolean;
}

/**
 * Modal for adding notes/preferences
 */
export const NotesModal: React.FC<NotesModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false
}) => {
  const [noteText, setNoteText] = useState<string>('');
  
  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNoteText('');
    }
  }, [isOpen]);
  
  const isValidNote = noteText.trim().length > 0;

  const footer = (
    <>
      <ModalButton onClick={onClose} disabled={isLoading}>
        Cancel
      </ModalButton>
      <ModalButton
        onClick={() => {
          if (isValidNote && onConfirm) {
            onConfirm(noteText.trim());
          }
        }}
        disabled={!isValidNote}
        variant="primary"
        loading={isLoading}
        loadingText="Adding..."
      >
        Add
      </ModalButton>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Note"
      footer={footer}
    >
      <div className="p-6">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add your note here..."
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          rows={4}
          disabled={isLoading}
        />
      </div>
    </BaseModal>
  );
};