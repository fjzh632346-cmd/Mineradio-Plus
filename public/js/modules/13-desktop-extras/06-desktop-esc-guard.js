;
// ============================================================
// [二改] 桌面模式下 Esc 的"让路"
// 桌面模式里主进程把 Esc 注册成全局快捷键（退出桌面模式）。可在输入框里按 Esc
// 往往只是想取消输入法候选、或者收起顶部搜索，结果整个桌面模式被退掉了。
// 这里在以下情况请主进程暂时不拦 Esc：
// - 焦点在输入框 / 文本框 / 可编辑区域里
// - 顶部搜索开着（html.dsearch-shown）
// 其余时候恢复拦截；离开桌面模式时一律恢复。
// 主进程接口：window.desktopWindow.setDesktopEscapeSuspended(bool)（浏览器里没有就什么都不做）
// ============================================================
(function () {
  var DEBOUNCE = 80;
  var st = { sent: null, timer: 0 }; // sent：上次告诉主进程的值（null = 还没发过，第一次一定发）

  function api() {
    var dw = window.desktopWindow;
    return dw && typeof dw.setDesktopEscapeSuspended === 'function' ? dw : null;
  }
  function inDesktopMode() {
    var b = document.body;
    if (b && b.classList.contains('desktop-wallpaper-mode')) return true;
    try {
      var s = typeof desktopWallpaperRuntimeState !== 'undefined' ? desktopWallpaperRuntimeState : null;
      return !!(s && (s.enabled === true || s.active === true));
    } catch (_) { return false; }
  }
  function isTextField(el) {
    if (!el || el === document.body) return false;
    if (el.isContentEditable) return true;
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'textarea') return !el.readOnly && !el.disabled;
    if (tag !== 'input') return false;
    var type = String(el.type || 'text').toLowerCase();
    if (/^(button|submit|reset|checkbox|radio|range|color|file|image|hidden)$/.test(type)) return false;
    return !el.readOnly && !el.disabled;
  }
  function wanted() {
    if (!inDesktopMode()) return false;
    // 窗口没焦点时键盘根本到不了这里，别让 Esc 失效
    try { if (!document.hasFocus()) return false; } catch (_) { }
    if (document.documentElement.classList.contains('dsearch-shown')) return true;
    return isTextField(document.activeElement);
  }
  function send(on) {
    if (on === st.sent) return;
    var dw = api();
    st.sent = on;
    if (!dw) return;
    try {
      Promise.resolve(dw.setDesktopEscapeSuspended(on)).catch(function () { });
    } catch (_) { }
  }
  function flush() {
    st.timer = 0;
    send(wanted());
  }
  function schedule() {
    // 离开桌面模式：立刻恢复，不等防抖
    if (!inDesktopMode()) {
      if (st.timer) { clearTimeout(st.timer); st.timer = 0; }
      send(false);
      return;
    }
    // 合并 80ms 内的多次变化（不重置计时，免得 class 频繁变化时一直发不出去）
    if (!st.timer) st.timer = setTimeout(flush, DEBOUNCE);
  }

  function init() {
    document.addEventListener('focusin', schedule, true);
    document.addEventListener('focusout', schedule, true);
    window.addEventListener('blur', schedule);
    window.addEventListener('focus', schedule);
    try {
      var mo = new MutationObserver(schedule);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (_) { setInterval(schedule, 500); }
    schedule();
  }

  window.__mineradioDesktopEscGuard = { state: st, refresh: schedule };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
