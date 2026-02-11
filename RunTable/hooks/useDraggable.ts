import { useState, useEffect, useRef } from "react";

interface Position {
  x: number;
  y: number;
}

export const useDraggable = (
  initialPosition: Position | null = null,
  storageKey?: string
) => {
  const [position, setPosition] = useState<Position>(
    initialPosition || { x: 0, y: 0 }
  );
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false); // To distinguish click vs drag
  const dragStartPos = useRef<Position>({ x: 0, y: 0 });
  const offset = useRef<Position>({ x: 0, y: 0 });

  // Load from local storage on mount
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            setPosition(parsed);
          }
        } catch (e) {
          console.error("Failed to parse saved position", e);
        }
      } else if (!initialPosition) {
        // If no saved position and no explicit initial, default to bottom-right
        // We defer this calculation to allow window to be available
        setPosition({
          x: window.innerWidth - 100,
          y: window.innerHeight - 150,
        });
      }
    }
  }, [storageKey]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent default to avoid text selection etc
    // e.preventDefault();
    // Note: e.preventDefault() on input might block focus, use with care.
    // For a drag handle button it is fine.

    setIsDragging(true);
    setHasMoved(false);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    offset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;

      // Threshold for "move" vs "click"
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        setHasMoved(true);
      }

      let newX = e.clientX - offset.current.x;
      let newY = e.clientY - offset.current.y;

      // Simple bounds checking (keep somewhat on screen)
      const maxX = window.innerWidth - 50;
      const maxY = window.innerHeight - 50;
      const minX = -200; // Allow some overflow left
      const minY = 0;

      if (newX > maxX) newX = maxX;
      if (newX < minX) newX = minX;
      if (newY > maxY) newY = maxY;
      if (newY < minY) newY = minY;

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(position));
        }
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, position, storageKey]);

  return { position, handleMouseDown, isDragging, hasMoved, setPosition };
};
