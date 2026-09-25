;
// ============================================================
// [二改] 完整桌面模式 · 编辑态自动藏桌面图标
// - 编辑（能操作 Mineradio）：自动隐藏 Windows 桌面图标，按钮不再被图标压住
// - 背景（右上角锁定 / 最小化成纯背景 / 退出）：图标自动回来
// 手动点了右上角的「显示/隐藏图标」，在切换到下一个状态之前都以手动为准。
// ============================================================
var desktopIconAuto = {
  mode: '',          // 'edit' | 'background' | ''
  manual: false,
  retryTimer: 0
};

function desktopIconAutoNoteManual() {
  desktopIconAuto.manual = true;
}

function desktopIconAutoApply(wantVisible, attempt) {
  if (desktopIconAuto.retryTimer) { clearTimeout(desktopIconAuto.retryTimer); desktopIconAuto.retryTimer = 0; }
  if (desktopIconAuto.manual) return;
  var status = desktopWallpaperRuntimeState || {};
  if (desktopIconsAreVisible(status) === wantVisible) return;
  if (desktopIconVisibilityPending) {
    if ((attempt || 0) < 6) {
      desktopIconAuto.retryTimer = setTimeout(function () { desktopIconAutoApply(wantVisible, (attempt || 0) + 1); }, 260);
    }
    return;
  }
  setDesktopIconsVisibility(wantVisible, null, { quiet: true });
}

function desktopIconAutoOnStatus(status, enabled, interactive) {
  status = status || {};
  if (!enabled || !interactive) {
    // 纯背景 / 退出时，原生层会把图标还原成进入前的样子，这里只清状态
    desktopIconAuto.mode = '';
    desktopIconAuto.manual = false;
    return;
  }
  var mode = status.softwareInteractionLocked === true ? 'background' : 'edit';
  if (mode === desktopIconAuto.mode) return;
  desktopIconAuto.mode = mode;
  desktopIconAuto.manual = false;
  if (fx && fx.desktopIconsAutoHide === false) return;
  // 等右上角控制器和状态都稳定一下再动图标
  setTimeout(function () { desktopIconAutoApply(mode !== 'edit', 0); }, 120);
}
