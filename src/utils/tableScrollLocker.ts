/**
 * Utility to enforce strict 1-Dimensional (1D) axis scrolling on table components.
 * - Prevents diagonal scrolling for desktop trackpads & mouse wheels.
 * - Prevents scroll chaining / leaking to outer parent modals or page.
 * - Mobile / Touch devices are kept on 100% native hardware compositor scrolling
 *   (smooth inertial momentum at full 60-120 FPS).
 */

interface ScrollLockSession {
  axis: 'x' | 'y' | null;
  timer: any;
}

const activeSessions = new WeakMap<HTMLElement, ScrollLockSession>();

function getSession(el: HTMLElement): ScrollLockSession {
  let session = activeSessions.get(el);
  if (!session) {
    session = {
      axis: null,
      timer: null,
    };
    activeSessions.set(el, session);
  }
  return session;
}

/**
 * Finds the scrollable container belonging to a table component
 */
export function findTableScrollContainer(target: EventTarget | null): HTMLElement | null {
  if (!target || !(target instanceof HTMLElement)) return null;

  // 1. Explicitly tagged container
  const explicit = target.closest<HTMLElement>('.table-scroll-container, [data-table-scroll="true"]');
  if (explicit) return explicit;

  // 2. Target is inside a table
  const table = target.closest('table');
  if (table) {
    let parent = table.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      if (isScrollable(parent)) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return table.parentElement;
  }

  // 3. Target is the container that houses a table
  let cur: HTMLElement | null = target;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    if (cur.querySelector('table') && isScrollable(cur)) {
      return cur;
    }
    cur = cur.parentElement;
  }

  return null;
}

function isScrollable(el: HTMLElement): boolean {
  if (el.classList.contains('table-scroll-container') || el.hasAttribute('data-table-scroll')) {
    return true;
  }
  const ox = el.style.overflowX;
  const oy = el.style.overflowY;
  if (['auto', 'scroll'].includes(ox) || ['auto', 'scroll'].includes(oy)) return true;

  const hasClass =
    el.classList.contains('overflow-auto') ||
    el.classList.contains('overflow-x-auto') ||
    el.classList.contains('overflow-y-auto');
  if (hasClass) return true;

  if (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) {
    return true;
  }

  return false;
}

/**
 * Cascades unconsumed vertical scroll delta to the nearest scrollable ancestor (or window)
 */
function cascadeScrollToParent(el: HTMLElement, deltaY: number) {
  let parent = el.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
      const prev = parent.scrollTop;
      parent.scrollTop += deltaY;
      if (parent.scrollTop !== prev) {
        return;
      }
    }
    parent = parent.parentElement;
  }
  // Default to global window scroll if no scrollable parent absorbed it
  window.scrollBy({ top: deltaY, behavior: 'instant' as ScrollBehavior });
}

/**
 * Global wheel handler for single-axis table scroll locking on desktop / trackpad
 */
function handleTableWheel(e: WheelEvent) {
  const container = findTableScrollContainer(e.target);
  if (!container) return;

  const canScrollX = container.scrollWidth > container.clientWidth;
  const canScrollY = container.scrollHeight > container.clientHeight;

  // If container cannot scroll at all, let event proceed
  if (!canScrollX && !canScrollY) return;

  const session = getSession(container);

  // Normalize wheel deltas across lines, pages, and pixel modes
  let deltaX = e.deltaX;
  let deltaY = e.deltaY;
  if (e.deltaMode === 1) {
    // DOM_DELTA_LINE
    deltaX *= 28;
    deltaY *= 28;
  } else if (e.deltaMode === 2) {
    // DOM_DELTA_PAGE
    deltaX *= container.clientWidth;
    deltaY *= container.clientHeight;
  }

  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  // Determine or update 1D scroll axis lock
  if (!session.axis) {
    if (absX > absY) {
      session.axis = 'x';
    } else {
      session.axis = 'y';
    }
  } else if (session.axis === 'y' && absX > absY * 3 && absX > 12) {
    // Intentional sharp direction switch from vertical to horizontal
    session.axis = 'x';
  } else if (session.axis === 'x' && absY > absX * 3 && absY > 12) {
    // Intentional sharp direction switch from horizontal to vertical
    session.axis = 'y';
  }

  // Reset lock after 120ms of no wheel activity (natural gesture end)
  if (session.timer) clearTimeout(session.timer);
  session.timer = setTimeout(() => {
    session.axis = null;
  }, 120);

  if (session.axis === 'x') {
    if (!canScrollX) return;
    // Strictly horizontal scrolling: eliminate vertical drift & contain scroll
    e.preventDefault();
    e.stopPropagation();
    container.scrollLeft += deltaX;
  } else if (session.axis === 'y') {
    if (!canScrollY) {
      // Container has no vertical overflow room; allow outer page/modal to scroll seamlessly
      return;
    }

    const isAtTop = container.scrollTop <= 0;
    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;

    // If scrolling up while already at top, or scrolling down while already at bottom:
    // Seamlessly hand off to outer page without requiring the user to move cursor outside table!
    if ((deltaY < 0 && isAtTop) || (deltaY > 0 && isAtBottom)) {
      session.axis = null;
      return;
    }

    // Container can absorb scroll: eliminate horizontal drift and scroll table
    const prevScrollTop = container.scrollTop;
    container.scrollTop += deltaY;
    const scrollConsumed = container.scrollTop - prevScrollTop;
    const unconsumedDeltaY = deltaY - scrollConsumed;

    e.preventDefault();

    // If gesture hit the boundary on this tick with leftover momentum, cascade remainder to parent/window
    if (Math.abs(unconsumedDeltaY) > 0.5) {
      if ((unconsumedDeltaY < 0 && container.scrollTop <= 0) || (unconsumedDeltaY > 0 && container.scrollTop + container.clientHeight >= container.scrollHeight - 1)) {
        cascadeScrollToParent(container, unconsumedDeltaY);
      }
    }
  }
}

interface TouchSession {
  startX: number;
  startY: number;
  lastY: number;
  axis: 'x' | 'y' | null;
  container: HTMLElement | null;
}

let activeTouch: TouchSession | null = null;

function handleTableTouchStart(e: TouchEvent) {
  if (e.touches.length !== 1) {
    activeTouch = null;
    return;
  }
  const container = findTableScrollContainer(e.target);
  if (!container) return;
  activeTouch = {
    startX: e.touches[0].clientX,
    startY: e.touches[0].clientY,
    lastY: e.touches[0].clientY,
    axis: null,
    container,
  };
}

function handleTableTouchMove(e: TouchEvent) {
  if (!activeTouch || !activeTouch.container) return;
  const container = activeTouch.container;
  const touch = e.touches[0];
  const curX = touch.clientX;
  const curY = touch.clientY;
  const diffX = curX - activeTouch.startX;
  const diffY = curY - activeTouch.startY;
  const stepY = curY - activeTouch.lastY;
  activeTouch.lastY = curY;

  const canScrollX = container.scrollWidth > container.clientWidth;
  const canScrollY = container.scrollHeight > container.clientHeight;

  // If container only scrolls horizontally, native browser handles horizontal table scroll
  // and vertical window scroll with zero interference
  if (canScrollX && !canScrollY) return;

  if (!activeTouch.axis) {
    if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
      activeTouch.axis = Math.abs(diffX) > Math.abs(diffY) ? 'x' : 'y';
    }
  }

  // If locked to vertical gesture:
  if (activeTouch.axis === 'y') {
    const isAtTop = container.scrollTop <= 0;
    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;

    // If swiping down while at top (stepY > 0) or swiping up while at bottom (stepY < 0):
    // Cascade scroll to window so page scrolls and user is not trapped!
    if ((stepY > 0 && isAtTop) || (stepY < 0 && isAtBottom)) {
      window.scrollBy({ top: -stepY, behavior: 'instant' });
    }
  }
}

function handleTableTouchEnd() {
  activeTouch = null;
}

let isInitialized = false;

/**
 * Initializes global event listeners to lock table components to 1D scroll axis.
 * Supports trackpad/mouse wheel on desktop and touch gestures on mobile devices.
 */
export function initTableScrollLocker() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // Trackpad / Wheel listener (Desktop)
  window.addEventListener('wheel', handleTableWheel, { passive: false, capture: true });

  // Touch listeners (Mobile & Touch screens)
  window.addEventListener('touchstart', handleTableTouchStart, { passive: true, capture: true });
  window.addEventListener('touchmove', handleTableTouchMove, { passive: true, capture: true });
  window.addEventListener('touchend', handleTableTouchEnd, { passive: true, capture: true });
  window.addEventListener('touchcancel', handleTableTouchEnd, { passive: true, capture: true });
}
