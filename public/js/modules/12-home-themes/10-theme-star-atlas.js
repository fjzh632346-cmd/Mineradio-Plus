// ============================================================
// Home theme · 星图 (star-atlas) · 北斗天穹
// 一片真实星位的北天：北斗七星就是七个入口，斗口的指极线指向北极星——正在播放的歌；
// 北极星外圈是播放进度。银河竖在画面中间，底下是远近几层山脊和一排树影。
// 星空绕北天极极慢地摆动；偶尔有流星（统一辐射点）、火流星、人造卫星、远处的飞机；
// 光标附近的星会慢慢变亮，暗星和北极星随音乐轻轻起伏。点北斗的星，镜头推过去成一页。
// 作为桌面背景时会被放大：银河和山脊按实际像素烘焙（分几帧完成），放大也有细节。
// ============================================================
(function () {
  'use strict';

  var ID = 'star-atlas';
  var SERIF = '"Source Han Serif SC","Noto Serif SC","Noto Serif CJK SC","Songti SC","STSong","SimSun","宋体",serif';
  var SANS = '"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif';
  var THIN = '"Segoe UI Light","Segoe UI","Microsoft YaHei UI Light","Microsoft YaHei UI","Noto Sans CJK SC",sans-serif';
  var MONO = '"Cascadia Mono","Consolas","SFMono-Regular","Menlo",monospace';
  var DEG = Math.PI / 180;
  var ROT = -195;                 // 投影旋转：让北斗在北极星右下方展开
  var VIEW_Z = 2.4;               // 推近倍数

  // ---------- 小工具 ----------
  function hashStr(s) {
    var h = 2166136261 >>> 0; s = String(s || '');
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0 || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(sec) { sec = Math.max(0, Math.floor(Number(sec) || 0)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeIO(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---------- 星表（J2000，真实位置） ----------
  var CAT = {
    dubhe: [165.93, 61.75, 1.79, 1.07, '天枢'], merak: [165.46, 56.38, 2.37, 0.03, '天璇'], phecda: [178.46, 53.69, 2.44, 0.04, '天玑'],
    megrez: [183.86, 57.03, 3.31, 0.08, '天权'], alioth: [193.51, 55.96, 1.77, -0.02, '玉衡'], mizar: [200.98, 54.93, 2.23, 0.02, '开阳'],
    alkaid: [206.89, 49.31, 1.86, -0.19, '摇光'], alcor: [201.31, 54.99, 3.99, 0.16, '辅'], polaris: [37.95, 89.26, 1.98, 0.60, '北极星'],
    kochab: [222.68, 74.16, 2.08, 1.47, '帝'], pherkad: [230.18, 71.83, 3.05, 0.05, '太子'], yildun: [263.05, 86.59, 4.35, 0.03, ''],
    epsUMi: [251.49, 82.04, 4.21, 0.89, ''], zetUMi: [236.01, 77.79, 4.29, 0.04, ''], etaUMi: [244.38, 75.76, 4.95, 0.37, ''],
    caph: [2.29, 59.15, 2.27, 0.34, '王良一'], schedar: [10.13, 56.54, 2.24, 1.17, '王良四'], gamCas: [14.18, 60.72, 2.47, -0.15, '策'],
    ruchbah: [21.45, 60.24, 2.68, 0.13, '阁道三'], segin: [28.60, 63.67, 3.37, -0.15, '阁道二'], thuban: [211.10, 64.38, 3.65, -0.05, '右枢'],
    eltanin: [269.15, 51.49, 2.24, 1.52, '天棓四'], rastaban: [262.61, 52.30, 2.79, 0.98, '天棓三'], capella: [79.17, 45.99, 0.08, 0.80, '五车二'],
    vega: [279.23, 38.78, 0.03, 0.00, '织女一'], deneb: [310.36, 45.28, 1.25, 0.09, '天津四'], mirfak: [51.08, 49.86, 1.79, 0.48, '天船三'],
    alderamin: [319.64, 62.59, 2.45, 0.26, '天钩五'], muscida: [127.57, 60.72, 3.36, 0.86, ''], talitha: [134.80, 48.04, 3.14, 0.19, '上台一'],
    tania: [154.27, 42.91, 3.45, 0.03, '中台一'], alula: [169.62, 33.09, 3.49, 0.59, ''], cor: [194.01, 38.32, 2.89, -0.12, '常陈一']
  };
  var EN = {
    kochab: 'Kochab', pherkad: 'Pherkad', caph: 'Caph', schedar: 'Schedar', gamCas: 'γ Cas', ruchbah: 'Ruchbah', segin: 'Segin', thuban: 'Thuban',
    eltanin: 'Eltanin', rastaban: 'Rastaban', capella: 'Capella', vega: 'Vega', deneb: 'Deneb', mirfak: 'Mirfak', alderamin: 'Alderamin',
    talitha: 'Talitha', tania: 'Tania Borealis', cor: 'Cor Caroli'
  };
  var DIPPER = ['dubhe', 'merak', 'phecda', 'megrez', 'alioth', 'mizar', 'alkaid'];
  var DIPPER_LINES = [['dubhe', 'merak'], ['merak', 'phecda'], ['phecda', 'megrez'], ['megrez', 'dubhe'], ['megrez', 'alioth'], ['alioth', 'mizar'], ['mizar', 'alkaid']];
  // 七颗星 = 七个入口
  var ENTRY = { dubhe: 'daily', merak: 'lib', phecda: 'disc', megrez: 'radio', alioth: 'picks', mizar: 'recent', alkaid: 'search' };
  var STAR_OF = {}; Object.keys(ENTRY).forEach(function (k) { STAR_OF[ENTRY[k]] = k; });
  // 标签朝向（避开连线）
  var DIR = { dubhe: [-1, 0.1], merak: [-1, 0.35], phecda: [1, 0.3], megrez: [-1, -0.25], alioth: [1, 0.05], mizar: [1, 0.12], alkaid: [-1, 0.15] };

  function starColor(t) { // 0 暖 → 1 冷
    var warm = [1.0, 0.72, 0.48], mid = [1.0, 0.95, 0.88], cool = [0.66, 0.78, 1.0];
    var a = t < 0.5 ? warm : mid, b = t < 0.5 ? mid : cool, u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  }
  function bvColor(bv) { return starColor(1 - clamp((bv + 0.2) / 1.7, 0, 1)); }

  // ---------- 着色器 ----------
  var VS = 'attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }';
  var NOISE = [
    'float h11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }',
    'float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }',
    'vec2 h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }',
    'float vnoise2(vec2 x){ vec2 i=floor(x); vec2 f=fract(x); f=f*f*(3.-2.*f);',
    '  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }',
    'float fbm2(vec2 p){ float a=.5, s=0.; for(int i=0;i<6;i++){ s+=a*vnoise2(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7); a*=.5; } return s/0.985; }',
    'float fbm8(vec2 p){ float a=.5, s=0.; for(int i=0;i<8;i++){ s+=a*vnoise2(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7); a*=.5; } return s/0.996; }',
    'float ridged2(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ float n = 1.-abs(vnoise2(p)*2.-1.); s+=a*n*n; p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7); a*=.5; } return s; }'
  ].join('\n');

  // 银河 + 暗星：一次性烘焙（按实际像素，所以放大也细）
  var SKY_FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform vec4 uBox; uniform float uH; uniform float uTexPx;',
    'uniform vec2 uBandP; uniform vec2 uBandDir; uniform float uBandW; uniform float uCoreAlong; uniform float uMW; uniform vec3 uTint; uniform float uSeed;',
    NOISE,
    'vec3 starLayer(vec2 sp, float cell, float thr, float gain, float seed){',
    '  vec2 id = floor(sp/cell); vec2 r = h22(id+seed);',
    '  if(r.x < thr) return vec3(0.);',
    '  vec2 off = (0.2+0.6*h22(id*1.37+seed+7.1))*cell;',
    '  float d = length(sp - (id*cell+off));',
    '  float m = pow(h21(id+seed*3.7), 5.0)*gain + 0.06*gain;',
    '  float t = h21(id*2.1+seed);',
    '  vec3 c = mix(vec3(1.0,0.78,0.58), vec3(0.72,0.82,1.0), smoothstep(0.2,0.8,t));',
    '  c = mix(c, vec3(1.), 0.45);',
    '  return c * m * exp(-d*d/0.55);',
    '}',
    'void main(){',
    '  vec2 s = uBox.xy + vec2(vUv.x, 1.-vUv.y)*uBox.zw;',
    '  vec2 q = s/uH;',
    '  vec2 dir = normalize(uBandDir); vec2 perp = vec2(-dir.y, dir.x);',
    '  vec2 rel = q - uBandP;',
    '  float along = dot(rel, dir);',
    '  float across = dot(rel, perp) + 0.05*sin(along*2.3+uSeed) + 0.05*(fbm2(vec2(along*1.3, uSeed))-0.5);',
    '  float w = uBandW*(0.8+0.4*fbm2(vec2(along*0.9+4.0, 2.0)));',
    '  float core = exp(-pow((along-uCoreAlong)/0.6, 2.0));',
    '  float prof = exp(-across*across/(w*w));',
    '  float wide = exp(-across*across/(w*w*5.0));',
    '  vec2 bq = vec2(along, across)*3.0 + uSeed;',
    '  float cl = fbm2(bq); float cl2 = fbm2(bq*3.1+3.0); float cl3 = fbm8(bq*8.0+7.0);',
    '  float cl4 = fbm2(bq*22.0+11.0);',
    '  float mw = prof*(0.10 + 1.6*pow(cl, 3.0))*(0.4+1.2*core);',
    '  mw *= 0.35 + 1.1*cl2*cl2;',
    '  mw *= 0.6 + 0.8*cl3;',
    '  mw *= 0.85 + 0.3*cl4;',
    '  mw += wide*0.035*(0.4+cl);',
    // 暗尘：不规则的细丝 + 蜿蜒的大裂缝 + 更细一级的尘埃纹理
    '  vec2 dq = vec2(along*4.0, across*8.0);',
    '  dq += 2.2*vec2(fbm2(dq*0.4+1.0), fbm2(dq*0.4+8.0));',
    '  float fil = smoothstep(0.50, 0.95, ridged2(dq*0.9 + uSeed*1.3));',
    '  float fil2 = smoothstep(0.55, 0.9, ridged2(dq*2.3 + 11.0));',
    '  float fil3 = smoothstep(0.6, 0.95, ridged2(dq*6.1 + 23.0));',
    '  float riftC = 0.35*w*(fbm2(vec2(along*1.6, 9.0))-0.5)*2.0;',
    '  float riftW = w*(0.12 + 0.30*fbm2(vec2(along*2.2, 3.0)));',
    '  vec2 rq = vec2(along*5.0, across*9.0); rq += 1.5*vec2(fbm2(rq*0.5), fbm2(rq*0.5+4.0));',
    '  float rift = exp(-pow((across-riftC)/riftW, 2.0)) * smoothstep(0.35, 0.7, fbm8(rq+5.0));',
    '  float dustAmt = clamp(fil*prof*0.7 + fil2*prof*0.35 + fil3*prof*0.18 + rift*0.9*prof, 0., 0.96);',
    '  vec3 cWarm = vec3(1.0, 0.80, 0.58), cCool = vec3(0.60, 0.70, 1.0);',
    '  vec3 mwc = mix(cCool, cWarm, clamp(core*0.85 + 0.35*cl2 - 0.2, 0., 1.));',
    '  mwc = mix(mwc, uTint, 0.2);',
    '  vec3 col = mwc * mw * uMW * (1.0 - dustAmt);',
    '  col += vec3(0.05,0.03,0.015)*fil*prof*(1.-rift)*uMW*0.25;',
    '  float hii = smoothstep(0.74, 0.92, fbm2(bq*1.9+17.0)) * prof * (1.-dustAmt);',
    '  col += vec3(0.55,0.14,0.20)*hii*0.07*uMW;',
    '  float bgn = fbm2(q*1.4+uSeed);',
    '  col += mix(vec3(0.0012,0.0018,0.004), vec3(0.0030,0.0040,0.0085), bgn);',
    '  vec2 sp = s*uTexPx;',
    '  float dens = clamp(prof*(0.6+cl)*1.2 + wide*0.3, 0., 1.);',
    '  col += starLayer(sp, 2.0, 0.985 - 0.30*dens*mw*6.0, 0.22, 9.0) * (1.-dustAmt);',
    '  col += starLayer(sp, 3.0, 0.93 - 0.10*dens, 0.30, 1.0) * (1.-dustAmt*0.8);',
    '  col += starLayer(sp, 5.0, 0.86 - 0.10*dens, 0.45, 2.0) * (1.-dustAmt*0.7);',
    '  col += starLayer(sp, 11.0, 0.82 - 0.06*dens, 0.9, 3.0) * (1.-dustAmt*0.5);',
    '  col += starLayer(sp, 23.0, 0.80, 1.3, 4.0);',
    '  col = 1.0 - exp(-col*1.1);',
    '  col = pow(col, vec3(1.0/2.0));',
    '  col += (h21(gl_FragCoord.xy)-0.5)/255.0;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  // 每帧：采样烘焙好的天空（旋转 + 视差 + 推近镜头），推近时叠一层程序生成的细星
  var COMP_FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uSky; uniform vec4 uBox; uniform vec2 uView; uniform vec2 uPole; uniform vec2 uOff; uniform float uAng;',
    'uniform vec3 uCam; uniform vec2 uA; uniform float uMW; uniform float uDeep; uniform float uDpr; uniform float uTime; uniform float uFade;',
    'float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }',
    'vec2 h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }',
    'void main(){',
    '  vec2 p = vec2(vUv.x, 1.-vUv.y)*uView;',
    '  vec2 base = (p - uA)/uCam.z + uCam.xy;',
    '  vec2 d = base - uOff - uPole;',
    '  float c = cos(-uAng), s = sin(-uAng);',
    '  vec2 w = uPole + vec2(c*d.x - s*d.y, s*d.x + c*d.y);',
    '  vec2 uv = (w - uBox.xy)/uBox.zw;',
    '  vec3 col = texture2D(uSky, vec2(uv.x, 1.-uv.y)).rgb * uMW;',
    '  if(uDeep > 0.002){',
    '    vec2 cellw = vec2(2.6);',
    '    vec2 id = floor(w/cellw); vec2 r = h22(id+17.0);',
    '    if(r.x > 0.86){',
    '      vec2 o = (id + 0.2 + 0.6*h22(id*1.7+3.0))*cellw;',
    '      float ds = length(w - o)*uCam.z*uDpr;',
    '      float m = pow(h21(id+5.1), 4.0)*0.55 + 0.05;',
    '      vec3 sc = mix(vec3(1.0,0.86,0.72), vec3(0.78,0.86,1.0), h21(id*3.1));',
    '      col += sc*m*exp(-ds*ds/0.7)*uDeep;',
    '    }',
    '  }',
    '  col *= uFade;',
    '  col += (h21(gl_FragCoord.xy + fract(uTime)*97.0)-0.5)/255.0*1.5;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var STAR_VS = [
    'attribute vec2 aPos; attribute vec4 aInfo; attribute vec3 aCol;',
    'uniform vec2 uView; uniform vec2 uPole; uniform float uAng; uniform float uDpr; uniform float uTime; uniform vec2 uOff; uniform float uEnergy;',
    'uniform vec3 uCam; uniform vec2 uA; uniform float uTw; uniform float uFade;',
    'varying vec3 vCol; varying float vB;',
    'void main(){',
    '  vec2 d = aPos - uPole; float c = cos(uAng), s = sin(uAng);',
    '  vec2 base = uPole + vec2(c*d.x - s*d.y, s*d.x + c*d.y) + uOff;',
    '  vec2 p = (base - uCam.xy)*uCam.z + uA;',
    '  gl_Position = vec4(p.x/uView.x*2.-1., 1.-p.y/uView.y*2., 0., 1.);',
    '  float tw = 1.0 + 0.10*uEnergy*step(aInfo.x, 20.0) + uTw*aInfo.w*(1.0+uEnergy)*(0.55*sin(uTime*(1.7+aInfo.z*3.1)+aInfo.z*40.0) + 0.45*sin(uTime*(3.3+aInfo.z*2.3)+aInfo.z*13.0));',
    '  vB = aInfo.y*tw*uFade;',
    '  gl_PointSize = aInfo.x*uDpr*(1.0 + (uCam.z-1.0)*0.3);',
    '  vCol = aCol;',
    '}'
  ].join('\n');
  var STAR_FS = [
    'precision highp float;',
    'varying vec3 vCol; varying float vB;',
    'void main(){',
    '  vec2 d = gl_PointCoord - 0.5; float r = length(d)*2.0;',
    '  float core = exp(-r*r*90.0);',
    '  float glow = exp(-r*9.0)*0.35 + exp(-r*r*14.0)*0.25;',
    '  float fade = 1.0 - smoothstep(0.7, 1.0, r);',
    '  gl_FragColor = vec4((vec3(1.0)*core*1.3 + vCol*glow) * vB * fade, 0.0);',
    '}'
  ].join('\n');

  // 地平线：远近三层山脊 + 树影 + 远处小镇的灯 + 气辉 + 光污染的暖色光罩（一次性烘焙）
  var HOR_FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform vec4 uBox; uniform float uH; uniform float uW; uniform float uPx;',
    NOISE,
    'float ridge(float x, float base, float amp, float sc, float seed){',
    '  return base + amp*(fbm2(vec2(x*sc, seed))-0.5) + amp*0.35*(ridged2(vec2(x*sc*2.3, seed+4.))-0.4) + 0.0035*(fbm8(vec2(x*55.0, seed+9.))-0.5);',
    '}',
    'float trees(float x, float y, float seed, float dens, float hmin, float hmax, float cw){',
    '  float i = floor(x/cw); float t = 0.;',
    '  for(int j=-2;j<=2;j++){',
    '    float cell = i + float(j);',
    '    vec2 r = h22(vec2(cell, seed));',
    '    float clusterMask = smoothstep(0.42, 0.62, fbm2(vec2(cell*cw*2.6, seed)));',
    '    if(r.x > dens*clusterMask) continue;',
    '    float cx = (cell + 0.5 + (r.y-0.5)*0.7)*cw;',
    '    float ht = mix(hmin, hmax, h21(vec2(cell, seed+3.)));',
    '    float bse = ridge(cx, 0.905, 0.08, 2.1, 5.0) + 0.004;',
    '    float rel = (bse - y)/ht;',
    '    if(rel < -0.02 || rel > 1.0) continue;',
    '    float tier = fract(rel*(6.0 + 3.0*r.y) + r.x*3.0);',
    '    float hw = cw*0.62*(1.0-rel)*(0.62 + 0.38*tier)*(0.9+0.2*vnoise2(vec2(y*900.0, cell)));',
    '    hw = max(hw, rel < 0.12 ? cw*0.06 : 0.0);',
    '    t = max(t, 1.0 - smoothstep(hw - uPx, hw + uPx, abs(x - cx)));',
    '  }',
    '  return t;',
    '}',
    'void main(){',
    '  vec2 p = uBox.xy + vec2(vUv.x, 1.-vUv.y)*uBox.zw;',
    '  float x = p.x/uH; float y = p.y/uH; float xr = uW/uH;',
    '  float r0 = ridge(x, 0.842, 0.075, 1.7, 9.0);',
    '  float r1 = ridge(x, 0.845, 0.10, 1.3, 1.0);',
    '  float r2 = ridge(x, 0.905, 0.08, 2.1, 5.0);',
    '  vec3 col = vec3(0.); float a = 0.;',
    // 气辉：地平线上方一层极淡、带波纹的青绿，更高处一点暗红
    '  float hy = 0.86;',
    '  float up = max(hy - y, 0.);',
    '  float wave = 1.0 + 0.45*sin(x*16.0 + 3.0*fbm2(vec2(x*2.5, y*6.0)) + y*55.0);',
    '  vec3 air = vec3(0.030,0.060,0.040)*exp(-up/0.09)*wave + vec3(0.030,0.012,0.012)*exp(-pow((up-0.22)/0.08,2.0))*0.8;',
    '  float dome = exp(-pow((x - xr*0.82)/0.33, 2.0));',
    '  air += vec3(0.10,0.058,0.030)*dome*exp(-up/0.10);',
    '  col += air;',
    // 最远一层：几乎融进天光
    '  float m0 = smoothstep(r0-uPx, r0+uPx, y);',
    '  vec3 c0 = vec3(0.030,0.036,0.048) + vec3(0.03,0.028,0.022)*dome*0.6 + vec3(0.02,0.022,0.02)*exp(-(y-r0)/0.012);',
    '  col = mix(col, c0, m0); a = max(a, m0);',
    // 远山
    '  float m1 = smoothstep(r1-uPx, r1+uPx, y);',
    '  vec3 c1 = vec3(0.016,0.021,0.030) + vec3(0.018,0.02,0.018)*exp(-(y-r1)/0.018) + vec3(0.02,0.012,0.006)*dome*exp(-(y-r1)/0.05);',
    '  c1 *= 0.85 + 0.3*fbm2(vec2(x*30.0, y*30.0));',
    // 远山上的灯：光罩下面稀疏的暖色小点
    '  vec2 lc = vec2(x, y)*uH/2.2; vec2 lid = floor(lc);',
    '  float lr = h21(lid + 41.0);',
    '  if(lr > 0.9975 - 0.012*dome*dome && y > r1 + 0.006 && y < r1 + 0.05){',
    '    vec2 lo = (lid + 0.5)*2.2/uH; float ld = length(vec2(x,y) - lo)/uPx;',
    '    c1 += vec3(1.0,0.70,0.40)*exp(-ld*ld/0.5)*(0.35 + 0.65*h21(lid+7.0))*(0.25 + 0.75*dome);',
    '  }',
    '  col = mix(col, c1, m1); a = max(a, m1);',
    // 近山 + 树影
    '  float m2 = smoothstep(r2-uPx, r2+uPx, y);',
    '  float tr = trees(x, y, 13.0, 0.75, 0.016, 0.042, 0.0105);',
    '  float m2t = max(m2, tr);',
    '  vec3 c2 = vec3(0.0055,0.0065,0.0095)*(0.8 + 0.4*fbm2(vec2(x*60.0, y*60.0))) + vec3(0.006,0.007,0.008)*exp(-max(y-r2,0.)/0.006);',
    '  col = mix(col, c2, m2t); a = max(a, m2t);',
    '  col += (h21(gl_FragCoord.xy)-0.5)/255.;',
    '  gl_FragColor = vec4(col, a);',
    '}'
  ].join('\n');

  var HORDRAW_FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex; uniform vec4 uBox; uniform vec2 uView; uniform vec2 uOff; uniform float uAlpha;',
    'void main(){',
    '  vec2 p = vec2(vUv.x, 1.-vUv.y)*uView - uOff;',
    '  vec2 uv = (p - uBox.xy)/uBox.zw;',
    '  if(uv.x < 0. || uv.x > 1. || uv.y > 1.){ gl_FragColor = vec4(0.); return; }',
    '  vec4 c = uv.y < 0. ? vec4(0.) : texture2D(uTex, vec2(uv.x, 1.-uv.y));',
    '  gl_FragColor = c*uAlpha;',
    '}'
  ].join('\n');

  var VIG_FS = 'precision highp float; varying vec2 vUv; uniform vec2 uView; uniform float uAmt; uniform vec2 uFocus;' +
    'void main(){ vec2 p = vUv - uFocus; p.x *= uView.x/uView.y; float v = 1.0 - uAmt*smoothstep(0.35, 1.25, length(p)); gl_FragColor = vec4(vec3(v),1.0); }';

  // ---------- 样式 ----------
  var P = '.hth-' + ID;
  var CSS = [
    P + '{--iv:236,230,216;--gold:201,168,106;background:#020308;color:rgb(var(--iv));font-family:' + SERIF + ';overflow:hidden;user-select:none;-webkit-user-select:none}',
    P + ' .sa-gl,' + P + ' .sa-ov{position:absolute;left:0;top:0;width:100%;height:100%;display:block}',
    P + ' .sa-ov{pointer-events:none}',
    P + ' .sa-gl{opacity:0;transition:opacity 1.4s ease}',
    P + ' .sa-gl.on{opacity:1}',
    // [修] 没有 WebGL / 上下文丢了一直没恢复：用一层渐变代替，别是一片纯黑
    P + '.sa-nogl{background:radial-gradient(60% 45% at 20% 34%,rgba(40,48,78,.35),rgba(0,0,0,0) 70%),linear-gradient(100deg,rgba(0,0,0,0) 36%,rgba(120,120,150,.07) 46%,rgba(170,150,130,.09) 50%,rgba(120,120,150,.06) 54%,rgba(0,0,0,0) 64%),linear-gradient(#060913,#03050b 62%,#010205)}',
    P + '.sa-nogl .sa-gl{opacity:0}',
    P + ' .sa-ui{position:absolute;inset:0;pointer-events:none}',
    P + ' .sa-ui>*{pointer-events:auto}',
    P + ' button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;outline:none}',
    P + ' button:focus-visible{outline:1px solid rgba(var(--iv),.4);outline-offset:4px}',
    // 顶部：每日一句、搜索
    P + ' .sa-quote{position:absolute;left:50%;top:40px;transform:translateX(-50%);max-width:min(44vw,calc(100vw - 2 * var(--hth-safe-r,300px)));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:400 12.5px/1.5 ' + SERIF + ';letter-spacing:.24em;color:rgba(var(--iv),.3);transition:color .5s,opacity .8s}',
    P + ' .sa-quote:hover{color:rgba(var(--iv),.62)}',
    P + ' .sa-quote small{font-size:11px;letter-spacing:.12em;color:rgba(var(--iv),.22);margin-left:1.2em}',
    P + ' .sa-search{position:absolute;left:112px;top:36px;display:flex;align-items:center;gap:10px;width:220px;padding:6px 0 7px;border-bottom:1px solid rgba(var(--iv),0);transition:border-color .5s,opacity .8s}',
    P + ' .sa-search:hover{border-bottom-color:rgba(var(--iv),.16)}',
    P + ' .sa-search.f{border-bottom-color:rgba(var(--iv),.34)}',
    P + ' .sa-search svg{width:14px;height:14px;flex:none;stroke:rgba(var(--iv),.42);fill:none;transition:stroke .4s}',
    P + ' .sa-search:hover svg,' + P + ' .sa-search.f svg{stroke:rgba(var(--iv),.85)}',
    P + ' .sa-search input{flex:1;min-width:0;background:none;border:0;outline:0;color:rgba(var(--iv),.92);font:400 13px/1.2 ' + SANS + ';letter-spacing:.1em}',
    P + ' .sa-search input::placeholder{color:rgba(var(--iv),.28)}',
    // 正在播放
    P + ' .sa-np,' + P + ' .sa-empty{position:absolute;left:clamp(56px,7vw,170px);bottom:clamp(120px,19vh,260px);width:min(700px,42vw);transition:opacity .7s,transform .9s cubic-bezier(.2,.7,.2,1)}',
    P + ' .sa-k{font-size:clamp(11px,.62vw,13px);letter-spacing:.5em;color:rgba(var(--gold),.62);white-space:nowrap}',
    P + ' .sa-title{display:block;text-align:left;font-weight:300;font-size:clamp(40px,5vw,92px);letter-spacing:.12em;line-height:1.16;margin:.28em 0 .22em;text-shadow:0 0 40px rgba(0,0,0,.85);' +
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-all;transition:filter .5s,opacity .5s,color .4s}',
    P + ' .sa-title.l1{font-size:clamp(32px,3.4vw,64px)}',
    P + ' .sa-title.l2{font-size:clamp(28px,2.8vw,52px);letter-spacing:.08em}',
    P + ' .sa-title.l3{font-size:clamp(24px,2.3vw,42px);letter-spacing:.06em}',
    P + ' .sa-title:hover{color:#fff}',
    P + ' .sa-title.swap{filter:blur(10px);opacity:0}',
    P + ' .sa-meta{font-size:clamp(13px,.8vw,16px);letter-spacing:.2em;color:rgba(var(--iv),.52);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    P + ' .sa-meta i{font-style:normal;color:rgba(var(--iv),.26);margin:0 .6em}',
    P + ' .sa-meta em{font-style:normal;font-size:.8em;letter-spacing:.14em;color:rgba(var(--gold),.5);margin-left:1em}',
    P + ' .sa-row{display:flex;align-items:center;gap:clamp(14px,1.2vw,24px);margin-top:clamp(18px,2.4vh,30px)}',
    P + ' .sa-ib{width:34px;height:34px;display:grid;place-items:center;opacity:.62;transition:opacity .3s,transform .3s}',
    P + ' .sa-ib:hover{opacity:1}',
    P + ' .sa-ib svg{width:15px;height:15px;fill:rgb(var(--iv))}',
    P + ' .sa-pp{width:48px;height:48px;border:1px solid rgba(var(--iv),.28);border-radius:50%;opacity:.85}',
    P + ' .sa-pp:hover{border-color:rgba(var(--iv),.6)}',
    P + ' .sa-like svg{fill:none;stroke:rgb(var(--iv));stroke-width:1.1}',
    P + ' .sa-like.on{opacity:1}',
    P + ' .sa-like.on svg{fill:rgb(214,120,120);stroke:rgb(214,120,120)}',
    P + ' .sa-lyr{font:400 13px/1 ' + SERIF + ';letter-spacing:0}',
    P + ' .sa-lyr.on{opacity:1;color:rgb(var(--gold))}',
    P + ' .sa-time{font:300 clamp(14px,.9vw,17px)/1 ' + THIN + ';letter-spacing:.08em;color:rgba(var(--iv),.5);font-variant-numeric:tabular-nums;margin-left:6px;white-space:nowrap}',
    P + ' .sa-next{display:block;margin-top:clamp(14px,1.8vh,22px);max-width:100%;text-align:left;font-size:12px;letter-spacing:.16em;color:rgba(var(--iv),.34);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .4s}',
    P + ' .sa-next small{font-size:11px;letter-spacing:.3em;color:rgba(var(--gold),.45);margin-right:1em}',
    P + ' .sa-next:hover{color:rgba(var(--iv),.75)}',
    P + ' .sa-empty .sa-title{cursor:default}',
    P + ' .sa-empty p{font-size:13px;letter-spacing:.16em;line-height:2;color:rgba(var(--iv),.42);margin:0}',
    P + ' .sa-acts{display:flex;flex-wrap:wrap;gap:14px;margin-top:22px}',
    P + ' .sa-btn{padding:10px 22px;border:1px solid rgba(var(--iv),.3);border-radius:22px;font-size:13px;letter-spacing:.2em;color:rgba(var(--iv),.85);transition:border-color .3s,background .3s,color .3s;white-space:nowrap}',
    P + ' .sa-btn:hover{border-color:rgba(var(--iv),.7);background:rgba(var(--iv),.06);color:#fff}',
    P + ' .sa-btn.sec{border-color:rgba(var(--iv),.14);color:rgba(var(--iv),.6)}',
    P + '.hth-sa-isempty .sa-np{display:none}',
    P + ':not(.hth-sa-isempty) .sa-empty{display:none}',
    // 北极星
    P + ' .sa-ring{position:absolute;border-radius:50%;transform:translate(-50%,-50%);cursor:pointer}',
    P + '.hth-sa-isempty .sa-ring{cursor:default}',
    P + ' .sa-pol{position:absolute;white-space:nowrap;pointer-events:none;transition:opacity .7s}',
    P + ' .sa-pol .cn{font-size:11px;letter-spacing:.45em;color:rgba(var(--gold),.85)}',
    P + ' .sa-pol .sb{font-size:11px;letter-spacing:.2em;color:rgba(var(--iv),.28);margin-top:5px}',
    // 北斗的七个入口
    P + ' .sa-lab{position:absolute;transform:translate(0,-50%);white-space:nowrap;text-align:left;transition:opacity .7s}',
    P + ' .sa-lab.left{transform:translate(-100%,-50%);text-align:right}',
    P + ' .sa-lab .cn{display:block;font-size:11px;letter-spacing:.35em;color:rgba(var(--gold),.58);margin-bottom:3px;transition:color .3s}',
    P + ' .sa-lab .n{display:block;font-size:clamp(17px,1.05vw,22px);letter-spacing:.14em;color:rgb(var(--iv));text-shadow:0 0 18px rgba(0,0,0,.9);transition:color .3s}',
    P + ' .sa-lab .s{display:block;font-size:11px;letter-spacing:.12em;color:rgba(var(--iv),.3);margin-top:4px;max-width:18em;overflow:hidden;text-overflow:ellipsis}',
    P + ' .sa-lab:hover .n{color:#fff}',
    P + ' .sa-lab:hover .cn{color:rgb(var(--gold))}',
    P + ' .sa-lab.off .n{color:rgba(var(--iv),.45)}',
    // 时钟
    P + ' .sa-clock{position:absolute;right:clamp(40px,4vw,96px);bottom:clamp(28px,4.4vh,64px);text-align:right;pointer-events:none;transition:opacity .7s}',
    P + ' .sa-clock .t{font:200 clamp(38px,3.4vw,68px)/1 ' + THIN + ';letter-spacing:.05em;color:rgba(var(--iv),.72);font-variant-numeric:tabular-nums}',
    P + ' .sa-clock .d{margin-top:10px;font-size:12px;letter-spacing:.3em;color:rgba(var(--iv),.4)}',
    P + ' .sa-clock .s{margin-top:8px;font-size:11px;letter-spacing:.14em;color:rgba(var(--iv),.28);white-space:nowrap}',
    P + ' .sa-clock .s b{font-weight:400;color:rgba(var(--iv),.55);margin:0 .2em}',
    P + ' .sa-tip{position:absolute;pointer-events:none;white-space:nowrap;font-size:11px;letter-spacing:.24em;color:rgba(var(--iv),.72);text-shadow:0 0 12px #000;opacity:0;transition:opacity .5s}',
    P + ' .sa-tip span{color:rgba(var(--iv),.34);margin-left:.8em;letter-spacing:.12em}',
    // 推近后的页面
    P + ' .sa-dv{position:absolute;left:clamp(56px,7vw,170px);top:clamp(130px,17vh,220px);bottom:clamp(90px,13vh,170px);width:min(480px,33vw);display:flex;flex-direction:column;opacity:0;visibility:hidden;transform:translateX(-18px);transition:opacity .6s,transform .8s cubic-bezier(.2,.7,.2,1),visibility 0s .8s}',
    P + '.sa-in-dv .sa-dv{opacity:1;visibility:visible;transform:none;transition:opacity .8s .35s,transform 1s .3s cubic-bezier(.2,.7,.2,1)}',
    P + ' .sa-dv .cn{font-size:11px;letter-spacing:.5em;color:rgba(var(--gold),.7)}',
    P + ' .sa-dv h2{font-weight:300;font-size:clamp(30px,2.6vw,50px);letter-spacing:.14em;margin:.3em 0 .25em;line-height:1.2}',
    P + ' .sa-dv .sub{font-size:12.5px;letter-spacing:.16em;color:rgba(var(--iv),.45);line-height:1.8}',
    P + ' .sa-dv .sa-acts{margin-top:18px}',
    P + ' .sa-dv ul{position:relative;list-style:none;margin:22px 0 0;padding:0 8px 0 0;overflow-y:auto;flex:1;min-height:0;scrollbar-width:thin;scrollbar-color:rgba(var(--iv),.15) transparent;-webkit-mask:linear-gradient(#000 88%,transparent)}',
    P + ' .sa-dv ul::-webkit-scrollbar{width:4px}',
    P + ' .sa-dv ul::-webkit-scrollbar-thumb{background:rgba(var(--iv),.14);border-radius:2px}',
    P + ' .sa-dv li{display:flex;align-items:center;gap:14px;padding:9px 0;border-bottom:1px solid rgba(var(--iv),.06);cursor:pointer;transition:background .3s}',
    P + ' .sa-dv li .i{flex:none;width:2.2em;font:300 11px/1 ' + MONO + ';color:rgba(var(--gold),.5);letter-spacing:.05em}',
    P + ' .sa-dv li .tx{flex:1;min-width:0}',
    P + ' .sa-dv li .a{display:block;font-size:14.5px;letter-spacing:.1em;color:rgba(var(--iv),.82);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .3s}',
    P + ' .sa-dv li .b{display:block;font-size:11px;letter-spacing:.1em;color:rgba(var(--iv),.32);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    P + ' .sa-dv li .o{flex:none;font-size:11px;letter-spacing:.2em;padding:5px 10px;border:1px solid rgba(var(--iv),.14);border-radius:12px;color:rgba(var(--iv),.5);opacity:0;transition:opacity .3s,border-color .3s,color .3s}',
    P + ' .sa-dv li:hover .o,' + P + ' .sa-dv li.hl .o{opacity:1}',
    P + ' .sa-dv li .o:hover{border-color:rgba(var(--iv),.5);color:#fff}',
    P + ' .sa-dv li:hover .a,' + P + ' .sa-dv li.hl .a{color:#fff}',
    P + ' .sa-dv li.hl{background:linear-gradient(90deg,rgba(var(--iv),.05),transparent)}',
    P + ' .sa-dv .msg{margin-top:26px;font-size:13px;letter-spacing:.16em;line-height:2;color:rgba(var(--iv),.45)}',
    P + ' .sa-dv .srch{display:flex;align-items:center;gap:12px;margin-top:26px;padding:10px 0;border-bottom:1px solid rgba(var(--iv),.3)}',
    P + ' .sa-dv .srch svg{width:18px;height:18px;stroke:rgba(var(--iv),.7);fill:none}',
    P + ' .sa-dv .srch input{flex:1;min-width:0;background:none;border:0;outline:0;color:#fff;font:300 20px/1.3 ' + SANS + ';letter-spacing:.1em}',
    P + ' .sa-dv .srch input::placeholder{color:rgba(var(--iv),.26)}',
    P + ' .sa-dv .chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}',
    P + ' .sa-dv .chips small{width:100%;font-size:11px;letter-spacing:.3em;color:rgba(var(--iv),.3)}',
    P + ' .sa-vs{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;opacity:0;visibility:hidden;transition:opacity .6s}',
    P + '.sa-in-dv .sa-vs{opacity:1;visibility:visible}',
    P + ' .sa-vs span{position:absolute;left:20px;top:50%;transform:translateY(-50%);white-space:nowrap;font-size:12px;letter-spacing:.14em;color:rgba(var(--iv),0);text-shadow:0 0 10px #000;transition:color .3s;pointer-events:none}',
    P + ' .sa-vs:hover span,' + P + ' .sa-vs.hl span{color:rgba(var(--iv),.9)}',
    P + ' .sa-nav{position:absolute;left:66%;bottom:clamp(40px,6vh,80px);transform:translateX(-50%);display:flex;gap:clamp(12px,1.4vw,26px);white-space:nowrap;opacity:0;visibility:hidden;transition:opacity .6s,visibility 0s .6s}',
    P + '.sa-in-dv .sa-nav{opacity:1;visibility:visible;transition:opacity .8s .5s}',
    P + ' .sa-nav button{font-size:12px;letter-spacing:.24em;color:rgba(var(--iv),.34);padding:6px 2px;border-bottom:1px solid transparent;transition:color .3s,border-color .3s}',
    P + ' .sa-nav button small{display:block;font-size:10px;letter-spacing:.3em;color:rgba(var(--gold),.4);margin-bottom:3px}',
    P + ' .sa-nav button:hover{color:rgba(var(--iv),.8)}',
    P + ' .sa-nav button.cur{color:#fff;border-bottom-color:rgba(var(--gold),.6)}',
    P + ' .sa-nav .home{color:rgba(var(--iv),.5)}',
    P + '.sa-in-dv .sa-np,' + P + '.sa-in-dv .sa-empty{opacity:0;transform:translateX(-24px);pointer-events:none}',
    P + '.sa-in-dv .sa-lab,' + P + '.sa-in-dv .sa-pol,' + P + '.sa-in-dv .sa-clock,' + P + '.sa-in-dv .sa-quote,' + P + '.sa-in-dv .sa-search{opacity:0;pointer-events:none}',
    P + '.sa-in-dv .sa-ring{pointer-events:none}',
    '@media (prefers-reduced-motion:reduce){' + P + ' *{transition-duration:.01s!important}}'
  ].join('\n');

  var ICON = {
    prev: '<svg viewBox="0 0 16 16"><path d="M12.5 3.2 5.6 8l6.9 4.8zM3.5 3v10"/></svg>',
    next: '<svg viewBox="0 0 16 16"><path d="M3.5 3.2 10.4 8l-6.9 4.8zM12.5 3v10"/></svg>',
    play: '<svg viewBox="0 0 16 16"><path d="M5 2.6v10.8L13.4 8z"/></svg>',
    pause: '<svg viewBox="0 0 16 16"><path d="M4.4 2.8h2.2v10.4H4.4zM9.4 2.8h2.2v10.4H9.4z"/></svg>',
    heart: '<svg viewBox="0 0 16 16"><path d="M8 13.6S2.2 10 2.2 6a2.9 2.9 0 0 1 5.8-.9A2.9 2.9 0 0 1 13.8 6C13.8 10 8 13.6 8 13.6z"/></svg>',
    search: '<svg viewBox="0 0 16 16" stroke-width="1.2"><circle cx="7" cy="7" r="4.6"/><path d="m10.4 10.4 3.4 3.4" stroke-linecap="round"/></svg>'
  };

  // ============================================================
  function createStarAtlas(root, ctx) {
    var A = ctx.actions || {};
    var reduced = !!ctx.reducedMotion;
    var destroyed = false, paused = false, raf = 0, lost = false;
    // [修] 缩放比例每次 sizeAll 都重新读（窗口拖到另一块缩放不同的屏幕上）
    function dprNow() { return Math.min(window.devicePixelRatio || 1, 1.5); }
    var DPR = dprNow();
    ctx.injectStyle(ID, CSS);

    root.innerHTML = [
      '<canvas class="sa-gl"></canvas><canvas class="sa-ov"></canvas>',
      '<div class="sa-ui">',
      '  <label class="sa-search">' + ICON.search + '<input type="text" spellcheck="false" autocomplete="off" placeholder="搜索歌曲、歌手" aria-label="搜索歌曲、歌手"></label>',
      '  <button class="sa-quote" type="button" title="换一句"></button>',
      '  <div class="sa-ring" role="slider" aria-label="播放进度" tabindex="-1"></div>',
      '  <div class="sa-pol"><div class="cn">北 极 星</div><div class="sb">勾陈一 · 正在播放</div></div>',
      '  <div class="sa-np">',
      '    <div class="sa-k"></div>',
      '    <button class="sa-title" type="button" title="进入沉浸模式"></button>',
      '    <div class="sa-meta"></div>',
      '    <div class="sa-row">',
      '      <button class="sa-ib sa-prev" type="button" title="上一首" aria-label="上一首">' + ICON.prev + '</button>',
      '      <button class="sa-ib sa-pp" type="button"></button>',
      '      <button class="sa-ib sa-nxt" type="button" title="下一首" aria-label="下一首">' + ICON.next + '</button>',
      '      <button class="sa-ib sa-like" type="button" title="喜欢" aria-label="喜欢">' + ICON.heart + '</button>',
      '      <button class="sa-ib sa-lyr" type="button" title="歌词" aria-label="歌词">词</button>',
      '      <span class="sa-time"></span>',
      '    </div>',
      '    <button class="sa-next" type="button" title="下一首"></button>',
      '  </div>',
      '  <div class="sa-empty">',
      '    <div class="sa-k">北 极 星 还 没 有 亮 起</div>',
      '    <div class="sa-title">今晚，听点什么</div>',
      '    <p>登录音乐平台，或者导入本地音乐，<br>正在播放的歌会成为这片夜空的北极星。</p>',
      '    <div class="sa-acts"><button class="sa-btn sa-login" type="button">登录 QQ 音乐 / 网易云</button><button class="sa-btn sec sa-import" type="button">导入本地音乐</button></div>',
      '  </div>',
      '  <div class="sa-labs"></div>',
      '  <div class="sa-clock"><div class="t"></div><div class="d"></div><div class="s"></div></div>',
      '  <div class="sa-vss"></div>',
      '  <div class="sa-dv" aria-hidden="true"></div>',
      '  <div class="sa-nav"></div>',
      '  <div class="sa-tip"></div>',
      '</div>'
    ].join('\n');
    function $(s) { return root.querySelector(s); }
    var cv = $('.sa-gl'), ov = $('.sa-ov'), octx = ov.getContext('2d');
    var elSearch = $('.sa-search'), elInput = $('.sa-search input'), elQuote = $('.sa-quote');
    var elRing = $('.sa-ring'), elPol = $('.sa-pol');
    var elNp = $('.sa-np'), elK = $('.sa-np .sa-k'), elTitle = $('.sa-np .sa-title'), elMeta = $('.sa-np .sa-meta');
    var elPP = $('.sa-pp'), elLike = $('.sa-like'), elLyr = $('.sa-lyr'), elTime = $('.sa-time'), elNext = $('.sa-next');
    var elLabs = $('.sa-labs'), elClockT = $('.sa-clock .t'), elClockD = $('.sa-clock .d'), elClockS = $('.sa-clock .s');
    var elVss = $('.sa-vss'), elDv = $('.sa-dv'), elNav = $('.sa-nav'), elTip = $('.sa-tip');

    var W = 1, H = 1, L = { pole: [0, 0], S: 1 };
    var model = null;
    var mouse = { x: -9999, y: -9999, nx: 0, ny: 0, sx: 0, sy: 0, inside: false, last: 0 };
    var hover = null;             // 悬停的北斗星
    var V = null, vItems = [], vHl = -1;
    var cam = { fx: 0, fy: 0, ax: 0, ay: 0, z: 1 }, camAnim = null;
    var energy = 0, eSlow = 0, flash = 0;
    var needRender = true, lastDraw = 0, t0 = performance.now(), lastT = 0;
    var fadeIn = 0, ready = false;

    // ---------- 几何 ----------
    function catPos(k) {
      var c = CAT[k], r = 2 * Math.tan((90 - c[1]) * DEG / 2), a = -(c[0] + ROT) * DEG;
      return [L.pole[0] + L.S * r * Math.cos(a), L.pole[1] + L.S * r * Math.sin(a)];
    }
    // 以真实时间为准的缓慢摆动（约 63 分钟一个来回，幅度 ±4°），重新打开主页时天空接着上次的位置
    function skyAng() { return reduced ? 0.02 : 0.02 + 0.07 * Math.sin(Date.now() / 1000 / 600); }
    var ang = 0, off = [0, 0], hoff = [0, 0], hAlpha = 1;
    function rotBase(w) { var dx = w[0] - L.pole[0], dy = w[1] - L.pole[1], c = Math.cos(ang), s = Math.sin(ang); return [L.pole[0] + c * dx - s * dy + off[0], L.pole[1] + s * dx + c * dy + off[1]]; }
    function toScr(w) { var b = rotBase(w); return [(b[0] - cam.fx) * cam.z + cam.ax, (b[1] - cam.fy) * cam.z + cam.ay]; }
    function viewE() { return clamp((cam.z - 1) / (VIEW_Z - 1), 0, 1); }

    // ---------- WebGL ----------
    var gl = null, G = {};
    function prog(fs, vs) {
      function sh(type, src) {
        var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('[star-atlas] shader: ' + gl.getShaderInfoLog(s));
        return s;
      }
      var p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs || VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('[star-atlas] link: ' + gl.getProgramInfoLog(p));
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
      return { p: p, u: u, a: gl.getAttribLocation(p, 'aPos') };
    }
    function quad(pr) {
      gl.useProgram(pr.p); gl.bindBuffer(gl.ARRAY_BUFFER, G.quad);
      gl.enableVertexAttribArray(pr.a); gl.vertexAttribPointer(pr.a, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    function makeFbo(w, h) {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex: tex, fb: fb, w: w, h: h };
    }
    function freeFbo(f) { if (f && gl) { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fb); } }
    function initGL() {
      gl = cv.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, depth: false, stencil: false, preserveDrawingBuffer: false });
      if (!gl) throw new Error('WebGL 不可用');
      G = {};
      G.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      G.sky = prog(SKY_FS); G.comp = prog(COMP_FS); G.hor = prog(HOR_FS); G.hord = prog(HORDRAW_FS); G.vig = prog(VIG_FS);
      G.star = prog(STAR_FS, STAR_VS);
      G.aInfo = gl.getAttribLocation(G.star.p, 'aInfo'); G.aCol = gl.getAttribLocation(G.star.p, 'aCol');
      G.bp = gl.createBuffer(); G.bi = gl.createBuffer(); G.bc = gl.createBuffer();
      G.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    }

    // ---------- 烘焙：天空和地平线（按实际像素，分几帧完成） ----------
    var skyF = null, horF = null, skyBox = [0, 0, 1, 1], horBox = [0, 0, 1, 1];
    var jobs = [], pending = null;
    var ridgeY = null;
    function planBake() {
      // 天空贴图覆盖：屏幕（留出视差余量）在摆动范围内旋转能扫到的所有位置
      var m = 30, xs = [], ys = [];
      [[-m, -m], [W + m, -m], [-m, H + m], [W + m, H + m]].forEach(function (p) {
        for (var i = 0; i <= 8; i++) {
          var a = -0.07 + 0.18 * i / 8, dx = p[0] - L.pole[0], dy = p[1] - L.pole[1], c = Math.cos(-a), s = Math.sin(-a);
          xs.push(L.pole[0] + c * dx - s * dy); ys.push(L.pole[1] + s * dx + c * dy);
        }
      });
      var bx = Math.min.apply(null, xs), by = Math.min.apply(null, ys), bw = Math.max.apply(null, xs) - bx, bh = Math.max.apply(null, ys) - by;
      var cap = Math.min(G.maxTex, 8192);
      var px = Math.min(DPR, cap / bw, cap / bh);
      var tw = Math.max(64, Math.round(bw * px)), th = Math.max(64, Math.round(bh * px));
      var hm = 40, hw = W + hm * 2, hh = H + hm * 2, hpx = Math.min(DPR, cap / hw, cap / hh);
      pending = {
        sky: makeFbo(tw, th), skyBox: [bx, by, bw, bh], skyPx: px,
        hor: makeFbo(Math.round(hw * hpx), Math.round(hh * hpx)), horBox: [-hm, -hm, hw, hh], horPx: hpx
      };
      jobs = [];
      var n = Math.max(4, Math.ceil(tw * th / 1.2e6));
      for (var i = 0; i < n; i++) jobs.push({ k: 'sky', y0: Math.floor(th * i / n), y1: Math.floor(th * (i + 1) / n) });
      var hn = Math.max(2, Math.ceil(pending.hor.w * pending.hor.h / 1.5e6));
      for (var j = 0; j < hn; j++) jobs.push({ k: 'hor', y0: Math.floor(pending.hor.h * j / hn), y1: Math.floor(pending.hor.h * (j + 1) / hn) });
      jobs.push({ k: 'profile' });
      jobs.push({ k: 'swap' });
    }
    function runJob() {
      var jb = jobs.shift(); if (!jb || !pending) return;
      if (jb.k === 'sky') {
        var f = pending.sky;
        gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb); gl.viewport(0, 0, f.w, f.h);
        gl.enable(gl.SCISSOR_TEST); gl.scissor(0, f.h - jb.y1, f.w, jb.y1 - jb.y0);
        var u = G.sky.u; gl.useProgram(G.sky.p);
        gl.uniform4fv(u.uBox, pending.skyBox); gl.uniform1f(u.uH, H); gl.uniform1f(u.uTexPx, pending.skyPx);
        gl.uniform2f(u.uBandP, 0.45 * W / H, 0.55); gl.uniform2f(u.uBandDir, 0.16, -1.0); gl.uniform1f(u.uBandW, 0.13);
        gl.uniform1f(u.uCoreAlong, 0.62); gl.uniform1f(u.uMW, 0.52); gl.uniform3f(u.uTint, 0.86, 0.84, 0.95); gl.uniform1f(u.uSeed, 2.7);
        quad(G.sky);
        gl.disable(gl.SCISSOR_TEST); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else if (jb.k === 'hor') {
        var h = pending.hor;
        gl.bindFramebuffer(gl.FRAMEBUFFER, h.fb); gl.viewport(0, 0, h.w, h.h);
        gl.enable(gl.SCISSOR_TEST); gl.scissor(0, h.h - jb.y1, h.w, jb.y1 - jb.y0);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        horUniforms(pending.horBox, pending.horPx);
        quad(G.hor);
        gl.disable(gl.SCISSOR_TEST); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else if (jb.k === 'profile') {
        // 读出山脊线（流星、卫星、飞机要被山挡住）：低分辨率渲染一遍再读回
        var pw = Math.max(8, Math.ceil(W / 2)), ph = Math.max(8, Math.ceil(H / 2));
        var pf = makeFbo(pw, ph);
        gl.bindFramebuffer(gl.FRAMEBUFFER, pf.fb); gl.viewport(0, 0, pw, ph); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        horUniforms([0, 0, W, H], pw / W);
        quad(G.hor);
        var px = new Uint8Array(pw * ph * 4); gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, px);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); freeFbo(pf);
        var ry = new Float32Array(pw);
        for (var x = 0; x < pw; x++) { var y = ph; for (var r = ph - 1; r >= 0; r--) { if (px[(r * pw + x) * 4 + 3] >= 128) { y = ph - 1 - r; break; } } ry[x] = y * 2; }
        pending.ridge = ry;
      } else if (jb.k === 'swap') {
        freeFbo(skyF); freeFbo(horF);
        skyF = pending.sky; skyBox = pending.skyBox; horF = pending.hor; horBox = pending.horBox; ridgeY = pending.ridge;
        pending = null;
        if (!ready) { ready = true; cv.classList.add('on'); }
      }
      needRender = true;
    }
    function horUniforms(box, px) {
      var u = G.hor.u; gl.useProgram(G.hor.p);
      gl.uniform4fv(u.uBox, box); gl.uniform1f(u.uH, H); gl.uniform1f(u.uW, W); gl.uniform1f(u.uPx, 1 / (H * px));
    }

    // ---------- 亮星 ----------
    var stars = [], nStatic = 0, VMAX = 40;
    var bufPos, bufInfo, bufCol;
    function buildStars() {
      stars = [];
      Object.keys(CAT).forEach(function (k) {
        var c = CAT[k], p = catPos(k), isD = DIPPER.indexOf(k) >= 0, m = Math.max(0, 4.6 - c[2]) / 4.6;
        stars.push({ x: p[0], y: p[1], size: (isD ? 40 : 16) + m * (isD ? 34 : 22), b: (isD ? 1.0 : 0.3) + m * (isD ? 1.0 : 0.8), seed: (hashStr(k) % 1000) / 1000, tw: 0.07, col: bvColor(c[3]), key: k });
      });
      var r = rng(0x5a17), bx = skyBox[0], by = skyBox[1], bw = skyBox[2], bh = skyBox[3];
      if (pending) { bx = pending.skyBox[0]; by = pending.skyBox[1]; bw = pending.skyBox[2]; bh = pending.skyBox[3]; }
      var count = clamp(Math.round(bw * bh * 1100 / (1600 * 900)), 600, 2600);
      for (var i = 0; i < count; i++) {
        var m2 = Math.pow(r(), 5.0);
        stars.push({ x: bx + r() * bw, y: by + r() * bh, size: 5 + m2 * 20, b: 0.10 + m2 * 0.85, seed: r(), tw: 0.05 + 0.1 * r(), col: starColor(r()) });
      }
      nStatic = stars.length;
      for (var j = 0; j < VMAX; j++) stars.push({ x: 0, y: 0, size: 18, b: 0, seed: r(), tw: 0.05, col: [1, 1, 1], vs: true, tb: 0 });
      stars.forEach(function (s) { s.b0 = s.b; s.s0 = s.size; s.g = 0; });
      var n = stars.length;
      bufPos = new Float32Array(n * 2); bufInfo = new Float32Array(n * 4); bufCol = new Float32Array(n * 3);
      stars.forEach(function (s, i) { bufCol.set(s.col, i * 3); });
      gl.bindBuffer(gl.ARRAY_BUFFER, G.bc); gl.bufferData(gl.ARRAY_BUFFER, bufCol, gl.STATIC_DRAW);
    }
    function uploadStars() {
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        bufPos[i * 2] = s.x; bufPos[i * 2 + 1] = s.y;
        bufInfo[i * 4] = s.size; bufInfo[i * 4 + 1] = s.b; bufInfo[i * 4 + 2] = s.seed; bufInfo[i * 4 + 3] = s.tw;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, G.bp); gl.bufferData(gl.ARRAY_BUFFER, bufPos, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, G.bi); gl.bufferData(gl.ARRAY_BUFFER, bufInfo, gl.DYNAMIC_DRAW);
    }
    // 光标附近的星慢慢变亮；悬停的北斗星更亮；北极星随音乐呼吸；推近页里的歌星淡入
    function lightStars() {
      var mx = mouse.x, my = mouse.y, on = mouse.inside && !reduced, R2 = 2 * 70 * 70;
      var best = null, bd = 26 * 26, busy = false;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        if (s.vs) { var tb = s.tb * (vHl === s.vi ? 2.0 : 1); s.b += (tb - s.b) * 0.08; if (Math.abs(tb - s.b) > 0.01) busy = true; continue; }
        var p = toScr([s.x, s.y]), dx = p[0] - mx, dy = p[1] - my, d2 = dx * dx + dy * dy;
        var g = on ? Math.exp(-d2 / R2) : 0;
        if (s.key && s.key === hover) g = Math.max(g, 1.0);
        if (V && s.key === STAR_OF[V]) g = Math.max(g, 1.2);
        var ng = s.g + (g - s.g) * 0.10;
        if (Math.abs(ng - s.g) > 0.002) busy = true;
        s.g = ng;
        s.b = s.b0 * (1 + 1.3 * s.g); s.size = s.s0 * (1 + 0.35 * s.g);
        if (s.key === 'polaris') { var lit = model && model.now ? 1 : 0.45; s.b *= lit * (1 + 0.35 * energy); }
        if (on && s.key && EN[s.key] && d2 < bd && !V) { bd = d2; best = { key: s.key, p: p }; }
      }
      if (gl && !lost) uploadStars();
      if (best) {
        var c = CAT[best.key];
        setH(elTip, esc(c[4]) + '<span>' + esc(EN[best.key]) + ' · ' + c[2].toFixed(1) + ' 等</span>');
        elTip.style.left = (best.p[0] + 14) + 'px'; elTip.style.top = (best.p[1] - 20) + 'px'; elTip.style.opacity = 1;
      } else elTip.style.opacity = 0;
      return busy;
    }

    // ---------- 流星 / 人造卫星 / 飞机（都在山的后面） ----------
    var meteors = [], trains = [], sats = [];
    var nextSky = 6 + Math.random() * 6, nextFire = 70 + Math.random() * 60, nextSat = 12 + Math.random() * 10, nextPlane = 50 + Math.random() * 40;
    function radiant() { return [-0.25 * W, -0.45 * H]; }
    function spawnMeteor(kind, p) {
      if (reduced) return;
      kind = kind || 'sky';
      if (!p) {
        for (var i = 0; i < 20; i++) { p = [W * (0.30 + Math.random() * 0.66), H * (0.05 + Math.random() * 0.55)]; if (!(p[0] < 0.36 * W && p[1] > 0.5 * H)) break; }
      }
      var R = radiant(), dx = p[0] - R[0], dy = p[1] - R[1], dl = Math.hypot(dx, dy) || 1;
      var fs = Math.min(1, dl / (H * 1.2));
      var fire = kind === 'fire';
      meteors.push({
        kind: kind, p0: p.slice(), dir: [dx / dl, dy / dl],
        len: (fire ? 260 + Math.random() * 200 : 90 + Math.random() * 170) * (0.35 + 0.65 * fs) * (H / 900),
        speed: (fire ? 520 : 700 + Math.random() * 500) * (0.5 + 0.5 * fs) * (H / 900),
        life: fire ? 1.5 + Math.random() * 0.6 : 0.45 + Math.random() * 0.5,
        bright: fire ? 1.6 : 0.45 + Math.pow(Math.random(), 2) * 0.8,
        t: 0, seed: Math.random() * 100, frag: fire ? [] : null
      });
    }
    function menv(m) { var u = m.t / m.life; return Math.pow(Math.sin(Math.PI * Math.min(1, u)), 0.6) * (0.85 + 0.15 * Math.sin(m.t * 60 + m.seed)); }
    function spawnSat() {
      var fromL = Math.random() < 0.5, y = H * (0.08 + Math.random() * 0.42);
      var a = (Math.random() - 0.5) * 0.5 + (fromL ? 0 : Math.PI), sp = (16 + Math.random() * 14) * (H / 900);
      sats.push({ kind: 'sat', p: [fromL ? -10 : W + 10, y], v: [Math.cos(a) * sp, Math.sin(a) * sp], t: 0, life: (W + 40) / Math.abs(Math.cos(a) * sp),
        flare: Math.random() < 0.35 ? 0.3 + Math.random() * 0.4 : -1, fade: Math.random() < 0.4 ? 0.45 + Math.random() * 0.4 : 2 });
    }
    function spawnPlane() {
      var fromL = Math.random() < 0.5, y = H * (0.64 + Math.random() * 0.08), sp = (20 + Math.random() * 8) * (H / 900);
      sats.push({ kind: 'plane', p: [fromL ? -10 : W + 10, y], v: [fromL ? sp : -sp, -1.5 + Math.random() * 3], t: 0, life: (W + 40) / sp });
    }
    function stepLife(dt) {
      if (reduced) return false;
      if (!V) {
        nextSky -= dt; nextFire -= dt; nextSat -= dt; nextPlane -= dt;
        if (nextSky <= 0) { spawnMeteor('sky'); if (Math.random() < 0.18) nextSky = 0.5 + Math.random() * 0.9; else nextSky = 9 + Math.random() * 13; }
        if (nextFire <= 0) { spawnMeteor('fire'); nextFire = 80 + Math.random() * 90; }
        if (nextSat <= 0) { spawnSat(); nextSat = 30 + Math.random() * 40; }
        if (nextPlane <= 0) { spawnPlane(); nextPlane = 90 + Math.random() * 80; }
      }
      meteors.forEach(function (m) {
        m.t += dt;
        if (m.frag && m.t > m.life * 0.62 && !m.frag.length) for (var i = 0; i < 3; i++) m.frag.push({ off: (Math.random() - 0.5) * 0.12, sp: 0.7 + Math.random() * 0.35, b: 0.4 + Math.random() * 0.4 });
        if (m.kind === 'fire' && !m.trained && m.t > m.life * 0.9) { m.trained = true; trains.push({ m: m, t: 0, life: 3.5 }); }
      });
      meteors = meteors.filter(function (m) { return m.t < m.life; });
      trains.forEach(function (tr) { tr.t += dt; }); trains = trains.filter(function (tr) { return tr.t < tr.life; });
      sats.forEach(function (s) { s.t += dt; }); sats = sats.filter(function (s) { return s.t < s.life; });
      flash = 0; meteors.forEach(function (m) { if (m.kind === 'fire') flash = Math.max(flash, menv(m) * 0.5); });
      return meteors.length > 0 || trains.length > 0;
    }
    function drawLife(g) {
      if (!meteors.length && !trains.length && !sats.length) return;
      g.save();
      if (ridgeY) {
        g.beginPath(); g.moveTo(-40, -40); g.lineTo(W + 40, -40);
        for (var i = ridgeY.length - 1; i >= 0; i -= 2) g.lineTo(i * 2 + hoff[0], ridgeY[i] + hoff[1] - 1);
        g.lineTo(-40, ridgeY[0] + hoff[1]); g.closePath(); g.clip();
      }
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      trains.forEach(function (tr) {
        var m = tr.m, u = tr.t / tr.life, a = (1 - u) * (1 - u) * 0.22;
        var h = [m.p0[0] + m.dir[0] * m.speed * m.life * 0.9, m.p0[1] + m.dir[1] * m.speed * m.life * 0.9];
        g.strokeStyle = 'rgba(150,190,170,' + a + ')'; g.lineWidth = 1.5 + u * 5; g.beginPath();
        for (var i = 0; i <= 20; i++) { var s = i / 20, d = m.len * 1.4 * s, w = Math.sin(s * 7 + tr.t * 0.8 + m.seed) * u * 8;
          var x = h[0] - m.dir[0] * d - m.dir[1] * w, y = h[1] - m.dir[1] * d + m.dir[0] * w; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
      });
      meteors.forEach(function (m) {
        var e = menv(m) * m.bright;
        var hd = [m.p0[0] + m.dir[0] * m.speed * m.t, m.p0[1] + m.dir[1] * m.speed * m.t];
        var tl = Math.min(m.len, m.speed * m.t), tail = [hd[0] - m.dir[0] * tl, hd[1] - m.dir[1] * tl];
        var cHead = m.kind === 'fire' ? '200,255,215' : '232,240,255', cTail = '255,226,196';
        var gr = g.createLinearGradient(tail[0], tail[1], hd[0], hd[1]);
        gr.addColorStop(0, 'rgba(' + cTail + ',0)'); gr.addColorStop(0.7, 'rgba(' + cTail + ',' + (0.25 * e) + ')'); gr.addColorStop(1, 'rgba(' + cHead + ',' + Math.min(1, 0.9 * e) + ')');
        var w = m.kind === 'fire' ? 2.2 : 1.1;
        g.strokeStyle = gr; g.lineWidth = w * 3.2; g.globalAlpha = 0.18; g.beginPath(); g.moveTo(tail[0], tail[1]); g.lineTo(hd[0], hd[1]); g.stroke();
        g.globalAlpha = 1; g.lineWidth = w; g.beginPath(); g.moveTo(tail[0], tail[1]); g.lineTo(hd[0], hd[1]); g.stroke();
        var hr = m.kind === 'fire' ? 16 : 6, rg = g.createRadialGradient(hd[0], hd[1], 0, hd[0], hd[1], hr);
        rg.addColorStop(0, 'rgba(' + cHead + ',' + Math.min(1, e) + ')'); rg.addColorStop(1, 'rgba(' + cHead + ',0)');
        g.fillStyle = rg; g.beginPath(); g.arc(hd[0], hd[1], hr, 0, Math.PI * 2); g.fill();
        if (m.frag) m.frag.forEach(function (f) {
          var s = m.t - m.life * 0.62, fd = [m.dir[0] - m.dir[1] * f.off, m.dir[1] + m.dir[0] * f.off];
          var fp = [hd[0] - m.dir[0] * s * m.speed * (1 - f.sp) + fd[0] * 4, hd[1] - m.dir[1] * s * m.speed * (1 - f.sp) + fd[1] * 4];
          g.fillStyle = 'rgba(255,220,170,' + (f.b * e) + ')'; g.beginPath(); g.arc(fp[0], fp[1], 1.4, 0, Math.PI * 2); g.fill();
        });
      });
      sats.forEach(function (s) {
        var x = s.p[0] + s.v[0] * s.t, y = s.p[1] + s.v[1] * s.t, u = s.t / s.life, gg;
        if (s.kind === 'sat') {
          var a = Math.max(0, 0.5 * Math.min(1, s.t / 2) * (1 - Math.max(0, (u - s.fade) / 0.06))), r = 1.1;
          if (s.flare > 0) { var f = Math.exp(-Math.pow((u - s.flare) * s.life / 1.4, 2)); a += f * 0.9; r += f * 2.2; }
          gg = g.createRadialGradient(x, y, 0, x, y, r * 3); gg.addColorStop(0, 'rgba(235,240,255,' + a + ')'); gg.addColorStop(1, 'rgba(235,240,255,0)');
          g.fillStyle = gg; g.beginPath(); g.arc(x, y, r * 3, 0, Math.PI * 2); g.fill();
        } else {
          var tt = s.t, red = (tt % 1.0) < 0.5 ? 0.55 : 0.12, ph = tt % 1.3, st = (ph < 0.06 || (ph > 0.18 && ph < 0.24)) ? 0.9 : 0;
          g.fillStyle = 'rgba(255,70,60,' + red + ')'; g.beginPath(); g.arc(x - 3, y, 1.1, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(120,255,140,' + (red * 0.6) + ')'; g.beginPath(); g.arc(x + 3, y, 1.0, 0, Math.PI * 2); g.fill();
          if (st) { gg = g.createRadialGradient(x, y, 0, x, y, 7); gg.addColorStop(0, 'rgba(255,255,255,' + st + ')'); gg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gg; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
        }
      });
      g.restore();
    }

    // ---------- 音乐的"呼吸"：读播放器的频谱（没有就不动） ----------
    var fbuf = null;
    function stepEnergy(dt) {
      var target = 0;
      try {
        if (!reduced && model && model.now && model.now.playing && typeof analyser !== 'undefined' && analyser && analyser.getByteFrequencyData) {
          if (!fbuf || fbuf.length !== analyser.frequencyBinCount) fbuf = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(fbuf);
          var s = 0, n = Math.min(12, fbuf.length); for (var i = 1; i < n; i++) s += fbuf[i];
          var bass = s / Math.max(1, n - 1) / 255;
          eSlow += (bass - eSlow) * Math.min(1, dt * 0.8);
          target = clamp((bass - eSlow) * 3.2 + bass * 0.25, 0, 1);
        }
      } catch (_e) { target = 0; }
      energy += (target - energy) * Math.min(1, dt * (target > energy ? 14 : 4));
      return energy > 0.01;
    }

    // ---------- 北斗的七个入口 ----------
    var BAYER = { dubhe: 'α', merak: 'β', phecda: 'γ', megrez: 'δ', alioth: 'ε', mizar: 'ζ', alkaid: 'η' };
    var labEls = {};
    DIPPER.forEach(function (k) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'sa-lab';
      b.innerHTML = '<span class="cn">' + CAT[k][4] + '</span><span class="n"></span><span class="s"></span>';
      b.setAttribute('data-k', k);
      elLabs.appendChild(b); labEls[k] = b;
    });
    elNav.innerHTML = DIPPER.map(function (k) { return '<button type="button" data-v="' + ENTRY[k] + '"><small>' + CAT[k][4] + '</small><span></span></button>'; }).join('') +
      '<button type="button" class="home" data-v="home"><small>&nbsp;</small>回到星图</button>';
    function entryName(k, m) {
      m = m || {};
      switch (ENTRY[k]) {
        case 'daily': return '每日推荐';
        case 'lib': return '音乐库';
        case 'disc': return (m.discover && m.discover.label) || '发现';
        case 'radio': return (m.radio && m.radio.label) || '电台';
        case 'picks': return '为你挑选';
        case 'recent': return '最近聆听';
        default: return '搜索';
      }
    }
    function entrySub(k, m) {
      var d = m.daily || {}, lb = m.library || {}, p = m.picks || {};
      switch (ENTRY[k]) {
        case 'daily': return (d.count ? d.count + ' 首 · ' : '') + (d.label || '');
        case 'lib': return (lb.playlistCount ? lb.playlistCount + ' 张歌单 · ' : '') + (lb.label || '');
        case 'disc': return (m.discover && m.discover.sub) || '';
        case 'radio': return (m.radio && m.radio.sub) || '';
        case 'picks': return ((p.items || []).length ? p.items.length + ' 首 · ' : '') + (p.label || '');
        case 'recent': return (m.recent || []).length ? m.recent.length + ' 首' : '还没有听歌记录';
        default: return '歌曲 · 歌手 · 歌单';
      }
    }
    function entryOff(k, m) {
      switch (ENTRY[k]) {
        case 'daily': return !(m.daily && m.daily.count);
        case 'lib': return !(m.login && m.login.any) && !((m.library && m.library.items) || []).length;
        case 'disc': return m.discover && m.discover.available === false;
        case 'radio': return m.radio && m.radio.available === false;
        case 'picks': return !((m.picks && m.picks.items) || []).length;
        case 'recent': return !(m.recent || []).length;
        default: return false;
      }
    }

    // ---------- 数据 → 画面 ----------
    var lastKey = null, posBase = 0, posAt = 0, dur = 0, playing = false, swapTimer = 0, npTop = 0, npLeft = 0;
    function setTitle(el, text) {
      el.textContent = text;
      var n = String(text || '').length;
      el.classList.toggle('l1', n > 6 && n <= 9);
      el.classList.toggle('l2', n > 9 && n <= 16);
      el.classList.toggle('l3', n > 16);
    }
    // [修] 宿主每秒推一次数据：内容没变就不写 DOM（按元素缓存上次写入的字符串）
    function setH(el, h) { h = String(h); if (el.__saH === h) return false; el.__saH = h; el.innerHTML = h; return true; }
    function setT(el, t) { t = String(t == null ? '' : t); if (el.__saT === t) return false; el.__saT = t; el.textContent = t; return true; }
    var elPolSb = elPol.querySelector('.sb'), lastEmpty = null;
    function applyModel(m, force) {
      model = m;
      var now = m.now, ch = false;
      if (lastEmpty !== !now) { lastEmpty = !now; root.classList.toggle('hth-sa-isempty', !now); ch = true; }
      if (now) {
        if (lastKey && now.key !== lastKey && !force) {
          spawnMeteor('fire');
          elTitle.classList.add('swap');
          clearTimeout(swapTimer);
          swapTimer = setTimeout(function () { if (destroyed) return; setTitle(elTitle, model && model.now ? model.now.title : ''); elTitle.classList.remove('swap'); cacheNp(); }, 480);
        } else if (elTitle.textContent !== String(now.title || '') && !elTitle.classList.contains('swap')) { setTitle(elTitle, now.title || ''); ch = true; }
        lastKey = now.key;
        if (setH(elMeta, esc(now.artist) + (now.album ? '<i>/</i>' + esc(now.album) : '') + (now.providerLabel ? '<em>' + esc(now.providerLabel) + '</em>' : ''))) ch = true;
        if (setT(elK, (now.playing ? '正 在 播 放' : '已 暂 停') + ' · 北 极 星')) ch = true;
        if (setH(elPP, now.playing ? ICON.pause : ICON.play)) {
          elPP.title = now.playing ? '暂停' : '播放'; elPP.setAttribute('aria-label', elPP.title);
        }
        elLike.classList.toggle('on', !!now.liked);
        elLyr.classList.toggle('on', !!m.lyricsOn);
        posBase = Number(now.position) || 0; posAt = performance.now(); dur = Number(now.duration) || 0; playing = !!now.playing;
        // [修] 时长未知（0）时显示 --:--，不显示「/ 0:00」
        setT(elTime, fmt(posBase) + '  /  ' + (dur > 0 ? fmt(dur) : '--:--'));
        var nx = m.next, nd = nx ? '' : 'none';
        if (elNext.style.display !== nd) { elNext.style.display = nd; ch = true; }
        if (nx && setH(elNext, '<small>接下来</small>' + esc(nx.title) + (nx.artist ? ' — ' + esc(nx.artist) : ''))) ch = true;
        setT(elPolSb, '勾陈一 · ' + (now.playing ? '正在播放' : '已暂停'));
      } else {
        lastKey = null; playing = false; dur = 0;
        setT(elPolSb, '勾陈一 · 等待一首歌');
      }
      DIPPER.forEach(function (k) {
        var b = labEls[k], nm = entryName(k, m);
        if (setT(b.querySelector('.n'), nm)) b.setAttribute('aria-label', nm);
        setT(b.querySelector('.s'), entrySub(k, m));
        b.classList.toggle('off', !!entryOff(k, m));
      });
      [].forEach.call(elNav.querySelectorAll('button[data-v]'), function (b) { var k = STAR_OF[b.getAttribute('data-v')]; if (k) setT(b.querySelector('span'), entryName(k, m)); });
      var c = m.clock || {}, td = m.today || {};
      setT(elClockT, c.time || '');
      setT(elClockD, (c.month ? c.month + ' 月 ' + c.day + ' 日' : '') + (c.weekday ? ' · ' + c.weekday : ''));
      setH(elClockS, td.minutes || td.count ? '今天听了<b>' + (td.minutes || 0) + '</b>分钟 · <b>' + (td.count || 0) + '</b>首' + (td.topArtist ? ' · 最常听 <b>' + esc(td.topArtist) + '</b>' : '') : '今天还没有听歌');
      var q = m.quote || {}, qd = q.text ? '' : 'none';
      if (elQuote.style.display !== qd) elQuote.style.display = qd;
      setH(elQuote, esc(q.text || '') + (q.source ? '<small>' + esc(q.source) + '</small>' : ''));
      if (V) refreshView(false);
      // [修] 只有正在播放区的内容变了才重新量位置（offsetTop 会强制排版）
      if (ch || force) cacheNp();
      requestRender();
    }
    function cacheNp() {
      var el = model && model.now ? elNp : $('.sa-empty');
      npTop = el.offsetTop; npLeft = el.offsetLeft;
    }
    function curPos() {
      if (!model || !model.now) return 0;
      var p = posBase + (playing ? (performance.now() - posAt) / 1000 : 0);
      return dur ? Math.min(dur, p) : p;
    }

    // ---------- 推近：点北斗的星，镜头推过去成一页 ----------
    function playlistSub(it) { return it.sub || (it.count ? it.count + ' 首' : '') || it.providerLabel || ''; }
    var VIEWS = {
      daily: {
        sub: function (m) { return (m.daily && m.daily.label) || ''; },
        items: function (m) { var d = m.daily || {}; var l = Array.isArray(d.songs) && d.songs.length ? d.songs : (d.preview || []); return l.filter(Boolean).slice(0, 30).map(function (t) { return { title: t.title, sub: t.artist, raw: t }; }); },
        play: function (it, i) { A.playDaily(i); },
        acts: function (m, items) { return items.length ? [{ label: '从第一首开始播放', fn: function () { A.playDaily(0); } }] : []; }
      },
      lib: {
        sub: function (m) { var lb = m.library || {}; return (lb.playlistCount ? lb.playlistCount + ' 张歌单 · ' : '') + (lb.label || ''); },
        items: function (m) { return ((m.library && m.library.items) || []).slice(0, 30).map(function (it) { return { title: it.title, sub: playlistSub(it), raw: it, open: true }; }); },
        play: function (it) { A.playPlaylist(it.raw); }, open: function (it) { A.openPlaylist(it.raw); },
        acts: function () { return [{ label: '打开音乐库', fn: function () { A.openLibrary(); } }]; }
      },
      disc: {
        sub: function (m) { return (m.discover && m.discover.sub) || ''; },
        items: function (m) { return ((m.discover && m.discover.items) || []).slice(0, 24).map(function (it) { return { title: it.title, sub: playlistSub(it), raw: it, open: true }; }); },
        play: function (it) { A.playPlaylist(it.raw); }, open: function (it) { A.openPlaylist(it.raw); },
        acts: function (m) { return m.discover && m.discover.available !== false ? [{ label: '打开发现', sec: true, fn: function () { A.openDiscover(); } }] : []; }
      },
      radio: {
        sub: function (m) { return (m.radio && m.radio.sub) || ''; },
        items: function (m) { return ((m.radio && m.radio.items) || []).slice(0, 16).map(function (it) { return { title: it.title, sub: it.sub || '', raw: it }; }); },
        play: function (it) { A.playRadio(it.raw); },
        acts: function (m, items) { return items.length ? [{ label: '开始收听 · ' + items[0].title, fn: function () { A.playRadio(items[0].raw); } }] : (m.radio && m.radio.available !== false ? [{ label: '打开电台', fn: function () { A.openRadio(); } }] : []); }
      },
      picks: {
        sub: function (m) { return (m.picks && m.picks.label) || ''; },
        items: function (m) { return ((m.picks && m.picks.items) || []).map(function (t) { return { title: t.title, sub: t.artist, raw: t }; }); },
        play: function (it, i) { A.playPick(i); },
        acts: function () { return []; }
      },
      recent: {
        sub: function (m) { return (m.recent || []).length ? '最近播放的 ' + m.recent.length + ' 首 · 所有平台' : ''; },
        items: function (m) { return (m.recent || []).slice(0, 12).map(function (t) { return { title: t.title, sub: t.artist, raw: t }; }); },
        play: function (it, i) { A.playRecent(i); },
        acts: function () { return []; }
      },
      search: {
        sub: function () { return '按回车，在软件的搜索面板里查找。'; },
        items: function () { return []; },
        acts: function () { return []; }
      }
    };
    var vActs = [], vSig = '';
    function buildView(m) {
      var k = STAR_OF[V], def = VIEWS[V];
      vItems = def.items(m);
      vActs = def.acts(m, vItems) || [];
      var h = '<div class="cn">' + CAT[k][4] + ' · ' + BAYER[k] + ' UMa</div><h2>' + esc(entryName(k, m)) + '</h2><div class="sub">' + esc(def.sub(m)) + '</div>';
      if (V === 'search') {
        var seen = {}, chips = [];
        (m.recent || []).concat((m.picks && m.picks.items) || []).forEach(function (t) { String(t.artist || '').split(/\s*\/\s*/).forEach(function (a) { if (a && !seen[a] && a !== '未知歌手' && chips.length < 8) { seen[a] = 1; chips.push(a); } }); });
        h += '<label class="srch">' + ICON.search + '<input type="text" spellcheck="false" autocomplete="off" placeholder="歌曲、歌手、歌单"></label>';
        if (chips.length) h += '<div class="chips"><small>最近听过的歌手</small>' + chips.map(function (a) { return '<button class="sa-btn sec" type="button" data-q="' + esc(a) + '">' + esc(a) + '</button>'; }).join('') + '</div>';
      } else {
        if (vActs.length) h += '<div class="sa-acts">' + vActs.map(function (a, i) { return '<button class="sa-btn' + (a.sec ? ' sec' : '') + '" type="button" data-a="' + i + '">' + esc(a.label) + '</button>'; }).join('') + '</div>';
        if (vItems.length) {
          h += '<ul>' + vItems.map(function (it, i) {
            return '<li data-i="' + i + '"><span class="i">' + String(i + 1).padStart(2, '0') + '</span><span class="tx"><span class="a">' + esc(it.title) + '</span>' + (it.sub ? '<span class="b">' + esc(it.sub) + '</span>' : '') + '</span>' +
              (it.open ? '<button class="o" type="button" data-open="' + i + '">曲目</button>' : '') + '</li>';
          }).join('') + '</ul>';
        } else {
          var anyIn = m.login && m.login.any;
          h += '<div class="msg">' + (anyIn ? '这颗星暂时还没有内容。' : '登录音乐平台以后，这颗星会亮起来。') + '</div>';
          if (!anyIn) h += '<div class="sa-acts"><button class="sa-btn" type="button" data-login="1">登录 QQ 音乐 / 网易云</button><button class="sa-btn sec" type="button" data-import="1">导入本地音乐</button></div>';
        }
      }
      elDv.innerHTML = h;
      vHl = -1;
      placeViewStars();
      [].forEach.call(elNav.querySelectorAll('button[data-v]'), function (b) { b.classList.toggle('cur', b.getAttribute('data-v') === V); });
      vSig = sigOf(m);
    }
    // 条目变成目标星周围的一团星（尺寸变了只重排这团星，不重建页面）
    // [修] 没有 WebGL 时 stars 是空的：跳过，别抛错
    function placeViewStars() {
      var k = STAR_OF[V], sp = catPos(k), r = rng(hashStr(V)), n = Math.min(vItems.length, VMAX), R0 = 0.13 * H, th0 = r() * 6.28;
      elVss.innerHTML = '';
      for (var i = 0; i < VMAX; i++) {
        var s = stars[nStatic + i];
        if (!s) break;
        if (i < n) {
          var rr = R0 * (0.28 + 0.72 * Math.sqrt((i + 0.6) / (n + 0.6))), th = th0 + i * 2.39996;
          s.x = sp[0] + Math.cos(th) * rr; s.y = sp[1] + Math.sin(th) * rr * 0.82;
          s.tb = 0.95 - Math.min(0.4, i * 0.013); s.s0 = s.size = 17 + (i < 3 ? 6 : 0); s.vi = i;
          var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'sa-vs' + (vHl === i ? ' hl' : ''); bt.setAttribute('data-i', i);
          bt.innerHTML = '<span>' + esc(vItems[i].title) + '</span>'; bt.setAttribute('aria-label', vItems[i].title);
          elVss.appendChild(bt);
        } else { s.tb = 0; s.vi = -1; }
      }
    }
    function sigOf(m) { return V + '|' + VIEWS[V].items(m).map(function (it) { return it.title + ':' + it.sub; }).join('|'); }
    function refreshView() { if (V && model && sigOf(model) !== vSig) { var inp = elDv.querySelector('.srch input'); if (inp && document.activeElement === inp) return; buildView(model); } }
    function camTo(to, fly, ms) {
      if (reduced) { cam = { fx: to.fx, fy: to.fy, ax: to.ax, ay: to.ay, z: to.z }; camAnim = null; requestRender(); return; }
      camAnim = { from: { fx: cam.fx, fy: cam.fy, ax: cam.ax, ay: cam.ay, z: cam.z }, to: to, t0: performance.now(), dur: ms || (fly ? 2000 : 1600), fly: !!fly };
      requestRender();
    }
    function enterView(key) {
      if (!VIEWS[key] || destroyed) return;
      var fly = !!V && V !== key;
      if (V === key) return;
      var prevV = V;
      V = key;
      try { buildView(model || ctx.model()); } catch (err) { console.warn('[star-atlas] view', err); V = prevV; return; }
      root.classList.add('sa-in-dv'); root.setAttribute('data-sa-view', key); elDv.setAttribute('aria-hidden', 'false');
      var b = rotBase(catPos(STAR_OF[key]));
      if (!fly && !reduced) {
        // [二改] 先把镜头换成"以这颗星为焦点"的等价写法（画面不变），
        // 这样推近时这颗星从原地直接滑到目标位置，不会先被拉向屏幕中间再折回来
        var sx = (b[0] - cam.fx) * cam.z + cam.ax, sy = (b[1] - cam.fy) * cam.z + cam.ay;
        cam = { fx: b[0], fy: b[1], ax: sx, ay: sy, z: cam.z };
        camAnim = null;
      }
      camTo({ fx: b[0], fy: b[1], ax: 0.66 * W, ay: 0.47 * H, z: VIEW_Z }, fly);
      if (key === 'search') setTimeout(function () { var inp = elDv.querySelector('.srch input'); if (inp && V === 'search') inp.focus(); }, 900);
      hover = null;
    }
    function exitView(instant) {
      if (!V && !camAnim && cam.z === 1) return;
      V = null; vHl = -1;
      root.classList.remove('sa-in-dv'); root.removeAttribute('data-sa-view'); elDv.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < VMAX; i++) stars[nStatic + i] && (stars[nStatic + i].tb = 0);
      elVss.innerHTML = '';
      if (instant) { cam = { fx: 0, fy: 0, ax: 0, ay: 0, z: 1 }; camAnim = null; }
      else camTo({ fx: cam.fx, fy: cam.fy, ax: cam.fx, ay: cam.fy, z: 1 }, false, 1400);
      requestRender();
    }
    function stepCam(now) {
      if (!camAnim) return false;
      var a = camAnim, u = clamp((now - a.t0) / a.dur, 0, 1), e = easeIO(u);
      cam.fx = lerp(a.from.fx, a.to.fx, e); cam.fy = lerp(a.from.fy, a.to.fy, e);
      cam.ax = lerp(a.from.ax, a.to.ax, e); cam.ay = lerp(a.from.ay, a.to.ay, e);
      cam.z = Math.max(1, lerp(a.from.z, a.to.z, e) - (a.fly ? Math.sin(Math.PI * e) * 0.9 : 0));
      if (u >= 1) { camAnim = null; if (!V) cam = { fx: 0, fy: 0, ax: 0, ay: 0, z: 1 }; }
      return true;
    }
    // [修] 只在从星团悬停过来、且这一条真的不在列表可见区时才滚动；
    // 鼠标本来就在列表上时不滚（否则内容在光标下移动，会连着触发、一路滚到底）；推近途中星团扫过光标也不滚
    function hlItem(i, on, fromList) {
      vHl = on ? i : -1;
      [].forEach.call(elDv.querySelectorAll('li[data-i]'), function (li) { li.classList.toggle('hl', on && Number(li.getAttribute('data-i')) === i); });
      [].forEach.call(elVss.children, function (b) { b.classList.toggle('hl', on && Number(b.getAttribute('data-i')) === i); });
      if (on && !fromList && !camAnim) {
        var li = elDv.querySelector('li[data-i="' + i + '"]'), ul = li && li.parentNode;
        if (ul && ul.clientHeight) {
          // 相对列表自身算（ul 已是定位元素，offsetTop 以它为准），底部 12% 被渐隐遮住也算看不见
          var top = li.offsetTop, bot = top + li.offsetHeight, vt = ul.scrollTop, vb = vt + ul.clientHeight * 0.88;
          if (top < vt || bot > vb) ul.scrollTop = Math.max(0, top - (ul.clientHeight - li.offsetHeight) / 2);
        }
      }
      requestRender();
    }

    // ---------- 绘制 ----------
    var ringHover = null, ringR = 44;
    function render(t) {
      var e = viewE();
      // [修] 没有 GL / 上下文丢了也要画叠加层（七个标签、进度环跟着星走），否则全堆在左上角
      if (!gl || lost) { drawOverlay(e); return; }
      gl.viewport(0, 0, cv.width, cv.height);
      if (!skyF) { gl.clearColor(0.008, 0.01, 0.02, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
      else {
        var u = G.comp.u; gl.useProgram(G.comp.p);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, skyF.tex); gl.uniform1i(u.uSky, 0);
        gl.uniform4fv(u.uBox, skyBox); gl.uniform2f(u.uView, W, H); gl.uniform2f(u.uPole, L.pole[0], L.pole[1]); gl.uniform2f(u.uOff, off[0], off[1]);
        gl.uniform1f(u.uAng, ang); gl.uniform3f(u.uCam, cam.fx, cam.fy, cam.z); gl.uniform2f(u.uA, cam.ax, cam.ay);
        gl.uniform1f(u.uMW, (1 - 0.7 * e) * (1 + 0.07 * flash)); gl.uniform1f(u.uDeep, e); gl.uniform1f(u.uDpr, DPR); gl.uniform1f(u.uTime, t); gl.uniform1f(u.uFade, 1);
        quad(G.comp);
        // 亮星
        var s = G.star.u; gl.useProgram(G.star.p);
        gl.uniform2f(s.uView, W, H); gl.uniform2f(s.uPole, L.pole[0], L.pole[1]); gl.uniform1f(s.uAng, ang); gl.uniform1f(s.uDpr, DPR); gl.uniform1f(s.uTime, t);
        gl.uniform2f(s.uOff, off[0], off[1]); gl.uniform1f(s.uEnergy, energy); gl.uniform3f(s.uCam, cam.fx, cam.fy, cam.z); gl.uniform2f(s.uA, cam.ax, cam.ay);
        gl.uniform1f(s.uTw, reduced ? 0 : 1); gl.uniform1f(s.uFade, 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, G.bp); gl.enableVertexAttribArray(G.star.a); gl.vertexAttribPointer(G.star.a, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, G.bi); gl.enableVertexAttribArray(G.aInfo); gl.vertexAttribPointer(G.aInfo, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, G.bc); gl.enableVertexAttribArray(G.aCol); gl.vertexAttribPointer(G.aCol, 3, gl.FLOAT, false, 0, 0);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        gl.drawArrays(gl.POINTS, 0, stars.length);
        gl.disableVertexAttribArray(G.aInfo); gl.disableVertexAttribArray(G.aCol);
        // 地平线（推近时往下沉、变淡）
        if (horF && hAlpha > 0.01) {
          var h = G.hord.u; gl.useProgram(G.hord.p);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, horF.tex); gl.uniform1i(h.uTex, 0);
          gl.uniform4fv(h.uBox, horBox); gl.uniform2f(h.uView, W, H); gl.uniform2f(h.uOff, hoff[0], hoff[1]); gl.uniform1f(h.uAlpha, hAlpha);
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          quad(G.hord);
        }
        // 暗角
        gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
        gl.useProgram(G.vig.p); gl.uniform2f(G.vig.u.uView, W, H); gl.uniform1f(G.vig.u.uAmt, 0.55); gl.uniform2f(G.vig.u.uFocus, 0.35, 0.45);
        quad(G.vig);
        gl.disable(gl.BLEND);
      }
      drawOverlay(e);
    }
    function drawOverlay(e) {
      var g = octx;
      g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
      drawLife(g);
      var P = function (k) { return toScr(catPos(k)); };
      var tk = V ? STAR_OF[V] : null;
      // 北斗连线
      g.lineWidth = 0.7;
      DIPPER_LINES.forEach(function (ln) {
        var pa = P(ln[0]), pb = P(ln[1]), dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.hypot(dx, dy) || 1, gp = 16 / d;
        var hot = hover === ln[0] || hover === ln[1], tgt = tk && (ln[0] === tk || ln[1] === tk);
        var a = (hot ? 0.42 : 0.24) * (1 - 0.8 * e) + (tgt ? 0.14 * e : 0);
        g.strokeStyle = 'rgba(' + (hot ? '236,222,190' : '210,200,178') + ',' + a.toFixed(3) + ')';
        g.beginPath(); g.moveTo(pa[0] + dx * gp, pa[1] + dy * gp); g.lineTo(pb[0] - dx * gp, pb[1] - dy * gp); g.stroke();
      });
      var fa = 1 - e;
      var pm = P('merak'), pd = P('dubhe'), pp = P('polaris');
      if (fa > 0.02) {
        // 指极线：天璇 → 天枢 → 北极星
        g.setLineDash([2, 7]); g.strokeStyle = 'rgba(201,168,106,' + (0.22 * fa).toFixed(3) + ')';
        g.beginPath(); g.moveTo(pd[0] + (pd[0] - pm[0]) * 0.25, pd[1] + (pd[1] - pm[1]) * 0.25); g.lineTo(pp[0] + (pd[0] - pp[0]) * 0.07, pp[1] + (pd[1] - pp[1]) * 0.07); g.stroke(); g.setLineDash([]);
        var mx = (pd[0] + pp[0]) / 2, my = (pd[1] + pp[1]) / 2, an = Math.atan2(pp[1] - pd[1], pp[0] - pd[0]) + Math.PI;
        g.save(); g.translate(mx, my); g.rotate(an); g.fillStyle = 'rgba(201,168,106,' + (0.34 * fa).toFixed(3) + ')'; g.font = '10px ' + SERIF; g.textAlign = 'center'; g.fillText('指  极', 0, -8); g.restore();
        // 北极星：进度环
        var rr = ringR, has = model && model.now, prog = has && dur ? curPos() / dur : 0;
        g.lineWidth = 1; g.strokeStyle = 'rgba(236,230,216,' + (0.16 * fa).toFixed(3) + ')';
        g.beginPath(); g.arc(pp[0], pp[1], rr, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = 'rgba(236,230,216,' + (0.14 * fa).toFixed(3) + ')';
        g.beginPath();
        for (var i = 0; i < 60; i++) { var a2 = i / 60 * Math.PI * 2, l = i % 5 === 0 ? 6 : 3; g.moveTo(pp[0] + Math.cos(a2) * (rr + 4), pp[1] + Math.sin(a2) * (rr + 4)); g.lineTo(pp[0] + Math.cos(a2) * (rr + 4 + l), pp[1] + Math.sin(a2) * (rr + 4 + l)); }
        g.stroke();
        if (has) {
          g.strokeStyle = 'rgba(214,184,122,' + ((0.62 + 0.3 * energy) * fa).toFixed(3) + ')'; g.lineWidth = 1.2;
          g.beginPath(); g.arc(pp[0], pp[1], rr, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); g.stroke();
          var ea = -Math.PI / 2 + prog * Math.PI * 2; g.fillStyle = 'rgba(240,215,160,' + (0.95 * fa).toFixed(3) + ')';
          g.beginPath(); g.arc(pp[0] + Math.cos(ea) * rr, pp[1] + Math.sin(ea) * rr, 1.8, 0, Math.PI * 2); g.fill();
          if (ringHover != null && dur) {
            var ha = -Math.PI / 2 + ringHover * Math.PI * 2;
            g.strokeStyle = 'rgba(240,225,190,.7)'; g.beginPath(); g.moveTo(pp[0] + Math.cos(ha) * (rr - 5), pp[1] + Math.sin(ha) * (rr - 5)); g.lineTo(pp[0] + Math.cos(ha) * (rr + 12), pp[1] + Math.sin(ha) * (rr + 12)); g.stroke();
            g.fillStyle = 'rgba(236,230,216,.75)'; g.font = '11px ' + THIN; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(fmt(ringHover * dur), pp[0] + Math.cos(ha) * (rr + 26), pp[1] + Math.sin(ha) * (rr + 26)); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
          }
        }
        // 北极星 → 正在播放
        g.strokeStyle = 'rgba(236,230,216,' + (0.10 * fa).toFixed(3) + ')'; g.lineWidth = 0.7;
        if (npTop - 18 > pp[1] + rr + 16) { g.beginPath(); g.moveTo(pp[0], pp[1] + rr + 16); g.lineTo(pp[0], npTop - 18); g.stroke(); }
      }
      if (hover && !V) { var hp = P(hover); g.strokeStyle = 'rgba(236,222,190,.45)'; g.lineWidth = 0.8; g.beginPath(); g.arc(hp[0], hp[1], 15, 0, Math.PI * 2); g.stroke(); }
      if (tk) {
        var tp = P(tk); g.strokeStyle = 'rgba(236,222,190,' + (0.35 * e).toFixed(3) + ')'; g.lineWidth = 0.8;
        g.beginPath(); g.arc(tp[0], tp[1], 22, 0, Math.PI * 2); g.stroke();
        var n = Math.min(vItems.length, VMAX, Math.max(0, stars.length - nStatic));
        if (vHl >= 0 && vHl < n) {
          var sh = stars[nStatic + vHl], qh = toScr([sh.x, sh.y]), dx2 = qh[0] - tp[0], dy2 = qh[1] - tp[1], dd = Math.hypot(dx2, dy2) || 1;
          g.strokeStyle = 'rgba(236,222,190,.6)'; g.beginPath(); g.arc(qh[0], qh[1], 11, 0, Math.PI * 2); g.stroke();
          g.strokeStyle = 'rgba(236,222,190,.18)'; g.beginPath(); g.moveTo(tp[0] + dx2 / dd * 26, tp[1] + dy2 / dd * 26); g.lineTo(qh[0] - dx2 / dd * 13, qh[1] - dy2 / dd * 13); g.stroke();
        }
      }
      // DOM 跟随
      DIPPER.forEach(function (k) {
        var p = P(k), d = DIR[k], b = labEls[k];
        b.style.left = (p[0] + d[0] * 26) + 'px'; b.style.top = (p[1] + d[1] * 23) + 'px';
        b.classList.toggle('left', d[0] < 0);
      });
      elPol.style.left = (pp[0] + ringR + 22) + 'px'; elPol.style.top = (pp[1] - 14) + 'px';
      var rs = (ringR + 16) * 2; elRing.style.width = elRing.style.height = rs + 'px'; elRing.style.left = pp[0] + 'px'; elRing.style.top = pp[1] + 'px';
      if (V) [].forEach.call(elVss.children, function (bt) { var i = Number(bt.getAttribute('data-i')), s = stars[nStatic + i]; if (!s) return; var q = toScr([s.x, s.y]); bt.style.left = q[0] + 'px'; bt.style.top = q[1] + 'px'; });
    }

    // ---------- 主循环 ----------
    function requestRender() { needRender = true; if (!raf && !paused && !destroyed) raf = requestAnimationFrame(frame); }
    var hovBusy = false;
    function frame(nowMs) {
      raf = 0;
      if (destroyed || paused) return;
      var t = (nowMs - t0) / 1000, dt = clamp(t - lastT, 0, 0.1); lastT = t;
      var baking = jobs.length > 0 && !!gl && !lost;
      if (baking) runJob();
      if (dprNow() !== DPR) scheduleSize();
      mouse.sx += (mouse.nx - mouse.sx) * Math.min(1, dt * 2.2);
      mouse.sy += (mouse.ny - mouse.sy) * Math.min(1, dt * 2.2);
      var e0 = viewE();
      ang = skyAng();
      off = [-mouse.sx * 5, -mouse.sy * 3.5];
      var camBusy = stepCam(nowMs);
      var e = viewE();
      hoff = [-mouse.sx * 16, -mouse.sy * 6 + e * 0.42 * H]; hAlpha = 1 - 0.9 * e;
      var lifeBusy = stepLife(dt);
      stepEnergy(dt);
      var parBusy = Math.abs(mouse.nx - mouse.sx) + Math.abs(mouse.ny - mouse.sy) > 0.002;
      var moving = mouse.inside && nowMs - mouse.last < 300;
      // [修] 只有真正的交互/短暂动画才跑满帧：流星、推近/飞行、鼠标刚动过、烘焙、悬停渐变；
      // 卫星、飞机、音乐起伏走 33ms 的空闲节奏
      var busy = baking || camBusy || lifeBusy || parBusy || moving || hovBusy || e0 !== e;
      var interval = busy ? 0 : (reduced ? 1e9 : 33);
      if (needRender || nowMs - lastDraw >= interval - 1) {
        // [修] 亮星只在真正要画的帧上计算、上传（hovBusy 留给下一帧判断）
        hovBusy = stars.length ? lightStars() : false;
        render(t); lastDraw = nowMs; needRender = false;
      }
      if (!reduced || busy || hovBusy) raf = requestAnimationFrame(frame);
    }

    // ---------- 尺寸 ----------
    var sized = null, resizeTimer = 0;
    function scheduleSize() {
      if (destroyed || resizeTimer) return;
      resizeTimer = setTimeout(function () { resizeTimer = 0; if (!destroyed) sizeAll(); }, 150);
    }
    // [修] 宽高和缩放比例都没变就什么也不做（不重新烘焙、不重建）；force 用于上下文恢复
    function sizeAll(force) {
      var nw = Math.max(320, root.clientWidth || window.innerWidth), nh = Math.max(240, root.clientHeight || window.innerHeight), nd = dprNow();
      if (!force && sized && sized[0] === nw && sized[1] === nh && sized[2] === nd) return;
      sized = [nw, nh, nd];
      W = nw; H = nh; DPR = nd;
      [cv, ov].forEach(function (c) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); });
      L.pole = [0.20 * W, 0.345 * H]; L.S = Math.min(1.45 * H, 0.9 * W);
      // 摇光（最右上那颗）不能钻到右上角窗口按钮和账号区下面：按摆动到最高时的位置限制北斗大小
      var safeR = parseFloat(getComputedStyle(root).getPropertyValue('--hth-safe-r')) || 300;
      var safeT = parseFloat(getComputedStyle(root).getPropertyValue('--hth-safe-t')) || 112;
      var ak = CAT.alkaid, akr = 2 * Math.tan((90 - ak[1]) * DEG / 2), aka = -(ak[0] + ROT) * DEG - 0.05;
      var akx = akr * Math.cos(aka), aky = akr * Math.sin(aka);
      if (L.pole[1] + aky * L.S < safeT + 40 && L.pole[0] + akx * L.S > W - safeR - 10) L.S = Math.min(L.S, (W - safeR - 10 - L.pole[0]) / akx);
      ringR = clamp(Math.round(H * 0.042), 34, 70);
      if (gl && !lost) {
        if (pending) { freeFbo(pending.sky); freeFbo(pending.hor); pending = null; }
        planBake(); buildStars();
      }
      // [修] 推近页不再重建 DOM（搜索框里正在输入的字和焦点都保留），只重排星团、把镜头直接放到新位置
      if (V) {
        placeViewStars();
        var b = rotBase(catPos(STAR_OF[V]));
        cam = { fx: b[0], fy: b[1], ax: 0.66 * W, ay: 0.47 * H, z: VIEW_Z }; camAnim = null;
      }
      cacheNp();
      requestRender();
    }

    // ---------- 交互 ----------
    var listeners = [];
    function on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt); listeners.push([el, ev, fn, opt]); }
    function playMain() { var m = model || ctx.model(); if (!m || !m.now) return; if (m.now.playing) A.togglePlay(); else A.resume(); }
    function goImmersive() { if (model && model.now && A.openImmersive) A.openImmersive(); else playMain(); }
    on(root, 'pointermove', function (e) {
      var r = root.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.inside = true; mouse.last = performance.now();
      mouse.nx = clamp(mouse.x / Math.max(1, r.width) * 2 - 1, -1, 1); mouse.ny = clamp(mouse.y / Math.max(1, r.height) * 2 - 1, -1, 1);
      requestRender();
    });
    on(root, 'pointerleave', function () { mouse.inside = false; mouse.nx = 0; mouse.ny = 0; requestRender(); });
    on(cv, 'click', function (e) {
      if (V) { exitView(false); return; }
      var r = root.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      var ry = ridgeY ? ridgeY[clamp(Math.round((x - hoff[0]) / 2), 0, ridgeY.length - 1)] + hoff[1] : H * 0.8;
      if (y < ry - 10) { spawnMeteor('sky', [x, y]); requestRender(); }
    });
    DIPPER.forEach(function (k) {
      var b = labEls[k];
      on(b, 'click', function () { enterView(ENTRY[k]); });
      on(b, 'pointerenter', function () { hover = k; requestRender(); });
      on(b, 'pointerleave', function () { if (hover === k) hover = null; requestRender(); });
      on(b, 'focus', function () { hover = k; requestRender(); });
      on(b, 'blur', function () { if (hover === k) hover = null; });
    });
    // [修] 只有环附近一圈（离环 14px 以内）才是拖进度；环里面点一下是播放/暂停
    function ringHit(e) {
      var r = root.getBoundingClientRect(), pp = toScr(catPos('polaris'));
      var dx = e.clientX - r.left - pp[0], dy = e.clientY - r.top - pp[1];
      var a = Math.atan2(dy, dx) + Math.PI / 2;
      a = a < 0 ? a + Math.PI * 2 : a;
      return { band: Math.abs(Math.hypot(dx, dy) - ringR) <= 14, frac: clamp(a / (Math.PI * 2), 0, 0.999) };
    }
    on(elRing, 'pointermove', function (e) {
      if (!model || !model.now) return;
      var h = ringHit(e), nh = h.band ? h.frac : null;
      elRing.title = h.band ? '' : (model.now.playing ? '暂停' : '播放');
      if (nh !== ringHover) { ringHover = nh; requestRender(); }
    });
    on(elRing, 'pointerleave', function () { ringHover = null; requestRender(); });
    on(elRing, 'click', function (e) {
      if (!model || !model.now) return;
      var h = ringHit(e);
      if (h.band) A.seek(h.frac); else playMain();
    });
    on(elTitle, 'click', goImmersive);
    on(elPP, 'click', playMain);
    on($('.sa-prev'), 'click', function () { A.prev(); });
    on($('.sa-nxt'), 'click', function () { A.next(); });
    on(elNext, 'click', function () { A.next(); });
    on(elLike, 'click', function () { A.toggleLike(); });
    on(elLyr, 'click', function () { A.toggleLyrics(); });
    on(elQuote, 'click', function () { A.nextQuote(); });
    on($('.sa-login'), 'click', function () { A.openLogin(); });
    on($('.sa-import'), 'click', function () { A.importLocal(); });
    on(elInput, 'focus', function () { elSearch.classList.add('f'); });
    on(elInput, 'blur', function () { elSearch.classList.remove('f'); });
    on(elInput, 'keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') A.search(elInput.value.trim());
      else if (e.key === 'Escape') { elInput.value = ''; elInput.blur(); }
    });
    on(elDv, 'click', function (e) {
      var t = e.target;
      var op = t.closest('[data-open]');
      if (op && V && VIEWS[V].open) { e.stopPropagation(); var oi = Number(op.getAttribute('data-open')) || 0; if (vItems[oi]) VIEWS[V].open(vItems[oi], oi); return; }
      var ac = t.closest('[data-a]'); if (ac) { var f = vActs[Number(ac.getAttribute('data-a'))]; if (f) f.fn(); return; }
      if (t.closest('[data-login]')) { A.openLogin(); return; }
      if (t.closest('[data-import]')) { A.importLocal(); return; }
      var qb = t.closest('[data-q]'); if (qb) { A.search(qb.getAttribute('data-q')); return; }
      var li = t.closest('li[data-i]');
      if (li && V && VIEWS[V].play) { var i = Number(li.getAttribute('data-i')) || 0; if (vItems[i]) VIEWS[V].play(vItems[i], i); }
    });
    on(elDv, 'keydown', function (e) {
      var inp = e.target.closest && e.target.closest('.srch input'); if (!inp) return;
      e.stopPropagation();
      if (e.key === 'Enter') A.search(inp.value.trim());
      else if (e.key === 'Escape') { if (inp.value) inp.value = ''; else exitView(false); }
    });
    on(elDv, 'pointerover', function (e) { var li = e.target.closest('li[data-i]'); if (li) hlItem(Number(li.getAttribute('data-i')), true, true); });
    on(elDv, 'pointerout', function (e) { var li = e.target.closest('li[data-i]'); if (li && !li.contains(e.relatedTarget)) hlItem(Number(li.getAttribute('data-i')), false); });
    on(elVss, 'pointerover', function (e) { var b = e.target.closest('.sa-vs'); if (b) hlItem(Number(b.getAttribute('data-i')), true); });
    on(elVss, 'pointerout', function (e) { var b = e.target.closest('.sa-vs'); if (b) hlItem(Number(b.getAttribute('data-i')), false); });
    on(elVss, 'click', function (e) { var b = e.target.closest('.sa-vs'); if (b && V && VIEWS[V].play) { var i = Number(b.getAttribute('data-i')); if (vItems[i]) VIEWS[V].play(vItems[i], i); } });
    on(elNav, 'click', function (e) { var b = e.target.closest('button[data-v]'); if (!b) return; var k = b.getAttribute('data-v'); if (k === 'home') exitView(false); else enterView(k); });
    // [修] Esc 不再在 window 捕获阶段抢：冒泡阶段处理，给软件自己的弹窗 / 面板先用。
    // 捕获阶段只"记下"按下时有没有弹窗或面板开着（软件的全局 Esc 会先把面板关掉，冒泡时就看不出来了），不拦截
    var escBlocked = false;
    function appOverlayOpen() {
      try {
        if (typeof immersiveMode !== 'undefined' && immersiveMode) return true;
        if (typeof miniQueueOpen !== 'undefined' && miniQueueOpen) return true;
        if (typeof shelfManager !== 'undefined' && shelfManager && shelfManager.hasOpenContent && shelfManager.hasOpenContent()) return true;
        return !!document.querySelector('.modal-mask.show,#hotkey-modal.show,#upload-panel.show,#fx-panel.show,#playlist-panel.show,#playlist-panel.peek:not(.pinned)');
      } catch (_e) { return false; }
    }
    function onEsc(e) {
      if (e.key !== 'Escape' || !V || paused || destroyed || e.defaultPrevented) return;
      var t = e.target;
      // 焦点在主题外面的别的控件上（弹窗、面板里的输入框等）：不管
      if (t && t.nodeType === 1 && t !== document.body && t !== document.documentElement && !root.contains(t)) return;
      if (escBlocked || appOverlayOpen()) {
        // 从「曲目」打开的歌单面板只是 peek 状态，软件的全局 Esc 关不掉它：这里替它收起来，下一次 Esc 再退出推近页
        var pl = document.getElementById('playlist-panel');
        if (pl && pl.classList.contains('peek') && !pl.classList.contains('pinned') && !document.querySelector('.modal-mask.show') && typeof closePlaylistPanelSoft === 'function') {
          e.preventDefault(); e.stopPropagation(); closePlaylistPanelSoft('escape-key');
        }
        return;
      }
      e.preventDefault(); e.stopPropagation(); exitView(false);
    }
    on(window, 'keydown', function (e) { if (e.key === 'Escape') escBlocked = appOverlayOpen(); }, true);
    on(root, 'keydown', onEsc);
    on(document, 'keydown', onEsc);
    // [修] 上下文丢失：约 4 秒还没恢复就换成 CSS 渐变背景（标签照常跟着走）
    var lostTimer = 0;
    function setNoGL(v) { root.classList.toggle('sa-nogl', !!v); }
    on(cv, 'webglcontextlost', function (e) {
      e.preventDefault(); lost = true; requestRender();
      clearTimeout(lostTimer); lostTimer = setTimeout(function () { if (!destroyed && lost) setNoGL(true); }, 4000);
    });
    on(cv, 'webglcontextrestored', function () {
      lost = false; skyF = horF = pending = null; jobs = [];
      clearTimeout(lostTimer); lostTimer = 0;
      try { initGL(); setNoGL(false); sizeAll(true); } catch (err) { console.warn('[star-atlas] restore', err); gl = null; setNoGL(true); }
    });

    // ---------- 启动 ----------
    try { initGL(); } catch (err) { console.warn('[star-atlas] WebGL', err); gl = null; setNoGL(true); }
    sizeAll();
    try { applyModel(ctx.model(), true); } catch (err) { console.warn('[star-atlas] model', err); }

    return {
      // 右键回退：推近的页面里，退回整张星图
      back: function () {
        if (destroyed || paused || !V) return false;
        exitView(false);
        return true;
      },
      update: function (m) { if (!destroyed && m) applyModel(m, false); },
      resize: function () {
        if (destroyed) return;
        clearTimeout(resizeTimer); resizeTimer = 0;
        scheduleSize();
      },
      pause: function () {
        paused = true;
        if (raf) cancelAnimationFrame(raf); raf = 0;
        if (V || cam.z !== 1) exitView(true);
      },
      resume: function () {
        if (destroyed) return;
        paused = false;
        t0 = performance.now() - lastT * 1000;
        requestRender();
      },
      destroy: function () {
        destroyed = true;
        if (raf) cancelAnimationFrame(raf); raf = 0;
        clearTimeout(resizeTimer); clearTimeout(swapTimer); clearTimeout(lostTimer);
        listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
        listeners = [];
        if (gl) {
          freeFbo(skyF); freeFbo(horF); if (pending) { freeFbo(pending.sky); freeFbo(pending.hor); }
          [G.quad, G.bp, G.bi, G.bc].forEach(function (b) { if (b) gl.deleteBuffer(b); });
          ['sky', 'comp', 'hor', 'hord', 'vig', 'star'].forEach(function (k) { if (G[k]) gl.deleteProgram(G[k].p); });
          try { var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (_e) { }
          gl = null;
        }
        skyF = horF = pending = null; jobs = []; stars = []; meteors = []; sats = []; trains = [];
        root.innerHTML = '';
        root.classList.remove('hth-sa-isempty', 'sa-in-dv', 'sa-nogl'); root.removeAttribute('data-sa-view');
      }
    };
  }

  // ---------- 播放页背景：同一片夜空，缓慢转动（3D 粒子叠在上面） ----------
  var SPECTRAL = [
    { c: [0.66, 0.76, 1.00], w: 0.10 }, { c: [0.84, 0.89, 1.00], w: 0.22 }, { c: [0.98, 0.97, 0.95], w: 0.20 },
    { c: [1.00, 0.92, 0.80], w: 0.18 }, { c: [1.00, 0.80, 0.60], w: 0.22 }, { c: [1.00, 0.68, 0.46], w: 0.08 }
  ];
  function spectral(r) { var x = r(), acc = 0; for (var i = 0; i < SPECTRAL.length; i++) { acc += SPECTRAL[i].w; if (x <= acc) return SPECTRAL[i].c; } return SPECTRAL[2].c; }
  var BACKDROP = {
    css: [
      '#hth-backdrop.hbd-star-atlas{background:radial-gradient(130% 100% at 32% 18%,rgba(10,13,24,.92),rgba(3,4,9,.95) 58%,rgba(1,2,5,.98))}',
      '#hth-backdrop.hbd-star-atlas .hbd-sky{position:absolute;left:20%;top:36%;width:190vmax;height:190vmax;margin:-95vmax 0 0 -95vmax;background-size:100% 100%;opacity:.66;animation:hbd-sa-rot 3600s linear infinite;will-change:transform}',
      '#hth-backdrop.hbd-star-atlas .hbd-vig{position:absolute;inset:0;background:radial-gradient(120% 95% at 50% 45%,rgba(0,0,0,0) 55%,rgba(0,0,0,.55))}',
      '@keyframes hbd-sa-rot{to{transform:rotate(-360deg)}}',
      '@media (prefers-reduced-motion:reduce){#hth-backdrop.hbd-star-atlas .hbd-sky{animation:none}}'
    ].join('\n'),
    html: '<div class="hbd-sky"></div><div class="hbd-vig"></div>',
    build: function (box) {
      var S = 1800, c = document.createElement('canvas'); c.width = c.height = S;
      var g = c.getContext('2d'), r = rng(0x5eed);
      g.save(); g.translate(S / 2, S / 2); g.rotate(-1.35);
      for (var i = 0; i < 110; i++) {
        var x = (r() - 0.5) * S * 1.3, y = (r() + r() + r() - 1.5) * S * 0.06 + S * 0.12, rad = S * (0.03 + r() * 0.08);
        var gr = g.createRadialGradient(x, y, 0, x, y, rad), warm = r() < 0.4;
        gr.addColorStop(0, warm ? 'rgba(200,180,150,.032)' : 'rgba(150,170,220,.03)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      g.restore();
      for (var j = 0; j < 1900; j++) {
        var sx = r() * S, sy = r() * S, m = Math.pow(r(), 3.4), c0 = spectral(r), a = 0.16 + m * 0.8, rr = 0.45 + m * 1.3;
        g.fillStyle = 'rgba(' + Math.round(c0[0] * 255) + ',' + Math.round(c0[1] * 255) + ',' + Math.round(c0[2] * 255) + ',' + a.toFixed(3) + ')';
        g.beginPath(); g.arc(sx, sy, rr, 0, Math.PI * 2); g.fill();
        if (m > 0.55) { var hg = g.createRadialGradient(sx, sy, 0, sx, sy, rr * 5); hg.addColorStop(0, 'rgba(210,220,255,' + (0.12 * m).toFixed(3) + ')'); hg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = hg; g.fillRect(sx - rr * 5, sy - rr * 5, rr * 10, rr * 10); }
      }
      var sky = box.querySelector('.hbd-sky');
      try { if (sky) sky.style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')'; } catch (_e) { }
    }
  };

  registerHomeTheme({
    id: ID,
    name: '星图',
    cordColor: 'rgba(222,216,202,.55)',
    cordGlow: 'rgba(170,190,255,.22)',
    backdrop: BACKDROP,
    create: createStarAtlas
  });
})();
