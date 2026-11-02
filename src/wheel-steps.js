// Pixel deltas from the Magic Remote wheel are uneven, so the wheel is turned
// into discrete notches before anything acts on it. Kept pure so it can be
// tested without a TV.
//
// 100 matches one physical notch on the LG wheel (deltaY is typically 100-120);
// anything much smaller makes one notch skip several channels.
export const WHEEL_STEP = 100;

// Normalize a wheel event to "pixels scrolled down is positive".
export function normalizeWheel(event) {
  if (!event) return 0;
  if (typeof event.deltaY === 'number' && event.deltaY !== 0) {
    // deltaMode: 0 = pixel, 1 = line, 2 = page
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
    return event.deltaY * scale;
  }
  // Legacy `mousewheel`: positive wheelDelta means scrolling up.
  if (typeof event.wheelDelta === 'number') return -event.wheelDelta;
  return 0;
}

// How many whole notches this delta completes, and what is left over for the
// next event. Truncates toward zero so a fast spin cannot overshoot, and drops
// leftover movement when the user reverses direction (otherwise a half notch one
// way silently swallows the first notch the other way).
export function consumeWheel(accumulated, deltaY, step = WHEEL_STEP) {
  const carried = accumulated && Math.sign(accumulated) !== Math.sign(deltaY) ? 0 : accumulated;
  const total = carried + deltaY;
  const notches = Math.trunc(total / step);
  return { notches, rest: total - notches * step };
}

// Volume step the player applies per key press, and how many presses a notch is
// worth. Two presses feel like one notch without being able to jump to an extreme.
const VOLUME_PRESSES = 2;
const VOLUME_MAX_PRESSES = 6;
const VOLUME_STEP = 0.05;
const VOLUME_MAX_NOTCHES = 3;

// What a notch should do in the current screen. Channel changes belong to the
// left/right buttons, so watching adjusts volume and the guide moves its highlight.
export function wheelAction({ notches, watching, guideOpen, dialogOpen }) {
  if (!notches || dialogOpen) return null;
  const key = notches > 0 ? 'ArrowDown' : 'ArrowUp';   // scrolling down is quieter
  if (watching) {
    const capped = Math.max(-VOLUME_MAX_NOTCHES, Math.min(VOLUME_MAX_NOTCHES, notches));
    return {
      kind: 'volume', key,
      count: Math.min(VOLUME_MAX_PRESSES, Math.abs(capped) * VOLUME_PRESSES),
      step: -VOLUME_STEP * capped      // scrolling down is quieter
    };
  }
  if (guideOpen) return { kind: 'guide', key };
  return null;
}
