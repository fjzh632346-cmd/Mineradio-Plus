;
// ============================================================
// [二改] 右键单击 = 回退上一步
// 从最上层往下找，找到第一个"能退的东西"就退一步：
//   弹窗 → 小浮层 → 搜索结果 → 侧边面板 → 唱片架 → 主页主题里推近的页面
//   → 沉浸模式
// 播放页 3D 画面上的右键保持原版：打开 / 收起唱片架（沉浸模式下也一样）。
// 输入框、选中了文字时保留系统右键菜单；按住右键拖动（转视角）不算单击。
// 设置里可关：fx.rightClickBack === false。
// ============================================================
var rightClickBackState = { downX: 0, downY: 0, downAt: 0, down: false, lastAt: 0 };

function rcbVisible(id, cls) {
  var el = document.getElementById(id);
  return !!(el && el.classList.contains(cls || 'show'));
}
function rcbCall(name) {
  var fn = window[name];
  if (typeof fn !== 'function') return false;
  var args = Array.prototype.slice.call(arguments, 1);
  fn.apply(null, args);
  return true;
}

// 每一步：[说明, 条件, 动作]。动作返回 false 表示其实没退成，继续往下找。
var RIGHT_CLICK_BACK_STEPS = [
  ['桌面模式控制器', function () { return typeof desktopModeControlDockState !== 'undefined' && desktopModeControlDockState.open; },
    function () { setDesktopModeControlsOpen(false); }],
  ['快捷键设置', function () { return rcbVisible('hotkey-modal'); }, function () { return rcbCall('closeHotkeySettings'); }],
  ['壁纸详情', function () { return rcbVisible('wallpaper-engine-details-drawer'); }, function () { return rcbCall('closeWallpaperEngineProjectDetails'); }],
  ['本地节拍分析', function () { return rcbVisible('local-beat-modal'); }, function () {
    if (typeof localBeatAnalysis !== 'undefined' && localBeatAnalysis.active) return rcbCall('cancelLocalBeatAnalysis');
    return rcbCall('closeLocalBeatModal');
  }],
  ['自定义歌词', function () { return rcbVisible('custom-lyric-modal'); }, function () { return rcbCall('closeCustomLyricModal'); }],
  ['收藏到歌单', function () { return rcbVisible('collect-modal'); }, function () { return rcbCall('closeCollectModal'); }],
  ['封面裁剪', function () { return rcbVisible('cover-crop-modal'); }, function () { return rcbCall('closeCoverCropModal'); }],
  ['背景裁剪', function () { return rcbVisible('background-crop-modal'); }, function () { return rcbCall('closeCustomBackgroundCropModal', true); }],
  ['歌曲详情', function () { return rcbVisible('track-detail-modal'); }, function () { return rcbCall('closeTrackDetailModal'); }],
  ['壁纸库', function () { return rcbVisible('wallpaper-engine-modal'); }, function () { return rcbCall('closeWallpaperEngineLibrary'); }],
  ['音频输出', function () { return rcbVisible('audio-output-workflow-modal'); }, function () { return rcbCall('closeAudioOutputWorkflowPanel'); }],
  ['更新', function () { return rcbVisible('update-modal'); }, function () { return rcbCall('closeUpdatePanel'); }],
  ['账号', function () { return rcbVisible('user-modal'); }, function () { return rcbCall('closeUserModal'); }],
  ['登录', function () { return rcbVisible('login-modal'); }, function () { return rcbCall('closeLoginModal'); }],
  ['平台推荐', function () { return rcbVisible('home-platform-recommend-mask'); }, function () { return rcbCall('closeHomePlatformRecommendations'); }],
  ['新手引导', function () { return typeof visualGuideActive !== 'undefined' && visualGuideActive; }, function () { return rcbCall('closeVisualGuide', true); }],
  ['调色', function () { return rcbVisible('color-lab-pop'); }, function () { return rcbCall('closeColorLab'); }],
  ['封面取色', function () { return rcbVisible('cover-color-pop'); }, function () { return rcbCall('closeCoverColorPicker'); }],
  ['换源', function () { return typeof controlSourceSwitcherState !== 'undefined' && controlSourceSwitcherState.open; }, function () { return rcbCall('closeControlSourceSwitcher'); }],
  ['播放队列', function () { return typeof miniQueueOpen !== 'undefined' && miniQueueOpen; }, function () { return rcbCall('closeMiniQueue'); }],
  ['音量', function () { return rcbVisible('volume-control', 'open'); }, function () { return rcbCall('closeVolumePanel', true); }],
  ['上传', function () { return rcbVisible('upload-panel'); }, function () { return rcbCall('closeUploadPanel'); }],
  ['搜索结果', function () { return rcbVisible('search-results'); }, function () {
    var results = document.getElementById('search-results');
    if (results) results.classList.remove('show');
    var input = document.querySelector('#search-area input');
    if (input && document.activeElement === input) input.blur();
  }],
  ['视觉控制台', function () {
    var el = document.getElementById('fx-panel');
    return !!(el && (el.classList.contains('show') || el.classList.contains('peek')));
  }, function () { return rcbCall('toggleFxPanel', false); }],
  ['歌单面板', function () { return rcbVisible('playlist-panel'); }, function () { return rcbCall('togglePlaylistPanel', false); }],
  ['唱片架内容', function () {
    return typeof shelfManager !== 'undefined' && shelfManager && shelfManager.hasOpenContent && shelfManager.hasOpenContent();
  }, function () { return rcbCall('safeShelfCloseContent', 'right-click-back'); }],
  ['唱片架', function () { return typeof shelfPinnedOpen !== 'undefined' && shelfPinnedOpen; }, function () { return rcbCall('setShelfPinnedOpen', false, true); }],
  ['主页里推近的页面', function () {
    return typeof homeThemeHost !== 'undefined' && homeThemeHost.visible && homeThemeHost.instance
      && typeof homeThemeHost.instance.back === 'function';
  }, function () { return homeThemeHost.instance.back() === true; }],
  ['沉浸模式', function () { return typeof immersiveMode !== 'undefined' && immersiveMode; }, function () { return rcbCall('setImmersiveMode', false); }]
];
// 在 3D 画面上右键时，唱片架相关的事交还给原版逻辑（开/关唱片架、右键歌曲行=下一首播放）
var RIGHT_CLICK_BACK_STAGE_OWNED = { '唱片架内容': true, '唱片架': true, '沉浸模式': true };

// 播放页的 3D 画面：点在画布上，或者不在主页、鼠标下面也没有任何界面元素（主题背景层等不接鼠标的层也算画面）
function rightClickOnStage(e) {
  var t = e && e.target;
  if (t && typeof renderer !== 'undefined' && renderer && t === renderer.domElement) return true;
  if (typeof emptyHomeActive !== 'undefined' && emptyHomeActive) return false;
  if (typeof isPointerOverUi === 'function') {
    try { return !isPointerOverUi(e); } catch (_) { }
  }
  return false;
}

function runRightClickBack(e) {
  var onStage = rightClickOnStage(e);
  for (var i = 0; i < RIGHT_CLICK_BACK_STEPS.length; i++) {
    var step = RIGHT_CLICK_BACK_STEPS[i];
    if (onStage && RIGHT_CLICK_BACK_STAGE_OWNED[step[0]]) continue;
    var active = false;
    try { active = !!step[1](); } catch (_) { active = false; }
    if (!active) continue;
    var done;
    try { done = step[2](); } catch (e) { console.warn('[RightClickBack]', step[0], e); done = false; }
    if (done === false) continue;
    return step[0];
  }
  return '';
}

function rightClickBackKeepsNativeMenu(e) {
  var t = e.target;
  if (t && t.nodeType === 1) {
    if (t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-native-contextmenu]')) return true;
  }
  var sel = window.getSelection && window.getSelection();
  if (sel && !sel.isCollapsed && String(sel).trim()) return true;
  return false;
}

function showRightClickBackRipple(x, y) {
  if (typeof desktopWindowReducedMotion === 'function' && desktopWindowReducedMotion()) return;
  var dot = document.createElement('div');
  dot.className = 'rcb-ripple';
  dot.style.left = x + 'px';
  dot.style.top = y + 'px';
  document.body.appendChild(dot);
  setTimeout(function () { if (dot.parentNode) dot.parentNode.removeChild(dot); }, 520);
}

(function initRightClickBack() {
  var style = document.createElement('style');
  style.textContent = '.rcb-ripple{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;pointer-events:none;z-index:2147482000;' +
    'border:1.5px solid rgba(255,255,255,.7);box-shadow:0 0 14px rgba(255,255,255,.25);animation:rcb-ripple .5s cubic-bezier(.2,.7,.2,1) forwards}' +
    '@keyframes rcb-ripple{from{transform:scale(.35);opacity:.9}to{transform:scale(1.25);opacity:0}}';
  (document.head || document.documentElement).appendChild(style);

  window.addEventListener('pointerdown', function (e) {
    if (e.button !== 2) return;
    rightClickBackState.down = true;
    rightClickBackState.downX = e.clientX;
    rightClickBackState.downY = e.clientY;
    rightClickBackState.downAt = performance.now();
  }, true);

  window.addEventListener('contextmenu', function (e) {
    if (typeof fx !== 'undefined' && fx && fx.rightClickBack === false) return;
    if (rightClickBackKeepsNativeMenu(e)) return;
    var s = rightClickBackState;
    if (s.down) {
      s.down = false;
      var moved = Math.abs(e.clientX - s.downX) + Math.abs(e.clientY - s.downY);
      // 按住拖动 / 长按不算单击，交给原来的逻辑（比如转视角）
      if (moved > 8 || performance.now() - s.downAt > 650) return;
    }
    var now = performance.now();
    if (now - s.lastAt < 180) { e.preventDefault(); e.stopPropagation(); return; }
    var what = runRightClickBack(e);
    if (!what) return; // 没什么可退的：保留原来的右键行为
    s.lastAt = now;
    e.preventDefault();
    e.stopPropagation();
    showRightClickBackRipple(e.clientX, e.clientY);
  }, true);
})();
