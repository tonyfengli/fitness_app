import React from "react";

import { Button, Icon } from "@acme/ui-shared";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  variant?: "danger" | "warning" | "info";
  icon?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isLoading = false,
  variant = "danger",
  icon,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: icon || "warning",
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      confirmButton: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    },
    warning: {
      icon: icon || "info",
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600",
      confirmButton: "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500",
    },
    info: {
      icon: icon || "info",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      confirmButton: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
    },
  };

  const styles = variantStyles[variant];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black bg-opacity-50 transition-opacity"
        onClick={isLoading ? undefined : onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-lg bg-white shadow-xl"
          data-testid="confirm-dialog"
        >
          <div className="p-6">
            {/* Icon */}
            <div
              className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${styles.iconBg}`}
            >
              <Icon name={styles.icon} size={24} className={styles.iconColor} />
            </div>

            {/* Title */}
            <h3 className="mt-4 text-center text-lg font-medium text-gray-900">
              {title}
            </h3>

            {/* Message */}
            <p className="mt-2 text-center text-sm text-gray-500">{message}</p>
          </div>

          {/* Actions */}
          <div className="gap-3 bg-gray-50 px-6 py-4 sm:flex sm:flex-row-reverse">
            <Button
              onClick={onConfirm}
              disabled={isLoading}
              className={`w-full text-white sm:w-auto ${styles.confirmButton} disabled:opacity-50`}
              data-testid="confirm-delete-button"
            >
              {isLoading ? "Deleting..." : confirmText}
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {cancelText}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
