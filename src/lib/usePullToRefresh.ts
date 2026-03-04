import { useRef, useState } from "react";
import type { TouchEvent } from "react";

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number; // Distance to pull before triggering refresh
  maxPull?: number; // Maximum pull distance
  resistance?: number; // Pull resistance (higher = more resistance)
}

export function usePullToRefresh(options: PullToRefreshOptions) {
  const { onRefresh, threshold = 80, maxPull = 120, resistance = 2.5 } = options;

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef<{ y: number; scrollTop: number } | null>(null);
  const scrollElementRef = useRef<HTMLElement | null>(null);

  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    const element = e.currentTarget;
    scrollElementRef.current = element;

    // Only enable pull-to-refresh if scrolled to top
    if (element.scrollTop === 0) {
      const touch = e.touches[0];
      touchStartRef.current = {
        y: touch.clientY,
        scrollTop: element.scrollTop,
      };
    }
  };

  const onTouchMove = (e: TouchEvent<HTMLElement>) => {
    if (!touchStartRef.current || isRefreshing) return;

    const element = e.currentTarget;
    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Only track pull down when at top
    if (deltaY > 0 && element.scrollTop === 0) {
      e.preventDefault();
      // Apply resistance to pull
      const adjustedDelta = Math.min(deltaY / resistance, maxPull);
      setPullDistance(adjustedDelta);
    }
  };

  const onTouchEnd = async () => {
    if (!touchStartRef.current || isRefreshing) {
      touchStartRef.current = null;
      setPullDistance(0);
      return;
    }

    // Trigger refresh if pulled beyond threshold
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }

    touchStartRef.current = null;
  };

  return {
    pullDistance,
    isRefreshing,
    isPulling: pullDistance > 0 && !isRefreshing,
    willRefresh: pullDistance >= threshold,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
