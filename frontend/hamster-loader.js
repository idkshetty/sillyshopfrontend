const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** Animated hamster-in-wheel loader markup with scoped classes. */
export function hamsterLoaderMarkup({ label = 'Loading…', size = 'md', caption = '' } = {}) {
  const cleanSize = ['sm', 'md', 'lg'].includes(size) ? size : 'md';
  return `<div class="hehe-hamster-loader is-${cleanSize}" role="status" aria-live="polite" aria-label="${esc(label)}">
    <div class="hehe-wheel-and-hamster" aria-hidden="true">
      <div class="hehe-wheel"></div>
      <div class="hehe-hamster">
        <div class="hehe-hamster__body">
          <div class="hehe-hamster__head">
            <div class="hehe-hamster__ear"></div>
            <div class="hehe-hamster__eye"></div>
            <div class="hehe-hamster__nose"></div>
          </div>
          <div class="hehe-hamster__limb hehe-hamster__limb--fr"></div>
          <div class="hehe-hamster__limb hehe-hamster__limb--fl"></div>
          <div class="hehe-hamster__limb hehe-hamster__limb--br"></div>
          <div class="hehe-hamster__limb hehe-hamster__limb--bl"></div>
          <div class="hehe-hamster__tail"></div>
        </div>
      </div>
      <div class="hehe-spoke"></div>
    </div>
    ${caption ? `<span class="hehe-hamster-caption">${esc(caption)}</span>` : ''}
  </div>`;
}
