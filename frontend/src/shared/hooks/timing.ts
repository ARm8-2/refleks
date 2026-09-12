/**
 * How long a component must stay visible before its entrance animation starts.
 *
 * The short delay lets a component settle after being focused or scrolled into
 * view, so quickly passing it by does not trigger a burst of animation, while
 * still feeling immediate. Shared by every reveal-driven animation so the
 * overall pacing can be tuned in one place.
 */
export const REVEAL_DELAY_MS = 50;
