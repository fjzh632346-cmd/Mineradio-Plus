;
// ============================================================
// [二改] 桌面背景时限制帧率，省显卡、减卡顿
// 全屏的主题（孔版的网点着色器、星图的银河）每帧都要重算整屏；当它只是桌面背景、
// 没人在操作时，没必要跑满刷新率。
//   - 锁定软件操作（纯背景）：24 帧
//   - 桌面背景里但 3 秒没动鼠标/键盘：30 帧
//   - 正在操作、拼图过场、普通窗口：不限制
// 做法：接管 requestAnimationFrame，把所有动画回调攒到同一拍里按目标帧率统一放行，
// 画面仍然跟显示器同步，只是跳过一部分刷新。
// ============================================================
(function () {
  var nativeRAF = window.requestAnimationFrame.bind(window);
  var nativeCAF = window.cancelAnimationFrame.bind(window);
  var pending = new Map();
  var seq = 0x40000000;
  var pumping = false;
  var lastFlush = 0;
  var lastInput = performance.now();
  var IDLE_MS = 3000;

  function capFps() {
    var b = document.body;
    if (!b || !b.classList.contains('desktop-wallpaper-mode')) return 0;
    if (b.classList.contains('dpz-masking') || document.getElementById('dpz-overlay')) return 0;
    if (typeof fx !== 'undefined' && fx && fx.desktopFpsCap === false) return 0;
    if (b.classList.contains('desktop-software-locked')) return 24;
    if (performance.now() - lastInput < IDLE_MS) return 0;
    return 30;
  }

  function pump() {
    nativeRAF(function (t) {
      var fps = capFps();
      var interval = fps ? 1000 / fps : 0;
      if (interval && t - lastFlush < interval - 3) { pump(); return; }
      lastFlush = t;
      var list = pending;
      pending = new Map();
      pumping = false;
      list.forEach(function (cb) {
        try { cb(t); } catch (e) { setTimeout(function () { throw e; }, 0); }
      });
      if (pending.size && !pumping) { pumping = true; pump(); }
    });
  }

  window.requestAnimationFrame = function (cb) {
    if (!capFps() && !pending.size) return nativeRAF(cb);
    var id = ++seq;
    pending.set(id, cb);
    if (!pumping) { pumping = true; pump(); }
    return id;
  };
  window.cancelAnimationFrame = function (id) {
    if (pending.has(id)) { pending.delete(id); return; }
    nativeCAF(id);
  };

  function markInput() { lastInput = performance.now(); }
  ['pointermove', 'pointerdown', 'wheel', 'keydown'].forEach(function (type) {
    window.addEventListener(type, markInput, { capture: true, passive: true });
  });
})();
