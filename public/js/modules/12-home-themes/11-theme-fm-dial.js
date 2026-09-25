// ============================================================
// Home theme · 调频 (fm-dial)
// 一台暖色调的调频收音机：底部刻度盘选台，每个"电台"是主页的一个入口。
// 调台时不做雪花/撕裂/乱码，而是像镜头对焦：离台越远文字越虚，
// 到达中点时换字，再慢慢对焦清晰；极光在两个电台的颜色之间柔和过渡。
// ============================================================
(function () {
  'use strict';

  var ID = 'fm-dial';
  var FMIN = 87.5, FMAX = 108.0;
  var STATIONS = [
    { id: 'cont', f: 88.7, n: '继续播放', en: 'CONTINUE', pal: ['#ff7454', '#d0368f', '#3a2a8a'] },
    { id: 'daily', f: 92.6, n: '每日推荐', en: 'DAILY', pal: ['#2fe6c0', '#3a74ff', '#0f3a48'] },
    { id: 'rec', f: 96.8, n: '最近播放', en: 'RECENT', pal: ['#a878ff', '#ff5aa8', '#2a1c5c'] },
    { id: 'lib', f: 100.9, n: '音乐库', en: 'LIBRARY', pal: ['#ffc15a', '#9be05a', '#3a2a10'] },
    { id: 'disc', f: 104.3, n: '发现', en: 'DISCOVER', pal: ['#ff3f5a', '#ff9a3a', '#4a1020'] },
    { id: 'radio', f: 107.1, n: '电台', en: 'RADIO', pal: ['#5ab8ff', '#6affd6', '#10284a'] },
  ];
  var EN_WD = { '星期日': 'SUN', '星期一': 'MON', '星期二': 'TUE', '星期三': 'WED', '星期四': 'THU', '星期五': 'FRI', '星期六': 'SAT' };

  // ---------------- 小工具 ----------------
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mmss(s) { s = Math.max(0, Math.floor(Number(s) || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function mss(s) { return mmss(s).replace(/^0(?=\d:)/, ''); }
  function hash(str) { var h = 2166136261; str = String(str || ''); for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function hex2v(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  function v2hex(v) { return '#' + v.map(function (x) { return ('0' + Math.round(clamp(x, 0, 1) * 255).toString(16)).slice(-2); }).join(''); }
  function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb2hsl(c) {
    var r = c[0], g = c[1], b = c[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) {
      var d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6;
    }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    function f(n) { var k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }
    return [f(0), f(8), f(4)];
  }
  function vivid(c) { var h = rgb2hsl(c); return hsl2rgb(h[0], Math.max(h[1], 0.55), clamp(h[2], 0.46, 0.62)); }
  function rgba(v, a) { return 'rgba(' + Math.round(v[0] * 255) + ',' + Math.round(v[1] * 255) + ',' + Math.round(v[2] * 255) + ',' + a + ')'; }
  function rng(seed) { var s = (seed * 2654435761) >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  // ---------------- 兜底封面：按歌名 hash 生成"夜色电台"风格小画 ----------------
  // 模块级缓存：限制条数，最旧的先丢（每首歌每个尺寸一张 dataURL，不设上限会一直涨）
  var FB_MAX = 60;
  var fbCache = Object.create(null), fbOrder = [];
  function fbKeyOf(track) { return (track && (track.key || track.title)) || 'mineradio'; }
  // 兜底封面的主色只由歌名 hash 决定，直接算，不用缓存
  function fbTintOf(track) { var hs = hash(fbKeyOf(track)); return hsl2rgb((hs % 360) / 360, 0.9, 0.66); }
  function fallbackCover(track, size) {
    size = size || 160;
    var key = fbKeyOf(track);
    var ck = key + '@' + size;
    if (fbCache[ck]) return fbCache[ck];
    var hs = hash(key), r = rng(hs % 100000 + 7), hue = (hs % 360) / 360;
    var c1 = hsl2rgb(hue, 0.9, 0.66), c2 = hsl2rgb((hue + 0.1) % 1, 0.7, 0.5), c3 = hsl2rgb((hue + 0.6) % 1, 0.45, 0.2), bg = hsl2rgb((hue + 0.62) % 1, 0.5, 0.04);
    var c = document.createElement('canvas'); c.width = c.height = size;
    var g = c.getContext('2d');
    g.fillStyle = rgba(bg, 1); g.fillRect(0, 0, size, size);
    var type = (hs >>> 9) % 3;
    if (type === 0) {
      var hy = size * (0.54 + r() * 0.12);
      var sky = g.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, rgba(bg, 1)); sky.addColorStop(0.35, rgba(c3, 1)); sky.addColorStop(0.78, rgba(c2, 1)); sky.addColorStop(1, rgba(c1, 1));
      g.fillStyle = sky; g.fillRect(0, 0, size, hy);
      var sx = size * (0.32 + r() * 0.36), sy = hy - size * 0.04;
      var sun = g.createRadialGradient(sx, sy, 0, sx, sy, size * 0.35);
      sun.addColorStop(0, 'rgba(255,240,215,.95)'); sun.addColorStop(0.18, rgba(c1, 0.8)); sun.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sun; g.fillRect(0, 0, size, size);
      var sea = g.createLinearGradient(0, hy, 0, size);
      sea.addColorStop(0, rgba(c2, 0.9)); sea.addColorStop(0.25, rgba(c3, 1)); sea.addColorStop(1, rgba(bg, 1));
      g.fillStyle = sea; g.fillRect(0, hy, size, size - hy);
      g.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 120; i++) {
        var k = Math.pow(r(), 1.6), y = hy + k * (size - hy), w = size * (0.01 + r() * 0.09) * (1.2 - k);
        g.fillStyle = 'rgba(255,' + (190 + r() * 60 | 0) + ',' + (150 + r() * 80 | 0) + ',' + ((0.5 - k * 0.45) * r()).toFixed(3) + ')';
        g.fillRect(sx + (r() - 0.5) * size * (0.12 + k * 0.9) - w / 2, y, w, Math.max(1, size * 0.004));
      }
      g.globalCompositeOperation = 'source-over';
    } else if (type === 1) {
      var bgr = g.createLinearGradient(0, 0, size, size); bgr.addColorStop(0, rgba(c3, 1)); bgr.addColorStop(1, rgba(bg, 1));
      g.fillStyle = bgr; g.fillRect(0, 0, size, size);
      g.globalCompositeOperation = 'lighter';
      for (var j = 0; j < 22; j++) {
        var bx = r() * size, by = size * (0.15 + r() * 0.75), rad = size * (j < 8 ? 0.12 + r() * 0.16 : 0.02 + r() * 0.06);
        var col = r() < 0.5 ? c1 : c2;
        var gr = g.createRadialGradient(bx, by, rad * 0.2, bx, by, rad);
        gr.addColorStop(0, rgba(col, 0.3)); gr.addColorStop(0.85, rgba(col, j < 8 ? 0.16 : 0.42)); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(bx, by, rad, 0, 7); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    } else {
      var bg2 = g.createRadialGradient(size * 0.3, size * 0.3, 0, size * 0.5, size * 0.5, size * 0.8); bg2.addColorStop(0, rgba(c3, 1)); bg2.addColorStop(1, rgba(bg, 1));
      g.fillStyle = bg2; g.fillRect(0, 0, size, size);
      g.globalCompositeOperation = 'lighter';
      var ph = r() * 6, fr = 1.5 + r() * 2;
      for (var b = 0; b < 5; b++) {
        g.beginPath();
        var off = size * (0.2 + b * 0.13), amp = size * (0.06 + r() * 0.1);
        for (var x = -10; x <= size + 10; x += 4) { var yy = off + Math.sin(x / size * fr * 3.14 + ph + b * 0.7) * amp; if (x < 0) g.moveTo(x, yy); else g.lineTo(x, yy); }
        g.strokeStyle = rgba(b % 2 ? c1 : c2, 0.34 - b * 0.04); g.lineWidth = size * (0.05 + r() * 0.06); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
    }
    var vg = g.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = vg; g.fillRect(0, 0, size, size);
    var url = '';
    try { url = c.toDataURL('image/jpeg', 0.88); } catch (_e) { url = ''; }
    if (url) {
      fbCache[ck] = url; fbOrder.push(ck);
      while (fbOrder.length > FB_MAX) delete fbCache[fbOrder.shift()];
    }
    return url;
  }

  // ---------------- CSS ----------------
  var P = '.hth-' + ID;
  var CSS = [
    P + '{--u:min(calc(100vw / 1600),calc(100vh / 900));--acc:#ff8a4c;--acc2:#ff4f7a;--amber:#ffb46a;--amber-dim:rgba(255,180,106,.42);--ink:#fff1e2;--ink-dim:rgba(255,236,214,.58);--ink-faint:rgba(255,236,214,.4);',
    '--hei:"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif;--song:"SimSun","宋体","STSong","Noto Serif CJK SC",serif;--kai:"KaiTi","楷体","STKaiti","AR PL UKai CN",serif;',
    '--cond:"Bahnschrift Condensed","Bahnschrift SemiCondensed","Arial Narrow","DejaVu Sans Condensed",Impact,sans-serif;--mono:Consolas,"Cascadia Mono","DejaVu Sans Mono",monospace;',
    'background:#050306;color:var(--ink);font-family:var(--hei);-webkit-font-smoothing:antialiased;user-select:none;overflow:hidden}',
    P + ' *{box-sizing:border-box;margin:0;padding:0}',
    P + ' button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;text-align:left;outline:none}',
    P + ' button:focus-visible{box-shadow:0 0 0 1px var(--amber)}',
    P + ' .fm-gl{position:absolute;inset:0;width:100%;height:100%;display:block}',
    P + ' .fm-grain{position:absolute;inset:0;pointer-events:none;z-index:5;opacity:.05;mix-blend-mode:screen;background-size:256px 256px}',
    P + ' .fm-ui{position:absolute;inset:0;z-index:2}',
    // top strip — 左侧避开拉绳，右侧给宿主按钮留 150px
    P + ' .fm-top{position:absolute;left:110px;right:var(--hth-safe-r,300px);top:calc(var(--u)*28);height:calc(var(--u)*58);display:flex;align-items:center;justify-content:space-between;gap:calc(var(--u)*24)}',
    P + ' .fm-brand{display:flex;align-items:center;gap:calc(var(--u)*16);flex:none}',
    P + ' .fm-mark{font-family:var(--cond);font-weight:700;letter-spacing:.34em;font-size:calc(var(--u)*17);color:var(--ink);text-shadow:0 0 calc(var(--u)*10) rgba(255,170,110,.35)}',
    P + ' .fm-mark i{font-style:normal;color:var(--amber)}',
    P + ' .fm-leds{display:flex;gap:calc(var(--u)*14);font-family:var(--mono);font-size:calc(var(--u)*10.5);letter-spacing:.18em;color:var(--ink-faint)}',
    P + ' .fm-led{display:flex;align-items:center;gap:calc(var(--u)*6);transition:color .6s ease}',
    P + ' .fm-led::before{content:"";width:calc(var(--u)*6);height:calc(var(--u)*6);border-radius:50%;background:#3a1a12;box-shadow:inset 0 0 2px #000;transition:background .6s ease,box-shadow .6s ease}',
    P + ' .fm-led.on{color:var(--amber)}',
    P + ' .fm-led.on::before{background:#ff5a2e;box-shadow:0 0 calc(var(--u)*8) #ff5a2e,0 0 calc(var(--u)*2) #ffc7a6}',
    P + ' .fm-seek{position:relative;display:flex;align-items:center;height:calc(var(--u)*40);width:calc(var(--u)*430);min-width:0;flex:0 1 auto;border-radius:calc(var(--u)*3);cursor:text;background:linear-gradient(180deg,rgba(0,0,0,.55),rgba(20,10,8,.35));box-shadow:inset 0 1px 0 rgba(255,255,255,.04),inset 0 0 0 1px rgba(255,190,140,.12),inset 0 calc(var(--u)*6) calc(var(--u)*16) rgba(0,0,0,.6);transition:box-shadow .25s}',
    P + ' .fm-seek:hover,' + P + ' .fm-seek.focus{box-shadow:inset 0 1px 0 rgba(255,255,255,.05),inset 0 0 0 1px rgba(255,180,106,.45),0 0 calc(var(--u)*22) rgba(255,140,70,.18),inset 0 calc(var(--u)*6) calc(var(--u)*16) rgba(0,0,0,.6)}',
    P + ' .fm-tag{height:100%;display:flex;align-items:center;padding:0 calc(var(--u)*14);font-size:calc(var(--u)*13);letter-spacing:.2em;color:#1b0b04;background:var(--amber);border-radius:calc(var(--u)*3) 0 0 calc(var(--u)*3);font-weight:700;box-shadow:0 0 calc(var(--u)*14) rgba(255,160,90,.55);transition:background .2s;cursor:pointer;flex:none}',
    P + ' .fm-tag:hover{background:#ffd2a0}',
    P + ' .fm-seek svg{width:calc(var(--u)*15);height:calc(var(--u)*15);margin:0 calc(var(--u)*10) 0 calc(var(--u)*14);opacity:.6;flex:none;color:var(--ink)}',
    P + ' .fm-seek input{flex:1;min-width:0;background:none;border:0;outline:0;color:var(--amber);font-family:var(--hei);font-size:calc(var(--u)*14);letter-spacing:.06em;text-shadow:0 0 calc(var(--u)*8) rgba(255,160,90,.45);caret-color:var(--amber)}',
    P + ' .fm-seek input::placeholder{color:rgba(255,190,140,.38)}',
    P + ' .fm-scan{font-family:var(--mono);font-size:calc(var(--u)*10);letter-spacing:.2em;color:var(--ink-faint);padding:0 calc(var(--u)*14);flex:none}',
    P + ' .fm-vfd{display:flex;align-items:center;gap:calc(var(--u)*16);padding:calc(var(--u)*6) calc(var(--u)*16);border-radius:calc(var(--u)*3);flex:none;background:linear-gradient(180deg,rgba(4,10,9,.7),rgba(2,6,6,.5));box-shadow:inset 0 0 0 1px rgba(120,255,220,.08),inset 0 calc(var(--u)*4) calc(var(--u)*14) rgba(0,0,0,.8);transition:box-shadow .25s}',
    P + ' .fm-vfd:hover{box-shadow:inset 0 0 0 1px rgba(120,255,220,.25),0 0 calc(var(--u)*20) rgba(90,255,210,.12),inset 0 calc(var(--u)*4) calc(var(--u)*14) rgba(0,0,0,.8)}',
    P + ' .fm-time{font-family:var(--mono);font-size:calc(var(--u)*30);letter-spacing:.06em;color:#9dffe6;text-shadow:0 0 calc(var(--u)*6) rgba(80,255,210,.9),0 0 calc(var(--u)*18) rgba(80,255,210,.45);white-space:nowrap}',
    P + ' .fm-time b{font-weight:400}',
    P + ' .fm-date{display:flex;flex-direction:column;gap:calc(var(--u)*3);font-size:calc(var(--u)*12);color:rgba(157,255,230,.7);text-shadow:0 0 calc(var(--u)*6) rgba(80,255,210,.5);letter-spacing:.08em;white-space:nowrap}',
    P + ' .fm-date span:last-child{font-family:var(--mono);font-size:calc(var(--u)*10);letter-spacing:.24em;color:rgba(157,255,230,.42)}',
    // hero
    P + ' .fm-hero{position:absolute;left:max(5.2vw,104px);top:calc(var(--u)*118);width:calc(var(--u)*760);height:calc(var(--u)*430);pointer-events:none;perspective:calc(var(--u)*900);perspective-origin:30% 55%}',
    P + ' .fm-ghost{position:absolute;left:calc(var(--u)*-10);top:calc(var(--u)*-18);font-family:var(--cond);font-weight:700;font-size:calc(var(--u)*300);line-height:1;letter-spacing:-.01em;color:transparent;-webkit-text-stroke:calc(var(--u)*1.2) rgba(255,210,170,.15);white-space:nowrap;will-change:filter,opacity}',
    P + ' .fm-freqline{position:absolute;left:0;top:calc(var(--u)*196);display:flex;align-items:center;gap:calc(var(--u)*14);font-family:var(--mono);font-size:calc(var(--u)*12);letter-spacing:.3em;color:var(--amber);text-shadow:0 0 calc(var(--u)*8) rgba(255,150,80,.6);white-space:nowrap}',
    P + ' .fm-freqline .fm-bar{width:calc(var(--u)*46);height:1px;background:linear-gradient(90deg,var(--amber),transparent)}',
    P + ' .fm-fcode{transition:color .5s ease,text-shadow .5s ease}',
    P + ' .fm-fcode.scan{color:var(--ink-faint);text-shadow:none}',
    P + ' .fm-name{position:absolute;left:calc(var(--u)*-6);top:calc(var(--u)*218);font-family:var(--hei);font-weight:900;font-size:calc(var(--u)*148);line-height:1;letter-spacing:-.02em;white-space:nowrap;transform-origin:0 60%;color:var(--ink);text-shadow:0 0 calc(var(--u)*28) var(--acc),0 0 calc(var(--u)*80) var(--acc2);will-change:transform,filter,opacity}',
    P + ' .fm-name span{display:inline-block;transform:scaleX(.84);transform-origin:0 50%}',
    P + ' .fm-sub{position:absolute;left:0;top:calc(var(--u)*388);display:flex;align-items:baseline;gap:calc(var(--u)*18);white-space:nowrap;max-width:calc(var(--u)*720);will-change:filter,opacity}',
    P + ' .fm-en{font-family:var(--cond);font-weight:700;font-size:calc(var(--u)*20);letter-spacing:.42em;color:var(--ink-dim);flex:none}',
    P + ' .fm-rds{pointer-events:auto;display:flex;align-items:baseline;min-width:0;font-family:var(--kai);font-size:calc(var(--u)*17);color:var(--ink-dim);letter-spacing:.06em;padding:calc(var(--u)*2) calc(var(--u)*6);margin-left:calc(var(--u)*-6);border-radius:calc(var(--u)*2);transition:color .25s,background .25s}',
    P + ' .fm-rds:hover{color:var(--ink);background:rgba(255,160,90,.07)}',
    P + ' .fm-rds i{font-style:normal;font-family:var(--mono);font-size:calc(var(--u)*10);letter-spacing:.24em;color:var(--amber);margin-right:calc(var(--u)*10);padding:calc(var(--u)*2) calc(var(--u)*5);box-shadow:inset 0 0 0 1px var(--amber-dim);flex:none;position:relative;top:calc(var(--u)*-2)}',
    P + ' .fm-rds span{overflow:hidden;text-overflow:ellipsis;min-width:0}',
    // programme (right)
    P + ' .fm-prog{position:absolute;right:5.2vw;top:calc(var(--u)*150);width:calc(var(--u)*540);height:calc(var(--u)*385);will-change:opacity,filter,transform}',
    P + ' .fm-hd{display:flex;justify-content:space-between;align-items:center;gap:calc(var(--u)*16);font-family:var(--mono);font-size:calc(var(--u)*10.5);letter-spacing:.24em;color:var(--ink-faint);padding-bottom:calc(var(--u)*10);border-bottom:1px solid rgba(255,220,190,.1);white-space:nowrap}',
    P + ' .fm-hd span{overflow:hidden;text-overflow:ellipsis;min-width:0}',
    P + ' .fm-hd b{font-weight:400;color:var(--amber);flex:none}',
    P + ' .fm-np{display:flex;gap:calc(var(--u)*26);margin-top:calc(var(--u)*24)}',
    P + ' .fm-plate{position:relative;flex:none;width:calc(var(--u)*168);height:calc(var(--u)*168);cursor:pointer}',
    P + ' .fm-plate>img{width:100%;height:100%;display:block;object-fit:cover;border-radius:calc(var(--u)*2);box-shadow:0 0 0 1px rgba(255,255,255,.06),0 calc(var(--u)*20) calc(var(--u)*50) rgba(0,0,0,.6),0 0 calc(var(--u)*60) color-mix(in srgb,var(--acc) 30%,transparent);transition:transform .35s,box-shadow .35s}',
    P + ' .fm-plate:hover>img{transform:translateY(calc(var(--u)*-3));box-shadow:0 0 0 1px rgba(255,200,160,.35),0 calc(var(--u)*24) calc(var(--u)*50) rgba(0,0,0,.6),0 0 calc(var(--u)*80) color-mix(in srgb,var(--acc) 50%,transparent)}',
    P + ' .fm-plate .fm-pi{position:absolute;left:50%;top:50%;width:calc(var(--u)*54);height:calc(var(--u)*54);margin:calc(var(--u)*-27) 0 0 calc(var(--u)*-27);border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(10,5,4,.55);box-shadow:0 0 0 1px rgba(255,200,160,.4);color:var(--amber);opacity:0;transition:opacity .25s}',
    P + ' .fm-plate:hover .fm-pi{opacity:1}',
    P + ' .fm-pi svg{width:calc(var(--u)*18);height:calc(var(--u)*18)}',
    P + ' .fm-refl{position:absolute;left:0;right:0;top:calc(100% + var(--u)*4);height:calc(var(--u)*46);overflow:hidden;opacity:.2;-webkit-mask-image:linear-gradient(180deg,#000,transparent);mask-image:linear-gradient(180deg,#000,transparent);pointer-events:none}',
    P + ' .fm-refl img{width:100%;height:calc(var(--u)*168);object-fit:cover;transform:scaleY(-1);filter:blur(2px);display:block}',
    P + ' .fm-meta{flex:1;min-width:0;display:flex;flex-direction:column}',
    // 歌名：中文照常逐字换行，英文单词只有一行放不下时才拆（原来 break-all 会把单词从中间断开）
    P + ' .fm-title{font-family:var(--song);font-weight:700;font-size:calc(var(--u)*30);line-height:1.22;color:var(--ink);letter-spacing:.02em;text-shadow:0 0 calc(var(--u)*16) rgba(255,190,140,.25);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:break-word;line-break:strict}',
    P + ' .fm-title[data-act]{cursor:pointer;transition:color .2s,text-shadow .2s}',
    P + ' .fm-title[data-act]:hover{color:#fff;text-shadow:0 0 calc(var(--u)*22) rgba(255,170,110,.6)}',
    P + ' .fm-title[data-act]::after{content:"  ⤢ 沉浸";font-family:var(--mono);font-size:calc(var(--u)*11);letter-spacing:.2em;color:var(--amber);opacity:0;transition:opacity .2s}',
    P + ' .fm-title[data-act]:hover::after{opacity:.9}',
    P + ' .fm-l1 .s{cursor:pointer;transition:color .2s,text-shadow .2s}',
    P + ' .fm-l1 .s:hover{color:#fff;text-shadow:0 0 10px rgba(255,170,110,.7)}',
    P + ' .fm-who{margin-top:calc(var(--u)*8);font-size:calc(var(--u)*14);color:var(--ink-dim);letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    P + ' .fm-who i{font-style:normal;color:var(--ink-faint);margin:0 calc(var(--u)*8)}',
    P + ' .fm-tc{margin-top:auto;padding-top:calc(var(--u)*8);font-family:var(--mono);font-size:calc(var(--u)*12);color:var(--ink-dim);letter-spacing:.12em}',
    P + ' .fm-rail{position:relative;height:calc(var(--u)*18);margin:calc(var(--u)*6) 0 calc(var(--u)*4);cursor:pointer;background:repeating-linear-gradient(90deg,rgba(255,220,190,.22) 0 1px,transparent 1px calc(var(--u)*6));-webkit-mask-image:linear-gradient(180deg,transparent 30%,#000 30%,#000 70%,transparent 70%);mask-image:linear-gradient(180deg,transparent 30%,#000 30%,#000 70%,transparent 70%);transition:filter .2s}',
    P + ' .fm-rail:hover{filter:brightness(1.5)}',
    P + ' .fm-rail i{position:absolute;left:0;top:0;bottom:0;background:repeating-linear-gradient(90deg,var(--amber) 0 1px,transparent 1px calc(var(--u)*6));filter:drop-shadow(0 0 3px var(--amber))}',
    P + ' .fm-tc .fm-row{display:flex;justify-content:space-between}',
    P + ' .fm-tc .fm-row b{font-weight:400;color:var(--amber);text-shadow:0 0 6px rgba(255,150,80,.6)}',
    P + ' .fm-cta{display:inline-flex;align-items:center;gap:calc(var(--u)*10);margin-top:calc(var(--u)*14);height:calc(var(--u)*34);padding:0 calc(var(--u)*16);font-size:calc(var(--u)*13);letter-spacing:.14em;color:#1a0904;background:var(--amber);border-radius:calc(var(--u)*2);box-shadow:0 0 calc(var(--u)*18) rgba(255,150,80,.45),inset 0 -2px 0 rgba(0,0,0,.2);transition:background .2s,box-shadow .2s;align-self:flex-start;white-space:nowrap;flex:none}',
    P + ' .fm-cta:hover{background:#ffd2a0;box-shadow:0 0 calc(var(--u)*30) rgba(255,160,90,.75),inset 0 -2px 0 rgba(0,0,0,.2)}',
    P + ' .fm-cta.ghost{background:transparent;color:var(--amber);box-shadow:inset 0 0 0 1px var(--amber-dim)}',
    P + ' .fm-cta.ghost:hover{background:rgba(255,160,90,.1);box-shadow:inset 0 0 0 1px var(--amber),0 0 calc(var(--u)*18) rgba(255,150,80,.25)}',
    P + ' .fm-cta svg{width:calc(var(--u)*11);height:calc(var(--u)*11);flex:none}',
    P + ' .fm-btns{display:flex;gap:calc(var(--u)*12);flex-wrap:wrap}',
    P + ' .fm-upnext{margin-top:calc(var(--u)*38);display:flex;align-items:center;gap:calc(var(--u)*14);width:100%;padding:calc(var(--u)*12) calc(var(--u)*6);border-top:1px solid rgba(255,220,190,.08);border-bottom:1px solid rgba(255,220,190,.08);transition:background .2s,padding .2s;white-space:nowrap}',
    P + ' .fm-upnext:hover{background:linear-gradient(90deg,rgba(255,160,90,.1),transparent);padding-left:calc(var(--u)*12)}',
    P + ' .fm-upnext .k{font-family:var(--mono);font-size:calc(var(--u)*10.5);letter-spacing:.26em;color:var(--amber);flex:none}',
    P + ' .fm-upnext .v{font-size:calc(var(--u)*15);color:var(--ink);overflow:hidden;text-overflow:ellipsis;min-width:0}',
    P + ' .fm-upnext .v i{font-style:normal;color:var(--ink-dim);font-size:.9em}',
    P + ' .fm-upnext .d{margin-left:auto;font-family:var(--mono);font-size:calc(var(--u)*11);color:var(--ink-faint);flex:none}',
    P + ' .fm-qu{margin-top:calc(var(--u)*30)}',
    P + ' .fm-qu .fm-src{margin-top:0}',
    P + ' .fm-qu .fm-item{height:calc(var(--u)*48)}',
    P + ' .fm-qu .fm-item img{width:calc(var(--u)*34);height:calc(var(--u)*34)}',
    P + ' .fm-plate-hint{margin-top:auto;font-family:var(--mono);font-size:calc(var(--u)*10.5);letter-spacing:.22em;color:var(--ink-faint)}',
    P + ' .fm-plate-hint b{font-weight:400;color:var(--amber)}',
    P + ' .fm-stat.ro{cursor:default}',
    P + ' .fm-stat.ro:hover{border-color:rgba(255,220,190,.08)}',
    P + ' .fm-stat.ro:hover b{text-shadow:0 0 calc(var(--u)*14) color-mix(in srgb,var(--acc) 70%,transparent)}',
    P + ' .fm-big{display:flex;align-items:center;gap:calc(var(--u)*14);margin:calc(var(--u)*14) 0 calc(var(--u)*8)}',
    P + ' .fm-big b{font-family:var(--cond);font-size:calc(var(--u)*60);line-height:1;font-weight:700;color:var(--ink);text-shadow:0 0 calc(var(--u)*20) var(--acc);flex:none}',
    P + ' .fm-big span{font-size:calc(var(--u)*14);color:var(--ink-dim);letter-spacing:.08em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
    P + ' .fm-big .fm-cta{margin:0 0 0 auto}',
    P + ' .fm-list{margin-top:calc(var(--u)*10)}',
    P + ' .fm-item{display:flex;align-items:center;gap:calc(var(--u)*16);width:100%;height:calc(var(--u)*56);padding:0 calc(var(--u)*6);border-bottom:1px solid rgba(255,220,190,.07);transition:background .2s,padding .2s;white-space:nowrap}',
    P + ' .fm-item:hover{background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 16%,transparent),transparent);padding-left:calc(var(--u)*12)}',
    P + ' .fm-item .at{font-family:var(--mono);font-size:calc(var(--u)*11);color:var(--amber);width:calc(var(--u)*26);letter-spacing:.06em;opacity:.8;flex:none}',
    P + ' .fm-item img{width:calc(var(--u)*40);height:calc(var(--u)*40);object-fit:cover;border-radius:1px;box-shadow:0 0 0 1px rgba(255,255,255,.06);flex:none}',
    P + ' .fm-item .t{font-size:calc(var(--u)*15.5);color:var(--ink);overflow:hidden;text-overflow:ellipsis;min-width:0}',
    P + ' .fm-item .t i{font-style:normal;color:var(--ink-dim);font-size:.86em;margin-left:calc(var(--u)*8)}',
    P + ' .fm-item .d{margin-left:auto;font-family:var(--mono);font-size:calc(var(--u)*11);color:var(--ink-faint);flex:none;padding-left:calc(var(--u)*10)}',
    P + ' .fm-item .go{width:calc(var(--u)*12);height:calc(var(--u)*12);opacity:0;transition:opacity .2s;color:var(--amber);flex:none}',
    P + ' .fm-item:hover .go{opacity:1}',
    P + ' .fm-src{margin-top:calc(var(--u)*14);font-family:var(--mono);font-size:calc(var(--u)*10);letter-spacing:.22em;color:var(--ink-faint)}',
    P + ' .fm-src b{font-weight:400;color:var(--amber)}',
    P + ' .fm-stats{display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--u)*4) calc(var(--u)*30);margin-top:calc(var(--u)*16)}',
    P + ' .fm-stat{padding:calc(var(--u)*12) 0;border-bottom:1px solid rgba(255,220,190,.08);transition:border-color .2s}',
    P + ' .fm-stat:hover{border-color:var(--amber)}',
    P + ' .fm-stat b{display:block;font-family:var(--cond);font-weight:700;font-size:calc(var(--u)*50);line-height:1;color:var(--ink);text-shadow:0 0 calc(var(--u)*14) color-mix(in srgb,var(--acc) 70%,transparent);transition:text-shadow .2s}',
    P + ' .fm-stat:hover b{text-shadow:0 0 calc(var(--u)*26) var(--acc)}',
    P + ' .fm-stat span{display:block;margin-top:calc(var(--u)*6);font-size:calc(var(--u)*13);color:var(--ink-dim);letter-spacing:.1em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    P + ' .fm-lead{margin-top:calc(var(--u)*22);font-family:var(--song);font-weight:700;font-size:calc(var(--u)*30);line-height:1.25;color:var(--ink);text-shadow:0 0 calc(var(--u)*16) rgba(255,190,140,.25);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    P + ' .fm-desc{margin-top:calc(var(--u)*10);font-size:calc(var(--u)*14);line-height:1.7;color:var(--ink-dim);letter-spacing:.05em;max-width:calc(var(--u)*480)}',
    P + ' .fm-stack{display:flex;margin-top:calc(var(--u)*22);height:calc(var(--u)*116)}',
    P + ' .fm-stack img{width:calc(var(--u)*116);height:calc(var(--u)*116);object-fit:cover;border-radius:calc(var(--u)*2);box-shadow:0 0 0 1px rgba(255,255,255,.06),0 calc(var(--u)*14) calc(var(--u)*30) rgba(0,0,0,.6);margin-right:calc(var(--u)*-38);transition:transform .35s}',
    P + ' .fm-stack img:nth-child(2){transform:translateY(calc(var(--u)*8));opacity:.85}',
    P + ' .fm-stack img:nth-child(3){transform:translateY(calc(var(--u)*16));opacity:.7}',
    P + ' .fm-stack:hover img{transform:none;opacity:1}',
    P + ' .fm-msg .k{margin-top:calc(var(--u)*30);font-family:var(--mono);font-size:calc(var(--u)*11);letter-spacing:.34em;color:var(--amber);opacity:.8}',
    P + ' .fm-msg .fm-lead{margin-top:calc(var(--u)*12)}',
    P + ' .fm-msg .fm-btns{margin-top:calc(var(--u)*26)}',
    P + ' .fm-msg .fm-btns .fm-cta{margin-top:0;height:calc(var(--u)*40);padding:0 calc(var(--u)*20);font-size:calc(var(--u)*14)}',
    // dial
    P + ' .fm-dial{position:absolute;left:0;right:0;top:calc(50% + var(--u)*140);height:calc(var(--u)*170);cursor:ew-resize;touch-action:none}',
    P + ' .fm-dial canvas{position:absolute;inset:0;width:100%;height:100%;display:block}',
    P + ' .fm-st{position:absolute;top:calc(var(--u)*6);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:calc(var(--u)*3);cursor:pointer;padding:calc(var(--u)*2) calc(var(--u)*8);white-space:nowrap;border-radius:calc(var(--u)*2)}',
    P + ' .fm-st b{font-weight:700;font-size:calc(var(--u)*14.5);letter-spacing:.14em;color:var(--ink-dim);transition:color .5s ease,text-shadow .5s ease}',
    P + ' .fm-st em{font-style:normal;font-family:var(--mono);font-size:calc(var(--u)*10);letter-spacing:.14em;color:var(--ink-faint);transition:color .5s ease}',
    P + ' .fm-st.na b{color:rgba(255,236,214,.38)}',
    P + ' .fm-st:hover b{color:var(--ink);text-shadow:0 0 calc(var(--u)*12) rgba(255,180,120,.7)}',
    P + ' .fm-st:hover em{color:var(--amber)}',
    P + ' .fm-st.on b{color:#fff6ea;text-shadow:0 0 calc(var(--u)*10) var(--acc),0 0 calc(var(--u)*26) var(--acc)}',
    P + ' .fm-st.on em{color:var(--amber)}',
    P + ' .fm-hint{position:absolute;right:4.2vw;bottom:calc(var(--u)*2);font-family:var(--mono);font-size:calc(var(--u)*10);letter-spacing:.24em;color:var(--ink-faint);pointer-events:none}',
    // faceplate
    P + ' .fm-face{position:absolute;left:4.2vw;right:4.2vw;bottom:calc(var(--u)*30);height:calc(var(--u)*70);display:flex;align-items:center;gap:calc(var(--u)*30)}',
    P + ' .fm-keys{display:flex;gap:calc(var(--u)*8);flex:none}',
    P + ' .fm-key{position:relative;width:calc(var(--u)*58);height:calc(var(--u)*58);border-radius:calc(var(--u)*3);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(var(--u)*5);background:linear-gradient(180deg,#1d1512 0%,#100b09 60%,#0a0706 100%);box-shadow:inset 0 1px 0 rgba(255,230,210,.09),inset 0 -2px 0 rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.8),0 calc(var(--u)*6) calc(var(--u)*14) rgba(0,0,0,.55);transition:background .15s,transform .1s,box-shadow .15s}',
    P + ' .fm-key svg{width:calc(var(--u)*17);height:calc(var(--u)*17);color:var(--ink-dim);transition:color .2s,filter .2s}',
    P + ' .fm-key small{font-family:var(--mono);font-size:calc(var(--u)*8.5);letter-spacing:.2em;color:var(--ink-faint)}',
    P + ' .fm-key::before{content:"";position:absolute;top:calc(var(--u)*6);right:calc(var(--u)*6);width:calc(var(--u)*4);height:calc(var(--u)*4);border-radius:50%;background:#2c1510;transition:background .3s,box-shadow .3s}',
    P + ' .fm-key:hover{background:linear-gradient(180deg,#2a1d18 0%,#15100d 60%,#0c0807 100%)}',
    P + ' .fm-key:hover svg{color:var(--ink);filter:drop-shadow(0 0 5px rgba(255,170,110,.8))}',
    P + ' .fm-key:active{transform:translateY(1px);box-shadow:inset 0 1px 0 rgba(255,230,210,.05),inset 0 2px 6px rgba(0,0,0,.8),0 0 0 1px rgba(0,0,0,.8)}',
    P + ' .fm-key.on::before{background:#ff5a2e;box-shadow:0 0 6px #ff5a2e,0 0 2px #ffd0b8}',
    P + ' .fm-key.on svg{color:var(--amber);filter:drop-shadow(0 0 6px rgba(255,150,80,.9))}',
    P + ' .fm-key.play{width:calc(var(--u)*76)}',
    P + ' .fm-key.play svg{width:calc(var(--u)*20);height:calc(var(--u)*20)}',
    P + ' .fm-key.lyr b{font-family:var(--kai);font-size:calc(var(--u)*20);font-weight:400;color:var(--ink-dim);line-height:1;transition:color .2s,text-shadow .2s}',
    P + ' .fm-key.lyr:hover b{color:var(--ink)}',
    P + ' .fm-key.lyr.on b{color:var(--amber);text-shadow:0 0 8px rgba(255,150,80,.9)}',
    P + ' .fm-key.like.on svg{color:#ff5a6e;filter:drop-shadow(0 0 6px rgba(255,80,100,.9))}',
    P + ' .fm-key.dim svg{opacity:.45}',
    P + ' .fm-sep{width:1px;height:calc(var(--u)*44);background:linear-gradient(180deg,transparent,rgba(255,220,190,.18),transparent);flex:none}',
    P + ' .fm-onair{flex:1;min-width:0;display:flex;flex-direction:column;gap:calc(var(--u)*8)}',
    P + ' .fm-l1{display:flex;align-items:baseline;gap:calc(var(--u)*14);white-space:nowrap;min-width:0}',
    P + ' .fm-l1 .s{font-size:calc(var(--u)*15);color:var(--ink);overflow:hidden;text-overflow:ellipsis;min-width:0;flex:0 1 auto;max-width:45%}',
    P + ' .fm-l1 .a{font-size:calc(var(--u)*13);color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1 1 0}',
    P + ' .fm-l1 .nx{margin-left:auto;font-size:calc(var(--u)*13);color:var(--ink-dim);transition:color .2s;overflow:hidden;text-overflow:ellipsis;min-width:0;max-width:34%;flex:none;padding:0 calc(var(--u)*4)}',
    P + ' .fm-l1 .nx:hover{color:var(--ink)}',
    P + ' .fm-l1 .nx i{font-style:normal;font-family:var(--mono);font-size:calc(var(--u)*10);letter-spacing:.24em;color:var(--amber);margin-right:calc(var(--u)*8)}',
    P + ' .fm-p2{display:flex;align-items:center;gap:calc(var(--u)*14);font-family:var(--mono);font-size:calc(var(--u)*11.5);color:var(--ink-dim);letter-spacing:.08em}',
    P + ' .fm-p2 b{font-weight:400;color:var(--amber);text-shadow:0 0 6px rgba(255,150,80,.6)}',
    P + ' .fm-tr{position:relative;flex:1;height:calc(var(--u)*14);cursor:pointer}',
    P + ' .fm-tr::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(255,220,190,.16);transition:background .2s}',
    P + ' .fm-tr .f{position:absolute;left:0;top:50%;height:1px;background:linear-gradient(90deg,rgba(255,150,80,.2),var(--amber));box-shadow:0 0 6px var(--amber)}',
    P + ' .fm-tr .h{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:#ffd8b0;box-shadow:0 0 8px var(--amber),0 0 16px #ff6a2a;transition:box-shadow .2s}',
    P + ' .fm-tr:hover::before{background:rgba(255,220,190,.34)}',
    P + ' .fm-tr:hover .h{box-shadow:0 0 12px var(--amber),0 0 26px #ff6a2a}',
    P + ' .fm-meter{display:flex;align-items:center;gap:calc(var(--u)*16);padding:calc(var(--u)*6) calc(var(--u)*10);border-radius:calc(var(--u)*3);transition:background .2s;flex:none;max-width:calc(var(--u)*380)}',
    P + ' .fm-meter:hover{background:rgba(255,160,90,.07)}',
    P + ' .fm-segs{display:flex;align-items:flex-end;gap:calc(var(--u)*3);height:calc(var(--u)*34);flex:none}',
    P + ' .fm-segs i{width:calc(var(--u)*4);background:rgba(255,200,160,.1);border-radius:1px;transition:background .35s ease,box-shadow .35s ease}',
    P + ' .fm-segs i.lit{background:var(--amber);box-shadow:0 0 6px rgba(255,150,80,.8)}',
    P + ' .fm-segs i.lit.hot{background:#ff5a2e;box-shadow:0 0 6px #ff5a2e}',
    P + ' .fm-mt{display:flex;flex-direction:column;gap:calc(var(--u)*4);white-space:nowrap;min-width:0}',
    P + ' .fm-mt .k{font-family:var(--mono);font-size:calc(var(--u)*9.5);letter-spacing:.26em;color:var(--ink-faint)}',
    P + ' .fm-mt .v{font-size:calc(var(--u)*13.5);color:var(--ink);overflow:hidden;text-overflow:ellipsis}',
    P + ' .fm-mt .v b{font-family:var(--cond);font-size:calc(var(--u)*20);font-weight:700;color:var(--amber);text-shadow:0 0 8px rgba(255,150,80,.6);margin-right:calc(var(--u)*2)}',
    P + ' .fm-mt .v i{font-style:normal;color:var(--ink-faint);margin:0 calc(var(--u)*6)}',
  ].join('\n');

  // ---------------- WebGL ----------------
  var VS = 'attribute vec2 p;varying vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  var NOISE = [
    'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s*1.14;}',
  ].join('\n');
  // 场景：半分辨率绘制。极光 + 雾 + 指针光柱 + 背光刻度玻璃（没有雪花/撕裂）
  var FS_SCENE = [
    'precision highp float;varying vec2 vUv;',
    'uniform vec2 uRes;uniform float uT,uLock,uNeedle,uDialY;uniform vec3 uA,uB,uC;',
    NOISE,
    'void main(){',
    ' vec2 uv=vUv;float asp=uRes.x/uRes.y;vec2 p=vec2(uv.x*asp,uv.y);float t=uT;',
    ' vec3 col=vec3(.010,.007,.012);',
    ' float hz=fbm(p*vec2(1.1,1.6)+vec2(t*.012,-t*.006));',
    ' col+=uC*(.05+.06*uLock)*hz*hz*2.2;',
    ' vec3 aur=vec3(0.);',
    ' for(int i=0;i<4;i++){',
    '  float fi=float(i);float sc=.75+fi*.42;',
    '  float x=p.x*sc+fi*3.7+t*.008*(fi+1.);',
    '  float w=fbm(vec2(x*.55,t*.035+fi*1.9));',
    '  float base=.40+fi*.075+(w-.5)*.55;',
    '  float d=uv.y-base;',
    '  float edge=smoothstep(-.01,.04,d);',
    '  float fall=exp(-max(d,0.)*(3.4+fi*.9));',
    '  float rays=pow(.25+.75*vn(vec2(x*30.,t*.2+fi*7.)),1.6);',
    '  float gapm=smoothstep(.28,.72,vn(vec2(x*.9+fi*5.,t*.02)));',
    '  rays*=.6+.4*vn(vec2(x*8.,fi*3.1-t*.04));',
    '  float a=edge*fall*rays*gapm;',
    '  float ge=exp(-abs(d)*30.)*.9;',
    '  vec3 c=mix(uA,uB,clamp(d*1.8+fi*.12,0.,1.));',
    '  aur+=(c*a+uA*ge*rays*gapm*.5)*(.62-fi*.11);',
    ' }',
    ' aur*=smoothstep(uDialY-.02,uDialY+.22,uv.y);',
    ' col+=aur*(.95+.9*uLock);',
    ' float nx=uNeedle*asp;float dx=p.x-nx;',
    ' float vy=exp(-abs(uv.y-uDialY)*2.2);',
    ' float beam=exp(-dx*dx*2600.)*.8+exp(-dx*dx*140.)*.26+exp(-dx*dx*9.)*.10;',
    ' vec3 bc=mix(vec3(1.,.42,.18),uA,.45);',
    ' col+=bc*beam*vy*(.6+.4*uLock);',
    ' float dust=vn(vec2(p.x*90.,p.y*90.-t*1.2));dust=pow(dust,14.)*1.2;',
    ' col+=bc*dust*exp(-dx*dx*60.)*vy*.5;',
    ' float band=exp(-pow((uv.y-uDialY)/.085,2.));',
    ' col+=vec3(1.,.55,.26)*band*.12*(.8+.2*vn(vec2(p.x*2.5,t*.1)));',
    ' col+=bc*band*exp(-dx*dx*5.)*.4;',
    ' col+=uA*.05*smoothstep(.28,0.,uv.y);',
    ' gl_FragColor=vec4(col,1.);',
    '}',
  ].join('\n');
  // 1/8 分辨率的柔光：4 个双线性采样
  var FS_DOWN = [
    'precision highp float;varying vec2 vUv;uniform sampler2D uS;uniform vec2 uST;',
    'void main(){vec2 o=uST*1.5;',
    ' vec3 c=texture2D(uS,vUv+vec2(o.x,o.y)).rgb+texture2D(uS,vUv+vec2(-o.x,o.y)).rgb+texture2D(uS,vUv+vec2(o.x,-o.y)).rgb+texture2D(uS,vUv+vec2(-o.x,-o.y)).rgb;',
    ' gl_FragColor=vec4(c*.25,1.);}',
  ].join('\n');
  // 合成：1 次场景采样 + 4 次小纹理采样；调台时整体轻微"失焦"
  var FS_COMP = [
    'precision highp float;varying vec2 vUv;uniform sampler2D uS,uBl;uniform vec2 uBT;uniform float uFocus;',
    'void main(){vec2 uv=vUv;',
    ' vec3 c=texture2D(uS,uv).rgb;',
    ' vec2 o=uBT*.75;',
    ' vec3 bl=(texture2D(uBl,uv+vec2(o.x,o.y)).rgb+texture2D(uBl,uv+vec2(-o.x,o.y)).rgb+texture2D(uBl,uv+vec2(o.x,-o.y)).rgb+texture2D(uBl,uv+vec2(-o.x,-o.y)).rgb)*.25;',
    ' c=mix(c,bl*1.1,(1.-uFocus)*.5);',
    ' c+=bl*.4;',
    ' c=vec3(1.)-exp(-c*1.35);',
    ' c=pow(c,vec3(.96,1.,1.06));',
    ' vec2 dir=uv-.5;float v=smoothstep(1.25,.35,length(dir*vec2(1.15,1.35)));',
    ' c*=mix(.18,1.,v);',
    ' gl_FragColor=vec4(c,1.);}',
  ].join('\n');

  function createGL(canvas) {
    var gl = null;
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' }); } catch (_e) { gl = null; }
    if (!gl) return null;
    var G = { gl: gl, lost: false, progs: [], shaders: [] };
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('[fm-dial] shader: ' + gl.getShaderInfoLog(s));
      G.shaders.push(s); return s;
    }
    function prog(fs) {
      var p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('[fm-dial] link: ' + gl.getProgramInfoLog(p));
      var U = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var a = gl.getActiveUniform(p, i); U[a.name] = gl.getUniformLocation(p, a.name); }
      G.progs.push(p);
      return { p: p, U: U };
    }
    function target() {
      var t = gl.createTexture(), f = gl.createFramebuffer();
      return { tex: t, fbo: f, w: 0, h: 0 };
    }
    G.scene = prog(FS_SCENE); G.down = prog(FS_DOWN); G.comp = prog(FS_COMP);
    G.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, G.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    G.A = target(); G.B = target();
    G.alloc = function (T, w, h) {
      T.w = w; T.h = h;
      gl.bindTexture(gl.TEXTURE_2D, T.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, T.tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };
    G.dispose = function () {
      try {
        [G.A, G.B].forEach(function (T) { gl.deleteTexture(T.tex); gl.deleteFramebuffer(T.fbo); });
        gl.deleteBuffer(G.buf);
        G.progs.forEach(function (p) { gl.deleteProgram(p); });
        G.shaders.forEach(function (s) { gl.deleteShader(s); });
        var ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      } catch (_e) { }
    };
    return G;
  }

  // ============================================================
  // ---------------- 播放页背景：暖色的夜，极光光柱缓慢漂移（3D 粒子叠在上面） ----------------
  var BACKDROP = {
    css: [
      '#hth-backdrop.hbd-fm-dial{background:radial-gradient(130% 75% at 50% 112%,rgba(118,42,22,.62),rgba(34,12,14,.9) 55%,rgba(9,4,6,.96))}',
      '#hth-backdrop.hbd-fm-dial .hbd-cols{position:absolute;left:-25%;right:-25%;top:-5%;bottom:-5%;background:repeating-linear-gradient(90deg,rgba(255,150,90,0) 0,rgba(255,150,90,.065) 3.5%,rgba(255,150,90,0) 7%,rgba(255,80,120,0) 9%,rgba(255,80,120,.05) 12%,rgba(255,80,120,0) 15%,rgba(120,90,255,0) 18%,rgba(120,90,255,.03) 20%,rgba(120,90,255,0) 23%);-webkit-mask-image:linear-gradient(180deg,transparent,#000 35%,#000 70%,transparent);mask-image:linear-gradient(180deg,transparent,#000 35%,#000 70%,transparent);animation:hbd-fm-drift 70s ease-in-out infinite alternate;will-change:transform}',
      '#hth-backdrop.hbd-fm-dial .hbd-glow{position:absolute;left:-10%;right:-10%;bottom:-25%;height:70%;background:radial-gradient(55% 55% at 50% 100%,rgba(255,126,62,.32),rgba(255,90,60,0) 70%);animation:hbd-fm-breath 16s ease-in-out infinite alternate;will-change:opacity}',
      '#hth-backdrop.hbd-fm-dial .hbd-ticks{position:absolute;left:4%;right:4%;top:79%;height:18px;opacity:.5;background:repeating-linear-gradient(90deg,rgba(255,200,150,.10) 0 1px,transparent 1px 10px);-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}',
      '#hth-backdrop.hbd-fm-dial .hbd-grain{position:absolute;inset:0;opacity:.055;mix-blend-mode:screen;background-size:256px 256px}',
      '@keyframes hbd-fm-drift{from{transform:translate3d(-6%,0,0)}to{transform:translate3d(6%,0,0)}}',
      '@keyframes hbd-fm-breath{from{opacity:.7}to{opacity:1}}',
      '@media (prefers-reduced-motion:reduce){#hth-backdrop.hbd-fm-dial .hbd-cols,#hth-backdrop.hbd-fm-dial .hbd-glow{animation:none}}',
    ].join('\n'),
    html: '<div class="hbd-cols"></div><div class="hbd-glow"></div><div class="hbd-ticks"></div><div class="hbd-grain"></div>',
    build: function (box) {
      try {
        var c = document.createElement('canvas'); c.width = c.height = 256;
        var g = c.getContext('2d'), id = g.createImageData(256, 256), r = rng(777);
        for (var i = 0; i < id.data.length; i += 4) { var v = r() * 255; id.data[i] = v; id.data[i + 1] = v * 0.92; id.data[i + 2] = v * 0.82; id.data[i + 3] = 255; }
        g.putImageData(id, 0, 0);
        var el = box.querySelector('.hbd-grain'); if (el) el.style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')';
      } catch (_e) { }
    },
  };

  registerHomeTheme({
    id: ID,
    name: '调频',
    cordColor: 'rgba(255,196,150,.82)',
    cordGlow: 'rgba(255,130,70,.5)',
    backdrop: BACKDROP,
    create: function (root, ctx) {
      ctx.injectStyle('theme-' + ID, CSS);
      var A = ctx.actions;
      var RM = !!ctx.reducedMotion;
      var M = null;
      var destroyed = false, running = false, paused = false, raf = 0;
      var W = 0, H = 0, U = 1, DPR = Math.min(window.devicePixelRatio || 1, 1.5);
      var cleanups = [];
      function on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt); cleanups.push(function () { el.removeEventListener(ev, fn, opt); }); }

      // ---------- DOM ----------
      var I = {
        play: '<svg viewBox="0 0 12 12" fill="currentColor"><path d="M3 1.5v9L10.5 6z"/></svg>',
        pause: '<svg viewBox="0 0 12 12" fill="currentColor"><path d="M2.5 1.5h2.6v9H2.5zM6.9 1.5h2.6v9H6.9z"/></svg>',
        go: '<svg class="go" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 2l4 4-4 4"/></svg>',
      };
      root.innerHTML = [
        '<canvas class="fm-gl"></canvas>',
        '<div class="fm-ui">',
        ' <div class="fm-top">',
        '  <div class="fm-brand"><div class="fm-mark">MINE<i>RADIO</i></div><div class="fm-leds"><span class="fm-led" data-led="tuned">TUNED</span><span class="fm-led" data-led="stereo">STEREO</span><span class="fm-led on">FM</span></div></div>',
        '  <label class="fm-seek"><span class="fm-tag" data-k="searchgo" title="搜索">搜台</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg><input class="fm-q" placeholder="搜索歌曲、歌手" autocomplete="off" spellcheck="false"><span class="fm-scan">ENTER</span></label>',
        '  <div class="fm-vfd"><div class="fm-time"><span data-hh></span><b data-colon>:</b><span data-mm></span></div><div class="fm-date"><span data-d1></span><span data-d2></span></div></div>',
        ' </div>',
        ' <div class="fm-hero">',
        '  <div class="fm-ghost"></div>',
        '  <div class="fm-freqline"><span class="fm-fq"></span><span class="fm-bar"></span><span class="fm-fcode"></span></div>',
        '  <div class="fm-name"><span></span></div>',
        '  <div class="fm-sub"><span class="fm-en"></span><button class="fm-rds" type="button" title="换一句"><i>RDS</i><span></span></button></div>',
        ' </div>',
        ' <div class="fm-prog"></div>',
        ' <div class="fm-dial"><canvas></canvas><div class="fm-stations"></div><div class="fm-hint">滚轮 / 拖动 调谐 · ← → 换台</div></div>',
        ' <div class="fm-face">',
        '  <div class="fm-keys">',
        '   <button class="fm-key" type="button" data-k="prev" title="上一首"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 4h2v12H5zM16 4v12L8 10z"/></svg><small>PREV</small></button>',
        '   <button class="fm-key play" type="button" data-k="play" title="播放 / 暂停"><svg viewBox="0 0 20 20" fill="currentColor" data-playico></svg><small data-playlbl>PLAY</small></button>',
        '   <button class="fm-key" type="button" data-k="next" title="下一首"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M13 4h2v12h-2zM4 4v12l8-6z"/></svg><small>NEXT</small></button>',
        '  </div>',
        '  <div class="fm-keys">',
        '   <button class="fm-key like" type="button" data-k="like" title="喜欢"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path data-heart d="M10 16.5s-6.5-3.8-6.5-8.4A3.4 3.4 0 0110 6.3a3.4 3.4 0 016.5 1.8c0 4.6-6.5 8.4-6.5 8.4z"/></svg><small>喜欢</small></button>',
        '   <button class="fm-key lyr" type="button" data-k="lyr" title="歌词开关"><b>词</b><small>LYRIC</small></button>',
        '  </div>',
        '  <div class="fm-sep"></div>',
        '  <div class="fm-onair"><div class="fm-l1"><span class="s" data-k="immersive" title="进入沉浸模式"></span><span class="a"></span><button class="nx" type="button" data-k="next" title="下一首"></button></div>',
        '   <div class="fm-p2"><b data-tnow>00:00</b><div class="fm-tr" data-k="seek"><div class="f"></div><div class="h"></div></div><span data-tdur>00:00</span></div></div>',
        '  <div class="fm-sep"></div>',
        '  <button class="fm-meter" type="button" data-k="meter" title="今日聆听 · 查看最近播放"><div class="fm-segs"></div><div class="fm-mt"><span class="k">SIGNAL · 今日聆听</span><span class="v"></span></div></button>',
        ' </div>',
        '</div>',
        '<div class="fm-grain"></div>',
      ].join('');
      function q(s) { return root.querySelector(s); }
      var el = {
        gl: q('.fm-gl'), grain: q('.fm-grain'), seek: q('.fm-seek'), input: q('.fm-q'),
        tuned: q('[data-led=tuned]'), stereo: q('[data-led=stereo]'),
        hh: q('[data-hh]'), mm: q('[data-mm]'), colon: q('[data-colon]'), d1: q('[data-d1]'), d2: q('[data-d2]'), vfd: q('.fm-vfd'),
        ghost: q('.fm-ghost'), fq: q('.fm-fq'), fcode: q('.fm-fcode'), name: q('.fm-name'), nameTxt: q('.fm-name span'), sub: q('.fm-sub'), en: q('.fm-en'), rds: q('.fm-rds'), rdsTag: q('.fm-rds i'), rdsTxt: q('.fm-rds span'),
        prog: q('.fm-prog'), dial: q('.fm-dial'), dc: q('.fm-dial canvas'), stations: q('.fm-stations'),
        playIco: q('[data-playico]'), playLbl: q('[data-playlbl]'), kPlay: q('[data-k=play]'), kPrev: q('.fm-keys [data-k=prev]'), kNext: q('.fm-keys [data-k=next]'), kLike: q('[data-k=like]'), heart: q('[data-heart]'), kLyr: q('[data-k=lyr]'),
        oaS: q('.fm-l1 .s'), oaA: q('.fm-l1 .a'), oaN: q('.fm-l1 .nx'), tNow: q('[data-tnow]'), tDur: q('[data-tdur]'), tf: q('.fm-tr .f'), th: q('.fm-tr .h'),
        segs: q('.fm-segs'), meterV: q('.fm-mt .v'),
      };

      // 静态胶片颗粒：只生成一次，不闪
      (function makeGrain() {
        try {
          var c = document.createElement('canvas'); c.width = c.height = 256;
          var g = c.getContext('2d'), id = g.createImageData(256, 256), r = rng(424242);
          for (var i = 0; i < id.data.length; i += 4) { var v = r() * 255; id.data[i] = v; id.data[i + 1] = v * 0.94; id.data[i + 2] = v * 0.86; id.data[i + 3] = 255; }
          g.putImageData(id, 0, 0);
          el.grain.style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')';
        } catch (_e) { }
      })();

      // 信号表
      var SEGN = 14;
      for (var si = 0; si < SEGN; si++) { var seg = document.createElement('i'); seg.style.height = (30 + si * 70 / SEGN) + '%'; el.segs.appendChild(seg); }

      // 刻度盘上的电台
      STATIONS.forEach(function (S, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'fm-st'; b.setAttribute('data-st', i);
        b.innerHTML = '<b></b><em>' + S.f.toFixed(1) + '</em>';
        el.stations.appendChild(b);
      });
      var stEls = [].slice.call(el.stations.children);

      // ---------- 状态 ----------
      var st = {
        f: STATIONS[0].f, target: STATIONS[0].f, v: 0, mode: 'spring', lastInput: -1e9, dragging: false,
        idx: 0, shown: 0, focus: 1, pull: 0, pullDir: 0, pendingName: false,
        roll: 0, rollIn: false, rollDirIn: 1,   // 换台时大字像滚筒一样滚动（配合虚焦）
        col: [hex2v(STATIONS[0].pal[0]), hex2v(STATIONS[0].pal[1]), hex2v(STATIONS[0].pal[2])],
        t0: performance.now(), last: performance.now(),
      };
      var tints = [null, null, null, null, null, null];  // 每个电台代表封面的平均色
      var progSig = '', progIdx = -1;
      var applied = { hero: -1, roll: 9, prog: -1, acc: '', fq: '', fcode: '', seg: -1, colon: -1, ledT: null, ledS: null, onIdx: -1 };

      function stationName(i) {
        if (i === 0 && M && !M.now) return '开始收听';
        return STATIONS[i].n;
      }
      function stationEn(i) {
        if (i === 0 && M && !M.now) return 'TUNE IN';
        if (i === 1 && M && M.daily && M.daily.count) return 'DAILY ' + M.daily.count;
        return STATIONS[i].en;
      }
      function stationAvailable(i) {
        if (!M) return true;
        var id = STATIONS[i].id;
        if (id === 'daily') return !!(M.daily && M.daily.preview && M.daily.preview.length && M.daily.kind !== 'empty');
        if (id === 'rec') return !!(M.recent && M.recent.length);
        if (id === 'disc') return !!(M.discover && M.discover.available);
        if (id === 'radio') return !!(M.radio && M.radio.available);
        return true;
      }

      // ---------- 封面 ----------
      function coverOf(t, size) {
        if (!t) return fallbackCover(null, size);
        var u = '';
        try { u = t.cover || (ctx.cover ? ctx.cover(t, size) : '') || ''; } catch (_e) { u = t.cover || ''; }
        return u || fallbackCover(t, size);
      }
      function imgTag(t, size, cls) {
        return '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + esc(coverOf(t, size)) + '" data-fb="' + esc((t && (t.key || t.title)) || '') + '" data-fbs="' + size + '" alt="" draggable="false">';
      }
      // 图片加载失败 → 兜底
      on(root, 'error', function (e) {
        var img = e.target;
        if (!img || img.tagName !== 'IMG' || img.getAttribute('data-fbdone')) return;
        img.setAttribute('data-fbdone', '1');
        img.src = fallbackCover({ key: img.getAttribute('data-fb') || 'x' }, Number(img.getAttribute('data-fbs')) || 160);
      }, true);

      var tintCache = Object.create(null), tintOrder = [], tintImgs = [];
      function dropTintImg(img) { var k = tintImgs.indexOf(img); if (k >= 0) tintImgs.splice(k, 1); }
      function sampleTint(track, cb) {
        if (!track) return cb(null);
        var url = track.cover || '';
        if (!url) return cb(fbTintOf(track));
        if (tintCache[url]) return cb(tintCache[url]);
        var img = new Image();
        tintImgs.push(img);
        if (!/^data:/i.test(url)) img.crossOrigin = 'anonymous';
        img.onload = function () {
          img.onload = img.onerror = null;
          dropTintImg(img);
          if (destroyed) return;
          var c = null;
          try {
            var cv = document.createElement('canvas'); cv.width = cv.height = 12;
            var g = cv.getContext('2d'); g.drawImage(img, 0, 0, 12, 12);
            var d = g.getImageData(0, 0, 12, 12).data, r = 0, gg = 0, b = 0, wsum = 0;
            for (var i = 0; i < d.length; i += 4) {
              var R = d[i] / 255, G = d[i + 1] / 255, B = d[i + 2] / 255;
              var mx = Math.max(R, G, B), mn = Math.min(R, G, B), w = 0.15 + (mx - mn) * 2 + mx * 0.3; // 偏向鲜艳像素
              r += R * w; gg += G * w; b += B * w; wsum += w;
            }
            c = vivid([r / wsum, gg / wsum, b / wsum]);
          } catch (_e) { c = null; }
          if (c) {
            tintCache[url] = c; tintOrder.push(url);
            while (tintOrder.length > FB_MAX) delete tintCache[tintOrder.shift()];
          }
          cb(c);
        };
        img.onerror = function () { img.onload = img.onerror = null; dropTintImg(img); if (!destroyed) cb(fbTintOf(track)); };
        img.src = url;
      }
      var tintSig = ['', '', '', '', '', ''];
      function refreshTints() {
        if (!M) return;
        var rep = [M.now, (M.daily && M.daily.preview || [])[0], (M.recent || [])[0], null, (M.picks && M.picks.items || [])[0], (M.daily && M.daily.preview || [])[1]];
        rep.forEach(function (t, i) {
          var sig = t ? (t.key + '|' + (t.cover || '').length + (t.cover || '').slice(-24)) : '';
          if (sig === tintSig[i]) return;
          tintSig[i] = sig;
          if (!t) { tints[i] = null; return; }
          sampleTint(t, function (c) { if (tintSig[i] === sig) { tints[i] = c; if (RM) renderStatic(); } });
        });
      }
      function palOf(i) {
        var S = STATIONS[i], a = hex2v(S.pal[0]), b = hex2v(S.pal[1]), c = hex2v(S.pal[2]), t = tints[i];
        if (t) { a = mix3(a, t, 0.6); b = mix3(b, t, 0.22); c = mix3(c, [t[0] * 0.35, t[1] * 0.35, t[2] * 0.35], 0.5); }
        return [a, b, c];
      }

      // ---------- 右侧节目单 ----------
      function hd(l, i) { return '<div class="fm-hd"><span>' + esc(l) + '</span><b>FM ' + STATIONS[i].f.toFixed(1) + '</b></div>'; }
      function row(t, left, extra, act) {
        return '<button class="fm-item" type="button" data-act="' + act + '">' + left + imgTag(t, 96) +
          '<span class="t">' + esc(t.title) + '<i>' + esc(t.artist) + '</i></span><span class="d">' + esc(extra != null ? extra : (t.duration ? mmss(t.duration) : '')) + '</span>' + I.go + '</button>';
      }
      function nosignal(i, title, desc) {
        return hd(stationName(i) + ' · 暂无信号', i) +
          '<div class="fm-msg"><div class="k">NO SIGNAL</div><div class="fm-lead">' + esc(title) + '</div><div class="fm-desc">' + esc(desc) + '</div>' +
          '<div class="fm-btns"><button class="fm-cta" type="button" data-act="login">登录 QQ 音乐 / 网易云</button><button class="fm-cta ghost" type="button" data-act="import">导入本地音乐</button></div></div>';
      }
      function contHeader() {
        var n = M.now;
        return (n.playing ? 'ON AIR · 正在播放' : 'ON AIR · 上次停在 ' + mss(n.position)) + (n.providerLabel ? ' · ' + n.providerLabel : '');
      }
      // 队列里还剩几首：模型里的 queue 只截了前 6 首，优先用模型给的总数
      function queueLeft() {
        var shown = (M && M.queue || []).length;
        if (M && typeof M.queueTotal === 'number' && isFinite(M.queueTotal)) return Math.max(0, M.queueTotal);
        try {
          if (typeof playQueue !== 'undefined' && playQueue && playQueue.length) return Math.max(shown, playQueue.length - 1);
        } catch (_e) { }
        return shown;
      }
      function plateHint(n) { return n.playing ? '点唱片 · <b>暂停</b>' : (n.position > 1 ? '点唱片 · 从 <b>' + mss(n.position) + '</b> 继续' : '点唱片 · <b>开始播放</b>'); }
      function progHTML(i) {
        var id = STATIONS[i].id;
        if (id === 'cont') {
          var n = M.now;
          if (!n) {
            return hd('STANDBY · 待机中', i) +
              '<div class="fm-msg"><div class="k">WELCOME · 欢迎收听</div><div class="fm-lead">把这台收音机调到你的频道</div>' +
              '<div class="fm-desc">登录 QQ 音乐或网易云，你的歌单、每日推荐和电台都会出现在刻度盘上；也可以先导入电脑里的本地音乐。</div>' +
              '<div class="fm-btns"><button class="fm-cta" type="button" data-act="login">登录 QQ 音乐 / 网易云</button><button class="fm-cta ghost" type="button" data-act="import">导入本地音乐</button></div></div>';
          }
          // 播放键、进度条、下一首都在下面的面板上，这里不再重复：只放唱片和"接下来"的队列
          var qn = (M.queue || []).slice(0, 3);
          return hd(contHeader(), i).replace('<span>', '<span data-live="hd">') +
            '<div class="fm-np"><div class="fm-plate" data-act="resume" title="' + (n.playing ? '暂停' : '继续播放') + '">' + imgTag(n, 400) + '<div class="fm-pi">' + (n.playing ? I.pause : I.play) + '</div><div class="fm-refl">' + imgTag(n, 400) + '</div></div>' +
            '<div class="fm-meta"><div class="fm-title" data-act="immersive" title="进入沉浸模式">' + esc(n.title) + '</div><div class="fm-who">' + esc(n.artist) + (n.album ? '<i>/</i>《' + esc(n.album) + '》' : '') + '</div>' +
            '<div class="fm-plate-hint" data-live="hint">' + plateHint(n) + '</div></div></div>' +
            (qn.length ? '<div class="fm-qu"><div class="fm-src">接下来 · <b>队列里还有 ' + queueLeft() + ' 首</b></div><div class="fm-list" style="margin-top:calc(var(--u)*4)">' +
              qn.map(function (t, j) { return row(t, '<span class="at">' + String(j + 1).padStart(2, '0') + '</span>', null, 'queue:' + j); }).join('') + '</div></div>' : '');
        }
        if (id === 'daily') {
          if (!stationAvailable(i)) return nosignal(i, '今天的节目单还没有生成', (M.daily && M.daily.label) || '登录网易云或 QQ 音乐后生成');
          var d = M.daily;
          return hd(d.label, i) +
            '<div class="fm-big"><b>' + d.count + '</b><span>首 · 今天的节目单</span><button class="fm-cta" type="button" data-act="daily:0">' + I.play + '<span>播放全部</span></button></div>' +
            '<div class="fm-list">' + d.preview.slice(0, 4).map(function (t, j) { return row(t, '<span class="at">' + String(j + 1).padStart(2, '0') + '</span>', null, 'daily:' + j); }).join('') + '</div>';
        }
        if (id === 'rec') {
          if (!stationAvailable(i)) return nosignal(i, '还没有听歌记录', '播放过的歌会按时间出现在这里。先登录平台，或导入本地音乐开始听吧。');
          return hd('最近播放 · 本地听歌记录', i) +
            '<div class="fm-list" style="margin-top:calc(var(--u)*14)">' + M.recent.slice(0, 5).map(function (t, j) { return row(t, '<span class="at">' + String(j + 1).padStart(2, '0') + '</span>', t.providerLabel || null, 'recent:' + j); }).join('') + '</div>';
        }
        if (id === 'lib') {
          var L = M.library || {};
          if (!(M.login && M.login.any) && !L.playlistCount) return nosignal(i, '音乐库还是空的', '登录后会同步你在各平台的歌单；本地音乐可以随时导入。');
          return hd('音乐库 · ' + (L.label || '本地音乐'), i) +
            '<div class="fm-stats">' +
            '<div class="fm-stat ro"><b>' + (L.playlistCount || 0) + '</b><span>个歌单</span></div>' +
            '<div class="fm-stat ro"><b>' + ((L.platforms || []).length) + '</b><span>' + esc((L.platforms || []).length ? '已连接 · ' + L.platforms.join(' / ') : '已连接平台') + '</span></div>' +
            '<div class="fm-stat ro"><b data-live="lm">' + (M.today.minutes || 0) + '</b><span>分钟 · 今日聆听</span></div>' +
            '<div class="fm-stat ro"><b data-live="ls">' + (M.today.streak || 0) + '</b><span>天 · 连续收听</span></div></div>' +
            '<div class="fm-btns" style="margin-top:calc(var(--u)*26)"><button class="fm-cta" type="button" data-act="lib">' + I.play + '<span>打开音乐库</span></button><button class="fm-cta ghost" type="button" data-act="import"><span>导入本地音乐</span></button></div>';
        }
        if (id === 'disc') {
          if (!stationAvailable(i)) return nosignal(i, '发现频道需要登录', (M.discover && M.discover.sub) || '登录后可用');
          var pk = (M.picks && M.picks.items) || [];
          return hd('发现 · ' + M.discover.sub, i) +
            '<div class="fm-big"><span style="font-size:calc(var(--u)*15);color:var(--ink)">' + esc(M.discover.sub) + '</span><button class="fm-cta" type="button" data-act="disc">' + I.play + '<span>去发现</span></button></div>' +
            (pk.length ? '<div class="fm-src">为你挑选 · <b>' + esc(M.picks.label || '') + '</b></div><div class="fm-list" style="margin-top:calc(var(--u)*4)">' +
              pk.slice(0, 4).map(function (t, j) { return row(t, '<span class="at">' + String(j + 1).padStart(2, '0') + '</span>', null, 'pick:' + j); }).join('') + '</div>' : '');
        }
        // radio
        if (!stationAvailable(i)) return nosignal(i, '电台还没有信号', (M.radio && M.radio.sub) || '登录后可用');
        var art = ((M.daily && M.daily.preview) || []).slice(0, 3);
        if (!art.length) art = (M.recent || []).slice(0, 3);
        return hd('电台 · ' + M.radio.sub, i) +
          (art.length ? '<div class="fm-stack">' + art.map(function (t) { return imgTag(t, 200); }).join('') + '</div>' : '') +
          '<div class="fm-lead">' + esc(M.radio.sub) + '</div>' +
          '<div class="fm-desc">不用挑歌，打开就一直放下去。</div>' +
          '<button class="fm-cta" type="button" data-act="radio" style="margin-top:calc(var(--u)*22)">' + I.play + '<span>开始收听</span></button>';
      }
      function trackSig(list, n) { return (list || []).slice(0, n).map(function (t) { return t ? t.key + ':' + (t.cover || '').length : ''; }).join(','); }
      function sigOf(i) {
        if (!M) return '';
        var id = STATIONS[i].id;
        if (id === 'cont') return M.now ? ['now', M.now.key, M.now.title, M.now.artist, M.now.album, (M.now.cover || '').length, M.now.providerLabel, trackSig(M.queue, 3), queueLeft()].join('|') : 'empty';
        if (id === 'daily') return [M.daily.label, M.daily.kind, M.daily.count, trackSig(M.daily.preview, 4)].join('|');
        if (id === 'rec') return trackSig(M.recent, 5);
        if (id === 'lib') return [M.library.playlistCount, M.library.label, (M.library.platforms || []).join(','), M.login.any].join('|');
        if (id === 'disc') return [M.discover.sub, M.discover.available, M.picks.label, trackSig(M.picks.items, 4)].join('|');
        return [M.radio.sub, M.radio.available, trackSig(M.daily.preview, 3), trackSig(M.recent, 3)].join('|');
      }
      function renderProg(i) {
        if (!M) return;
        el.prog.innerHTML = progHTML(i);
        progIdx = i; progSig = sigOf(i);
      }
      function liveProg() {
        if (!M || progIdx !== 0 || !M.now) return;
        var n = M.now;
        var set = function (k, v, html) { var e = el.prog.querySelector('[data-live=' + k + ']'); if (e) { if (html) { if (e.innerHTML !== v) e.innerHTML = v; } else if (e.textContent !== v) e.textContent = v; } };
        set('hd', contHeader()); set('hint', plateHint(n), true);
        var pi = el.prog.querySelector('.fm-pi'); if (pi && pi.innerHTML !== (n.playing ? I.pause : I.play)) pi.innerHTML = n.playing ? I.pause : I.play;
      }
      function liveLib() {
        if (!M || progIdx !== 3) return;
        var a = el.prog.querySelector('[data-live=lm]'), b = el.prog.querySelector('[data-live=ls]');
        if (a) a.textContent = String(M.today.minutes || 0);
        if (b) b.textContent = String(M.today.streak || 0);
      }

      // ---------- 动作分发 ----------
      function doAct(act, e) {
        if (!act) return;
        var parts = act.split(':'), k = parts[0], n = Number(parts[1]) || 0;
        if (k === 'resume') { if (M && M.now && M.now.playing) A.togglePlay(); else A.resume(); }
        else if (k === 'next') A.next();
        else if (k === 'immersive') { if (A.openImmersive) A.openImmersive(); }
        else if (k === 'queue') { if (A.playQueueItem) A.playQueueItem(n + 1); else A.next(); }
        else if (k === 'daily') A.playDaily(n);
        else if (k === 'recent') A.playRecent(n);
        else if (k === 'pick') A.playPick(n);
        else if (k === 'lib') A.openLibrary();
        else if (k === 'disc') A.openDiscover();
        else if (k === 'radio') A.openRadio();
        else if (k === 'login') A.openLogin();
        else if (k === 'import') A.importLocal();
      }
      on(el.prog, 'click', function (e) {
        var a = e.target.closest('[data-act]');
        if (!a || !el.prog.contains(a)) return;
        var act = a.getAttribute('data-act');
        if (act === 'seek') { var r = a.getBoundingClientRect(); A.seek(clamp((e.clientX - r.left) / r.width, 0, 1)); return; }
        doAct(act, e);
      });
      on(root.querySelector('.fm-face'), 'click', function (e) {
        var b = e.target.closest('[data-k]');
        if (!b) return;
        var k = b.getAttribute('data-k');
        if (k === 'prev') A.prev();
        else if (k === 'next') A.next();
        else if (k === 'play') A.togglePlay();
        else if (k === 'like') A.toggleLike();
        else if (k === 'lyr') A.toggleLyrics();
        else if (k === 'seek') { var r = b.getBoundingClientRect(); A.seek(clamp((e.clientX - r.left) / r.width, 0, 1)); }
        else if (k === 'meter') tuneTo(2);
        else if (k === 'immersive') { if (M && M.now && A.openImmersive) A.openImmersive(); }
      });
      on(el.rds, 'click', function () { A.nextQuote(); });
      on(el.stations, 'pointerdown', function (e) { if (e.target.closest('.fm-st')) e.stopPropagation(); });
      on(el.stations, 'click', function (e) { var b = e.target.closest('.fm-st'); if (b) tuneTo(Number(b.getAttribute('data-st'))); });
      // 搜索：只收集文字，回车交给软件自己的搜索面板
      function submitSearch() { var v = el.input.value.trim(); if (v) { A.search(v); el.input.value = ''; el.input.blur(); } else el.input.focus(); }
      // 输入法选词时的回车不算提交
      on(el.input, 'keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) submitSearch(); else if (e.key === 'Escape' && !e.isComposing) el.input.blur(); });
      on(el.input, 'focus', function () { el.seek.classList.add('focus'); });
      on(el.input, 'blur', function () { el.seek.classList.remove('focus'); });
      on(root.querySelector('.fm-tag'), 'click', function (e) { e.preventDefault(); submitSearch(); });

      // ---------- 调谐输入 ----------
      function nearest(f) { var bi = 0, bd = 1e9; for (var i = 0; i < STATIONS.length; i++) { var d = Math.abs(STATIONS[i].f - f); if (d < bd) { bd = d; bi = i; } } return [bi, bd]; }
      function xOfF(f, w) { return w * (0.05 + 0.90 * (f - FMIN) / (FMAX - FMIN)); }
      function fOfX(x, w) { return FMIN + (x / w - 0.05) / 0.90 * (FMAX - FMIN); }
      function tuneTo(i) {
        i = clamp(i, 0, STATIONS.length - 1);
        st.target = STATIONS[i].f; st.mode = 'seek'; st.lastInput = -1e9;
        if (RM) { st.f = st.target; st.v = 0; renderStatic(); } else kick();
      }
      on(root, 'wheel', function (e) {
        if (e.target.closest && e.target.closest('.fm-seek')) return;
        e.preventDefault();
        if (RM) { var nn = nearest(st.f)[0]; tuneTo(nn + ((e.deltaY || e.deltaX) > 0 ? 1 : -1)); return; }
        var d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (e.deltaMode === 1) d *= 40;
        st.target = clamp((st.mode === 'free' ? st.target : st.f) + clamp(d, -120, 120) * 0.0042, FMIN, FMAX);
        st.mode = 'free'; st.lastInput = performance.now(); kick();
      }, { passive: false });
      on(el.dial, 'pointerdown', function (e) {
        if (e.button !== 0) return;
        st.dragging = true;
        try { el.dial.setPointerCapture(e.pointerId); } catch (_e) { }
        st.target = clamp(fOfX(e.clientX - rootLeft(), W), FMIN, FMAX); st.mode = 'free'; st.lastInput = performance.now();
        if (RM) { st.f = st.target; renderStatic(); } else kick();
      });
      on(el.dial, 'pointermove', function (e) {
        if (!st.dragging) return;
        st.target = clamp(fOfX(e.clientX - rootLeft(), W), FMIN, FMAX); st.lastInput = performance.now();
        if (RM) { st.f = st.target; renderStatic(); } else kick();
      });
      function endDrag() {
        if (!st.dragging) return;
        st.dragging = false; st.lastInput = performance.now();
        if (RM) { st.f = st.target = STATIONS[nearest(st.f)[0]].f; renderStatic(); }
      }
      on(el.dial, 'pointerup', endDrag); on(el.dial, 'pointercancel', endDrag);
      // ← → 换台：软件全局快捷键（document 冒泡阶段，← → = 上一首/下一首）会先吃掉方向键，
      // 所以这里挂在 document 的捕获阶段，只在主题可见、没有弹窗、焦点不在输入框时接管
      function appOverlayOpen() {
        try { if (typeof hotkeyCaptureState !== 'undefined' && hotkeyCaptureState) return true; } catch (_e) { }
        if (document.querySelector('.modal-mask.show,.hotkey-modal.show')) return true;
        try { if (typeof miniQueueOpen !== 'undefined' && miniQueueOpen) return true; } catch (_e) { }
        try { if (typeof shelfManager !== 'undefined' && shelfManager && shelfManager.hasOpenContent && shelfManager.hasOpenContent()) return true; } catch (_e) { }
        return false;
      }
      function themeActive() {
        if (paused || destroyed || !root.isConnected) return false;
        try {
          if (typeof homeThemeHost !== 'undefined' && (!homeThemeHost.visible || homeThemeHost.switching || homeThemeHost.instanceId !== ID)) return false;
        } catch (_e) { }
        return true;
      }
      on(document, 'keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || e.isComposing) return;
        if (!themeActive()) return;
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable || (t.closest && t.closest('[contenteditable="true"]')))) return;
        if (t && t !== document.body && t !== document.documentElement && !root.contains(t) && !(t.closest && t.closest('#home-theme-cord'))) return;
        if (appOverlayOpen()) return;
        e.preventDefault();
        e.stopPropagation();
        tuneTo(nearest(st.target)[0] + (e.key === 'ArrowRight' ? 1 : -1));
      }, true);
      var rootRectLeft = 0;
      function rootLeft() { return rootRectLeft; }

      // ---------- 刻度盘 ----------
      var dg = el.dc.getContext('2d'), dW = 0, dH = 0, tickLayer = null, lastNeedle = -1;
      function sizeDial() {
        dW = el.dial.clientWidth; dH = el.dial.clientHeight;
        if (!dW || !dH) return;
        el.dc.width = Math.round(dW * DPR); el.dc.height = Math.round(dH * DPR);
        var off = document.createElement('canvas'); off.width = el.dc.width; off.height = el.dc.height;
        var g = off.getContext('2d'); g.scale(DPR, DPR);
        var u = dH / 170, y0 = 52 * u, y1 = 140 * u;
        var gb = g.createLinearGradient(0, y0, 0, y1);
        gb.addColorStop(0, 'rgba(255,190,130,.05)'); gb.addColorStop(0.5, 'rgba(255,150,90,.025)'); gb.addColorStop(1, 'rgba(255,190,130,.06)');
        g.fillStyle = gb; g.fillRect(0, y0, dW, y1 - y0);
        function hl(y, a) { var lg = g.createLinearGradient(0, 0, dW, 0); lg.addColorStop(0, 'rgba(255,200,150,0)'); lg.addColorStop(0.08, 'rgba(255,200,150,' + a + ')'); lg.addColorStop(0.92, 'rgba(255,200,150,' + a + ')'); lg.addColorStop(1, 'rgba(255,200,150,0)'); g.fillStyle = lg; g.fillRect(0, y, dW, 1); }
        hl(y0, 0.28); hl(y1, 0.18); hl(y0 + 3 * u, 0.07);
        var rf = g.createLinearGradient(0, y0, 0, y0 + 14 * u); rf.addColorStop(0, 'rgba(255,255,255,.05)'); rf.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rf; g.fillRect(0, y0, dW, 14 * u);
        g.shadowColor = 'rgba(255,150,80,.9)';
        for (var k = 0; k <= 205; k++) {
          var f = FMIN + k * 0.1, x = Math.round(xOfF(f, dW)) + 0.5;
          var whole = Math.abs(f - Math.round(f)) < 0.001, half = Math.abs(f * 2 - Math.round(f * 2)) < 0.001;
          var len = whole ? 30 * u : half ? 18 * u : 9 * u;
          g.shadowBlur = whole ? 8 : 3;
          g.strokeStyle = whole ? 'rgba(255,200,150,.85)' : half ? 'rgba(255,190,140,.5)' : 'rgba(255,190,140,.26)';
          g.lineWidth = whole ? 1.3 : 1;
          g.beginPath(); g.moveTo(x, y0 + 6 * u); g.lineTo(x, y0 + 6 * u + len); g.stroke();
        }
        g.font = '700 ' + Math.round(19 * u) + 'px "Bahnschrift Condensed","Arial Narrow","DejaVu Sans Condensed",sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.shadowBlur = 10; g.fillStyle = 'rgba(255,205,160,.82)';
        for (var ff = 88; ff <= 108; ff += 2) g.fillText(String(ff), xOfF(ff, dW), y1 - 12 * u);
        g.shadowBlur = 0;
        g.font = Math.round(10 * u) + 'px Consolas,"DejaVu Sans Mono",monospace'; g.fillStyle = 'rgba(255,200,160,.4)'; g.textAlign = 'left';
        g.fillText('FM', xOfF(FMIN, dW) - 30 * u, y1 - 14 * u);
        g.textAlign = 'right'; g.fillText('MHz', dW - 12 * u, y1 - 14 * u);
        STATIONS.forEach(function (S) { var sx = xOfF(S.f, dW); g.fillStyle = 'rgba(255,90,46,.7)'; g.beginPath(); g.moveTo(sx - 4 * u, y0 - 1); g.lineTo(sx + 4 * u, y0 - 1); g.lineTo(sx, y0 + 5 * u); g.fill(); });
        tickLayer = off;
        stEls.forEach(function (b, i) { b.style.left = xOfF(STATIONS[i].f, dW) + 'px'; });
        lastNeedle = -1;
      }
      function drawDial() {
        if (!tickLayer) return;
        var key = st.f.toFixed(4) + '|' + st.focus.toFixed(2);
        if (key === lastNeedle) return;
        lastNeedle = key;
        dg.setTransform(1, 0, 0, 1, 0, 0); dg.clearRect(0, 0, el.dc.width, el.dc.height);
        dg.drawImage(tickLayer, 0, 0);
        dg.setTransform(DPR, 0, 0, DPR, 0, 0);
        var u = dH / 170, x = xOfF(st.f, dW);
        var lg = dg.createRadialGradient(x, 95 * u, 0, x, 95 * u, 140 * u);
        lg.addColorStop(0, 'rgba(255,140,70,' + (0.14 + 0.1 * st.focus).toFixed(3) + ')'); lg.addColorStop(1, 'rgba(255,120,60,0)');
        dg.fillStyle = lg; dg.fillRect(x - 150 * u, 40 * u, 300 * u, 110 * u);
        dg.globalCompositeOperation = 'lighter';
        var top = 34 * u, bot = 158 * u;
        [[18, 0.05], [8, 0.12], [3.2, 0.35], [1.4, 1]].forEach(function (L) {
          var w = L[0], a = L[1];
          var ng = dg.createLinearGradient(0, top, 0, bot);
          ng.addColorStop(0, 'rgba(255,80,40,0)'); ng.addColorStop(0.15, 'rgba(255,90,46,' + a + ')');
          ng.addColorStop(0.55, 'rgba(255,' + (w < 2 ? 225 : 120) + ',' + (w < 2 ? 190 : 70) + ',' + a + ')');
          ng.addColorStop(0.9, 'rgba(255,90,46,' + a + ')'); ng.addColorStop(1, 'rgba(255,80,40,0)');
          dg.fillStyle = ng; dg.fillRect(x - w * u / 2, top, w * u, bot - top);
        });
        dg.globalCompositeOperation = 'source-over';
      }

      // ---------- WebGL 背景 ----------
      var G = null;
      var GL_FALLBACK_BG = 'radial-gradient(120% 80% at 50% 30%,#2a1418,#070406 70%)';
      try { G = createGL(el.gl); } catch (e) { console.warn('[fm-dial] webgl', e); G = null; }
      if (!G) el.gl.style.background = GL_FALLBACK_BG;
      if (G) {
        // 显卡重置 / 睡眠唤醒会丢上下文：丢失期间先垫一层渐变，恢复后重建着色器和缓冲
        // （丢失的画布浏览器会画成白底 / 破图，所以把画布藏起来，渐变垫在主题根节点上）
        on(el.gl, 'webglcontextlost', function (e) {
          e.preventDefault(); if (G) G.lost = true;
          el.gl.style.visibility = 'hidden'; root.style.background = GL_FALLBACK_BG;
        });
        on(el.gl, 'webglcontextrestored', function () {
          if (destroyed) return;
          var NG = null;
          try { NG = createGL(el.gl); } catch (e) { console.warn('[fm-dial] webgl restore', e); NG = null; }
          if (!NG) return; // 重建失败就一直用渐变兜底
          G = NG;
          el.gl.style.visibility = ''; root.style.background = '';
          sizeGL();
          if (paused) return;
          if (RM) renderStatic(); else kick();
        });
      }
      var dialY = 0.3;
      function sizeGL() {
        if (!G || G.lost) return;
        var gl = G.gl;
        // 画布本身就是半分辨率（柔和的背景，浏览器放大即可），后处理只在这个分辨率上做
        var cw = Math.max(2, Math.round(W * 0.5)), ch = Math.max(2, Math.round(H * 0.5));
        el.gl.width = cw; el.gl.height = ch;
        G.alloc(G.A, cw, ch);
        G.alloc(G.B, Math.max(2, Math.round(W / 8)), Math.max(2, Math.round(H / 8)));
      }
      function drawGL(t) {
        if (!G || G.lost) return;
        var gl = G.gl, S = G.scene, D = G.down, C = G.comp;
        gl.bindBuffer(gl.ARRAY_BUFFER, G.buf);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, G.A.fbo); gl.viewport(0, 0, G.A.w, G.A.h); gl.useProgram(S.p);
        gl.uniform2f(S.U.uRes, G.A.w, G.A.h); gl.uniform1f(S.U.uT, t); gl.uniform1f(S.U.uLock, st.focus);
        gl.uniform1f(S.U.uNeedle, W ? xOfF(st.f, W) / W : 0.1); gl.uniform1f(S.U.uDialY, dialY);
        gl.uniform3fv(S.U.uA, st.col[0]); gl.uniform3fv(S.U.uB, st.col[1]); gl.uniform3fv(S.U.uC, st.col[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, G.B.fbo); gl.viewport(0, 0, G.B.w, G.B.h); gl.useProgram(D.p);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.A.tex); gl.uniform1i(D.U.uS, 0);
        gl.uniform2f(D.U.uST, 1 / G.A.w, 1 / G.A.h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, el.gl.width, el.gl.height); gl.useProgram(C.p);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.A.tex); gl.uniform1i(C.U.uS, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, G.B.tex); gl.uniform1i(C.U.uBl, 1);
        gl.uniform2f(C.U.uBT, 1 / G.B.w, 1 / G.B.h); gl.uniform1f(C.U.uFocus, st.focus);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.activeTexture(gl.TEXTURE0);
      }

      // ---------- 物理：带惯性的指针，停下后吸附到最近的台 ----------
      function physics(dt, now) {
        var idle = now - st.lastInput;
        if (st.mode === 'free') {
          var prev = st.f;
          st.f += (st.target - st.f) * (1 - Math.exp(-dt * 14));
          st.v = (st.f - prev) / Math.max(dt, 1e-3);
          if (!st.dragging && idle > 220) { st.target = STATIONS[nearest(st.f)[0]].f; st.mode = 'spring'; }
        } else {
          var k = st.mode === 'seek' ? 34 : 150, c = st.mode === 'seek' ? 2 * Math.sqrt(k) * 0.66 : 2 * Math.sqrt(k) * 0.36;
          st.v += (k * (st.target - st.f) - c * st.v) * dt; st.f += st.v * dt;
          if (st.mode === 'seek' && Math.abs(st.target - st.f) < 0.05) st.mode = 'spring';
        }
        st.f = clamp(st.f, FMIN, FMAX);
      }

      // ---------- 对焦：模糊 → 换字 → 清晰 ----------
      function focusTarget() {
        var n = nearest(st.f), d = n[1];
        var f = 1 - smooth(0.04, 1.45, d);          // 离台越远越虚
        f *= Math.exp(-Math.abs(st.v) / 4.5);       // 指针还在快速移动时保持虚焦，不会在路过的台上闪一下
        if (st.shown !== n[0]) f = 0;               // 还没换字前，先完全失焦
        return f;
      }
      function blendColour(dt, snap) {
        var f = st.f, j = 0;
        while (j < STATIONS.length - 2 && f > STATIONS[j + 1].f) j++;
        var x = clamp((f - STATIONS[j].f) / (STATIONS[j + 1].f - STATIONS[j].f), 0, 1);
        var t = smooth(0.12, 0.88, x);
        var pa = palOf(j), pb = palOf(j + 1);
        var e = snap ? 1 : 1 - Math.exp(-dt * 4);
        for (var c = 0; c < 3; c++) {
          var want = mix3(pa[c], pb[c], t);
          st.col[c] = mix3(st.col[c], want, e);
        }
        var acc = v2hex(st.col[0]);
        if (acc !== applied.acc) {
          applied.acc = acc;
          root.style.setProperty('--acc', acc);
          root.style.setProperty('--acc2', v2hex(st.col[1]));
        }
      }
      function easeIO(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
      function applyFocus() {
        var pullE = easeIO(clamp(st.pull, 0, 1));
        var hf = st.focus * (st.pendingName ? 1 - pullE : 1);
        var pf = st.focus * (1 - pullE);
        var roll = RM ? 0 : st.roll;
        if (Math.abs(hf - applied.hero) > 0.002 || Math.abs(roll - applied.roll) > 0.002 || (hf === 1 && applied.hero !== 1) || (hf === 0 && applied.hero !== 0)) {
          applied.hero = hf; applied.roll = roll;
          var un = 1 - hf;
          if (un < 0.002 && Math.abs(roll) < 0.002) {
            el.name.style.filter = ''; el.name.style.opacity = ''; el.name.style.transform = ''; el.name.style.letterSpacing = '';
            el.sub.style.filter = ''; el.sub.style.opacity = ''; el.sub.style.transform = '';
            el.ghost.style.filter = ''; el.ghost.style.opacity = ''; el.ghost.style.transform = '';
          } else {
            el.name.style.filter = 'blur(' + (un * 18 * U).toFixed(2) + 'px)';
            el.name.style.opacity = (0.13 + 0.87 * Math.pow(hf, 1.2)).toFixed(3);
            // 滚筒：旧台名朝调谐方向滚出去，新台名从另一侧滚进来
            el.name.style.transform = 'translateY(' + (roll * 96 * U).toFixed(2) + 'px) rotateX(' + (-roll * 58).toFixed(2) + 'deg) scale(' + (1 + un * 0.025).toFixed(4) + ')';
            el.name.style.letterSpacing = (-0.02 + un * 0.07).toFixed(4) + 'em';
            el.sub.style.filter = 'blur(' + (un * 6 * U).toFixed(2) + 'px)';
            el.sub.style.opacity = (0.15 + 0.85 * hf).toFixed(3);
            el.ghost.style.filter = 'blur(' + (un * 10 * U).toFixed(2) + 'px)';
            el.ghost.style.opacity = (0.2 + 0.8 * hf).toFixed(3);
            el.ghost.style.transform = 'translateY(' + (roll * 70 * U).toFixed(2) + 'px) rotateX(' + (-roll * 34).toFixed(2) + 'deg)';
            el.sub.style.transform = 'translateY(' + (roll * 16 * U).toFixed(2) + 'px)';
          }
        }
        if (Math.abs(pf - applied.prog) > 0.002 || (pf === 1 && applied.prog !== 1) || (pf === 0 && applied.prog !== 0)) {
          applied.prog = pf;
          var up = 1 - pf;
          if (up < 0.002) { el.prog.style.filter = ''; el.prog.style.opacity = ''; el.prog.style.transform = ''; el.prog.style.pointerEvents = ''; }
          else {
            el.prog.style.filter = 'blur(' + (up * 12 * U).toFixed(2) + 'px)';
            el.prog.style.opacity = (0.05 + 0.95 * Math.pow(pf, 1.4)).toFixed(3);
            el.prog.style.transform = 'translateY(' + (up * 8 * U).toFixed(2) + 'px)';
            el.prog.style.pointerEvents = pf < 0.5 ? 'none' : '';
          }
        }
      }
      function showStation(i) {
        var prevShown = st.shown;
        st.shown = i;
        if (prevShown !== i && !RM) {
          var rd = Math.sign(STATIONS[i].f - STATIONS[prevShown].f) || 1;
          st.rollIn = true; st.rollDirIn = rd; st.roll = rd * (1 - st.focus);
        }
        el.nameTxt.textContent = stationName(i);
        el.en.textContent = stationEn(i);
        el.ghost.textContent = STATIONS[i].f.toFixed(1);
        renderProg(i);
        st.pull = 0; st.pullDir = 0; st.pendingName = false;
        if (M) { lastFace = ''; updateFace(); }
      }
      function updateIndicators(t) {
        var fq = 'FM ' + st.f.toFixed(1) + ' MHz';
        if (fq !== applied.fq) { applied.fq = fq; el.fq.textContent = fq; }
        var locked = st.focus > 0.85;
        var code = locked ? 'CH ' + String(st.shown + 1).padStart(2, '0') : 'SCANNING';
        if (code !== applied.fcode) { applied.fcode = code; el.fcode.textContent = code; el.fcode.classList.toggle('scan', !locked); }
        if (applied.ledT !== locked) { applied.ledT = locked; el.tuned.classList.toggle('on', locked); }
        var stereo = st.focus > 0.97;
        if (applied.ledS !== stereo) { applied.ledS = stereo; el.stereo.classList.toggle('on', stereo); }
        var onIdx = st.focus > 0.6 ? st.shown : -1;
        if (onIdx !== applied.onIdx) { applied.onIdx = onIdx; stEls.forEach(function (b, k) { b.classList.toggle('on', k === onIdx); }); }
        // 时钟冒号：2 秒一次的柔和呼吸，不闪
        var co = RM ? 1 : 0.62 + 0.38 * Math.cos(t * Math.PI);
        if (Math.abs(co - applied.colon) > 0.03) { applied.colon = co; el.colon.style.opacity = co.toFixed(2); }
        updateMeter();
      }
      function meterLevel() {
        if (!M) return 0;
        var m = M.today.minutes || 0, c = M.today.count || 0;
        if (!m && !c) return 1;
        return clamp(Math.round(3 + m / 6 + c * 0.1), 1, SEGN);
      }
      function updateMeter() {
        var n = Math.round(meterLevel() * (0.4 + 0.6 * st.focus));
        if (n === applied.seg) return;
        applied.seg = n;
        for (var i = 0; i < SEGN; i++) { var s = el.segs.children[i]; s.classList.toggle('lit', i < n); s.classList.toggle('hot', i >= 11 && i < n); }
      }

      function tick(t, dt, snap) {
        var n = nearest(st.f);
        st.idx = n[0];
        if (snap) { st.focus = 1; if (st.shown !== st.idx || progIdx !== st.idx) showStation(st.idx); }
        else {
          var ft = focusTarget();
          var rate = ft > st.focus ? 4.2 : 10;
          st.focus += (ft - st.focus) * (1 - Math.exp(-dt * rate));
          if (Math.abs(st.focus - ft) < 0.001) st.focus = ft;
          // 已经虚到看不清了才换字
          if (st.shown !== st.idx && st.focus < 0.06) showStation(st.idx);
          // 滚筒位置：离开时朝指针移动的方向滚出，换字后从另一侧滚回到正中
          if (st.idx !== st.shown) st.rollIn = false;
          if (st.rollIn && st.focus > 0.985) st.rollIn = false;
          var dirNow = Math.sign(st.f - STATIONS[st.shown].f);
          var rollT = st.rollIn ? st.rollDirIn * (1 - st.focus) : -dirNow * (1 - st.focus);
          st.roll += (rollT - st.roll) * (1 - Math.exp(-dt * 20));
          if (Math.abs(st.roll) < 0.0005 && rollT === 0) st.roll = 0;
          // 同一个台的数据变了（换歌等）：短暂失焦 → 换内容 → 对焦
          if (st.pullDir === 1) {
            st.pull = Math.min(1, st.pull + dt / 0.22);
            if (st.pull >= 1) {
              if (st.pendingName) { el.nameTxt.textContent = stationName(st.shown); el.en.textContent = stationEn(st.shown); }
              renderProg(st.shown); st.pullDir = -1;
            }
          } else if (st.pullDir === -1) {
            st.pull = Math.max(0, st.pull - dt / 0.45);
            if (st.pull <= 0) { st.pullDir = 0; st.pendingName = false; }
          }
        }
        blendColour(dt, snap);
        applyFocus();
        updateIndicators(t);
        drawDial();
        drawGL(t);
      }

      function frame(now) {
        raf = 0;
        if (!running || destroyed) return;
        var dt = Math.min(0.05, (now - st.last) / 1000); st.last = now;
        physics(dt, now);
        tick((now - st.t0) / 1000, dt, false);
        raf = requestAnimationFrame(frame);
      }
      function kick() {
        if (destroyed || paused || RM) return;
        if (!running) { running = true; st.last = performance.now(); raf = requestAnimationFrame(frame); }
      }
      function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
      function renderStatic() {
        if (destroyed) return;
        st.f = st.target = STATIONS[nearest(st.target)[0]].f; st.v = 0; st.mode = 'spring';
        tick(12.0, 0.016, true);
      }

      // ---------- 尺寸 ----------
      function measure() {
        W = root.clientWidth || window.innerWidth; H = root.clientHeight || window.innerHeight;
        U = Math.min(W / 1600, H / 900);
        DPR = Math.min(window.devicePixelRatio || 1, 1.5);
        var rr = root.getBoundingClientRect(); rootRectLeft = rr.left;
        var dr = el.dial.getBoundingClientRect();
        dialY = H ? 1 - ((dr.top - rr.top) + dr.height * 0.56) / H : 0.3;
        sizeGL(); sizeDial();
        applied.hero = -1; applied.prog = -1;
      }

      // ---------- 模型更新 ----------
      function updateClock() {
        var c = M.clock || {};
        var parts = String(c.time || '').split(':');
        if (el.hh.textContent !== (parts[0] || '')) el.hh.textContent = parts[0] || '';
        if (el.mm.textContent !== (parts[1] || '')) el.mm.textContent = parts[1] || '';
        var d1 = (c.month || '') + '月' + (c.day || '') + '日 ' + (c.weekday || ''), d2 = (EN_WD[c.weekday] || '') + ' · ' + (c.year || '');
        if (el.d1.textContent !== d1) el.d1.textContent = d1;
        if (el.d2.textContent !== d2) el.d2.textContent = d2;
        el.vfd.title = (c.time || '') + ' · ' + d1;
      }
      var lastFace = '';
      function updateFace() {
        var n = M.now, nx = M.next;
        var sig = [n ? n.key : '', n ? n.title : '', n ? n.artist : '', n ? n.album : '', nx ? nx.key : '', n && n.playing, n && n.liked, M.lyricsOn].join('|');
        if (sig !== lastFace) {
          lastFace = sig;
          el.oaS.textContent = n ? n.title : '未在播放';
          el.oaA.textContent = n ? (n.artist + (n.album ? ' · ' + n.album : '')) : '登录平台或导入本地音乐后，从这里开始';
          el.oaS.title = n ? n.title : ''; el.oaA.title = n ? el.oaA.textContent : '';
          el.oaN.innerHTML = nx ? '<i>NEXT</i>' + esc(nx.title) + ' — ' + esc(nx.artist) : '';
          // 在"继续播放"台上，右侧已经列出了接下来的歌，这里就不重复了
          el.oaN.style.display = nx && st.shown !== 0 ? '' : 'none';
          el.oaN.title = nx ? '下一首：' + nx.title : '';
          var playing = !!(n && n.playing);
          el.playIco.innerHTML = playing ? '<path d="M5 3.5h3.2v13H5zM11.8 3.5H15v13h-3.2z"/>' : '<path d="M6 3.5v13L17 10z"/>';
          el.playLbl.textContent = playing ? 'PAUSE' : 'PLAY';
          el.kPlay.classList.toggle('on', playing);
          el.kLike.classList.toggle('on', !!(n && n.liked));
          el.heart.setAttribute('fill', n && n.liked ? 'currentColor' : 'none');
          el.kLyr.classList.toggle('on', !!M.lyricsOn);
          el.kPrev.classList.toggle('dim', !n); el.kNext.classList.toggle('dim', !n); el.kLike.classList.toggle('dim', !n);
        }
        var pos = n ? n.position : 0, dur = n ? n.duration : 0, p = dur ? clamp(pos / dur, 0, 1) : 0;
        el.tNow.textContent = mmss(pos); el.tDur.textContent = mmss(dur);
        el.tf.style.width = (p * 100).toFixed(2) + '%'; el.th.style.left = (p * 100).toFixed(2) + '%';
      }
      var lastMeter = '';
      function updateMeterText() {
        var T = M.today || {};
        var sig = [T.minutes, T.count, T.topArtist].join('|');
        if (sig === lastMeter) return;
        lastMeter = sig;
        el.meterV.innerHTML = (T.minutes || T.count)
          ? '<b>' + (T.minutes || 0) + '</b>分钟<i>/</i><b>' + (T.count || 0) + '</b>首' + (T.topArtist ? '<i>/</i>最常听 ' + esc(T.topArtist) : '')
          : '<b>0</b>分钟<i>/</i>今天还没开始听';
        applied.seg = -1;
      }
      var lastQuote = null;
      function updateRds() {
        var qt = (M.quote && M.quote.text) || '';
        var key = qt + '|' + ((M.quote && M.quote.source) || '');
        if (key === lastQuote) return;
        lastQuote = key;
        el.rdsTxt.textContent = qt || '拨动刻度盘，找一个今晚的频道。';
        el.rds.title = qt ? ((M.quote.source ? M.quote.source + ' · ' : '') + '点一下换一句') : '';
        el.rds.style.display = '';
      }
      function updateStations() {
        stEls.forEach(function (b, i) {
          var nm = stationName(i);
          var bb = b.firstChild;
          if (bb.textContent !== nm) bb.textContent = nm;
          b.classList.toggle('na', !stationAvailable(i));
          b.title = stationAvailable(i) ? '调到 ' + nm : nm + ' · 登录后可用';
        });
      }

      var first = true;
      function update(model) {
        if (destroyed || !model) return;
        M = model;
        updateClock(); updateFace(); updateMeterText(); updateRds(); updateStations();
        refreshTints();
        if (first) {
          first = false;
          showStation(st.shown);
        } else if (progIdx === st.shown) {
          var sig = sigOf(st.shown);
          var nameChanged = el.nameTxt.textContent !== stationName(st.shown) || el.en.textContent !== stationEn(st.shown);
          if (sig !== progSig || nameChanged) {
            if (RM || paused || st.focus < 0.06) {
              el.nameTxt.textContent = stationName(st.shown); el.en.textContent = stationEn(st.shown); renderProg(st.shown);
            } else if (st.pullDir !== 1) {
              st.pullDir = 1; st.pendingName = nameChanged; progSig = sig; kick();
            }
          } else {
            liveProg(); liveLib();
          }
        }
        if (RM || paused) { if (RM && !paused) renderStatic(); }
      }

      // ---------- 启动 ----------
      measure();
      update(ctx.model());
      if (RM) renderStatic(); else kick();

      return {
        update: update,
        resize: function () { if (destroyed) return; measure(); if (RM) renderStatic(); },
        pause: function () { paused = true; stop(); },
        resume: function () {
          if (destroyed) return;
          paused = false;
          measure();
          if (RM) renderStatic(); else kick();
        },
        destroy: function () {
          destroyed = true; stop();
          cleanups.forEach(function (fn) { try { fn(); } catch (_e) { } });
          cleanups = [];
          tintImgs.forEach(function (img) { img.onload = img.onerror = null; try { img.src = ''; } catch (_e) { } });
          tintImgs = [];
          if (G) { G.dispose(); G = null; }
          tickLayer = null;
          root.innerHTML = '';
          root.style.removeProperty('--acc'); root.style.removeProperty('--acc2'); root.style.background = '';
        },
        // 测试用：直接把指针放到某个频率
        _debug: { st: st, tuneTo: tuneTo },
      };
    }
  });
})();
