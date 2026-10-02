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
        <Button className="btn sm" id="newBtn">New</Button></span></h2>
      <Collapsible.Panel id="libBody" keepMounted hidden={!open}>
      <div className="lib-tools">
        <label className="lib-search"><span className="sr">Search glyphs</span><span id="libSearchIcon"></span><input type="search" id="libSearch" placeholder="Search" autoComplete="off" spellCheck="false" /></label>
        <select id="libFilter" aria-label="Filter by provenance">
          <option value="all">Everything</option><option value="hand-built">Hand-built</option><option value="converted-stroke">Converted stroke</option><option value="imported-fill">Imported fill</option><option value="imported-stroke">Imported stroke</option><option value="edited">Edited</option>
        </select>
      </div>
      <div className="lib-meta"><span id="libCount" aria-live="polite"></span><span className="legend" aria-hidden="true"><span><i className="prov-dot" data-p="hand-built"></i>hand</span><span><i className="prov-dot" data-p="converted-stroke"></i>stroke</span><span><i className="prov-dot" data-p="imported-fill"></i>fill</span></span></div>
      <div className="row lib-organize"><Button className="btn sm" id="organizeLibraryBtn">Suggest groups</Button><Button className="btn sm" id="undoOrganizationBtn" disabled>Undo grouping</Button></div>
      <dialog id="organizeDialog" className="import-dialog" aria-labelledby="organizeHeading"><h2 id="organizeHeading">Suggested groups</h2><p>Based on icon names, not verified product usage. Only unassigned icons will change.</p><div id="organizeSummary"></div><div className="row"><Button className="btn" id="cancelOrganizeBtn">Cancel</Button><Button className="btn" id="applyOrganizeBtn">Apply groups</Button></div></dialog>
      <div className="lib-list" id="lib" aria-label="Glyphs"></div>
      <div className="lib-io">
        <details className="export-options"><summary>Export ZIP</summary>
          <div className="export-settings">
            <label htmlFor="exportStructure">Folder structure</label><select id="exportStructure"><option value="group">By primary group</option><option value="flat">Flat — all icons together</option></select>
            <label htmlFor="exportRoot">Root folder (optional)</label><input id="exportRoot" type="text" placeholder="icons" />
            <label className="row"><input id="exportSVGs" type="checkbox" defaultChecked /> Include SVG files</label>
            <p>Unassigned icons go in Ungrouped. Editable JSON and organization metadata are always included.</p>
            <Button className="btn sm" id="expOne" data-icon-ui="export">Export icon ZIP</Button>
            <Button className="btn sm" id="expEdited" data-icon-ui="export">Export edited ZIP</Button>
            <Button className="btn sm" id="expAll" data-icon-ui="export">Export all ZIP</Button>
          </div>
        </details>
        <Button className="btn sm" id="impFileBtn" title="Load a ZIP library or legacy JSON file" data-icon-ui="import">Import ZIP</Button>
        <dialog id="importDialog" className="import-dialog" aria-labelledby="importHeading" aria-describedby="importSummary">
          <h2 id="importHeading">Import icons</h2>
          <p id="importSummary"></p>
          <label className="row"><input type="checkbox" id="importReplace" /> Replace matching icons</label>
          <p>Replace keeps other icons in your library. Add renames incoming icons when a name is already in use.</p>
          <div className="row"><Button className="btn" id="cancelImportBtn">Cancel</Button><Button className="btn" id="confirmImportBtn">Add icons</Button></div>
        </dialog>
        <div className="row"><Button className="btn sm" id="resetLibraryBtn" title="Restore imported originals; undo restores your edits">Reset library</Button><Button className="btn sm" id="undoLibraryResetBtn" disabled>Undo library reset</Button></div>
        <input type="file" id="impFile" accept="application/zip,.zip,application/json,.json" hidden />
      </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
