'use client';
import { useEffect, useRef } from 'react';
import { WorkbenchShell } from './WorkbenchShell';

export default function GlyphWorkbench() {
  const root = useRef(null);
  useEffect(() => {
    let cancelled = false, editor;
    import('../src/editor.js').then(({ mountEditor }) => {
      if (cancelled) return;
      editor = mountEditor(root.current);
      return editor.ready;
    }).catch(error => {
      if (cancelled) return;
      const status = root.current?.querySelector('#status');
      if (status) status.textContent = `Editor could not start: ${error.message}`;
      console.error(error);
    });
    return () => { cancelled = true; editor?.dispose(); };
  }, []);
  return <div ref={root}><WorkbenchShell /></div>;
}
