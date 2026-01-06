import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  snapPoints?: number[]; // Heights as percentages (e.g., [0.3, 0.6, 0.9])
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = [0.4, 0.85],
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [currentSnap, setCurrentSnap] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [currentHeight, setCurrentHeight] = useState(0);

  const heights = snapPoints.map((p) => window.innerHeight * p);

  // Reset snap when closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentSnap(0);
    }
  }, [isOpen]);

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

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setDragStartY(clientY);
    setCurrentHeight(heights[currentSnap]);
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;

    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const delta = dragStartY - clientY;
    const newHeight = Math.max(100, Math.min(window.innerHeight * 0.95, currentHeight + delta));

    if (sheetRef.current) {
      sheetRef.current.style.height = `${newHeight}px`;
    }
  };

  const handleDragEnd = () => {
    if (!isDragging || !sheetRef.current) return;

    setIsDragging(false);
    const currentHeight = sheetRef.current.getBoundingClientRect().height;

    // Find closest snap point
    let closestSnap = 0;
    let minDistance = Infinity;

    heights.forEach((h, i) => {
      const distance = Math.abs(currentHeight - h);
      if (distance < minDistance) {
        minDistance = distance;
        closestSnap = i;
      }
    });

    // If dragged below threshold, close
    if (currentHeight < heights[0] * 0.5) {
      onClose();
      return;
    }

    setCurrentSnap(closestSnap);
    sheetRef.current.style.height = `${heights[closestSnap]}px`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-[hsl(var(--background))] rounded-t-3xl shadow-2xl flex flex-col animate-slide-up transition-[height] duration-300"
        style={{ height: heights[currentSnap] }}
      >
        {/* Handle */}
        <div
          className="flex-shrink-0 pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-12 h-1.5 bg-[hsl(var(--muted))] rounded-full mx-auto" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-[hsl(var(--border))]">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="h-10 w-10 rounded-xl flex items-center justify-center hover:bg-[hsl(var(--secondary))] transition-colors"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-safe">{children}</div>
      </div>
    </div>
  );
}
