let searchQuery = '';
let activeCategory = '';
let viewMode = 'style';

// ── URL sync ──────────────────────────────────────────────────
let activeIcon = '';

function readURL() {
  const p = new URLSearchParams(window.location.search);
  if (p.has('q')) searchQuery = p.get('q');
  if (p.has('category')) activeCategory = p.get('category');
  if (p.has('size')) currentView = p.get('size');
  if (p.has('view')) viewMode = p.get('view');
  if (p.has('icon')) activeIcon = p.get('icon');
}

function buildURL() {
  const p = new URLSearchParams();
  if (searchQuery) p.set('q', searchQuery);
  if (activeCategory) p.set('category', activeCategory);
  if (currentView !== '24') p.set('size', currentView);
  if (viewMode !== 'style') p.set('view', viewMode);
  if (activeIcon) p.set('icon', activeIcon);
  const qs = p.toString();
  return `${window.location.pathname}${qs ? `?${qs}` : ''}`;
}

function syncURL() {
  history.replaceState(null, '', buildURL());
}

// Stroke widths that look optically correct at each size
function sw(size) {
  if (size <= 16) return 1.75;
  if (size <= 20) return 1.5;
  return 1.5;
}

function svgWrap(size, innerSvg, style) {
  let content = innerSvg;
  if (STROKED_STYLES.has(style)) {
    content = content.replace(
      /stroke-width="[^"]*"/g,
      `stroke-width="${sw(size)}"`,
    );
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
}

let currentView = '24';

function matchesSearch(name, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const m = ICON_META[name];
  if (name.includes(q)) return true;
  if (m.label.toLowerCase().includes(q)) return true;
  if (m.description.toLowerCase().includes(q)) return true;
  return m.tags.some((t) => t.toLowerCase().includes(q));
}

function matchesCategory(name, cat) {
  if (!cat) return true;
  return ICON_META[name].category === cat;
}

function getFilteredNames() {
  return ICON_NAMES.filter(
    (n) => matchesSearch(n, searchQuery) && matchesCategory(n, activeCategory),
  );
}

function render() {
  const content = document.getElementById('content');
  const isSingle = currentView !== 'all';
  const singleSize = isSingle ? parseInt(currentView, 10) : 24;
  const filteredNames = getFilteredNames();

  let html = '';

  if (filteredNames.length === 0) {
    html = '<div class="empty-state">No icons match your search</div>';
  } else if (viewMode === 'category') {
    // Group filtered icons by category
    for (const cat of CATEGORIES) {
      const catIcons = filteredNames.filter(
        (n) => ICON_META[n].category === cat,
      );
      if (catIcons.length === 0) continue;

      html += '<section class="style-section">';
      html += '<div class="cat-section-header">';
      html += `<span class="cat-section-label">${cat}</span>`;
      html += `<span class="cat-section-count">${catIcons.length}${catIcons.length === 1 ? ' icon' : ' icons'}</span>`;
      html += '</div>';

      for (const iconName of catIcons) {
        const label = ICON_META[iconName].label;
        html += `<div class="cat-icon-row" data-icon-name="${iconName}">`;
        html += `<span class="cat-icon-name">${label}</span>`;
        html += '<div class="cat-icon-variants">';
        for (const styleKey of STYLE_ORDER) {
          const innerSvg = ICONS[styleKey]?.[iconName];
          if (!innerSvg) continue;
          const size = singleSize;
          html += '<div class="cat-icon-variant">';
          html += `<div class="icon-wrap">${svgWrap(size, innerSvg, styleKey)}</div>`;
          html += `<span class="variant-label">${STYLE_META[styleKey].label}</span>`;
          html += '</div>';
        }
        html += '</div></div>';
      }
      html += '</section>';
    }
  } else {
    // "By style" rendering — vertical wrapping grid
    const size = singleSize;
    for (const styleKey of STYLE_ORDER) {
      const icons = ICONS[styleKey];
      if (!icons) continue;
      const meta = STYLE_META[styleKey] || {
        label: styleKey,
        tag: '',
        desc: '',
      };

      html += '<section class="style-section">';
      html += '<div class="style-header">';
      html += `<span class="style-label">${meta.label}</span>`;
      html += `<span class="style-tag">${meta.tag}</span>`;
      html += `<span class="style-desc">${meta.desc}</span>`;
      html += '</div>';
      html += '<div class="icon-grid">';

      for (const iconName of filteredNames) {
        const innerSvg = icons[iconName];
        if (!innerSvg) continue;
        const label = ICON_META[iconName].label;
        html += `<div class="icon-cell" data-icon-name="${iconName}">`;
        html += `<div class="icon-wrap">${svgWrap(size, innerSvg, styleKey)}</div>`;
        html += `<span class="icon-name">${label}</span>`;
        html += `<button class="copy-btn" data-icon="${iconName}" data-style="${styleKey}" data-sz="${size}" title="Copy SVG">`;
        html +=
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
        html += '</button>';
        html += '</div>';
      }
      html += '</div></section>';
    }
  }

  content.innerHTML = html;
  updateFooter(filteredNames.length);
}

function updateFooter(shown) {
  const el = document.getElementById('footer-count');
  const countEl = document.getElementById('icon-count');
  const text =
    shown < ICON_NAMES.length
      ? `${shown} of ${ICON_NAMES.length} icons`
      : `${ICON_NAMES.length} icons`;
  if (el) el.textContent = text;
  if (countEl) countEl.textContent = text;
}

function setView(v) {
  currentView = v;
  document.querySelectorAll('.size-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === v);
  });
  syncURL();
  render();
}

function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('btn-dark').classList.toggle('active', t === 'dark');
  document
    .getElementById('btn-light')
    .classList.toggle('active', t === 'light');
}

function setCat(cat) {
  activeCategory = cat;
  document.querySelectorAll('.cat-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.cat === cat);
  });
  syncURL();
  render();
}

function setViewMode(mode) {
  viewMode = mode;
  document.querySelectorAll('.view-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.viewMode === mode);
  });
  // Hide category pills when in category view (redundant)
  const catBar = document.getElementById('category-bar');
  if (catBar) {
    catBar.style.display = mode === 'category' ? 'none' : '';
  }
  if (mode === 'category') {
    activeCategory = '';
    document.querySelectorAll('.cat-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.cat === '');
    });
  }
  syncURL();
  render();
}

window.setViewMode = setViewMode;

function openDetail(iconName) {
  const m = ICON_META[iconName];
  const isSingle = currentView !== 'all';
  const sz = isSingle ? parseInt(currentView, 10) : 24;
  const copySvg =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';

  let html = '<div class="detail-panel-header">';
  html += '<div class="detail-panel-header-left">';
  html += `<span class="detail-title">${m.label}</span>`;
  html += `<span class="detail-filename">${iconName}.svg</span>`;
  html += '</div>';
  html +=
    '<button class="detail-close" id="detail-close-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';
  html += '</div>';
  html += '<div class="detail-panel-body">';
  html += `<div class="detail-desc">${m.description}</div>`;
  html += '<div class="detail-meta">';
  html += `<span class="detail-category">${m.category}</span>`;
  html += '<div class="detail-tags">';
  for (const tag of m.tags) {
    html += `<span class="detail-tag">${tag}</span>`;
  }
  html += '</div></div>';
  html += '<div class="detail-section-label">Variants</div>';
  html += '<div class="detail-variants">';
  for (const styleKey of STYLE_ORDER) {
    const innerSvg = ICONS[styleKey]?.[iconName];
    if (!innerSvg) continue;
    html += '<div class="detail-variant">';
    html += `<div class="icon-wrap">${svgWrap(sz, innerSvg, styleKey)}</div>`;
    html += `<span class="detail-variant-label">${STYLE_META[styleKey].label}</span>`;
    html += `<button class="detail-copy-btn" data-icon="${iconName}" data-style="${styleKey}" data-sz="${sz}">${copySvg}</button>`;
    html += '</div>';
  }
  html += '</div>';
  // Size variations
  html +=
    '<div class="detail-section-label" style="margin-top:var(--space-5)">Sizes</div>';
  html += '<div class="detail-sizes">';
  const sizeList = [16, 20, 24, 32, 48];
  const previewStyle = 'outline';
  const previewSvg = ICONS[previewStyle]?.[iconName];
  if (previewSvg) {
    for (const s of sizeList) {
      html += '<div class="detail-size-item">';
      html += svgWrap(s, previewSvg, previewStyle);
      html += `<span class="detail-size-label">${s}</span>`;
      html += '</div>';
    }
  }
  html += '</div>';
  html += '</div>';

  document.getElementById('detail-panel').innerHTML = html;
  document.getElementById('detail-panel').classList.add('open');
  document.getElementById('detail-backdrop').classList.add('open');
  activeIcon = iconName;
  history.pushState(null, '', buildURL());
}

function closeDetail() {
  document.getElementById('detail-panel').classList.remove('open');
  document.getElementById('detail-backdrop').classList.remove('open');
  activeIcon = '';
  history.pushState(null, '', buildURL());
}

function copyVariant(iconName, styleKey, sz) {
  const innerSvg = ICONS[styleKey]?.[iconName];
  if (!innerSvg) return;
  const svgString = svgWrap(sz, innerSvg, styleKey);
  navigator.clipboard.writeText(svgString).then(() => {
    const toast = document.getElementById('toast');
    toast.textContent = `${STYLE_META[styleKey].label} SVG copied`;
    toast.classList.add('visible');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 1500);
  });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  const inSearch = document.activeElement === document.getElementById('search');

  if (e.key === 'Escape') {
    const panel = document.getElementById('detail-panel');
    if (panel?.classList.contains('open')) {
      closeDetail();
      return;
    }
  }

  if (e.key === '/' && !inSearch) {
    e.preventDefault();
    document.getElementById('search').focus();
    return;
  }
  if (e.key === 'Escape' && inSearch) {
    document.getElementById('search').value = '';
    searchQuery = '';
    document.getElementById('search').blur();
    syncURL();
    render();
    return;
  }
  if (e.key === 'Escape' && activeCategory) {
    setCat('');
    return;
  }

  if (inSearch) return;

  if (e.key === 't' || e.key === 'T') {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  }
  if (e.key === '1') setView('16');
  if (e.key === '2') setView('20');
  if (e.key === '3') setView('24');
  if (e.key === '4') setView('32');
  if (e.key === '5') setView('48');
  if (e.key === '0') setView('all');
});

// Click handler — detail panel, copy buttons
document.addEventListener('click', (e) => {
  // Detail panel copy button
  const copyBtn = e.target.closest('.detail-copy-btn');
  if (copyBtn) {
    copyVariant(
      copyBtn.dataset.icon,
      copyBtn.dataset.style,
      parseInt(copyBtn.dataset.sz, 10),
    );
    return;
  }

  // Grid copy button (hover overlay)
  const gridCopyBtn = e.target.closest('.copy-btn');
  if (gridCopyBtn) {
    e.stopPropagation();
    copyVariant(
      gridCopyBtn.dataset.icon,
      gridCopyBtn.dataset.style,
      parseInt(gridCopyBtn.dataset.sz, 10),
    );
    return;
  }

  // Close detail panel on backdrop click or close button
  if (e.target.id === 'detail-backdrop' || e.target.id === 'detail-close-btn') {
    closeDetail();
    return;
  }

  // Open detail on icon cell or row click
  const cell = e.target.closest('[data-icon-name]');
  if (cell && !cell.closest('.detail-panel')) {
    openDetail(cell.dataset.iconName);
    return;
  }
});

// Initialize from URL params (if any), then render
readURL();

// Apply URL state to UI controls
document.querySelectorAll('.size-btn').forEach((b) => {
  b.classList.toggle('active', b.dataset.view === currentView);
});
document.querySelectorAll('.cat-btn').forEach((b) => {
  b.classList.toggle('active', b.dataset.cat === activeCategory);
});
document.querySelectorAll('.view-btn').forEach((b) => {
  b.classList.toggle('active', b.dataset.viewMode === viewMode);
});
if (viewMode === 'category') {
  const catBar = document.getElementById('category-bar');
  if (catBar) catBar.style.display = 'none';
}
if (searchQuery) {
  document.getElementById('search').value = searchQuery;
}
render();
if (activeIcon && ICON_META[activeIcon]) {
  openDetail(activeIcon);
  // Replace the initial pushState so we don't get a double entry
  history.replaceState(null, '', buildURL());
}

window.addEventListener('popstate', () => {
  const p = new URLSearchParams(window.location.search);
  const icon = p.get('icon') || '';
  activeIcon = icon;
  if (icon && ICON_META[icon]) {
    openDetail(icon);
    // openDetail pushes state, undo that so popstate doesn't stack
    history.replaceState(null, '', buildURL());
  } else {
    closeDetail();
    history.replaceState(null, '', buildURL());
  }
});

document.getElementById('search').addEventListener('input', (e) => {
  searchQuery = e.target.value;
  syncURL();
  render();
});
