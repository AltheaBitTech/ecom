'use client';

import { useEffect } from 'react';

/**
 * Runs only when the storefront is rendered inside the Store-design studio
 * iframe. Two behaviours, Wix-style:
 *  - click a [data-design-field] (heading, hero copy…) → edit the text in place,
 *    posting the new value back to the editor on blur/Enter.
 *  - click anywhere else in a section → tell the editor to select that section.
 * ponytail: contentEditable + postMessage, no drag canvas (Phase 2).
 */
export function PreviewBridge() {
  useEffect(() => {
    if (window.parent === window) return; // not embedded — do nothing
    document.body.dataset.storePreview = 'on';
    const origin = window.location.origin;

    function edit(el: HTMLElement, id: string, field: string) {
      el.contentEditable = 'true';
      el.focus();
      const finish = () => {
        el.contentEditable = 'false';
        el.removeEventListener('blur-sm', finish);
        el.removeEventListener('keydown', onKey);
        window.parent.postMessage({ type: 'store-preview:edit', id, field, value: el.textContent?.trim() ?? '' }, origin);
      };
      const onKey = (event: KeyboardEvent) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); el.blur(); } if (event.key === 'Escape') el.blur(); };
      el.addEventListener('blur', finish, { once: true });
      el.addEventListener('keydown', onKey);
    }

    const onClick = (event: MouseEvent) => {
      const marker = (event.target as HTMLElement)?.closest?.('[data-design-section]') as HTMLElement | null;
      const id = marker?.getAttribute('data-design-section');
      if (!id) return;
      event.preventDefault();
      const fieldEl = (event.target as HTMLElement)?.closest?.('[data-design-field]') as HTMLElement | null;
      const field = fieldEl?.getAttribute('data-design-field');
      if (fieldEl && field) { edit(fieldEl, id, field); return; }
      window.parent.postMessage({ type: 'store-preview:select', id }, origin);
    };
    document.addEventListener('click', onClick, true);

    // Floating per-section toolbar: reorder / hide / delete on the canvas.
    const bar = document.createElement('div');
    bar.dataset.previewToolbar = 'on';
    bar.style.cssText = 'position:fixed;z-index:2147483647;display:none;gap:2px;padding:3px;border-radius:8px;background:#111827;box-shadow:0 4px 12px rgb(0 0 0 /.3)';
    const send = (action: string) => (event: Event) => { event.preventDefault(); event.stopPropagation(); if (bar.dataset.id) window.parent.postMessage({ type: 'store-preview:command', action, id: bar.dataset.id }, origin); };
    for (const [action, glyph, title] of [['up', '↑', 'Move up'], ['down', '↓', 'Move down'], ['hide', '⦸', 'Hide'], ['delete', '✕', 'Delete']] as const) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = glyph; button.title = title;
      button.style.cssText = 'all:unset;cursor:pointer;color:#fff;font-size:13px;line-height:1;padding:4px 7px;border-radius:5px';
      button.addEventListener('mouseenter', () => { button.style.background = 'rgb(255 255 255 /.15)'; });
      button.addEventListener('mouseleave', () => { button.style.background = 'transparent'; });
      button.addEventListener('click', send(action));
      bar.appendChild(button);
    }
    document.body.appendChild(bar);
    let hideTimer = 0;
    const place = (marker: HTMLElement, id: string) => { const box = (marker.firstElementChild as HTMLElement ?? marker).getBoundingClientRect(); bar.dataset.id = id; bar.style.display = 'flex'; bar.style.top = `${Math.max(6, box.top + 6)}px`; bar.style.right = `${Math.max(6, window.innerWidth - box.right + 6)}px`; };
    const onOver = (event: MouseEvent) => { const marker = (event.target as HTMLElement)?.closest?.('[data-design-section]') as HTMLElement | null; const id = marker?.getAttribute('data-design-section'); if (marker && id) { window.clearTimeout(hideTimer); place(marker, id); } };
    const onOut = (event: MouseEvent) => { if ((event.relatedTarget as HTMLElement)?.closest?.('[data-preview-toolbar]')) return; hideTimer = window.setTimeout(() => { bar.style.display = 'none'; }, 250); };
    bar.setAttribute('data-preview-toolbar', 'on');
    bar.addEventListener('mouseenter', () => window.clearTimeout(hideTimer));
    bar.addEventListener('mouseleave', () => { bar.style.display = 'none'; });
    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('mouseout', onOut, true);

    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('mouseover', onOver, true);
      document.removeEventListener('mouseout', onOut, true);
      bar.remove();
    };
  }, []);
  return null;
}
