'use client';
import { useEffect, useState } from 'react';
import { Button } from '@base-ui/react/button';
import { Collapsible } from '@base-ui/react/collapsible';

export function LibraryPanel() {
  const [open, setOpen] = useState(true);
  useEffect(() => { try { setOpen(localStorage.getItem('gw-open-lib-open') !== '0'); } catch {} }, []);
  const changeOpen = value => { setOpen(value); try { localStorage.setItem('gw-open-lib-open', value ? '1' : '0'); } catch {} };
  return (
    <Collapsible.Root className="panel library-panel" open={open} onOpenChange={changeOpen} aria-labelledby="libH">
      <h2 id="libH"><Collapsible.Trigger className="panel-toggle" id="libToggle"><span className="disclosure-arrow" aria-hidden="true">▾</span>Library</Collapsible.Trigger> <span className="h-actions">
        <select id="tplSel" aria-label="Template"><option value="blank">Blank</option><option value="app">App icon</option><option value="document">Document</option><option value="person">Person</option></select>
        <Button className="btn sm" id="newBtn">New icon</Button></span></h2>
      <Collapsible.Panel id="libBody" keepMounted hidden={!open}>
      <div className="lib-tools">
        <label className="lib-search"><span className="sr">Search glyphs</span><span id="libSearchIcon"></span><input type="search" id="libSearch" placeholder="Search" autoComplete="off" spellCheck="false" /></label>
        <select id="libFilter" aria-label="Filter by provenance">
          <option value="all">Everything</option><option value="hand-built">Hand-built</option><option value="converted-stroke">Converted stroke</option><option value="imported-fill">Imported fill</option><option value="imported-stroke">Imported stroke</option><option value="edited">Edited</option><option value="problems">Problems</option>
        </select>
      </div>
      <div className="lib-meta"><span id="libCount" aria-live="polite"></span><span className="legend" aria-hidden="true"><span><i className="prov-dot" data-p="hand-built"></i>hand</span><span><i className="prov-dot" data-p="converted-stroke"></i>stroke</span><span><i className="prov-dot" data-p="imported-fill"></i>fill</span></span></div>
      <div className="row lib-organize"><Button className="btn sm" id="organizeLibraryBtn">Suggest groups</Button><Button className="btn sm" id="undoOrganizationBtn" disabled>Undo grouping</Button></div>
      <dialog id="organizeDialog" className="import-dialog" aria-labelledby="organizeHeading"><h2 id="organizeHeading">Suggested groups</h2><p>Based on icon names, not verified product usage. Only unassigned icons will change.</p><div id="organizeSummary"></div><div className="row"><Button className="btn" id="cancelOrganizeBtn">Cancel</Button><Button className="btn" id="applyOrganizeBtn">Apply groups</Button></div></dialog>
      <div className="row"><Button className="btn sm" id="findSharedFormsBtn">Find shared forms</Button><span className="lbl">◇ purple long dashes = linked geometry</span></div>
      <div className="row"><Button className="btn sm" id="insetReviewBtn">Convert fills to outlines</Button></div>
      <dialog id="sharedFormsDialog" className="import-dialog shared-forms-dialog" aria-labelledby="sharedFormsHeading">
        <h2 id="sharedFormsHeading">Shared forms</h2><p id="sharedFormsSummary"></p>
        <input id="sharedFormsSearch" type="search" aria-label="Search shared forms" placeholder="Filter by form or icon name" />
        <div id="sharedFormsList"></div><Button className="btn" id="closeSharedFormsBtn">Close</Button>
      </dialog>
      <details className="component-library"><summary>Components</summary><div id="componentList" className="pad"></div></details>
      <div className="row"><Button className="btn sm" id="libraryVersionsBtn">Library versions</Button></div>
      <dialog id="libraryVersionsDialog" className="import-dialog" aria-labelledby="versionsHeading"><h2 id="versionsHeading">Library versions</h2><p>Named checkpoints include all icons, components, groups and reset originals. Restore saves the current set as a safety version first. Download a ZIP for a backup outside this browser.</p><label htmlFor="versionName">Version name</label><input id="versionName" type="text" placeholder="Before cloud cleanup" /><Button className="btn" id="saveLibraryVersionBtn">Save checkpoint</Button><div id="libraryVersionsList"></div><Button className="btn" id="closeLibraryVersionsBtn">Close</Button></dialog>
      <div className="lib-selection" aria-label="Library selection">
        <span id="librarySelectionCount" aria-live="polite">0 selected</span>
        <Button className="btn sm" id="selectShownIconsBtn">Select shown</Button><Button className="btn sm" id="clearIconSelectionBtn" disabled>Clear</Button>
        <Button className="btn sm" id="deleteIconsBtn" disabled data-icon-ui="delete">Delete selected</Button><Button className="btn sm" id="restoreIconsBtn" disabled>Restore deleted</Button>
        <span className="lbl">⌘/Ctrl-click to toggle · Shift-click for a range</span>
      </div>
      <div className="lib-list" id="lib" aria-label="Glyphs"></div>
      <div className="lib-io">
        <div className="library-transfer-row">
        <Button className="btn sm" id="impFileBtn" title="Load a ZIP library or legacy JSON file" data-icon-ui="import">Import ZIP</Button>
        <details className="export-options"><summary className="btn sm">Export ZIP</summary>
          <div className="export-settings">
            <label htmlFor="exportStructure">Folder structure</label><select id="exportStructure"><option value="group">By primary group</option><option value="flat">Flat — all icons together</option></select>
            <label htmlFor="exportRoot">Root folder (optional)</label><input id="exportRoot" type="text" placeholder="icons" />
            <label className="row"><input id="exportSVGs" type="checkbox" defaultChecked /> Include SVG files</label>
            <label className="row"><input id="exportPNGs" type="checkbox" /> Include PNG sizes / Apple assets</label>
            <p>Unassigned icons go in Ungrouped. Editable JSON and organization metadata are always included.</p>
            <Button className="btn sm" id="expOne" data-icon-ui="export">Export icon ZIP</Button>
            <Button className="btn sm" id="expEdited" data-icon-ui="export">Export edited ZIP</Button>
            <Button className="btn sm" id="expAll" data-icon-ui="export">Export all ZIP</Button>
          </div>
        </details>
        </div>
        <dialog id="importDialog" className="import-dialog" aria-labelledby="importHeading" aria-describedby="importSummary">
          <h2 id="importHeading">Import icons</h2>
          <p id="importSummary"></p>
          <label className="row"><input type="checkbox" id="importReplace" /> Replace entire library</label>
          <label className="row" id="importTokensRow" hidden><input type="checkbox" id="importLibraryTokens" /> Use imported library properties / tokens</label>
          <p>Replace removes all current icons, components and library settings. The previous library is saved in Library versions. Add keeps existing icons and renames conflicting incoming names.</p>
          <div className="row"><Button className="btn" id="cancelImportBtn">Cancel</Button><Button className="btn" id="confirmImportBtn">Add icons</Button></div>
        </dialog>
        <div className="row"><Button className="btn sm" id="newLibraryBtn" title="Start an empty library; the current library is saved in Library versions">New library</Button></div>
        <div className="row"><Button className="btn sm" id="resetLibraryBtn" title="Restore imported originals; undo restores your edits">Revert library</Button><Button className="btn sm" id="undoLibraryResetBtn" disabled>Undo library revert</Button></div>
        <input type="file" id="impFile" accept="application/zip,.zip,application/json,.json" hidden />
      </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
