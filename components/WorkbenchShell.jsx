'use client';
import { Button } from '@base-ui/react/button';
import { LibraryPanel } from './LibraryPanel';

// React owns the shell. The editor controller owns children of its empty canvas/tree/inspector slots.
export function WorkbenchShell() {
  return <>
<header className="bar">
  <h1>ICONERD</h1><a className="lbl credits-link" href="/third-party-notices.txt" target="_blank" rel="noreferrer">Credits</a>
  <span className="glyph-name mono" id="hdrName"></span>
  <span className="glyph-tag" id="hdrProv"></span><Button className="glyph-tag edited" id="hdrEdited" hidden aria-label="Scrub edit history" aria-haspopup="dialog" aria-controls="historyPalette" aria-expanded="false">edited</Button>
  <div id="historyPalette" className="floating-panel history-palette" role="dialog" aria-label="Edit history" hidden>
    <h2>Edit history</h2><p>This icon’s edit history · drag left to go back.</p>
    <label className="lbl" htmlFor="historyScrubber">History position</label>
    <input id="historyScrubber" type="range" min="0" max="0" step="1" defaultValue="0" />
    <div className="history-ends"><span>Oldest retained</span><span>Latest</span></div>
    <output id="historyPosition" htmlFor="historyScrubber"></output>
    <p className="history-note">Stopping keeps this state. A new edit replaces later states for this icon.</p>
  </div>
  <span className="spacer"></span>
  <label className="lbl" htmlFor="drawingMode">Drawing mode</label><select id="drawingMode" defaultValue="interface"><option value="interface">Interface icons</option><option value="app-icon">App icons</option></select>
  <label className="lbl" htmlFor="exportSize">Export px</label><input id="exportSize" type="number" min="16" max="4096" step="1" defaultValue="24" />
  <span className="lbl" id="modeHint"></span>
  <span className="save-state" id="saveState" role="status" aria-live="polite" data-state="saved">Saved</span>
  <Button className="btn sm" id="revertBtn" title="Put this glyph back to its library original (undo brings your edit back)" data-icon-ui="undo">Reset icon</Button>
  <div className="seg" role="group" aria-label="History">
    <Button className="btn sm icon" id="undoBtn" title="Undo (⌘Z)" aria-label="Undo" data-icon-ui="undo"></Button>
    <Button className="btn sm icon" id="redoBtn" title="Redo (⇧⌘Z)" aria-label="Redo" data-icon-ui="redo"></Button>
  </div>
  <div className="seg" role="group" aria-label="Theme">
    <Button className="btn sm icon" data-theme-choice="light" title="Light theme" aria-label="Light theme" data-icon-ui="sun"></Button>
    <Button className="btn sm icon" data-theme-choice="dark" title="Dark theme" aria-label="Dark theme" data-icon-ui="theme"></Button>
    <Button className="btn sm icon" id="appearanceToggle" title="Customize appearance" aria-label="Customize appearance" aria-haspopup="dialog" aria-controls="appearancePalette" aria-expanded="false">▾</Button>
  </div>
  <div id="appearancePalette" className="floating-panel appearance-palette" role="dialog" aria-label="Customize appearance" hidden>
    <h2 id="appearanceTheme">Appearance</h2><p>Colors and opacity (%) for this theme.</p>
    <div id="appearanceFields"></div><Button className="btn sm" id="resetAppearance">Reset this theme</Button>
  </div>
</header>

<main className="app">
  {/* LEFT: library, shapes, layer / boolean tree */}
  <div className="col-left">
    <LibraryPanel />
    <details className="panel set-settings" open>
      <summary>Set settings</summary>
      <div className="pad set-settings-fields">
        <label><input id="setThicknessEnabled" type="checkbox" /> Override thickness</label>
        <label htmlFor="setThickness">Thickness <input id="setThickness" type="number" min="0.1" max="8" step="0.1" defaultValue="1.6" /></label>
        <label><input id="setRoundingEnabled" type="checkbox" /> Round corners</label>
        <label htmlFor="setRounding">Corner radius <input id="setRounding" type="number" min="0" max="6" step="0.1" defaultValue="0.5" /></label>
        <label><input id="setEndRoundingEnabled" type="checkbox" /> Round line ends</label>
        <label htmlFor="setEndRounding">End radius <input id="setEndRounding" type="number" min="0" max="6" step="0.1" defaultValue="0.5" /></label>
        <span className="lbl">Applies to the whole library. Source shapes remain editable.</span>
      </div>
    </details>
    <details className="panel shortcut-settings"><summary>Keyboard shortcuts</summary><div className="pad"><p className="lbl">Click a field and press a key combination. Mod means Cmd on Mac or Ctrl on Windows.</p><div id="shortcutFields"></div><Button className="btn sm" id="resetShortcuts">Restore defaults</Button></div></details>
    <section className="panel" aria-labelledby="palH">
      <h2 id="palH">Shapes</h2>
      <div className="palette" id="palette"></div>
    </section>
    <section className="panel" aria-labelledby="treeH">
      <h2 id="treeH">Layers <span className="h-actions"><Button className="btn sm" id="addLayerBtn" aria-label="Add layer" data-icon-ui="plus-outline">Layer</Button></span></h2>
      <div className="tree" id="tree" role="tree" aria-label="Layers and booleans"></div>
      <div className="tree-tools">
        <Button className="btn sm icon" data-group="union" aria-label="Union" data-control-tooltip="Union: combine selected shapes" title="Group selection into union (⌘G)" data-icon-ui="union"></Button>
        <Button className="btn sm icon" data-group="subtract" aria-label="Subtract" data-control-tooltip="Subtract: first shape minus the rest" title="First minus the rest: later children become cutters" data-icon-ui="subtract"></Button>
        <Button className="btn sm icon" data-group="intersect" aria-label="Intersect" data-control-tooltip="Intersect: keep only the overlap" data-icon-ui="intersect"></Button>
        <Button className="btn sm icon" data-group="exclude" aria-label="Exclude" data-control-tooltip="Exclude: remove the overlap" data-icon-ui="exclude"></Button>
        <Button className="btn sm" id="ungroupBtn" data-icon-ui="ungroup">Ungroup</Button>
        <Button className="btn sm" id="makeCutterBtn" data-icon-ui="cutter">Use as cutter</Button>
        <Button className="btn sm icon" id="upBtn" title="Move up" aria-label="Move up" data-icon-ui="up"></Button>
        <Button className="btn sm icon" id="downBtn" title="Move down" aria-label="Move down" data-icon-ui="down"></Button>
        <Button className="btn sm" id="dupBtn" title="Duplicate (⌘D)" data-icon-ui="duplicate">Duplicate</Button>
        <Button className="btn sm" id="delBtn" title="Delete (⌫)" data-icon-ui="delete">Delete</Button>
      </div>
    </section>
  </div>

  {/* CENTRE: canvas + inspector */}
  <div className="col-centre">
    <section className="panel" aria-label="Canvas">
      <div className="canvas-tools">
        <div className="row"><span className="lbl">Tool</span>
          <div className="seg" role="group" aria-label="Tool"><Button className="btn sm icon" data-tool="select" data-control-tooltip="Select (V)" aria-label="Select" title="Select (V)" data-icon-ui="select"></Button><Button className="btn sm icon" data-tool="direct" data-control-tooltip="Direct selection (A)" aria-label="Direct selection" title="Direct selection (A)" data-icon-ui="direct"></Button><Button className="btn sm icon" data-tool="pen" data-control-tooltip="Pen (P)" aria-label="Pen" title="Pen (P): click an outline to add a point; Alt-click an anchor to remove it; click empty space to draw" data-icon-ui="pen"></Button></div>
          <div className="seg" role="group" aria-label="Area selection"><Button className="btn sm icon" id="areaSelectBtn" aria-label="Marquee selection" aria-pressed="false" data-control-tooltip="Marquee selection" data-icon-ui="marquee"></Button><Button className="btn sm icon" id="areaSelectToggle" aria-label="Choose area selection tool" aria-haspopup="menu" aria-expanded="false" data-control-tooltip="Choose marquee, lasso or polygon lasso" data-icon-ui="chevron"></Button></div>
          <div id="areaSelectionMenu" className="floating-panel item-menu" role="menu" aria-label="Area selection tools" hidden><Button className="menu-item" role="menuitemradio" data-area-choice="marquee" aria-checked="true" data-icon-ui="marquee">Marquee</Button><Button className="menu-item" role="menuitemradio" data-area-choice="lasso" aria-checked="false" data-icon-ui="lasso">Lasso</Button><Button className="menu-item" role="menuitemradio" data-area-choice="polygon" aria-checked="false" data-icon-ui="polygon-lasso">Polygon lasso</Button></div>
          <span className="lbl">Handles</span>
          <div className="seg" role="group" aria-label="Handle mode"><Button className="btn sm" data-hmode="shape" title="Edit the form's own parameters" data-icon-ui="path">Shape</Button><Button className="btn sm" data-hmode="transform" title="Rotate / scale about the anchor point (T)" data-icon-ui="transform">Transform</Button></div></div>
        <div className="row"><span className="lbl">Boolean</span>
          <div className="seg" role="group" aria-label="Boolean on selection"><Button className="btn sm icon" data-group="union" aria-label="Union" data-control-tooltip="Union: combine selected shapes" title="Union selection (⌘G)" data-icon-ui="union"></Button><Button className="btn sm icon" data-group="subtract" aria-label="Subtract" data-control-tooltip="Subtract: first shape minus the rest" title="First minus the rest: later children become cutters" data-icon-ui="subtract"></Button><Button className="btn sm icon" data-group="intersect" aria-label="Intersect" data-control-tooltip="Intersect: keep only the overlap" data-icon-ui="intersect"></Button><Button className="btn sm icon" data-group="exclude" aria-label="Exclude" data-control-tooltip="Exclude: remove the overlap" data-icon-ui="exclude"></Button></div></div>
        <div className="row"><span className="lbl">Snap</span>
          <div className="seg" role="group" aria-label="Snap step" id="snapSeg">
            <Button className="btn sm" data-snap="0.1">0.1</Button><Button className="btn sm" data-snap="0.3">0.3</Button><Button className="btn sm" data-snap="0.5">0.5</Button><Button className="btn sm" data-snap="0">off</Button>
          </div><Button className="btn sm" id="proximityMergeBtn" aria-pressed="false" data-control-tooltip="Proximity merge: merge neighboring anchors within 8 screen pixels on release; retain outer handle directions and lengths">Proximity merge</Button></div>
        <div className="row"><span className="lbl">Symmetry</span><select id="symScope" aria-label="Symmetry scope"><option value="glyph">Whole icon</option><option value="group">Selected group</option></select><span className="lbl">Mirror</span>
          <div className="seg" role="group" aria-label="Mirror symmetry">
            <Button className="btn sm" data-mirror="x" title="Mirror across vertical axis">X</Button><Button className="btn sm" data-mirror="y" title="Mirror across horizontal axis">Y</Button>
          </div>
          <span className="lbl">Rotate</span>
          <div className="seg" role="group" aria-label="Radial symmetry">
            <Button className="btn sm" data-rot="1">1</Button><Button className="btn sm" data-rot="2">2</Button><Button className="btn sm" data-rot="4">4</Button><Button className="btn sm" data-rot="6">6</Button><Button className="btn sm" data-rot="8">8</Button><Button className="btn sm" data-rot="12">12</Button>
          </div></div>

      </div>
      <div className="iso-bar" id="isoBar" role="status" hidden><span className="lbl">Isolated</span><span className="crumbs" id="isoCrumbs"></span><Button className="btn sm" id="isoExit" title="Exit isolation (Esc)">Exit</Button></div>
      <div className="canvas-wrap"><div className="stage">
        <div className="ruler-corner" aria-hidden="true"></div>
        <svg id="rulerTop" className="ruler top" xmlns="http://www.w3.org/2000/svg" aria-label="Top ruler: drag down to add a horizontal guide"></svg>
        <svg id="rulerLeft" className="ruler left" xmlns="http://www.w3.org/2000/svg" aria-label="Left ruler: drag right to add a vertical guide"></svg>
        <svg id="canvas" xmlns="http://www.w3.org/2000/svg" tabIndex="0" aria-label="Glyph canvas, 24 by 24 units">
          <rect id="artboard" x="0" y="0" width="24" height="24" fill="var(--canvas-bg)"></rect>
          <g id="gGrid"></g><g id="gKey"></g><g id="gOrig"></g><g id="gLayers"></g><g id="gIso"></g><g id="gForms"></g><g id="gGhost" pointerEvents="none"></g><g id="gCut"></g><g id="gSym"></g><g id="gGuides"></g><g id="gPoints" pointerEvents="none"></g><g id="gSel"></g>
        </svg>
      </div></div>
      <div className="canvas-tools view-controls" aria-label="View controls">
        <Button className="btn icon" id="showToggle" aria-label="Show view controls" title="Show" aria-haspopup="dialog" aria-controls="showPalette" aria-expanded="false" data-icon-ui="eye"></Button>
        <div className="floating-panel show-palette" id="showPalette" role="dialog" aria-label="Show overlays" hidden>
          <Button className="btn view-tile" data-show="grid" aria-label="Grid" title="Grid" data-icon-ui="grid">Grid</Button>
          <Button className="btn view-tile" data-show="safe" aria-label="Safe area" title="Safe area" data-icon-ui="safe">Safe area</Button>
          <Button className="btn view-tile" data-show="artboard" aria-label="Artboard" title="Artboard" data-icon-ui="rect">Artboard</Button>
          <Button className="btn view-tile" data-show="guides" aria-label="Guides" title="Guides" data-icon-ui="guides">Guides</Button>
          <Button className="btn view-tile" data-show="keylines" aria-label="Keylines" title="Keylines" data-icon-ui="keylines">Keylines</Button>
          <Button className="btn view-tile" data-show="points" aria-label="Points" title="Points" data-icon-ui="points">Points</Button>
          <Button className="btn view-tile" data-show="forms" aria-label="Forms" title="Forms" data-icon-ui="forms">Forms</Button>
          <Button className="btn view-tile" data-show="original" id="origBtn" aria-label="Original" title="Original" data-icon-ui="duplicate">Original</Button>
          <Button className="btn view-tile" data-show="cutters" id="cuttersBtn" aria-label="Cutters" title="Cutters" data-icon-ui="cutter">Cutters</Button>
          <label className="grid-density" htmlFor="gridDensity">Grid spacing
            <select aria-label="Grid spacing" id="gridDensity" defaultValue="auto">
              <option value="auto">Auto</option><option value="0.1">0.1 units</option><option value="0.3">0.3 units</option><option value="0.5">0.5 units</option><option value="1">1 unit</option><option value="2">2 units</option>
            </select>
          </label>
        </div>
        <div className="row"><div className="seg" role="group" aria-label="Zoom">
          <Button className="btn sm icon" id="zoomOut" aria-label="Zoom out" title="Zoom out" data-icon-ui="zoom-out"></Button><Button className="btn sm" id="zoomFit" data-icon-ui="fit">Fit</Button><Button className="btn sm icon" id="zoomIn" aria-label="Zoom in" title="Zoom in" data-icon-ui="zoom-in"></Button>
        </div><span className="lbl mono" id="zoomLbl"></span></div>
      </div>
      <div className="status" id="status" role="status" aria-live="polite"></div>
      <div className="hint-line">Double-click an object to isolate it (Esc exits) · Pen on an outline adds an anchor (primitives convert to vectors); Alt-click an anchor removes it; double-click an anchor for corner / smooth, ⌫ deletes it · drag the mirror axis by its square, turn it by its circle (snaps 0 / 45 / 90°) · Drag a form to move · Select a subtract group to see its cutters (dashed orange); click a cutter to drag it or pull its radius handle · Shape handles resize, round corners (inner dot), taper (◆) · Transform handles: corners scale, ○ rotates, ⊕ is the anchor point · Pen: click / drag anchors, click the first to close, Enter ends · drag from a ruler for a guide, back onto it to delete · arrows nudge (⇧ ×10) · ⌘Z ⇧⌘Z ⌘D ⌫ · ⌘-scroll zooms</div>
    </section>
    <section className="panel" aria-labelledby="inspH">
      <h2 id="inspH">Inspector <span className="h-actions mono" id="inspPath"></span></h2>
      <div id="insp"></div>
    </section>
    <section className="panel" aria-labelledby="metadataH">
      <h2 id="metadataH">Icon metadata</h2>
      <div className="pad metadata">
        <label htmlFor="iconDescription">Description</label><textarea id="iconDescription" rows="2" placeholder="What does this icon represent?"></textarea>
        <label htmlFor="iconGroup">Primary group (export folder)</label><input id="iconGroup" type="text" placeholder="Navigation / Arrows" />
        <label htmlFor="iconTags">Usage tags (comma separated)</label><input id="iconTags" type="text" placeholder="navigation, table, action" />
        <label htmlFor="iconAliases">Search terms (comma separated)</label><input id="iconAliases" type="text" placeholder="suggestion, vote, ballot" />
      </div>
    </section>

  </div>

  {/* RIGHT: previews, runtime controls, context, export */}
  <div className="col-right">
    <section className="panel" aria-labelledby="geometryH">
      <h2 id="geometryH">Points &amp; overlaps</h2>
      <div className="pad"><p className="lbl" id="geometrySummary" role="status"></p><div id="overlapList"></div>
        <details open><summary>Source anchors · canvas coordinates (24 × 24)</summary><div className="point-table-wrap"><table className="point-table"><thead><tr><th>Object</th><th>Point</th><th>X</th><th>Y</th><th>Round</th></tr></thead><tbody id="pointRows"></tbody></table></div></details>
      </div>
    </section>
    <section className="panel" aria-labelledby="pvH">
      <h2 id="pvH">Previews</h2>
      <div className="pv-grid" id="pvGrid">
        <div className="pv-tile light" id="pvLight" aria-label="Light tile"></div>
        <div className="pv-tile dark" id="pvDark" aria-label="Dark tile"></div>
      </div>
      <div className="ctrls">
        <div className="ctrl"><label className="lbl" htmlFor="wRange">Weight</label><input type="range" id="wRange" min="0.8" max="2" step="0.1" /><span className="num" id="wVal"></span></div>
        <div className="warn" id="wWarn" hidden>2.0 and heavier: small counters start to close at 12–16px.</div>
        <div className="ctrl"><span className="lbl">Linecap</span><div className="seg" role="group" aria-label="Linecap" id="capSeg"><Button className="btn sm" data-cap="round">Round</Button><Button className="btn sm" data-cap="butt">Butt</Button><Button className="btn sm" data-cap="square">Square</Button></div><span></span></div>
        <div className="ctrl"><span className="lbl">Linejoin</span><div className="seg" role="group" aria-label="Linejoin" id="joinSeg"><Button className="btn sm" data-join="round">Round</Button><Button className="btn sm" data-join="miter">Miter</Button><Button className="btn sm" data-join="bevel">Bevel</Button></div><span></span></div>
        <div className="row"><Button className="btn sm" id="hintBtn" aria-pressed="false" title="Snap geometry and weight to whole pixels at 12–20px">Pixel hinting ≤20px</Button><Button className="btn sm" id="rtlBtn" aria-pressed="false">RTL flip</Button></div>
        <div className="swatches" aria-label="Colour roles">
          <span className="swatch"><span className="role-dot" style={{"background": "currentColor"}}></span>primary = currentColor</span>
          <label className="swatch">secondary <input type="color" id="swSecL" defaultValue="#7a8494" aria-label="Secondary, light" /><input type="color" id="swSecD" defaultValue="#8f9aa8" aria-label="Secondary, dark" /></label>
          <label className="swatch">accent <input type="color" id="swAccL" defaultValue="#0267e0" aria-label="Accent, light" /><input type="color" id="swAccD" defaultValue="#4b94f0" aria-label="Accent, dark" /></label>
        </div>
      </div>
    </section>
    <section className="panel" aria-labelledby="ctxH">
      <h2 id="ctxH">In context</h2>
      <div className="ctx" id="ctx"></div>
    </section>
    <section className="panel io" aria-labelledby="ioH">
      <h2 id="ioH">Export / Import</h2>
      <div className="row">
        <Button className="btn sm" id="expJson" data-icon-ui="export">JSON</Button><Button className="btn sm" id="expSvg" data-icon-ui="export">SVG (runtime vars)</Button><Button className="btn sm" id="expBaked" data-icon-ui="export">SVG (baked)</Button>
        <Button className="btn sm" id="downloadSvg" data-icon-ui="export">Download SVG</Button><Button className="btn sm" id="downloadPng" data-icon-ui="export">PNG</Button>
        <Button className="btn sm primary" id="copyBtn" data-icon-ui="duplicate">Copy</Button><Button className="btn sm" id="importBtn" title="Parse the textarea as glyph JSON and load it" data-icon-ui="import">Import pasted JSON</Button>
      </div>
      <div className="pad"><textarea id="ioText" spellCheck="false" aria-label="Export / import text" rows="8"></textarea></div>
      <div className="pad lbl mono" id="statsLine"></div>
    </section>
  </div>
</main>


  </>;
}
