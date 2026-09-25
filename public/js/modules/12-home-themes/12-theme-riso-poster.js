// ============================================================
// Home theme · 孔版海报 (riso-poster)
// 三色孔版印刷海报：巨型堆叠歌名（蓝版）、当日数字叠印（黄版）、
// 当前封面的三色网点分色（粉 / 蓝 / 黄），右侧节目单 / 票根 / 印章式播放键。
// 渲染：WebGL 三遍（静态版面 → 小尺寸画面 → 网点合成），DOM 叠在上面做正片叠底。
// ============================================================
(function () {
  'use strict';

  var ID = 'riso-poster';
  var W0 = 1600, H0 = 900;
  var HEI = '"Microsoft YaHei UI","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  var DISP = 'Impact,"Haettenschweiler","Arial Narrow","DejaVu Sans Condensed",sans-serif';
  // 封面区域（设计坐标）：左上 x,y → 右下 x,y
  var CR = [318, 70, 1030, 652];
  var KO = [956, 588, 86]; // 贴纸处蓝、粉版镂空
  var SW = 300, SH = 245;  // 画面 pass 的分辨率（与封面区域同比例）

  var PAL = [
    { name: 'FLUO PINK / FEDERAL BLUE / YELLOW', a: '#ff3d9a', b: '#2a4c9c', c: '#ffd92e', p: '#f1eadb' },
    { name: 'ORANGE / TEAL / SUNFLOWER', a: '#ff6a2b', b: '#0d6f7a', c: '#ffc93a', p: '#efe8d6' },
    { name: 'BRIGHT RED / BLUE / FLUO YELLOW', a: '#f2413c', b: '#1f3f95', c: '#f6ee3a', p: '#f3eee2' },
    { name: 'VIOLET / MINT / FLUO PINK', a: '#ff4fae', b: '#5a3e9b', c: '#79e0b8', p: '#eeeae4' },
    { name: 'GREEN / FLUO PINK / YELLOW', a: '#ff4a9c', b: '#00804a', c: '#ffe23a', p: '#f0ead8' },
    { name: 'MEDIUM BLUE / FLUO ORANGE / KRAFT', a: '#ff6d2e', b: '#1e5fb4', c: '#f7c948', p: '#e6d8bd' },
  ];

  var CJK_RE = /[⺀-鿿豈-﫿＀-￯　-〿가-힯]/;
  var NO_START = '，。、；：？！）」』】〉》”’,.;:?!)]}…～%';
  var NO_END = '（「『【〈《“‘([{';
  var TRAIL = /[，、。；：,;:·\s]+$/;
  var WD_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var WD_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var MON_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var CN_NUM = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  function fmt(s) {
    s = Math.max(0, Math.floor(Number(s) || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, '0');
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + x : m + ':' + x;
  }
  function cnNum(n) {
    n = Number(n) || 0;
    if (n <= 10) return CN_NUM[n];
    if (n < 20) return '十' + CN_NUM[n % 10];
    return CN_NUM[Math.floor(n / 10)] + '十' + (n % 10 ? CN_NUM[n % 10] : '');
  }
  function sessionName(time) {
    var h = parseInt(String(time || '0').split(':')[0], 10) || 0;
    if (h < 5) return '深夜场';
    if (h < 9) return '清晨场';
    if (h < 12) return '上午场';
    if (h < 17) return '午后场';
    if (h < 19) return '傍晚场';
    if (h < 23) return '夜场';
    return '深夜场';
  }
  function hashStr(s) {
    var h = 2166136261;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967296;
  }
  function hex(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ---------- 标题拆分：主标题 + 括号 / 破折号后的副标题 ----------
  function splitTitle(title) {
    title = String(title || '').replace(/\s+/g, ' ').trim();
    var m = title.match(/^(.+?)\s*[（(【\[「]([^）)】\]」]+)[）)】\]」]?\s*$/);
    if (m && m[1].trim()) return { main: m[1].trim(), sub: m[2].trim() };
    m = title.match(/^(.+?)\s+((?:feat\.?|ft\.?|featuring)\s+.+)$/i);
    if (m && m[1].trim()) return { main: m[1].trim(), sub: m[2].trim() };
    m = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    if (m && m[1].trim()) return { main: m[1].trim(), sub: m[2].trim() };
    return { main: title || '—', sub: '' };
  }

  // 拆成不可再分的单位：每个汉字一个单位，拉丁单词整体一个单位；避头尾标点粘到相邻单位上
  // 中文词边界（Electron/Chromium 自带 Intl.Segmenter）：断行时尽量不拆开一个词
  var wordSeg = null;
  try { if (typeof Intl !== 'undefined' && Intl.Segmenter) wordSeg = new Intl.Segmenter('zh', { granularity: 'word' }); } catch (_e) { wordSeg = null; }
  function wordStarts(s) {
    var set = Object.create(null);
    if (!wordSeg) return null;
    try { for (var it = wordSeg.segment(s)[Symbol.iterator](), r = it.next(); !r.done; r = it.next()) set[r.value.index] = 1; } catch (_e) { return null; }
    return set;
  }
  function tokenize(s) {
    var starts = wordStarts(s);
    var raw = [], buf = '', bufAt = 0, sp = false, idx = 0;
    function flush() { if (buf) { raw.push({ t: buf, sp: sp, ws: !starts || !!starts[bufAt] || sp }); sp = false; buf = ''; } }
    Array.from(s).forEach(function (ch) {
      var at = idx; idx += ch.length;
      if (/\s/.test(ch)) { flush(); if (raw.length) sp = true; return; }
      if (CJK_RE.test(ch)) { flush(); raw.push({ t: ch, sp: sp, ws: !starts || !!starts[at] || sp }); sp = false; return; }
      if (!buf) bufAt = at;
      buf += ch;
    });
    flush();
    var out = [];
    raw.forEach(function (u) {
      var prev = out[out.length - 1];
      if (prev && (NO_START.indexOf(u.t[0]) >= 0 || NO_END.indexOf(prev.t[prev.t.length - 1]) >= 0)) {
        prev.t += (u.sp ? ' ' : '') + u.t;
        return;
      }
      out.push({ t: u.t, sp: u.sp, ws: u.ws });
    });
    return out;
  }

  // ---------- 巨型标题排版 ----------
  // 在左侧版块里把标题排成 2~4 行，每行尽量撑满本区域宽度；
  // 上半部分的行可以压到封面网点上（叠印），下半部分的行要让开播放控件。
  // 只允许底边轻微出血（不超过笔画粗细的一小部分），左边永不裁切。
  var T_X0 = 18, T_UP_R = 752, T_LOW_R = 580, T_LOWER_Y = 668, T_TILT = 0.03, T_GAP = 0.07, T_RATIO = 1.45, T_SMAX = 400, T_NIB = 0.022;
  var measureCtx = document.createElement('canvas').getContext('2d');
  // Impact 只有常规体；没有 Impact 的系统上改用粗体的窄体兜底，避免细字
  var impactKnown = null;
  function hasImpact() {
    if (impactKnown !== null) return impactKnown;
    var probe = 'Hamburgefontsiv 0123';
    measureCtx.font = '40px monospace'; var a = measureCtx.measureText(probe).width;
    measureCtx.font = '40px Impact, monospace'; var b = measureCtx.measureText(probe).width;
    impactKnown = Math.abs(a - b) > 1;
    return impactKnown;
  }

  function layoutTitle(title, top) {
    var parts = splitTitle(title);
    var main = parts.main;
    var latin = !CJK_RE.test(main);
    var font = latin
      ? (hasImpact() ? function (s) { return '400 ' + s + 'px ' + DISP; } : function (s) { return '700 ' + s + 'px ' + DISP; })
      : function (s) { return '900 ' + s + 'px ' + HEI; };
    var sx = latin ? 0.94 : 1;
    var units = tokenize(main);
    if (units.length > 34) { units = units.slice(0, 33); units[32].t += '…'; }
    var mc = measureCtx;
    mc.font = font(100);
    var spW = mc.measureText(' ').width / 100;
    var U = units.map(function (u) {
      var mt = mc.measureText(u.t);
      var tr = u.t.replace(TRAIL, '');
      return {
        t: u.t, sp: u.sp, ws: u.ws !== false, w: mt.width / 100, we: (tr ? mc.measureText(tr).width : 0) / 100,
        a: (mt.actualBoundingBoxAscent || 80) / 100, d: (mt.actualBoundingBoxDescent || 10) / 100,
      };
    });
    var N = U.length;
    function lineInfo(i, j) {
      var w = 0, a = 0, d = 0;
      for (var k = i; k < j; k++) {
        w += (k === j - 1 ? U[k].we : U[k].w) + (k > i && U[k].sp ? spW : 0);
        a = Math.max(a, U[k].a); d = Math.max(d, U[k].d);
      }
      // 一个超长的拉丁单词独占一行时允许横向压窄（不拆词）
      var lsx = latin && j - i === 1 && U[i].t.length > 10 ? 0.7 : sx;
      var inner = 0;
      for (k = i; k < j - 1; k++) if (/[，、。；：,;:]$/.test(U[k].t)) inner++;
      return { i: i, j: j, w: Math.max(w, 0.2), a: a || 0.8, d: d || 0.1, sx: lsx, inner: inner };
    }
    function evaluate(lines) {
      var n = lines.length, zone = [], s = [], tops = [], bots = [], k, it;
      for (k = 0; k < n; k++) zone[k] = 0;
      for (it = 0; it < 4; it++) {
        for (k = 0; k < n; k++) {
          var yMid = it ? (tops[k] + bots[k]) / 2 : 0;
          var lim = (zone[k] ? T_LOW_R : T_UP_R) - T_X0 - T_TILT * yMid;
          s[k] = Math.min(T_SMAX, lim / (lines[k].w * lines[k].sx));
        }
        var mn = Math.min.apply(null, s);
        for (k = 0; k < n; k++) s[k] = Math.min(s[k], mn * T_RATIO);
        var H = 0;
        for (k = 0; k < n; k++) H += (lines[k].a + lines[k].d) * s[k] + (k < n - 1 ? T_GAP * s[k] : 0);
        var avail = H0 - top + T_NIB * s[n - 1];
        var f = Math.min(1, avail / H), y = 0;
        for (k = 0; k < n; k++) {
          s[k] *= f; tops[k] = y; bots[k] = y + (lines[k].a + lines[k].d) * s[k]; y = bots[k] + T_GAP * s[k];
        }
        var changed = false;
        for (k = 0; k < n; k++) if (!zone[k] && top + bots[k] > T_LOWER_Y) { zone[k] = 1; changed = true; }
        if (!changed && it > 0) break;
      }
      var min = Math.min.apply(null, s), avg = s.reduce(function (x, v) { return x + v; }, 0) / n;
      // 行数越接近 3 越像原稿；单字成行在长标题里扣分
      var orphan = 0;
      for (k = 0; k < n; k++) if (lines[k].j - lines[k].i === 1 && N > n + 2) orphan += 0.08;
      var wMin = Infinity, wMax = 0, punct = 0, midWord = 0;
      for (k = 0; k < n; k++) {
        wMin = Math.min(wMin, lines[k].w); wMax = Math.max(wMax, lines[k].w);
        if (k < n - 1 && TRAIL.test(U[lines[k].j - 1].t)) punct += 0.15;
        punct -= 0.06 * lines[k].inner; // 在逗号处断行更自然
        if (k > 0 && !U[lines[k].i].ws) midWord++;                         // 把一个词拆到两行，扣分
      }
      var bal = 1 - 0.3 * (1 - wMin / wMax);
      var fill = Math.min(1, bots[n - 1] / (H0 - top));                    // 竖向填满左侧版块
      bal *= 0.6 + 0.4 * fill;
      return { score: min * (1 - orphan) * bal * (1 + punct) * Math.pow(0.86, midWord) + 0.03 * avg - (n === 4 ? 2 : 0), s: s, tops: tops, bots: bots, zone: zone };
    }
    var best = null, nMin = N === 1 ? 1 : 2, nMax = Math.min(4, N);
    function rec(start, left, acc) {
      if (left === 1) {
        var lines = acc.concat([lineInfo(start, N)]);
        var r = evaluate(lines);
        if (!best || r.score > best.score) { best = r; best.lines = lines; }
        return;
      }
      for (var b = start + 1; b <= N - left + 1; b++) rec(b, left - 1, acc.concat([lineInfo(start, b)]));
    }
    for (var n = nMin; n <= nMax; n++) rec(0, n, []);

    // 行宽已经顶满时会剩下竖向空间：整体往下挪（底边对齐出血），但不把上半区的行挪进播放控件那一带
    var nL = best.lines.length, lastBot = best.bots[nL - 1];
    var shift = Math.max(0, H0 - top + T_NIB * best.s[nL - 1] - lastBot);
    for (var z = 0; z < nL; z++) if (!best.zone[z]) shift = Math.min(shift, Math.max(0, T_LOWER_Y - top - best.bots[z]));
    for (z = 0; z < nL; z++) { best.tops[z] += shift; best.bots[z] += shift; }
    var out = [];
    best.lines.forEach(function (ln, k) {
      var txt = '';
      for (var q = ln.i; q < ln.j; q++) txt += (q > ln.i && U[q].sp ? ' ' : '') + U[q].t;
      txt = txt.replace(TRAIL, '') || txt;
      var size = best.s[k];
      mc.font = font(size);
      var mt = mc.measureText(txt);
      var inkL = mt.actualBoundingBoxLeft || 0, inkW = (mt.actualBoundingBoxLeft || 0) + (mt.actualBoundingBoxRight || mt.width);
      var yMid = (best.tops[k] + best.bots[k]) / 2;
      var lim = (best.zone[k] ? T_LOW_R : T_UP_R) - T_X0 - T_TILT * yMid;
      var lsx = ln.sx;
      if (inkW * lsx > lim) lsx = lim / inkW;
      out.push({ text: txt, size: size, sx: lsx, x: inkL * lsx, y: best.tops[k] + ln.a * size });
    });
    return { font: font, lines: out, sub: parts.sub, latin: latin, main: main };
  }

  // ---------- CSS ----------
  var CSS = [
    '&{--paper:#f1eadb;--ia:#ff3d9a;--ib:#2a4c9c;--ic:#ffd92e;--ax:1.5px;--ay:-1px;--bx:-1px;--by:1.2px;--cx:2px;--cy:2px;',
    '--hei:"Microsoft YaHei UI","Microsoft YaHei","Noto Sans CJK SC",sans-serif;--kai:"KaiTi","楷体","STKaiti","AR PL UKai CN",serif;',
    '--disp:Impact,"Haettenschweiler","Arial Narrow","DejaVu Sans Condensed",sans-serif;--mono:Consolas,"DejaVu Sans Mono",monospace;--serif:Georgia,"Times New Roman","DejaVu Serif",serif;',
    'background:var(--paper);isolation:isolate;font-family:var(--hei);color:var(--ib);-webkit-font-smoothing:antialiased;user-select:none;transition:background .2s}',
    '& *{box-sizing:border-box;margin:0;padding:0}',
    '& button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;outline:none}',
    '& button:focus-visible{outline:2px dashed var(--ia);outline-offset:2px}',
    '& ol,& ul{list-style:none}',
    '& .rp-gl,& .rp-flat{position:absolute;left:0;top:0;width:100%;height:100%;display:block}',
    '& .rp-stage{position:absolute;left:0;top:0;width:1600px;height:900px;transform-origin:0 0;mix-blend-mode:multiply}',
    '& .rp-s2{pointer-events:none}& .rp-s2>*{pointer-events:auto}& .rp-s2 .np,& .rp-s2 .times{pointer-events:none}& .rp-s2 .times .qt{pointer-events:auto}',
    // 斑点层没有遮罩时是一整块纸色，会盖住整张海报：遮罩生成好之前先藏起来
    '& .rp-speck{position:absolute;inset:0;pointer-events:none;background:var(--paper);transition:background .2s;-webkit-mask-size:100% 100%;mask-size:100% 100%;opacity:0;visibility:hidden}',
    '& .rp-speck.on{opacity:1;visibility:visible}',
    '& .a{color:var(--ia);translate:var(--ax) var(--ay)}& .b{color:var(--ib);translate:var(--bx) var(--by)}& .c{color:var(--ic);translate:var(--cx) var(--cy)}',
    '& .ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    // 巨型标题的点击区（标题本身画在印版上）：点了进入沉浸模式
    '& .title-hit{position:absolute;left:18px;top:var(--tt,158px);width:734px;height:calc(880px - var(--tt,158px));display:block;cursor:pointer;background:none}',
    '& .title-hit .th-up,& .title-hit .th-low{position:absolute;left:0;display:block}',
    '& .title-hit .th-up{top:0;width:734px;height:calc(668px - var(--tt,158px))}',
    '& .title-hit .th-low{top:calc(668px - var(--tt,158px));width:562px;height:212px}',
    '& .title-hit{pointer-events:none}& .title-hit .th-up,& .title-hit .th-low{pointer-events:auto}',
    '& .title-hit .th-tag{position:absolute;left:4px;bottom:-14px;font:700 12px/1 var(--mono);letter-spacing:.16em;white-space:nowrap;background:var(--paper);padding:3px 6px;opacity:0;transform:translateY(4px);transition:opacity .18s,transform .18s;pointer-events:none}',
    '& .title-hit:hover .th-tag{opacity:1;transform:none}',
    // header
    '& .kicker{position:absolute;left:1122px;top:146px;font:700 11.5px/1 var(--mono);letter-spacing:.22em;white-space:nowrap}',
    '& .dow{position:absolute;left:1432px;top:172px;font:400 34px/.9 var(--disp);letter-spacing:.02em;text-transform:uppercase;white-space:nowrap}',
    '& .dow b{display:block;font-size:52px;letter-spacing:.01em}',
    '& .datecn{position:absolute;left:1124px;top:268px;font:700 15px/1 var(--hei);letter-spacing:.3em;white-space:nowrap}',
    '& .hl-hit{position:absolute;left:1122px;top:296px;width:436px;height:52px;display:block}',
    '& .hl-hit .tag{position:absolute;right:8px;top:50%;margin-top:-9px;font:700 11px/18px var(--mono);letter-spacing:.14em;padding:0 6px;background:var(--paper);opacity:0;transform:translateX(-6px);transition:opacity .18s,transform .18s}',
    '& .hl-hit:hover .tag,& .hl-hit:focus-visible .tag{opacity:1;transform:none}',
    '& .hl-hit::after{content:"";position:absolute;left:0;right:0;bottom:-5px;height:3px;background:var(--ia);transform:scaleX(0);transform-origin:0 50%;transition:transform .22s cubic-bezier(.2,.8,.2,1)}',
    '& .hl-hit:hover::after{transform:scaleX(1)}',
    '& .head-sub{position:absolute;left:1124px;top:352px;width:436px;font:700 13px/1.5 var(--mono);letter-spacing:.08em}',
    '& .head-sub em{font:italic 15px var(--serif);letter-spacing:0}',
    // lineup
    '& .lu-h,& .sa-h{position:absolute;left:1122px;width:436px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;font:700 12px/1 var(--mono);letter-spacing:.2em;border-bottom:3px solid currentColor;padding-bottom:6px;white-space:nowrap}',
    '& .lu-h{top:392px}& .sa-h{top:630px}',
    '& .sa-h .src{font:700 11px/1 var(--hei);letter-spacing:.08em;color:var(--ia);overflow:hidden;text-overflow:ellipsis;min-width:0}',
    '& .lineup{position:absolute;left:1122px;top:410px;width:436px}',
    '& .lineup li{position:relative;height:35px}',
    '& .lineup li::after{content:"";position:absolute;left:0;right:0;bottom:0;border-bottom:1.5px dotted var(--ib);translate:var(--bx) var(--by)}',
    '& .lineup button{position:relative;display:flex;align-items:baseline;width:100%;height:35px;text-align:left;padding-top:3px;white-space:nowrap}',
    '& .lineup .n{flex:none;width:56px;font:400 31px/1 var(--disp);color:var(--ia);translate:var(--ax) var(--ay);transition:transform .15s}',
    '& .lineup .t{flex:none;font:900 25px/1 var(--hei);color:var(--ib);translate:var(--bx) var(--by);letter-spacing:.02em;transition:transform .15s}',
    '& .lineup .e{flex:none;margin-left:10px;font:700 11px/1 var(--mono);letter-spacing:.16em;color:var(--ib);translate:var(--bx) var(--by)}',
    '& .lineup .m{margin-left:auto;padding-left:12px;min-width:0;font:700 13px/1.1 var(--mono);color:var(--ia);translate:var(--ax) var(--ay);letter-spacing:.04em;overflow:hidden;text-overflow:ellipsis}',
    '& .lineup .hl{position:absolute;left:44px;top:4px;height:27px;width:0;background:var(--ic);translate:var(--cx) var(--cy);transition:width .22s cubic-bezier(.2,.8,.2,1);z-index:-1}',
    '& .lineup button:hover .hl,& .lineup button:focus-visible .hl{width:calc(100% - 44px)}',
    '& .lineup button:hover .n{transform:translateX(6px) rotate(-4deg)}',
    '& .lineup button:hover .t{transform:translateX(4px)}',
    '& .lineup li.first .t{font-size:27px}& .lineup li.first .n{font-size:34px}',
    '& .lineup li.on .t{text-decoration:underline wavy var(--ia) 2px;text-underline-offset:6px}',
    '& .lineup li.dim .m{opacity:.62}',
    // support acts
    '& .acts{position:absolute;left:1122px;top:652px;width:440px;height:62px;font:900 19px/1.62 var(--hei);letter-spacing:.01em;overflow:hidden}',
    '& .acts button{position:relative;display:inline-block;max-width:196px;vertical-align:top;padding:0 1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:transform .15s}',
    '& .acts button span{font:400 13px/1 var(--kai);margin-left:3px;color:var(--ia);translate:var(--ax) var(--ay);display:inline-block;transform:translateY(-1px)}',
    '& .acts .sep{color:var(--ia);margin:0 5px;font-weight:400;translate:var(--ax) var(--ay);display:inline-block;vertical-align:top;font-style:normal}',
    '& .acts button:hover,& .acts button:focus-visible{background:linear-gradient(transparent 52%,var(--ic) 52%,var(--ic) 90%,transparent 90%);transform:translateY(-1px)}',
    '& .acts button.on{text-decoration:line-through var(--ia) 3px}',
    '& .acts .hint{font:400 15px/1.5 var(--kai);color:var(--ib)}',
    '& .acts .go{font:900 17px/1.62 var(--hei)}',
    // ticket
    '& .ticket{position:absolute;left:1122px;top:724px;width:438px;height:144px;display:flex;border:2.5px solid var(--ib);translate:var(--bx) var(--by)}',
    '& .ticket .stub{flex:none;width:112px;border-right:2.5px dashed var(--ib);padding:10px;display:flex;flex-direction:column;justify-content:space-between}',
    '& .ticket .stub small{font:700 10px/1.25 var(--mono);letter-spacing:.14em;white-space:nowrap}',
    '& .ticket .stub strong{font:400 54px/.85 var(--disp);color:var(--ia);translate:calc(var(--ax) - var(--bx)) calc(var(--ay) - var(--by));white-space:nowrap}',
    '& .ticket .stub strong sub{font-size:15px;vertical-align:baseline;margin-left:2px}',
    '& .ticket .main{flex:1;min-width:0;padding:10px 14px;display:flex;flex-direction:column;justify-content:space-between}',
    '& .ticket .row{display:flex;justify-content:space-between;font:700 10.5px/1 var(--mono);letter-spacing:.14em;white-space:nowrap}',
    '& .ticket .big{font:900 23px/1.12 var(--hei);letter-spacing:.02em}',
    '& .ticket .big i{font:400 15px var(--kai);font-style:normal;color:var(--ia);translate:calc(var(--ax) - var(--bx)) calc(var(--ay) - var(--by));display:inline-block}',
    '& .ticket .nx{display:flex;align-items:baseline;gap:8px;font:700 12px/1 var(--mono);letter-spacing:.1em;border-top:1.5px dotted var(--ib);padding-top:7px;text-align:left;width:100%;white-space:nowrap;min-width:0}',
    '& .ticket .nx b{font:900 17px/1 var(--hei);letter-spacing:.02em;min-width:0;overflow:hidden;text-overflow:ellipsis;transition:color .15s}',
    '& .ticket .nx .na{min-width:0;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto}',
    '& .ticket .nx .d{margin-left:auto;flex:none}',
    '& .ticket .nx .ar{flex:none;display:inline-block;transition:transform .15s}',
    '& .ticket .nx:hover b,& .ticket .nx:focus-visible b{color:var(--ia)}& .ticket .nx:hover .ar{transform:translateX(4px)}',
    '& .notch{position:absolute;width:18px;height:18px;border-radius:50%;background:var(--paper);border:2.5px solid var(--ib);left:101px}',
    '& .notch.t{top:-11px;clip-path:inset(50% 0 0 0)}& .notch.btm{bottom:-11px;clip-path:inset(0 0 50% 0)}',
    '& .colo{position:absolute;left:1122px;top:878px;font:700 9.5px/1 var(--mono);letter-spacing:.14em;white-space:nowrap}',
    // search tear strip（移到拉绳右侧，避开左上角）
    '& .rp-search{position:absolute;left:122px;top:14px;width:268px;height:44px;transform:rotate(-1.4deg);transform-origin:0 50%;transition:transform .25s cubic-bezier(.2,.9,.3,1.3)}',
    '& .rp-search:hover,& .rp-search:focus-within{transform:rotate(0deg) translateY(2px)}',
    '& .rp-search .strip{position:absolute;inset:0;background:var(--ic);translate:var(--cx) var(--cy);',
    '-webkit-mask:radial-gradient(circle at 0 50%,transparent 3.5px,#000 4px) 0 0/100% 9px repeat-y;mask:radial-gradient(circle at 0 50%,transparent 3.5px,#000 4px) 0 0/100% 9px repeat-y}',
    '& .rp-search .tab{position:absolute;left:14px;top:0;width:96px;height:44px;display:flex;align-items:center;gap:6px;font:400 19px/1 var(--disp);white-space:nowrap;overflow:hidden;color:var(--ib);translate:var(--bx) var(--by);cursor:text}',
    '& .rp-search .tab svg{width:20px;height:20px;flex:none}',
    '& .rp-search .perf{position:absolute;left:112px;top:4px;bottom:4px;border-left:2px dashed var(--ib);translate:var(--bx) var(--by)}',
    '& .rp-search input{position:absolute;left:124px;top:0;width:136px;height:44px;background:none;border:0;outline:0;font:700 15px/44px var(--hei);color:var(--ib);letter-spacing:.04em;translate:var(--bx) var(--by);user-select:text}',
    '& .rp-search input::placeholder{color:var(--ib);opacity:.6}',
    '& .rp-search .enter{position:absolute;left:124px;top:48px;font:700 10px/1 var(--mono);letter-spacing:.16em;color:var(--ia);opacity:0;transition:opacity .2s;white-space:nowrap;pointer-events:none}',
    '& .rp-search:focus-within .enter{opacity:1}',
    // transport
    '& .np{position:absolute;left:600px;top:678px;width:430px;display:flex;justify-content:space-between;gap:16px;font:700 11px/1 var(--mono);letter-spacing:.2em;white-space:nowrap}',
    '& .np .nt{min-width:0;overflow:hidden;text-overflow:ellipsis;letter-spacing:.08em}',
    '& .np .ns{flex:none}',
    '& .tp{position:absolute;left:596px;top:700px;width:438px;height:118px;display:flex;align-items:center}',
    '& .glyph{display:grid;place-items:center;transition:transform .15s}',
    '& .glyph svg{display:block}',
    '& .glyph:hover{transform:scale(1.08) rotate(-3deg)}& .glyph:active{transform:scale(.94)}',
    '& .prev,& .nxt{width:78px;height:96px;color:var(--ib);translate:var(--bx) var(--by)}',
    '& .stamp{position:relative;width:118px;height:118px;margin:0 6px;color:var(--ia);translate:var(--ax) var(--ay)}',
    '& .stamp .ring{position:absolute;inset:0}& .stamp .ic{position:absolute;inset:0;display:grid;place-items:center}',
    '& .stamp:hover{transform:rotate(-8deg) scale(1.05)}',
    '& .stamp.hit{animation:rp-stamp .42s cubic-bezier(.3,1.6,.4,1)}',
    '& .blot{position:absolute;left:50%;top:50%;width:150px;height:150px;margin:-75px 0 0 -75px;border-radius:50%;background:radial-gradient(circle,var(--ic) 0 45%,transparent 46%);translate:var(--cx) var(--cy);opacity:0;pointer-events:none;z-index:-1}',
    '& .stamp.hit .blot{animation:rp-blot .6s ease-out}',
    '& .tp .sp{flex:1}',
    '& .like{width:64px;height:64px;color:var(--ia);translate:var(--ax) var(--ay)}',
    '& .like svg path{fill:transparent;stroke:currentColor;stroke-width:3.2;transition:fill .15s}',
    '& .like.on svg path{fill:currentColor}',
    '& .ci{width:62px;height:62px;margin-left:10px;border:3px solid var(--ib);color:var(--ib);translate:var(--bx) var(--by);font:900 34px/1 var(--hei);display:grid;place-items:center;transition:transform .15s,background .15s,color .15s}',
    '& .ci:hover{transform:rotate(4deg)}& .ci.on{background:var(--ib);color:var(--paper)}',
    '& .ruler{position:absolute;left:600px;top:830px;width:430px;height:28px;cursor:pointer}',
    '& .ruler .base{position:absolute;left:0;right:0;top:12px;height:3px;background:var(--ib);translate:var(--bx) var(--by)}',
    '& .ruler .ticks{position:absolute;left:0;right:0;top:4px;height:8px;translate:var(--bx) var(--by);background:repeating-linear-gradient(90deg,var(--ib) 0 1.5px,transparent 1.5px 100%) 0 0/calc(100%/24.6) 100% repeat-x}',
    '& .ruler .fill{position:absolute;left:0;top:9px;height:10px;width:0;background:var(--ia);translate:var(--ax) var(--ay);transition:height .15s,top .15s}',
    '& .ruler .head{position:absolute;top:-2px;width:4px;height:30px;left:0;background:var(--ia);translate:var(--ax) var(--ay);transition:height .15s}',
    '& .ruler .ghost{position:absolute;top:0;width:2px;height:26px;left:0;background:var(--ib);opacity:0;transition:opacity .15s;pointer-events:none}',
    '& .ruler:hover .head{height:34px}& .ruler:hover .fill{height:12px;top:8px}& .ruler:hover .ghost{opacity:.55}',
    '& .ruler.off{cursor:default;opacity:.5}& .ruler.off .ghost{display:none}',
    '& .times{position:absolute;left:600px;top:862px;width:430px;display:flex;justify-content:space-between;gap:14px;font:700 12px/1 var(--mono);letter-spacing:.12em;white-space:nowrap}',
    '& .times .qt{min-width:0;overflow:hidden;text-overflow:ellipsis;font:700 12px/1 var(--hei);letter-spacing:.06em;cursor:pointer;transition:color .15s}',
    '& .times .qt:hover{color:var(--ia)}',
    '& .times span{flex:none}',
    // sticker
    '& .sticker{position:absolute;left:874px;top:506px;width:164px;height:164px;cursor:pointer;border-radius:50%}',
    '& .sticker .rot{position:absolute;inset:0;animation:rp-spin 18s linear infinite;color:var(--ib);translate:var(--bx) var(--by)}',
    '& .sticker.fast .rot{animation-duration:6s}',
    '& .sticker .mid{position:absolute;inset:40px;display:grid;place-items:center;text-align:center;color:var(--ia);translate:var(--ax) var(--ay);transition:transform .2s}',
    '& .sticker .mid b{display:block;font:400 34px/.9 var(--disp);white-space:nowrap}',
    '& .sticker .mid small{display:block;font:900 13px/1.2 var(--hei);letter-spacing:.2em;white-space:nowrap}',
    '& .sticker:hover .mid{transform:scale(1.1) rotate(-6deg)}',
    '&.rp-paused *,&.rp-rm *{animation-play-state:paused!important}',
    '&.rp-rm .sticker .rot{animation:none}',
    '@keyframes rp-spin{to{transform:rotate(360deg)}}',
    '@keyframes rp-stamp{0%{transform:scale(1.35) rotate(-14deg);opacity:.5}35%{transform:scale(.9) rotate(3deg);opacity:1}100%{transform:scale(1) rotate(0)}}',
    '@keyframes rp-blot{0%{opacity:.9;transform:scale(.6)}100%{opacity:0;transform:scale(1.25)}}',
  ].join('\n').replace(/&/g, '.hth-' + ID);

  var IC_PLAY = '<svg width="46" height="46" viewBox="0 0 46 46"><path d="M12 5l29 18-29 18z" fill="var(--paper)"/></svg>';
  var IC_PAUSE = '<svg width="46" height="46" viewBox="0 0 46 46" fill="var(--paper)"><rect x="9" y="6" width="10" height="34"/><rect x="27" y="6" width="10" height="34"/></svg>';

  function template(uid) {
    var li = '';
    for (var i = 0; i < 6; i++) {
      li += '<li class="' + (i === 0 ? 'first' : '') + '"><button type="button" data-p="' + i + '"><i class="hl"></i><span class="n">0' + (i + 1) + '</span><span class="t"></span><span class="e"></span><span class="m"></span></button></li>';
    }
    return '' +
      '<canvas class="rp-gl"></canvas>' +
      '<div class="rp-stage rp-s1">' +
      '<div class="rp-search"><div class="strip"></div>' +
      '<label class="tab" for="' + uid + '-q"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="3"><circle cx="8" cy="8" r="5.5"/><path d="M12 12l6 6"/></svg>SEARCH</label>' +
      '<div class="perf"></div><input id="' + uid + '-q" class="q" type="text" placeholder="歌曲、歌手…" autocomplete="off" spellcheck="false" aria-label="搜索歌曲、歌手">' +
      '<div class="enter">ENTER ↵ 搜索</div></div>' +
      '<button type="button" class="title-hit" title="进入沉浸模式"><span class="th-up"></span><span class="th-low"></span><span class="th-tag a">点标题 · 进入沉浸模式 →</span></button>' +
      '<div class="kicker b">MINERADIO PRESENTS · 私人视觉电台</div>' +
      '<div class="dow b"><span class="dw"></span><b class="tm"></b></div>' +
      '<div class="datecn b"></div>' +
      '<button type="button" class="hl-hit"><span class="tag a"></span></button>' +
      '<div class="head-sub b ell"></div>' +
      '<div class="lu-h b"><span class="luh-l"></span><span class="luh-r">06 ACTS</span></div>' +
      '<ol class="lineup">' + li + '</ol>' +
      '<div class="sa-h b"><span>SUPPORT ACTS · 为你挑选</span><span class="src"></span></div>' +
      '<div class="acts b"></div>' +
      '<div class="ticket"><i class="notch t"></i><i class="notch btm"></i>' +
      '<div class="stub"><small>ADMIT ONE<br>今日聆听</small><strong><span class="tk-min"></span><sub>MIN</sub></strong><small class="tk-no"></small></div>' +
      '<div class="main"><div class="row"><span>TODAY · 今日票根</span><span class="tk-seat"></span></div>' +
      '<div class="big ell"><span class="tk-big"></span> <i class="tk-sub"></i></div>' +
      '<button type="button" class="nx"><span class="ar">NEXT UP →</span><b class="nx-t"></b><span class="na nx-a"></span><span class="d nx-d"></span></button></div></div>' +
      '<div class="colo b"></div>' +
      '</div>' +
      '<div class="rp-stage rp-s2">' +
      '<div class="np b"><span class="ns"></span><span class="nt"></span></div>' +
      '<div class="tp">' +
      '<button type="button" class="glyph prev" title="上一首"><svg width="72" height="72" viewBox="0 0 72 72" fill="currentColor"><rect x="4" y="10" width="9" height="52"/><path d="M40 10v52L13 36zM68 10v52L41 36z"/></svg></button>' +
      '<button type="button" class="glyph stamp" title="播放 / 暂停"><i class="blot"></i><svg class="ring" viewBox="0 0 118 118"><circle cx="59" cy="59" r="55" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="59" cy="59" r="47" fill="currentColor"/></svg><span class="ic"></span></button>' +
      '<button type="button" class="glyph nxt" title="下一首"><svg width="72" height="72" viewBox="0 0 72 72" fill="currentColor"><path d="M4 10v52l27-26zM32 10v52l27-26z"/><rect x="59" y="10" width="9" height="52"/></svg></button>' +
      '<span class="sp"></span>' +
      '<button type="button" class="glyph like" title="喜欢"><svg width="52" height="52" viewBox="0 0 52 52"><path d="M26 45S5 32 5 17.5C5 10 10.5 5.5 16.5 5.5c4.6 0 7.8 2.6 9.5 6 1.7-3.4 4.9-6 9.5-6C41.5 5.5 47 10 47 17.5 47 32 26 45 26 45z"/></svg></button>' +
      '<button type="button" class="glyph ci" title="歌词开关">词</button>' +
      '</div>' +
      '<div class="ruler" role="slider" aria-label="播放进度" tabindex="0"><div class="ticks"></div><div class="base"></div><div class="fill"></div><div class="head"></div><div class="ghost"></div></div>' +
      '<div class="times b"><span class="t-cur"></span><span class="qt" title="换一句"></span><span class="t-dur"></span></div>' +
      '<div class="sticker" role="button" tabindex="0">' +
      '<svg class="rot" viewBox="0 0 164 164"><defs><path id="' + uid + '-cp" d="M82,82 m-64,0 a64,64 0 1,1 128,0 a64,64 0 1,1 -128,0"/></defs>' +
      '<text font-family="Impact,\'Arial Narrow\',\'DejaVu Sans Condensed\',sans-serif" font-size="16" fill="currentColor" font-weight="700"><textPath class="st-ring" href="#' + uid + '-cp" textLength="400" lengthAdjust="spacing"></textPath></text></svg>' +
      '<div class="mid"><div><b class="st-t"></b><small class="st-s"></small></div></div></div>' +
      '</div>' +
      '<div class="rp-speck"></div>';
  }

  // ---------- shaders ----------
  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var COMMON = 'precision highp float;\n' +
    'uniform vec2 uRes;uniform vec4 uSt;\n' +
    'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\n' +
    'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+1.),f.x),f.y);}\n' +
    'float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+17.1;a*=.5;}return s;}\n' +
    'vec2 designPos(){vec2 css=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uSt.w;return (css-uSt.xy)/uSt.z;}\n' +
    'const vec4 CR=vec4(' + CR.map(function (v) { return v.toFixed(1); }).join(',') + ');\n' +
    'vec2 cuv(vec2 d){return (d-CR.xy)/(CR.zw-CR.xy);}\n';
  // 静态 pass：版面文字 × 墨层密度 / 颗粒 + 纸面。只在尺寸或套准偏移变化时重画。
  // 边缘毛糙（原稿里的 SVG feTurbulence）在这里用噪声位移实现，只作用于印版文字（巨型标题等）。
  var FS_STATIC = COMMON +
    'uniform sampler2D uTex;uniform vec2 oA,oB,oC;uniform float uMode;\n' +
    'vec2 suv(vec2 d){vec2 p=(d*uSt.z+uSt.xy)*uSt.w;return vec2(p.x,uRes.y-p.y)/uRes;}\n' +
    'float inkK(vec2 d,float sd){float dens=.78+.14*vn(d*.011+sd)+.08*vn(d*.05+sd);dens*=.95+.05*vn(vec2(d.y*.06+sd,sd));' +
    'float tooth=vn(d*1.3+sd*3.);float g=h21(floor(gl_FragCoord.xy)+sd*31.);return clamp(dens*(1.-.28*smoothstep(.62,.95,tooth))*(.88+.12*g),0.,1.);}\n' +
    'void main(){vec2 d=designPos();\n' +
    ' vec2 wob=(vec2(vn(d*.28),vn(d*.28+7.))-.5)*1.3+(vec2(vn(d*.9+3.1),vn(d*.9+8.7))-.5)*1.2;\n' +
    ' float kA=inkK(d,1.7),kB=inkK(d,5.3),kC=inkK(d,9.1);\n' +
    ' if(uMode>.5){gl_FragColor=vec4(kA,kB,kC,1.);return;}\n' +
    ' float tA=texture2D(uTex,suv(d-oA+wob)).r;float tB=texture2D(uTex,suv(d-oB+wob)).g;float tC=texture2D(uTex,suv(d-oC+wob)).b;\n' +
    ' float f1=smoothstep(.66,.74,vn(vec2(d.x*.07,d.y*.9)));\n' +
    ' float f2=smoothstep(.68,.76,vn(mat2(.8,.6,-.6,.8)*d*vec2(.06,.85)+3.));\n' +
    ' float f3=smoothstep(.7,.78,vn(mat2(.3,-.95,.95,.3)*d*vec2(.05,.7)+11.));\n' +
    ' float mot=fbm(d*.005);\n' +
    ' float pa=(.955+.06*mot)-(f1+f2+f3)*.032+(h21(gl_FragCoord.xy*.7)-.5)*.04;\n' +
    ' gl_FragColor=vec4(tA*kA,tB*kB,tC*kC,pa/1.1);}';
  // 画面 pass：输出三色墨量（r=粉 g=蓝 b=黄）+ 封面边缘遮罩。有封面时对封面做分色，否则画程序生成的"海边日落"。
  var FS_SCENE = COMMON +
    'uniform float uT,uHas,uSeed,uMove,uGam;uniform vec2 uLv;uniform sampler2D uCov;uniform vec4 uFit;\n' +
    'float inC(vec2 d){vec2 c=cuv(d);float e=.03*(vn(d*.02)-.5);vec2 m=smoothstep(-.01,.05,c+e)*smoothstep(-.01,.05,1.-c+e);return m.x*m.y;}\n' +
    'vec3 scene(vec2 c,float t){\n' +
    ' float hz=.585+(fract(uSeed*7.31)-.5)*.1+.004*sin(c.x*7.+t*.5);vec2 q=vec2(c.x*1.22,c.y);\n' +
    ' vec2 sp=vec2((.45+.3*uSeed)*1.22,hz-.185+.008*sin(t*.35));float sd=length(q-sp);\n' +
    ' float sun=smoothstep(.175,.168,sd)*step(c.y,hz);float glow=exp(-sd*3.2);float up=c.y/hz;\n' +
    ' float cl=vn(vec2(c.x*2.6+t*.02+uSeed*9.,c.y*11.))*.65+vn(vec2(c.x*5.3,c.y*23.)+4.+uSeed*5.)*.35;\n' +
    ' float band=smoothstep(.55,.75,cl)*smoothstep(.1,.5,up);\n' +
    ' vec3 sky=vec3(.12+.62*up*up+.35*glow+.25*band,.62*(1.-up)*(1.-up)+.12*band*(1.-glow),.06+.95*glow*glow+.2*up);\n' +
    ' sky=mix(sky,vec3(.55,0.,1.),sun);float dp=clamp((c.y-hz)/(1.-hz),0.,1.);\n' +
    ' float wv=sin(3.2/(c.y-hz+.035)-t*1.3+(vn(c*vec2(5.,26.)+t*.05)*.7+vn(c*vec2(11.,52.))*.3)*5.);\n' +
    ' float rw=.035+.2*dp;float rx=(q.x-sp.x)/rw;float refl=exp(-rx*rx)*smoothstep(-.3,.8,wv)*(1.-.3*dp);\n' +
    ' vec3 sea=vec3(.3+.2*wv*(1.-dp)+.5*refl,.3+.32*dp+.14*wv-.5*refl,.04+.95*refl+.08*(1.-dp));\n' +
    ' vec3 r=mix(sky,sea,smoothstep(hz-.002,hz+.002,c.y));return clamp(r*(1.+.05*sin(t*.9)),0.,1.);}\n' +
    // 分色：RGB → 粉 / 蓝 / 黄 三块版的墨量
    'vec3 sep(vec2 c,float t){float z=1.+.02*uMove*sin(t*.21);vec2 cc=(c-.5)/z+.5+uMove*vec2(.006*sin(t*.17),.005*cos(t*.13));\n' +
    ' vec2 uv=uFit.xy+clamp(cc,0.,1.)*uFit.zw;vec3 rgb=texture2D(uCov,vec2(uv.x,1.-uv.y)).rgb;\n' +
    ' rgb=clamp((rgb-uLv.x)/max(uLv.y-uLv.x,.05),0.,1.);rgb=pow(rgb,vec3(uGam));\n' +
    ' float L=dot(rgb,vec3(.3,.59,.11));rgb=clamp(mix(vec3(L),rgb,1.55),0.,1.);\n' +
    ' vec3 cmy=1.-rgb;float k=min(min(cmy.x,cmy.y),cmy.z);vec3 ch=cmy-k;\n' +
    // 暗部主要走蓝版，彩色部分各走各的版，避免三色叠成一片泥
    ' float b=clamp(ch.x*.85+k*1.02-.04,0.,1.);\n' +
    ' float a=clamp(ch.y*1.1+k*.22-.03,0.,1.);\n' +
    ' float y=clamp(ch.z*1.08+k*.12-.03,0.,1.);\n' +
    ' vec3 v=vec3(a,b,y);float tot=v.x+v.y+v.z;v*=min(1.,1.45/max(tot,.001));\n' +
    ' return v*.92;}\n' +
    'void main(){vec2 c=vec2(gl_FragCoord.x/' + SW + '.,1.-gl_FragCoord.y/' + SH + '.);vec2 d=CR.xy+c*(CR.zw-CR.xy);\n' +
    ' vec3 v=uHas>.5?sep(c,uT):scene(c,uT);gl_FragColor=vec4(v,inC(d));}';
  // 合成 pass：三块网点屏 + 印版 + 纸，正片叠底
  var FS_DYN = COMMON +
    'uniform sampler2D uS0,uS1,uSc;uniform float uT,uMOn,uFlash;uniform vec2 uM,oA,oB,oC;uniform vec3 uA,uB,uC,uP;\n' +
    'const vec3 KO=vec3(' + KO.map(function (v) { return v.toFixed(1); }).join(',') + ');\n' +
    'float gN;\n' +
    'float ht(vec2 d,float ang,float cell,int ch){vec2 m=uM;float L=exp(-dot(d-m,d-m)/(170.*170.))*uMOn;vec2 w=m+(d-m)*(1.-.58*L);\n' +
    ' float ca=cos(ang),sa=sin(ang);vec2 q=mat2(ca,sa,-sa,ca)*w/cell;vec2 id=floor(q)+.5;vec2 f=q-id;vec2 cc=mat2(ca,-sa,sa,ca)*(id*cell);\n' +
    ' vec2 c=cuv(cc);if(c.x<-.02||c.x>1.02||c.y<-.02||c.y>1.02)return 0.;\n' +
    ' vec4 s=texture2D(uSc,vec2(c.x,1.-c.y));if(s.a<=.01)return 0.;\n' +
    ' float tone=ch==0?s.x:(ch==1?s.y:s.z);tone=clamp(tone*(1.+.35*L)+.08*L,0.,1.)*s.a;\n' +
    ' if(ch<2)tone*=smoothstep(KO.z,KO.z+4.,length(cc-KO.xy));\n' +
    ' float r=sqrt(tone)*.74;float dist=length(f)+(fract(gN*(1.+float(ch)*1.618))-.5)*.14;\n' +
    ' float aa=1.1/(cell*uSt.z*uSt.w)*(1.-.58*L);return smoothstep(r+aa,r-aa,dist)*step(.03,tone);}\n' +
    'void main(){vec2 d=designPos();vec2 uv=gl_FragCoord.xy/uRes;vec4 s0=texture2D(uS0,uv);float cA=s0.r,cB=s0.g,cC=s0.b;\n' +
    ' if(d.x>CR.x-24.&&d.x<CR.z+24.&&d.y>CR.y-24.&&d.y<CR.w+24.){gN=vn(d*.7);vec3 k=texture2D(uS1,uv).rgb;\n' +
    '  float ko=smoothstep(.15,.5,s0.g);float hA=ht(d-oA,.2618,8.5,0)*(1.-.6*ko);float hB=ht(d-oB,.7854,8.5,1)*(1.-ko);float hC=ht(d-oC,1.309,10.,2)*(1.-.45*ko);\n' +
    '  vec2 cq=cuv(d);float em=smoothstep(-.003,.001,min(min(cq.x,cq.y),min(1.-cq.x,1.-cq.y))+(gN-.5)*.01);\n' +
    '  cA=max(cA,hA*k.r*em);cB=max(cB,hB*k.g*em);cC=max(cC,hC*k.b*em);}\n' +
    ' float fr=floor(uT*20.);\n' +
    ' cA*=1.+uFlash*(h21(vec2(1.7,fr))-.5)*.35;cB*=1.+uFlash*(h21(vec2(5.3,fr))-.5)*.35;cC*=1.+uFlash*(h21(vec2(9.1,fr))-.5)*.35;\n' +
    ' vec3 col=uP*(s0.a*1.1);col*=mix(vec3(1.),uC,clamp(cC,0.,1.));col*=mix(vec3(1.),uA,clamp(cA,0.,1.));col*=mix(vec3(1.),uB,clamp(cB,0.,1.));\n' +
    ' vec2 vv=gl_FragCoord.xy/uRes-.5;col*=1.-.12*dot(vv,vv);gl_FragColor=vec4(col,1.);}';

  function createRiso(root, ctx) {
    var A = ctx.actions || {};
    var RM = !!ctx.reducedMotion;
    var uid = 'rp' + Math.floor(Math.random() * 1e9).toString(36);
    var dead = false, paused = false;
    var timers = [];
    function later(fn, ms) { var t = setTimeout(function () { timers = timers.filter(function (x) { return x !== t; }); if (!dead) fn(); }, ms); timers.push(t); return t; }
    function call(name) {
      var args = [].slice.call(arguments, 1);
      try { if (typeof A[name] === 'function') return A[name].apply(A, args); } catch (e) { console.warn('[riso-poster] action ' + name, e); }
    }

    ctx.injectStyle('theme-' + ID, CSS);
    root.innerHTML = template(uid);
    if (RM) root.classList.add('rp-rm');
    var $ = function (s) { return root.querySelector(s); };
    var E = {
      cv: $('.rp-gl'), stages: [].slice.call(root.querySelectorAll('.rp-stage')), speck: $('.rp-speck'),
      q: $('.q'), dw: $('.dw'), tm: $('.tm'), datecn: $('.datecn'), hlHit: $('.hl-hit'), hlTag: $('.hl-hit .tag'), headSub: $('.head-sub'),
      luhL: $('.luh-l'), luhR: $('.luh-r'), lis: [].slice.call(root.querySelectorAll('.lineup li')),
      src: $('.sa-h .src'), acts: $('.acts'),
      tkMin: $('.tk-min'), tkNo: $('.tk-no'), tkSeat: $('.tk-seat'), tkBig: $('.tk-big'), tkSub: $('.tk-sub'),
      nx: $('.nx'), nxT: $('.nx-t'), nxA: $('.nx-a'), nxD: $('.nx-d'), colo: $('.colo'),
      ns: $('.np .ns'), nt: $('.np .nt'), play: $('.stamp'), playIc: $('.stamp .ic'), prev: $('.prev'), next: $('.nxt'),
      like: $('.like'), lyr: $('.ci'), ruler: $('.ruler'), fill: $('.ruler .fill'), head: $('.ruler .head'), ghost: $('.ruler .ghost'),
      tCur: $('.t-cur'), tDur: $('.t-dur'), qt: $('.times .qt'), sticker: $('.sticker'), stRing: $('.st-ring'), stT: $('.st-t'), stS: $('.st-s'),
    };
    E.lineBtns = E.lis.map(function (li) { return li.querySelector('button'); });
    function txt(el, s) { s = s == null ? '' : String(s); if (el && el.textContent !== s) el.textContent = s; }
    function attr(el, k, v) { if (el && el.getAttribute(k) !== v) el.setAttribute(k, v); }

    // ---------- 调色 / 套准 ----------
    var palIdx = 0, pal = PAL[0];
    var cur = { a: hex(pal.a), b: hex(pal.b), c: hex(pal.c), p: hex(pal.p) };
    var REST = { A: [1.6, -1.1], B: [-1.2, 1.3], C: [2.4, 2.1] };
    var off = { A: REST.A.slice(), B: REST.B.slice(), C: REST.C.slice() };
    var flash = 0, staticDirty = true;
    function applyCSS() {
      root.style.setProperty('--ia', pal.a); root.style.setProperty('--ib', pal.b);
      root.style.setProperty('--ic', pal.c); root.style.setProperty('--paper', pal.p);
      txt(E.colo, 'RISO · 3 INKS · ' + pal.name + ' · 157 GSM');
    }
    function applyOff() {
      ['A', 'B', 'C'].forEach(function (p) {
        var l = p.toLowerCase();
        root.style.setProperty('--' + l + 'x', off[p][0].toFixed(1) + 'px');
        root.style.setProperty('--' + l + 'y', off[p][1].toFixed(1) + 'px');
      });
      staticDirty = true;
    }

    // ---------- 尺寸 ----------
    var S = 1, OX = 0, OY = 0, DPR = 1, VW = 0, VH = 0, titleTop = 158;
    var gl = null, flat = false;
    try { gl = E.cv.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false }); } catch (_e) { gl = null; }
    var pc = document.createElement('canvas'), px = pc.getContext('2d');
    // 退回 2D 平面印刷：没有 WebGL，或着色器编译 / 上下文恢复失败时都走这里
    function useFlat() {
      if (flat) return;
      flat = true; ready = false;
      pc.className = 'rp-flat';
      if (E.cv.parentNode) E.cv.parentNode.replaceChild(pc, E.cv);
    }
    if (!gl) useFlat();

    function measureRoot(w, h) {
      VW = root.clientWidth || w || window.innerWidth;
      VH = root.clientHeight || h || window.innerHeight;
    }
    function layout(w, h) {
      measureRoot(w, h);
      S = Math.min(VW / W0, VH / H0); OX = (VW - W0 * S) / 2; OY = (VH - H0 * S) / 2;
      var tr = 'translate(' + OX.toFixed(2) + 'px,' + OY.toFixed(2) + 'px) scale(' + S.toFixed(5) + ')';
      E.stages.forEach(function (s) { s.style.transform = tr; });
      DPR = Math.min(window.devicePixelRatio || 1, 1.5);
      // 左上角拉绳区（屏幕 x<90, y<150）要留空：标题顶部按当前缩放推算
      titleTop = Math.round(Math.max(132, Math.min(196, 158 / S)));
      E.stages.forEach(function (st) { st.style.setProperty('--tt', titleTop + 'px'); });
      titleCache = null;
      var cw = Math.max(1, Math.round(VW * DPR)), ch = Math.max(1, Math.round(VH * DPR));
      if (!flat) { E.cv.width = cw; E.cv.height = ch; }
      pc.width = cw; pc.height = ch;
      drawPlates();
      if (gl && ready) { gl.viewport(0, 0, cw, ch); sizeFBO(); }
      if (speckStale()) scheduleSpeck();
    }

    // ---------- 印版：R=粉 A，G=蓝 B，B=黄 C ----------
    var model = null, titleCache = null, plateState = null;
    function regMark(x, y) { px.lineWidth = 1.6; px.beginPath(); px.arc(x, y, 8, 0, 7); px.moveTo(x - 14, y); px.lineTo(x + 14, y); px.moveTo(x, y - 14); px.lineTo(x, y + 14); px.stroke(); }
    function fitText(t, maxW) { var w = px.measureText(t).width; if (w > maxW) px.scale(maxW / w, 1); px.fillText(t, 0, 0); }

    function plateData() {
      var m = model || {}, now = m.now, c = m.clock || {};
      var title = now ? now.title : '今晚还没有节目';
      var mon = Number(c.month) || 1, day = Number(c.day) || 1;
      var wd = WD_CN.indexOf(c.weekday);
      var tag = MON_EN[(mon - 1 + 12) % 12] + ' ' + day + (wd >= 0 ? ' · ' + WD_EN[wd] : '');
      var parts = splitTitle(title);
      var vert;
      if (!now) vert = 'NO SHOW YET · ' + tag + ' · STAGE OPEN';
      else if (parts.sub) vert = parts.sub.toUpperCase();
      else if (!CJK_RE.test(title)) vert = title.toUpperCase();
      else vert = 'ONE NIGHT ONLY · ' + tag;
      var artist = now ? (now.artist || '未知歌手') : (m.login && m.login.any ? '选一首 · 开场' : '登录 · 开场');
      // 叠印数字：取日期的末位（整十日取十位），像海报上的场次号
      var digit = day % 10 ? String(day % 10) : String(Math.floor(day / 10) || 1);
      return { title: title, vert: vert, artist: artist, date: mon + '.' + day, digit: digit, empty: !now, artistLatin: !CJK_RE.test(artist) };
    }

    function drawVertical(text, x, y0, L) {
      var fs0 = 58;
      function runsOf(t) {
        var runs = [];
        Array.from(t).forEach(function (ch) {
          var cj = CJK_RE.test(ch), last = runs[runs.length - 1];
          if (last && last.cjk === cj) last.t += ch; else runs.push({ cjk: cj, t: ch });
        });
        return runs;
      }
      function len(runs, fs) {
        var tot = 0;
        runs.forEach(function (r) {
          if (r.cjk) tot += Array.from(r.t).length * fs * 0.92;
          else { px.font = '700 ' + fs + 'px ' + DISP; tot += px.measureText(r.t).width; }
        });
        return tot;
      }
      var runs = runsOf(text), fs = fs0, tot = len(runs, fs), sq = 1;
      var k = L / tot;
      if (k >= 1) { fs = Math.min(64, fs0 * k); tot = len(runs, fs); }
      else if (k >= 0.72) sq = k;
      else {
        sq = 0.72; fs = Math.max(34, fs0 * k / 0.72); tot = len(runs, fs);
        var chars = Array.from(text);
        while (tot * sq > L && chars.length > 3) { chars.pop(); runs = runsOf(chars.join('').replace(/[\s·]+$/, '') + '…'); tot = len(runs, fs); }
      }
      px.save(); px.translate(x, y0); px.rotate(Math.PI / 2); px.scale(sq, 1);
      var cx = 0;
      runs.forEach(function (r) {
        if (r.cjk) {
          px.font = '900 ' + (fs * 0.84).toFixed(1) + 'px ' + HEI;
          Array.from(r.t).forEach(function (ch) {
            px.save(); px.translate(cx + fs * 0.46, -fs * 0.37); px.scale(1 / sq, sq); px.rotate(-Math.PI / 2);
            px.textAlign = 'center'; px.textBaseline = 'middle'; px.fillText(ch, 0, 0); px.restore();
            cx += fs * 0.92;
          });
        } else {
          px.font = '700 ' + fs + 'px ' + DISP; px.textAlign = 'left'; px.textBaseline = 'alphabetic';
          px.fillText(r.t, cx, 0); cx += px.measureText(r.t).width;
        }
      });
      px.restore();
    }

    function drawArtist(name, latinTag) {
      // 横幅（黄版底条）上的主演名：先缩字号，再横向压缩，最后省略
      var maxW = 420, fs = 44;
      px.font = '900 ' + fs + 'px ' + HEI;
      var w = px.measureText(name).width;
      if (w > maxW) { fs = Math.max(28, fs * maxW / w); px.font = '900 ' + fs + 'px ' + HEI; w = px.measureText(name).width; }
      var sq = 1;
      if (w > maxW) { sq = Math.max(0.8, maxW / w); }
      var shown = name;
      if (w * sq > maxW) {
        var ch = Array.from(name);
        while (ch.length > 1 && px.measureText(ch.join('') + '…').width * sq > maxW) ch.pop();
        shown = ch.join('').replace(/[\s/·]+$/, '') + '…';
        w = px.measureText(shown).width;
      }
      px.save(); px.translate(1130, 340 - (44 - fs) * 0.28); px.scale(sq, 1); px.fillText(shown, 0, 0); px.restore();
      var used = w * sq;
      if (latinTag && used + 20 + 150 < maxW + 10) {
        px.font = '700 30px ' + DISP;
        px.fillText(latinTag, 1130 + used + 16, 338);
      }
    }

    function drawPlates() {
      if (!pc.width) return;
      var d = plateState = plateData();
      if (!titleCache || titleCache.key !== d.title + '|' + titleTop) {
        titleCache = { key: d.title + '|' + titleTop, lay: layoutTitle(d.title, titleTop) };
      }
      var lay = titleCache.lay;
      px.setTransform(1, 0, 0, 1, 0, 0);
      var A_ = '#ff0000', B_ = '#00ff00', C_ = '#0000ff';
      if (flat) {
        px.globalCompositeOperation = 'source-over'; px.fillStyle = pal.p; px.fillRect(0, 0, pc.width, pc.height);
        px.globalCompositeOperation = 'multiply'; A_ = pal.a; B_ = pal.b; C_ = pal.c;
      } else {
        px.globalCompositeOperation = 'source-over'; px.fillStyle = '#000'; px.fillRect(0, 0, pc.width, pc.height);
        px.globalCompositeOperation = 'lighter';
      }
      px.setTransform(DPR * S, 0, 0, DPR * S, DPR * OX, DPR * OY);
      px.textBaseline = 'alphabetic'; px.textAlign = 'left';

      // --- C 黄版：叠印数字、贴纸底、主演横幅 ---
      px.fillStyle = C_; px.strokeStyle = C_;
      px.save(); px.translate(30, 898); px.rotate(-0.12); px.font = '400 620px ' + DISP; px.fillText(d.digit, 0, 0); px.restore();
      px.beginPath(); px.arc(KO[0], KO[1], 80, 0, 7); px.fill();
      px.fillRect(1122, 296, 436, 52);
      regMark(1582, 214); regMark(1578, 880); regMark(22, 448);
      px.fillRect(1034, 46, 12, 12);

      // --- A 粉版：日期、竖排副标题 ---
      px.fillStyle = A_; px.strokeStyle = A_;
      px.font = '700 140px ' + DISP;
      px.save(); px.translate(1116, 262); fitText(d.date, 300); px.restore();
      drawVertical(d.vert, 1040, 68, 804);
      regMark(1582, 214); regMark(1578, 880); regMark(22, 448);
      px.fillRect(1034, 14, 12, 12);

      // --- B 蓝版：巨型标题 + 主演 ---
      px.fillStyle = B_; px.strokeStyle = B_;
      px.save(); px.translate(T_X0, titleTop); px.rotate(-T_TILT);
      lay.lines.forEach(function (ln) {
        px.save(); px.font = lay.font(ln.size.toFixed(1)); px.translate(ln.x, ln.y); px.scale(ln.sx, 1); px.fillText(ln.text, 0, 0); px.restore();
      });
      px.restore();
      drawArtist(d.artist, d.empty ? 'TONIGHT' : (d.artistLatin ? '' : 'HEADLINER'));
      regMark(1582, 214); regMark(1578, 880); regMark(22, 448);
      px.fillRect(1034, 30, 12, 12);
      px.globalCompositeOperation = 'source-over';
      upload();
    }

    // ---------- 纸面斑点（纸从墨层里透出来的针孔） ----------
    var speckUrl = '', speckTimer = 0, speckW = 0, speckH = 0;
    function speckSize() { return [Math.min(1920, Math.ceil(VW)), Math.min(1080, Math.ceil(VH))]; }
    // 遮罩按 100% 拉伸，尺寸变化不大（≤12%）时看不出来，不必重新生成
    function speckStale() {
      if (!speckUrl) return true;
      var s = speckSize();
      return Math.abs(s[0] - speckW) > speckW * 0.12 || Math.abs(s[1] - speckH) > speckH * 0.12;
    }
    function scheduleSpeck() {
      if (speckTimer) clearTimeout(speckTimer);
      speckTimer = setTimeout(function () { speckTimer = 0; if (!dead) makeSpeck(); }, speckUrl ? 180 : 0);
    }
    function makeSpeck() {
      var sz = speckSize(), w = sz[0], h = sz[1];
      if (w < 2 || h < 2) return;
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d'), id = x.createImageData(w, h), dd = id.data;
      var G = 48, gw = Math.ceil(w / G) + 2, gh = Math.ceil(h / G) + 2, grid = new Float32Array(gw * gh);
      for (var i = 0; i < grid.length; i++) grid[i] = Math.random();
      for (var y = 0; y < h; y++) {
        var gy = y / G, iy = gy | 0, fy = gy - iy, sy = fy * fy * (3 - 2 * fy);
        for (var xx = 0; xx < w; xx++) {
          var gx = xx / G, ix = gx | 0, fx = gx - ix, sx = fx * fx * (3 - 2 * fx);
          var a = grid[iy * gw + ix], b = grid[iy * gw + ix + 1], cc = grid[(iy + 1) * gw + ix], d2 = grid[(iy + 1) * gw + ix + 1];
          var top = a + (b - a) * sx, n = top + ((cc + (d2 - cc) * sx) - top) * sy;
          var al = 0.07 * n;
          if (Math.random() < 0.035 + 0.07 * n * n) al = 0.35 + 0.5 * Math.random();
          dd[(y * w + xx) * 4 + 3] = al * 255;
        }
      }
      x.putImageData(id, 0, 0);
      c.toBlob(function (blob) {
        if (dead || !blob) return;
        var url = URL.createObjectURL(blob);
        E.speck.style.webkitMaskImage = E.speck.style.maskImage = 'url(' + url + ')';
        E.speck.classList.add('on');
        if (speckUrl) { var old = speckUrl; setTimeout(function () { URL.revokeObjectURL(old); }, 500); }
        speckUrl = url; speckW = w; speckH = h;
      });
    }

    // ---------- WebGL ----------
    var U0 = {}, U1 = {}, U2 = {}, progS = null, progD = null, progSc = null, tex = null, covTex = null, vbuf = null, shaders = [];
    var fbo = [], ftex = [], ready = false;
    var cover = { url: '', has: 0, fit: [0, 0, 1, 1], seed: 0.5, gam: 1, lv: [0, 1], loadId: 0 };
    function sh(t, s) {
      var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); shaders.push(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
      return o;
    }
    function mkProg(fs, names, U) {
      var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      names.forEach(function (n) { U[n] = gl.getUniformLocation(p, n); });
      return p;
    }
    function mkTex() {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    function initGL() {
      progS = mkProg(FS_STATIC, ['uRes', 'uSt', 'uTex', 'oA', 'oB', 'oC', 'uMode'], U0);
      progD = mkProg(FS_DYN, ['uRes', 'uSt', 'uS0', 'uS1', 'uSc', 'uT', 'uMOn', 'uFlash', 'uM', 'oA', 'oB', 'oC', 'uA', 'uB', 'uC', 'uP'], U1);
      progSc = mkProg(FS_SCENE, ['uRes', 'uSt', 'uT', 'uHas', 'uSeed', 'uMove', 'uGam', 'uLv', 'uCov', 'uFit'], U2);
      vbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      tex = mkTex(); covTex = mkTex();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
      for (var i = 0; i < 3; i++) { ftex[i] = mkTex(); fbo[i] = gl.createFramebuffer(); }
      gl.bindTexture(gl.TEXTURE_2D, ftex[2]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SW, SH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[2]); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ftex[2], 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      ready = true;
    }
    function sizeFBO() {
      if (!gl || !ready) return;
      for (var i = 0; i < 2; i++) {
        gl.bindTexture(gl.TEXTURE_2D, ftex[i]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, E.cv.width, E.cv.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ftex[i], 0);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); staticDirty = true;
    }
    function upload() {
      if (!gl || !ready) return;
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pc);
      staticDirty = true;
    }
    function staticPass() {
      gl.useProgram(progS); gl.viewport(0, 0, E.cv.width, E.cv.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U0.uTex, 0);
      gl.uniform2f(U0.uRes, E.cv.width, E.cv.height); gl.uniform4f(U0.uSt, OX, OY, S, DPR);
      gl.uniform2fv(U0.oA, off.A); gl.uniform2fv(U0.oB, off.B); gl.uniform2fv(U0.oC, off.C);
      for (var i = 0; i < 2; i++) { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]); gl.uniform1f(U0.uMode, i); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); staticDirty = false;
    }

    // 封面：按 API 要求用 THREE.TextureLoader（crossOrigin=anonymous）取图，再缩到 ≤512 画进自己的纹理
    function loadCover(url) {
      cover.url = url;
      var id = ++cover.loadId;
      if (!url) { setCoverFallback(); return; }
      var done = function (img) {
        if (dead || id !== cover.loadId) return;
        try {
          var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
          if (!iw || !ih) throw new Error('empty image');
          var k = Math.min(1, 512 / Math.max(iw, ih));
          var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(iw * k)); c.height = Math.max(1, Math.round(ih * k));
          var c2 = c.getContext('2d');
          c2.drawImage(img, 0, 0, c.width, c.height);
          // 自动曝光：把封面平均亮度拉到 ~0.6，暗封面不会印成一整块死黑
          var sm = document.createElement('canvas'); sm.width = sm.height = 16;
          var sg = sm.getContext('2d'); sg.drawImage(c, 0, 0, 16, 16);
          var px16 = sg.getImageData(0, 0, 16, 16).data, ls = [];
          for (var q = 0; q < px16.length; q += 4) ls.push((0.3 * px16[q] + 0.59 * px16[q + 1] + 0.11 * px16[q + 2]) / 255);
          ls.sort(function (x, y) { return x - y; });
          var lo = ls[12], hi = ls[243];
          if (hi - lo < 0.25) { var mid = (hi + lo) / 2; lo = Math.max(0, mid - 0.125); hi = Math.min(1, mid + 0.125); }
          cover.lv = [lo, hi];
          var med = Math.min(0.95, Math.max(0.05, (ls[128] - lo) / (hi - lo)));
          cover.gam = Math.max(0.35, Math.min(1.6, Math.log(0.58) / Math.log(med)));
          if (gl && ready) {
            gl.bindTexture(gl.TEXTURE_2D, covTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
          }
          var RA = (CR[2] - CR[0]) / (CR[3] - CR[1]), IA = iw / ih;
          cover.fit = IA > RA ? [(1 - RA / IA) / 2, 0, RA / IA, 1] : [0, (1 - IA / RA) / 2, 1, IA / RA];
          cover.has = 1;
          once();
        } catch (e) { setCoverFallback(); }
      };
      var fail = function () { if (!dead && id === cover.loadId) setCoverFallback(); };
      try {
        if (typeof THREE !== 'undefined' && THREE.TextureLoader) {
          var loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
          loader.load(url, function (t) { var img = t.image; t.dispose(); done(img); }, undefined, fail);
        } else {
          var img = new Image(); img.crossOrigin = 'anonymous';
          img.onload = function () { done(img); }; img.onerror = fail; img.src = url;
        }
      } catch (e) { fail(); }
    }
    function setCoverFallback() { cover.has = 0; once(); }

    // ---------- 渲染循环 ----------
    var sceneT = 7, mouse = [800, 340], mOn = 0, mTarget = 0, playK = 0, t0 = performance.now(), last = t0;
    var playingNow = false;
    function render(now) {
      if (dead) return;
      var t = (now - t0) / 1000, dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      if (RM) { mOn = mTarget; } else mOn += (mTarget - mOn) * Math.min(1, dt * 6);
      playK += ((playingNow ? 1 : 0) - playK) * Math.min(1, dt * 3);
      flash *= Math.pow(0.02, dt);
      var k = RM ? 1 : Math.min(1, dt * 18);
      ['a', 'b', 'c', 'p'].forEach(function (n) { var tg = hex(pal[n]); for (var i = 0; i < 3; i++) cur[n][i] += (tg[i] - cur[n][i]) * k; });
      if (!gl || !ready || gl.isContextLost()) return;
      if (staticDirty) staticPass();
      if (!RM) sceneT += dt * (1 + playK * 1.6);
      gl.useProgram(progSc); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[2]); gl.viewport(0, 0, SW, SH);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, covTex); gl.uniform1i(U2.uCov, 0);
      gl.uniform1f(U2.uT, sceneT); gl.uniform2f(U2.uRes, SW, SH); gl.uniform4f(U2.uSt, OX, OY, S, DPR);
      gl.uniform1f(U2.uHas, cover.has); gl.uniform1f(U2.uGam, cover.gam); gl.uniform2f(U2.uLv, cover.lv[0], cover.lv[1]); gl.uniform1f(U2.uSeed, cover.seed); gl.uniform1f(U2.uMove, RM ? 0 : 1);
      gl.uniform4f(U2.uFit, cover.fit[0], cover.fit[1], cover.fit[2], cover.fit[3]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(progD); gl.viewport(0, 0, E.cv.width, E.cv.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ftex[0]); gl.uniform1i(U1.uS0, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ftex[1]); gl.uniform1i(U1.uS1, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, ftex[2]); gl.uniform1i(U1.uSc, 2);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(U1.uRes, E.cv.width, E.cv.height); gl.uniform1f(U1.uT, t); gl.uniform4f(U1.uSt, OX, OY, S, DPR);
      gl.uniform2f(U1.uM, mouse[0], mouse[1]); gl.uniform1f(U1.uMOn, mOn);
      gl.uniform3fv(U1.uA, cur.a); gl.uniform3fv(U1.uB, cur.b); gl.uniform3fv(U1.uC, cur.c); gl.uniform3fv(U1.uP, cur.p);
      gl.uniform2fv(U1.oA, off.A); gl.uniform2fv(U1.oB, off.B); gl.uniform2fv(U1.oC, off.C);
      gl.uniform1f(U1.uFlash, flash);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    var raf = 0, lastR = 0, onceRaf = 0;
    function loop(now) { raf = 0; if (dead || paused) return; if (now - lastR > 30) { lastR = now; render(now); } raf = requestAnimationFrame(loop); }
    function start() { if (dead || paused) return; if (RM) { once(); return; } if (!raf) raf = requestAnimationFrame(loop); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; if (onceRaf) cancelAnimationFrame(onceRaf); onceRaf = 0; }
    // 静态模式（reduced motion / 暂停后切换状态）下合并成下一帧只画一次
    function once() {
      if (dead || paused || raf) return;
      if (flat) return;
      if (!onceRaf) onceRaf = requestAnimationFrame(function (n) { onceRaf = 0; last = n; render(n); });
    }

    // ---------- 重新套印：换墨色 + 套准抖动 ----------
    var rpTimer = 0;
    function reprint(i, force) {
      if (i === palIdx && !force) return;
      palIdx = i;
      if (rpTimer) { clearInterval(rpTimer); rpTimer = 0; }
      if (RM || paused) {
        pal = PAL[i]; applyCSS();
        if (flat) drawPlates();
        once(); return;
      }
      var n = 0; flash = 1;
      rpTimer = setInterval(function () {
        if (dead) { clearInterval(rpTimer); rpTimer = 0; return; }
        n++;
        var amp = n < 7 ? 9 - n : 0;
        ['A', 'B', 'C'].forEach(function (p) {
          off[p][0] = REST[p][0] * (1 + Math.random() * 0.8) + (Math.random() - 0.5) * 2 * amp;
          off[p][1] = REST[p][1] * (1 + Math.random() * 0.8) + (Math.random() - 0.5) * 2 * amp;
        });
        if (n === 3) { pal = PAL[palIdx]; applyCSS(); if (flat) drawPlates(); }
        if (n >= 8) {
          clearInterval(rpTimer); rpTimer = 0;
          ['A', 'B', 'C'].forEach(function (p) { off[p][0] = REST[p][0] + (Math.random() - 0.5) * 1.4; off[p][1] = REST[p][1] + (Math.random() - 0.5) * 1.4; });
        }
        applyOff(); once();
      }, 46);
    }
    function finishReprint() {
      if (!rpTimer) return;
      clearInterval(rpTimer); rpTimer = 0;
      pal = PAL[palIdx]; applyCSS();
      ['A', 'B', 'C'].forEach(function (p) { off[p] = REST[p].slice(); });
      applyOff();
    }

    // ---------- 节目单 ----------
    var lineup = [];
    function lineupDefs(m) {
      var n = m.now, lib = m.library || {}, daily = m.daily || {}, disc = m.discover || {}, radio = m.radio || {}, login = m.login || {};
      var recentN = (m.recent || []).length;
      var libItem = { t: '音乐库', e: 'LIBRARY', m: lib.label || '本地音乐', tip: (lib.playlistCount ? lib.playlistCount + ' 张歌单 · ' : '') + (lib.label || ''), a: function () { call('openLibrary'); } };
      var dailyItem = { t: '每日推荐', e: 'DAILY', m: daily.count ? '今日 ' + daily.count + ' 首' : (daily.label || '每日推荐'), tip: daily.label || '', a: function () { call('playDaily', 0); } };
      var recentItem = { t: '最近播放', e: 'RECENT', m: recentN ? recentN + ' 首' : '还没有记录', a: function () { call('playRecent', 0); } };
      var discItem = { t: disc.label || '发现', e: 'DISCOVER', m: disc.sub || '', dim: disc.available === false, a: function () { call('openDiscover'); } };
      var radioItem = { t: radio.label || '电台', e: 'RADIO', m: radio.sub || '', dim: radio.available === false, a: function () { call('openRadio'); } };
      if (n) {
        return [
          { t: '继续播放', e: 'CONTINUE', m: (n.playing ? '正在播放 ' : '停在 ') + fmt(n.position), a: function () { call('resume'); } },
          libItem, dailyItem, recentItem, discItem, radioItem,
        ];
      }
      var opener = login.any
        ? { t: '今晚开场', e: 'OPENER', m: daily.count ? '每日推荐 · ' + daily.count + ' 首' : (daily.label || ''), a: function () { call('playDaily', 0); } }
        : { t: '登录开场', e: 'LOGIN', m: '网易云 · QQ 音乐', a: function () { call('openLogin'); } };
      return [
        opener,
        { t: '导入本地', e: 'IMPORT', m: '本地音乐文件', a: function () { call('importLocal'); } },
        libItem,
        login.any ? recentItem : dailyItem,
        discItem, radioItem,
      ];
    }
    function renderLineup(m) {
      lineup = lineupDefs(m);
      E.lis.forEach(function (li, i) {
        var it = lineup[i], b = E.lineBtns[i];
        txt(b.querySelector('.t'), it.t); txt(b.querySelector('.e'), it.e); txt(b.querySelector('.m'), it.m);
        attr(b, 'title', it.t + ' · ' + (it.tip || it.m));
        li.classList.toggle('dim', !!it.dim);
      });
    }

    // ---------- 为你挑选 ----------
    var actsSig = null, pickItems = [];
    function renderActs(m) {
      var p = m.picks || { items: [] }, items = (p.items || []).slice(0, 4);
      var mode = m.now || items.length ? 'picks' : (m.login && m.login.any ? 'wait' : 'login');
      var sig = mode + '|' + items.map(function (t) { return t.key + '/' + t.title + '/' + t.artist; }).join('|');
      txt(E.src, p.label && items.length ? '来源 · ' + p.label : '');
      attr(E.src, 'title', p.label || '');
      if (sig === actsSig) return;
      actsSig = sig; pickItems = items;
      var html = '';
      if (items.length) {
        items.forEach(function (t, i) {
          html += '<button type="button" data-i="' + i + '" title="' + esc(t.title + ' — ' + t.artist) + '">' + esc(t.title) + '<span>' + esc(t.artist) + '</span></button>';
          if (i < items.length - 1) html += '<i class="sep">✶</i>';
          if (i === 1) html += '<br>';
        });
      } else if (mode === 'login') {
        html = '<div class="hint">登录后，这里会排上为你挑选的暖场曲目。</div>' +
          '<button type="button" class="go" data-go="login">登录网易云 / QQ →</button><i class="sep">✶</i><button type="button" class="go" data-go="import">导入本地 →</button>';
      } else {
        html = '<div class="hint">今天的暖场曲目还在排练。</div><button type="button" class="go" data-go="daily">去每日推荐 →</button>';
      }
      E.acts.innerHTML = html;
    }

    // ---------- update ----------
    var lastPlaying = null, lastKey = null, posFrac = 0, hasDur = false;
    function update(m) {
      if (dead || !m) return;
      model = m;
      var now = m.now, c = m.clock || {}, empty = !now;
      root.classList.toggle('rp-empty', empty);

      // 时间 / 日期
      var wd = WD_CN.indexOf(c.weekday);
      txt(E.dw, wd >= 0 ? WD_EN[wd] : '');
      txt(E.tm, c.time || '');
      txt(E.datecn, cnNum(c.month) + '月' + cnNum(c.day) + '日 · ' + (c.weekday || '') + ' · ' + sessionName(c.time));

      // 印版（标题 / 主演 / 日期 / 竖排字）只在内容变化时重画
      var pd = plateData();
      var psig = [pd.title, pd.vert, pd.artist, pd.date, pd.digit].join('\u0001');
      if (!plateState || psig !== [plateState.title, plateState.vert, plateState.artist, plateState.date, plateState.digit].join('\u0001')) {
        drawPlates();
        if (lastKey !== null) reprint(palIdx, true);
      }
      var key = now ? now.key : '';
      if (key !== lastKey) {
        cover.seed = hashStr(now ? now.title + '|' + now.artist : 'empty');
      }
      lastKey = key;
      var cov = now && now.cover ? String(now.cover) : '';
      if (cov !== cover.url || (!cov && cover.has)) loadCover(cov);

      // 主演横幅 / 专辑行
      if (now) {
        attr(E.hlHit, 'title', '搜索 ' + now.artist);
        txt(E.hlTag, 'SEARCH →');
        // 时长未知（≤0）时不显示，免得出现"单曲 · 0:00"
        var durS = Number(now.duration) > 0 ? fmt(now.duration) : '';
        var tail = (durS ? ' · ' + durS : '') + (now.providerLabel ? ' · ' + now.providerLabel : '');
        var head = (now.album ? '专辑 《' + now.album + '》' : '单曲') + tail;
        if (E.headSub._v !== head) {
          E.headSub._v = head;
          E.headSub.innerHTML = now.album
            ? '专辑 <em>《' + esc(now.album) + '》</em>' + esc(tail)
            : esc(head);
        }
      } else {
        attr(E.hlHit, 'title', m.login && m.login.any ? '从每日推荐开场' : '登录网易云 / QQ 音乐');
        txt(E.hlTag, m.login && m.login.any ? 'PLAY →' : 'LOGIN →');
        var hs = m.login && m.login.any ? '选一首歌开场 · 或导入本地音乐' : '连接网易云 / QQ 音乐，或导入本地音乐 · 今晚的海报由你来印';
        if (E.headSub._v !== hs) { E.headSub._v = hs; E.headSub.textContent = hs; }
      }
      txt(E.luhL, empty ? 'LINEUP · 开场前准备' : 'LINEUP · 今晚节目单');
      renderLineup(m);
      renderActs(m);

      // 票根
      var td = m.today || {};
      txt(E.tkMin, td.minutes || 0);
      txt(E.tkNo, 'Nº ' + String(c.month || 0).padStart(2, '0') + String(c.day || 0).padStart(2, '0'));
      txt(E.tkSeat, 'SEAT ' + (td.count || 0) + ' 首');
      if (td.count) {
        txt(E.tkBig, td.topArtist ? '最常听 ' + td.topArtist : '今日已听');
        txt(E.tkSub, '· ' + td.count + ' 首 · ' + (td.minutes || 0) + ' 分钟');
      } else {
        txt(E.tkBig, empty ? '今天还没开场' : '今天刚开场');
        txt(E.tkSub, '· 0 首 · 0 分钟');
      }
      var nx = m.next;
      if (nx) {
        txt(E.nxT, nx.title); txt(E.nxA, nx.artist); txt(E.nxD, nx.duration ? fmt(nx.duration) : '');
        attr(E.nx, 'title', '下一首：' + nx.title + ' — ' + nx.artist);
      } else if (empty) {
        txt(E.nxT, m.login && m.login.any ? '去每日推荐' : '登录后排上节目'); txt(E.nxA, ''); txt(E.nxD, '');
        attr(E.nx, 'title', m.login && m.login.any ? '播放每日推荐' : '登录');
      } else {
        txt(E.nxT, '队列到头了'); txt(E.nxA, '去每日推荐'); txt(E.nxD, '');
        attr(E.nx, 'title', '播放每日推荐');
      }

      // 播放控件
      var playing = !!(now && now.playing);
      playingNow = playing;
      if (playing !== lastPlaying) {
        E.playIc.innerHTML = playing ? IC_PAUSE : IC_PLAY;
        attr(E.play, 'title', playing ? '暂停' : (now ? '播放' : '开始播放'));
        E.sticker.classList.toggle('fast', playing);
        if (lastPlaying !== null) { E.play.classList.remove('hit'); void E.play.offsetWidth; E.play.classList.add('hit'); flash = Math.max(flash, 0.6); once(); }
        lastPlaying = playing;
      }
      txt(E.ns, empty ? 'NO SHOW · 暂无节目' : (playing ? 'NOW PLAYING · 正在播放' : 'PAUSED · 已暂停'));
      txt(E.nt, now ? now.artist + ' — ' + now.title : (m.login && m.login.any ? '选一首歌开场' : '登录后开始今晚的节目'));
      E.like.classList.toggle('on', !!(now && now.liked));
      attr(E.like, 'title', now && now.liked ? '取消喜欢' : '喜欢');
      E.lyr.classList.toggle('on', !!m.lyricsOn);
      attr(E.lyr, 'title', m.lyricsOn ? '关闭歌词' : '打开歌词');

      var dur = now ? Number(now.duration) || 0 : 0, pos = now ? Math.max(0, Number(now.position) || 0) : 0;
      hasDur = dur > 0;
      posFrac = hasDur ? Math.min(1, pos / dur) : 0;
      var pct = (posFrac * 100).toFixed(2) + '%';
      if (E.fill.style.width !== pct) { E.fill.style.width = pct; E.head.style.left = pct; }
      E.ruler.classList.toggle('off', !hasDur);
      attr(E.ruler, 'aria-valuenow', String(Math.round(posFrac * 100)));
      txt(E.tCur, fmt(pos)); txt(E.tDur, hasDur ? fmt(dur) : '--:--');
      var q = m.quote || {};
      txt(E.qt, q.text ? '「' + q.text + '」' : '');
      attr(E.qt, 'title', q.text ? (q.source ? q.source + ' · ' : '') + '点一下换一句' : '');

      // 贴纸
      if (now) {
        txt(E.stT, fmt(pos)); txt(E.stS, playing ? '播放中' : '继续');
        txt(E.stRing, 'NOW ON MINERADIO · 正在播放 · MINERADIO · 继续 ·');
        attr(E.sticker, 'title', playing ? '暂停' : '继续播放');
      } else {
        txt(E.stT, 'GO'); txt(E.stS, m.login && m.login.any ? '开场' : '登录');
        txt(E.stRing, 'NO SHOW YET · 今晚待开场 · MINERADIO · 等你 ·');
        attr(E.sticker, 'title', m.login && m.login.any ? '开始播放' : '登录');
      }
    }

    // ---------- 交互 ----------
    E.lineBtns.forEach(function (b, i) {
      b.addEventListener('mouseenter', function () { reprint(i); });
      b.addEventListener('focus', function () { reprint(i); });
      b.addEventListener('click', function () {
        E.lis.forEach(function (l) { l.classList.remove('on'); });
        E.lis[i].classList.add('on');
        if (lineup[i]) lineup[i].a();
      });
    });
    E.acts.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-i')) {
        [].forEach.call(E.acts.querySelectorAll('button[data-i]'), function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        call('playPick', Number(b.getAttribute('data-i')) || 0);
      } else {
        var g = b.getAttribute('data-go');
        if (g === 'login') call('openLogin'); else if (g === 'import') call('importLocal'); else call('playDaily', 0);
      }
    });
    E.nx.addEventListener('click', function () {
      var m = model || {};
      if (m.next) call('next');
      else if (!m.now && !(m.login && m.login.any)) call('openLogin');
      else call('playDaily', 0);
    });
    E.hlHit.addEventListener('click', function () {
      var m = model || {};
      if (m.now) call('search', m.now.artist || '');
      else if (m.login && m.login.any) call('playDaily', 0);
      else call('openLogin');
    });
    root.querySelector('.title-hit').addEventListener('click', function () { var m = model || {}; if (m.now) call('openImmersive'); else call('resume'); });
    E.play.addEventListener('click', function () { var m = model || {}; if (m.now) call('togglePlay'); else call('resume'); });
    E.prev.addEventListener('click', function () { call('prev'); });
    E.next.addEventListener('click', function () { call('next'); });
    E.like.addEventListener('click', function () { call('toggleLike'); });
    E.lyr.addEventListener('click', function () { call('toggleLyrics'); });
    function stickerAct() {
      var m = model || {};
      if (m.now) { if (m.now.playing) call('togglePlay'); else call('resume'); }
      else if (m.login && m.login.any) call('resume');
      else call('openLogin');
    }
    E.sticker.addEventListener('click', stickerAct);
    E.sticker.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stickerAct(); } });
    E.qt.addEventListener('click', function () { call('nextQuote'); });
    function rulerFrac(e) { var r = E.ruler.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1))); }
    E.ruler.addEventListener('click', function (e) { if (!hasDur) return; call('seek', rulerFrac(e)); });
    E.ruler.addEventListener('pointermove', function (e) { E.ghost.style.left = (rulerFrac(e) * 100).toFixed(2) + '%'; });
    E.ruler.addEventListener('keydown', function (e) {
      if (!hasDur) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); call('seek', Math.max(0, Math.min(1, posFrac + (e.key === 'ArrowLeft' ? -0.02 : 0.02)))); }
    });
    E.q.addEventListener('keydown', function (e) {
      e.stopPropagation(); // 输入时不要触发宿主的快捷键
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); call('search', E.q.value.trim()); }
      else if (e.key === 'Escape') { E.q.value = ''; E.q.blur(); }
    });
    E.q.addEventListener('keyup', function (e) { e.stopPropagation(); });

    // 鼠标 → 网点放大镜
    function onMove(e) {
      var r = root.getBoundingClientRect();
      mouse = [(e.clientX - r.left - OX) / S, (e.clientY - r.top - OY) / S];
      var inside = mouse[0] > CR[0] - 18 && mouse[0] < CR[2] + 50 && mouse[1] > CR[1] - 20 && mouse[1] < CR[3] + 18;
      mTarget = inside ? 1 : 0.25;
      if (RM) once();
    }
    function onLeave() { mTarget = 0; if (RM) once(); }
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);

    // WebGL 上下文丢失 / 恢复
    function onLost(e) { e.preventDefault(); ready = false; stop(); }
    function onRestored() {
      if (dead) return;
      try { shaders = []; initGL(); sizeFBO(); upload(); var u = cover.url; cover.url = ''; loadCover(u); start(); once(); } catch (err) {
        console.warn('[riso-poster] restore', err);
        dropGL(); useFlat(); drawPlates();
      }
    }
    // 放弃 WebGL：摘掉监听、释放上下文
    function dropGL() {
      if (!gl) return;
      E.cv.removeEventListener('webglcontextlost', onLost); E.cv.removeEventListener('webglcontextrestored', onRestored);
      try { var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (_e) { }
      gl = null; ready = false;
    }
    if (gl) { E.cv.addEventListener('webglcontextlost', onLost); E.cv.addEventListener('webglcontextrestored', onRestored); }

    // ---------- 启动 ----------
    // 着色器编译失败时改用 2D 平面版，不然海报是一片空白
    if (gl) { try { initGL(); } catch (err) { console.warn('[riso-poster] GL init', err); dropGL(); useFlat(); } }
    applyOff(); applyCSS();
    try { model = ctx.model ? ctx.model() : null; } catch (_e) { model = null; }
    layout();
    if (model) update(model);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (dead) return; titleCache = null; drawPlates(); once(); });
    }
    start(); once();

    return {
      update: update,
      resize: function (w, h) { if (dead) return; layout(w, h); once(); },
      pause: function () {
        if (dead || paused) return;
        paused = true; stop(); finishReprint();
        if (speckTimer) { clearTimeout(speckTimer); speckTimer = 0; }
        root.classList.add('rp-paused');
      },
      resume: function () {
        if (dead || !paused) return;
        paused = false; root.classList.remove('rp-paused');
        last = performance.now();
        measureRoot();
        if (Math.round(VW * DPR) !== (flat ? pc.width : E.cv.width) || Math.round(VH * DPR) !== (flat ? pc.height : E.cv.height)) layout();
        // 暂停时可能把还没跑的斑点生成取消了，这里补上
        if (speckStale()) scheduleSpeck();
        start(); once();
      },
      destroy: function () {
        if (dead) return;
        dead = true; stop();
        if (rpTimer) clearInterval(rpTimer); rpTimer = 0;
        if (speckTimer) clearTimeout(speckTimer); speckTimer = 0;
        timers.forEach(clearTimeout); timers = [];
        cover.loadId++;
        root.removeEventListener('pointermove', onMove);
        root.removeEventListener('pointerleave', onLeave);
        if (gl) {
          E.cv.removeEventListener('webglcontextlost', onLost); E.cv.removeEventListener('webglcontextrestored', onRestored);
          try {
            if (!gl.isContextLost()) {
              ftex.concat([tex, covTex]).forEach(function (t) { if (t) gl.deleteTexture(t); });
              fbo.forEach(function (f) { if (f) gl.deleteFramebuffer(f); });
              [progS, progD, progSc].forEach(function (p) { if (p) gl.deleteProgram(p); });
              shaders.forEach(function (s) { gl.deleteShader(s); });
              if (vbuf) gl.deleteBuffer(vbuf);
            }
            var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
          } catch (_e) { }
          gl = null;
        }
        if (speckUrl) { URL.revokeObjectURL(speckUrl); speckUrl = ''; }
        pc.width = pc.height = 0;
        root.classList.remove('rp-paused', 'rp-rm', 'rp-empty');
        ['--ia', '--ib', '--ic', '--paper', '--ax', '--ay', '--bx', '--by', '--cx', '--cy'].forEach(function (k) { root.style.removeProperty(k); });
        root.innerHTML = '';
      },
    };
  }

  // ---------------- 播放页背景：深蓝油墨底 + 错版的粉/黄网点，纸纤维颗粒（3D 粒子叠在上面） ----------------
  var BACKDROP = {
    css: [
      '#hth-backdrop.hbd-riso-poster{background:radial-gradient(120% 90% at 30% 20%,rgba(30,44,92,.92),rgba(14,20,46,.95) 55%,rgba(8,11,26,.97))}',
      '#hth-backdrop.hbd-riso-poster .hbd-dots{position:absolute;left:-20%;top:-20%;width:140%;height:140%;will-change:transform}',
      '#hth-backdrop.hbd-riso-poster .hbd-dots.p{background-image:radial-gradient(circle,rgba(255,61,154,.34) 0 1.3px,transparent 1.9px);background-size:10px 10px;-webkit-mask-image:radial-gradient(38% 42% at 70% 36%,#000,transparent 72%);mask-image:radial-gradient(38% 42% at 70% 36%,#000,transparent 72%);animation:hbd-rp-a 90s ease-in-out infinite alternate}',
      '#hth-backdrop.hbd-riso-poster .hbd-dots.y{background-image:radial-gradient(circle,rgba(255,217,46,.22) 0 1.2px,transparent 1.8px);background-size:12px 12px;transform:rotate(15deg);-webkit-mask-image:radial-gradient(34% 40% at 30% 70%,#000,transparent 72%);mask-image:radial-gradient(34% 40% at 30% 70%,#000,transparent 72%);animation:hbd-rp-b 110s ease-in-out infinite alternate}',
      '#hth-backdrop.hbd-riso-poster .hbd-fiber{position:absolute;inset:0;opacity:.07;mix-blend-mode:screen;background-size:300px 300px}',
      '#hth-backdrop.hbd-riso-poster .hbd-edge{position:absolute;inset:0;box-shadow:inset 0 0 160px rgba(0,0,0,.55)}',
      '@keyframes hbd-rp-a{from{transform:translate3d(-2%,-1%,0)}to{transform:translate3d(3%,2%,0)}}',
      '@keyframes hbd-rp-b{from{transform:rotate(15deg) translate3d(2%,1%,0)}to{transform:rotate(15deg) translate3d(-3%,-2%,0)}}',
      '@media (prefers-reduced-motion:reduce){#hth-backdrop.hbd-riso-poster .hbd-dots{animation:none}}',
    ].join('\n'),
    html: '<div class="hbd-dots y"></div><div class="hbd-dots p"></div><div class="hbd-fiber"></div><div class="hbd-edge"></div>',
    build: function (box) {
      try {
        var c = document.createElement('canvas'); c.width = c.height = 300;
        var g = c.getContext('2d');
        var seed = 99173, r = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
        g.fillStyle = '#000'; g.fillRect(0, 0, 300, 300);
        g.lineCap = 'round';
        for (var i = 0; i < 420; i++) {
          var x = r() * 300, y = r() * 300, a = r() * Math.PI, l = 3 + r() * 14;
          g.strokeStyle = 'rgba(241,234,219,' + (0.2 + r() * 0.5).toFixed(2) + ')'; g.lineWidth = 0.5 + r() * 0.7;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 4, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 4, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
        }
        var el = box.querySelector('.hbd-fiber'); if (el) el.style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')';
      } catch (_e) { }
    },
  };

  registerHomeTheme({
    id: ID,
    name: '孔版海报',
    cordColor: 'rgba(42,76,156,.88)',
    cordGlow: 'rgba(255,61,154,.38)',
    backdrop: BACKDROP,
    chrome: 'light',
    create: createRiso,
  });
})();
