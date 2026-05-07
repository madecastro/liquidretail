// Creative Template Preview — shared module loaded by both detect.html and ads.html.
// Reads window.state.mediaId for the active Media; calls renderTemplatePreview()
// to refresh. The host page is responsible for setting state.mediaId, ensuring
// the templatePreviewPanel + tpStage + tpStatus + tpDebugGroup + tpConservation
// DOM elements are present, and providing escapeHtml() in the global scope.

(function () {
"use strict";

  // ══════════════════════════════════════════════════════════════
  //  Creative Template Preview
  //  Low-fidelity in-app sanity check for the layout-input service.
  //  - Calls /api/layout-input/candidates/:mediaId to find passing templates.
  //  - On user pick, calls POST /api/layout-input?include=canvas to get
  //    the assembled input + canvas spec.
  //  - Renders each zone as an absolute-positioned div inside the canvas,
  //    resolving slot paths against the input and drawing lightweight
  //    representations (img for media, text for quotes, stat cards for
  //    metrics_row, etc).
  //  NOT a production renderer — just a "is the shape right" preview.
  // ══════════════════════════════════════════════════════════════
  // Render-mode (?renderMode=1) is the headless screenshot path used by
  // the render service. We don't want debug overlays / restriction layers
  // / phone frame in production renders — those are operator-UI affordances.
  // Default every diagnostic toggle to false when render-mode is detected
  // at module load so drawTpCanvas's optional layers no-op cleanly.
  const TP_RENDER_MODE = (() => {
    try { return new URLSearchParams(window.location.search).get('renderMode') === '1'; }
    catch (_) { return false; }
  })();

  const TP_STATE = {
    template: null,
    aspectRatio: '1:1',
    candidates: [],         // [{ template_id, ok, missing, ... }]
    supportedRatios: {},    // { template_id: [ratios] }
    lastMediaId: null,
    lastInput: null,
    lastCanvas: null,
    showDebugBoxes:   !TP_RENDER_MODE,  // container boxes — placed elements (overlay) or canvas zones (canonical)
    showRestrictions: !TP_RENDER_MODE,  // restriction layer — subject/face/text keep-outs from overlay analysis
    showDensity:      false,            // density heatmap — visualize the densityGrid the silhouette-aware legality uses
    phoneFrame:       false,            // mock-phone frame around the stage — useful for visualizing ad in-context
    actualSize:       false,            // render at native canvas pixel size (no transform: scale) — for diagnosing browser rendering bugs the scaled-down view masks
    conservation:     0.5               // placement strictness; overlay-mode only (backend ignores on canonical)
  };

  // Debounce timer for conservation slider — we refetch layout-input on
  // change, so coalesce rapid drags before hitting the backend.
  let tpConservationTimer = null;

  // Re-render the preview stage from cached TP_STATE. Called whenever a
  // debug toggle changes so the user doesn't have to re-pick template/ratio.
  function redrawTpStage() {
    const stage = document.getElementById('tpStage');
    if (!stage || !TP_STATE.lastInput) return;
    if (TP_STATE.lastInput.placement) {
      drawOverlayCanvas(stage, TP_STATE.lastInput);
    } else if (TP_STATE.lastCanvas) {
      drawTpCanvas(stage, TP_STATE.lastInput, TP_STATE.lastCanvas);
    }
  }

  // One-time wire-up of debug chips. Both toggles rerender via the shared
  // redrawTpStage path so they work in overlay AND canonical modes.
  (function wireTpDebugChips() {
    const boxes = document.getElementById('tpDebugBoxesChip');
    const restr = document.getElementById('tpDebugRestrictionsChip');
    const dens  = document.getElementById('tpDebugDensityChip');
    const phone = document.getElementById('tpDebugPhoneChip');
    const actual = document.getElementById('tpDebugActualSizeChip');
    const syncBoxes = () => {
      if (!boxes) return;
      boxes.classList.toggle('active', TP_STATE.showDebugBoxes);
      boxes.textContent = TP_STATE.showDebugBoxes ? 'Hide container boxes' : 'Show container boxes';
    };
    const syncRestr = () => {
      if (!restr) return;
      restr.classList.toggle('active', TP_STATE.showRestrictions);
      restr.textContent = TP_STATE.showRestrictions ? 'Hide restrictions' : 'Show restrictions';
    };
    const syncDens = () => {
      if (!dens) return;
      dens.classList.toggle('active', TP_STATE.showDensity);
      dens.textContent = TP_STATE.showDensity ? 'Hide density' : 'Show density';
    };
    const syncPhone = () => {
      if (!phone) return;
      phone.classList.toggle('active', TP_STATE.phoneFrame);
      phone.textContent = TP_STATE.phoneFrame ? 'Hide phone frame' : 'Show phone frame';
      applyPhoneFrame();
    };
    const syncActual = () => {
      if (!actual) return;
      actual.classList.toggle('active', TP_STATE.actualSize);
      actual.textContent = TP_STATE.actualSize ? 'Show fitted preview' : 'Show actual size';
      applyActualSize();
    };
    syncBoxes(); syncRestr(); syncDens(); syncPhone(); syncActual();
    boxes?.addEventListener('click', () => {
      TP_STATE.showDebugBoxes = !TP_STATE.showDebugBoxes;
      syncBoxes(); redrawTpStage();
    });
    restr?.addEventListener('click', () => {
      TP_STATE.showRestrictions = !TP_STATE.showRestrictions;
      syncRestr(); redrawTpStage();
    });
    dens?.addEventListener('click', () => {
      TP_STATE.showDensity = !TP_STATE.showDensity;
      syncDens(); redrawTpStage();
    });
    phone?.addEventListener('click', () => {
      TP_STATE.phoneFrame = !TP_STATE.phoneFrame;
      syncPhone();
    });
    actual?.addEventListener('click', () => {
      TP_STATE.actualSize = !TP_STATE.actualSize;
      syncActual();
    });
  })();

  // Wrap / unwrap the FRAME in a .phone-shell so the CSS bezel + notch
  // appears around the rendered ad. We wrap the frame (not the stage)
  // so the inner scale-transform on tpStage stays intact — the frame
  // is the responsive aspect-ratio holder; the stage inside is at
  // canvas pixel size and scaled.
  function applyPhoneFrame() {
    const frame = document.getElementById('tpStageFrame');
    if (!frame) return;
    const inShell = frame.parentElement && frame.parentElement.classList?.contains('phone-shell');
    if (TP_STATE.phoneFrame && !inShell) {
      const shell = document.createElement('div');
      shell.className = 'phone-shell';
      frame.parentElement.insertBefore(shell, frame);
      shell.appendChild(frame);
    } else if (!TP_STATE.phoneFrame && inShell) {
      const shell = frame.parentElement;
      shell.parentElement.insertBefore(frame, shell);
      shell.remove();
    }
    // Fit transform may need to recompute since the frame's available
    // width changed when its parent did.
    requestAnimationFrame(applyStageScale);
  }

  // Canonical canvas pixel dimensions per aspect ratio. Width is fixed
  // at 1000 across all ratios so text sizing (em base = width/22 = 45px)
  // is consistent regardless of orientation. These match the canonical
  // canvas spec at server/schemas/rsSocialProof.canvas.v1.json.
  const CANVAS_DIMS = {
    '1:1':    { w: 1000, h: 1000 },
    '4:5':    { w: 1000, h: 1250 },
    '9:16':   { w: 1000, h: 1778 },
    '16:9':   { w: 1000, h: 563 },
    '1.91:1': { w: 1000, h: 524 }
  };

  function dimsForRatio(ratio) {
    return CANVAS_DIMS[ratio] || CANVAS_DIMS['1:1'];
  }

  // Size the frame to the canvas aspect, the stage to canvas pixel
  // dimensions, set the em-base font-size relative to canvas width
  // (so production text sizes apply during DOM rendering), and apply
  // a transform: scale(N) so the stage visually fits the frame.
  // Called at the end of each draw routine + on phone-frame toggle.
  function applyCanvasSize(canvasW, canvasH) {
    const frame = document.getElementById('tpStageFrame');
    const stage = document.getElementById('tpStage');
    if (!frame || !stage) return;
    frame.style.aspectRatio = `${canvasW} / ${canvasH}`;
    stage.style.width  = `${canvasW}px`;
    stage.style.height = `${canvasH}px`;
    // Production-scale font: width/22 ≈ 45px on a 1000-wide canvas.
    // Em multipliers on every overlay element now produce real ad-sized
    // text instead of preview-cramped sub-pixel approximations.
    stage.style.fontSize = `${Math.max(12, canvasW / 22)}px`;
    // Two paths: actual-size pins the frame to the new pixel size,
    // fitted-mode lets the frame's CSS aspect-ratio stretch to the
    // available container width and applies a transform: scale(N).
    if (TP_STATE.actualSize) {
      requestAnimationFrame(applyActualSize);
    } else {
      requestAnimationFrame(applyStageScale);
    }
  }

  // Compute the scale factor so the stage fits the frame and apply it.
  // Called after layout is committed (RAF) so frame.clientWidth is real.
  // Honors TP_STATE.actualSize — when on, skips the scale entirely so the
  // canvas renders at native pixel dimensions (browser rendering quirks
  // like sub-pixel font hinting and image smoothing differ between
  // scaled and un-scaled rendering; the actual-size mode is the
  // diagnostic surface).
  function applyStageScale() {
    const frame = document.getElementById('tpStageFrame');
    const stage = document.getElementById('tpStage');
    if (!frame || !stage) return;
    if (TP_STATE.actualSize) {
      stage.style.transform = 'none';
      stage.style.transformOrigin = 'top left';
      return;
    }
    const stageW = parseFloat(stage.style.width) || 0;
    const stageH = parseFloat(stage.style.height) || 0;
    if (!stageW || !stageH) return;
    const fW = frame.clientWidth, fH = frame.clientHeight;
    if (!fW || !fH) return;
    const scale = Math.min(fW / stageW, fH / stageH);
    stage.style.transform = `scale(${scale.toFixed(4)})`;
    stage.style.transformOrigin = '';
  }

  // Toggle the frame between aspect-ratio-fit (default) and native canvas
  // pixel size. In actual-size mode the frame grows to the stage's pixel
  // dimensions and the surrounding tp-stage-wrap gets overflow:auto so
  // the user can scroll a 1000×1778 9:16 canvas at 1:1.
  function applyActualSize() {
    const frame = document.getElementById('tpStageFrame');
    const stage = document.getElementById('tpStage');
    const wrap  = frame?.closest('.tp-stage-wrap');
    if (!frame || !stage) return;
    const stageW = parseFloat(stage.style.width)  || 0;
    const stageH = parseFloat(stage.style.height) || 0;
    if (TP_STATE.actualSize) {
      // Pin frame to stage's native pixel dimensions, drop the
      // aspect-ratio constraint, allow the wrap to scroll.
      frame.style.aspectRatio = '';
      frame.style.width  = stageW ? `${stageW}px` : '';
      frame.style.height = stageH ? `${stageH}px` : '';
      frame.style.maxWidth  = 'none';
      frame.style.maxHeight = 'none';
      frame.style.flex      = 'none';
      if (wrap) {
        wrap.style.overflow      = 'auto';
        wrap.style.alignItems    = 'flex-start';
        wrap.style.justifyContent = 'flex-start';
      }
    } else {
      // Restore responsive aspect-ratio fit.
      if (stageW && stageH) frame.style.aspectRatio = `${stageW} / ${stageH}`;
      frame.style.width = '';  frame.style.height = '';
      frame.style.maxWidth = ''; frame.style.maxHeight = '';
      frame.style.flex = '';
      if (wrap) {
        wrap.style.overflow = '';
        wrap.style.alignItems = '';
        wrap.style.justifyContent = '';
      }
    }
    requestAnimationFrame(applyStageScale);
  }

  // Conservation slider — lives next to the debug chips. Drags coalesce via
  // a 300ms debounce, then refetch (with refresh:true to bypass the layout-
  // input cache, which is keyed on mediaId/template/ratio only). Non-overlay
  // templates ignore the value — the backend skips the placement pass.
  (function wireTpConservationSlider() {
    const slider = document.getElementById('tpConservationSlider');
    const valueEl = document.getElementById('tpConservationValue');
    if (!slider || !valueEl) return;
    slider.value = String(Math.round(TP_STATE.conservation * 100));
    valueEl.textContent = `${slider.value}%`;
    slider.addEventListener('input', () => {
      TP_STATE.conservation = Number(slider.value) / 100;
      valueEl.textContent = `${slider.value}%`;
      clearTimeout(tpConservationTimer);
      tpConservationTimer = setTimeout(() => { renderTemplatePreview(); }, 300);
    });
  })();

  async function renderTemplatePreview() {
    const panel = document.getElementById('templatePreviewPanel');
    if (!state.mediaId) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');

    // Reset chip selection on a new Media so we don't carry a stale template
    // choice between runs.
    if (TP_STATE.lastMediaId && TP_STATE.lastMediaId !== state.mediaId) {
      TP_STATE.template = null;
      TP_STATE.aspectRatio = '1:1';
    }
    TP_STATE.lastMediaId = state.mediaId;

    // Load the template registry once per render call (cheap; data is tiny).
    try {
      const [tmplRes, candRes] = await Promise.all([
        fetch('/api/layout-input/templates').then(r => r.json()),
        fetch(`/api/layout-input/candidates/${state.mediaId}?aspect_ratio=${encodeURIComponent(TP_STATE.aspectRatio)}`).then(r => r.json())
      ]);
      const templates = tmplRes.templates || [];
      TP_STATE.candidates = candRes.candidates || [];
      TP_STATE.supportedRatios = {};
      for (const t of templates) TP_STATE.supportedRatios[t.id] = t.supported_aspect_ratios || [];

      // Render-mode override — when ads.html bootstrap put a forced
      // template + ratio in window.__tpRenderForce, honor it before
      // any default-picking logic. Lets Puppeteer screenshot the
      // exact (template, ratio) pair the render service requested
      // regardless of what the candidate list says is "best."
      const force = (typeof window !== 'undefined' && window.__tpRenderForce) || null;
      if (force) {
        TP_STATE.template    = force.template;
        TP_STATE.aspectRatio = force.ratio;
      }

      // Pick a sensible default template — first passing one, else first listed.
      if (!TP_STATE.template) {
        const firstOk = TP_STATE.candidates.find(c => c.ok);
        TP_STATE.template = firstOk?.template_id || templates[0]?.id || null;
      }

      renderTpPickers(templates);
      await loadAndDrawPreview();
    } catch (err) {
      console.error('[templatePreview] renderTemplatePreview failed:', err);
      document.getElementById('tpStatus').innerHTML =
        `<p class="tp-bad">Failed to load templates: ${escapeHtml(err.message)}</p>`;
    }
  }

  function renderTpPickers(templates) {
    const tplChips  = document.getElementById('tpTemplateChips');
    const ratioChips = document.getElementById('tpRatioChips');
    tplChips.innerHTML = '';
    ratioChips.innerHTML = '';

    const candMap = {};
    for (const c of TP_STATE.candidates) candMap[c.template_id] = c;

    for (const t of templates) {
      const cand = candMap[t.id];
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tp-chip' +
        (t.id === TP_STATE.template ? ' active' : '') +
        (cand && !cand.ok ? ' disabled' : '');
      chip.textContent = t.ui_label || t.name || t.id;
      if (cand && !cand.ok) chip.title = tpValidationSummary(cand);
      chip.addEventListener('click', async () => {
        if (t.id === TP_STATE.template) return;
        TP_STATE.template = t.id;
        // If current ratio isn't supported by the new template, fall back.
        const supported = TP_STATE.supportedRatios[t.id] || [];
        if (!supported.includes(TP_STATE.aspectRatio)) TP_STATE.aspectRatio = supported[0] || '1:1';
        renderTpPickers(templates);
        await loadAndDrawPreview();
      });
      tplChips.appendChild(chip);
    }

    const supported = TP_STATE.supportedRatios[TP_STATE.template] || [];
    for (const r of ['1:1','4:5','9:16','16:9','1.91:1']) {
      const chip = document.createElement('button');
      chip.type = 'button';
      const isSupported = supported.includes(r);
      chip.className = 'tp-chip tp-chip-stacked' +
        (r === TP_STATE.aspectRatio ? ' active' : '') +
        (!isSupported ? ' disabled' : '');
      chip.innerHTML =
        `<span class="tp-chip-main">${escapeHtml(RATIO_USE_CASES[r]?.label || r)}</span>` +
        `<span class="tp-chip-sub">${escapeHtml(r)}</span>`;
      chip.title = RATIO_USE_CASES[r]?.tip || r;
      if (isSupported) {
        chip.addEventListener('click', async () => {
          if (r === TP_STATE.aspectRatio) return;
          TP_STATE.aspectRatio = r;
          renderTpPickers(templates);
          // Refresh candidates for the new ratio since validation is
          // ratio-aware (e.g. which templates even support 16:9).
          try {
            const res = await fetch(`/api/layout-input/candidates/${state.mediaId}?aspect_ratio=${encodeURIComponent(r)}`).then(r => r.json());
            TP_STATE.candidates = res.candidates || [];
          } catch (_) {}
          await loadAndDrawPreview();
        });
      }
      ratioChips.appendChild(chip);
    }
  }

  // Use-case taxonomy for the aspect-ratio chips. label = visible primary
  // line, tip = tooltip / more detail. Numeric ratio sits below as the
  // secondary line so the engineering value stays at hand.
  const RATIO_USE_CASES = {
    '1:1':    { label: 'IG feed',           tip: 'Instagram feed (square)' },
    '4:5':    { label: 'IG feed (portrait)', tip: 'Instagram feed (portrait), Pinterest' },
    '9:16':   { label: 'Reels / Stories',   tip: 'IG/TikTok Reels, IG Stories, Snap' },
    '1.91:1': { label: 'Link cards',        tip: 'Facebook/Instagram link cards, Twitter cards' },
    '16:9':   { label: 'YouTube',           tip: 'YouTube thumbnails, FB video feed' }
  };

  async function loadAndDrawPreview() {
    const stage = document.getElementById('tpStage');
    const status = document.getElementById('tpStatus');
    stage.innerHTML = '<div class="tp-empty">Loading…</div>';
    status.innerHTML = '';

    if (!TP_STATE.template || !TP_STATE.aspectRatio) {
      stage.innerHTML = '<div class="tp-empty">Pick a template to preview.</div>';
      return;
    }

    try {
      const res = await fetch('/api/layout-input?include=canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId:     state.mediaId,
          template:    TP_STATE.template,
          aspect_ratio: TP_STATE.aspectRatio,
          options:     { allow_invalid: true, conservation: TP_STATE.conservation },
          // Cache key is (mediaId, template, ratio) — doesn't include
          // conservation — so bypass the cache whenever we render. Cheap
          // for on-demand single-media preview; revisit if this lands on
          // a batch rendering path.
          refresh:     true
        })
      });
      const data = await res.json();
      // Diagnostic — picked up by the render service's page-signal
      // listener so a 0-size stage can be traced back to the actual
      // API response shape without redeploying.
      console.log('[templatePreview] /api/layout-input response: status=' + res.status +
        ' ok=' + res.ok +
        ' hasInput=' + !!data.input +
        ' hasCanvas=' + !!data.canvas +
        ' canvasInner=' + JSON.stringify(data.canvas?.canvas || null) +
        ' inputPlacement=' + !!data.input?.placement +
        ' template=' + TP_STATE.template +
        ' ratio=' + TP_STATE.aspectRatio);
      if (!res.ok && !data.input) {
        stage.innerHTML = '';
        status.innerHTML = `<p class="tp-bad">Request failed:</p><p>${escapeHtml(data.error || 'unknown')}</p>`;
        return;
      }

      TP_STATE.lastInput  = data.input;
      TP_STATE.lastCanvas = data.canvas;
      TP_STATE.lastStyleBindings = data.style_bindings || {};

      // Overlay-mode templates (testimonial_overlay) ship a `placement`
      // block with pre-computed element rects + text colors + scrim
      // intensity. Render via the placement path instead of the
      // canonical canvas-zone path.
      const isOverlayMode = !!data.input?.placement;

      if (isOverlayMode && data.input.placement.elements?.length) {
        drawOverlayCanvas(stage, data.input);
      } else if (isOverlayMode) {
        // Overlay mode but nothing placed — still show the stage (will
        // likely be mostly empty) so the decisions panel can explain why.
        drawOverlayCanvas(stage, data.input);
      } else if (!data.canvas) {
        stage.innerHTML = '<div class="tp-empty">No canvas spec for this combo.</div>';
      } else {
        drawTpCanvas(stage, data.input, data.canvas);
      }

      if (isOverlayMode) {
        renderOverlayDecisionsPanel(status, data.input, data.validation);
      } else {
        renderTpStatus(status, data.validation, data.input);
      }
      // Load brand webfont (if any) so composition actually uses it
      // instead of silently falling back to system-ui.
      ensureWebfontLoaded(data.input?.brand?.font_family);
      // Refresh the Brand Object + Matching tabs in parallel — the
      // right-panel tab structure exists only on ads.html, so each
      // helper no-ops on detect.html (or any host page lacking the
      // tab elements).
      refreshBrandObjectPane(data.input?.brand?.name);
      refreshMatchingPane(state.mediaId);
      document.getElementById('templatePreviewMeta').textContent =
        `${TP_STATE.template} · ${TP_STATE.aspectRatio} · ${data.validation?.ok ? 'valid' : 'invalid'}`;
    } catch (err) {
      console.error('[templatePreview] loadAndDrawPreview failed:', err);
      stage.innerHTML = '';
      status.innerHTML = `<p class="tp-bad">${escapeHtml(err.message)}</p>`;
    }
  }

  // Recompute the stage scale on viewport resize so the WYSIWYG preview
  // continues to fit when the user resizes the window or toggles the
  // tab pane width. Debounced via RAF so we don't churn during drags.
  let _resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(_resizeRaf);
    _resizeRaf = requestAnimationFrame(applyStageScale);
  });

  // Wire the Debug / Brand Object tabs once on first load. The host page
  // (ads.html) provides the .tp-tab buttons + .tp-tab-pane elements; if
  // they're absent (detect.html, anywhere else), this no-ops.
  (function wireTpTabs() {
    const tabs = document.querySelectorAll('.tp-tab');
    if (!tabs.length) return;
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tpTab;
        document.querySelectorAll('.tp-tab').forEach(t => t.classList.toggle('active', t.dataset.tpTab === target));
        document.querySelectorAll('.tp-tab-pane').forEach(p => p.classList.toggle('active', p.dataset.tpPane === target));
      });
    });
  })();

  // Fetch the full Brand catalog doc by name and render every stored
  // field into the Brand Object tab. Uses /api/brand/by-name/:name —
  // returns the entire doc, not the subset that ships in input.brand.
  async function refreshBrandObjectPane(brandName) {
    const pane = document.getElementById('tpBrandObject');
    if (!pane) return;
    if (!brandName) {
      pane.innerHTML = '<p class="tp-brand-empty">No brand on this Media.</p>';
      return;
    }
    pane.innerHTML = '<p class="tp-brand-empty">Loading brand…</p>';
    try {
      const res = await fetch(`/api/brand/by-name/${encodeURIComponent(brandName)}`);
      if (res.status === 404) {
        pane.innerHTML = `<p class="tp-brand-empty">No catalog entry for <code>${escapeHtml(brandName)}</code>.</p>`;
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      pane.innerHTML = renderBrandObject(data.brand);
    } catch (err) {
      pane.innerHTML = `<p class="tp-brand-error">Brand fetch failed: ${escapeHtml(err.message)}</p>`;
    }
  }

  function renderBrandObject(brand) {
    if (!brand) return '<p class="tp-brand-empty">empty</p>';
    const isCurated = (k) => Array.isArray(brand.curatedFields) && brand.curatedFields.includes(k);
    const curatedTag = (k) => isCurated(k) ? '<span class="tp-brand-curated-tag">curated</span>' : '';

    const isHexColor = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
    const colorVal = (hex, key) => isHexColor(hex)
      ? `<span class="tp-brand-swatch" style="background:${hex}"></span><code>${escapeHtml(hex)}</code>${curatedTag(key)}`
      : empty();
    // Inline pill for the font's provenance — distinguishes a real
    // brand font (Brandfetch / scraped from the brand's site) from
    // an approximation (suggested by GPT, or tone-mapped fallback).
    const fontSourceBadge = (src) => {
      if (!src || src === 'curated') return '';
      const label = src === 'brandfetch'   ? 'brandfetch'
                  : src === 'scraped'      ? 'scraped'
                  : src === 'suggested'    ? 'suggested'
                  : src === 'tone-default' ? 'tone-default'
                  : src;
      return ` <span class="tp-brand-tag" style="font-size:9px;padding:1px 6px;opacity:0.75;">${escapeHtml(label)}</span>`;
    };
    const empty = () => '<span class="empty">—</span>';
    const txt = (v, key) => (v == null || v === '')
      ? empty()
      : `${escapeHtml(String(v))}${curatedTag(key)}`;
    const row = (k, v) => `<div class="tp-brand-row"><div class="tp-brand-key">${escapeHtml(k)}</div><div class="tp-brand-val">${v}</div></div>`;
    const sec = (label) => `<div class="tp-brand-section">${escapeHtml(label)}</div>`;

    const parts = [];

    // Identity
    parts.push(sec('Identity'));
    parts.push(row('name', txt(brand.name, 'name')));
    parts.push(row('tagline', txt(brand.tagline, 'tagline')));
    parts.push(row('summary', brand.summary
      ? `<div style="white-space:pre-wrap;">${escapeHtml(brand.summary)}</div>${curatedTag('summary')}`
      : empty()));
    parts.push(row('websiteUrl', brand.websiteUrl
      ? `<a href="${escapeHtml(brand.websiteUrl)}" target="_blank" rel="noopener" style="color:#93c5fd;">${escapeHtml(brand.websiteUrl)}</a>`
      : empty()));

    // Visual identity
    parts.push(sec('Visual'));
    parts.push(row('logo', brand.logoUrl
      ? `<img class="tp-brand-logo-thumb" src="${escapeHtml(brand.logoUrl)}" alt="logo" />${curatedTag('logoUrl')}`
      : empty()));
    parts.push(row('primary', colorVal(brand.primaryColor, 'primaryColor')));
    parts.push(row('secondary', colorVal(brand.secondaryColor, 'secondaryColor')));
    parts.push(row('accent', colorVal(brand.accentColor, 'accentColor')));
    parts.push(row('font', brand.fontFamily
      ? `${escapeHtml(brand.fontFamily)}${fontSourceBadge(brand.fontSource)}${curatedTag('fontFamily')}`
      : empty()));

    // Voice
    parts.push(sec('Voice'));
    const tones = Array.isArray(brand.tone) ? brand.tone : [];
    parts.push(row('tone', tones.length
      ? tones.map(t => `<span class="tp-brand-tag">${escapeHtml(t)}</span>`).join('') + curatedTag('tone')
      : empty()));
    const hashtags = Array.isArray(brand.hashtags) ? brand.hashtags : [];
    parts.push(row('hashtags', hashtags.length
      ? hashtags.map(h => `<span class="tp-brand-tag">${escapeHtml(h)}</span>`).join('') + curatedTag('hashtags')
      : empty()));
    const tags = Array.isArray(brand.tags) ? brand.tags : [];
    parts.push(row('tags', tags.length
      ? tags.map(t => `<span class="tp-brand-tag">${escapeHtml(t)}</span>`).join('') + curatedTag('tags')
      : empty()));

    // Demographics
    const demos = Array.isArray(brand.demographics) ? brand.demographics : [];
    if (demos.length) {
      parts.push(sec(`Demographics (${demos.length})`));
      parts.push('<div>' + demos.map(d => `
        <div class="tp-brand-persona">
          <div class="tp-brand-persona-name">${escapeHtml(d.name || 'unnamed')}</div>
          ${d.description ? `<div class="tp-brand-persona-desc">${escapeHtml(d.description)}</div>` : ''}
          ${Array.isArray(d.interests) && d.interests.length ? `<div class="tp-brand-persona-desc"><strong>likes:</strong> ${d.interests.map(escapeHtml).join(', ')}</div>` : ''}
          ${Array.isArray(d.painPoints) && d.painPoints.length ? `<div class="tp-brand-persona-desc"><strong>worries:</strong> ${d.painPoints.map(escapeHtml).join(', ')}</div>` : ''}
        </div>
      `).join('') + '</div>');
    }

    // Provenance
    parts.push(sec('Provenance'));
    parts.push(row('source', brand.source
      ? `<span class="tp-brand-tag tp-brand-source-${brand.source}">${escapeHtml(brand.source)}</span>`
      : empty()));
    parts.push(row('curatedFields', Array.isArray(brand.curatedFields) && brand.curatedFields.length
      ? brand.curatedFields.map(f => `<code>${escapeHtml(f)}</code>`).join(' · ')
      : empty()));
    parts.push(row('enrichedAt', brand.enrichedAt
      ? new Date(brand.enrichedAt).toLocaleString()
      : empty()));
    parts.push(row('createdAt', brand.createdAt
      ? new Date(brand.createdAt).toLocaleString()
      : empty()));

    return parts.join('');
  }

  // Fetch the latest ProductMatchArtifact and render the Matching tab.
  // Shows decision-tree outcome, identification card, per-provider
  // evidence, brand-category fallback, brand reviews, and the YOLO+GPT
  // identifications that fed the decision.
  async function refreshMatchingPane(mediaId) {
    const pane = document.getElementById('tpMatching');
    if (!pane) return;
    if (!mediaId) {
      pane.innerHTML = '<p class="tp-match-empty">No media selected.</p>';
      return;
    }
    pane.innerHTML = '<p class="tp-match-empty">Loading match…</p>';
    try {
      const res = await fetch(`/api/media/${encodeURIComponent(mediaId)}/match`);
      if (res.status === 404) {
        pane.innerHTML = '<p class="tp-match-empty">No match artifact yet — detect run hasn\'t reached product-match for this Media.</p>';
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      pane.innerHTML = renderMatchingArtifact(data.match);
    } catch (err) {
      pane.innerHTML = `<p class="tp-match-error">Match fetch failed: ${escapeHtml(err.message)}</p>`;
    }
  }

  function renderMatchingArtifact(match) {
    if (!match) return '<p class="tp-match-empty">empty</p>';
    const sec = (label) => `<div class="tp-match-section">${escapeHtml(label)}</div>`;
    const parts = [];

    // ── Outcome banner ──
    const outcome   = match.outcome || 'unknown';
    const reasoning = match.outcomeReasoning || '';
    const winner    = match.winner || null;
    parts.push(
      `<div class="tp-match-outcome-row">` +
        `<span class="tp-match-badge outcome-${outcome}">${escapeHtml(outcome.replace(/_/g, ' '))}</span>` +
        (winner ? `<span class="tp-match-winner">winner: <code>${escapeHtml(winner)}</code></span>` : '') +
        (reasoning ? `<div class="tp-match-reasoning">${escapeHtml(reasoning)}</div>` : '') +
      `</div>`
    );

    // ── Catalog match (the GPT-4.1 reasoner identification) ──
    const ident = match.identification;
    if (ident) {
      parts.push(sec('Catalog match (reasoner)'));
      const certPct = typeof ident.certainty === 'number' ? `${(ident.certainty * 100).toFixed(0)}%` : '—';
      const detailBits = [];
      if (ident.brand)               detailBits.push(`brand: <code>${escapeHtml(ident.brand)}</code>`);
      if (ident.certaintyLabel)      detailBits.push(`label: ${escapeHtml(ident.certaintyLabel)}`);
      detailBits.push(`certainty: <code>${certPct}</code>`);
      if (ident.details?.price?.display) detailBits.push(`price: <code>${escapeHtml(ident.details.price.display)}</code>`);
      if (typeof ident.details?.rating === 'number') detailBits.push(`rating: <code>${ident.details.rating.toFixed(1)}★</code>`);
      if (typeof ident.details?.reviewCount === 'number') detailBits.push(`reviews: <code>${ident.details.reviewCount.toLocaleString()}</code>`);
      parts.push(
        `<div class="tp-match-card">` +
          `<div class="tp-match-card-title">${escapeHtml(ident.productName || '(no product name)')}</div>` +
          `<div class="tp-match-card-meta">${detailBits.join(' · ')}</div>` +
          (ident.details?.reviewSummary?.summary
            ? `<div class="tp-match-card-meta" style="margin-top:6px;color:#888;">"${escapeHtml(ident.details.reviewSummary.summary)}"</div>`
            : '') +
        `</div>`
      );
    } else {
      parts.push(sec('Catalog match'));
      parts.push('<div class="tp-match-card"><div class="tp-match-card-meta">no reasoner identification</div></div>');
    }

    // ── Brand collection page (filled for product_category outcomes
    //    AND every product_match outcome — every identified product
    //    knows which brand collection it belongs to). ──
    if (match.brandCategory && (match.brandCategory.url || match.brandCategory.breadcrumb)) {
      parts.push(sec('Brand collection (category fallback)'));
      const bc = match.brandCategory;
      parts.push(
        `<div class="tp-match-card">` +
          (bc.breadcrumb ? `<div class="tp-match-card-title">${escapeHtml(bc.breadcrumb)}</div>` : '') +
          (bc.url
            ? `<div class="tp-match-card-meta"><a class="tp-match-link" href="${escapeHtml(bc.url)}" target="_blank" rel="noopener">${escapeHtml(bc.url)}</a></div>`
            : '') +
          (typeof bc.confidence === 'number'
            ? `<div class="tp-match-card-meta" style="margin-top:4px;">confidence: <code>${(bc.confidence * 100).toFixed(0)}%</code></div>`
            : '') +
        `</div>`
      );
    }

    // ── Brand reviews (only when outcome === 'brand_match') ──
    if (match.brandReviews && Array.isArray(match.brandReviews.quotes) && match.brandReviews.quotes.length) {
      const br = match.brandReviews;
      const meta = [];
      if (typeof br.rating === 'number')      meta.push(`${br.rating.toFixed(1)}★`);
      if (typeof br.reviewCount === 'number') meta.push(`${br.reviewCount.toLocaleString()} reviews`);
      parts.push(sec(`Brand reviews${meta.length ? ' (' + meta.join(' · ') + ')' : ''}`));
      if (br.summary) {
        parts.push(`<div class="tp-match-card"><div class="tp-match-card-meta" style="color:#ccc;font-style:italic;">${escapeHtml(br.summary)}</div></div>`);
      }
      for (const q of br.quotes.slice(0, 6)) {
        parts.push(
          `<div class="tp-match-quote">` +
            `<div class="tp-match-quote-text">"${escapeHtml(q.text)}"</div>` +
            ((q.author || q.source)
              ? `<div class="tp-match-quote-meta">— ${escapeHtml(q.author || 'unknown')}${q.source ? ` · ${escapeHtml(q.source)}` : ''}</div>`
              : '') +
          `</div>`
        );
      }
    }

    // ── Per-provider evidence ──
    const providers = match.providers || {};
    const providerNames = Object.keys(providers);
    if (providerNames.length) {
      parts.push(sec(`Provider matches (${providerNames.length})`));
      for (const name of providerNames) {
        const p = providers[name];
        const matches = Array.isArray(p?.matches) ? p.matches : [];
        parts.push(
          `<div class="tp-match-provider">` +
            `<div class="tp-match-provider-head">` +
              `<span class="tp-match-provider-name">${escapeHtml(name)}</span>` +
              `<span class="tp-match-provider-count">${matches.length} match${matches.length === 1 ? '' : 'es'}</span>` +
            `</div>` +
            (p?.reasoning
              ? `<div class="tp-match-provider-reason">${escapeHtml(p.reasoning.length > 280 ? p.reasoning.slice(0, 277) + '…' : p.reasoning)}</div>`
              : '') +
            (p?.queryUsed
              ? `<div class="tp-match-provider-reason"><strong>query:</strong> <code style="color:#e879f9;">${escapeHtml(p.queryUsed)}</code></div>`
              : '') +
            matches.slice(0, 6).map(m =>
              `<a class="tp-match-link" href="${escapeHtml(m.url || '#')}" target="_blank" rel="noopener" title="${escapeHtml(m.title || m.url || '')}">` +
                (m.retailer ? `<span class="retailer">${escapeHtml(m.retailer)}</span>` : '') +
                escapeHtml(m.title || m.url || '(no title)') +
              `</a>`
            ).join('') +
          `</div>`
        );
      }
    }

    // ── Errors per provider (skipped/failed) ──
    const errors = match.errors || {};
    const errorNames = Object.keys(errors);
    if (errorNames.length) {
      parts.push(sec(`Provider errors (${errorNames.length})`));
      for (const name of errorNames) {
        parts.push(
          `<div class="tp-match-provider">` +
            `<div class="tp-match-provider-head">` +
              `<span class="tp-match-provider-name" style="color:#f87171;">${escapeHtml(name)}</span>` +
              `<span class="tp-match-provider-count">error</span>` +
            `</div>` +
            `<div class="tp-match-provider-reason">${escapeHtml(errors[name])}</div>` +
          `</div>`
        );
      }
    }

    // ── Query used (the inputs the matcher saw) ──
    if (match.query) {
      const q = match.query;
      parts.push(sec('Query inputs'));
      const queryRows = [];
      if (q.brand)          queryRows.push(`brand: <code>${escapeHtml(q.brand)}</code>`);
      if (q.brandUrl)       queryRows.push(`brandUrl: <code>${escapeHtml(q.brandUrl)}</code>`);
      if (q.category)       queryRows.push(`category: <code>${escapeHtml(q.category)}</code>`);
      if (q.primarySubject) queryRows.push(`subject: ${escapeHtml(q.primarySubject)}`);
      if (q.caption)        queryRows.push(`caption: "${escapeHtml(q.caption)}"`);
      if (Array.isArray(q.textDetected) && q.textDetected.length) queryRows.push(`text: ${q.textDetected.map(t => `"${escapeHtml(t)}"`).join(', ')}`);
      parts.push(`<div class="tp-match-card"><div class="tp-match-card-meta" style="line-height:1.7;">${queryRows.join('<br>') || 'no query data'}</div></div>`);
    }

    // ── Footer ──
    if (match.createdAt) {
      parts.push(`<div class="tp-match-section" style="margin-top:14px;color:#444;">Resolved ${new Date(match.createdAt).toLocaleString()}</div>`);
    }

    return parts.join('');
  }

  function drawTpCanvas(stage, input, canvas) {
    // Deep-clone so per-draw mutations (zone_scalers application,
    // reflow rect adjustments) don't compound across redraws. The
    // stored TP_STATE.lastCanvas keeps the pristine spec; this local
    // copy is the working canvas for THIS draw.
    canvas = JSON.parse(JSON.stringify(canvas));
    const w = canvas.canvas.width, h = canvas.canvas.height;
    stage.innerHTML = '';
    // WYSIWYG: render at full canvas pixel size and scale via CSS.
    applyCanvasSize(w, h);

    // Apply per-(template × ratio) zone_scalers from the canvas spec
    // BEFORE the zone-paint loop, so the rect-to-percent conversion
    // already reflects the scaled height. Each zone with an entry in
    // canvas.zone_scalers gets:
    //   - rect.h × scale   (slot grows vertically)
    //   - --tp-zone-scale CSS var on the element (font-size rules in
    //     ads.html consume this via calc(<base>em * var(--tp-zone-scale,
    //     1)) so the rendered font + em-relative descendants — rating
    //     digits, callout glyphs, eyebrow text — all scale together).
    // The match key prefers zone.id, falls back to zone.kind so a
    // scaler keyed on either form lands.
    // Per-zone scalers come from canvas.zone_scalers. Two shapes:
    //   numeric N         → shorthand for { slot: N, font: N } (legacy)
    //   { slot, font }    → fine-grained — slot scales rect.h, font
    //                       scales the --tp-zone-scale CSS var. Either
    //                       key can be omitted (defaults to 1).
    // Used so a zone can scale its TEXT to match a sibling (e.g.
    // quote_card font 1.6 to match the eyebrow's effective size at
    // scale 2) without scaling the slot height — the reflow pass
    // shrinks the slot to fit content instead.
    const zoneScalers = canvas.zone_scalers || {};
    const resolveZoneScale = (raw) => {
      if (typeof raw === 'number') return { slot: raw, font: raw };
      if (raw && typeof raw === 'object') {
        return { slot: raw.slot ?? 1, font: raw.font ?? 1 };
      }
      return { slot: 1, font: 1 };
    };
    const zoneScaleFor = (zone) =>
      resolveZoneScale(zoneScalers[zone.id] ?? zoneScalers[zone.kind]);
    for (const zone of (canvas.zones || [])) {
      // Stash design (un-scaled, un-reflowed) y + h so subsequent
      // reflow passes can compute gaps against canvas-spec values
      // even after an earlier pass mutated rect.y or rect.h.
      // Without this, a second reflow (e.g. quote_card after
      // headline) would use the post-headline-cascade rect.y as
      // its origY, miscompute the gap to the next dep, and stack
      // shifts incorrectly.
      zone._design_h = zone.rect.h;
      zone._design_y = zone.rect.y;
      const { slot } = zoneScaleFor(zone);
      if (slot !== 1) zone.rect.h = zone.rect.h * slot;
    }

    // Pull brand tokens once. Primary/secondary/accent all fall back to
    // sensible neutrals so the preview still renders when a Brand stub
    // hasn't been enriched yet.
    const brand = input.brand || {};
    const primary   = isHex(brand.primary_color)   ? brand.primary_color   : '#1f2937';
    const secondary = isHex(brand.secondary_color) ? brand.secondary_color : tpDarken(primary, 0.35);
    const accent    = isHex(brand.accent_color)    ? brand.accent_color    : '#ef4444';
    const textOn    = tpReadableOn(primary);
    const fontStack = brand.font_family
      ? `"${brand.font_family}", system-ui, -apple-system, "Segoe UI", sans-serif`
      : 'system-ui, -apple-system, "Segoe UI", sans-serif';

    stage.style.setProperty('--brand-primary',   primary);
    stage.style.setProperty('--brand-secondary', secondary);
    stage.style.setProperty('--brand-accent',    accent);
    stage.style.setProperty('--brand-text-on',   textOn);
    // Per-surface readable foregrounds.
    stage.style.setProperty('--brand-text-on-primary',   tpReadableOn(primary));
    stage.style.setProperty('--brand-text-on-secondary', tpReadableOn(secondary));
    stage.style.setProperty('--brand-text-on-accent',    tpReadableOn(accent));
    stage.style.setProperty('--brand-font',      fontStack);

    // Apply the resolved style_bindings (image-led palette for
    // testimonial_overlay, brand-led for the others). The backend walks
    // source_priority chains per template; we just project the result
    // as --tp-style-<name> CSS vars so per-template CSS rules can opt
    // to read them via var(--tp-style-..., var(--brand-...)). The
    // 'auto-from-brightness' sentinel stays a string in the var; CSS
    // checks for it and falls back to the brightness-derived var.
    applyStyleBindingsToStage(stage, TP_STATE.lastStyleBindings || {});

    // Canvas background — derive from spec + brand palette. 'solid' and
    // 'brand_fill' paint the brand primary; 'gradient' interpolates primary
    // → secondary; image/video modes fall back to brand primary as a base
    // color (the real renderer layers the asset on top).
    const bgStyle = canvas.canvas.background?.style || 'gradient';
    if (bgStyle === 'gradient') {
      stage.style.background = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
    } else if (bgStyle === 'solid' || bgStyle === 'brand_fill') {
      stage.style.background = primary;
    } else {
      stage.style.background = primary;
    }

    // Font-size is now baked in by applyCanvasSize() against canvas
    // pixel width, so em units render at production sizes regardless of
    // how the stage is visually scaled afterward.

    const zoneEls = [];
    for (const zone of (canvas.zones || [])) {
      const el = document.createElement('div');
      // style_variant is per-zone styling pivot (e.g. quote_card with_author_photo,
      // text section_header, badge_row callouts). Renders as 'style-<variant>'
      // class so CSS can scope on '.tp-zone.kind-X.style-Y'.
      const variantCls = zone.style_variant ? ` style-${zone.style_variant}` : '';
      // When the resolved headline_text_color falls through to its white
      // default (palette was monochromatic / mono-hue / failed contrast
      // gate), tag the zone so CSS can disable the top→bottom gradient
      // that would otherwise turn white into #B3B3B3 at the bottom.
      // Vibrant picks (flame orange in the HCO reference) keep the
      // gradient because the depth effect actually reads on saturated
      // colors. Hex compare is case-insensitive.
      const isWhiteHeadline = zone.style_variant === 'display_script'
        && /^#?ffffff$/i.test(String(TP_STATE.lastStyleBindings?.headline_text_color || '#FFFFFF'));
      const solidCls = isWhiteHeadline ? ' solid-headline' : '';
      el.className = `tp-zone kind-${zone.kind}${variantCls}${solidCls}`;
      el.style.left   = `${(zone.rect.x / w * 100).toFixed(2)}%`;
      el.style.top    = `${(zone.rect.y / h * 100).toFixed(2)}%`;
      el.style.width  = `${(zone.rect.w / w * 100).toFixed(2)}%`;
      el.style.height = `${(zone.rect.h / h * 100).toFixed(2)}%`;
      // Project the FONT scaler as a CSS var so the matching CSS
      // font-size rules in ads.html (eyebrow_rules / proof_bar /
      // badge_row callouts / quote_card with_author_photo) read it
      // via calc(<base>em * var(--tp-zone-scale, 1)). Slot scaling
      // already happened above on rect.h.
      const { font: fontScale } = zoneScaleFor(zone);
      if (fontScale !== 1) el.style.setProperty('--tp-zone-scale', String(fontScale));
      // Don't clip the radius for landscape variants — the new layout
      // uses radius up to 24px on cards, which the prior 18px cap broke.
      if (typeof zone.radius === 'number') el.style.borderRadius = `${zone.radius}px`;

      el.innerHTML = resolveZoneContent(zone, input);
      stage.appendChild(el);
      zoneEls.push({ zone, el });
    }

    // Reflow pass — when the headline content is shorter than its
    // budgeted slot height (Gemini wrote a 1- or 2-line headline into a
    // 3-line slot), shrink the headline rect to its natural content
    // height and redistribute the freed vertical to slots BELOW it in
    // the same column. Below-slots move up to keep their original gaps
    // and grow proportionally to their original heights, so the dark
    // panel stays balanced instead of leaving a dead band under a
    // short headline.
    //
    // Order matters: reflow MUST run before fitAndClampZone so the
    // auto-fit measures against the redistributed (taller) below-slot
    // rects and lets bigger content like the quote_card breathe.
    requestAnimationFrame(() => {
      // 1. Headline-driven pass — handles depDelta from zone_scalers
      //    (eyebrow / proof_bar / badge_row growth) and short-content
      //    headline shrinkage. Touches all deps including cta.
      // 2. Quote_card-driven pass — shrinks the quote slot to its
      //    natural rendered text height (after the font scaler is
      //    applied) and pushes the freed space into ONLY the slots
      //    below it in the same column (excludes cta — the bottom-
      //    pinned anchor). Runs second so it sees the post-headline
      //    geometry and the natural-height measurement reflects the
      //    scaled font.
      reflowColumnUnderHeadline(zoneEls, w, h);
      reflowColumnUnderQuoteCard(zoneEls, w, h);
      reflowColumnUnderProductMeta(zoneEls, w, h);

      // Adaptive badge_row pass — let badges flow with text wrapping
      // (each label up to 2 lines via CSS clamp), hide any badge in
      // row 5+, then grow the slot to fit the visible rows (capped
      // at the next zone in the same column).
      for (const { zone, el } of zoneEls) {
        if (zone.kind === 'badge_row' && zone.style_variant === 'callouts') {
          fitBadgeRow(el, zone, zoneEls, w, h, 4);
        }
      }

      for (const { zone, el } of zoneEls) {
        if (zone.kind === 'text' || zone.kind === 'quote_card') {
          // Display-script headlines need a lower minScale floor so a
          // 4-line word break can collapse hard into the 180-200px zone.
          // Generic text/quote zones keep the 0.6 default to preserve
          // legibility.
          const minScale = zone.style_variant === 'display_script' ? 0.40 : 0.6;
          fitAndClampZone(el, zone.max_lines || 4, minScale);
        }
      }
    });

    // Restriction layer for canonical templates. Canonical templates today
    // don't carry a placement.analysis block — the restriction data only
    // exists on OverlayZoneArtifact via the overlay-mode path. Future work
    // (see backlog: "surface restriction analysis on canonical previews")
    // will pipe it through. For now, nothing to draw here — the chip toggle
    // stays a no-op on canonical.

    // Canvas-zone debug layer — dashed rect per canvas zone with id+kind+slot
    // label. Same container as overlay-mode debug boxes so the toggle behaves
    // uniformly across templates.
    if (TP_STATE.showDebugBoxes) {
      const layer = document.createElement('div');
      layer.className = 'tp-debug-layer';
      for (const zone of (canvas.zones || [])) {
        const box = document.createElement('div');
        box.className = 'tp-debug-box kind-canvas-zone';
        box.style.cssText =
          `left:${(zone.rect.x / w * 100).toFixed(2)}%;top:${(zone.rect.y / h * 100).toFixed(2)}%;` +
          `width:${(zone.rect.w / w * 100).toFixed(2)}%;height:${(zone.rect.h / h * 100).toFixed(2)}%;`;
        const lbl = document.createElement('span');
        lbl.className = 'tp-debug-label';
        // zone.slot is string | string[] | null per the canvas spec
        // (composite zones like eyebrow_rules carry an array of fallback
        // slot paths). Tail the last segment of whichever path we land
        // on; never crash on an unexpected shape since this label is
        // diagnostic-only and should not break the render path.
        let slotBit = '';
        try {
          const raw = Array.isArray(zone.slot) ? zone.slot[0] : zone.slot;
          if (typeof raw === 'string' && raw.length) {
            slotBit = ` · ${raw.split('.').slice(-1)[0]}`;
          }
        } catch (_) { /* keep slotBit '' */ }
        lbl.textContent = `${zone.id || zone.kind}${slotBit}`;
        box.appendChild(lbl);
        layer.appendChild(box);
      }
      stage.appendChild(layer);
    }
  }

  // Project the backend's resolved style_bindings onto CSS custom
  // properties so per-template CSS can read them via
  // var(--tp-style-<name>). Names are kebab-cased — scrim_tint →
  // --tp-style-scrim-tint. Skips 'auto-from-brightness' (sentinel
  // for renderer-computed contrast) so CSS fallback chains still
  // resolve to the brightness-derived var.
  function applyStyleBindingsToStage(stage, bindings) {
    if (!stage || !bindings) return;
    for (const [name, value] of Object.entries(bindings)) {
      if (value == null) continue;
      if (typeof value === 'string' && value === 'auto-from-brightness') continue;
      const cssName = '--tp-style-' + name.replace(/_/g, '-');
      stage.style.setProperty(cssName, String(value));
    }
    // Auto-derive readable text foregrounds for surface/text binding
    // pairs whose text resolved to the auto-from-brightness sentinel
    // (or wasn't set at all). Without this the CSS falls back to
    // var(--brand-text-on) which is computed against brand.primary —
    // unrelated to the actual button bg. Result: white CTA text
    // sitting on a near-white palette pick = washed out.
    const autoPairs = [
      ['cta_button_bg', 'cta_button_text'],
      ['proof_bar_bg',  'proof_bar_text']
    ];
    for (const [bgKey, textKey] of autoPairs) {
      const bg = bindings[bgKey];
      const text = bindings[textKey];
      const wantsAuto = !text || text === 'auto-from-brightness';
      if (!wantsAuto) continue;
      if (typeof bg !== 'string' || !isHex(bg)) continue;
      const cssName = '--tp-style-' + textKey.replace(/_/g, '-');
      stage.style.setProperty(cssName, tpReadableOn(bg));
    }
  }

  // Pass-through. Earlier versions chained c_fill,g_auto,w_<slot>,h_<slot>
  // here so Cloudinary would crop the delivered image to the slot's
  // exact dimensions using subject-aware gravity — but that meant a
  // SECOND crop on top of the detect-pipeline judge winner already
  // baked into the source URL. Cloudinary's g_auto would re-pick a
  // subject on the already-cropped frame and shift the framing,
  // overriding the judge's choice. Returning the URL unchanged
  // preserves the detect winner verbatim; the .tp-zone img / video
  // CSS rule (object-fit: cover) center-crops in the browser to fit
  // the slot — dumber than g_auto but faithful to the source.
  // Signature kept so callers don't change.
  function slotFitCloudinaryUrl(url, _slotW, _slotH) {
    return url;
  }

  // Format a product price into a display string, accepting:
  //   number              → "$N.NN"
  //   string              → as-is
  //   { display }         → display
  //   { value, currency } → currency + value
  // Returns '' for null / undefined / unparseable.
  function formatProductPrice(price) {
    if (price == null) return '';
    if (typeof price === 'string') return price.trim();
    if (typeof price === 'number') {
      if (!Number.isFinite(price)) return '';
      return '$' + price.toFixed(2);
    }
    if (typeof price === 'object') {
      if (typeof price.display === 'string' && price.display.trim()) return price.display.trim();
      const cur = typeof price.currency === 'string' ? price.currency : '$';
      if (price.value != null) return cur + String(price.value);
    }
    return '';
  }

  function isHex(s) { return typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s); }

  // Darken a hex color by `amount` (0..1). Returns the original if malformed.
  function tpDarken(hex, amount) {
    if (!isHex(hex)) return hex;
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 0xff) * (1 - amount));
    const g = Math.round(((n >>  8) & 0xff) * (1 - amount));
    const b = Math.round((n & 0xff)         * (1 - amount));
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  // Pick readable foreground (white or near-black) for text on a given bg
  // using standard relative-luminance.
  function tpReadableOn(hex) {
    if (!isHex(hex)) return '#ffffff';
    const L = tpRelLum(hex);
    return L > 0.55 ? '#0a0a0a' : '#ffffff';
  }

  // WCAG relative luminance (0..1) for a hex color.
  function tpRelLum(hex) {
    if (!isHex(hex)) return 0.5;
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 0xff) / 255;
    const g = ((n >>  8) & 0xff) / 255;
    const b = (n & 0xff)         / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // Hex → rgba string with arbitrary alpha. Used for borders/scrims that
  // need to derive a translucent variant of a base color.
  function tpHexToRgba(hex, alpha) {
    if (!isHex(hex)) return `rgba(0,0,0,${alpha})`;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n>>16)&0xff},${(n>>8)&0xff},${n&0xff},${alpha})`;
  }

  // Pick the fill color for the CTA pill. Prefer accent; if accent is
  // missing or near-white (would disappear on a light photo), fall
  // through to primary; final fallback is the brand-default red.
  function pickCtaFillColor(brand) {
    const accent  = isHex(brand?.accent_color)  ? brand.accent_color  : null;
    const primary = isHex(brand?.primary_color) ? brand.primary_color : null;
    const tooLight = (c) => tpRelLum(c) > 0.85;
    if (accent  && !tooLight(accent))  return accent;
    if (primary && !tooLight(primary)) return primary;
    return accent || primary || '#ef4444';
  }

  // Pick headline text color + any scrim-opacity boost needed for contrast.
  // Tries brand.accent_color, then brand.primary_color; falls back to
  // white/black derived from scrim type. Returns { color, scrimBoost }.
  function pickHeadlineColor(brand, scrim) {
    const scrimDark = scrim?.type === 'gradient-dark';
    const needLight = scrimDark;
    const want = needLight
      ? (L) => L > 0.55   // bright color on dark scrim
      : (L) => L < 0.45;  // dark color on light scrim

    const candidates = [brand?.accent_color, brand?.primary_color]
      .filter(isHex);

    for (const c of candidates) {
      if (want(tpRelLum(c))) return { color: c, scrimBoost: 0 };
    }
    // No brand color had the right luminance. Pick the least-bad one and
    // boost the scrim so it provides enough contrast on its own.
    const best = candidates.length ? candidates[0] : null;
    if (best) {
      const L = tpRelLum(best);
      const gap = Math.abs(L - (needLight ? 1 : 0));
      if (gap > 0.35) return { color: best, scrimBoost: 0.15 };
    }
    return { color: needLight ? '#FFFFFF' : '#0A0A0A', scrimBoost: 0 };
  }

  // Load a Google-Fonts webfont for the brand's face so the preview
  // actually uses it. Google's CSS2 endpoint returns 404 silently when
  // the font isn't hosted there, so a non-Google brand font falls back
  // to system-ui with no error — and a Google-hosted one lights up.
  // Loaded once per family via a stable element id.
  function ensureWebfontLoaded(family) {
    if (!family || typeof family !== 'string') return;
    const clean = family.trim();
    if (!clean) return;
    const id = 'tp-webfont-' + clean.replace(/[^a-z0-9]/gi, '');
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    // Request 400 regular, 700 bold, 800 extrabold, 900 black + italics
    // so every block (body, headline, italic quote, CTA) has a face.
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(clean).replace(/%20/g, '+')}:ital,wght@0,400;0,700;0,800;0,900;1,400;1,700&display=swap`;
    document.head.appendChild(link);
  }

  // brand.tone[] → concrete text-transform + weight + letter-spacing hints
  // for the headline. Default covers unknown tones. Keeps a single source
  // of style truth so headline / logo fallback / future elements can all
  // reuse it without re-deriving.
  function toneToHeadlineStyle(tones, variant) {
    const t = new Set((tones || []).map(x => String(x).toLowerCase()));
    const stacked = variant && variant.startsWith('stacked');

    // Tone-driven overrides; checked in priority order so the first match
    // wins (bold beats premium beats playful etc.).
    if (t.has('bold') || t.has('loud') || t.has('energetic') || t.has('confident')) {
      return { transform: stacked ? 'none' : 'uppercase', weight: 900, letterSpacing: stacked ? '-0.01em' : '0.02em' };
    }
    if (t.has('premium') || t.has('luxury') || t.has('refined') || t.has('elegant')) {
      return { transform: 'uppercase', weight: 700, letterSpacing: '0.14em' };
    }
    if (t.has('playful') || t.has('friendly') || t.has('warm') || t.has('casual')) {
      return { transform: 'none', weight: 800, letterSpacing: '-0.01em' };
    }
    // Default: variant-aware — horizontal hero = all-caps punch; stacked
    // = title-case (shorter lines already create hierarchy).
    return {
      transform: stacked ? 'none' : 'uppercase',
      weight:    900,
      letterSpacing: stacked ? '-0.01em' : '0.015em'
    };
  }

  // ══════════════════════════════════════════════════════════════
  //  Overlay-mode rendering (testimonial_overlay etc.)
  //  Backend's overlayPlacementService computed element rects + text
  //  colors + scrim intensity. We just draw what we're told.
  // ══════════════════════════════════════════════════════════════
  function drawOverlayCanvas(stage, input) {
    const placement = input.placement;
    stage.innerHTML = '';

    // WYSIWYG: stage gets actual canvas pixel dimensions; CSS transform
    // scales it to fit the visible frame. Text rendering happens at
    // production sizes so what we see matches what the renderer would
    // produce.
    const dims = dimsForRatio(input.aspect_ratio);
    applyCanvasSize(dims.w, dims.h);

    // Brand tokens (same as canonical preview)
    const brand = input.brand || {};
    const primary = isHex(brand.primary_color) ? brand.primary_color : '#1f2937';
    const accent  = isHex(brand.accent_color)  ? brand.accent_color  : '#ef4444';
    const fontStack = brand.font_family
      ? `"${brand.font_family}", system-ui, -apple-system, "Segoe UI", sans-serif`
      : 'system-ui, -apple-system, "Segoe UI", sans-serif';
    stage.style.setProperty('--brand-primary', primary);
    stage.style.setProperty('--brand-accent',  accent);
    stage.style.fontFamily = fontStack;

    // Background. Overlay mode = full-bleed asset. Inset mode = brand
    // primary fill with the asset inscribed inside imageRect.
    // When backgroundMedia.video is set (Media is a video), render a
    // <video> element with the still image as poster — autoplay,
    // muted, looped, playsinline so it acts as a moving hero in the
    // preview and matches what the eventual renderer will produce.
    if (placement.mode === 'inset' && placement.imageRect) {
      stage.style.background = placement.backgroundColor || primary;
      const ir = placement.imageRect;
      const cssRect =
        `position:absolute;` +
        `left:${(ir.x1*100).toFixed(2)}%;top:${(ir.y1*100).toFixed(2)}%;` +
        `width:${((ir.x2-ir.x1)*100).toFixed(2)}%;height:${((ir.y2-ir.y1)*100).toFixed(2)}%;` +
        `object-fit:cover;display:block;`;
      stage.appendChild(makeBackgroundAsset(placement.backgroundMedia, cssRect));
    } else if (placement.backgroundMedia?.image || placement.backgroundMedia?.video) {
      stage.style.background = primary;
      const cssRect = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;';
      stage.appendChild(makeBackgroundAsset(placement.backgroundMedia, cssRect));
    } else {
      stage.style.background = primary;
    }

    // Font-size now set by applyCanvasSize against canvas pixel width.

    // Draw each placed element
    for (const el of placement.elements) {
      stage.appendChild(renderPlacedElement(el, input));
    }

    // Auto-fit text for every text-bearing element. Two RAFs so the
    // stage font-size set above has actually committed.
    // Dense multi-block elements (product_meta + quote) get a lower
    // minScale floor since they stack name/price/stars/rating or
    // text/author/stars and need more shrink headroom to fit at small
    // preview scales without clipping the bottom blocks.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      for (const el of placement.elements) {
        if (el.id === 'logo') continue;  // logo is image-bearing, no auto-fit
        const wrap = stage.querySelector(`[data-element-id="${el.id}"]`);
        const content = wrap?.querySelector('.tp-overlay-content');
        if (!wrap || !content) continue;
        const minScale = (el.id === 'product_meta' || el.id === 'quote') ? 0.40 : 0.55;
        fitTextToBox(wrap, content, minScale);
      }
    }));

    // Failure surfacing lives in the right-panel decision trace — no
    // on-image pill needed.

    // Density heatmap — visualizes the densityGrid the silhouette-aware
    // legality check samples. Drawn UNDER the restriction + container
    // layers so it tints the image without obscuring the bboxes.
    if (TP_STATE.showDensity) {
      drawDensityHeatmap(stage, placement.analysis?.densityGrid);
    }

    // Restriction layer — draws the keep-out rects (primary subject, faces,
    // secondary subjects, text) beneath the container layer so the operator
    // can see what the placement algorithm was avoiding. Also surfaces a
    // "no analysis" chip when the image used isn't analyzed for this ratio.
    if (TP_STATE.showRestrictions) {
      drawRestrictionLayer(stage, placement.analysis);
      if (placement.usingFallbackImage) {
        const chip = document.createElement('div');
        chip.className = 'tp-analysis-chip';
        chip.textContent = 'no analysis for this ratio — placement is not subject-aware';
        stage.appendChild(chip);
      }
    }

    // Debug box overlay — dashed rect + pill label over every placed element
    // so the operator can see exactly where the placement algorithm landed
    // each container vs. what the final content looks like.
    if (TP_STATE.showDebugBoxes) {
      const layer = document.createElement('div');
      layer.className = 'tp-debug-layer';
      for (const d of (placement.decisions || [])) {
        if (!d.rectPct) continue;  // only draw boxes for elements that got placed
        const r = d.rectPct;
        const box = document.createElement('div');
        box.className = `tp-debug-box state-${d.state}`;
        box.style.cssText =
          `left:${(r.x1*100).toFixed(2)}%;top:${(r.y1*100).toFixed(2)}%;` +
          `width:${((r.x2-r.x1)*100).toFixed(2)}%;height:${((r.y2-r.y1)*100).toFixed(2)}%;`;
        const lbl = document.createElement('span');
        lbl.className = 'tp-debug-label';
        const scalePct = typeof d.fontScale === 'number' && d.fontScale < 1 ? ` · ${Math.round(d.fontScale * 100)}%` : '';
        const variantBit = d.variant ? ` · ${d.variant}` : '';
        lbl.textContent = `${d.id}${variantBit}${scalePct}`;
        box.appendChild(lbl);
        layer.appendChild(box);
      }
      stage.appendChild(layer);
    }
  }

  // Shared restriction renderer — used by both overlay-mode and canonical
  // previews. Draws a colored dashed rect per restriction with a short
  // classification label. primarySubjectRectPct (if present) gets drawn
  // first as a red "primary" box even if no matching classification entry
  // is in restrictions[].
  function drawRestrictionLayer(stage, analysis) {
    if (!analysis) return;
    const layer = document.createElement('div');
    layer.className = 'tp-restriction-layer';

    const seen = new Set();
    const addBox = (rect, cls, strictness, reason) => {
      if (!rect) return;
      const key = `${rect.x1},${rect.y1},${rect.x2},${rect.y2},${cls || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      const role = restrictionRole(cls, strictness);
      const box = document.createElement('div');
      box.className = `tp-restriction-box role-${role}`;
      box.style.cssText =
        `left:${(rect.x1*100).toFixed(2)}%;top:${(rect.y1*100).toFixed(2)}%;` +
        `width:${((rect.x2-rect.x1)*100).toFixed(2)}%;height:${((rect.y2-rect.y1)*100).toFixed(2)}%;`;
      const lbl = document.createElement('span');
      lbl.className = 'tp-restriction-label';
      const strictnessBit = typeof strictness === 'number' ? ` ${strictness.toFixed(1)}` : '';
      lbl.textContent = `${cls || role}${strictnessBit}`;
      if (reason) lbl.title = reason;
      box.appendChild(lbl);
      layer.appendChild(box);
    };

    // Primary subject first (red) — it's the one the layout engine treats as
    // a hard keep-out regardless of the rest of the list.
    if (analysis.primarySubjectRectPct) {
      addBox(analysis.primarySubjectRectPct, 'product', 1.0, 'primary subject (hard keep-out)');
    }
    for (const r of (analysis.restrictions || [])) {
      addBox(r.rectPct, r.classification, r.strictness, r.reason);
    }

    if (layer.childElementCount > 0) stage.appendChild(layer);
  }

  // Build the full-bleed (or inset) background element. Renders a
  // <video> with the image as poster when a video URL is present
  // (source Media is a video), else a plain <img>. Common cssText
  // is applied by the caller so position/inset/object-fit match
  // overlay vs inset modes.
  function makeBackgroundAsset(bgMedia, cssText) {
    if (bgMedia?.video) {
      const v = document.createElement('video');
      v.src = bgMedia.video;
      if (bgMedia.image) v.poster = bgMedia.image;
      v.muted = true;
      v.autoplay = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.preload = 'metadata';
      v.style.cssText = cssText;
      return v;
    }
    const img = document.createElement('img');
    img.src = bgMedia?.image || '';
    img.loading = 'lazy';
    img.style.cssText = cssText;
    return img;
  }

  // Map a restriction classification + strictness to a color role.
  function restrictionRole(classification, strictness) {
    if (classification === 'product')           return 'primary';
    if (classification === 'face')              return 'face';
    if (classification === 'secondary_subject') return 'secondary';
    if (classification === 'text')              return 'text';
    if (typeof strictness === 'number' && strictness >= 0.95) return 'primary';
    return 'other';
  }

  // Render the densityGrid as a translucent red heatmap covering the
  // stage. Each cell's alpha tracks its busyness — empty cells (sky,
  // water, ground) appear barely tinted; dense cells (subject body)
  // appear strongly tinted. This is the same visualization the Overlay
  // Zones panel offers, ported into the template-preview debug stack.
  function drawDensityHeatmap(stage, grid) {
    if (!grid || !grid.cells || !grid.cols || !grid.rows) return;
    const heat = document.createElement('div');
    heat.className = 'oz-heatmap';
    // Sit above the image but below restrictions/containers so they
    // remain readable. z-index 48 is one below tp-restriction-layer (49).
    heat.style.cssText = 'position:absolute;inset:0;z-index:48;pointer-events:none;';
    heat.style.display = 'grid';
    heat.style.gridTemplateColumns = `repeat(${grid.cols}, 1fr)`;
    heat.style.gridTemplateRows = `repeat(${grid.rows}, 1fr)`;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const v = grid.cells[r]?.[c] ?? 0;
        const cell = document.createElement('div');
        cell.style.background = `rgba(239,68,68,${(v * 0.35).toFixed(2)})`;
        heat.appendChild(cell);
      }
    }
    stage.appendChild(heat);
  }

  function renderPlacedElement(el, input) {
    const wrap = document.createElement('div');
    wrap.dataset.elementId = el.id;
    const r = el.rectPct;
    wrap.style.cssText =
      'position:absolute;box-sizing:border-box;overflow:hidden;' +
      `left:${(r.x1*100).toFixed(2)}%;top:${(r.y1*100).toFixed(2)}%;` +
      `width:${((r.x2-r.x1)*100).toFixed(2)}%;height:${((r.y2-r.y1)*100).toFixed(2)}%;` +
      `color:${el.textColor || '#fff'};`;

    // Adaptive scrim — applied as a background gradient
    if (el.scrim && el.scrim.type !== 'none' && el.scrim.opacity > 0) {
      wrap.style.background = scrimToCss(el.scrim);
      wrap.style.borderRadius = '6px';
    }

    switch (el.id) {
      case 'logo':         renderOverlayLogo(wrap, el, input); break;
      case 'headline':     renderOverlayHeadline(wrap, el, input); break;
      case 'product_meta': renderOverlayProductMeta(wrap, el, input); break;
      case 'cta':          renderOverlayCta(wrap, el, input); break;
      case 'quote':        renderOverlayQuote(wrap, el, input); break;
      default:             wrap.innerHTML = `<div class="tp-overlay-content">${escapeHtml(el.id)}</div>`;
    }
    return wrap;
  }

  function scrimToCss(scrim) {
    const op = Math.max(0, Math.min(1, scrim.opacity || 0));
    const dark = scrim.type === 'gradient-dark';
    const c1 = dark ? `rgba(0,0,0,${op.toFixed(3)})` : `rgba(255,255,255,${op.toFixed(3)})`;
    const c0 = dark ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)';
    // Uniform radial tint for every direction: solid-ish through the
    // interior (where the text sits), soft feather at the edges. The
    // older top-fade/bottom-fade produced a half-opaque / half-transparent
    // box that read as a hard rectangle instead of a shading.
    return `radial-gradient(ellipse at center, ${c1} 70%, ${c0} 100%)`;
  }

  function renderOverlayLogo(wrap, el, input) {
    const logo = input.brand?.logo;
    // Square variant centers the logo in its tight corner; horizontal
    // left-anchors the wordmark so it doesn't float oddly.
    const objectPosition = el.variant === 'square' ? 'center center' : 'left center';
    if (logo) {
      const img = document.createElement('img');
      img.src = logo;
      img.style.cssText = `width:100%;height:100%;object-fit:contain;object-position:${objectPosition};`;
      img.loading = 'lazy';
      wrap.appendChild(img);
    } else {
      // Name-as-logo fallback. Square variant shows the first initial only;
      // horizontal shows the full brand name.
      wrap.style.display = 'flex'; wrap.style.alignItems = 'center'; wrap.style.justifyContent = el.variant === 'square' ? 'center' : 'flex-start';
      wrap.style.padding = '0.2em 0.4em';
      const brandName = input.brand?.name || 'BRAND';
      const fallbackText = el.variant === 'square'
        ? brandName.trim().charAt(0).toUpperCase()
        : brandName;
      wrap.innerHTML =
        `<div class="tp-overlay-content" style="font-weight:900;font-size:${el.variant === 'square' ? '1.6' : '1.1'}em;text-shadow:0 1px 3px rgba(0,0,0,0.4);">` +
        escapeHtml(fallbackText) +
        `</div>`;
    }
  }

  function renderOverlayHeadline(wrap, el, input) {
    const brand = input.brand || {};
    const bindings = TP_STATE.lastStyleBindings || {};

    // Ad-grade hero-copy sizing. horizontal 1-line = biggest impact;
    // stacked variants shrink modestly since they already use more height.
    const baseScale = (el.fontScale || 1);
    const baseEm = el.variant === 'horizontal' ? 1.75
                 : el.variant === 'stacked-2'  ? 1.45
                 : el.variant === 'stacked-3'  ? 1.20
                 :                                1.55;

    // Tone + variant → weight, transform, letter-spacing.
    const style = toneToHeadlineStyle(brand.tone, el.variant);

    // headline_chip_bg style_binding (testimonial_overlay /
    // product_overlay): apply a solid dark-gray chip backing behind
    // the headline, override the brand-derived color with white (or
    // the bound color), and use the brand font family. Replaces the
    // scrim + brand-color path entirely for these templates.
    if (bindings.headline_chip_bg) {
      wrap.style.background = bindings.headline_chip_bg;
      wrap.style.borderRadius = '6px';
      wrap.style.color = bindings.headline_text_color && bindings.headline_text_color !== 'auto-from-brightness'
        ? bindings.headline_text_color
        : '#FFFFFF';
      if (bindings.font_family_headline) {
        wrap.style.fontFamily = bindings.font_family_headline;
      }
    } else {
      // Brand-color text when luminance allows; otherwise adaptive
      // white/black with a scrim-opacity boost to recover contrast.
      const { color, scrimBoost } = pickHeadlineColor(brand, el.scrim);
      if (scrimBoost > 0 && el.scrim && el.scrim.type !== 'none') {
        const boosted = Object.assign({}, el.scrim, {
          opacity: Math.min(0.95, (el.scrim.opacity || 0) + scrimBoost)
        });
        wrap.style.background = scrimToCss(boosted);
        wrap.style.borderRadius = '6px';
      }
      wrap.style.color = color;
    }

    wrap.style.padding = '0.25em 0.5em';
    wrap.style.display = 'flex'; wrap.style.alignItems = 'center';
    wrap.style.fontSize = `${(baseEm * baseScale).toFixed(3)}em`;
    wrap.style.fontWeight = String(style.weight);
    wrap.style.lineHeight = '1.02';
    wrap.style.letterSpacing = style.letterSpacing;
    wrap.style.textTransform = style.transform;
    // Bigger headlines deserve a heavier drop shadow for edge-legibility
    // when the text sits on a complex area despite the scrim.
    wrap.style.textShadow = '0 2px 6px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.35)';

    const maxLines = el.maxLines || 1;
    wrap.innerHTML =
      `<div class="tp-overlay-content" style="width:100%;` +
      (maxLines > 1 ? `display:-webkit-box;-webkit-line-clamp:${maxLines};-webkit-box-orient:vertical;overflow:hidden;` : '') +
      `">${escapeHtml(input.copy?.headline || '')}</div>`;
  }

  function renderOverlayProductMeta(wrap, el, input) {
    // product_overlay's product_meta = compact product card: thumbnail
    // (left, square) + name + price (stacked right). Reuses the
    // visual language of ugc_split_screen's product_card variant
    // but rendered in absolute-positioned overlay context with a
    // dark chip backing for legibility against any background image.
    const bindings = TP_STATE.lastStyleBindings || {};
    wrap.style.background = bindings.headline_chip_bg || 'rgba(20,20,20,0.85)';
    wrap.style.borderRadius = '8px';
    wrap.style.padding = '0.5em 0.75em';
    wrap.style.boxShadow = '0 2px 10px rgba(0,0,0,0.35)';
    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = 'auto 1fr';
    wrap.style.alignItems = 'center';
    wrap.style.columnGap = '0.7em';
    wrap.style.color = '#FFFFFF';
    if (bindings.font_family_body) wrap.style.fontFamily = bindings.font_family_body;
    wrap.style.fontSize = `${(0.95 * (el.fontScale || 1)).toFixed(3)}em`;

    const product = input.product || {};
    const imageUrl = product.image
                  || product.hero_media?.image
                  || null;
    const name  = product.name || '';
    const price = formatProductPrice(product.price);

    const imgHtml = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" style="width:3.2em;height:3.2em;object-fit:cover;border-radius:4px;display:block;" loading="lazy" />`
      : `<div style="width:3.2em;height:3.2em;border-radius:4px;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-weight:700;">${escapeHtml((name || '?').slice(0, 1).toUpperCase())}</div>`;

    const nameHtml = `<div style="font-weight:700;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(name)}</div>`;
    const priceHtml = price
      ? `<div style="font-size:0.92em;font-weight:700;margin-top:0.2em;color:${escapeHtml(bindings.accent_border_color || 'var(--brand-accent, #FF6B35)')};">${escapeHtml(price)}</div>`
      : '';

    wrap.innerHTML = imgHtml + `<div style="min-width:0;">${nameHtml}${priceHtml}</div>`;
  }

  function renderYellowStars(rating) {
    const r = Math.max(0, Math.min(5, Math.round(rating)));
    const full = '★'.repeat(r);
    const empty = '☆'.repeat(5 - r);
    return `<span style="letter-spacing:0.05em;line-height:1;"><span style="color:#fbbf24;">${full}</span><span style="opacity:0.4;">${empty}</span></span>`;
  }

  function renderOverlayCta(wrap, el, input) {
    // Pick fill: accent → primary → default. Skip accent if it's
    // null or near-white (would vanish on a light image).
    const fill      = pickCtaFillColor(input.brand);
    const textColor = tpReadableOn(fill);
    wrap.style.background = fill;
    wrap.style.color = textColor;
    // Flat rectangle with a thin border — CTA stands out via the border
    // contrast + drop shadow rather than the older pill shape. Border
    // mirrors the text color (white on dark fills, dark on light fills)
    // at moderate alpha so it reads as an outline, not a hard frame.
    wrap.style.borderRadius = '4px';
    wrap.style.border = `1.5px solid ${tpHexToRgba(textColor, 0.65)}`;
    wrap.style.boxSizing = 'border-box';
    wrap.style.display = 'flex'; wrap.style.alignItems = 'center'; wrap.style.justifyContent = 'center';
    wrap.style.fontWeight = '800';
    const baseEm = el.variant === 'pill-narrow' ? 0.78
                 : el.variant === 'pill-wide'   ? 0.95
                 :                                 1.0;
    wrap.style.fontSize = `${baseEm.toFixed(2)}em`;
    wrap.style.letterSpacing = '0.04em';
    wrap.style.textAlign = 'center';
    wrap.style.lineHeight = '1.1';
    wrap.style.boxShadow = '0 4px 14px rgba(0,0,0,0.4)';
    wrap.innerHTML = `<div class="tp-overlay-content">${escapeHtml(input.cta?.text || 'Shop')}</div>`;
  }

  function renderOverlayQuote(wrap, el, input) {
    const bindings = TP_STATE.lastStyleBindings || {};

    // quote_chip_bg style_binding (testimonial_overlay): apply a
    // solid dark-gray chip backing behind the quote text, force
    // white (or bound) text color. Replaces the scrim + brand-accent
    // border path for the new overlay templates.
    if (bindings.quote_chip_bg) {
      wrap.style.background = bindings.quote_chip_bg;
      wrap.style.color = bindings.quote_text_color || '#FFFFFF';
      wrap.style.borderRadius = '8px';
      wrap.style.padding = '0.6em 0.85em 0.55em';
      wrap.style.boxShadow = '0 2px 10px rgba(0,0,0,0.35)';
    } else {
      // Italic editorial testimonial block. The base
      // renderPlacedElement already set el.scrim as the background
      // if opacity > 0 — we keep it and boost modestly if the scrim
      // was weak, so the quote always has a gradient substrate.
      if (el.scrim && el.scrim.type !== 'none') {
        const op = Math.max(0.55, (el.scrim.opacity || 0) + 0.10);
        const boosted = Object.assign({}, el.scrim, { opacity: Math.min(0.90, op) });
        wrap.style.background = scrimToCss(boosted);
      } else {
        wrap.style.background =
          'radial-gradient(ellipse at center, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0) 100%)';
      }
      wrap.style.borderRadius = '8px';
      wrap.style.padding = '0.6em 0.85em 0.55em calc(0.85em + 4px)';
      wrap.style.borderLeft = '4px solid var(--brand-accent, #ef4444)';
      wrap.style.boxShadow = '0 2px 10px rgba(0,0,0,0.35)';
      const scrimDark = !el.scrim || el.scrim.type === 'gradient-dark' || el.scrim.type === 'none';
      wrap.style.color = scrimDark ? '#ffffff' : '#0a0a0a';
    }

    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    // Top-align so when fitTextToBox shrinks the font (content < container)
    // we don't end up with equal empty space top + bottom from
    // justify-content:center.
    wrap.style.justifyContent = 'flex-start';
    wrap.style.fontStyle = 'italic';
    wrap.style.fontSize = '0.95em';
    wrap.style.lineHeight = '1.28';
    // Drop shadow assumes a dark backdrop (chip or dark scrim). When
    // the older path resolved to a light scrim, wrap.style.color was
    // already set to #0a0a0a above — but the shadow stays dark since
    // it's just edge-legibility insurance.
    wrap.style.textShadow = '0 1px 3px rgba(0,0,0,0.55)';

    const quote = input.social_proof?.primary_quote;
    const text = quote?.text || '';
    const author = quote?.author_name || '';
    const ml = el.maxLines || 4;
    // Reserve 1 line budget for attribution + review line below the quote.
    const quoteLines = Math.max(2, ml - 2);

    const parts = [];
    parts.push(
      `<div style="overflow:hidden;display:-webkit-box;-webkit-line-clamp:${quoteLines};-webkit-box-orient:vertical;">` +
      `<span style="font-weight:700;opacity:0.9;">&ldquo;</span>` +
      escapeHtml(text) +
      `<span style="font-weight:700;opacity:0.9;">&rdquo;</span>` +
      `</div>`
    );
    if (author) {
      parts.push(
        `<div style="font-style:normal;font-size:0.78em;opacity:0.85;margin-top:0.35em;font-weight:600;">— ${escapeHtml(author)}</div>`
      );
    }
    // Always 5 yellow stars under the attribution — the quote block is
    // editorial endorsement, not a numeric rating. Star count is decorative;
    // numeric rating + review count live in product_meta.
    parts.push(
      `<div style="font-style:normal;margin-top:0.25em;line-height:1;">` +
      renderYellowStars(5) +
      `</div>`
    );

    wrap.innerHTML = `<div class="tp-overlay-content" style="width:100%;">${parts.join('')}</div>`;
  }

  // Auto-fit text to its container — shrinks font-size in 5% steps until
  // content fits or hits the readability floor. Caller can pass a custom
  // minScale; defaults to 0.55 for single-block elements and is typically
  // lowered to 0.40 for stacked multi-block elements (product_meta, quote)
  // that need more headroom before clipping the bottom rows.
  function fitTextToBox(wrap, content, minScale = 0.55) {
    if (!wrap || !content) return;
    const baseFontPx = parseFloat(window.getComputedStyle(wrap).fontSize);
    if (!baseFontPx) return;
    let scale = 1.0;
    let attempts = 14;
    // Measure overflow on the WRAP — that's the element with the real
    // height constraint (overflow: hidden + fixed pixel size from the
    // placement rect). The inner .tp-overlay-content div has no height
    // bound and grows to fit its children, so its scrollHeight always
    // equals its clientHeight regardless of overflow.
    while (scale > minScale && attempts-- > 0) {
      if (wrap.scrollWidth <= wrap.clientWidth + 1 && wrap.scrollHeight <= wrap.clientHeight + 1) break;
      scale -= 0.05;
      wrap.style.fontSize = `${baseFontPx * scale}px`;
    }
  }

  // Fit a canonical-mode text/quote_card zone:
  //   1. Temporarily drop the inner div's line-clamp so scrollHeight
  //      reflects the FULL untruncated text.
  //   2. Shrink the zone's font-size in 5% steps (down to 0.6×) until
  //      the wrapped text fits within zone.height.
  //   3. Restore line-clamp as the hard cap. If even at 0.6× the text
  //      still overflows N lines, line-clamp kicks in with ellipsis —
  //      no mid-word breaks.
  // The line-clamp lives on an inner div that resolveZoneContent wrote
  // with inline `display: -webkit-box; -webkit-line-clamp: N`; we toggle
  // those via inline style overrides so the original markup is preserved.
  function fitAndClampZone(zoneEl, maxLines, minScale = 0.6) {
    if (!zoneEl) return;
    const inner = zoneEl.querySelector('[style*="line-clamp"]');
    let savedDisplay = '', savedClamp = '';
    if (inner) {
      savedDisplay = inner.style.display;
      savedClamp   = inner.style.webkitLineClamp || inner.style['-webkit-line-clamp'] || '';
      inner.style.display = 'block';
      inner.style.webkitLineClamp = 'unset';
    }

    const baseFontPx = parseFloat(window.getComputedStyle(zoneEl).fontSize);
    if (baseFontPx) {
      let scale = 1.0;
      let attempts = 14;
      while (scale > minScale && attempts-- > 0) {
        if (zoneEl.scrollHeight <= zoneEl.clientHeight + 1 && zoneEl.scrollWidth <= zoneEl.clientWidth + 1) break;
        scale -= 0.05;
        zoneEl.style.fontSize = `${baseFontPx * scale}px`;
      }
    }

    if (inner) {
      inner.style.display = savedDisplay || '-webkit-box';
      inner.style.webkitLineClamp = savedClamp || String(maxLines);
    }
  }

  // Reflow the right-side column of a landscape layout when the headline
  // content is shorter than its budgeted slot. Reasoning:
  //   - The derivation prompt asks Gemini to write a multi-line headline
  //     that fills the design slot (lead + 2-line main, etc.).
  //   - When Gemini writes a SHORTER headline (1-line main, or a single
  //     word), the original slot leaves a dead band of vertical space
  //     above the eyebrow / proof_bar / quote_card, and the column reads
  //     unbalanced against the full-bleed image on the left.
  //   - Solution: snapshot the column's original geometry, measure the
  //     headline's natural rendered height at design font, shrink the
  //     headline rect to fit the content (never above the original
  //     budget), and redistribute the freed vertical to below-slots in
  //     proportion to their original heights, preserving inter-slot
  //     gaps.
  //
  // "Below" = same column = x-overlapping the headline AND y >= headline
  // bottom. This catches the right-panel stack (eyebrow_rules → proof_bar
  // → quote_card → section_header → product_meta → badge_row → cta) on
  // testimonial_spotlight 16:9 / 1.91:1 without any canvas-spec changes.
  // Logo / support_media live on the left and are correctly excluded by
  // the x-overlap test.
  //
  // canvasW / canvasH are the canvas spec dimensions (normalized 1000-
  // unit space). Since applyCanvasSize sets the stage to those exact
  // pixel dimensions, getBoundingClientRect / scrollHeight return values
  // in the same units — no conversion needed.
  function reflowColumnUnderHeadline(zoneEls, canvasW, canvasH) {
    return reflowColumnUnderAnchor(zoneEls, canvasW, canvasH, ({ zone }) =>
      zone.id === 'headline' && zone.style_variant === 'display_script');
  }

  // Quote_card reflow strategy:
  //   - growToCollision: instead of capping the slot at its design
  //     rect.h, allow the slot to grow DOWNWARD up to the next zone
  //     in the same column (with a small gap), or up to the canvas
  //     bottom (with a margin) if no zone is below. Long quotes get
  //     more vertical room before fitAndClampZone has to shrink the
  //     font; short quotes still snap to natural.
  //   - shiftOnly: when the anchor shrinks, translate deps below it
  //     up by the shrink amount — no slack redistribution. Headline
  //     reflow already distributed slack across deps; doing it again
  //     here would double-count and inflate badge_row + cta sizes.
  function reflowColumnUnderQuoteCard(zoneEls, canvasW, canvasH) {
    return reflowColumnUnderAnchor(zoneEls, canvasW, canvasH,
      ({ zone }) => zone.kind === 'quote_card',
      { shiftOnly: true, growToCollision: true });
  }

  // product_meta reflow — same pattern as quote_card. Used by
  // ugc_split_screen where product_meta (a product_card with image
  // + name + price) occupies the slot that testimonial_spotlight
  // gives to quote_card. Anchor predicate matches by id so it
  // catches whatever style_variant is in play.
  function reflowColumnUnderProductMeta(zoneEls, canvasW, canvasH) {
    return reflowColumnUnderAnchor(zoneEls, canvasW, canvasH,
      ({ zone }) => zone.id === 'product_meta',
      { shiftOnly: true, growToCollision: true });
  }

  // Compute the maximum height an anchor can grow to before colliding
  // with the next zone below it in the same column. Falls back to
  // canvas-bottom-minus-margin when no zone is below in the column.
  // Used by growToCollision mode so quote_card can use available
  // space for long text instead of being capped at design rect.h.
  function computeCollisionBound(aZone, zoneEls, canvasH) {
    const GAP = 16;
    const BOTTOM_MARGIN = 40;
    const aColumn = aZone.column || null;
    const aTop    = aZone.rect.y;
    let nearestBelowTop = Infinity;
    for (const { zone } of zoneEls) {
      if (zone === aZone) continue;
      // Only zones in the same column constrain the anchor. For
      // single-column variants (column=null), all other column-null
      // zones count.
      if ((zone.column || null) !== aColumn) continue;
      const zY = zone.rect.y;
      if (zY <= aTop) continue;        // skip zones above/at anchor
      if (zY < nearestBelowTop) nearestBelowTop = zY;
    }
    if (nearestBelowTop === Infinity) {
      return Math.max(0, canvasH - aTop - BOTTOM_MARGIN);
    }
    return Math.max(0, nearestBelowTop - aTop - GAP);
  }

  // Generic column-reflow under an anchor zone. The anchor's natural
  // content height is measured at design font (after CSS scalers
  // resolve); if shorter than the design slot, the anchor shrinks and
  // freed vertical redistributes proportionally to dependent zones in
  // the same column. options.excludeKinds keeps anchor zones (cta) out
  // of the redistribution. options.minHFraction is the floor as a
  // fraction of design height (default 0.5).
  function reflowColumnUnderAnchor(zoneEls, canvasW, canvasH, anchorPredicate, options = {}) {
    const { excludeKinds = [], minHFraction = 0.5, shiftOnly = false, growToCollision = false } = options;

    const anchor = zoneEls.find(anchorPredicate);
    if (!anchor) return;

    const aZone = anchor.zone;
    const aEl   = anchor.el;
    const orig  = { x: aZone.rect.x, y: aZone.rect.y, w: aZone.rect.w, h: aZone.rect.h };

    // Use the anchor's DESIGN bottom (pre-scale, pre-mutation) for
    // dep-finding and for measuring inter-zone gaps. Both _design_y
    // and _design_h come from the scaler-loop snapshot, so they
    // reflect canvas-spec values regardless of how earlier reflow
    // passes mutated rect.y / rect.h.
    const designY      = aZone._design_y ?? orig.y;
    const designH      = aZone._design_h ?? orig.h;
    const oldRight     = orig.x + orig.w;
    const designBottom = designY + designH;
    const dependents = zoneEls
      .filter(z => z !== anchor)
      .filter(z => !excludeKinds.includes(z.zone.kind))
      .filter(z => {
        const r = z.zone.rect;
        const dy = z.zone._design_y ?? r.y;
        const xOverlap = r.x < oldRight && (r.x + r.w) > orig.x;
        const below    = dy >= designBottom - 1;
        return xOverlap && below;
      })
      .sort((a, b) => (a.zone._design_y ?? a.zone.rect.y) - (b.zone._design_y ?? b.zone.rect.y));

    // Snapshot deps with both their design (pre-scale) and current
    // (post-scale) heights. designH drives the proportional slack
    // distribution; scaledH is the floor a dep can never go below
    // (the canvas spec said "this slot is 2× the design").
    // Even if the dep list is empty, we still measure the anchor's
    // natural and shrink the slot to match — slot-fit-to-content is
    // the primary purpose of the reflow; subordinate cascading is
    // secondary. This matters for two-column layouts (4:5 / 9:16
    // testimonial_spotlight) where deps below the quote_card sit in
    // the OTHER column and get filtered out by x-overlap.
    const deps = dependents.map(d => ({
      handle:  d,
      designH: d.zone._design_h ?? d.zone.rect.h,
      scaledH: d.zone.rect.h,
      // origY uses the design y (pre-mutation) so cascade gap math
      // computes against canvas-spec values, not post-cascade rect.y
      // from an earlier reflow pass.
      origY:   d.zone._design_y ?? d.zone.rect.y,
      column:  d.zone.column || null
    }));

    // depDelta = total vertical the column GREW from the zone_scalers
    // pass. The headline must shrink by at least depDelta to keep the
    // column packing the canvas — that's the column-overflow case.
    // For multi-column layouts, the worst-case column drives required
    // headline shrinkage (the LEFT column may have 4 scaled zones
    // while RIGHT only has 1; LEFT is the binding constraint).
    const depDelta = deps.reduce((s, d) => s + (d.scaledH - d.designH), 0);

    // Measure anchor natural content at design font.
    const savedH = aEl.style.height;
    aEl.style.height = 'auto';
    const naturalPx = aEl.getBoundingClientRect().height;
    aEl.style.height = savedH;

    // Per-zone min_h_fraction override (canvas spec) wins over the
    // function default (0.5). Lets a tight-column variant (e.g. 1:1
    // quote_card) hold a higher floor so short quotes don't shrink
    // the slot below visual weight.
    const effMinHFraction = (typeof aZone.min_h_fraction === 'number')
      ? aZone.min_h_fraction
      : minHFraction;
    let minH = orig.h * effMinHFraction;

    // Upper bound for the final slot height. Default cap is the
    // anchor's current rect.h (so the slot never grows past the
    // canvas spec). growToCollision REPLACES that cap with "the
    // next zone in this column" (or canvas bottom when nothing's
    // below) — the collision boundary is a hard upper, regardless
    // of design rect.h. This means a slot that was pushed down
    // by an earlier reflow may end up smaller than its design
    // size to avoid overflowing canvas, AND a slot with long
    // content can grow past its design size when there's room.
    const upperH = growToCollision
      ? computeCollisionBound(aZone, zoneEls, canvasH)
      : orig.h;

    // Clamp the floor at the ceiling. When growToCollision yields a
    // tight upperH (e.g. 4:5 quote_card pushed down by headline
    // reflow leaves only ~190px above canvas-bottom-margin), a
    // higher min_h_fraction would otherwise force the slot past
    // the collision boundary and overflow canvas. The floor never
    // exceeds the ceiling — preserves the collision guarantee.
    if (minH > upperH) minH = upperH;

    const requiredH  = Math.max(minH, upperH - depDelta);
    const naturalFit = Math.max(minH, Math.min(upperH, naturalPx));
    const finalH     = growToCollision
      ? naturalFit
      : Math.min(requiredH, naturalFit);

    const totalShrink  = orig.h - finalH;
    const slackForDeps = totalShrink - depDelta;

    if (Math.abs(totalShrink) < 2 && depDelta < 2) return;

    // Apply new anchor rect.
    aZone.rect.h = finalH;
    applyZoneRect(aEl, aZone.rect, canvasW, canvasH);

    // shiftOnly: translate every dep up by the anchor's shrink
    // amount, no size change, no slack redistribution. Used by
    // the second-pass quote_card reflow so it doesn't compound on
    // top of headline-reflow's slack distribution.
    if (shiftOnly) {
      const shrink = orig.h - finalH;
      if (shrink < 1) return;
      for (const d of deps) {
        d.handle.zone.rect.y = capCtaY(d, d.handle.zone.rect.y - shrink);
        applyZoneRect(d.handle.el, d.handle.zone.rect, canvasW, canvasH);
      }
      return;
    }

    // Split deps: full-width band (no column) cascades from anchor
    // bottom; column-tagged zones cascade INDEPENDENTLY from the
    // band's bottom (one cursor per column). This prevents a
    // two-column layout's parallel tracks (left col proof_bar at the
    // same y as right col badge_row) from being mis-cascaded as if
    // they were sequential.
    const bandDeps = deps.filter(d => !d.column);
    const colDepsByName = {};
    for (const d of deps) {
      if (d.column) (colDepsByName[d.column] ||= []).push(d);
    }

    // Total design heights — used to distribute slack proportionally.
    // When multiple columns exist, slack split across band + each
    // column's deps weighted by their own design totals.
    const totalDesignH = deps.reduce((s, d) => s + d.designH, 0);
    const slackShare   = (designH) => (slackForDeps > 0 && totalDesignH > 0)
      ? slackForDeps * (designH / totalDesignH)
      : 0;

    // Cascade the full-width band first. prevBottomOrig tracks the
    // DESIGN bottom (un-scaled) so each dep's preserved gap measures
    // correctly against canvas-spec values regardless of how much
    // the anchor's rect.h was scaled by zone_scalers.
    let prevBottomNew  = orig.y + finalH;
    let prevBottomOrig = designBottom;
    for (const d of bandDeps) {
      const gap  = d.origY - prevBottomOrig;
      const grow = slackShare(d.designH);
      const newH = d.scaledH + grow;
      const newY = capCtaY(d, prevBottomNew + gap);

      d.handle.zone.rect.y = newY;
      d.handle.zone.rect.h = newH;
      applyZoneRect(d.handle.el, d.handle.zone.rect, canvasW, canvasH);

      prevBottomNew  = newY + newH;
      prevBottomOrig = d.origY + d.designH;
    }

    // Both columns start at the band's bottom (preserved gaps measured
    // off each column's first dep). Cascade each column independently.
    const colTopNew  = prevBottomNew;
    const colTopOrig = prevBottomOrig;
    for (const colName of Object.keys(colDepsByName)) {
      let prevNew  = colTopNew;
      let prevOrig = colTopOrig;
      for (const d of colDepsByName[colName]) {
        const gap  = d.origY - prevOrig;
        const grow = slackShare(d.designH);
        const newH = d.scaledH + grow;
        const newY = capCtaY(d, prevNew + gap);

        d.handle.zone.rect.y = newY;
        d.handle.zone.rect.h = newH;
        applyZoneRect(d.handle.el, d.handle.zone.rect, canvasW, canvasH);

        prevNew  = newY + newH;
        prevOrig = d.origY + d.designH;
      }
    }
  }

  // CTA y-cap. cta is a bottom-anchored design element — when the
  // cascade would push it PAST its design y (column-overflow case,
  // e.g. 4:5 with a 2x headline scaler that depDelta can't fully
  // absorb), pin it to design y so it stays visible above the
  // canvas bottom. When the cascade puts it ABOVE design (under-fill
  // case, e.g. 1:1 with a short headline), the cascade wins so the
  // column compacts upward instead of leaving a dead band above the
  // pinned cta. dep argument is the snapshot {handle, ...} from the
  // reflow's deps list.
  function capCtaY(dep, computedY) {
    if (dep.handle.zone.kind !== 'cta') return computedY;
    const designY = dep.handle.zone._design_y;
    if (typeof designY !== 'number') return computedY;
    return Math.min(computedY, designY);
  }

  // Re-apply a zone rect to its DOM element using the same percent-of-
  // canvas units the initial draw uses. Centralized so reflow stays in
  // sync with the loop in drawTpCanvas.
  function applyZoneRect(el, rect, canvasW, canvasH) {
    el.style.left   = `${(rect.x / canvasW * 100).toFixed(2)}%`;
    el.style.top    = `${(rect.y / canvasH * 100).toFixed(2)}%`;
    el.style.width  = `${(rect.w / canvasW * 100).toFixed(2)}%`;
    el.style.height = `${(rect.h / canvasH * 100).toFixed(2)}%`;
  }

  // Adaptive badge_row layout. Combines two passes into one:
  //   1. Set the slot to auto-height and let badges flow with
  //      flex-wrap: wrap. Read each .tp-callout's offsetTop to count
  //      rows (with a 2px tolerance for sub-pixel slop).
  //   2. If rows > maxRows, hide every badge in row (maxRows + 1) or
  //      beyond via display: none. After hiding, re-measure the
  //      slot's natural offsetHeight (now reflecting only visible
  //      rows + padding + gap) and set rect.h to fit.
  //   3. Collision-cap the final height at the next zone in the same
  //      column (or canvas bottom minus margin) so the slot can't
  //      grow past where it would collide with cta.
  //
  // End result: each visible badge shows its FULL label, the slot
  // height adapts to actual rows used (1 or 2), and rows beyond
  // maxRows are dropped cleanly.
  function fitBadgeRow(zoneEl, zoneObj, zoneEls, canvasW, canvasH, maxRows = 2) {
    if (!zoneEl || !zoneObj) return;
    const badges = Array.from(zoneEl.querySelectorAll('.tp-callout'));
    if (!badges.length) return;
    // Reset visibility so re-renders measure against a clean state.
    badges.forEach(b => { b.style.display = ''; });
    // Auto-height for measurement — allows the slot to flex to whatever
    // natural row count the badges produce. We restore an explicit px
    // height at the end so subsequent layout reads are stable.
    const savedH = zoneEl.style.height;
    zoneEl.style.height = 'auto';
    void zoneEl.offsetHeight;

    const ROW_TOLERANCE = 2;
    const rowTops = [];
    for (const b of badges) {
      const t = b.offsetTop;
      if (!rowTops.some(rt => Math.abs(rt - t) <= ROW_TOLERANCE)) {
        rowTops.push(t);
      }
    }
    rowTops.sort((a, b) => a - b);

    if (rowTops.length > maxRows) {
      const cutoff = rowTops[maxRows];
      for (const b of badges) {
        if (b.offsetTop >= cutoff - ROW_TOLERANCE) {
          b.style.display = 'none';
        }
      }
      void zoneEl.offsetHeight;
    }

    // Now offsetHeight reflects only the rows we're keeping. Cap at
    // collisionBound so the slot can't grow past the next zone (or
    // canvas bottom). Then commit via applyZoneRect so the percent-
    // height stays in sync with rect.h for any later passes.
    const naturalH = zoneEl.offsetHeight;
    const collision = computeCollisionBound(zoneObj, zoneEls, canvasH);
    const finalH = Math.min(naturalH, collision);
    zoneObj.rect.h = finalH;
    zoneEl.style.height = savedH;  // restore inline style before applyZoneRect overwrites
    applyZoneRect(zoneEl, zoneObj.rect, canvasW, canvasH);
  }

  // Split a display_script headline into a smaller "lead" phrase + a
  // larger "main" phrase. The reference layout has the lead at half
  // the size of the main ("SOMETHING NEW IS" small, "COMING IN HOT"
  // huge). Heuristic, in priority order:
  //   1. Split at first sentence-break punctuation (, . ; : — –)
  //   2. Split at first conjugated bridge verb (is/are/was/were/will/gets/now)
  //   3. Fallback: split at ~40% word boundary
  // Returns { lead: '...', main: '...' }. When the headline is too
  // short or no split point is found, lead is empty and main holds
  // the full text — caller renders only the main span.
  function splitHeadlineForDisplayScript(text) {
    const t = (text || '').trim();
    if (!t) return { lead: '', main: '' };

    // 1. Punctuation split — keep punct out of the lead.
    const punct = t.match(/^([^,.;:—–]+)[,.;:—–]\s+(.+)$/);
    if (punct) return { lead: punct[1].trim(), main: punct[2].trim() };

    // 2. Bridge-verb split — captures "Something new IS coming in hot",
    //    "We are launching now", etc.
    const verb = t.match(/^(.+?\s+(?:is|are|was|were|will\s+be|will|gets|now|gets|aren't|isn't))\s+(.+)$/i);
    if (verb) return { lead: verb[1].trim(), main: verb[2].trim() };

    // 3. Fallback — ~40% word boundary, only when there are ≥4 words
    //    (avoids clipping short slogans).
    const words = t.split(/\s+/);
    if (words.length >= 4) {
      // Round up so a 4-word phrase splits 2/2 rather than 1/3 — a
      // single-word lead reads awkwardly at half-size.
      const splitAt = Math.max(1, Math.round(words.length * 0.4));
      return { lead: words.slice(0, splitAt).join(' '), main: words.slice(splitAt).join(' ') };
    }
    return { lead: '', main: t };
  }

  // Callout glyph — uniform '•' bullet for all badge_row callout
  // labels in the split-panel templates (testimonial_spotlight,
  // ugc_split_screen). Earlier versions pattern-matched labels to
  // emoji icons (🔥/⭐/✓ etc.); per design feedback those read as
  // novelty against the editorial reference. Keeping the helper
  // signature so future templates can plug in alternative glyphs
  // without touching the rendering call site.
  function calloutGlyphForLabel(_label) {
    return '•';
  }

  // Resolve a zone's content based on its kind + slot(s).
  function resolveZoneContent(zone, input) {
    switch (zone.kind) {
      case 'panel': {
        // Solid surface zone — paints the right-side content panel for
        // landscape split layouts. Background color comes via the
        // --tp-style-panel-bg CSS var (resolved from style_bindings).
        // No content; just the colored rectangle.
        return '';
      }
      case 'eyebrow_rules': {
        // Centered text with horizontal-rule lines on each side
        // (decorative bookend). Used for the subheadline in landscape
        // testimonial_spotlight ("REAL HEAT. REAL FLAVOR. REAL RESULTS.").
        const paths = Array.isArray(zone.slot) ? zone.slot : (zone.slot ? [zone.slot] : []);
        const txt = paths.map(p => tpGet(input, p)).find(v => typeof v === 'string' && v.trim());
        if (!txt) return `<div class="tp-placeholder">${escapeHtml(paths.join(' / ') || zone.kind)}</div>`;
        return `<span class="tp-rule-line"></span><span class="tp-eyebrow-text">${escapeHtml(txt)}</span><span class="tp-rule-line"></span>`;
      }
      case 'product_card': {
        // Catalog product card — image (left) + name + price (stacked
        // right). Slot is a 3-tuple: [imagePath, namePath, pricePath].
        // Used by ugc_split_screen in the slot that mirrors
        // testimonial_spotlight's quote_card position.
        if (zone.style_variant === 'with_thumbnail') {
          const paths    = Array.isArray(zone.slot) ? zone.slot : [];
          const imageUrl = tpGet(input, paths[0]);
          const name     = tpGet(input, paths[1]);
          const priceRaw = tpGet(input, paths[2]);
          const priceStr = formatProductPrice(priceRaw);
          const maxLines = zone.max_lines || 2;
          const imgHtml = imageUrl
            ? `<img class="tp-product-card-thumb" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name || '')}" />`
            : `<div class="tp-product-card-thumb tp-product-card-thumb-placeholder">${escapeHtml((name || '?').slice(0, 1).toUpperCase())}</div>`;
          const nameHtml = `<div class="tp-product-card-name" style="display:-webkit-box;-webkit-line-clamp:${maxLines};-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(name || '')}</div>`;
          const priceHtml = priceStr
            ? `<div class="tp-product-card-price">${escapeHtml(priceStr)}</div>`
            : '';
          return imgHtml +
            `<div class="tp-product-card-meta">${nameHtml}${priceHtml}</div>`;
        }
        // Fallback for unknown variants — render placeholder.
        return `<div class="tp-placeholder">product_card (no variant)</div>`;
      }
      case 'media': {
        const media = tpGet(input, zone.slot);
        // Prefer video when the media object carries one (source Media
        // is a video); use the image as poster. Falls back to a plain
        // <img> tag when only an image is available.
        const videoSrcRaw = media?.video || null;
        const imgSrcRaw   = media?.image || media?.video_poster || null;
        // Slot-fit on Cloudinary URLs. The upstream crop is canvas-
        // aspect-shaped (e.g. 1000×1000 smart-crop for 1:1) but the
        // slot is rect.w × rect.h. Chaining c_fill,g_auto rounds out
        // the delivered image to the slot's exact dimensions with
        // subject-aware gravity — sharper than letting the browser
        // object-fit:cover a canvas-sized image into a smaller box.
        const slotW = Math.round(zone.rect?.w || 0);
        const slotH = Math.round(zone.rect?.h || 0);
        const videoSrc = slotFitCloudinaryUrl(videoSrcRaw, slotW, slotH);
        const imgSrc   = slotFitCloudinaryUrl(imgSrcRaw,   slotW, slotH);
        if (videoSrc) {
          return `<video src="${escapeHtml(videoSrc)}"` +
                 (imgSrc ? ` poster="${escapeHtml(imgSrc)}"` : '') +
                 ` muted autoplay loop playsinline preload="metadata"></video>`;
        }
        if (imgSrc) {
          return `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(zone.slot || '')}" />`;
        }
        return `<div class="tp-placeholder">${escapeHtml(zone.slot || 'media')}</div>`;
      }
      case 'text':
      case 'quote_card': {
        // slot can be a single path string OR an array of paths (e.g.
        // ["product.name", "product.price"] for a product_meta block).
        // Resolve each path and join; if the path returned an object with
        // a .text (quote), .name / .price (meta), use those fields.
        const paths = Array.isArray(zone.slot) ? zone.slot : (zone.slot ? [zone.slot] : []);
        const raws  = paths.map(p => tpGet(input, p));
        const first = raws.find(v => v != null && v !== '');
        const bits  = [];
        for (const v of raws) {
          if (v == null || v === '') continue;
          if (typeof v === 'string')           bits.push(v);
          else if (typeof v === 'number')      bits.push(String(v));
          else if (v.text)                     bits.push(v.text);
          else if (v.name || v.price)          bits.push([v.name, v.price].filter(Boolean).join(' · '));
          else if (Array.isArray(v))           bits.push(v.map(x => (x?.text || String(x || ''))).filter(Boolean).join(' · '));
        }
        const txt = bits.filter(Boolean).join(' · ');
        if (!txt) return `<div class="tp-placeholder">${escapeHtml(paths.join(' / ') || zone.kind)}</div>`;

        // Display-script headline: split into a lead phrase + main
        // phrase rendered at half / full size respectively per the
        // reference layout ("SOMETHING NEW IS" small, "COMING IN HOT"
        // big). Prefer the slot-aware split fields the derivation LLM
        // wrote against per-slot char budgets — those are designed to
        // fit lead/main exactly. Fall through to the heuristic splitter
        // for legacy single-string headlines.
        if (zone.kind === 'text' && zone.style_variant === 'display_script') {
          const lead = tpGet(input, 'copy.headline_lead');
          const main = tpGet(input, 'copy.headline_main');
          if (typeof lead === 'string' && lead.trim() && typeof main === 'string' && main.trim()) {
            return (
              `<span class="tp-headline-lead">${escapeHtml(lead.trim())}</span>` +
              `<span class="tp-headline-main">${escapeHtml(main.trim())}</span>`
            );
          }
          if (typeof main === 'string' && main.trim()) {
            return `<span class="tp-headline-main">${escapeHtml(main.trim())}</span>`;
          }
          const split = splitHeadlineForDisplayScript(txt);
          if (split.lead) {
            return (
              `<span class="tp-headline-lead">${escapeHtml(split.lead)}</span>` +
              `<span class="tp-headline-main">${escapeHtml(split.main)}</span>`
            );
          }
          return `<span class="tp-headline-main">${escapeHtml(split.main || txt)}</span>`;
        }

        // Quote card with author photo — adds an oversized open-quote
        // glyph at the top-left, the quote text, then a footer row with
        // the author avatar (creator.portrait_media if available),
        // author name, and a verified-customer mark when the quote
        // carries verified=true.
        if (zone.kind === 'quote_card' && zone.style_variant === 'with_author_photo') {
          const quote = (first && typeof first === 'object') ? first : {};
          const author = quote.author_name || tpGet(input, 'creator.name') || null;
          const verified = !!quote.verified;
          const portrait = tpGet(input, 'creator.portrait_media')?.image
                       || tpGet(input, 'ugc.media')?.image
                       || null;
          const photoHtml = portrait
            ? `<img class="tp-quote-avatar" src="${escapeHtml(portrait)}" alt="${escapeHtml(author || '')}" />`
            : `<div class="tp-quote-avatar tp-quote-avatar-placeholder">${escapeHtml((author || '').slice(0, 1).toUpperCase())}</div>`;
          const verifiedMark = verified ? `<span class="tp-quote-verified" title="Verified customer">✓</span>` : '';
          const verifiedTag = verified ? `<span class="tp-quote-verified-tag">VERIFIED CUSTOMER</span>` : '';
          return (
            `<span class="tp-quote-glyph">"</span>` +
            `<div class="tp-quote-text" style="display:-webkit-box;-webkit-line-clamp:${zone.max_lines||3};-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(txt)}</div>` +
            (author ? `<div class="tp-quote-author-row">${photoHtml}<div class="tp-quote-author-meta"><div class="tp-quote-author-name">${escapeHtml(author)}${verifiedMark}</div>${verifiedTag}</div></div>` : '')
          );
        }

        const authorFooter = (first && typeof first === 'object' && first.author_name)
          ? `<div style="font-size:8px;color:#555;margin-top:3px;">— ${escapeHtml(first.author_name)}</div>`
          : '';
        return `<div style="overflow:hidden;display:-webkit-box;-webkit-line-clamp:${zone.max_lines||4};-webkit-box-orient:vertical;">${escapeHtml(txt)}</div>${authorFooter}`;
      }
      case 'cta': {
        const raw = input.cta?.text || input.defaults?.cta_text || 'Shop';
        const cap = zone.max_chars;
        const txt = (cap && raw.length > cap)
          ? raw.slice(0, Math.max(1, cap - 1)).trimEnd() + '…'
          : raw;
        return escapeHtml(txt);
      }
      case 'logo': {
        const logo = tpGet(input, zone.slot);
        if (logo) return `<img src="${escapeHtml(String(logo))}" alt="logo" />`;
        return `<div class="tp-placeholder">${escapeHtml(input.brand?.name || 'logo')}</div>`;
      }
      case 'proof_bar': {
        const parts = tpMultiGet(input, zone.slot);
        const rating = tpGet(input, 'social_proof.rating_value');
        const reviews = tpGet(input, 'social_proof.review_count');
        const trustedBy = tpGet(input, 'trust.trusted_by_text') || tpGet(input, 'social_proof.trusted_by_text');

        // with_verified_buyers variant — stars + rating + (review count) +
        // divider + shield "VERIFIED BUYERS" badge. Used by landscape
        // testimonial_spotlight per reference.
        if (zone.style_variant === 'with_verified_buyers') {
          const stars = typeof rating === 'number'
            ? '★'.repeat(Math.max(0, Math.min(5, Math.round(rating))))
            : '★★★★★';
          const ratingNum = typeof rating === 'number' ? rating.toFixed(1) : null;
          const reviewsTxt = typeof reviews === 'number' ? `(${reviews.toLocaleString()} REVIEWS)` : null;
          return (
            `<span class="tp-proof-stars">${stars}</span>` +
            (ratingNum ? `<span class="tp-proof-rating">${ratingNum}</span>` : '') +
            (reviewsTxt ? `<span class="tp-proof-reviews">${escapeHtml(reviewsTxt)}</span>` : '') +
            `<span class="tp-proof-divider"></span>` +
            `<span class="tp-proof-verified"><span class="tp-proof-shield">🛡</span>VERIFIED BUYERS</span>`
          );
        }

        const bits = [];
        if (typeof rating === 'number') bits.push(`${rating.toFixed(1)}★`);
        if (typeof reviews === 'number') bits.push(`${reviews.toLocaleString()} reviews`);
        if (trustedBy)                   bits.push(trustedBy);
        if (!bits.length && parts.length) bits.push(parts.map(p => typeof p === 'object' ? JSON.stringify(p).slice(0, 20) : String(p)).join(' · '));
        if (!bits.length) return `<div class="tp-placeholder">proof bar</div>`;
        return bits.map(b => `<span>${escapeHtml(String(b))}</span>`).join('');
      }
      case 'metrics_row': {
        const metrics = tpGet(input, 'performance.metrics') || [];
        const cap = Math.min(zone.max_items || metrics.length, metrics.length);
        if (!cap) return `<div class="tp-placeholder">metrics</div>`;
        return metrics.slice(0, cap).map(m =>
          `<div class="tp-metric"><strong>${escapeHtml(String(m.value || ''))}</strong><span>${escapeHtml(String(m.label || ''))}</span></div>`
        ).join('');
      }
      case 'review_stack': {
        let quotes = tpGet(input, 'social_proof.secondary_quotes') || [];
        if (!quotes.length) {
          const primary = tpGet(input, 'social_proof.primary_quote');
          quotes = primary ? [primary] : [];
        }
        const cap = zone.max_items || 3;
        if (!quotes.length) return `<div class="tp-placeholder">reviews</div>`;
        return quotes.slice(0, cap).map(q =>
          `<div class="tp-review-bubble">${escapeHtml(String(q?.text || q || ''))}</div>`
        ).join('');
      }
      case 'identity_row': {
        const name = tpGet(input, 'creator.name') || tpGet(input, 'ugc.creator_name');
        const handle = tpGet(input, 'creator.handle') || tpGet(input, 'ugc.creator_handle');
        if (!name && !handle) return `<div class="tp-placeholder">identity</div>`;
        return `${name ? escapeHtml(name) : ''}${handle ? ` <span class="tp-handle">@${escapeHtml(handle)}</span>` : ''}`;
      }
      case 'badge_row': {
        const badges = tpGet(input, 'social_proof.proof_badges') || tpGet(input, 'product.badges') || [];

        // 'callouts' variant — icon + label pairs (no chip background).
        // Pattern-matches the badge label to a glyph via
        // calloutGlyphForLabel. Caps at zone.max_items.
        if (zone.style_variant === 'callouts') {
          const items = (Array.isArray(badges) ? badges : []).slice(0, zone.max_items || 4);
          if (!items.length) return `<div class="tp-placeholder">callouts</div>`;
          return items.map(b => {
            const label = String(b || '').toUpperCase();
            const glyph = calloutGlyphForLabel(b);
            return `<span class="tp-callout"><span class="tp-callout-glyph">${glyph}</span><span class="tp-callout-label">${escapeHtml(label)}</span></span>`;
          }).join('');
        }

        const chips = [];
        const likes    = tpGet(input, 'ugc.likes');
        const comments = tpGet(input, 'ugc.comments');
        if (typeof likes === 'number')    chips.push(`♥ ${likes.toLocaleString()}`);
        if (typeof comments === 'number') chips.push(`💬 ${comments.toLocaleString()}`);
        for (const b of (Array.isArray(badges) ? badges : []).slice(0, 2)) chips.push(b);
        if (!chips.length) return `<div class="tp-placeholder">badges</div>`;
        return chips.map(c => `<span class="tp-chip-mini">${escapeHtml(String(c))}</span>`).join('');
      }
      case 'background':
        return '';
      default:
        return `<div class="tp-placeholder">${escapeHtml(zone.kind)}</div>`;
    }
  }

  // Path resolution matching the backend's template-registry getPath:
  // supports dotted keys, numeric indices, and bracketed indices.
  function tpGet(obj, path) {
    if (!obj || !path || typeof path !== 'string') return undefined;
    const parts = path.split('.');
    let cur = obj;
    for (const part of parts) {
      if (cur == null) return undefined;
      const bracket = part.match(/^([^\[]+)\[(\d+)\]$/);
      if (bracket) {
        cur = cur[bracket[1]];
        if (Array.isArray(cur)) cur = cur[Number(bracket[2])];
        else return undefined;
        continue;
      }
      if (/^\d+$/.test(part) && Array.isArray(cur)) { cur = cur[Number(part)]; continue; }
      cur = cur[part];
    }
    return cur;
  }

  // When a zone.slot is an ARRAY of paths, resolve each and return the
  // non-empty values. Used by proof_bar zones with multiple data sources.
  function tpMultiGet(input, slot) {
    if (!slot) return [];
    if (Array.isArray(slot)) return slot.map(s => tpGet(input, s)).filter(v => v != null && v !== '');
    const v = tpGet(input, slot);
    return v == null || v === '' ? [] : [v];
  }

  // Decisions panel for overlay-mode previews. Shows the per-element
  // trace the backend emitted: state (placed / fallback-placed / dropped /
  // failed-required / skipped), reason, and placement metadata when placed.
  function renderOverlayDecisionsPanel(statusEl, input, validation) {
    const placement = input.placement;
    if (!placement) { statusEl.innerHTML = ''; return; }

    const parts = [];

    // Mode summary
    const mode = placement.mode || 'overlay';
    const conservation = typeof placement.conservation === 'number'
      ? `${Math.round(placement.conservation * 100)}%` : '—';
    parts.push(`<div class="tp-overlay-mode-row">
      <div><strong>Mode:</strong> ${escapeHtml(mode)}</div>
      <div><strong>Conservation:</strong> ${conservation}</div>
      <div><strong>Placed:</strong> ${placement.elements?.length || 0}</div>
    </div>`);

    // Validation echo (still useful)
    if (validation) {
      if (validation.ok) {
        parts.push(`<p style="font-size:11px;color:#34d399;margin-bottom:10px;">✓ Input satisfies <code style="color:#e879f9;font-family:'Courier New',monospace;">${escapeHtml(validation.template_id)}</code> validation</p>`);
      } else {
        parts.push(`<p style="font-size:11px;color:#f87171;margin-bottom:10px;">✗ Input did NOT satisfy template validation — render proceeded with allow_invalid</p>`);
      }
    }

    // Decision trace
    parts.push(`<p class="tp-decision-section-head">Element placement trace</p>`);
    for (const d of (placement.decisions || [])) {
      const chipHtml = `<span class="tp-decision-chip state-${d.state}">${escapeHtml(d.state.replace('-', ' '))}</span>`;

      const metaBits = [];
      if (d.variant)                           metaBits.push(`shape: ${d.variant}${d.layout ? '/' + d.layout : ''}${d.maxLines ? ' · ' + d.maxLines + ' line' + (d.maxLines === 1 ? '' : 's') : ''}`);
      if (d.rectPct) {
        const pct = (v) => Math.round(v * 100);
        metaBits.push(`rect: ${pct(d.rectPct.x1)}%, ${pct(d.rectPct.y1)}% → ${pct(d.rectPct.x2)}%, ${pct(d.rectPct.y2)}%`);
      }
      if (d.textColor)                         metaBits.push(`text: ${d.textColor}`);
      if (d.scrim && d.scrim.type !== 'none')  metaBits.push(`scrim: ${d.scrim.type.replace('gradient-', '')} ${(d.scrim.opacity || 0).toFixed(2)} ${d.scrim.direction || ''}`);
      if (typeof d.fontScale === 'number' && d.fontScale < 1) metaBits.push(`font: ${Math.round(d.fontScale * 100)}%`);
      if (d.stats) {
        const s = d.stats;
        if (typeof s.candidatesEvaluated === 'number') metaBits.push(`cands: ${s.candidatesEvaluated} eval / ${s.candidatesLegal} legal`);
        if (typeof s.bgBrightness === 'number') metaBits.push(`bg brightness: ${s.bgBrightness}`);
        if (typeof s.bgDensity === 'number')    metaBits.push(`bg density: ${s.bgDensity}`);
      }

      parts.push(`
        <div class="tp-decision-row">
          ${chipHtml}
          <div class="tp-decision-body">
            <span class="tp-dec-id">${escapeHtml(d.id)}</span>
            ${d.required ? '<span style="font-size:9px;color:#888;margin-left:6px;">required</span>' : '<span style="font-size:9px;color:#555;margin-left:6px;">optional</span>'}
            ${d.region ? `<span style="font-size:9px;color:#666;margin-left:6px;">→ ${escapeHtml(d.region)}</span>` : ''}
            <div class="tp-dec-reason">${escapeHtml(d.reason || '')}</div>
            ${metaBits.length ? `<div class="tp-dec-meta">${escapeHtml(metaBits.join(' · '))}</div>` : ''}
          </div>
        </div>
      `);
    }

    if (placement.failedRequired?.length) {
      parts.push(`<p style="font-size:10px;color:#f87171;margin-top:10px;padding-top:8px;border-top:1px solid #222;">⚠ Required elements that could not place: ${placement.failedRequired.map(id => `<code style="color:#f87171;">${escapeHtml(id)}</code>`).join(', ')}. Inset-mode fallback ${placement.mode === 'inset' ? 'was invoked.' : 'was attempted but also failed.'}</p>`);
    }

    statusEl.innerHTML = parts.join('');
  }

  function renderTpStatus(statusEl, validation, input) {
    const parts = [];
    if (!validation) { statusEl.innerHTML = ''; return; }
    if (validation.ok) {
      parts.push(`<p><span class="tp-ok">✓ Valid</span> — this Media satisfies <code>${escapeHtml(validation.template_id)}</code> at this ratio.</p>`);
    } else {
      parts.push(`<p><span class="tp-bad">✗ Invalid</span> — missing required content:</p>`);
      if (validation.missing?.length) {
        parts.push(`<p style="margin-top:6px;">Required:<br>${validation.missing.map(p => `<code>${escapeHtml(p)}</code>`).join(', ')}</p>`);
      }
      if (validation.anyOfFailures?.length) {
        parts.push(`<p style="margin-top:6px;">Need at least one from each group:</p>`);
        for (const group of validation.anyOfFailures) {
          parts.push(`<p style="margin-left:8px;">• ${group.map(p => `<code>${escapeHtml(p)}</code>`).join(' or ')}</p>`);
        }
      }
      if (validation.minCountFailures && Object.keys(validation.minCountFailures).length) {
        for (const [p, info] of Object.entries(validation.minCountFailures)) {
          parts.push(`<p style="margin-top:6px;"><code>${escapeHtml(p)}</code> needs ≥ ${info.needed} (have ${info.have}).</p>`);
        }
      }
      parts.push(`<p style="margin-top:8px;color:#555;font-size:10px;">Preview uses fallbacks so you can still see the geometry. Fix the missing data (caption, review summary, etc.) or pick a different template.</p>`);
    }

    // Small summary of what we DID resolve (for debugging).
    const resolved = [];
    if (input?.brand?.name)          resolved.push(`brand: ${input.brand.name}`);
    if (input?.product?.name)        resolved.push(`product: ${input.product.name}`);
    if (input?.creator?.handle)      resolved.push(`@${input.creator.handle}`);
    if (input?.social_proof?.primary_quote?.text) resolved.push(`quote: "${input.social_proof.primary_quote.text.slice(0, 40)}…"`);
    if (resolved.length) {
      parts.push(`<p style="margin-top:10px;padding-top:8px;border-top:1px solid #222;color:#666;">Resolved: ${resolved.map(r => escapeHtml(r)).join(' · ')}</p>`);
    }

    // Zone-by-zone resolution trace. Mirrors the overlay-mode decision
    // panel: for every canvas zone, did its slot(s) resolve to something?
    const trace = buildCanonicalZoneTrace(TP_STATE.lastCanvas, input);
    if (trace.length) {
      parts.push(`<p class="tp-decision-section-head">Zone resolution trace</p>`);
      for (const t of trace) {
        const chipHtml = `<span class="tp-decision-chip state-${t.state}">${escapeHtml(t.state.replace('-', ' '))}</span>`;
        const meta = [];
        if (t.slotPaths.length) meta.push(`slot: ${t.slotPaths.join(' / ')}`);
        if (t.previewValue) meta.push(`value: ${t.previewValue}`);
        parts.push(`
          <div class="tp-decision-row">
            ${chipHtml}
            <div class="tp-decision-body">
              <span class="tp-dec-id">${escapeHtml(t.label)}</span>
              <span style="font-size:9px;color:#555;margin-left:6px;">${escapeHtml(t.kind)}</span>
              ${meta.length ? `<div class="tp-dec-meta">${escapeHtml(meta.join(' · '))}</div>` : ''}
            </div>
          </div>
        `);
      }
    }

    statusEl.innerHTML = parts.join('');
  }

  // For canonical templates, walk canvas.zones[] and for each zone determine
  // whether its slot(s) resolved against the input. Returns array of
  // { state, label, kind, slotPaths, previewValue }.
  function buildCanonicalZoneTrace(canvas, input) {
    if (!canvas || !Array.isArray(canvas.zones)) return [];
    const out = [];
    for (const zone of canvas.zones) {
      const paths = Array.isArray(zone.slot) ? zone.slot : (zone.slot ? [zone.slot] : []);
      const values = paths.map(p => tpGet(input, p));
      const resolved = values.some(v => v != null && v !== '' && !(Array.isArray(v) && v.length === 0));

      // Kind-specific self-contained zones (cta, proof_bar, metrics_row)
      // don't always carry a `slot` but still have resolvable content.
      let state = resolved ? 'placed' : 'dropped';
      let previewValue = null;
      if (!paths.length) {
        if (zone.kind === 'cta') {
          const ctaText = input?.cta?.text || input?.defaults?.cta_text;
          state = ctaText ? 'placed' : 'dropped';
          previewValue = ctaText || null;
        } else if (zone.kind === 'proof_bar') {
          const hasProof = !!(input?.social_proof?.rating_value || input?.social_proof?.review_count || input?.trust?.trusted_by_text);
          state = hasProof ? 'placed' : 'dropped';
        } else if (zone.kind === 'metrics_row') {
          state = (input?.performance?.metrics?.length) ? 'placed' : 'dropped';
        } else {
          state = 'placed';
        }
      } else if (resolved) {
        const v = values.find(x => x != null && x !== '');
        if (typeof v === 'string')      previewValue = v.slice(0, 60);
        else if (typeof v === 'number') previewValue = String(v);
        else if (v?.text)               previewValue = String(v.text).slice(0, 60);
        else if (v?.name)               previewValue = String(v.name).slice(0, 60);
        else if (v?.image)              previewValue = v.image.split('/').pop();
      }
      out.push({
        state,
        label: zone.id || zone.kind,
        kind:  zone.kind,
        slotPaths: paths,
        previewValue
      });
    }
    return out;
  }

  function tpValidationSummary(cand) {
    if (cand.ok) return 'supported';
    const bits = [];
    if (cand.missing?.length) bits.push(`missing: ${cand.missing.join(', ')}`);
    if (cand.anyOfFailures?.length) bits.push(`${cand.anyOfFailures.length} any-of group(s) unsatisfied`);
    if (cand.minCountFailures && Object.keys(cand.minCountFailures).length) bits.push(`min counts: ${Object.keys(cand.minCountFailures).join(', ')}`);
    return bits.join(' · ') || 'unsupported';
  }

// Re-expose the entry point so host pages can call it from their own flow
// (detect: after detection completes; ads: after a media is picked).
window.renderTemplatePreview = renderTemplatePreview;
})();
