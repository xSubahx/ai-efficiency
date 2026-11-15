/**
 * Off-peak — styles for the menu row, the composer control, and the settings
 * row. Theme tokens only.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

const CSS = `
.ofp-switch, .ofp-send {
  /* The themed brand accent, with a static fallback so a renamed token keeps the hue. */
  --ofp-accent: var(--dsw-alias-brand-primary-new-colorprimary-new-color, rgb(65, 118, 230));
}

/* ---- model-menu row ---------------------------------------------------- */
.ofp-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 40px;
  padding: 4px 8px;
  border-radius: var(--dsw-radius-md);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}
.ofp-rowText { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.ofp-rowLabel { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
.ofp-rowState { font-size: 11px; line-height: 15px; color: var(--dsw-alias-label-tertiary); }
.ofp-rowState[data-tone=peak] { color: var(--dsw-alias-state-warn-primary); }
.ofp-rowState[data-tone=off] { color: var(--dsw-alias-label-caption); }
.ofp-row:has(.ofp-switch:focus-visible) { background: var(--dsw-alias-interactive-bg-hover); }
@media (hover: hover) {
  .ofp-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
}

/* ---- switch ------------------------------------------------------------ */
.ofp-switch {
  position: relative;
  flex: none;
  width: 30px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 9px;
  background: var(--dsw-alias-border-l2);
  cursor: pointer;
  transition: background .12s ease;
}
.ofp-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 1px 2px rgb(0 0 0 / 25%);
  transition: transform .12s ease;
}
.ofp-switch[aria-checked=true] { background: var(--ofp-accent); }
.ofp-switch[aria-checked=true]::after { transform: translateX(12px); }
.ofp-switch:focus-visible { outline: 2px solid var(--ofp-accent); outline-offset: 2px; }
.ofp-switch:disabled { opacity: .5; cursor: default; }

/* ---- composer control -------------------------------------------------- */
.ofp-send {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: var(--dsw-radius-md);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
}
.ofp-send:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.ofp-send:focus-visible { outline: 2px solid var(--ofp-accent); outline-offset: 1px; }
.ofp-send:disabled { opacity: .55; cursor: default; }
.ofp-send:disabled:hover { background: transparent; color: var(--dsw-alias-label-secondary); }
.ofp-send[data-tone=queued] { color: var(--dsw-alias-state-success-primary); }
.ofp-send[data-tone=error] { color: var(--dsw-alias-state-error-primary); }
.ofp-sendGlyph { flex: none; display: inline-flex; }

/* ---- settings row ------------------------------------------------------ */
.ofp-settings {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}
.ofp-settingsText { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding-right: 48px; }
@media (max-width: 767px) { .ofp-settingsText { padding-right: 16px; } }
.ofp-title { font-size: 14px; font-weight: 400; line-height: 22px; color: var(--dsw-alias-label-primary); }
.ofp-desc { font-size: 12px; font-weight: 400; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.ofp-status { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.ofp-status[data-tone=peak] { color: var(--dsw-alias-state-warn-primary); }
.ofp-settingsControl { display: inline-flex; align-items: center; gap: 8px; flex: none; }
.ofp-settingsValue { font-size: 12px; color: var(--dsw-alias-label-secondary); min-width: 22px; text-align: right; }
`
