/**
 * Async — the panel's stylesheet. Theme tokens only; no literal colors except
 * the artwork tones derived from state tokens.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

const CSS = `
.asx-root {
  /* The themed brand accent (blue) and the ink token, with static fallbacks so
     a renamed token degrades to the same hue instead of a transparent accent. */
  --asx-accent: var(--dsw-alias-brand-primary-new-colorprimary-new-color, rgb(65, 118, 230));
  --asx-ink: var(--dsw-alias-label-primary);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.45;
}
.asx-root *, .asx-root *::before, .asx-root *::after { box-sizing: border-box; }

.asx-head {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: calc(var(--dsh-frame-top-clearance, 0px) + 20px) 24px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  flex: 0 0 auto;
}
.asx-headText { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.asx-title { display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
.asx-subs { display: flex; align-items: center; gap: 10px; color: var(--dsw-alias-label-secondary); font-size: 12px; flex-wrap: wrap; }
.asx-dotSep { width: 3px; height: 3px; border-radius: 50%; background: currentColor; opacity: .5; }
.asx-headTools { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }

.asx-seg {
  display: inline-flex;
  padding: 2px;
  gap: 2px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
}
.asx-segBtn {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.asx-segBtn[data-on=true] {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 1px 2px rgb(0 0 0 / 18%);
}
.asx-segBtn:hover { color: var(--dsw-alias-label-primary); }
.asx-segBtn:focus-visible { outline: 2px solid var(--asx-accent); outline-offset: 1px; }

.asx-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 12px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 7px;
  padding: 5px 10px;
  cursor: pointer;
  white-space: nowrap;
}
.asx-btn:hover { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); }
.asx-btn:disabled { opacity: .5; cursor: default; }
.asx-btn:focus-visible { outline: 2px solid var(--asx-accent); outline-offset: 1px; }
.asx-btnPrimary {
  background: var(--dsw-alias-button-primary-fill);
  border-color: transparent;
  color: var(--dsw-alias-label-primary-foreground);
  font-weight: 550;
}
.asx-btnPrimary:hover { background: var(--dsw-alias-button-primary-fill); border-color: transparent; filter: brightness(1.04); }
.asx-btnGhost { background: transparent; border-color: transparent; color: var(--dsw-alias-label-secondary); padding: 4px 7px; }
.asx-btnGhost:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); border-color: transparent; }
.asx-btnDanger { color: var(--dsw-alias-state-error-primary); }
.asx-btn[data-armed=true] { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }

.asx-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  flex: 0 0 auto;
  flex-wrap: wrap;
}
.asx-chips { display: inline-flex; gap: 4px; flex-wrap: wrap; }
.asx-chip {
  appearance: none;
  font: inherit;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 2px 9px;
  cursor: pointer;
}
.asx-chip:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
.asx-chip[data-on=true] {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-border-l2);
}
.asx-chip:focus-visible { outline: 2px solid var(--asx-accent); outline-offset: 1px; }
.asx-spacer { flex: 1; }

.asx-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 24px 0;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 12px;
  border: 1px solid var(--dsw-alias-state-error-primary);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  flex: 0 0 auto;
}
.asx-banner[data-tone=ok] { border-color: var(--dsw-alias-state-success-primary); }
.asx-bannerText { flex: 1; min-width: 0; }

.asx-board {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 14px 24px 18px;
  overflow: hidden;
}
@media (max-width: 1080px) { .asx-board { grid-template-columns: repeat(2, minmax(0, 1fr)); overflow-y: auto; } }

.asx-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}
.asx-colHead {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 12px 7px;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.asx-colName { font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
.asx-count {
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  padding: 0 6px;
  min-width: 18px;
  text-align: center;
}
.asx-colDot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); flex: 0 0 auto; }
.asx-col[data-tone=upcoming] .asx-colDot { background: var(--asx-accent); }
.asx-col[data-tone=running] .asx-colDot { background: var(--dsw-alias-state-success-primary); }
.asx-col[data-tone=needs] .asx-colDot { background: var(--dsw-alias-state-warn-primary); }
.asx-col[data-tone=needs] { border-color: var(--dsw-alias-state-warn-primary); }
.asx-col[data-tone=settled] .asx-colDot { background: var(--dsw-alias-state-idle-primary); }

.asx-cards { flex: 1; min-height: 0; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 7px; }
.asx-cards::-webkit-scrollbar { width: 8px; }
.asx-cards::-webkit-scrollbar-thumb { background: var(--dsw-alias-border-l2); border-radius: 4px; }
.asx-colEmpty {
  padding: 14px 12px;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  text-align: center;
  border: 1px dashed var(--dsw-alias-border-l1);
  border-radius: 9px;
}

.asx-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 10px 8px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
  cursor: default;
  transition: border-color .12s ease, background .12s ease;
}
.asx-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 2px;
  background: var(--dsw-alias-state-idle-primary);
  opacity: .7;
}
.asx-card[data-tone=upcoming]::before { background: var(--asx-accent); }
.asx-card[data-tone=running]::before { background: var(--dsw-alias-state-success-primary); }
.asx-card[data-tone=needs]::before { background: var(--dsw-alias-state-warn-primary); }
.asx-card[data-tone=failed]::before { background: var(--dsw-alias-state-error-primary); }
.asx-card:hover { border-color: var(--dsw-alias-border-l2); }
.asx-card[data-selected=true] {
  border-color: var(--asx-accent);
  box-shadow: 0 0 0 1px var(--asx-accent);
}
.asx-card[data-state=running] { background: var(--dsw-alias-bg-layer-2); }

.asx-cardTop { display: flex; align-items: flex-start; gap: 6px; min-width: 0; }
.asx-glyph { flex: 0 0 auto; display: inline-flex; color: var(--dsw-alias-label-secondary); margin-top: 1px; }
.asx-card[data-tone=running] .asx-glyph { color: var(--dsw-alias-state-success-primary); }
.asx-card[data-tone=needs] .asx-glyph { color: var(--dsw-alias-state-warn-primary); }
.asx-card[data-tone=upcoming] .asx-glyph { color: var(--asx-accent); }
.asx-cardTitle {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 550;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.asx-sub { font-size: 11px; color: var(--dsw-alias-label-secondary); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.asx-timeRow { display: flex; align-items: baseline; gap: 6px; font-size: 11px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.asx-timeStrong { color: var(--dsw-alias-label-primary); }
.asx-card[data-tone=needs] .asx-timeStrong { color: var(--dsw-alias-state-warn-primary); }

.asx-badges { display: flex; flex-wrap: wrap; gap: 4px; }
.asx-badge {
  font-size: 10px;
  line-height: 1.5;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.asx-badge[data-kind=local] { color: var(--asx-accent); border-color: var(--asx-accent); }
.asx-badge[data-kind=native] { color: var(--dsw-alias-label-primary); }
.asx-badge[data-kind=needs] { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }
.asx-badge[data-kind=failed] { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
.asx-badge[data-kind=done] { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
.asx-badge[data-kind=child] { font-style: italic; }

.asx-ribbon { position: relative; height: 16px; border-radius: 4px; background: var(--dsw-alias-bg-base); overflow: hidden; border: 1px solid var(--dsw-alias-border-l1); }
.asx-ribbonBase { position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: var(--dsw-alias-border-l2); }
.asx-mark { position: absolute; top: 3px; bottom: 3px; width: 2px; border-radius: 1px; background: var(--dsw-alias-state-idle-primary); transform: translateX(-1px); }
.asx-mark[data-solid=true] { background: var(--dsw-alias-state-success-primary); }
.asx-mark[data-solid=false] { background: var(--asx-accent); opacity: .9; }
.asx-markNow { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--dsw-alias-label-secondary); opacity: .55; }
.asx-bar { position: absolute; top: 5px; height: 6px; border-radius: 3px; background: var(--dsw-alias-state-success-primary); opacity: .75; }
.asx-bar[data-open=true] { border-radius: 3px 0 0 3px; }

.asx-team { display: flex; flex-direction: column; gap: 2px; padding-top: 2px; border-top: 1px dashed var(--dsw-alias-border-l1); margin-top: 1px; }
.asx-teamRow { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--dsw-alias-label-secondary); min-width: 0; }
.asx-teamRow span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.asx-teamDot { width: 5px; height: 5px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); flex: 0 0 auto; }
.asx-teamDot[data-s=in_progress] { background: var(--dsw-alias-state-success-primary); }
.asx-teamDot[data-s=pending] { background: var(--dsw-alias-state-warn-primary); }

.asx-actions { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; opacity: 0; transition: opacity .1s ease; }
.asx-card:hover .asx-actions, .asx-card:focus-within .asx-actions, .asx-card[data-selected=true] .asx-actions { opacity: 1; }
.asx-action { font-size: 11px; padding: 2px 6px; border-radius: 5px; }
.asx-actions .asx-btnGhost { color: var(--dsw-alias-label-secondary); }
.asx-actions .asx-btnGhost:hover { color: var(--dsw-alias-label-primary); }

.asx-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--dsw-alias-label-secondary); font-size: 12.5px; padding: 30px; text-align: center; }

.asx-createHead { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; }
.asx-createHead .asx-titleText { font-size: 12.5px; font-weight: 600; }
.asx-create { padding: 12px 24px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); flex: 0 0 auto; }
.asx-createGrid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px 12px; }
@media (max-width: 1080px) { .asx-createGrid { grid-template-columns: 1fr 1fr; } }
.asx-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.asx-field.asx-span-1 { grid-column: span 1; }
.asx-field.asx-span-2 { grid-column: span 2; }
.asx-field.asx-span-3 { grid-column: 1 / -1; }
.asx-label { font-size: 10.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
.asx-input, .asx-textarea, .asx-select {
  font: inherit;
  font-size: 12.5px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 7px;
  padding: 6px 8px;
  min-width: 0;
  width: 100%;
}
.asx-textarea { resize: vertical; min-height: 58px; line-height: 1.4; }
.asx-input:focus, .asx-textarea:focus, .asx-select:focus { outline: 2px solid var(--asx-accent); outline-offset: -1px; border-color: transparent; }
.asx-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.asx-note { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.asx-createFoot { display: flex; align-items: center; gap: 8px; margin-top: 10px; }

.asx-tl { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 0 24px 16px; }
.asx-tlBar { display: flex; align-items: center; gap: 8px; padding: 10px 0; flex-wrap: wrap; }
.asx-tlNote { font-size: 11px; color: var(--dsw-alias-label-secondary); padding-bottom: 8px; }
.asx-tlScroll { flex: 1; min-height: 0; overflow: auto; border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); }
.asx-tl:focus-within .asx-tlScroll { border-color: var(--dsw-alias-border-l2); }
.asx-tlGrid { position: relative; min-width: 640px; }
.asx-tlHead { position: sticky; top: 0; z-index: 2; display: flex; height: 26px; background: var(--dsw-alias-bg-layer-1); border-bottom: 1px solid var(--dsw-alias-border-l1); }
.asx-tlGutter { flex: 0 0 190px; width: 190px; padding: 0 10px; display: flex; align-items: center; font-size: 11px; color: var(--dsw-alias-label-secondary); overflow: hidden; }
.asx-tlTrack { position: relative; flex: 1 1 auto; min-width: 0; }
.asx-tlTick { position: absolute; top: 0; bottom: 0; border-left: 1px solid var(--dsw-alias-border-l1); }
.asx-tlTickLabel { position: absolute; top: 5px; left: 4px; font-size: 10px; color: var(--dsw-alias-label-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
.asx-tlLane { display: flex; align-items: stretch; min-height: 26px; border-top: 1px solid var(--dsw-alias-border-l1); }
.asx-tlLaneHead { display: flex; align-items: center; gap: 8px; flex: 0 0 190px; width: 190px; padding: 4px 10px; background: var(--dsw-alias-bg-layer-1); border-right: 1px solid var(--dsw-alias-border-l1); }
.asx-tlLaneHead .asx-count { margin-left: auto; }
.asx-tlLaneTitle { font-size: 10.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
.asx-tlRow { display: flex; align-items: stretch; min-height: 28px; border-top: 1px solid var(--dsw-alias-border-l1); cursor: pointer; }
.asx-tlRow:hover { background: var(--dsw-alias-bg-layer-2); }
.asx-tlRow[data-selected=true] { background: var(--dsw-alias-bg-layer-2); box-shadow: inset 2px 0 var(--asx-accent); }
.asx-tlRowHead { flex: 0 0 190px; width: 190px; padding: 0 10px; display: flex; align-items: center; gap: 6px; border-right: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); min-width: 0; }
.asx-tlRow[data-selected=true] .asx-tlRowHead { background: var(--dsw-alias-bg-layer-2); }
.asx-tlRowName { font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.asx-tlRowMeta { font-size: 10px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.asx-tlSvg { position: absolute; inset: 0; }
.asx-tlBlocks { position: absolute; inset: 0; }
.asx-tlBlock { position: absolute; top: 9px; height: 10px; border-radius: 3px; background: var(--asx-accent); opacity: .9; min-width: 2px; }
.asx-tlBlock[data-past=true] { background: var(--dsw-alias-state-success-primary); opacity: .55; }
.asx-tlBlock[data-past=open] { background: var(--dsw-alias-state-success-primary); opacity: .95; }
.asx-tlBlock[data-open=true] { border-radius: 3px 0 0 3px; }
.asx-tlSpan { position: absolute; top: 12px; height: 3px; border-radius: 2px; background: var(--dsw-alias-border-l2); }
.asx-tlNow { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--dsw-alias-label-secondary); opacity: .7; z-index: 1; }
.asx-tlHead .asx-tlNow::after { content: ''; position: absolute; top: -1px; left: -2px; width: 5px; height: 5px; border-radius: 50%; background: var(--dsw-alias-label-secondary); }
.asx-tlEmpty { padding: 34px 20px; text-align: center; color: var(--dsw-alias-label-secondary); font-size: 12px; }

.asx-glyphSpin { animation: asx-spin 1s linear infinite; transform-origin: center; }
@keyframes asx-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .asx-glyphSpin { animation: none; } }
`
