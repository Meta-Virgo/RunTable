import { useEffect, useRef } from "react";

interface ElasticScrollOptions {
  resistance?: number;
  springStrength?: number;
  damping?: number;
  disabled?: boolean;
}

export const useElasticScroll = (
  scrollRef: React.RefObject<HTMLElement>,
  contentRef: React.RefObject<HTMLElement>,
  options: ElasticScrollOptions = {}
) => {
  const {
    resistance = 0.4,
    springStrength = 0.15,
    damping = 0.85,
    disabled = false,
  } = options;

  // State to track physics
  const state = useRef({
    isDragging: false,
    startY: 0,
    currentY: 0, // Current scroll position (not used for logic, just tracking)
    overscroll: 0, // The amount of pixels we have pulled past the edge
    velocity: 0,
    lastTime: 0,
    rafId: 0,
  });

  useEffect(() => {
    if (disabled) return;

    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.defaultPrevented) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const isAtTop = scrollTop <= 0;
      const isAtBottom = Math.abs(scrollTop + clientHeight - scrollHeight) < 1;

      // Only intervene if we are at the edges and trying to scroll further
      if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        // If we are already overscrolled or starting to overscroll

        // Prevent default scrolling (browser overscroll)
        // We only prevent default if we are "catching" the scroll
        // But we need to be careful not to block normal scrolling if we turn around

        if (e.cancelable) e.preventDefault();

        // Calculate new overscroll with resistance
        // The further we are, the harder it is to pull
        const delta = -e.deltaY; // deltaY > 0 is scrolling down (content moves up)

        // Apply resistance based on current overscroll magnitude
        // Formula: delta * (1 / (1 + abs(overscroll) * k))
        const resistanceFactor =
          1 / (1 + Math.abs(state.current.overscroll) * 0.005);
        state.current.overscroll += delta * resistanceFactor * resistance;

        // Apply transform immediately
        updateTransform();

        // Reset velocity since we are controlling it
        state.current.velocity = 0;

        // Stop any running spring animation
        cancelAnimationFrame(state.current.rafId);

        // Schedule a spring back if user stops wheeling
        // Since wheel event doesn't have "end", we debounce a release
        clearTimeout((state.current as any).wheelTimeout);
        (state.current as any).wheelTimeout = setTimeout(startSpringBack, 100);
      } else if (state.current.overscroll !== 0) {
        // If we are overscrolled but scrolling back towards content
        // Let the wheel event happen? No, we should probably handle it to make it feel connected
        // For simplicity, if overscroll is active, we consume events until it's 0
        // But here we just let the spring back handle it if they stop
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      state.current.isDragging = true;
      state.current.startY = e.touches[0].clientY;
      // Stop spring animation if user catches it
      cancelAnimationFrame(state.current.rafId);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!state.current.isDragging) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const currentY = e.touches[0].clientY;
      const delta = currentY - state.current.startY;
      state.current.startY = currentY;

      const isAtTop = scrollTop <= 0;
      const isAtBottom = Math.abs(scrollTop + clientHeight - scrollHeight) < 1;

      // Logic:
      // If we are at top and pulling down (delta > 0) -> Overscroll Top (positive)
      // If we are at bottom and pulling up (delta < 0) -> Overscroll Bottom (negative)
      // If we are already overscrolled, any delta contributes to overscroll

      if (
        state.current.overscroll !== 0 ||
        (isAtTop && delta > 0) ||
        (isAtBottom && delta < 0)
      ) {
        if (e.cancelable && state.current.overscroll !== 0) {
          e.preventDefault(); // Lock scroll if we are strictly in overscroll mode
        }

        // Check if we are returning to neutral (opposing the overscroll)
        const isReturning =
          (state.current.overscroll > 0 && delta < 0) ||
          (state.current.overscroll < 0 && delta > 0);

        if (isReturning) {
          // Accelerate the return to 0 to make it feel "responsive"
          // User wants to start scrolling immediately without waiting for long overscroll recovery
          const returnSpeed = 4; // 4x speed for recovery
          const change = delta * returnSpeed;
          const newOverscroll = state.current.overscroll + change;

          if (
            (state.current.overscroll > 0 && newOverscroll < 0) ||
            (state.current.overscroll < 0 && newOverscroll > 0)
          ) {
            // We crossed 0.
            const oldOverscroll = state.current.overscroll;
            state.current.overscroll = 0;

            // Calculate how much delta was "unused" by the overscroll recovery
            // The part of delta that brought overscroll to exactly 0 is `deltaToZero`.
            // deltaToZero * returnSpeed = -oldOverscroll
            // deltaToZero = -oldOverscroll / returnSpeed
            const deltaToZero = -oldOverscroll / returnSpeed;
            const remainingDelta = delta - deltaToZero;

            // Apply remaining delta to scrollTop (1:1 physics)
            scrollEl.scrollTop -= remainingDelta;
          } else {
            state.current.overscroll = newOverscroll;
          }
        } else {
          // Apply resistance when pulling away
          const resistanceFactor =
            1 / (1 + Math.abs(state.current.overscroll) * 0.005);
          state.current.overscroll += delta * resistanceFactor * resistance;
        }

        updateTransform();
      }
    };

    const handleTouchEnd = () => {
      state.current.isDragging = false;
      startSpringBack();
    };

    const updateTransform = () => {
      if (contentEl) {
        contentEl.style.transform = `translate3d(0, ${state.current.overscroll}px, 0)`;
      }
    };

    const startSpringBack = () => {
      state.current.lastTime = performance.now();
      cancelAnimationFrame(state.current.rafId);
      requestAnimationFrame(animateSpring);
    };

    const animateSpring = (time: number) => {
      const dt = (time - state.current.lastTime) / 16.67; // Normalize to ~60fps
      state.current.lastTime = time;

      // Spring physics: F = -kx - cv
      // a = F / m (assume m=1)
      const force = -springStrength * state.current.overscroll;
      const friction = -damping * state.current.velocity; // Simple damping
      const acceleration = force + friction; // Simplified

      state.current.velocity += acceleration * dt;
      state.current.overscroll += state.current.velocity * dt;

      // Snap to 0 if close enough
      if (
        Math.abs(state.current.overscroll) < 0.5 &&
        Math.abs(state.current.velocity) < 0.5
      ) {
        state.current.overscroll = 0;
        state.current.velocity = 0;
        updateTransform();
        return; // Stop animation
      }

      updateTransform();
      state.current.rafId = requestAnimationFrame(animateSpring);
    };

    // Attach listeners
    // Note: 'wheel' needs passive: false to prevent default
    scrollEl.addEventListener("wheel", handleWheel, { passive: false });
    scrollEl.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    scrollEl.addEventListener("touchmove", handleTouchMove, { passive: false }); // Need passive: false for touch prevention
    scrollEl.addEventListener("touchend", handleTouchEnd);

    return () => {
      scrollEl.removeEventListener("wheel", handleWheel);
      scrollEl.removeEventListener("touchstart", handleTouchStart);
      scrollEl.removeEventListener("touchmove", handleTouchMove);
      scrollEl.removeEventListener("touchend", handleTouchEnd);
      cancelAnimationFrame(state.current.rafId);
    };
  }, [
    scrollRef.current,
    contentRef.current,
    resistance,
    springStrength,
    damping,
    disabled,
  ]);
};
