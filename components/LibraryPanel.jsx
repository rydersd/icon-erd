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
      <div className="lib-list" id="lib" aria-label="Glyphs"></div>
      <div className="lib-io">
        <Button className="btn sm" id="expOne" title="Download the selected icon as JSON" data-icon-ui="export">Export icon</Button>
        <Button className="btn sm" id="expEdited" title="Download every edited glyph as one JSON file" data-icon-ui="export">Export edited</Button>
        <Button className="btn sm" id="expAll" title="Download the whole library, edits included, as one JSON file" data-icon-ui="export">Export all</Button>
        <Button className="btn sm" id="impFileBtn" title="Load a library JSON file (or a single glyph JSON)" data-icon-ui="import">Import file</Button>
        <label className="lbl" htmlFor="importMode">Import collisions</label><select id="importMode"><option value="add">Add (keep both)</option><option value="overwrite">Overwrite matching names</option></select>
        <div className="row"><Button className="btn sm" id="resetLibraryBtn" title="Restore imported originals; undo restores your edits">Reset library</Button><Button className="btn sm" id="undoLibraryResetBtn" disabled>Undo library reset</Button></div>
        <input type="file" id="impFile" accept="application/json,.json" hidden />
      </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
