// Shared brand-picker module — mounted into every page's nav.
//
// Behavior:
//   1. Fetches /api/me on load to populate the dropdown.
//   2. Active brand persisted in localStorage as `brand_id` /
//      `brand_name`. auth.js's fetch wrapper reads brand_id and
//      sends it as the X-Brand-Id header on every API call.
//   3. Switching brand fires a custom 'brand:change' event on
//      window so individual pages can refresh their data.
//   4. "+ Create new brand" inline form posts to /api/brand and
//      adds the new brand to the dropdown + sets it active.
//
// Pages opt in by including this script and putting an empty
// <div id="brandPickerSlot"></div> wherever the picker should land
// (typically the navbar). The module finds the slot and renders
// into it.

(function () {
  if (window.__brandPickerMounted) return;
  window.__brandPickerMounted = true;

  // Wait for DOM ready so the slot exists.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const slot = document.getElementById('brandPickerSlot');
    if (!slot) return;
    slot.innerHTML = renderShell();
    injectStyles();
    wireHandlers(slot);
    refreshFromServer();
  }

  function renderShell() {
    const activeName = localStorage.getItem('brand_name') || 'No brand';
    return `
      <div class="bp-root">
        <button type="button" id="bpToggle" class="bp-toggle">
          <span class="bp-dot"></span>
          <span id="bpActiveName" class="bp-active-name">${escape(activeName)}</span>
          <svg class="bp-caret" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div id="bpMenu" class="bp-menu hidden">
          <div id="bpList" class="bp-list">
            <p class="bp-empty">Loading…</p>
          </div>
          <div class="bp-divider"></div>
          <form id="bpCreate" class="bp-create">
            <input id="bpCreateName" type="text" placeholder="New brand name…" class="bp-input" autocomplete="off" />
            <button type="submit" id="bpCreateBtn" class="bp-create-btn">+ Create</button>
          </form>
          <p id="bpStatus" class="bp-status hidden"></p>
        </div>
      </div>
    `;
  }

  function injectStyles() {
    if (document.getElementById('brandPickerStyles')) return;
    const css = `
      .bp-root { position: relative; }
      .bp-toggle {
        display: inline-flex; align-items: center; gap: 8px;
        font-size: 12px; font-weight: 600;
        background: #161616; border: 1px solid #2a2a2a; color: #ccc;
        padding: 6px 12px; border-radius: 999px; cursor: pointer;
        transition: all 0.12s; white-space: nowrap;
      }
      .bp-toggle:hover { border-color: #444; color: #fff; }
      .bp-dot {
        display: inline-block; width: 8px; height: 8px;
        border-radius: 999px; background: #ef4444;
      }
      .bp-active-name { max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
      .bp-caret { color: #666; flex-shrink: 0; }

      .bp-menu {
        position: absolute; top: 100%; right: 0; margin-top: 6px;
        min-width: 260px; max-width: 320px;
        background: #111; border: 1px solid #2a2a2a; border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        padding: 6px; z-index: 100;
      }
      .bp-menu.hidden { display: none; }

      .bp-list { max-height: 280px; overflow-y: auto; padding: 2px; }
      .bp-row {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 10px; border-radius: 8px; cursor: pointer;
        font-size: 12px; color: #ccc;
        transition: background 0.1s;
      }
      .bp-row:hover { background: #1a1a1a; color: #fff; }
      .bp-row.active { background: rgba(239,68,68,0.12); color: #f87171; }
      .bp-row .bp-row-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bp-row .bp-check { color: #f87171; font-size: 14px; }
      .bp-row .bp-row-thumb {
        width: 18px; height: 18px; border-radius: 4px;
        background: #1f1f1f; flex-shrink: 0;
        background-size: cover; background-position: center;
      }
      .bp-empty { color: #666; font-size: 11px; padding: 12px; text-align: center; font-style: italic; }
      .bp-divider { height: 1px; background: #1f1f1f; margin: 6px 0; }
      .bp-create { display: flex; gap: 6px; padding: 4px; }
      .bp-input {
        flex: 1; background: #161616; border: 1px solid #2a2a2a; color: #f0f0f0;
        border-radius: 6px; padding: 6px 10px; font-size: 12px; min-width: 0;
      }
      .bp-input:focus { border-color: #ef4444; outline: none; }
      .bp-create-btn {
        font-size: 11px; font-weight: 600; padding: 6px 10px;
        background: #1f2937; border: 1px solid #3b82f6; color: #93c5fd;
        border-radius: 6px; cursor: pointer; white-space: nowrap;
      }
      .bp-create-btn:hover { background: #1e3a5c; }
      .bp-create-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .bp-status { font-size: 10px; padding: 6px 10px; margin: 0; }
      .bp-status.ok    { color: #34d399; }
      .bp-status.err   { color: #f87171; }
      .bp-status.hidden { display: none; }
    `;
    const tag = document.createElement('style');
    tag.id = 'brandPickerStyles';
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function wireHandlers(root) {
    const toggle = root.querySelector('#bpToggle');
    const menu   = root.querySelector('#bpMenu');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!root.contains(e.target)) menu.classList.add('hidden');
    });

    const form = root.querySelector('#bpCreate');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = root.querySelector('#bpCreateName');
      const btn   = root.querySelector('#bpCreateBtn');
      const status = root.querySelector('#bpStatus');
      const name = input.value.trim();
      if (!name) return;
      btn.disabled = true;
      btn.textContent = 'Creating…';
      status.className = 'bp-status';
      status.textContent = '';
      try {
        const res = await fetch('/api/brand', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        // Set the new brand as active and refresh the list.
        setActive(data.brand.id, data.brand.name);
        input.value = '';
        status.className = 'bp-status ok';
        status.textContent = '✓ Created';
        await refreshFromServer();
        setTimeout(() => { status.className = 'bp-status hidden'; }, 1500);
      } catch (err) {
        status.className = 'bp-status err';
        status.textContent = '✗ ' + (err.message || 'Failed');
      } finally {
        btn.disabled = false;
        btn.textContent = '+ Create';
      }
    });
  }

  async function refreshFromServer() {
    const list = document.getElementById('bpList');
    if (!list) return;
    try {
      const res = await fetch('/api/me');
      if (!res.ok) {
        list.innerHTML = `<p class="bp-empty">Sign in to load brands</p>`;
        return;
      }
      const data = await res.json();
      const brands = data.brands || [];
      const activeId = localStorage.getItem('brand_id') || '';
      if (!brands.length) {
        list.innerHTML = `<p class="bp-empty">No brands yet — create one below</p>`;
        // Clear stale active brand.
        if (activeId) clearActive();
        updateActiveLabel('No brand');
        return;
      }
      // Auto-pick the first brand if none active OR active doesn't exist.
      let resolvedActive = brands.find(b => b.id === activeId);
      if (!resolvedActive) {
        resolvedActive = brands[0];
        setActive(resolvedActive.id, resolvedActive.name, /* silent= */ true);
      } else {
        updateActiveLabel(resolvedActive.name);
      }
      list.innerHTML = brands.map(b => `
        <div class="bp-row${b.id === resolvedActive.id ? ' active' : ''}" data-brand-id="${escape(b.id)}" data-brand-name="${escape(b.name)}">
          <div class="bp-row-thumb" ${b.logoUrl ? `style="background-image:url(${escape(b.logoUrl)})"` : ''}></div>
          <span class="bp-row-name">${escape(b.name)}</span>
          ${b.id === resolvedActive.id ? '<span class="bp-check">✓</span>' : ''}
        </div>
      `).join('');
      list.querySelectorAll('.bp-row').forEach(row => {
        row.addEventListener('click', () => {
          const id   = row.dataset.brandId;
          const name = row.dataset.brandName;
          if (id === (localStorage.getItem('brand_id') || '')) return;
          setActive(id, name);
          refreshFromServer();
        });
      });
    } catch (err) {
      list.innerHTML = `<p class="bp-empty">Failed to load: ${escape(err.message)}</p>`;
    }
  }

  function setActive(id, name, silent) {
    localStorage.setItem('brand_id', id || '');
    localStorage.setItem('brand_name', name || '');
    updateActiveLabel(name || 'No brand');
    if (!silent) {
      // Pages can listen and reload data scoped to the new brand.
      window.dispatchEvent(new CustomEvent('brand:change', { detail: { id, name } }));
    }
  }

  function clearActive() {
    localStorage.removeItem('brand_id');
    localStorage.removeItem('brand_name');
  }

  function updateActiveLabel(name) {
    const el = document.getElementById('bpActiveName');
    if (el) el.textContent = name;
  }

  function escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Public API for ad-hoc callers.
  window.brandPicker = {
    refresh: refreshFromServer,
    setActive,
    getActive: () => ({
      id:   localStorage.getItem('brand_id')   || null,
      name: localStorage.getItem('brand_name') || null
    })
  };
})();
