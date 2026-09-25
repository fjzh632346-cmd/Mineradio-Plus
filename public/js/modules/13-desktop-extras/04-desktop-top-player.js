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
      M + ' .hth-riso-poster .rp-search,' + M + ' .hth-star-atlas .sa-search,' + M + ' .hth-fm-dial .fm-seek{visibility:hidden!important;pointer-events:none!important}'
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
  function scheduleHide(ms) {
    clearTimer('hideTimer');
    desktopTopPlayer.hideTimer = setTimeout(function () {
      desktopTopPlayer.hideTimer = 0;
      var bar = document.getElementById('bottom-bar');
      if (bar && (bar.matches(':hover') || bar.contains(document.activeElement))) return;
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
  function barBottom() { return bottomOf(document.getElementById('bottom-bar'), TOP_ZONE); }
  function searchBottom() {
    var b = bottomOf(searchEl(), TOP_ZONE);
    var results = document.getElementById('search-results');
    if (results && results.classList.contains('show')) b = Math.max(b, bottomOf(results, b));
    return b;
  }

  function sync() {
    var on = !!(document.body && document.body.classList.contains('desktop-wallpaper-mode'));
    root.classList.toggle('dbar-top', on);
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
      var y = e.clientY;
      if (!desktopTopPlayer.search) {
        if (y <= Math.max(TOP_ZONE, desktopTopPlayer.shown ? barBottom() : 0) && e.deltaY < 0) {
          clearTimer('hoverTimer');
          setSearch(true);
        }
        return;
      }
      // 搜索开着：在搜索框 / 结果上方往下滚就收起（结果列表自己滚动时不抢）
      if (e.deltaY > 0 && y <= bottomOf(searchEl(), TOP_ZONE) + 10) setSearch(false);
    }, { capture: true, passive: true });

    document.addEventListener('mousemove', function (e) {
      if (!inDesktopEdit()) { root.classList.remove('dbar-near'); clearTimer('hoverTimer'); return; }
      var y = e.clientY;
      var near = y <= TOP_ZONE;
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

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && desktopTopPlayer.search) { setSearch(false); }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
