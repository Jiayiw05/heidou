import React, { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorAlertProps {
  message: string | null;
  onClose?: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  message,
  onClose,
  autoClose = true,
  autoCloseDelay = 5000
}) => {
  useEffect(() => {
    if (message && autoClose && onClose) {
      const timer = setTimeout(onClose, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [message, autoClose, autoCloseDelay, onClose]);

  if (!message) return null;

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
      <div className="bg-red-500 bg-opacity-90 text-white p-4 rounded-lg shadow-lg flex items-center space-x-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm flex-1">{message}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 p-1 hover:bg-white hover:bg-opacity-20 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};