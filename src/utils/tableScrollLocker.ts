/**
 * Utility to enforce strict 1-Dimensional (1D) axis scrolling on all table components.
 * - Prevents diagonal scrolling (trackpad/touch simultaneously scrolling both X and Y).
 * - Prevents scroll chaining / leaking to outer parent modals or the entire page ("scroll ke semuanya").
 * - Locks each gesture to strictly Horizontal OR strictly Vertical.
 */

interface ScrollLockSession {
  axis: 'x' | 'y' | null;
  timer: any;
  touchStartX: number;
  touchStartY: number;
  initialScrollLeft: number;
  initialScrollTop: number;
}

const activeSessions = new WeakMap<HTMLElement, ScrollLockSession>();

function getSession(el: HTMLElement): ScrollLockSession {
  let session = activeSessions.get(el);
  if (!session) {
    session = {
      axis: null,
      timer: null,
      touchStartX: 0,
      touchStartY: 0,
      initialScrollLeft: 0,
      initialScrollTop: 0,
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
  const style = window.getComputedStyle(el);
  const ox = style.overflowX;
  const oy = style.overflowY;
  const isScroll = ['auto', 'scroll'].includes(ox) || ['auto', 'scroll'].includes(oy);
  const hasClass =
    el.classList.contains('overflow-auto') ||
    el.classList.contains('overflow-x-auto') ||
    el.classList.contains('overflow-y-auto');

  return isScroll || hasClass;
}

/**
 * Global wheel handler for single-axis table scroll locking
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
    if (!canScrollY) return;
    // Strictly vertical scrolling: eliminate horizontal drift & contain scroll
    e.preventDefault();
    e.stopPropagation();
    container.scrollTop += deltaY;
  }
}

/**
 * Touch start handler to prepare 1D gesture tracking on mobile/touch screens
 */
function handleTableTouchStart(e: TouchEvent) {
  if (e.touches.length !== 1) return;
  const container = findTableScrollContainer(e.target);
  if (!container) return;

  const session = getSession(container);
  session.axis = null;
  session.touchStartX = e.touches[0].clientX;
  session.touchStartY = e.touches[0].clientY;
  session.initialScrollLeft = container.scrollLeft;
  session.initialScrollTop = container.scrollTop;
}

/**
 * Touch move handler to lock touch pan to strictly 1 axis (X or Y, never diagonal)
 */
function handleTableTouchMove(e: TouchEvent) {
  if (e.touches.length !== 1) return;
  const container = findTableScrollContainer(e.target);
  if (!container) return;

  const canScrollX = container.scrollWidth > container.clientWidth;
  const canScrollY = container.scrollHeight > container.clientHeight;
  if (!canScrollX && !canScrollY) return;

  const session = getSession(container);
  const touch = e.touches[0];
  const diffX = touch.clientX - session.touchStartX;
  const diffY = touch.clientY - session.touchStartY;
  const absX = Math.abs(diffX);
  const absY = Math.abs(diffY);

  // Establish lock once small gesture threshold is passed (5px)
  if (!session.axis) {
    if (absX < 5 && absY < 5) return;
    session.axis = absX >= absY ? 'x' : 'y';
  }

  if (session.axis === 'x') {
    if (!canScrollX) return;
    // Prevent diagonal motion & stop scroll propagation to modal/body
    e.preventDefault();
    e.stopPropagation();
    container.scrollLeft = session.initialScrollLeft - diffX;
  } else if (session.axis === 'y') {
    if (!canScrollY) return;
    // Prevent diagonal motion & stop scroll propagation to modal/body
    e.preventDefault();
    e.stopPropagation();
    container.scrollTop = session.initialScrollTop - diffY;
  }
}

/**
 * Touch end/cancel handler to reset touch lock
 */
function handleTableTouchEnd(e: TouchEvent) {
  const container = findTableScrollContainer(e.target);
  if (!container) return;
  const session = getSession(container);
  session.axis = null;
}

let isInitialized = false;

/**
 * Initializes global event listeners to lock all table components to 1D scroll axis.
 * Can be called once at application startup.
 */
export function initTableScrollLocker() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // Use capture phase and non-passive listener to intercept before browser native 2D scroll
  window.addEventListener('wheel', handleTableWheel, { passive: false, capture: true });
  window.addEventListener('touchstart', handleTableTouchStart, { passive: true, capture: true });
  window.addEventListener('touchmove', handleTableTouchMove, { passive: false, capture: true });
  window.addEventListener('touchend', handleTableTouchEnd, { passive: true, capture: true });
  window.addEventListener('touchcancel', handleTableTouchEnd, { passive: true, capture: true });
}
