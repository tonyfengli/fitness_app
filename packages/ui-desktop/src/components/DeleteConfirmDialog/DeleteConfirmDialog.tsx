"use client";

import React from "react";
import { Button, Icon } from "@acme/ui-shared";
import type { DeleteConfirmDialogProps } from "./DeleteConfirmDialog.types";

export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  isDeleting = false,
}: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      >
        {/* Modal */}
        <div className="flex items-center justify-center h-full p-4">
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon and Content */}
            <div className="px-8 py-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Icon name="warning" size={24} className="text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {title}
                  </h3>
                  <p className="text-gray-600 mt-2">
                    {message}
                  </p>
                  {itemName && (
                    <p className="text-sm text-gray-500 mt-2">
                      <span className="font-medium">{itemName}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 bg-gray-50 flex justify-end gap-3">
              <Button 
                variant="ghost" 
                onClick={onClose}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button 
                onClick={onConfirm}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}