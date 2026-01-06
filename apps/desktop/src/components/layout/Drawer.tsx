import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: "left" | "right";
  title?: string;
}

export function Drawer({
  isOpen,
  onClose,
  children,
  side = "left",
  title,
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={handleBackdropClick}
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        className={`absolute top-0 bottom-0 w-[85%] max-w-sm bg-[hsl(var(--background))] shadow-2xl flex flex-col ${
          side === "left"
            ? "left-0 animate-slide-in-left"
            : "right-0 animate-slide-in-right"
        }`}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="h-10 w-10 rounded-xl flex items-center justify-center hover:bg-[hsl(var(--secondary))] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
