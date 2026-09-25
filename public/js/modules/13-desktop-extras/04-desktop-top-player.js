;
// ============================================================
// [二改] 桌面背景模式下的播放器和搜索（都收在屏幕顶部）
// - 鼠标移到屏幕最上面：播放器滑下来；鼠标离开播放器一会儿就收回去。
// - 鼠标在最上面往上滚一下滚轮：换成搜索框（自动聚焦，可以直接打字）；
//   往下滚、按 Esc、或者鼠标走远且搜索框是空的，搜索就收回去。
// - 底部播放器（底下是任务栏）和各主题自带的播放区 / 搜索框在桌面背景时隐藏，
//   统一用顶部这一套。
// ============================================================
var desktopTopPlayer = { shown: false, search: false, hideTimer: 0, searchTimer: 0, hoverTimer: 0 };

(function () {
  var TOP_ZONE = 90;       // 最上面多高算"顶部"
  var HOVER_DELAY = 180;   // 鼠标在顶部停这么久才滑出播放器，免得路过就弹
  var LEAVE_GAP = 90;      // 鼠标离开播放器 / 搜索下沿多远开始计时收起
  var root = document.documentElement;

  function inDesktopEdit() {
    var b = document.body;
    return !!(b && b.classList.contains('desktop-wallpaper-mode')
      && b.classList.contains('desktop-wallpaper-interactive')
      && !b.classList.contains('desktop-software-locked'));
  }

  function injectStyle() {
    if (document.getElementById('dbar-style')) return;
    var M = 'body.desktop-wallpaper-mode';
    var bars = ['#bottom-bar', '#bottom-bar.stage-mode', '#bottom-bar.visible:not(.soft-hidden)'];
    function sel(prefix, suffix) {
      return bars.map(function (b) { return prefix + ' ' + M + (suffix || '') + ' ' + b; }).join(',');
    }
    var S = ['#search-area', '#search-area.peek', '#search-area.stage-mode.peek'];
    function ssel(prefix) {
      return S.map(function (x) { return prefix + ' ' + M + ' ' + x; }).join(',');
    }
    // 顶部播放器里的元素选择器（逗号分隔的每一项都加上前缀）
    function pf() {
      var parts = Array.prototype.join.call(arguments, '').split(',');
      return parts.map(function (x) { return 'html.dbar-top ' + M + ' #bottom-bar ' + x.trim(); }).join(',');
    }
    var css = [
      // ---- 播放器：顶部居中，默认收在屏幕上沿外 ----
      sel('html.dbar-top') + '{top:calc(var(--desktop-safe-top,0px) + 12px)!important;bottom:auto!important}',
      sel('html.dbar-top', '.desktop-wallpaper-interactive') + ',' +
      sel('html.dbar-top', '.desktop-wallpaper-interactive:not(.empty-home-active):not(.home-controls-locked)') +
      '{transform:translateX(-50%) translateY(calc(-100% - 36px)) scale(.97)!important;opacity:0!important;pointer-events:none!important;' +
      'transition:transform .42s cubic-bezier(.2,.8,.2,1),opacity .3s ease!important}',
      sel('html.dbar-top.dbar-shown', '.desktop-wallpaper-interactive') + ',' +
      sel('html.dbar-top.dbar-shown', '.desktop-wallpaper-interactive:not(.empty-home-active):not(.home-controls-locked)') +
      '{transform:translateX(-50%) translateY(0) scale(1)!important;opacity:.95!important;visibility:visible!important;pointer-events:auto!important}',
      'html.dbar-top ' + M + ' #bottom-handle{display:none!important}',
      // 浅色（纸面）主题上，给顶部播放器 / 搜索垫一层深色底，才看得清
      'html.dbar-shown ' + M + '.hth-chrome-light #bottom-bar{background:rgba(18,22,34,.78)!important;box-shadow:0 10px 30px rgba(0,0,0,.28)!important}',
      'html.dsearch-shown ' + M + ' #search-area #search-box{background:rgba(18,22,34,.72)!important;box-shadow:0 10px 30px rgba(0,0,0,.26)!important}',
      'html.dsearch-shown ' + M + ' #search-input,html.dsearch-shown ' + M + ' #search-icon{color:rgba(255,255,255,.92)!important}',
      'html.dsearch-shown ' + M + ' #search-input::placeholder{color:rgba(255,255,255,.55)!important}',

      // ---- 搜索：默认藏起来，滚轮唤出时从顶部滑下 ----
      ssel('html.dbar-top') + '{top:-96px!important;opacity:0!important;pointer-events:none!important;' +
      'transition:top .38s cubic-bezier(.2,.8,.2,1),opacity .25s ease!important}',
      ssel('html.dbar-top.dsearch-shown') + '{top:calc(var(--desktop-safe-top,0px) + 16px)!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important}',

      // ---- 顶部提示条 ----
      '#dbar-hint{position:fixed;left:50%;top:calc(var(--desktop-safe-top,0px) + 6px);width:74px;height:4px;margin-left:-37px;border-radius:4px;' +
      'background:rgba(255,255,255,.34);box-shadow:0 0 10px rgba(0,0,0,.25);z-index:7;pointer-events:none;opacity:0;transition:opacity .35s ease,transform .35s ease}',
      'html.dbar-top:not(.dbar-shown):not(.dsearch-shown) ' + M + '.desktop-wallpaper-interactive:not(.desktop-software-locked) #dbar-hint{opacity:.55}',
      'html.dbar-top.dbar-near:not(.dbar-shown):not(.dsearch-shown) ' + M + '.desktop-wallpaper-interactive #dbar-hint{opacity:1;transform:scaleX(1.35)}',

      // ---- 主题自带的底部播放区、搜索框：桌面背景时隐藏，统一用顶部这套 ----
      M + ' .hth-riso-poster .rp-s2 .np,' + M + ' .hth-riso-poster .rp-s2 .tp,' + M + ' .hth-riso-poster .rp-s2 .ruler,' + M + ' .hth-riso-poster .rp-s2 .times{visibility:hidden!important;pointer-events:none!important}',
      M + ' .hth-riso-poster .rp-search,' + M + ' .hth-star-atlas .sa-search,' + M + ' .hth-fm-dial .fm-seek{visibility:hidden!important;pointer-events:none!important}',

      // ---- 播放器在顶部时，音量 / 歌词校时 / 音质 / 迷你队列这些弹层改成往下开，不然开到屏幕外 ----
      pf('.volume-popover,', '.lyric-timing-popover,', '.quality-popover') + '{top:46px!important;bottom:auto!important;transform-origin:50% 0}',
      pf('.control-quality-chip .quality-popover') + '{top:24px!important}',
      pf('.volume-popover,', '.lyric-timing-popover,', '.quality-popover') + '{transform:translateX(-50%) translateY(-8px)}',
      pf('.volume-control.open .volume-popover,', '.volume-control:hover .volume-popover,', '.volume-control:focus-within .volume-popover,',
        '.quality-control.open .quality-popover,', '.quality-control:hover .quality-popover,', '.quality-control:focus-within .quality-popover,',
        '.lyric-timing-control:hover .lyric-timing-popover,', '.lyric-timing-control:focus-within .lyric-timing-popover') + '{transform:translateX(-50%) translateY(0)}',
      pf('.volume-control.sibling-suppressed .volume-popover,', '.volume-control.handoff-closing .volume-popover,', '.lyric-timing-control.closing .lyric-timing-popover') +
      ',html.dbar-top ' + M + ' #bottom-bar.soft-hidden .lyric-timing-popover{transform:translateX(-50%) translateY(-8px) scale(.98)!important}',
      // 鼠标从按钮移到弹层的"桥"也跟着翻到下面
      pf('.volume-control::before,', '.quality-control::before,', '.lyric-timing-control::before') + '{bottom:auto!important;top:18px!important}',
      pf('.mini-queue-popover') + '{top:calc(100% + 14px)!important;bottom:auto!important;transform:translateX(-50%) translateY(-12px) scale(.98);transform-origin:50% 0}',
      pf('.mini-queue-popover.show') + '{transform:translateX(-50%) translateY(0) scale(1)}',
      '@media (max-width:720px){' + pf('.volume-popover,', '.quality-popover') + '{top:42px!important}}',
      // 换音源面板（fixed 定位，原版按"开在按钮上方"算）：翻到播放器下面，位置由下面的脚本给
      'html.dbar-top #control-source-switcher.dbar-flip{top:var(--dbar-sw-top,72px)!important;bottom:auto!important}'
    ].join('\n');
    var el = document.createElement('style');
    el.id = 'dbar-style';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function ensureHint() {
    if (document.getElementById('dbar-hint')) return;
    var h = document.createElement('div');
    h.id = 'dbar-hint';
    h.setAttribute('aria-hidden', 'true');
    document.body.appendChild(h);
  }

  function clearTimer(key) {
    if (desktopTopPlayer[key]) { clearTimeout(desktopTopPlayer[key]); desktopTopPlayer[key] = 0; }
  }
  function shieldChanged() {
    if (typeof scheduleDesktopIconShieldReport === 'function') scheduleDesktopIconShieldReport(false);
  }

  // ---------- 播放器 ----------
  function setShown(on) {
    on = !!on && inDesktopEdit();
    clearTimer('hideTimer');
    if (desktopTopPlayer.shown === on) return;
    desktopTopPlayer.shown = on;
    root.classList.toggle('dbar-shown', on);
    if (on && typeof ensureDesktopWallpaperFunctionalUi === 'function') {
      try { ensureDesktopWallpaperFunctionalUi('top-player'); } catch (_) { }
    }
    shieldChanged();
  }
  // 播放器上的弹层（音量 / 音质 / 迷你队列 / 换音源）开着时不收
  function popoverOpen() {
    return !!document.querySelector('#bottom-bar .volume-control.open,#bottom-bar .quality-control.open,#mini-queue-popover.show,#control-source-switcher.show');
  }
  function scheduleHide(ms) {
    clearTimer('hideTimer');
    desktopTopPlayer.hideTimer = setTimeout(function () {
      desktopTopPlayer.hideTimer = 0;
      var bar = document.getElementById('bottom-bar');
      if (bar && (bar.matches(':hover') || bar.contains(document.activeElement))) return;
      if (popoverOpen()) return;
      setShown(false);
    }, ms || 1200);
  }

  // ---------- 搜索 ----------
  function searchEl() { return document.getElementById('search-area'); }
  function searchInput() { return document.getElementById('search-input'); }
  function setSearch(on) {
    on = !!on && inDesktopEdit();
    clearTimer('searchTimer');
    if (desktopTopPlayer.search === on) return;
    desktopTopPlayer.search = on;
    root.classList.toggle('dsearch-shown', on);
    var el = searchEl();
    if (on) {
      setShown(false);
      // 让原版把搜索框的玻璃质感准备好（它原本是鼠标移到顶部时才准备）
      if (el && typeof setPeek === 'function') { try { setPeek(el, true, 'search'); } catch (_) { } }
      setTimeout(function () {
        var input = searchInput();
        if (input && desktopTopPlayer.search) {
          if (typeof requestDesktopKeyboardFocus === 'function') requestDesktopKeyboardFocus('top-search');
          try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
        }
      }, 60);
    } else {
      var input = searchInput();
      if (input && document.activeElement === input) input.blur();
      var results = document.getElementById('search-results');
      if (results) results.classList.remove('show');
    }
    shieldChanged();
  }
  function searchBusy() {
    var input = searchInput();
    var el = searchEl();
    return !!((input && (document.activeElement === input) && input.value.trim())
      || (el && el.matches(':hover')));
  }
  function scheduleSearchHide(ms) {
    clearTimer('searchTimer');
    desktopTopPlayer.searchTimer = setTimeout(function () {
      desktopTopPlayer.searchTimer = 0;
      if (searchBusy()) return;
      setSearch(false);
    }, ms || 1500);
  }

  function bottomOf(el, fallback) {
    if (!el) return fallback;
    var r = el.getBoundingClientRect();
    return Math.max(fallback, r.bottom);
  }
  // 顶部有任务栏时，"顶部"热区整体往下挪（--desktop-safe-top 由桌面模式按工作区写在 <html> 上）
  var safeTopCache = { v: 0, at: 0 };
  function safeTop() {
    var now = Date.now();
    if (now - safeTopCache.at > 500) {
      var v = 0;
      try { v = parseFloat(getComputedStyle(root).getPropertyValue('--desktop-safe-top')) || 0; } catch (_) { }
      safeTopCache.v = v > 0 ? v : 0; safeTopCache.at = now;
    }
    return safeTopCache.v;
  }
  function topZone() { return TOP_ZONE + safeTop(); }
  function barBottom() { return bottomOf(document.getElementById('bottom-bar'), topZone()); }
  function searchBottom() {
    var b = bottomOf(searchEl(), topZone());
    var results = document.getElementById('search-results');
    if (results && results.classList.contains('show')) b = Math.max(b, bottomOf(results, b));
    return b;
  }

  function sync() {
    var on = !!(document.body && document.body.classList.contains('desktop-wallpaper-mode'));
    root.classList.toggle('dbar-top', on);
    safeTopCache.at = 0;
    if (!on || document.getElementById('control-source-switcher')) placeSourceSwitcher();
    if (!inDesktopEdit()) {
      if (desktopTopPlayer.shown) setShown(false);
      if (desktopTopPlayer.search) setSearch(false);
      clearTimer('hoverTimer');
    }
  }

  function init() {
    injectStyle();
    ensureHint();
    sync();
    try {
      new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (_) { setInterval(sync, 400); }

    window.addEventListener('wheel', function (e) {
      if (!inDesktopEdit()) return;
      // 播放器自己（音量等）和弹层上的滚轮留给它们自己用
      var t = e.target;
      if (t && t.closest && t.closest('#bottom-bar,#control-source-switcher,.volume-popover,.quality-popover,.lyric-timing-popover,.mini-queue-popover')) return;
      var y = e.clientY;
      if (!desktopTopPlayer.search) {
        if (y <= Math.max(topZone(), desktopTopPlayer.shown ? barBottom() : 0) && e.deltaY < 0) {
          clearTimer('hoverTimer');
          setSearch(true);
        }
        return;
      }
      // 搜索开着：在搜索框 / 结果上方往下滚就收起（结果列表自己滚动时不抢）
      if (e.deltaY > 0 && y <= bottomOf(searchEl(), topZone()) + 10) setSearch(false);
    }, { capture: true, passive: true });

    document.addEventListener('mousemove', function (e) {
      if (!inDesktopEdit()) { root.classList.remove('dbar-near'); clearTimer('hoverTimer'); return; }
      var y = e.clientY;
      var near = y <= topZone();
      root.classList.toggle('dbar-near', near);

      if (desktopTopPlayer.search) {
        if (y > searchBottom() + LEAVE_GAP) { if (!desktopTopPlayer.searchTimer) scheduleSearchHide(1500); }
        else clearTimer('searchTimer');
        return;
      }

      if (!desktopTopPlayer.shown) {
        if (near) {
          if (!desktopTopPlayer.hoverTimer) {
            desktopTopPlayer.hoverTimer = setTimeout(function () {
              desktopTopPlayer.hoverTimer = 0;
              if (!desktopTopPlayer.search) setShown(true);
            }, HOVER_DELAY);
          }
        } else clearTimer('hoverTimer');
        return;
      }
      if (y > barBottom() + LEAVE_GAP) { if (!desktopTopPlayer.hideTimer) scheduleHide(1200); }
      else clearTimer('hideTimer');
    }, { passive: true });

    // 鼠标直接离开窗口（去了别的屏幕 / 任务栏 / 桌面图标）：取消待弹出，按规则收起
    function leftWindow() {
      root.classList.remove('dbar-near');
      clearTimer('hoverTimer');
      if (!inDesktopEdit()) return;
      if (desktopTopPlayer.search) { if (!desktopTopPlayer.searchTimer) scheduleSearchHide(1500); }
      else if (desktopTopPlayer.shown && !desktopTopPlayer.hideTimer) scheduleHide(1200);
    }
    document.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget && !e.toElement) leftWindow();
    }, { passive: true });
    window.addEventListener('blur', leftWindow);

    // 顶部搜索里按 Esc：有字先清空，没字才收起（输入法选字时的 Esc 不管）
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !desktopTopPlayer.search) return;
      if (e.isComposing || e.keyCode === 229) return;
      var input = searchInput();
      if (input && document.activeElement === input && input.value) {
        input.value = '';
        try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) { }
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      setSearch(false);
    }, true);

    watchSourceSwitcher();
  }

  // ---------- 换音源面板：播放器在顶部时翻到播放器下面 ----------
  function placeSourceSwitcher() {
    var el = document.getElementById('control-source-switcher');
    if (!el) return;
    var flip = false, top = 0;
    if (root.classList.contains('dbar-top') && el.classList.contains('show')) {
      var anchor = null;
      try { anchor = typeof controlSourceSwitcherState !== 'undefined' && controlSourceSwitcherState ? controlSourceSwitcherState.anchor : null; } catch (_) { }
      var ref = anchor && anchor.getBoundingClientRect ? anchor : document.getElementById('bottom-bar');
      var r = ref ? ref.getBoundingClientRect() : null;
      // 按按钮在屏幕上半截判断，而不是看面板有没有出界（翻过去以后就不出界了，会来回跳）
      if (r && r.height && r.top < window.innerHeight / 2) { flip = true; top = Math.round(r.bottom + 10); }
    }
    if (flip) {
      var v = top + 'px';
      if (el.style.getPropertyValue('--dbar-sw-top') !== v) el.style.setProperty('--dbar-sw-top', v);
      if (!el.classList.contains('dbar-flip')) el.classList.add('dbar-flip');
    } else if (el.classList.contains('dbar-flip')) {
      el.classList.remove('dbar-flip');
    }
  }
  function watchSourceSwitcher() {
    var mo = null;
    function attach(el) {
      try {
        mo = new MutationObserver(placeSourceSwitcher);
        mo.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
      } catch (_) { }
      placeSourceSwitcher();
    }
    var el = document.getElementById('control-source-switcher');
    if (el) { attach(el); return; }
    // 面板是第一次点开时才建的，等它出现
    try {
      var wait = new MutationObserver(function () {
        var found = document.getElementById('control-source-switcher');
        if (!found) return;
        wait.disconnect();
        attach(found);
      });
      wait.observe(document.body, { childList: true });
    } catch (_) { }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
