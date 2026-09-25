// ============================================================
// Home themes · 主题宿主
// - 管理主题注册、切换、显示/隐藏
// - 左上角拉绳：往下拉一下切到下一套主题
// - 设置面板「主页主题」分段按钮
// 主题只在主页显示时运行；主页隐藏或窗口不可见时暂停。
// ============================================================

var HOME_THEME_STORAGE_KEY = 'mineradio-home-theme-v1';
var homeThemeRegistry = [{ id: 'classic', name: '原版' }];
var homeThemeHost = {
  current: 'classic',
  instance: null,
  instanceId: '',
  root: null,
  stage: null,
  visible: false,
  switching: false,
  pending: '',        // 动画切换进行中时要切到的主题（连续拉绳按它往下算）
  switchTimer: 0,
  unsubscribe: null,
  tickTimer: 0,
  styles: Object.create(null),
};

function registerHomeTheme(def) {
  if (!def || !def.id || typeof def.create !== 'function') return;
  homeThemeRegistry = homeThemeRegistry.filter(function (t) { return t.id !== def.id; });
  homeThemeRegistry.push(def);
  renderHomeThemeSettingsSeg();
}

function homeThemeDef(id) {
  return homeThemeRegistry.filter(function (t) { return t.id === id; })[0] || null;
}

function readHomeThemePreference() {
  try { return localStorage.getItem(HOME_THEME_STORAGE_KEY) || ''; } catch (_e) { return ''; }
}
function writeHomeThemePreference(id) {
  try { localStorage.setItem(HOME_THEME_STORAGE_KEY, id); } catch (_e) { }
}

function homeThemeReducedMotion() {
  try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_e) { return false; }
}

// 主题可以用它注入自己的样式（只注入一次）
function homeThemeInjectStyle(id, css) {
  if (homeThemeHost.styles[id]) return;
  var el = document.createElement('style');
  el.setAttribute('data-home-theme-style', id);
  el.textContent = css;
  document.head.appendChild(el);
  homeThemeHost.styles[id] = el;
}

function homeThemeCoversScene() {
  return !!(homeThemeHost.visible && homeThemeHost.current !== 'classic' && homeThemeHost.instance && !homeThemeHost.switching);
}

function homeThemeShell() {
  return document.getElementById('desktop-window-shell') || document.body;
}

function ensureHomeThemeRoot() {
  if (homeThemeHost.root) return homeThemeHost.root;
  homeThemeInjectStyle('host', [
    '#home-theme-root{position:fixed;inset:0;z-index:5;overflow:hidden;background:#000;opacity:0;pointer-events:none;transition:opacity .42s ease;contain:strict}',
    '#home-theme-root.on{opacity:1;pointer-events:auto}',
    '#home-theme-root .hth-stage{position:absolute;inset:0;transition:opacity .32s ease,filter .32s ease}',
    '#home-theme-root.switching .hth-stage{opacity:0;filter:blur(6px)}',
    'body.home-theme-on #empty-home,body.home-theme-on #search-area,body.home-theme-on #bottom-bar,body.home-theme-on #bottom-handle,body.home-theme-on #thumb-wrap{visibility:hidden!important;opacity:0!important;pointer-events:none!important}',
    // 主题页面上保留窗口按钮（最小化 / 全屏 / 关闭）和右上角账号区；主题要给它们留位置（见 --hth-safe-*）
    '#home-theme-root{--hth-safe-r:300px;--hth-safe-t:112px}',
    // 浅色主题（纸面）上，把窗口按钮和账号按钮换成油墨色，免得白色玻璃按钮看不清
    'body.home-theme-on.hth-chrome-light #top-right .icon-btn,body.home-theme-on.hth-chrome-light #desktop-titlebar .desktop-window-controls>button,body.desktop-shell.home-theme-on.hth-chrome-light #desktop-titlebar #visual-guide-btn{background:rgba(var(--hth-chrome-rgb,42,76,156),.09)!important;color:rgb(var(--hth-chrome-rgb,42,76,156))!important;border-color:rgba(var(--hth-chrome-rgb,42,76,156),.3)!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    'body.home-theme-on.hth-chrome-light #top-right .icon-btn:hover,body.home-theme-on.hth-chrome-light #desktop-titlebar .desktop-window-controls>button:hover,body.desktop-shell.home-theme-on.hth-chrome-light #desktop-titlebar #visual-guide-btn:hover{background:rgba(var(--hth-chrome-rgb,42,76,156),.18)!important}',
    'body.home-theme-on.hth-chrome-light #desktop-titlebar .desktop-window-controls>button.close:hover{background:rgba(255,61,154,.85)!important;color:#fff!important}',
    'body.home-theme-on.hth-chrome-light #top-right .top-account-name{color:rgb(var(--hth-chrome-rgb,42,76,156))!important;text-shadow:none!important}',
    'body.desktop-shell.desktop-fullscreen #home-theme-root{--hth-safe-t:104px}',
    // 主页上，左侧自动弹出的歌单/队列面板往下挪，让开左上角的拉绳
    'body.empty-home-active #playlist-panel{top:clamp(172px,21vh,196px)!important;max-height:calc(100vh - clamp(172px,21vh,196px) - 40px)!important}',
    // 拉绳
    '#home-theme-cord{position:fixed;left:34px;top:0;width:44px;height:170px;z-index:12;pointer-events:none;opacity:0;transition:opacity .4s ease;--cord-color:rgba(236,228,212,.78);--cord-glow:rgba(255,236,200,.35)}',
    'body.empty-home-active #home-theme-cord{opacity:1}',
    'body.splash-active #home-theme-cord,body.immersive-mode #home-theme-cord{opacity:0!important}',
    '#home-theme-cord svg{position:absolute;left:0;top:0;width:44px;height:170px;overflow:visible}',
    '#home-theme-cord .cord-line{stroke:var(--cord-color);stroke-width:1.3;fill:none;stroke-linecap:round}',
    '#home-theme-cord .cord-bead{fill:var(--cord-color);filter:drop-shadow(0 0 6px var(--cord-glow))}',
    '#home-theme-cord .cord-hit{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;pointer-events:auto;cursor:grab;touch-action:none}',
    '#home-theme-cord .cord-hit:active{cursor:grabbing}',
    '#home-theme-cord .cord-tip{position:absolute;left:30px;white-space:nowrap;font:500 11px/1 "Microsoft YaHei UI","Microsoft YaHei","Noto Sans CJK SC",sans-serif;letter-spacing:.12em;color:var(--cord-color);opacity:0;transform:translateX(-4px);transition:opacity .25s,transform .25s;pointer-events:none}',
    '#home-theme-cord.hover .cord-tip,#home-theme-cord.pulling .cord-tip{opacity:.85;transform:none}',
  ].join('\n'));
  var root = document.createElement('div');
  root.id = 'home-theme-root';
  root.setAttribute('aria-label', 'Mineradio 主页');
  var stage = document.createElement('div');
  stage.className = 'hth-stage';
  root.appendChild(stage);
  // 挂在窗口外壳里（和原版主页同一层级），这样窗口圆角、最小化动画、标题栏按钮、弹窗都能正常叠在上面
  var shell = homeThemeShell();
  var anchor = document.getElementById('empty-home');
  if (anchor && anchor.parentNode === shell) shell.insertBefore(root, anchor.nextSibling);
  else shell.appendChild(root);
  homeThemeHost.root = root;
  homeThemeHost.stage = stage;
  createHomeThemeCord();
  return root;
}

function homeThemeContext() {
  return {
    model: buildHomeThemeModel,
    actions: homeThemeActions,
    cover: homeThemeCoverUrl,
    reducedMotion: homeThemeReducedMotion(),
    injectStyle: homeThemeInjectStyle,
    toast: function (msg) { if (typeof showToast === 'function') showToast(msg); },
  };
}

function destroyHomeThemeInstance() {
  if (homeThemeHost.unsubscribe) { homeThemeHost.unsubscribe(); homeThemeHost.unsubscribe = null; }
  if (homeThemeHost.instance && typeof homeThemeHost.instance.destroy === 'function') {
    try { homeThemeHost.instance.destroy(); } catch (e) { console.warn('[HomeTheme] destroy', e); }
  }
  homeThemeHost.instance = null;
  homeThemeHost.instanceId = '';
  if (homeThemeHost.stage) homeThemeHost.stage.innerHTML = '';
}

function createHomeThemeInstance(id) {
  var def = homeThemeDef(id);
  if (!def || id === 'classic') return;
  ensureHomeThemeRoot();
  var mount = document.createElement('div');
  mount.className = 'hth hth-' + id;
  mount.style.cssText = 'position:absolute;inset:0;overflow:hidden';
  homeThemeHost.stage.appendChild(mount);
  try {
    homeThemeHost.instance = def.create(mount, homeThemeContext()) || null;
    homeThemeHost.instanceId = id;
  } catch (e) {
    console.error('[HomeTheme] create ' + id, e);
    homeThemeHost.instance = null;
    return;
  }
  var cord = document.getElementById('home-theme-cord');
  if (cord) {
    cord.style.setProperty('--cord-color', def.cordColor || 'rgba(236,228,212,.78)');
    cord.style.setProperty('--cord-glow', def.cordGlow || 'rgba(255,236,200,.35)');
  }
  homeThemeHost.unsubscribe = onHomeThemeModel(function (model) {
    if (homeThemeHost.instance && typeof homeThemeHost.instance.update === 'function') homeThemeHost.instance.update(model);
  });
  try { if (homeThemeHost.instance && homeThemeHost.instance.update) homeThemeHost.instance.update(buildHomeThemeModel()); } catch (e) { console.warn('[HomeTheme] first update', e); }
}

function homeThemeStartTicker() {
  if (homeThemeHost.tickTimer) return;
  // 进度、时钟每秒刷新一次（模型很轻）
  homeThemeHost.tickTimer = setInterval(function () {
    if (!homeThemeHost.visible || document.hidden) return;
    homeThemeNotify();
  }, 1000);
}
function homeThemeStopTicker() {
  if (homeThemeHost.tickTimer) clearInterval(homeThemeHost.tickTimer);
  homeThemeHost.tickTimer = 0;
}

function syncHomeThemeVisibility() {
  var body = document.body;
  var homeShown = body.classList.contains('empty-home-active') && !body.classList.contains('splash-active') && !body.classList.contains('immersive-mode');
  var wantTheme = homeShown && homeThemeHost.current !== 'classic' && !!homeThemeDef(homeThemeHost.current);
  // body 的 class 变化很频繁，状态没变就不做事
  var signature = (wantTheme ? 1 : 0) + '|' + homeThemeHost.current + '|' + homeThemeHost.instanceId + '|' + (homeShown ? 1 : 0);
  if (signature === homeThemeHost.lastSignature) return;
  homeThemeHost.lastSignature = signature;
  if (wantTheme) {
    ensureHomeThemeRoot();
    if (homeThemeHost.instanceId !== homeThemeHost.current) {
      destroyHomeThemeInstance();
      createHomeThemeInstance(homeThemeHost.current);
    } else if (homeThemeHost.instance && homeThemeHost.instance.resume && !homeThemeHost.visible) {
      homeThemeHost.instance.resume();
    }
    homeThemeHost.visible = true;
    homeThemeHost.root.classList.add('on');
    body.classList.add('home-theme-on');
    var chromeDef = homeThemeDef(homeThemeHost.current);
    body.classList.toggle('hth-chrome-light', !!(chromeDef && chromeDef.chrome === 'light'));
    homeThemeStartTicker();
    homeThemeNotify();
  } else {
    if (homeThemeHost.visible && homeThemeHost.instance && homeThemeHost.instance.pause) homeThemeHost.instance.pause();
    homeThemeHost.visible = false;
    if (homeThemeHost.root) homeThemeHost.root.classList.remove('on');
    body.classList.remove('home-theme-on', 'hth-chrome-light');
    homeThemeStopTicker();
    // 切回原版时释放主题资源（WebGL 上下文等）
    if (homeThemeHost.current === 'classic' && homeThemeHost.instance) destroyHomeThemeInstance();
  }
  syncHomeThemeBackdrop();
  // QQ 退出 / 换号时清掉上一个账号的歌单数据（换号会自动重新加载）
  if (typeof homeThemeCheckQQAccount === 'function') homeThemeCheckQQAccount();
  if (homeShown && homeThemeLoggedIn('qq')) homeThemeLoadQQPool(false);
}

// ---------- 播放页背景：离开主页后，3D 舞台后面换成和主题呼应的背景 ----------
// 3D 粒子和动态效果不动，只在它们后面垫一层很克制的背景。用户自己设置了背景图、视频或壁纸时不覆盖。
var homeThemeBackdrop = { el: null, id: '' };
function syncHomeThemeBackdrop() {
  var id = homeThemeHost.current;
  var def = id !== 'classic' ? homeThemeDef(id) : null;
  var bd = def && def.backdrop;
  if (!bd && !homeThemeBackdrop.el) return;
  if (!homeThemeBackdrop.el) {
    homeThemeInjectStyle('host-backdrop', [
      '#hth-backdrop{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0;transition:opacity .9s ease;overflow:hidden;contain:strict}',
      '#hth-backdrop.on{opacity:1}',
      '#hth-backdrop.idle,#hth-backdrop.idle *{animation-play-state:paused!important}',
      'body.custom-background-video #hth-backdrop,body.wallpaper-engine-active #hth-backdrop,body.custom-window-transparent #hth-backdrop,body.desktop-wallpaper-mode #hth-backdrop,body.custom-background-override:not(.custom-background-flat) #hth-backdrop{display:none}',
    ].join('\n'));
    var el = document.createElement('div');
    el.id = 'hth-backdrop';
    el.setAttribute('aria-hidden', 'true');
    var shell = homeThemeShell();
    var before = document.getElementById('canvas-container');
    if (before && before.parentNode === shell) shell.insertBefore(el, before);
    else shell.insertBefore(el, shell.firstChild);
    homeThemeBackdrop.el = el;
  }
  var box = homeThemeBackdrop.el;
  if (homeThemeBackdrop.id !== (bd ? id : '')) {
    homeThemeBackdrop.id = bd ? id : '';
    box.className = bd ? 'hbd-' + id : '';
    box.innerHTML = bd ? (bd.html || '') : '';
    if (bd && bd.css) homeThemeInjectStyle('backdrop-' + id, bd.css);
    if (bd && typeof bd.build === 'function') { try { bd.build(box); } catch (e) { console.warn('[HomeTheme] backdrop', e); } }
  }
  box.classList.toggle('on', !!bd);
  // 主页盖住舞台、窗口不可见时，背景里的 CSS 动画暂停
  box.classList.toggle('idle', !!homeThemeHost.visible || document.hidden);
}

// 原版"点主页空白处就关掉主页"的全局捕获监听会把主题里的点击吞掉（结果点什么都跳到正在播放），这里让它忽略主题层
(function guardHomeThemeClicks() {
  if (typeof isHomeBlankDismissClick === 'function') {
    var originalBlankDismiss = isHomeBlankDismissClick;
    isHomeBlankDismissClick = function (e) {
      var t = e && e.target;
      if (t && t.closest && t.closest('#home-theme-root,#home-theme-cord')) return false;
      return originalBlankDismiss.apply(this, arguments);
    };
  }
  // 主页上：鼠标在左上角拉绳附近时不要触发左侧歌单面板；在主题层上只有贴着左边缘才触发（和原版主页一样）
  if (typeof playlistPanelEdgeTopGutter === 'function') {
    var originalTopGutter = playlistPanelEdgeTopGutter;
    playlistPanelEdgeTopGutter = function (H) {
      var g = originalTopGutter.apply(this, arguments);
      try { if (typeof emptyHomeActive !== 'undefined' && emptyHomeActive) g = Math.max(g, 186); } catch (_e) { }
      return g;
    };
  }
  if (typeof playlistPanelInitialEdgeTriggerX === 'function') {
    var originalEdgeX = playlistPanelInitialEdgeTriggerX;
    playlistPanelInitialEdgeTriggerX = function (defaultWidth, eventTarget) {
      var w = originalEdgeX.apply(this, arguments);
      if (homeThemeHost.visible && eventTarget && eventTarget.closest && eventTarget.closest('#home-theme-root,#home-theme-cord')) {
        var panel = document.getElementById('playlist-panel');
        var active = false;
        try { active = typeof isPlaylistPanelActiveState === 'function' && isPlaylistPanelActiveState(panel); } catch (_e) { }
        if (!active) w = Math.min(w, typeof PLAYLIST_PANEL_HOME_EDGE_TRIGGER_X === 'number' ? PLAYLIST_PANEL_HOME_EDGE_TRIGGER_X : 16);
      }
      return w;
    };
  }
  // 3D 场景的指针交互也把主题层当作 UI
  try {
    if (typeof UI_HIT_SELECTOR === 'string' && UI_HIT_SELECTOR.indexOf('#home-theme-root') < 0) UI_HIT_SELECTOR += ',#home-theme-root,#home-theme-cord';
  } catch (_e) { }
})();

function setHomeTheme(id, opts) {
  opts = opts || {};
  if (!homeThemeDef(id)) id = 'classic';
  // 有切换在路上时，和"将要切到的"比，而不是和还没换掉的 current 比
  var target = homeThemeHost.switchTimer ? homeThemeHost.pending : homeThemeHost.current;
  if (id === target && !opts.force) return;
  // 连续切换：上一次还没落地的直接作废，只保留最后一次
  if (homeThemeHost.switchTimer) { clearTimeout(homeThemeHost.switchTimer); homeThemeHost.switchTimer = 0; }
  homeThemeHost.pending = '';
  writeHomeThemePreference(id);
  var apply = function () {
    homeThemeHost.current = id;
    if (homeThemeHost.instanceId && homeThemeHost.instanceId !== id) destroyHomeThemeInstance();
    syncHomeThemeVisibility();
    renderHomeThemeSettingsSeg();
    homeThemeHost.lastSignature = '';
    syncHomeThemeVisibility();
  };
  var root = homeThemeHost.root;
  if (opts.animate && root && homeThemeHost.visible && !homeThemeReducedMotion()) {
    homeThemeHost.switching = true;
    homeThemeHost.pending = id;
    root.classList.add('switching');
    homeThemeHost.switchTimer = setTimeout(function () {
      homeThemeHost.switchTimer = 0;
      homeThemeHost.pending = '';
      apply();
      requestAnimationFrame(function () {
        if (homeThemeHost.switchTimer) return; // 又有新的切换开始了，淡出态留给它
        root.classList.remove('switching');
        homeThemeHost.switching = false;
      });
    }, 320);
  } else {
    if (root) root.classList.remove('switching');
    homeThemeHost.switching = false;
    apply();
  }
  var def = homeThemeDef(id);
  if (opts.toast && def && typeof showToast === 'function') showToast('主页主题：' + def.name);
}

function cycleHomeTheme() {
  var ids = homeThemeRegistry.map(function (t) { return t.id; });
  // 上一次拉绳的切换还没落地时，从它的目标往下数，免得两次拉绳算出同一个"下一套"
  var base = homeThemeHost.switchTimer && homeThemeHost.pending ? homeThemeHost.pending : homeThemeHost.current;
  var idx = ids.indexOf(base);
  setHomeTheme(ids[(idx + 1) % ids.length], { animate: true, toast: true });
}

// ---------- 拉绳 ----------
function createHomeThemeCord() {
  if (document.getElementById('home-theme-cord')) return;
  var wrap = document.createElement('div');
  wrap.id = 'home-theme-cord';
  wrap.innerHTML = '<svg viewBox="0 0 44 170" aria-hidden="true"><path class="cord-line" d=""/><circle class="cord-bead" r="4.2"/><circle class="cord-bead cord-bead-top" r="1.6" cx="10" cy="0"/></svg>' +
    '<div class="cord-hit" role="button" tabindex="0" aria-label="拉一下切换主页主题" title="拉一下切换主页主题"></div><div class="cord-tip">拉一下 · 换主题</div>';
  homeThemeShell().appendChild(wrap);
  var path = wrap.querySelector('.cord-line');
  var bead = wrap.querySelector('.cord-bead');
  var hit = wrap.querySelector('.cord-hit');
  var tip = wrap.querySelector('.cord-tip');
  var REST = 86, ANCHOR_X = 10;
  var state = { len: REST, vLen: 0, x: 0, vX: 0, dragging: false, startY: 0, startX: 0, grabLen: REST, fired: false, raf: 0, moved: false };

  function draw() {
    var endX = ANCHOR_X + state.x;
    var endY = state.len;
    var ctrlX = ANCHOR_X + state.x * 0.35;
    path.setAttribute('d', 'M' + ANCHOR_X + ',0 Q' + ctrlX.toFixed(2) + ',' + (endY * 0.55).toFixed(2) + ' ' + endX.toFixed(2) + ',' + endY.toFixed(2));
    bead.setAttribute('cx', endX.toFixed(2));
    bead.setAttribute('cy', (endY + 4).toFixed(2));
    hit.style.left = endX + 'px';
    hit.style.top = (endY + 4) + 'px';
    tip.style.top = (endY - 2) + 'px';
  }
  function step() {
    state.raf = 0;
    if (!state.dragging) {
      // 弹簧回弹（长度）+ 摆动（横向）
      state.vLen += (REST - state.len) * 0.16;
      state.vLen *= 0.78;
      state.len += state.vLen;
      state.vX += -state.x * 0.08;
      state.vX *= 0.93;
      state.x += state.vX;
    }
    draw();
    var moving = state.dragging || Math.abs(state.vLen) > 0.02 || Math.abs(state.len - REST) > 0.05 || Math.abs(state.vX) > 0.02 || Math.abs(state.x) > 0.05;
    if (moving) state.raf = requestAnimationFrame(step);
  }
  function kick() { if (!state.raf) state.raf = requestAnimationFrame(step); }
  function trigger() {
    if (state.fired) return;
    state.fired = true;
    cycleHomeTheme();
  }
  hit.addEventListener('pointerenter', function () { wrap.classList.add('hover'); });
  hit.addEventListener('pointerleave', function () { wrap.classList.remove('hover'); });
  hit.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    e.stopPropagation();
    hit.setPointerCapture(e.pointerId);
    state.dragging = true;
    state.fired = false;
    state.moved = false;
    state.startY = e.clientY;
    state.startX = e.clientX;
    state.grabLen = state.len;
    wrap.classList.add('pulling');
    kick();
  });
  hit.addEventListener('pointermove', function (e) {
    if (!state.dragging) return;
    var dy = e.clientY - state.startY;
    var dx = e.clientX - state.startX;
    if (Math.abs(dy) > 3 || Math.abs(dx) > 3) state.moved = true;
    // 往下拉有阻尼，往上推不动
    var pull = Math.max(0, dy);
    state.len = state.grabLen + pull * (1 - Math.min(0.55, pull / 260));
    state.x = Math.max(-18, Math.min(18, dx * 0.25));
    kick();
  });
  function release(e) {
    if (!state.dragging) return;
    state.dragging = false;
    wrap.classList.remove('pulling');
    var pulled = state.len - REST;
    if (pulled > 38) trigger();
    else if (!state.moved) {
      // 单击：自动拉一下
      state.vLen = 9;
      setTimeout(trigger, 140);
    }
    state.vX += (Math.random() - 0.5) * 2.4;
    kick();
    if (e && e.stopPropagation) e.stopPropagation();
  }
  hit.addEventListener('pointerup', release);
  hit.addEventListener('pointercancel', release);
  hit.addEventListener('click', function (e) { e.stopPropagation(); });
  hit.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      // 拦住冒泡，不然空格还会触发全局的"播放 / 暂停"
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      state.fired = false; state.vLen = 9; kick(); setTimeout(trigger, 140);
    }
  });
  draw();
}

// ---------- 设置面板 ----------
function renderHomeThemeSettingsSeg() {
  var seg = document.getElementById('home-theme-seg');
  if (!seg) {
    var anchor = document.getElementById('close-behavior-seg');
    if (!anchor || !anchor.parentNode) return;
    var label = document.createElement('div');
    label.className = 'fx-section-label';
    label.textContent = '主页主题';
    seg = document.createElement('div');
    seg.className = 'fx-seg';
    seg.id = 'home-theme-seg';
    seg.title = '主页的画风；主页左上角的拉绳也可以切换';
    var before = anchor.previousElementSibling && anchor.previousElementSibling.classList.contains('fx-section-label') ? anchor.previousElementSibling : anchor;
    anchor.parentNode.insertBefore(label, before);
    anchor.parentNode.insertBefore(seg, before);
    seg.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-home-theme]');
      if (btn) setHomeTheme(btn.getAttribute('data-home-theme'), { animate: true });
    });
  }
  seg.innerHTML = homeThemeRegistry.map(function (t) {
    return '<button type="button" data-home-theme="' + t.id + '" class="' + (t.id === homeThemeHost.current ? 'active' : '') + '">' + t.name + '</button>';
  }).join('');
}

function openHomeThemeSettings() {
  var fab = document.getElementById('fx-fab');
  if (fab) fab.click();
}

// ---------- 启动 ----------
(function bootHomeThemes() {
  function start() {
    ensureHomeThemeRoot();
    var saved = readHomeThemePreference();
    homeThemeHost.current = homeThemeDef(saved) ? saved : 'classic';
    renderHomeThemeSettingsSeg();
    syncHomeThemeBackdrop();
    new MutationObserver(function () { syncHomeThemeVisibility(); })
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', function () {
      if (!homeThemeHost.instance) return;
      if (document.hidden) { if (homeThemeHost.instance.pause) homeThemeHost.instance.pause(); }
      else if (homeThemeHost.visible && homeThemeHost.instance.resume) homeThemeHost.instance.resume();
    });
    document.addEventListener('visibilitychange', syncHomeThemeBackdrop);
    window.addEventListener('resize', function () {
      if (homeThemeHost.instance && homeThemeHost.instance.resize) homeThemeHost.instance.resize(window.innerWidth, window.innerHeight);
    });
    syncHomeThemeVisibility();
  }
  // 主题文件在本文件之后加载并注册，等它们都注册完再启动
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); });
  else setTimeout(start, 0);
})();
