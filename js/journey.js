/* ============================================================
   Space Journey — 추가 레이어 (main.js 를 전혀 건드리지 않는다)

   설계 원칙
   - 기존 별밭(#starfield, WebGL/CSS 폴백)과 블랙홀(.bh-video)은 그대로 두고,
     그 위에 반투명 캔버스 한 장만 얹는다. 별이 항상 비쳐 보인다.
   - 섹션마다 새 배경을 만들지 않는다. 하나의 우주가 단계별로 변형된다.
   - body[data-page="0"](Hero)에서는 opacity 0 → 시각적 영향 완전 0.
   - main.js 와 결합하지 않고 body[data-page] 변화를 MutationObserver 로 관찰.
   ============================================================ */
(function () {
  'use strict';

  var cv = document.getElementById('journey');
  if (!cv) return;
  var ctx = cv.getContext('2d', { alpha: true });
  if (!ctx) return;

  var mqReduce = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion:reduce)') : null;
  var reduce = mqReduce ? mqReduce.matches : false;
  if (mqReduce && mqReduce.addEventListener) {
    mqReduce.addEventListener('change', function (e) { reduce = e.matches; });
  }

  var W = 0, H = 0, DPR = 1, MIN = 0;
  var tier = 'desktop';                    // desktop | tablet | mobile

  function measure() {
    var w = window.innerWidth, h = window.innerHeight;
    tier = w <= 640 ? 'mobile' : (w <= 1024 ? 'tablet' : 'desktop');
    // 1x 모니터에서도 2x 로 그려 다운샘플 → 가장자리가 매끈해진다
    DPR = Math.max(tier === 'mobile' ? 1.5 : 2,
                   Math.min(window.devicePixelRatio || 1, 2));
    W = w; H = h; MIN = Math.min(W, H);
    cv.width = Math.max(1, Math.round(W * DPR));
    cv.height = Math.max(1, Math.round(H * DPR));
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
    if (!g3Tried) { g3Tried = true; G3 = init3D(); }
    resize3D();
  }

  /* ---------- 단계 상태 ---------- */
  // 0 Hero / 1 Galaxy / 2 Solar / 3 Planets / 4 Satellites / 5 Log / 6 End
  var page = 0, shown = 0;                 // shown = 부드럽게 따라가는 값
  var selected = -1, selT = 0;             // 선택 인덱스, 접근 진행도 0..1
  var kind = 'project';                    // project | contest
  var focusIdx = -1;                       // hover/focus -> 궤도 감속
  var t = 0, raf = 0, running = true;

  function readPage() {
    var p = parseInt(document.body.dataset.page || '0', 10);
    page = isNaN(p) ? 0 : p;
  }
  readPage();
  shown = page;

  new MutationObserver(readPage).observe(document.body, {
    attributes: true, attributeFilter: ['data-page']
  });

  /* ---------- 정적 데이터 ---------- */
  // 프로젝트 4개 — 표면/대기/링/달을 서로 다르게
  var PLANETS = [
    { name: 'AX', body: [92, 116, 168], hi: [176, 200, 245], rim: [150, 205, 255],
      r: 0.092, tex: 'bands',  ring: 0.0,  moon: 0, spin: 0.10, orbit: 0.055 },
    { name: 'BX', body: [126, 96, 176], hi: [206, 178, 250], rim: [196, 168, 255],
      r: 0.105, tex: 'swirl',  ring: 0.0,  moon: 1, spin: 0.07, orbit: 0.042 },
    { name: 'CX', body: [58, 122, 138], hi: [140, 214, 226], rim: [120, 226, 240],
      r: 0.086, tex: 'ocean',  ring: 0.0,  moon: 0, spin: 0.12, orbit: 0.068 },
    { name: 'DX', body: [138, 116, 96],  hi: [216, 190, 158], rim: [246, 206, 140],
      r: 0.098, tex: 'crater', ring: 1.55, moon: 0, spin: 0.05, orbit: 0.033 }
  ];
  // 공모전 3개 — 위성(작고 차가운 회보라), 이차 궤도
  var SATS = [
    { name: 'C1', body: [128, 124, 158], hi: [198, 196, 224], rim: [186, 176, 255], r: 0.046, spin: 0.16, orbit: 0.10 },
    { name: 'C2', body: [110, 118, 150], hi: [180, 192, 222], rim: [160, 190, 255], r: 0.038, spin: 0.20, orbit: 0.13 },
    { name: 'C3', body: [136, 118, 132], hi: [206, 186, 202], rim: [214, 176, 226], r: 0.042, spin: 0.13, orbit: 0.083 }
  ];
  // Skills 카테고리 = 태양계 기술 노드
  var NODES = ['Backend', 'Data/AI', 'GIS', 'Infra'];

  /* ---------- 빌드(리사이즈 시 재계산) ---------- */
  var arms = [], dust = [], texCache = {};
  var gparts = null;                        // 은하핵 강착 입자
  function newGPart(spread) {
    return {
      ang: Math.random() * Math.PI * 2,
      rad: spread ? (1.25 + Math.random() * 1.60) : (2.10 + Math.random() * 0.80),
      spd: 0.006 + Math.random() * 0.013,
      pull: 0.0010 + Math.random() * 0.0040,
      warm: Math.random() < 0.5,
      a: Math.random() * 0.45 + 0.30,
      sz: Math.random() * 1.3 + 0.5
    };
  }

  function build() {
    texCache = {}; gparts = null;
    var armCount = 4;
    var per = tier === 'mobile' ? 130 : (tier === 'tablet' ? 240 : 420);
    arms = [];
    for (var a = 0; a < armCount; a++) {
      var base = (a / armCount) * Math.PI * 2;
      for (var i = 0; i < per; i++) {
        var f = i / per;
        var rad = Math.pow(f, 0.62) * MIN * 0.92;
        var theta = base + f * 2.5 + (Math.random() - 0.5) * 0.30;
        var jitter = (1 - f) * MIN * 0.012 + MIN * 0.010;
        arms.push({
          r: rad + (Math.random() - 0.5) * jitter * 3,
          a: theta,
          z: Math.random(),                          // 깊이 0(뒤)~1(앞)
          s: 0.5 + Math.random() * 1.6,
          c: Math.random()
        });
      }
    }
    var dn = tier === 'mobile' ? 12 : (tier === 'tablet' ? 22 : 34);
    dust = [];
    for (var d = 0; d < dn; d++) {
      dust.push({
        r: Math.pow(Math.random(), 0.5) * MIN * 0.85,
        a: Math.random() * Math.PI * 2,
        s: MIN * (0.05 + Math.random() * 0.13),
        z: Math.random(),
        h: Math.random()
      });
    }
  }

  /* ---------- 유틸 ---------- */
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  // 특정 단계에서의 가중치 (shown 이 p 에 가까울수록 1)
  function w(p, span) { return clamp01(1 - Math.abs(shown - p) / (span || 1)); }

  /* ---------- 행성 텍스처 (오프스크린, 1회 생성 후 재사용) ---------- */
  function makeTexture(P, px) {
    var key = P.name + '_' + px;
    if (texCache[key]) return texCache[key];
    var tw = Math.max(24, Math.round(px * 4)), th = Math.max(12, Math.round(px * 2));
    var oc = document.createElement('canvas');
    oc.width = tw; oc.height = th;
    var o = oc.getContext('2d');
    o.fillStyle = rgba(P.body, 1); o.fillRect(0, 0, tw, th);
    var i, n, x, y, r;
    // 가로 이음매가 보이지 않도록 모든 피처를 x-tw / x+tw 에도 복제한다
    function tri(fn){ fn(0); fn(-tw); fn(tw); }
    if (P.tex === 'bands') {
      for (i = 0; i < 9; i++) {
        y = (i / 9) * th; var hgt = th * (0.03 + Math.random() * 0.05);
        o.fillStyle = rgba(i % 2 ? P.hi : P.body, 0.26 + Math.random() * 0.16);
        o.fillRect(0, y, tw, hgt);   // 밴드는 가로 전체라 이음매 없음
      }
    } else if (P.tex === 'swirl') {
      for (i = 0; i < 14; i++) {
        o.beginPath();
        x = Math.random() * tw; y = Math.random() * th;
        r = th * (0.06 + Math.random() * 0.16);
        var rot0 = Math.random() * 0.6 - 0.3, al0 = 0.18 + Math.random() * 0.18;
        tri(function(dx){ o.beginPath(); o.ellipse(x+dx, y, r*2.1, r, rot0, 0, 7);
          o.fillStyle = rgba(P.hi, al0); o.fill(); });
      }
    } else if (P.tex === 'ocean') {
      for (i = 0; i < 11; i++) {
        o.beginPath();
        x = Math.random() * tw; y = Math.random() * th;
        r = th * (0.05 + Math.random() * 0.13);
        var al1 = 0.22 + Math.random() * 0.16;
        tri(function(dx){ o.beginPath(); o.ellipse(x+dx, y, r*1.7, r, 0, 0, 7);
          o.fillStyle = rgba(P.hi, al1); o.fill(); });
      }
    } else { // crater
      for (i = 0, n = 22; i < n; i++) {
        x = Math.random() * tw; y = Math.random() * th;
        r = th * (0.015 + Math.random() * 0.055);
        tri(function(dx){
          o.beginPath(); o.arc(x+dx, y, r, 0, 7); o.fillStyle = rgba(P.hi, 0.18); o.fill();
          o.beginPath(); o.arc(x+dx - r*0.18, y - r*0.18, r*0.78, 0, 7);
          o.fillStyle = 'rgba(0,0,0,0.22)'; o.fill(); });
      }
    }
    texCache[key] = oc;
    return oc;
  }



  /* ============================================================
     3D 행성 레이어 (three.js) — 본체만 담당
     2D 캔버스가 흉내내던 조명/터미네이터/구체감을 실제 계산으로 대체한다.
     텍스처는 makeTexture/makeClouds 가 만든 캔버스를 그대로 재사용하므로
     외부 에셋·라이선스 의무가 없다.
     WebGL 을 못 쓰면 G3 가 null 로 남고 기존 2D 본체 렌더러가 폴백한다.
     ============================================================ */
  var G3 = null, g3Tried = false;

  function webglOK() {
    try {
      if (!window.WebGLRenderingContext) return false;
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return false;
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return true;
    } catch (e) { return false; }
  }

  // 표면 요철용 그레이스케일 범프맵 (지형 텍스처에서 파생)
  function makeBump(P, px) {
    var key = 'bp_' + P.name + '_' + px;
    if (texCache[key]) return texCache[key];
    var src = makeTexture(P, px);
    var oc = document.createElement('canvas');
    oc.width = src.width; oc.height = src.height;
    var o = oc.getContext('2d');
    o.drawImage(src, 0, 0);
    var im = o.getImageData(0, 0, oc.width, oc.height), d = im.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    o.putImageData(im, 0, 0);
    texCache[key] = oc;
    return oc;
  }

  var ATMO_VS = [
    'varying vec3 vN; varying vec3 vP;',
    'void main(){ vN = normalize(normalMatrix * normal);',
    '  vec4 mv = modelViewMatrix * vec4(position,1.0); vP = mv.xyz;',
    '  gl_Position = projectionMatrix * mv; }'
  ].join('\n');
  var ATMO_FS = [
    'uniform vec3 uC; uniform float uP; uniform float uI;',
    'varying vec3 vN; varying vec3 vP;',
    'void main(){',
    '  float f = pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), uP);',
    '  gl_FragColor = vec4(uC, clamp(f * uI, 0.0, 1.0)); }'
  ].join('\n');

  function makeBody(THREE, P) {
    var g = new THREE.Group();

    var tex = new THREE.CanvasTexture(makeTexture(P, 128));
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    var bump = new THREE.CanvasTexture(makeBump(P, 128));
    bump.wrapS = THREE.RepeatWrapping; bump.wrapT = THREE.ClampToEdgeWrapping;

    var mat = new THREE.MeshStandardMaterial({
      map: tex, bumpMap: bump, bumpScale: 0.035,
      roughness: (P.tex === 'ocean' ? 0.42 : 0.92),
      metalness: 0.0
    });
    var globe = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), mat);
    g.add(g.userData.globe = globe);

    // 구름 껍질 — 본체보다 빠르게 돌아 시차를 만든다
    var ct = new THREE.CanvasTexture(makeClouds(P, 128));
    ct.wrapS = THREE.RepeatWrapping;
    var clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.015, 40, 26),
      new THREE.MeshStandardMaterial({
        map: ct, transparent: true, opacity: 0.55,
        depthWrite: false, roughness: 1, metalness: 0
      }));
    g.add(g.userData.clouds = clouds);

    // Fresnel 대기 — 진짜 림 라이팅
    var atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.14, 40, 26),
      new THREE.ShaderMaterial({
        uniforms: {
          uC: { value: new THREE.Color(P.rim[0] / 255, P.rim[1] / 255, P.rim[2] / 255) },
          uP: { value: 3.1 }, uI: { value: 0.95 }
        },
        vertexShader: ATMO_VS, fragmentShader: ATMO_FS,
        side: THREE.BackSide, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false
      }));
    g.add(atmo);

    if (P.ring) {
      var rg = new THREE.RingGeometry(P.ring * 0.72, P.ring * 1.06, 96);
      var rc = document.createElement('canvas');
      rc.width = 128; rc.height = 8;
      var rx = rc.getContext('2d');
      var lg = rx.createLinearGradient(0, 0, 128, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.18, 'rgba(' + P.hi.join(',') + ',0.85)');
      lg.addColorStop(0.45, 'rgba(' + P.hi.join(',') + ',0.35)');
      lg.addColorStop(0.62, 'rgba(255,255,255,0.75)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      rx.fillStyle = lg; rx.fillRect(0, 0, 128, 8);
      var rt = new THREE.CanvasTexture(rc);
      var ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({
        map: rt, alphaMap: rt, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, depthWrite: false
      }));
      ring.rotation.x = Math.PI * 0.5 - 0.36;
      ring.rotation.z = -0.22;
      g.add(ring);
    }
    g.userData.P = P;
    return g;
  }

  function init3D() {
    if (!window.THREE || !webglOK()) return null;
    var cv3 = document.getElementById('journey3d');
    if (!cv3) return null;
    try {
      var THREE = window.THREE;
      var r = new THREE.WebGLRenderer({ canvas: cv3, alpha: true, antialias: true });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      var sc = new THREE.Scene();
      // 직교 카메라 = 픽셀 좌표를 그대로 쓸 수 있어 2D 레이어와 정확히 정렬된다
      var cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 6000);
      cam.position.set(0, 0, 2000);
      // 태양광 — 2D 레이어의 광원 방향(la=1.88)과 일치시킨다
      /* 2D FX 의 광원각 la=1.88(캔버스 y-down) 과 화면상 같은 방향으로.
         three 는 y-up 이므로 y 부호를 뒤집는다 → 화면 왼쪽-아래에서 비춘다. */
      var sun = new THREE.DirectionalLight(0xfff2e2, 2.6);
      sun.position.set(Math.cos(1.88) * 620, -Math.sin(1.88) * 620, 540);
      sc.add(sun);
      sc.add(new THREE.AmbientLight(0x5a4a9a, 0.55));
      // 반대편 보라 필라이트 — 밤면이 완전히 죽지 않게
      var rim = new THREE.DirectionalLight(0x9a7cff, 0.80);
      rim.position.set(-340, 300, -520);
      sc.add(rim);

      var bodies = {};
      for (var i = 0; i < PLANETS.length; i++) {
        var b = makeBody(THREE, PLANETS[i]); b.visible = false;
        sc.add(b); bodies['P' + i] = b;
      }
      for (var j = 0; j < SATS.length; j++) {
        var b2 = makeBody(THREE, SATS[j]); b2.visible = false;
        sc.add(b2); bodies['S' + j] = b2;
      }
      return { THREE: THREE, r: r, sc: sc, cam: cam, bodies: bodies };
    } catch (e) { return null; }
  }

  function resize3D() {
    if (!G3) return;
    G3.r.setSize(W, H, false);
    G3.cam.left = -W / 2; G3.cam.right = W / 2;
    G3.cam.top = H / 2; G3.cam.bottom = -H / 2;
    G3.cam.updateProjectionMatrix();
  }

  // 화면 픽셀 좌표 → 직교 카메라 좌표로 본체 배치
  function place3D(key, cx, cy, px, spin, alpha) {
    if (!G3) return false;
    var b = G3.bodies[key];
    if (!b) return false;
    b.visible = alpha > 0.02;
    if (!b.visible) return true;
    b.position.set(cx - W / 2, H / 2 - cy, 0);
    b.scale.setScalar(px);
    b.rotation.y = spin * 6.283;
    if (b.userData.clouds) b.userData.clouds.rotation.y = spin * 6.283 * 1.7;
    b.traverse(function (o) {
      if (o.material && o.material.transparent !== undefined) {
        if (o.material.uniforms && o.material.uniforms.uI) {
          o.material.uniforms.uI.value = 0.95 * alpha;
        } else if (o !== b.userData.globe) {
          o.material.opacity = (o === b.userData.clouds ? 0.55 : 0.85) * alpha;
        }
      }
      if (o === b.userData.globe && o.material) {
        o.material.transparent = alpha < 0.99;
        o.material.opacity = alpha;
      }
    });
    return true;
  }

  function hideRest3D(used) {
    if (!G3) return;
    for (var k in G3.bodies) {
      if (!used[k]) G3.bodies[k].visible = false;
    }
  }

  /* ---------- 구름 텍스처 (지형과 다른 속도로 흘러 시차를 만든다) ---------- */
  function makeClouds(P, px) {
    var key = 'cl_' + P.name + '_' + px;
    if (texCache[key]) return texCache[key];
    var tw = Math.max(32, Math.round(px * 4)), th = Math.max(16, Math.round(px * 2));
    var oc = document.createElement('canvas');
    oc.width = tw; oc.height = th;
    var o = oc.getContext('2d');
    function tri(fn) { fn(0); fn(-tw); fn(tw); }
    for (var i = 0; i < 16; i++) {
      var x = Math.random() * tw, y = th * (0.12 + Math.random() * 0.76);
      var r = th * (0.05 + Math.random() * 0.13);
      var a = 0.10 + Math.random() * 0.16;
      tri(function (dx) {
        var g = o.createRadialGradient(x + dx, y, 0, x + dx, y, r * 2.2);
        g.addColorStop(0, 'rgba(255,255,255,' + a + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        o.fillStyle = g;
        o.beginPath(); o.ellipse(x + dx, y, r * 2.2, r, 0, 0, 7); o.fill();
      });
    }
    texCache[key] = oc;
    return oc;
  }

  /* 블랙홀의 ell() 헬퍼와 동일 — 기울어진 면의 타원 호 */
  function ell(cx, cy, rx, ry, w, from, to) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, -0.22, from, to);
    ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
  }

  /* ---------- 행성 1개 렌더 ----------
     assets 블랙홀 캔버스(main.js initBlackhole)의 조형 어휘를 그대로 가져왔다:
       ① 성운 블룸 ② 다층 타원 광자링 ③ 회전 핫스팟 ④ 강착원반 띠
       ⑤ 납작한 면을 도는 강착 입자 ⑥ 펄스 호흡 (+ 가산 합성)
     다른 점은 가운데가 '검은 구멍'이 아니라 '행성 본체'라는 것뿐이다. */
  function drawPlanet(P, cx, cy, px, spin, alpha, lightAng) {
    if (px < 0.6 || alpha <= 0.01) return;
    // 3D 레이어가 본체를 맡으면 2D 는 '앞쪽 FX' 만 얹는다.
    // (2D 캔버스가 3D 위에 있어 뒤쪽 요소는 가려지지 않아 어색해진다)
    var body2d = !G3;
    var la = lightAng === undefined ? 1.88 : lightAng;
    var lx = Math.cos(la), ly = Math.sin(la);
    var pulse = 0.82 + Math.sin(t * 1.5 + (P._ph || (P._ph = Math.random() * 6))) * 0.14;
    var i, g;

    // 입자 지연 초기화 (반지름 단위로 저장해 리사이즈에 무관)
    if (!P._pt) {
      P._pt = [];
      // 입자 수는 반지름에 비례 — 작은 위성까지 30개씩 돌리면 낭비다
      var cap = tier === 'mobile' ? 8 : (tier === 'tablet' ? 14 : 22);
      var n = Math.max(5, Math.round(Math.min(cap, P.r * 210)));
      for (i = 0; i < n; i++) P._pt.push(newPart(P, false));
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    /* ① 성운 블룸 — 행성 고유색으로 */
    g = ctx.createRadialGradient(cx, cy, px * 0.2, cx, cy, px * 3.0);
    g.addColorStop(0, rgba(P.rim, 0.20 * pulse));
    g.addColorStop(0.42, 'rgba(80,48,168,0.09)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, px * 3.0, 0, 7); ctx.fill();

    ctx.globalCompositeOperation = 'lighter';

    if (body2d) {
    /* ② 다층 타원 광자링 (뒤쪽 절반 먼저 → 본체 뒤로 지나가게) */
    ctx.strokeStyle = rgba(P.rim, 0.17 * pulse);
    ell(cx, cy, px * 1.62, px * 0.52, px * 0.19, Math.PI, Math.PI * 2);
    ctx.strokeStyle = 'rgba(214,196,255,' + (0.26 * pulse) + ')';
    ell(cx, cy, px * 1.48, px * 0.45, px * 0.12, Math.PI, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.42 * pulse) + ')';
    ell(cx, cy, px * 1.40, px * 0.41, px * 0.042, Math.PI, Math.PI * 2);

    /* ③ 회전 핫스팟 (뒤쪽) */
    for (i = 0; i < 2; i++) {
      var ab = spin * 2.4 + i * Math.PI;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.40 * pulse) + ')';
      ell(cx, cy, px * 1.40, px * 0.41, px * 0.09, ab, ab + 0.55);
    }

    /* ⑤ 강착 입자 — 뒤쪽 절반 */
    drawParts(P, cx, cy, px, pulse, true);
    }
    ctx.globalCompositeOperation = 'source-over';
    // 3D 모드에서도 입자 물리는 굴려야 앞쪽 입자가 흐른다
    if (!body2d) stepParts(P);

    /* ---- 본체 — 3D 가 없을 때만 2D 로 그린다 ---- */
    if (body2d) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, px, 0, 7); ctx.clip();

    var dw = px * 2, dh = px * 2;
    // 지형
    var tex = makeTexture(P, Math.min(px, 130));
    var s1 = (((spin % 1) + 1) % 1) * dw;
    ctx.drawImage(tex, cx - px - s1, cy - px, dw, dh);
    ctx.drawImage(tex, cx - px - s1 + dw, cy - px, dw, dh);
    // 구름 — 1.7배 빠르게 흘러 시차가 생긴다
    var cl = makeClouds(P, Math.min(px, 130));
    var s2 = ((((spin * 1.7) % 1) + 1) % 1) * dw;
    ctx.globalAlpha = alpha * 0.85;
    ctx.drawImage(cl, cx - px - s2, cy - px, dw, dh);
    ctx.drawImage(cl, cx - px - s2 + dw, cy - px, dw, dh);
    ctx.globalAlpha = alpha;

    // 극관 (위아래 살짝 밝게) — 구형감을 강화
    var pc = ctx.createLinearGradient(0, cy - px, 0, cy + px);
    pc.addColorStop(0, rgba(P.hi, 0.20));
    pc.addColorStop(0.22, 'rgba(255,255,255,0)');
    pc.addColorStop(0.78, 'rgba(255,255,255,0)');
    pc.addColorStop(1, rgba(P.hi, 0.14));
    ctx.fillStyle = pc; ctx.fillRect(cx - px, cy - px, dw, dh);

    // 낮면 하이라이트
    g = ctx.createRadialGradient(cx + lx * px * 0.42, cy + ly * px * 0.42, px * 0.05,
      cx, cy, px * 1.15);
    g.addColorStop(0, rgba(P.hi, 0.54));
    g.addColorStop(0.55, rgba(P.hi, 0.12));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - px, cy - px, dw, dh);

    // 스페큘러
    if (P.tex === 'ocean' || P.tex === 'swirl') {
      var sx2 = cx + lx * px * 0.46, sy2 = cy + ly * px * 0.46;
      g = ctx.createRadialGradient(sx2, sy2, 0, sx2, sy2, px * 0.32);
      g.addColorStop(0, 'rgba(255,255,255,0.26)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx2, sy2, px * 0.32, 0, 7); ctx.fill();
    }

    // 주변부 감광
    g = ctx.createRadialGradient(cx, cy, px * 0.50, cx, cy, px);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.36)');
    ctx.fillStyle = g; ctx.fillRect(cx - px, cy - px, dw, dh);

    // 밤면
    g = ctx.createRadialGradient(cx - lx * px * 0.72, cy - ly * px * 0.72, px * 0.10,
      cx - lx * px * 0.30, cy - ly * px * 0.30, px * 1.55);
    g.addColorStop(0, 'rgba(2,1,10,0.84)');
    g.addColorStop(0.55, 'rgba(2,1,10,0.42)');
    g.addColorStop(1, 'rgba(2,1,10,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - px, cy - px, dw, dh);
    ctx.restore();   // unclip
    }

    /* ---- 본체 위: 앞쪽 링 / 입자 / 림 ---- */
    ctx.globalCompositeOperation = 'lighter';

    /* ④ 강착원반 띠 — 본체 아래쪽을 가로지르는 밝은 수평 띠 */
    var barY = cy + px * 0.96;
    var bar = ctx.createLinearGradient(cx - px * 1.5, barY, cx + px * 1.5, barY);
    bar.addColorStop(0, 'rgba(160,140,255,0)');
    bar.addColorStop(0.5, 'rgba(232,222,255,' + (0.30 * pulse) + ')');
    bar.addColorStop(1, 'rgba(160,140,255,0)');
    ctx.fillStyle = bar;
    ctx.beginPath(); ctx.ellipse(cx, barY, px * 1.42, px * 0.10, -0.22, 0, 7); ctx.fill();

    // ② 앞쪽 절반 링
    ctx.strokeStyle = rgba(P.rim, 0.19 * pulse);
    ell(cx, cy, px * 1.62, px * 0.52, px * 0.19, 0, Math.PI);
    ctx.strokeStyle = 'rgba(222,206,255,' + (0.30 * pulse) + ')';
    ell(cx, cy, px * 1.48, px * 0.45, px * 0.12, 0, Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.50 * pulse) + ')';
    ell(cx, cy, px * 1.40, px * 0.41, px * 0.042, 0, Math.PI);

    // ③ 앞쪽 핫스팟
    for (i = 0; i < 2; i++) {
      var af = spin * 2.4 + i * Math.PI;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.52 * pulse) + ')';
      ell(cx, cy, px * 1.40, px * 0.41, px * 0.10, af, af + 0.55);
    }

    // ⑤ 앞쪽 입자
    drawParts(P, cx, cy, px, pulse, false);

    // 림 라이팅 — 3D 에서는 Fresnel 대기가 담당하므로 2D 는 생략
    if (body2d) {
    ctx.beginPath();
    ctx.arc(cx, cy, px * 1.0, la - 1.20, la + 1.20);
    ctx.strokeStyle = rgba(P.rim, 0.85 * pulse);
    ctx.lineWidth = Math.max(0.8, px * 0.05); ctx.lineCap = 'round';
    ctx.stroke();
    // 핫 코어 — 림에서 가장 밝은 점
    var hx = cx + lx * px * 1.02, hy = cy + ly * px * 1.02;
    g = ctx.createRadialGradient(hx, hy, 0, hx, hy, px * 0.70);
    g.addColorStop(0, 'rgba(255,255,255,' + (0.62 * pulse) + ')');
    g.addColorStop(0.2, 'rgba(238,226,255,' + (0.24 * pulse) + ')');
    g.addColorStop(1, 'rgba(180,140,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(hx, hy, px * 0.70, 0, 7); ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';

    // 달
    if (P.moon) {
      var ma = spin * 2.1;
      var mx = cx + Math.cos(ma) * px * 1.95, my = cy + Math.sin(ma) * px * 0.62;
      ctx.beginPath(); ctx.arc(mx, my, Math.max(1, px * 0.14), 0, 7);
      ctx.fillStyle = rgba(P.hi, 0.9); ctx.fill();
    }
    ctx.restore();
  }

  /* 강착 입자 — 블랙홀 §5 와 같은 규칙 (납작한 면, 안쪽으로 빨려들다 재생성) */
  function newPart(P, atOuter) {
    return {
      ang: Math.random() * Math.PI * 2,
      rad: atOuter ? (2.05 + Math.random() * 0.75) : (1.20 + Math.random() * 1.60),
      spd: 0.010 + Math.random() * 0.017,
      pull: 0.0016 + Math.random() * 0.0060,
      warm: Math.random() < 0.45,
      a: Math.random() * 0.5 + 0.35,
      sz: Math.random() * 1.4 + 0.5
    };
  }
  function stepParts(P) {
    if (!P._pt) return;
    var mo = reduce ? 0.34 : 1;
    for (var i = 0; i < P._pt.length; i++) {
      var q = P._pt[i];
      q.ang += q.spd * mo; q.rad -= q.pull * mo;
      if (q.rad < 1.12) P._pt[i] = newPart(P, true);
    }
  }
  function drawParts(P, cx, cy, px, pulse, back) {
    var mo = reduce ? 0.34 : 1;
    for (var i = 0; i < P._pt.length; i++) {
      var q = P._pt[i];
      if (back) {                       // 갱신은 뒤쪽 패스에서 한 번만
        q.ang += q.spd * mo;
        q.rad -= q.pull * mo;
        if (q.rad < 1.12) { P._pt[i] = newPart(P, true); continue; }
      }
      var isBack = Math.sin(q.ang) < 0;
      if (isBack !== back) continue;
      var ex = Math.cos(q.ang) * px * q.rad;
      var ey = Math.sin(q.ang) * px * q.rad * 0.30;
      var ca = Math.cos(-0.22), sa = Math.sin(-0.22);
      var x = cx + ex * ca - ey * sa, y = cy + ex * sa + ey * ca;
      var dim = back ? 0.45 : 1;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.4, q.sz * px * 0.030), 0, 7);
      ctx.fillStyle = q.warm
        ? 'rgba(226,206,255,' + (q.a * pulse * dim) + ')'
        : 'rgba(190,214,255,' + (q.a * pulse * dim) + ')';
      ctx.fill();
    }
  }

  /* ---------- 은하 ---------- */
  function drawGalaxy(alpha, rot, push) {
    if (alpha <= 0.01) return;
    // .page 자체의 어두운 비네트(radial-gradient, 가장자리로 갈수록 80% 암전)와
    // 기존 .page::before 장식용 블러 원(700px, blur 180px)이 정확히 우상단
    // 코너에 겹쳐 있어, 원래 위치(83%,13%)는 실제로는 거의 안 보였다.
    // 비네트 중심(50%,42%)에 조금 더 가까우면서도 본문 텍스트(좌측)는
    // 여전히 피하는 지점으로 이동.
    var cx = W * 0.76, cy = H * 0.24;
    var i, d, x, y, g;

    /* --- PASS 1: 암흑 성간 먼지대 (source-over, 어둡게) ---
       뒤쪽 실제 별밭을 '가려서' 앞뒤 관계를 만든다. 은하가 평면이 아니라
       입체로 읽히게 하는 핵심 요소. 알파는 낮게 유지해 배경을 덮지 않는다. */
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    for (i = 0; i < 7; i++) {
      var lf = i / 7;
      var lr = MIN * (0.20 + lf * 0.72);
      var la2 = rot * 0.6 + lf * 2.4 + 0.55;      // 나선 팔 사이에 끼워 넣는다
      var lx = cx + Math.cos(la2) * lr * (0.9 + push * 0.3);
      var ly = cy + Math.sin(la2) * lr * 0.42 * (0.9 + push * 0.3);
      var ls = MIN * (0.10 + lf * 0.17);
      // (translate 이후 로컬 좌표계에서 fill 되므로 그라디언트도 로컬 기준으로 —
      //  world 좌표로 만들면 translate가 한 번 더 적용돼 중심이 화면 밖으로 밀려난다)
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, ls);
      g.addColorStop(0, 'rgba(5,3,16,0.42)');
      g.addColorStop(0.55, 'rgba(5,3,16,0.20)');
      g.addColorStop(1, 'rgba(5,3,16,0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(lx, ly); ctx.rotate(la2 + 1.2); ctx.scale(1, 0.34);
      ctx.beginPath(); ctx.arc(0, 0, ls, 0, 7); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    /* --- PASS 2: 발광 요소 --- */
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';

    /* 나선팔 자체를 "이어진 발광 띠"로 그린다 — 지금까지는 흩어진 별점과
       코어를 감싼 광자링만 있어서 "은하"가 아니라 "링 하나"로 읽혔다.
       arms 배열(build())과 동일한 로그 나선 공식을 따라가며 겹치는 부드러운
       그라디언트 블롭을 이어붙이면, 코어에서 뻗어나가는 팔 구조가 실제로
       눈에 보인다. 색은 코어 쪽 따뜻한 톤 → 중간 보라 → 바깥 청록으로
       점진 변화시켜 깊이·색상 다양성을 동시에 준다. */
    var armCount = 3;
    var armSteps = 50;   // 바깥쪽은 반지름이 커져 각 스텝 사이 호 길이가 늘어나므로,
                          // 블롭이 서로 겹치도록 충분히 촘촘하게(16 -> 50) 늘렸다.
                          // (16단계였을 때는 바깥 2/3 구간에서 블롭 사이 간격이 블롭
                          //  지름보다 커서 이어진 띠가 아니라 흩어진 점으로 보였다)
    for (var ai = 0; ai < armCount; ai++) {
      var abase = (ai / armCount) * Math.PI * 2;
      for (var si2 = 0; si2 <= armSteps; si2++) {
        var f2 = si2 / armSteps;
        var rad2 = Math.pow(f2, 0.62) * MIN * 0.90;
        var th2 = abase + f2 * 2.5 + rot * (0.5 + f2 * 0.4);
        var zz = 0.55 + push * 0.30;
        var bx = cx + Math.cos(th2) * rad2 * zz;
        var by = cy + Math.sin(th2) * rad2 * zz * 0.42;
        var bw = MIN * (0.050 - f2 * 0.020);          // 코어 쪽이 두껍고 바깥은 가늘게(최소폭 유지)
        var bcol = f2 < 0.22
          ? [255, 244, 224]                             // 코어 인접: 따뜻한 톤
          : (f2 < 0.55
            ? [ (168 - (f2-0.18)*60), (128 + (f2-0.18)*80), (240) ]  // 중간: 보라->인디고
            : [ (96 - (f2-0.55)*40), (150 + (f2-0.55)*130), (230 + (f2-0.55)*25) ]); // 바깥: 청록
        var bal = (0.40 - f2 * 0.16) * (0.75 + 0.25 * Math.sin(t * 0.4 + ai * 2 + f2 * 6));
        if (bal < 0.012) continue;
        g = ctx.createRadialGradient(0, 0, 0, 0, 0, bw);   // translate 이후 로컬 좌표로 fill 되므로 로컬 기준
        g.addColorStop(0, rgba(bcol, bal));
        g.addColorStop(0.6, rgba(bcol, bal * 0.45));
        g.addColorStop(1, rgba(bcol, 0));
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(bx, by); ctx.rotate(th2 + 1.1); ctx.scale(1, 0.42);
        ctx.beginPath(); ctx.arc(0, 0, bw, 0, 7); ctx.fill();
        ctx.restore();
      }
    }

    // 성운 먼지 (보라·남색·청록, 절제)
    for (i = 0; i < dust.length; i++) {
      d = dust[i];
      var dz = 0.55 + d.z * 0.75 + push * 0.30;
      var da = d.a + rot * (0.35 + d.z * 0.5);
      x = cx + Math.cos(da) * d.r * dz;
      y = cy + Math.sin(da) * d.r * dz * 0.42;
      var col = d.h < 0.42 ? [104, 66, 190] : (d.h < 0.74 ? [48, 62, 168] : [34, 132, 176]);
      g = ctx.createRadialGradient(x, y, 0, x, y, d.s * dz);
      g.addColorStop(0, rgba(col, 0.30));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, d.s * dz, 0, 7); ctx.fill();
    }

    // 나선 팔의 별 (깊이별 크기·밝기)
    for (i = 0; i < arms.length; i++) {
      var p = arms[i];
      var z = 0.55 + p.z * 0.8 + push * 0.35;
      var aa = p.a + rot * (0.5 + p.z * 0.7);
      x = cx + Math.cos(aa) * p.r * z;
      y = cy + Math.sin(aa) * p.r * z * 0.42;
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
      var s = p.s * (0.55 + p.z * 1.15);
      var al = (0.34 + p.z * 0.72) * (0.68 + 0.32 * Math.sin(t * 0.6 + p.c * 9));
      // 깊이 색 분리: 뒤쪽은 차갑고 어둡게, 앞쪽은 따뜻하고 밝게
      var far = p.z < 0.34;
      ctx.fillStyle = far ? 'rgba(122,148,206,' + (al * 0.62) + ')'
        : (p.c < 0.70 ? 'rgba(236,232,255,' + al + ')'
          : (p.c < 0.9 ? 'rgba(176,204,255,' + al + ')' : 'rgba(158,238,248,' + al + ')'));
      ctx.beginPath(); ctx.arc(x, y, s * 0.6, 0, 7); ctx.fill();
      // 전경의 밝은 별에만 헤일로 → 앞뒤 거리감이 생긴다 (블러 필터 없이 그라디언트로)
      if (p.z > 0.88 && s > 1.2) {
        var hr = s * 5.5;
        g = ctx.createRadialGradient(x, y, 0, x, y, hr);
        g.addColorStop(0, 'rgba(214,222,255,' + (al * 0.42) + ')');
        g.addColorStop(0.4, 'rgba(180,196,255,' + (al * 0.12) + ')');
        g.addColorStop(1, 'rgba(160,180,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, hr, 0, 7); ctx.fill();
      }
    }

    /* 은하핵: 넓은 헤일로 + 밝은 벌지 (2단 구성이라야 부피감이 산다)
       ※ 그라디언트를 world 좌표(cx,cy)로 만든 뒤 translate(cx,cy)까지 하면
       중심이 (2cx,2cy)로 다시 밀려나 캔버스 밖으로 사라진다 — 은하 코어가
       안 보이던 진짜 원인. 로컬(0,0) 기준으로 만들어야 한다. */
    var halo = ctx.createRadialGradient(0, 0, 0, 0, 0, MIN * 0.62);
    halo.addColorStop(0, 'rgba(168,128,240,0.34)');
    halo.addColorStop(0.40, 'rgba(110,80,205,0.17)');
    halo.addColorStop(1, 'rgba(50,34,130,0)');
    ctx.fillStyle = halo;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.28); ctx.scale(1, 0.46);
    ctx.beginPath(); ctx.arc(0, 0, MIN * 0.62, 0, 7); ctx.fill(); ctx.restore();

    var core = ctx.createRadialGradient(0, 0, 0, 0, 0, MIN * 0.33);
    core.addColorStop(0, 'rgba(255,253,248,1)');
    core.addColorStop(0.08, 'rgba(255,240,218,0.82)');
    core.addColorStop(0.22, 'rgba(232,202,255,0.48)');
    core.addColorStop(0.52, 'rgba(138,92,220,0.20)');
    core.addColorStop(1, 'rgba(60,40,140,0)');
    ctx.fillStyle = core;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.28); ctx.scale(1, 0.55);
    ctx.beginPath(); ctx.arc(0, 0, MIN * 0.33, 0, 7); ctx.fill(); ctx.restore();

    /* 코어 주변 광자링은 "은하 하나 전체가 링으로 보인다"는 문제의 원인이었다
       (반지름이 코어 벌지와 비슷해 서로 뭉쳐 보임) — 은하의 정체성은 이제
       위의 나선팔 대역이 담당하므로, 여기서는 아주 얇은 링 하나만 남겨
       "핵 주위 강착" 뉘앙스만 은은하게 준다. 회전 핫스팟도 1개로 축소. */
    var gp = 0.82 + Math.sin(t * 1.5) * 0.14;
    var GR = MIN * 0.25;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.30 * gp) + ')';
    ell(cx, cy, GR * 1.30, GR * 0.37, GR * 0.028, 0, Math.PI * 2);
    var ha = rot * 9;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.36 * gp) + ')';
    ell(cx, cy, GR * 1.30, GR * 0.37, GR * 0.06, ha, ha + 0.5);
    if (!gparts) {
      gparts = [];
      var gn = tier === 'mobile' ? 14 : (tier === 'tablet' ? 24 : 38);
      for (var gi = 0; gi < gn; gi++) gparts.push(newGPart(true));
    }
    var gmo = reduce ? 0.34 : 1;
    for (var k2 = 0; k2 < gparts.length; k2++) {
      var q2 = gparts[k2];
      q2.ang += q2.spd * gmo;
      q2.rad -= q2.pull * gmo;
      if (q2.rad < 1.20) { gparts[k2] = newGPart(false); continue; }
      var gex = Math.cos(q2.ang) * GR * q2.rad;
      var gey = Math.sin(q2.ang) * GR * q2.rad * 0.29;
      var gca = Math.cos(-0.28), gsa = Math.sin(-0.28);
      var gx2 = cx + gex * gca - gey * gsa, gy2 = cy + gex * gsa + gey * gca;
      ctx.beginPath();
      ctx.arc(gx2, gy2, Math.max(0.4, q2.sz * GR * 0.020), 0, 7);
      ctx.fillStyle = q2.warm
        ? 'rgba(240,222,255,' + (q2.a * gp) + ')'
        : 'rgba(184,210,255,' + (q2.a * gp) + ')';
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- 태양계 ---------- */
  function drawSolar(alpha, spin) {
    if (alpha <= 0.01) return;
    // 은하와 같은 이유로 코너의 어두운 비네트를 피해 재배치
    var cx = W * 0.76, cy = H * 0.23;
    var base = MIN * 0.105;
    ctx.save();
    ctx.globalAlpha = alpha;

    // 중심 광원 (정제된 한 점)
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 2.2);
    g.addColorStop(0, 'rgba(255,253,244,1)');
    g.addColorStop(0.14, 'rgba(255,230,196,0.78)');
    g.addColorStop(0.34, 'rgba(220,164,255,0.30)');
    g.addColorStop(1, 'rgba(140,90,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, base * 2.2, 0, 7); ctx.fill();

    // 궤도 4개 + 기술 노드
    for (var i = 0; i < NODES.length; i++) {
      var rx = base * (1.35 + i * 0.62), ry = rx * 0.34;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, -0.22, 0, 7);
      ctx.strokeStyle = 'rgba(178,166,232,' + (0.16 - i * 0.022) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();

      var sp = spin * (0.55 - i * 0.10) + i * 1.7;
      var px = Math.cos(sp), py = Math.sin(sp);
      // 타원 회전(-0.22rad) 적용
      var ex = px * rx, ey = py * ry;
      var ca = Math.cos(-0.22), sa = Math.sin(-0.22);
      var nx = cx + ex * ca - ey * sa, ny = cy + ex * sa + ey * ca;
      // 뒤쪽(위쪽)일수록 작고 흐리게 → 깊이
      var depth = 0.55 + 0.45 * (py * 0.5 + 0.5);
      var rr = MIN * 0.010 * depth * 1.5;
      ctx.beginPath(); ctx.arc(nx, ny, rr, 0, 7);
      ctx.fillStyle = 'rgba(214,206,255,' + (0.30 + depth * 0.55) + ')';
      ctx.fill();
      ctx.beginPath(); ctx.arc(nx, ny, rr * 2.4, 0, 7);
      ctx.strokeStyle = 'rgba(178,166,255,' + (0.10 + depth * 0.14) + ')';
      ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- 행성계 / 위성계 ---------- */
  var used3D = {};
  function drawSystem(list, alpha, spin, secondary) {
    if (alpha <= 0.01) return;
    var cx = W * 0.5;
    var cy = H * (secondary ? 1.02 : 0.99);   // 카드 행 아래 빈 띠
    var base = MIN * (secondary ? 0.115 : 0.14);
    ctx.save();
    ctx.globalAlpha = alpha;

    // 중심 광원 (약하게 유지 — 행성이 주인공)
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 1.1);
    g.addColorStop(0, 'rgba(255,248,236,0.55)');
    g.addColorStop(0.3, 'rgba(226,186,255,0.13)');
    g.addColorStop(1, 'rgba(120,80,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, base * 1.1, 0, 7); ctx.fill();

    for (var i = 0; i < list.length; i++) {
      var P = list[i];
      var rx = base * (1.6 + i * 0.55);
      var ry = rx * 0.30;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, -0.22, 0, 7);
      ctx.strokeStyle = 'rgba(178,166,232,' + (secondary ? 0.11 : 0.15) + ')';
      ctx.lineWidth = 1; ctx.stroke();

      // 선택/포커스 시 감속·정지
      var slow = (focusIdx === i) ? 0.25 : 1;
      if (selected === i && selT > 0.02) slow = 0;
      var ang = P._a === undefined ? (P._a = i * 1.9) : P._a;
      var mo = reduce ? 0.34 : 1;                            // 상시 공전(감속만)
      P._a = ang + P.orbit * 0.010 * slow * mo;
      P._s = (P._s === undefined ? Math.random() : P._s) + P.spin * 0.0016 * mo;

      var ex = Math.cos(P._a) * rx, ey = Math.sin(P._a) * ry;
      var ca = Math.cos(-0.22), sa = Math.sin(-0.22);
      var nx = cx + ex * ca - ey * sa, ny = cy + ex * sa + ey * ca;
      var depth = 0.78 + 0.22 * (Math.sin(P._a) * 0.5 + 0.5);
      var px = MIN * P.r * depth;

      // 선택된 대상은 포커스 지점으로 이동 + 카메라 접근
      if (selected === i && selT > 0.001) {
        var fx = W * 0.5;
        var fy = H * (tier === 'mobile' ? 0.86 : 0.94);
        var e = selT * selT * (3 - 2 * selT);       // smoothstep
        nx = lerp(nx, fx, e);
        ny = lerp(ny, fy, e);
        px = lerp(px, MIN * (tier === 'mobile' ? 0.18 : 0.26), e);
      }
      var a2 = (selected >= 0 && selected !== i) ? (1 - selT) * alpha : alpha;
      var pa = clamp01(a2 / (alpha || 1)) * (0.78 + depth * 0.22);
      // 본체는 3D 로, 블랙홀 어휘(블룸/링/입자)는 2D 로 그 위에
      var key = (secondary ? 'S' : 'P') + i;
      if (place3D(key, nx, ny, px, P._s, pa * alpha)) used3D[key] = 1;
      drawPlanet(P, nx, ny, px, P._s, pa);
    }
    ctx.restore();
  }

  /* ---------- 접근 & 착륙 (Phase A~D) ---------- */
  function drawApproach(k) {
    if (k <= 0.001 || selected < 0) return;
    var list = kind === 'contest' ? SATS : PLANETS;
    var P = list[selected]; if (!P) return;
    var e = k * k * (3 - 2 * k);

    ctx.save();
    // Phase C — 대기 진입: 배경 깊이 변화 (플래시 없이 은은하게)
    var atm = ctx.createLinearGradient(0, H * (0.34 - e * 0.10), 0, H);
    atm.addColorStop(0, 'rgba(0,0,0,0)');
    atm.addColorStop(1, rgba(P.rim, 0.10 * e));
    ctx.fillStyle = atm; ctx.fillRect(0, 0, W, H);

    // Phase B/D — 행성이 하단 뷰포트를 점유하며 곡률 지평선으로
    /* 지평선 '정점 y' 를 직접 제어한다.
       예전엔 cy = H*1.02 + R 이라 e=1 에서 정점이 뷰포트 아래로 내려가
       행성이 사실상 보이지 않았다. */
    var R = MIN * lerp(0.34, 2.15, e);
    var cx = W * 0.5;
    var topY = H * lerp(1.06, 0.55, e);   // 화면 밖 → 하단 45% 점유
    var cy = topY + R;

    /* 대기 림 = 블랙홀의 강착 아크를 지평선 스케일로 (히어로와 같은 어휘) */
    var rimW = Math.max(2, MIN * 0.010 * (0.5 + e));
    var hb = [
      [1.00, 0.9, [255, 255, 255], 0.80],
      [1.9,  2.0, [232, 216, 255], 0.44],
      [4.2,  4.6, [150, 108, 250], 0.22],
      [8.0,  9.0, [ 92,  72, 214], 0.10]
    ];
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (var b = 0; b < hb.length; b++) {
      ctx.beginPath();
      ctx.arc(cx, cy, R + rimW * hb[b][0], Math.PI * 1.03, Math.PI * 1.97);
      ctx.strokeStyle = 'rgba(' + hb[b][2][0] + ',' + hb[b][2][1] + ',' + hb[b][2][2] +
        ',' + (hb[b][3] * (0.45 + 0.55 * e)) + ')';
      ctx.lineWidth = rimW * hb[b][1]; ctx.lineCap = 'round';
      ctx.stroke();
    }
    // 지평선 정점의 핫스팟
    var hg = ctx.createRadialGradient(cx, cy - R, 0, cx, cy - R, MIN * 0.42);
    hg.addColorStop(0, 'rgba(255,252,246,' + (0.34 * e) + ')');
    hg.addColorStop(0.30, 'rgba(226,204,255,' + (0.14 * e) + ')');
    hg.addColorStop(1, 'rgba(150,110,255,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(cx, cy - R, MIN * 0.42, 0, 7); ctx.fill();
    // 행성 고유색 틴트
    ctx.beginPath();
    ctx.arc(cx, cy, R + rimW * 2.6, Math.PI * 1.05, Math.PI * 1.95);
    ctx.strokeStyle = rgba(P.rim, (0.20 + 0.30 * e));
    ctx.lineWidth = rimW * 3.0; ctx.stroke();
    ctx.restore();

    // 본체 + 표면
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
    ctx.fillStyle = rgba(P.body, 0.90);
    ctx.fillRect(0, cy - R, W, R * 2);

    // 표면 텍스처 (자전으로 흐름)
    var tex = makeTexture(P, 110);
    var off = ((P._s || 0) % 1 + 1) % 1;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(tex, -off * tex.width, 0, tex.width, tex.height,
      cx - R, cy - R, R * 2, R * 2);
    ctx.globalAlpha = 1;

    // 지형/구름 변주
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 5; i++) {
      var yy = cy - R + R * (0.06 + i * 0.055);
      var gg = ctx.createLinearGradient(0, yy, W, yy);
      gg.addColorStop(0, rgba(P.hi, 0));
      gg.addColorStop(0.5, rgba(P.hi, 0.06 + 0.05 * e));
      gg.addColorStop(1, rgba(P.hi, 0));
      ctx.fillStyle = gg;
      ctx.fillRect(0, yy, W, Math.max(1, R * 0.012));
    }
    // Phase D — 표면 도시광
    if (e > 0.55) {
      var lw = (e - 0.55) / 0.45;
      for (var j = 0; j < (tier === 'mobile' ? 18 : 46); j++) {
        var lx2 = (j * 97.3 % 100) / 100 * W;
        var ly2 = cy - R + R * (0.05 + ((j * 37.7 % 100) / 100) * 0.10);
        ctx.fillStyle = rgba(P.rim, 0.30 * lw);
        ctx.beginPath(); ctx.arc(lx2, ly2, 1.0, 0, 7); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // 낮/밤 경계
    var sh = ctx.createLinearGradient(0, cy - R, W * 0.9, cy - R + R * 0.5);
    sh.addColorStop(0, 'rgba(3,1,14,0.06)');
    sh.addColorStop(1, 'rgba(3,1,14,0.46)');
    ctx.fillStyle = sh; ctx.fillRect(0, cy - R, W, R * 2);
    ctx.restore();
    ctx.restore();
  }

  /* ---------- 메인 루프 ---------- */
  function frame() {
    raf = 0;
    if (!running) return;

    // 페이지 보간
    shown += (page - shown) * (reduce ? 1 : 0.075);
    if (Math.abs(shown - page) < 0.002) shown = page;

    // 선택 접근 보간
    var st = (selected >= 0) ? 1 : 0;
    selT += (st - selT) * (reduce ? 1 : 0.06);

    t += reduce ? 0.0055 : 0.016;   // 정지가 아니라 감속

    ctx.clearRect(0, 0, W, H);

    // Hero(0)에서는 아무것도 그리지 않는다 — 시각적 영향 0
    var vis = clamp01((shown - 0.12) / 0.6);
    if (vis > 0.004) {
      var pushIn = clamp01((shown - 1) / 4) * 0.34;        // 아주 느린 접근감
      var rot = t * 0.0075;                                 // 극히 느린 은하 회전(상시)

      var gAl = (w(1, 1.15) * 0.95 + w(2, 1.6) * 0.42 + w(5, 1.7) * 0.34 + w(6, 1.4) * 0.26);
      drawGalaxy(Math.min(0.95, gAl) * vis, rot, pushIn);

      drawSolar(w(2, 1.05) * 0.95 * vis, t * 0.09);
      used3D = {};
      drawSystem(PLANETS, w(3, 1.05) * vis, t, false);
      drawSystem(SATS, w(4, 1.05) * vis, t, true);
      drawApproach(selT * clamp01(w(3, 1.2) + w(4, 1.2)) * vis);
      hideRest3D(used3D);
    }

    if (G3) {
      if (vis <= 0.004) hideRest3D({});   // Hero 에서는 3D 도 완전히 비운다
      G3.r.render(G3.sc, G3.cam);
    }

    raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf && running) raf = requestAnimationFrame(frame); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  // 문서가 숨겨지면 장식 애니메이션 정지
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) start(); else stop();
  });

  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt); rt = setTimeout(measure, 160);
  });

  /* ---------- 선택 연동 (기존 카드/패널 재사용) ---------- */
  function setSel(k, i) {
    kind = k; selected = i;
    var host = document.getElementById('journeyCtl');
    if (host) host.setAttribute('data-active', i >= 0 ? '1' : '0');
    var lab = document.getElementById('journeyLabel');
    if (lab) {
      var list = k === 'contest' ? SATS : PLANETS;
      lab.textContent = i >= 0 && list[i]
        ? (k === 'contest' ? 'SATELLITE ' : 'PLANET ') + list[i].name
        : 'SYSTEM VIEW';
    }
    start();
  }
  window.__journeySelect = setSel;

  function wire(sel, k) {
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      (function (el, idx) {
        el.addEventListener('pointerenter', function () { focusIdx = idx; start(); });
        el.addEventListener('pointerleave', function () { if (focusIdx === idx) focusIdx = -1; });
        el.addEventListener('focusin', function () { focusIdx = idx; setSel(k, idx); });
        el.addEventListener('click', function () { setSel(k, idx); });
      })(els[i], i);
    }
  }
  wire('.projects .card-row .card-item', 'project');
  wire('.contest  .card-row .card-item', 'contest');

  // 섹션을 벗어나면 선택 해제
  new MutationObserver(function () {
    var p = parseInt(document.body.dataset.page || '0', 10);
    if (p !== 3 && p !== 4 && selected >= 0) setSel(kind, -1);
  }).observe(document.body, { attributes: true, attributeFilter: ['data-page'] });

  /* ---------- prev / next / back 컨트롤 ---------- */
  function step(d) {
    var p = parseInt(document.body.dataset.page || '0', 10);
    var k = p === 4 ? 'contest' : 'project';
    var n = (k === 'contest' ? SATS : PLANETS).length;
    var i = selected < 0 ? 0 : (selected + d + n) % n;
    setSel(k, i);
    var rows = document.querySelectorAll(
      (k === 'contest' ? '.contest' : '.projects') + ' .card-row .card-item');
    if (rows[i] && rows[i].scrollIntoView) {
      rows[i].scrollIntoView({ block: 'nearest', inline: 'center',
        behavior: reduce ? 'auto' : 'smooth' });
      var card = rows[i].querySelector('[data-panel]');
      if (card && card.focus) card.focus({ preventScroll: true });
    }
  }
  window.__journeyStep = step;
  window.__journeyBack = function () { setSel(kind, -1); };

  var ctl = document.getElementById('journeyCtl');
  if (ctl) {
    ctl.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-j]') : null;
      if (!b) return;
      var j = b.getAttribute('data-j');
      if (j === 'next') step(1);
      else if (j === 'prev') step(-1);
      else if (j === 'back') setSel(kind, -1);
    });
  }

  document.addEventListener('keydown', function (e) {
    var p = parseInt(document.body.dataset.page || '0', 10);
    if (p !== 3 && p !== 4) return;
    if (document.getElementById('panel')
      && document.getElementById('panel').classList.contains('open')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Escape' && selected >= 0) { e.preventDefault(); setSel(kind, -1); }
  });

  measure();
  start();
})();
