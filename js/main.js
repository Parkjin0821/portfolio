/* ============ 박진 Portfolio — interactions ============ */

/* ---------- 0. 로더 해제 (최우선 등록) ----------
   반드시 이 파일 최상단에 있어야 한다. 아래쪽 초기화 코드가 예외를 던지면
   그 지점에서 스크립트 실행이 통째로 중단되므로, 로더 해제를 뒤쪽에 두면
   로딩 화면이 영구히 남아 사이트 전체를 못 쓰게 된다.
   (실제로 WebGL 미지원 환경에서 이 문제가 발생했음) */
var dismissLoader = (function(){
  var loader = document.getElementById('loader');
  var done = false;
  function hide(){
    if(done) return;
    done = true;
    if(!loader) return;
    setTimeout(function(){
      loader.classList.add('done');
      setTimeout(function(){
        if(loader.parentNode) loader.parentNode.removeChild(loader);
      }, 800);
    }, 450);
  }
  window.addEventListener('load', hide);          // 정상 경로
  setTimeout(hide, 2600);                          // 리소스가 느릴 때
  setTimeout(hide, 8000);                          // 하드 페일세이프: 무슨 일이 있어도 해제
  window.addEventListener('error', hide);          // 초기화 중 예외가 나도 해제
  window.addEventListener('unhandledrejection', hide);
  return hide;
})();

/* ---------- 1. 풀페이지 섹션 내비게이션 ----------
   #fullpage 는 1584 x 5495px(약 8.7메가픽셀) 짜리 거대 엘리먼트다.
   여기에 will-change:transform 을 걸고 그 transform 을 CSS 트랜지션으로
   보간하면, DPR 2 환경에서 ~139MB 짜리 합성 레이어가 되어 크롬이 GPU
   합성을 포기하고 메인 스레드 래스터로 폴백 — transform 보간이 수 초간
   멈춘다(실측·재현·수정 완료된 버그). #fullpage 자체는 절대 애니메이션하지
   않는다: 위치는 클릭과 같은 프레임에 즉시 확정한다(변하지 않음).

   그 대신 "두 장의 개별 페이지(각 100vh, 합성 비용 작음)"만 움직여
   진짜 슬라이드처럼 보이게 한다 — 필름스트립 트릭:
     #fullpage 가 이미 목적지로 순간 이동한 직후, 나가는 페이지(A)와
     들어오는 페이지(B) 둘 다에게 동일한 상대 오프셋
     translateY(screenDelta)을 주면(A는 원래 자리로, B는 한 화면 아래로
     보정되어) 화면은 전환 "직전"과 똑같이 보인다. 그 오프셋을 0으로
     트랜지션시키면 A/B가 마치 하나의 필름스트립처럼 함께 미끄러지며
     A는 위로 빠져나가고 B는 위로 들어온다 — #fullpage 자체는 한 번도
     움직이지 않았는데 시각적으로는 슬라이드처럼 보인다.
     역방향(이전 섹션)은 부호가 자동으로 반대가 되어 대칭적으로 동작한다.

   원래(합성 레이어 버그 수정 이전) 값 그대로 사용: .7s, cubic-bezier(.22,.8,.24,1). */
const fullpage = document.getElementById('fullpage');
const pages = [...document.querySelectorAll('.page')];
const dots = [...document.querySelectorAll('.dot')];
const menuLinks = [...document.querySelectorAll('.menu a')];
const prefersReducedMotion = window.matchMedia
  && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

const SLIDE_MS = 700;          // 원래 트랜지션과 동일한 지속시간
const SLIDE_EASE = 'cubic-bezier(.22,.8,.24,1)';   // 원래 이징 그대로
let current = 0;
let navTimer = null;           // 내비게이션과 관련된 유일한 타이머
let transitioning = false;
let slidingPages = [];         // 현재 슬라이드 애니메이션 중인 .page 두 장
let slideRAF = null;           // 예약된 rAF 핸들 — 반드시 취소 가능해야 한다

function resetPage(p) {
  p.style.transition = '';
  p.style.transform = '';
}

function endTransition() {
  transitioning = false;
  navTimer = null;
  slidingPages.forEach(resetPage);
  slidingPages = [];
}

/* 유일한 권위 있는 내비게이션 함수.
   force=true  → 메뉴/닷/CTA 직접 클릭: 진행 중이어도 취소하고 곧장 목적지로
   force=false → 휠/키보드/터치: 전환이 끝날 때까지 무시(연속 입력 폭주 방지) */
function goTo(idx, force) {
  idx = Math.max(0, Math.min(pages.length - 1, idx));
  if (transitioning && !force) return;
  if (idx === current && pages[current].classList.contains('active')) return;

  // 새 내비게이션 전에 이전 타이머·예약된 rAF·진행 중이던 슬라이드를 반드시 정리.
  // rAF를 취소하지 않으면, 빠른 연속 클릭 중 "역할이 이미 바뀐" 페이지에
  // 예전 콜백이 뒤늦게 발동해 transform을 다시 남기는 버그가 생긴다
  // (버스트 클릭 테스트로 실제 재현·확인함).
  if (navTimer) { clearTimeout(navTimer); navTimer = null; }
  if (slideRAF) { cancelAnimationFrame(slideRAF); slideRAF = null; }
  slidingPages.forEach(resetPage);
  slidingPages = [];

  const outgoingIdx = current;
  current = idx;

  /* ---- 상태 커밋: 전부 같은 프레임에 확정된다 (#fullpage 는 절대 애니메이션 안 함) ---- */
  fullpage.style.transform = `translateY(-${idx * 100}vh)`;
  document.body.dataset.page = idx;
  pages.forEach((p, i) => p.classList.toggle('active', i === idx));
  dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  menuLinks.forEach((m, i) => m.classList.toggle('active', i === idx));
  const _hb = document.getElementById('homeBtn');
  if (_hb) _hb.classList.toggle('visible', idx !== 0);
  if (idx === 1) runCounters();

  /* ---- 필름스트립 슬라이드: 나가는/들어오는 페이지 두 장만 애니메이션 ---- */
  if (!prefersReducedMotion && outgoingIdx !== idx) {
    const pageOut = pages[outgoingIdx];
    const pageIn = pages[idx];
    const screenDelta = (idx - outgoingIdx) * innerHeight;   // px, 부호 = 방향

    [pageOut, pageIn].forEach((p) => {
      p.style.transition = 'none';
      p.style.transform = `translateY(${screenDelta}px)`;
    });
    void pageIn.offsetHeight;   // 리플로우를 강제해 시작 transform을 확정시킨 뒤

    slideRAF = requestAnimationFrame(() => {
      slideRAF = null;
      [pageOut, pageIn].forEach((p) => {
        p.style.transition = `transform ${SLIDE_MS}ms ${SLIDE_EASE}`;
        p.style.transform = 'translateY(0)';
      });
    });
    slidingPages = [pageOut, pageIn];
  }

  transitioning = true;
  navTimer = setTimeout(endTransition, prefersReducedMotion ? 0 : SLIDE_MS + 60);
}

window.addEventListener('wheel', (e) => {
  if (panelOpen) return;               // 패널 열려있으면 패널 스크롤 우선
  if (transitioning) return;           // 전환 중 휠 입력은 무시
  if (Math.abs(e.deltaY) < 20) return;
  goTo(current + (e.deltaY > 0 ? 1 : -1));
}, { passive: true });

window.addEventListener('keydown', (e) => {
  if (panelOpen) { if (e.key === 'Escape') closePanel(); return; }
  if (e.key === 'ArrowDown' || e.key === 'PageDown') goTo(current + 1);
  if (e.key === 'ArrowUp' || e.key === 'PageUp') goTo(current - 1);
});

/* 터치 지원 */
let touchY = null;
window.addEventListener('touchstart', (e) => (touchY = e.touches[0].clientY), { passive: true });
window.addEventListener('touchend', (e) => {
  if (panelOpen || touchY === null) return;
  const dy = touchY - e.changedTouches[0].clientY;
  if (Math.abs(dy) > 60) goTo(current + (dy > 0 ? 1 : -1));
  touchY = null;
}, { passive: true });

// 메뉴 / 닷 / CTA 등 직접 이동은 언제나 즉시 반응해야 하므로 force
document.querySelectorAll('[data-goto]').forEach((el) =>
  el.addEventListener('click', () => goTo(+el.dataset.goto, true))
);
pages[0].classList.add('active');
document.body.dataset.page = 0;
if (menuLinks[0]) menuLinks[0].classList.add('active');
if (dots[0]) dots[0].classList.add('active');

/* ---------- 2. 표지 스크램블 내비 ---------- */
const heroTitle = document.getElementById('heroTitle');
const heroSub = document.getElementById('heroSub');
const heroCards = document.getElementById('heroCards');
const HOME_TITLE = '기획 × 백엔드';
const HOME_SUB = heroSub ? heroSub.textContent : '';
const SCR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/-_';
function scramble(el, finalText, speed, steps) {
  if (!el || finalText == null) return;
  speed = speed || 26; steps = steps || 16;
  clearInterval(el._si);
  const text = String(finalText); let step = 0;
  el._si = setInterval(() => {
    step++; const prog = step / steps;
    el.textContent = text.split('').map((ch, i) =>
      ch === ' ' ? ' ' : (i / text.length < prog ? ch : SCR[Math.floor(Math.random() * SCR.length)])
    ).join('');
    if (step >= steps) { clearInterval(el._si); el.textContent = text; }
  }, speed);
}
if (heroCards) {
  const hcards = [...heroCards.querySelectorAll('.hero-card')];
  hcards.forEach((card) => {
    card.addEventListener('mouseenter', () => {
      hcards.forEach((c) => c.classList.remove('is-active'));
      card.classList.add('is-active');
      scramble(heroTitle, card.dataset.title, 22, 14);
    });
  });
  heroCards.addEventListener('mouseleave', () => {
    hcards.forEach((c) => c.classList.remove('is-active'));
    scramble(heroTitle, HOME_TITLE, 24, 18);
  });
}

/* ---------- 3. 전역 별밭 (Three.js 포팅: StarBackground.tsx) ----------
   WebGL을 못 쓰는 환경(구형/가상 GPU, WebGL 차단, 컨텍스트 고갈)에서도
   사이트가 정상 동작해야 하므로, 렌더러를 만들기 "전에" 지원 여부를 검사하고
   전체를 try/catch로 감싼다. 실패하면 CSS 정적 우주 배경으로 대체한다. */
function hasWebGL(){
  try{
    if(!window.WebGLRenderingContext) return false;
    var probe = document.createElement('canvas');
    var gl = probe.getContext('webgl') || probe.getContext('experimental-webgl');
    if(!gl) return false;
    // 검사용 컨텍스트는 즉시 반납 (컨텍스트 슬롯 낭비 방지)
    var lose = gl.getExtension('WEBGL_lose_context');
    if(lose) lose.loseContext();
    return true;
  }catch(e){ return false; }
}

(function initStarfield(){
  var canvas = document.getElementById('starfield');
  var space  = document.getElementById('space');

  // WebGL 없이도 우주 배경을 유지하는 폴백
  function useStaticBackground(){
    if(space) space.classList.add('no-webgl');
    if(canvas) canvas.style.display = 'none';
  }

  // 사전 검사: WebGLRenderer를 아예 생성하지 않으므로 THREE가 콘솔 에러를 찍지 않는다
  if(!canvas || !window.THREE || !hasWebGL()){
    useStaticBackground();
    return;
  }

  var renderer = null;
  try{
    var THREE = window.THREE;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 1000);
    camera.position.z = 1;
    renderer = new THREE.WebGLRenderer({canvas:canvas, alpha:true, antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    var N = 3400, R = 1.3, positions = new Float32Array(N*3);
    for(var i=0;i<N;i++){
      var phi = Math.acos(2*Math.random() - 1);
      var theta = 2*Math.PI*Math.random();
      var r = R * Math.cbrt(Math.random());
      positions[i*3]   = r*Math.sin(phi)*Math.cos(theta);
      positions[i*3+1] = r*Math.sin(phi)*Math.sin(theta);
      positions[i*3+2] = r*Math.cos(phi);
    }
    /* 입체감의 재료 — (1) 크기 편차: 대부분 잔별, 극소수만 큼  (2) 별색 온도  (3) 별마다 다른 반짝임 위상·속도
       (4) 큰 별에만 회절 스파이크·헤일로 → "가까운 밝은 별 / 먼 잔별"의 원근이 생긴다. */
    var scaleArr = new Float32Array(N), glowArr = new Float32Array(N),
        colorArr = new Float32Array(N*3), phaseArr = new Float32Array(N), twArr = new Float32Array(N*2);
    // 항성 색온도 팔레트 [r,g,b,가중치]: 청백 · 백 · 미색 · 청 · 주황 — 실제 밤하늘처럼 백/청백이 대부분
    var PAL = [
      [0.80,0.88,1.00, 0.24], [1.00,0.98,0.95, 0.52], [1.00,0.93,0.80, 0.14],
      [0.66,0.78,1.00, 0.06], [1.00,0.80,0.58, 0.04]
    ];
    function pickColor(){
      var u = Math.random(), acc = 0;
      for(var k=0;k<PAL.length;k++){ acc += PAL[k][3]; if(u <= acc) return PAL[k]; }
      return PAL[1];
    }
    for(var si=0; si<N; si++){
      var rv = Math.random();
      if(rv > 0.95){                                   // 상위 5%: 확실히 큰 '가까운 별' 티어 — 스파이크·헤일로
        glowArr[si]  = 1;
        scaleArr[si] = 3.0 + (rv - 0.95)/0.05 * 1.6;   // 3.0 ~ 4.6  (거리 1.0에서 6.5~10px, 가까우면 상한까지)
      }else{                                           // 나머지 95%: 0 쪽에 몰린 잔별 — 원근의 '배경'
        glowArr[si]  = 0;
        scaleArr[si] = 0.30 + Math.pow(rv/0.95, 2.6) * 1.5;   // 0.30 ~ 1.80
      }
      var c = pickColor(), jit = 0.04;
      colorArr[si*3]   = Math.min(1, c[0] + (Math.random()-0.5)*jit);
      colorArr[si*3+1] = Math.min(1, c[1] + (Math.random()-0.5)*jit);
      colorArr[si*3+2] = Math.min(1, c[2] + (Math.random()-0.5)*jit);
      phaseArr[si] = Math.random()*Math.PI*2;
      twArr[si*2]   = 0.6 + Math.random()*2.0;        // 반짝임 속도
      twArr[si*2+1] = glowArr[si] ? 0.10 + Math.random()*0.10 : 0.18 + Math.random()*0.30; // 진폭: 잔별이 더 떤다
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scaleArr, 1));
    geo.setAttribute('aGlow',  new THREE.BufferAttribute(glowArr, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colorArr, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phaseArr, 1));
    geo.setAttribute('aTw',    new THREE.BufferAttribute(twArr, 2));

    /* PointsMaterial(map 없이)은 WebGL이 점을 정사각형 gl.POINTS 그대로 그린다.
       텍스처 스프라이트 대신 프래그먼트 셰이더에서 gl_PointCoord 로 원형을
       직접 마스킹한다 — 텍스처/밉맵 경계에 좌우되지 않는 진짜 벡터 원. */
    var starVert = [
      'attribute float aScale;',
      'attribute float aGlow;',
      'attribute vec3  aColor;',
      'attribute float aPhase;',
      'attribute vec2  aTw;',        // x: 반짝임 속도, y: 진폭
      'uniform float uSize;',        // 월드 단위 기준 크기
      'uniform float uPixelScale;',  // three.js가 sizeAttenuation에 쓰는 실제 상수: 0.5*캔버스 물리픽셀높이
      'uniform float uTime;',
      'uniform float uMinPx;',       // 이보다 작으면 1px 미만의 흐릿한 회색 얼룩이 된다 → 하한
      'uniform float uMaxPx;',       // 카메라를 스치는 별이 거대한 블롭이 되는 것 → 상한
      'varying float vGlow;',
      'varying float vBright;',
      'varying vec3  vColor;',
      'void main(){',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  gl_Position = projectionMatrix * mv;',
      '  float dist = max(-mv.z, 0.02);',
      '  float px = uSize * aScale * (uPixelScale / dist);',   // three.js 내부 sizeAttenuation과 동일한 공식
      '  gl_PointSize = clamp(px, uMinPx, uMaxPx);',
      '  float depth = clamp((dist - 0.2) / 1.8, 0.0, 1.0);',
      '  float fade = mix(1.0, 0.30, depth);',                  // 멀수록 어둡게 → 원근
      '  float tw = 1.0 - aTw.y * (0.5 + 0.5*sin(uTime*aTw.x + aPhase));',  // 별마다 다른 위상·속도의 반짝임
      '  vBright = fade * tw;',
      '  vGlow = aGlow;',
      '  vColor = aColor;',
      '}'
    ].join('\n');
    var starFrag = [
      'precision mediump float;',
      'uniform float uOpacity;',
      'varying float vGlow;',
      'varying float vBright;',
      'varying vec3  vColor;',
      'void main(){',
      '  vec2 uv = gl_PointCoord - vec2(0.5);',
      '  float d = length(uv) * 2.0;',                  // 0(중심) ~ 1(가장자리)
      '  if(d > 1.0) discard;',                          // 원 밖 완전 폐기 → 사각형 경계 없음
      '  float core = 1.0 - smoothstep(0.0, 0.40, d);',  // 또렷한 코어: 흐린 원판이 아니라 점광원
      '  float halo = pow(1.0 - smoothstep(0.0, 1.0, d), 1.5) * 0.75;',
      '  float ax = abs(uv.x), ay = abs(uv.y);',
      '  float spike = (pow(max(0.0, 1.0 - ax*2.0), 1.4) * max(0.0, 1.0 - ay*10.0)',   // 가로 스파이크
      '               + pow(max(0.0, 1.0 - ay*2.0), 1.4) * max(0.0, 1.0 - ax*10.0)) * 0.9;', // 세로 스파이크
      '  float shape = core + vGlow * (halo + spike);',  // 큰 별만 헤일로+회절 스파이크
      '  vec3 col = mix(vColor, vec3(1.0), core * 0.55);', // 중심은 백열, 가장자리로 갈수록 별 고유색
      '  gl_FragColor = vec4(col, shape * vBright * uOpacity);',  // 가산 블렌딩: rgb는 순색, 알파에 형태·밝기
      '}'
    ].join('\n');
    // 0.5 * 캔버스 물리픽셀 높이 — three.js PointsMaterial 이 sizeAttenuation 에 쓰는 것과 동일한 상수.
    function dprCap(){ return Math.min(devicePixelRatio, 2); }
    function pixelScale(){ return 0.5 * innerHeight * dprCap(); }
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uSize:{value:0.0040}, uPixelScale:{value:pixelScale()},
        uTime:{value:0}, uOpacity:{value:0.95},
        uMinPx:{value:1.8*dprCap()}, uMaxPx:{value:30*dprCap()}
      },
      vertexShader: starVert, fragmentShader: starFrag,
      transparent:true, depthWrite:false,
      blending: THREE.AdditiveBlending   // 검은 우주 위에서 별빛이 겹칠수록 밝아진다 — 뿌연 원판 대신 또렷한 광점
    });
    var points = new THREE.Points(geo, mat);
    var group = new THREE.Group();
    group.rotation.z = Math.PI/4;
    group.add(points);
    scene.add(group);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    var clock = new THREE.Clock();
    var running = true;

    window.addEventListener('resize', function(){
      if(!running) return;
      camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      mat.uniforms.uPixelScale.value = pixelScale();   // 별 크기 기준을 새 화면 크기에 맞춰 갱신
      mat.uniforms.uMinPx.value = 1.8*dprCap(); mat.uniforms.uMaxPx.value = 30*dprCap();
    });

    // 실행 중 GPU 컨텍스트를 잃어도 콘솔 에러 없이 정적 배경으로 내려앉는다
    canvas.addEventListener('webglcontextlost', function(e){
      e.preventDefault();
      running = false;
      useStaticBackground();
    }, false);
    canvas.addEventListener('webglcontextrestored', function(){
      try{
        if(space) space.classList.remove('no-webgl');
        canvas.style.display = '';
        running = true;
        loop();
      }catch(e){
        running = false;
        useStaticBackground();                          // 복구 실패해도 조용히 폴백
      }
    }, false);

    /* 별밭은 이 사이트의 정체성이라 어떤 설정에서도 멈추지 않는다.
       모션 최소화 환경에서는 '정지'가 아니라 '감속'으로 대응한다.
       (예전에 여기서 return 해버려서 별이 통째로 멈췄었다) */
    var sp = reduce ? 0.34 : 1;

    /* 마우스 시차: 카메라를 '회전'이 아니라 살짝 '이동'시킨다.
       회전은 모든 별을 같은 각도로 밀어 원근이 안 생기지만, 이동은 가까운 별을 크게·먼 별을 작게 밀어
       진짜 시차(parallax)가 생긴다. 카메라가 별구 안(z=1, R=1.3)에 있어 효과가 뚜렷하다. */
    var tgtX = 0, tgtY = 0, par = reduce ? 0.35 : 1;
    window.addEventListener('pointermove', function(e){
      tgtX =  (e.clientX/innerWidth  - 0.5) * 0.16 * par;
      tgtY = -(e.clientY/innerHeight - 0.5) * 0.11 * par;
    }, {passive:true});

    function loop(){
      if(!running) return;
      if(renderer.domElement.width === 0 && innerWidth){
        camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
      }
      var d = clock.getDelta();
      points.rotation.x -= d/7*sp; points.rotation.y -= d/10*sp;  // 항상 회전
      // ShaderMaterial 은 uniform 을 직접 갱신해야 한다(.opacity 프로퍼티는 이 커스텀 셰이더에 연결돼 있지 않음)
      mat.uniforms.uTime.value = clock.elapsedTime * sp;                 // 별마다 다른 위상의 반짝임(셰이더)
      camera.position.x += (tgtX - camera.position.x) * 0.045;          // 시차: 스프링처럼 따라온다
      camera.position.y += (tgtY - camera.position.y) * 0.045;
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    }
    loop();
  }catch(err){
    // 초기화 실패: 씬을 버리고 정적 배경으로. 사이트의 나머지는 그대로 동작한다.
    try{ if(renderer) renderer.dispose(); }catch(e){}
    useStaticBackground();
    if(window.console && console.info){
      console.info('[portfolio] WebGL 초기화 실패 — 정적 우주 배경으로 대체합니다.');
    }
  }
})();

/* ---------- 3b. 블랙홀: 인터스텔라 스타일 (상단 중앙, 캔버스) ----------
   2D 캔버스라 WebGL과 무관하지만, 여기서 예외가 나면 아래 초기화가 전부
   중단되므로 동일하게 try/catch로 격리한다. */
(function initBlackhole(){
 try{
  var canvas = document.getElementById('blackhole');
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  if(!ctx) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var W, H, cx, cy, Rh, parts = [], spin = 0, t = 0;
  function size(){
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(devicePixelRatio, 2);
    W = canvas.width = Math.max(1, rect.width * dpr);
    H = canvas.height = Math.max(1, rect.height * dpr);
    cx = W/2; cy = H*0.46; Rh = Math.min(W, H) * 0.19;   // 구멍 반지름
  }
  function spawn(atOuter){
    // 강착원반: 수평면(납작)을 도는 입자
    return {
      ang: Math.random()*Math.PI*2,
      rad: atOuter ? Rh*(2.0+Math.random()*0.9) : Rh*(1.2+Math.random()*1.7),
      spd: 0.012 + Math.random()*0.02,
      pull: 0.05 + Math.random()*0.22,
      hue: Math.random()<0.45 ? '196,181,253' : '190,220,255',
      a: Math.random()*0.5 + 0.3,
      sz: Math.random()*1.5 + 0.4
    };
  }
  size();
  for(var i=0;i<170;i++) parts.push(spawn(false));
  window.addEventListener('resize', size);

  function ell(rx, ry, w, from, to){   // (cx,cy) 기준 타원 호 stroke 헬퍼
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, from, to);
    ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
  }

  (function loop(){
    if(W<=1 || H<=1){ size(); }
    ctx.clearRect(0,0,W,H);
    t += 0.016;
    if(!reduce){ spin += 0.014; }
    var pulse = 0.82 + Math.sin(t*1.5)*0.14;

    /* 1) 보라 성운 블룸 */
    var bloom = ctx.createRadialGradient(cx, cy, Rh*0.2, cx, cy, Rh*3.2);
    bloom.addColorStop(0, 'rgba(120,70,200,'+(0.22*pulse).toFixed(3)+')');
    bloom.addColorStop(0.5, 'rgba(80,40,150,0.10)');
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0,0,W,H);

    ctx.globalCompositeOperation = 'lighter';

    /* 2) 광자 링 (구멍 감싸는 U자 고리) — 여러 겹 발광 */
    ctx.strokeStyle = 'rgba(150,120,255,'+(0.16*pulse).toFixed(3)+')';
    ell(Rh*1.18, Rh*1.12, Rh*0.30, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(200,180,255,'+(0.30*pulse).toFixed(3)+')';
    ell(Rh*1.12, Rh*1.06, Rh*0.13, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,'+(0.5*pulse).toFixed(3)+')';
    ell(Rh*1.08, Rh*1.03, Rh*0.045, 0, Math.PI*2);

    /* 3) 회전하는 핫스팟 (고리 위를 도는 밝은 점) */
    for(var k=0;k<2;k++){
      var a0 = spin + k*Math.PI;
      ctx.strokeStyle = 'rgba(255,255,255,'+(0.5*pulse).toFixed(3)+')';
      ell(Rh*1.08, Rh*1.03, Rh*0.10, a0, a0+0.6);
    }

    /* 4) 상단 강착원반 띠 (수평으로 넓게, 렌즈로 위로 휜 far-side) */
    var barY = cy - Rh*0.98;
    var bar = ctx.createLinearGradient(cx - Rh*2.2, barY, cx + Rh*2.2, barY);
    bar.addColorStop(0, 'rgba(160,140,255,0)');
    bar.addColorStop(0.5, 'rgba(230,220,255,'+(0.7*pulse).toFixed(3)+')');
    bar.addColorStop(1, 'rgba(160,140,255,0)');
    ctx.fillStyle = bar;
    ctx.beginPath();
    ctx.ellipse(cx, barY, Rh*2.1, Rh*0.16, 0, 0, Math.PI*2);
    ctx.fill();

    /* 5) 강착원반 입자 (납작한 수평면을 도는 빛) */
    for(var i=0;i<parts.length;i++){
      var p = parts[i];
      if(!reduce){ p.ang += p.spd; p.rad -= p.pull; }
      if(p.rad < Rh*1.05){ parts[i] = spawn(true); continue; }
      var x = cx + Math.cos(p.ang)*p.rad;
      var y = cy + Math.sin(p.ang)*p.rad*0.14;   // 거의 수평(edge-on)
      ctx.beginPath(); ctx.arc(x, y, p.sz, 0, 7);
      ctx.fillStyle = 'rgba('+p.hue+','+(p.a).toFixed(3)+')';
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';

    /* 6) 검은 구멍 (가운데) */
    var hole = ctx.createRadialGradient(cx, cy, Rh*0.2, cx, cy, Rh*1.02);
    hole.addColorStop(0, 'rgba(0,0,0,1)');
    hole.addColorStop(0.82, 'rgba(0,0,0,1)');
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hole;
    ctx.beginPath(); ctx.arc(cx, cy, Rh*1.02, 0, 7); ctx.fill();

    requestAnimationFrame(loop);
  })();
 }catch(e){
   // 블랙홀 캔버스 실패 시 조용히 생략 (CSS 배경 + 영상은 그대로 남는다)
 }
})();

/* ---------- 4. About 카운터 ---------- */
let counted = false;
function runCounters() {
  if (counted) return; counted = true;
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = +el.dataset.count, suffix = el.dataset.suffix || '';
    const fmt = (n) => (target >= 10000 ? Math.round(n).toLocaleString() : Math.round(n)) + suffix;
    const t0 = performance.now();
    (function tick(t) {
      const k = Math.min(1, (t - t0) / 1300);
      el.textContent = fmt(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  });
}

/* ---------- 5. 반페이지 상세 패널 ---------- */
const PANELS = {
  ax: {
    label: 'AX PROJECT · LG DX School 5기 (팀 404)',
    title: '실시간 HR 인력 대시보드',
    meta: 'LG DX School 5기 · 6인 팀 · 역할: 아이디어 개발 · 데이터 전략',
    heroClass: 'linear-gradient(135deg,#13254f,#29195c)', img: 'LG DX SCHOOL/AX.jpg',
    oneLine: '신사업 TF의 인력 현황과 역량 갭을 실시간으로 보여주는 HR 대시보드를 기획했습니다.',
    overview: 'LG 커피 신사업 TF를 잉여인력(정수기·물류 등)에서 차출·구성해야 하는 상황에서, HR 현황이 수기로 관리돼 실시간성이 떨어지는 문제에서 출발. 신사업에 필요한 역량이 충분한지 한눈에 보여주고 부족한 직무를 짚어주는 대시보드를 제안했습니다.',
    roleTitle: '내 역할 · 기여',
    roles: [
      '문제 정의 — 수기·지연되는 HR 현황 제공의 공백을 지적, 신사업 TF 인력을 실시간 파악할 필요성을 논증',
      '자동 최신화 방식 3안 제안·비교 — ① 회사앱 인사현황 알림 ② 카메라 생체인식 자동 배치 ③ 자리별 QR 자동 등록',
      '대시보드 구성 설계 — 신사업 컨셉·잉여인력·차출 후보(정수기·물류)·AI 챗봇을 한 화면에, 전략수립용/운영관리용 2뷰로 분리',
      '역량 진단 지표 설계 — 5축 레이더(기구설계·앱개발·커피도메인·마케팅·데이터분석) + 역량 갭 분석·SNA·예측 분석',
    ],
    metrics: [['5축', '역량 레이더'], ['3안', '자동 최신화 방식'], ['2뷰', '전략·운영 분리']],
    tags: ['HR Dashboard', 'Gap Analysis · SNA', '데이터 전략'],
    honest: 'AX는 아이디어 기획 단계 프로젝트로, 구현 코드보다 문제 정의와 해결 설계가 핵심입니다. 증빙은 발표자료로 대체합니다.',
    files: [
      { icon: 'pdf', name: 'AX 발표자료', file: 'LG DX SCHOOL/ax-presentation.pdf' },
      { icon: 'img', name: 'AX 표지 이미지', file: 'LG DX SCHOOL/AX.jpg' },
    ],
  },
  bx: {
    label: 'BX PROJECT · 🏆 우수상 (팀 사용자정의)',
    gold: true,
    title: 'ThinQ 클로이드 홈 매니저',
    meta: 'LG DX School 5기 · 5인 팀 · 역할: 데이터 조사 · 크롤링 · 발표 · 🏆 우수상',
    heroClass: 'linear-gradient(135deg,#0d3366,#0b4a5c)', img: 'LG DX SCHOOL/BX.png',
    oneLine: '샌드위치 세대를 위해 ThinQ에 AI 캐릭터를 결합한 「말하지 않아도 가족의 일상을 이어주는 홈 매니저」 브랜드 경험을 기획했습니다.',
    overview: '초고령사회에서 자녀 양육과 부모 부양을 동시에 감당하는 40~50대(생활관리자)를 타깃으로, 사람이 사람에게 지시하는 구조를 AI가 상황을 이해하고 중재하는 구조로 전환. LG와 고객 관계를 제품 사용을 넘어 「가족 케어 파트너」로 확장하는 브랜드 경험(BX)을 제안했습니다.',
    roleTitle: '내 역할 · 기여',
    roles: [
      '추진 배경을 「데이터적」으로 뒷받침 — 초고령사회 진입·40~50대 샌드위치 세대 부양 부담 통계 조사',
      '크롤링으로 시장·고객 반응 데이터 확보',
      '발표 자료 구성·발표 준비 — 핵심 경험 컨셉과 Key Accelerator 스토리라인',
    ],
    metrics: [['우수상', 'BX 부문'], ['40~50대', '핵심 타깃']],
    tags: ['ThinQ', 'BX 기획', '데이터 조사', '크롤링'],
    honest: 'BX는 브랜드 경험 기획으로 정량 성과보다 컨셉의 설득력이 핵심입니다. 저는 주장을 뒷받침하는 배경 데이터 조사와 크롤링을 맡아 근거를 만들었습니다.',
    files: [
      { icon: 'pdf', name: 'BX 발표자료', file: 'LG DX SCHOOL/bx-presentation.pdf' },
      { icon: 'img', name: 'BX 표지 이미지', file: 'LG DX SCHOOL/BX.png' },
    ],
  },
  cx: {
    label: 'CX PROJECT · 🏆 우수상 (팀 삼첩분식)',
    gold: true,
    title: 'ARTE-MIS — AI 현관 종합 솔루션',
    meta: 'LG DX School 5기 · 5인 팀 · 역할: 데이터 수집·크롤링 · NLP 분석 · 발표 · 🏆 우수상',
    heroClass: 'linear-gradient(135deg,#0b404d,#13254f)', img: 'LG DX SCHOOL/CX.jpg',
    oneLine: '실사용자 20만+ 건을 SBERT·KoELECTRA·LDA 앙상블로 분석해 기회영역을 도출한 AI 현관 종합 솔루션(ARTE-MIS)을 기획했습니다.',
    overview: 'ARTE-MIS(Automated Robotic Terminal for Entrance & Mobility Item Storage) — 신발 객체 관리(슈케어)를 넘어 현관 공간 전체를 다루는 AI 현관 종합 솔루션 CX 기획. IoT의 한계를 Physical AI(로봇)로 넘는 논리를 데이터로 입증했고, 저는 그 근거가 된 데이터 수집·분석 전 과정을 담당했습니다.',
    roleTitle: '내 역할 · 기여',
    roles: [
      '네이버 카페·블로그·지식iN 등에서 20만+ 건 실사용자 데이터 크롤링 → 신발·현관·아파트 옵션 3개 주제로 분류·전처리',
      'SBERT 문장 임베딩으로 게시글 군집화(도메인별 4~5개 군집) + KoELECTRA 감성분석으로 Pain Point 부정감성 정량화',
      'LDA 토픽모델링 병행 검증 + IPA(중요도-만족도) 분석 — 「정리·청소·신발 관리」가 고중요도·저만족도 사분면임을 확인',
      '기회영역 도출 — Actor 8개 유형 세분화, 「물리적 반복 행동 자동화」를 핵심 기회로 정의하고 최종 발표',
    ],
    metrics: [['20만+', '크롤링 데이터'], ['3', 'NLP 앙상블 모델'], ['우수상', 'CX 부문']],
    tags: ['SBERT', 'KoELECTRA', 'LDA', 'IPA 분석', 'Selenium'],
    honest: 'CX는 기획 산출물이라 코드 레포는 없지만, 20만+ 건 크롤링과 SBERT·KoELECTRA·LDA 앙상블 분석은 실제 데이터 작업이며 발표자료로 증빙됩니다. 로봇팔 하드웨어는 컨셉 제안 단계입니다.',
    files: [
      { icon: 'img', name: 'CX 표지 이미지', file: 'LG DX SCHOOL/CX.jpg' },
    ],
  },
  dx: {
    label: 'DX PROJECT · 🏆 장려상 (팀 5분 대기조)',
    gold: true,
    title: 'ThinQ Workspace Sentinel',
    meta: 'LG DX School 5기 · DX 장려상 · 5인 팀 · 6주(2026.05–06) · 역할: Backend',
    heroClass: 'linear-gradient(135deg,#1a1f61,#0d4d61)', img: 'LG DX SCHOOL/dx-screen-admin.png',
    oneLine: '요양병원 집단감염을 2~3주 선제 감지해 LG ThinQ 가전으로 자동 차단하는 IoT 시스템입니다.',
    overview: '하수 RNA·검색추이·약국판매 등 외부 역학 신호(feedforward)와 실내 IoT 센서(CO₂·온습도·재실인원, feedback)를 하나의 위험도로 융합해 5단계로 산정하고, ThinQ 가전 8종을 위험도에 맞춰 자동 제어합니다. 저는 백엔드 전반을 담당했습니다.',
    roleTitle: '내 역할 — Backend',
    roles: [
      '오작동 방지 2단계 상태기계 구현 — 방마다 다른 CO₂ 베이스라인을 EMA로 적응 재기준하고 +300ppm 급상승·회복 3초·15초 쿨다운으로 헛가동 차단. 공간별 asyncio.Lock으로 판정~제어 직렬화 (backend/api/sensor.py)',
      '두 개의 비동기 센서 스트림(CO₂·카메라 재실) 융합 — carry-forward(TTL 300s)와 재실 디바운스(10s)로 등급 튐 흡수',
      '실기기 가전 어댑터 벤더 추상화 — Coway IoCare(제어 + CO₂/PM2.5 센서로도 활용)·Samsung SmartThings(REST, 에어컨 자동 탐색) (backend/services/)',
      '제어 엔드포인트 fail-closed 보안 — API Key 미설정 시 거부 + ADMIN_CONTROL_PW 상수시간 비교, SSE 실시간 푸시 + 라우트 결선 테스트 (backend/api/auth.py · sse.py)',
    ],
    metrics: [['74', '테스트 통과'], ['8종', '병원체 시나리오'], ['2종', '실기기 연동'], ['6주', '기획→배포']],
    tags: ['Python 3.12', 'FastAPI', 'asyncpg', 'SSE', 'SmartThings', 'Coway IoCare'],
    honest: '테스트는 백엔드 핵심 로직 74개 + 보안 결선 위주이고 프론트 e2e는 미비합니다(README 로드맵 명시). 의료기기 규제·실파일럿 데이터는 남은 격차로 레포에 정직하게 공개 — 「경계를 아는, 잘 만든 PoC」로 포지셔닝합니다.',
    embed: { src: 'http://54.116.75.169:7654/Space_Sentinel_10min_standalone.html#1', label: 'HTML PPT · 새 탭에서 열림', poster: 'LG DX SCHOOL/dx-screen-demo.png' },
    files: [
      { icon: 'img', name: '관제 대시보드 화면', file: 'LG DX SCHOOL/dx-screen-admin.png' },
      { icon: 'img', name: '시연 화면', file: 'LG DX SCHOOL/dx-screen-demo.png' },
      { icon: 'img', name: '시스템 아키텍처 흐름도', file: 'LG DX SCHOOL/dx-architecture-flow.png' },
      { icon: 'img', name: 'DX 표지 이미지', file: 'LG DX SCHOOL/DX.png' },
    ],
    teamDocs: [
      { name: 'BX · 브랜드 경험 (팀 문서)', url: 'https://github.com/zln02/thinq-workspace-sentinel/blob/main/docs/portfolio/01_BX_브랜드경험.md' },
      { name: 'CX · 고객 경험 (팀 문서)', url: 'https://github.com/zln02/thinq-workspace-sentinel/blob/main/docs/portfolio/02_CX_고객경험.md' },
      { name: 'DX · 기술과 배포 (팀 문서)', url: 'https://github.com/zln02/thinq-workspace-sentinel/blob/main/docs/portfolio/03_DX_기술과배포.md' },
    ],
    links: [
      { href: 'https://github.com/zln02/thinq-workspace-sentinel', text: 'GitHub 레포 ↗' },
      { href: 'https://github.com/zln02/thinq-workspace-sentinel/pulls?q=is:pr+author:Parkjin0821', text: '내 기여 PR 보기 ↗', ghost: true },
    ],
  },
  ailagro: {
    label: 'CONTEST · \uD83C\uDFC6 \uC6B0\uC218\uC0C1',
    gold: true,
    title: 'AILAGro — 소상공인 카페의 AI 공동 경영자',
    meta: '제1회 2026 데이터로 미래를 그리는 AI 아이디어 공모전 · 팀 카페인(CAFE-IN) 4인 · 역할: 아이디어 디벨롭 · 발표자료 공동제작 · 🏆 우수상',
    heroClass: 'linear-gradient(135deg,#1f1a59,#0d3366)',
    img: '공모전/ailagro-web/ailagro-cover.jpg',
    oneLine: 'SNS 트렌드를 감지만 하고 끝나는 기존 도구와 달리, 감지 → 자동 발주 → 마케팅 문구 생성 → 레시피 개선까지 실행해주는 카페 소상공인용 AI 에이전트를 제안했습니다.',
    overview: '개인 카페는 하루 61개씩 문을 닫습니다(폐업률 22.65%, 전 업종 평균의 약 3.2배). 원인은 「트렌드 지체」입니다 — F&B 유행 주기가 과거 12~18개월에서 3~6개월로 짧아졌는데, 점주는 정점이 지난 뒤에야 메뉴를 냅니다. 두쫀쿠 사례를 보면 틱톡·X에서 언급 급증 → 네이버 검색량 전이 → 인스타 해시태그 폭발의 3단계가 반복되고, 합산 언급량이 260만 건을 넘습니다. 문제는 기존 도구가 여기서 멈춘다는 점입니다. 소상공인마당·나이스비즈맵은 과거 결제 데이터 기반이라 “내일 뭘 준비할지”를 못 알려주고, 썸트렌드·네이버 데이터랩은 언급량 숫자만 줍니다. 결국 점주가 데이터 해석·레시피 설계·발주·홍보 문구까지 4단계를 손으로 해야 합니다. AILAGro는 그 4단계를 에이전트가 수행하고 점주는 최종 승인만 하도록 설계했습니다.',
    roleTitle: '내 역할 — 아이디어 디벨롭 · 발표자료 공동제작',
    roles: [
      '서비스의 방향을 “감지”에서 “실행”으로 전환 — 트렌드 수치를 보여주는 데서 끝나던 초기 아이디어에, 발주·마케팅·레시피 개선까지 에이전트가 직접 수행하고 점주는 승인만 하는 자동 실행 구조를 붙여 차별점을 만들었습니다',
      '문제를 숫자로 세우는 근거 조사 — 하루 61개 폐업·폐업률 22.65%·커피전문점 10만 개 돌파 같은 시장 지표와, 두쫀쿠 확산 경로(틱톡·X → 네이버 → 인스타) 및 F&B 유행 주기 단축(12~18개월 → 3~6개월)을 자료로 확보해 “왜 지금 필요한가”를 뒷받침했습니다',
      '경쟁 서비스의 공백 정리 — 소상공인마당·나이스비즈맵(과거 결제 데이터 기반 정적 분석)과 썸트렌드·네이버 데이터랩(언급량 수치 제공)을 비교해, 실행 단계가 비어 있다는 것을 발표 논리의 축으로 세웠습니다',
      '발표자료(PPT) 공동 제작 — 21장 구성과 스토리라인을 함께 잡았습니다. 「왜 망하는가 → 트렌드를 놓친 대가 → 무엇을 해결하는가 → 어떻게 작동하는가 → 무엇이 바뀌는가」 순으로 문제에서 해법으로 넘어가게 배열했습니다',
      '시니어·비IT 점주를 위한 포용 설계 제안 — 조리·응대 중에는 스마트폰을 만지기 어렵다는 현장 조건을 반영해, 음성으로 묻고 음성으로 답받는 핸즈프리(STT/TTS) 인터페이스를 이용 흐름에 포함시켰습니다',
    ],
    metrics: [['우수상', 'AI 아이디어 공모전'], ['하루 61개', '개인 카페 폐업 현실'], ['3~6개월', '짧아진 F&B 유행 주기'], ['4인', '팀 카페인(CAFE-IN)']],
    tags: ['GPT-4o', 'LangGraph · LangChain', 'RAG · Qdrant', 'FastAPI · Celery', 'Twitter/Instagram API', 'Whisper STT · TTS', '공공데이터'],
    honest: '아이디어 공모전 출품작이라 실제 구현 단계는 아닙니다. GPT-4o·LangGraph·Qdrant 등은 제안한 서비스의 구상 기술이고, 신규고객 15~20%·폐기율 10%·수집시간 80% 같은 수치는 유사 사례를 근거로 세운 KPI 목표치이지 실측값이 아닙니다. 제 역할은 아이디어 디벨롭과 발표자료 공동제작이었고, 개발·구현은 수행하지 않았습니다. 팀 내 역할은 김가은(아이디어 기획)·조희진(피그마)·이치헌(PPT)으로 나뉘어 있었습니다.',
    files: [
      { icon: 'pdf', name: '기획서 (제안서 전문, 15p)', file: '공모전/ailagro-proposal.pdf' },
      { icon: 'pdf', name: '발표자료 (전체 21p)', file: '공모전/ailagro-presentation.pdf' },
      { icon: 'img', name: '① 표지 — 팀 카페인(CAFE-IN)', file: '공모전/ailagro-web/ailagro-cover.jpg' },
      { icon: 'img', name: '② 트렌드 확산 4단계 경로 (두쫀쿠 사례)', file: '공모전/ailagro-web/ailagro-trend-path.jpg' },
      { icon: 'img', name: '③ 기존 서비스의 한계 — 실행 단계 공백', file: '공모전/ailagro-web/ailagro-gap.jpg' },
      { icon: 'img', name: '④ 컨셉 — 감지에서 실행까지', file: '공모전/ailagro-web/ailagro-concept.jpg' },
      { icon: 'img', name: '⑤ 트렌드를 놓친 대가 — 재료값 폭등', file: '공모전/ailagro-web/ailagro-cost.jpg' },
      { icon: 'img', name: '⑥ 4단계 자동 실행 흐름', file: '공모전/ailagro-web/ailagro-flow.jpg' },
      { icon: 'img', name: '⑦ AILAGro가 읽는 8개 채널 신호', file: '공모전/ailagro-web/ailagro-signals.jpg' },
      { icon: 'img', name: '⑧ 기술 스택·시스템 구조 요약', file: '공모전/ailagro-web/ailagro-stack.jpg' },
      { icon: 'img', name: '⑨ 시스템 아키텍처', file: '공모전/ailagro-web/ailagro-architecture.jpg' },
      { icon: 'img', name: '⑩ 정량 KPI·확장 로드맵·수익모델', file: '공모전/ailagro-web/ailagro-kpi.jpg' },
      { icon: 'img', name: '서비스 표지 이미지', file: '공모전/ailagro.png' },
    ],
  },
  futurecar: {
    label: 'CONTEST · 산업통상자원부 공공데이터 아이디어 공모전',
    title: '미래차 AX 전환·실증·사업화 추천 플랫폼',
    meta: '산업통상자원부 주최 · 광주/전남 세그먼트 · 팀 프로젝트 · 역할: 2차 MVP 백엔드·데이터·기획',
    heroClass: 'linear-gradient(135deg,#1f1a59,#0d3366)',
    img: '공모전/futurecar-platform.png',
    oneLine: '공공데이터 11종을 수집해 LightGBM 랭킹 모델과 근거 기반 추천 API를 구현하고, 팀의 1차 MVP를 대체할 수 있는 2차 MVP 백엔드를 만들었습니다.',
    overview: '내연기관 부품기업의 미래차 전환(Track1)과 자율주행 기업의 실증·고도화(Track2)를 돕는 추천 플랫폼입니다. 팀의 1차 MVP(Gemini 기반 프론트·백엔드)와 같은 API 계약(/api/recommend, /api/roadmap)을 그대로 구현하는 2차 MVP 백엔드를 제가 만들었습니다 — 규칙 기반 추천에 실데이터 기반 ML 재정렬(LightGBM)과 evidence_id 근거 연결, 피드백 학습 루프를 더한 버전입니다.',
    roleTitle: '내 역할 · 기여',
    roles: [
      '공공데이터 11종 조사·수집·정리 — 등록공장·R&D과제·KC인증·안전인증·전기차부품시험·실증장비 등 1차 데이터군, 스마트공장·지원사업 우수사례 등 2차 ML 학습용 데이터군으로 구조화',
      'FastAPI 추천/로드맵 API 직접 구현 — 팀의 1차 MVP와 동일한 API 계약으로 만들어 백엔드 교체가 가능하도록 설계',
      'LightGBM LambdaRank 랭킹 모델 학습 — 성공사례 데이터를 라벨로 규칙 기반 추천 순위를 재정렬(최종점수 = 규칙+검색+ML+근거품질 가중합)',
      '피드백 학습 루프·자동 재학습 트리거 구현 — 사용자 행동을 학습 라벨로 반영해 재학습, 모델 버전 관리',
      '전체 서비스 기획(Track1·Track2 구조, DB/RAG 아키텍처) + 팀 프론트엔드 UI 피드백',
    ],
    metrics: [['31건', '테스트 통과(직접 확인)'], ['11종', '공공데이터 수집'], ['NDCG@3 0.93', 'ML 랭킹(프록시 라벨 기준)']],
    tags: ['FastAPI', 'LightGBM', '공공데이터', 'RAG 기획'],
    honest: '이 2차 MVP 백엔드는 팀 1차 MVP와 같은 API 계약으로 동작해 실제 교체가 가능하지만, 최종 제출·배포된 라이브 데모(Vercel)는 팀원이 만든 1차 MVP(Gemini 기반)가 그대로 운영 중이라 두 버전이 실제로 병합되진 않았습니다. 로컬에서 직접 테스트를 돌려 31건 통과와 근거 연결 추천 응답을 확인했습니다. 1차 심사에서 탈락했으며 구체적 사유는 공개되지 않았습니다. NDCG@3 0.93은 실사용자 피드백이 아직 쌓이지 않아 유사도 함수로 만든 프록시 라벨로 측정한 값이라, 실제 추천 만족도로 검증된 수치는 아닙니다.',
    files: [
      { icon: 'img', name: '공모전 포스터', file: '공모전/santongbu-contest-poster.png' },
    ],
    links: [
      { href: 'https://futurecar-ax-rag.vercel.app', text: '팀 1차 MVP 라이브 데모 (비교 참고용) ↗', ghost: true },
    ],
  },
  kma: {
    label: 'CONTEST · 기상청 빅데이터 콘테스트',
    title: '전력설비 화재·방전 위험 예측',
    meta: '기상청 주최 · 2026 날씨 빅데이터 콘테스트 · 주제1(재난안전) · 팀 참가 · 역할: 데이터 수집·QGIS 공간분석·논문 리서치',
    heroClass: 'linear-gradient(135deg,#0d2e61,#0b4a5c)',
    oneLine: '강원 전주 138만 개에 8종+ 공공데이터를 융합해 「발화원 × 연소조건」으로 화재위험을 정량화한 공간분석·예측 과제입니다.',
    overview: '강원 전주 1,387,831개의 화재위험을 이진분류(0/1)하는 과제. 단순 「건조+강풍」 합산이 아니라 「발화원 × 연소조건」의 곱으로 모델링해 둘 다 성립할 때만 고위험으로 판정하고, 한전 2025 배전선로 정전분석 통계(조류 24.7%·자연열화 10.8%·낙뢰 7.5% 등)를 가중치로 삼아 원인별로 위험을 분해했습니다.',
    roleTitle: '내 역할 · 기여',
    roles: [
      '8종+ 공공데이터 수집·통합 — 전주 138만·AWS 76지점 3개년·ASOS 강원 5개년·낙뢰 64,212건·DEM 90m·임상도·해안선·철새도래지',
      'QGIS 공간분석 — 전주 좌표에 기상·지형·식생을 공간조인, 지점 기상값을 IDW 거리가중 보간(k=8·p=2)으로 전주에 연속 매핑, 4등급 위험 히트맵 제작',
      '논문 리서치로 화재 변인 근거 확립 — 한전 정전통계 가중, 산림청 산불위험지수(DWI)·실효습도, 습도 비선형(건조 vs 오손섬락)·양간지풍',
      '외부검증 설계 — 채점 라벨 비공개를 정면돌파: 고위험 전주 밀도 vs 실제 전기화재 664건 시군구 분포 Spearman 상관 + 낙뢰 점단위 검증',
    ],
    metrics: [['138만', '분석 대상 전주'], ['8종+', '데이터 융합'], ['20.8만', '위험구역 도출']],
    tags: ['QGIS', 'Python', 'R', '공간분석(IDW)', 'DEM'],
    honest: '수상하지 못했습니다. 구체적 심사 사유는 공개되지 않았습니다. 채점 라벨(한전 내부)이 비공개라 F1 최적화 대신 「원인별 근거가 명확한 합리적 위험도」와 외부검증(실화재 664건·낙뢰 대조)에 집중하는 쪽을 택했는데, 채점이 라벨 일치도 위주였다면 이 선택이 점수에는 불리했을 수 있습니다. 다만 공간분석과 검증 과정 자체는 그대로 남은 결과물입니다.',
    img: '공모전/weather-riskmap.png',
    files: [
      { icon: 'img', name: 'QGIS 위험 히트맵 (decision=1)', file: '공모전/weather-riskmap.png' },
      { icon: 'pdf', name: '분석 보고서', file: '공모전/weather-report.pdf' },
      { icon: 'pdf', name: '참가 서약서', file: '공모전/weather-pledge.pdf' },
      { icon: 'code', name: '분석 코드 (R)', file: '공모전/260356_program_code.R' },
      { icon: 'img', name: '콘테스트 배너', file: '공모전/weather-contest-banner.png' },
    ],
  },
  kdt: {
    label: 'HACKATHON · 🏆 아이디어상 · 직업능력심사평가원 원장상',
    gold: true,
    title: '곁눈 — 확인 질문을 남기는 시니어 정보판단 AI 코치',
    meta: '제8회 K-디지털 트레이닝 해커톤 (고용노동부·KOREATECH·직업능력심사평가원 주최) · 2026 · 자유과제 · 6인 팀 팀장 · 역할: PM · 데이터 통합 · 🏆 본선 아이디어상',
    heroClass: 'linear-gradient(135deg,#0d4038,#0d3366)',
    img: 'KDT 해커톤/web/gyeotnun-scenario.jpg',
    oneLine: '받은 정보의 진위를 AI가 대신 판정하지 않고, 공식 근거에 연결된 확인 질문을 제시해 60대가 스스로 판단하게 하는 모바일 웹앱(PWA)입니다.',
    overview: '65세 이상의 76.9%가 인터넷을, 92.6%가 메신저를 쓰지만 고령층 디지털 정보화 수준은 71.4%(70대 이상 51.4%)에 머뭅니다. 보이스피싱 피해자 중 60대 이상 비중은 2020년 16%에서 2025년 상반기 30.6%로 올라 전 연령대 1위가 됐습니다. 기존 스팸·피싱 차단은 발신번호와 악성 URL을 막는 1차 안전선이지만, 가족이 전달한 메시지나 실제 제도와 조건이 일부 겹치는 지원 안내는 번호·링크만으로 가려지지 않습니다. 곁눈은 바로 그 구간을 맡는 2차 안전선입니다 — 문자마다 해당 제도의 공식 원문을 찾아 붙이고 그 문자에 맞는 확인 질문을 생성하며, 놓친 질문은 즉시 복습·후속 훈련으로 되돌려 판단 기준이 사용자에게 남게 했습니다. HTTPS로 실제 배포돼 안드로이드 공유 메뉴(Web Share Target)로 진입할 수 있습니다.',
    roleTitle: '내 역할 — PM · 데이터 통합',
    roles: [
      '곁눈 RAG의 데이터 기반 구축 — 어떤 공공기관 문서를 어디까지 모을지(공공지원·건강·금융), 위험유형·판단단서를 어떤 규칙으로 태깅할지, 무엇을 검증할지를 직접 설계하고 수집 파이프라인을 구축·운영. robots.txt 준수와 요청 간격(0.7초)을 지키고 SHA-256 본문 해시로 중복 제거 후 850자·100자 오버랩으로 청킹 → 공식 문서 1,052건 · 검색 청크 2,012건 확보 (코드 작성에는 AI 코딩 도구를 사용)',
      '수집 데이터로 문제 가설 검증 — 층화표본 100건(금융 25·공공지원 40·건강 35)에서 기관사칭 33%·긴급성 압박 32%·금전 요구 21%를 정량화해 “정보가 분산되고 신뢰·긴급·금전 요구가 반복된다”는 가설을 뒷받침. 동시에 공식 문서만으로는 실제 사용자의 행동을 확정할 수 없다는 한계를 리포트에 명시하고 설문·사용성 점검으로 분리',
      '문제 정의와 최종 기획서 집필 — 흩어져 있던 사례 분석·공식 근거·검색 결과·화면 산출물을 하나의 통합 근거표로 모으고, 심사 4개 항목(참신성·구현가능성·현장실효성·보안성)에 맞춰 10p 제출본을 직접 구성·집필',
      '핵심 실측 지표를 직접 재정의 — 평가 세트를 doc(근거문서 존재)·scam(사기 수법)·none(근거없음)으로 재라벨링하고 한국어 임베딩으로 전환해 근거 검색 성공률을 63.6% → 83.3%(15/18)로 확정. 문서 곳곳에 22·28·30건으로 흩어져 있던 평가 세트 분모도 전 장에 걸쳐 정합화',
      '개선안을 실측한 뒤 스스로 기각 — 하이브리드 검색(RRF)·질의 재작성은 성공률이 올랐지만 늘어난 성공분이 전부 오답 근거였습니다. 숫자 대신 안전성을 택해 기각하고, 남은 실패 3건의 원인을 색인 커버리지 부족으로 특정해 문서에 공개했습니다',
      '서비스 정의와 문서의 논리 모순 제거 — “AI가 진위를 판정하지 않는다”는 서비스 정의와 정면으로 충돌하던 「오판(誤判)」 용어를 문서 전체에서 「확인」으로 교체',
      '미검증 서술 색출 — 문서에 서술돼 있던 「12명 대면 테스트」가 실제 미실시임을 확인해 「초기 사용성 점검(연령 구성 미확정)」으로 재정의하고, 경쟁사 비교 오표기(GranGuard 금융 연동)도 부분 제공으로 수정. 발표 질의응답에서 되돌릴 수 없는 리스크를 제출 전에 제거',
      '외부 리뷰 7건 통합 대응 · 제출 실무 — 본문에 없던 인용 각주 9곳 삽입, 미사용 출처 삭제 후 재번호, 이중 출처 목록 정리로 11p → 10p 축소, 예선+본선 통합 간트차트 재구성(Figma·hwpx 동기화)',
      '배포된 웹 데모 실사용 검수 — 고위험 행동을 제동하지 못하는 문제, 입력에 없는 속성(URL)을 묻는 질문 생성, 훈련 기록 저장 오류 등 P0 4건을 직접 발견해 개선 우선순위를 수립',
    ],
    metrics: [['아이디어상', '직업능력심사평가원 원장상'], ['83.3%', '근거 검색 성공률(15/18)'], ['97.8%', '개인정보 마스킹 재현율'], ['13/13', 'API 장애 폴백 성공']],
    proof: {
      img: 'KDT 해커톤/web/gyeotnun-award-cert.jpg',
      alt: '제8회 K-디지털 트레이닝 해커톤 아이디어상 상장과 팀 Second Look 명찰 — 팀장 박진',
      title: '자유과제 부문 아이디어상 · 직업능력심사평가원장상',
      sub: '2026.09.04 · 고용노동부·KOREATECH 주최 · 팀 Second Look(6인) 팀장 · 상금 30만원',
    },
    tags: ['데이터 파이프라인 설계', 'Python · 크롤링', '청킹 · 중복제거', 'RAG · 한국어 임베딩', 'BM25 폴백', 'React PWA', 'Web Share Target', 'FastAPI · Docker', 'Claude API', 'OCR'],
    honest: '2026-09-01 본선에 진출해 자유과제 부문 아이디어상(직업능력심사평가원 원장상, 상금 30만원)을 받았습니다. 본선 무대 발표는 상위 시상팀만 진행하는 방식이라 저희 팀은 별도 현장 발표 없이 이 등급으로 마무리됐습니다. 아래 수치는 모두 예선심사 제출본(2026-08-10) 기준이며, 본선 단계의 보강 결과는 아직 이 페이지에 반영하지 않았습니다. 근거 검색은 18건 중 15건 성공으로, 실패 3건은 색인 커버리지 부족으로 원인을 특정해 문서에 공개했습니다. 평가 세트 30건 중 음성 8건은 예선 범위에서 제외해 텍스트·이미지 22건으로만 측정했습니다. 12명 초기 사용성 점검은 연령 구성이 확정되지 않아 「60대 대면 테스트」라고 부르지 않으며, 합성 페르소나(NVIDIA Nemotron-Personas-Korea)는 이용 상황 누락을 점검한 보조 자료일 뿐 사용자 효과 검증이 아닙니다. 기관 도입은 담당자 인터뷰 전 단계이고 가격도 미정입니다. 서비스 앱의 개발·배포는 팀원(박진영·김유리)이 담당했고, 저는 PM·데이터 기반·문서 정합성을 맡았습니다. 데이터 수집 파이프라인은 수집 범위·태깅 규칙·검증 방식을 제가 설계하고 실행·해석했지만 코드 작성 자체는 AI 코딩 도구를 사용했습니다. 리포트의 중간 스냅샷(577건 → 1,017건)과 최종 제출 수치(1,052건)가 다른데, 수집 시점이 다른 것이며 리포트 첫머리에 그대로 밝혀 두었습니다.',
    files: [
      { icon: 'pdf', name: '최종 기획서 (예선심사 제출본, 10p)', file: 'KDT 해커톤/web/gyeotnun-proposal-final.pdf' },
      { icon: 'doc', name: '공식 데이터 수집·분석 리포트 (내가 만든 파이프라인 결과)', file: 'KDT 해커톤/web/gyeotnun-data-report.html' },
      { icon: 'img', name: '서비스 폼보드 (곁눈)', file: 'KDT 해커톤/web/gyeotnun-formboard.png' },
      { icon: 'img', name: '대표 사용자 시나리오 4컷', file: 'KDT 해커톤/web/gyeotnun-scenario.jpg' },
      { icon: 'img', name: '시스템 아키텍처 (4계층)', file: 'KDT 해커톤/web/gyeotnun-architecture.jpg' },
      { icon: 'img', name: '서비스 이용 흐름 5단계', file: 'KDT 해커톤/web/gyeotnun-flow.jpg' },
      { icon: 'img', name: '4대 판단 패턴 (사례 60건 분석)', file: 'KDT 해커톤/web/gyeotnun-patterns.jpg' },
      { icon: 'img', name: '경쟁 서비스 기능 비교', file: 'KDT 해커톤/web/gyeotnun-compare.jpg' },
      { icon: 'img', name: '개발 일정 (예선 + 본선 보강)', file: 'KDT 해커톤/web/gyeotnun-gantt.jpg' },
      { icon: 'img', name: '성과 지표 6종', file: 'KDT 해커톤/web/gyeotnun-kpi.jpg' },
      { icon: 'img', name: '부문별 수상 결과 발표 화면', file: 'KDT 해커톤/web/kdt-award-idea.png' },
      { icon: 'img', name: '해커톤 공식 포스터', file: 'KDT 해커톤/web/kdt-hackathon-main.png' },
    ],
    links: [
      { href: 'https://gyeotnun.duckdns.org/', text: '곁눈 라이브 서비스 열기 ↗' },
      { href: 'https://www.figma.com/design/ZhmI6bmKe5FY9muGpgUk2H/', text: 'Figma 기획 파일 ↗', ghost: true },
      { href: 'https://shade-egret-c5a.notion.site/KDT-3a56029496a280c7a1f4ec6f7bf624f8', text: '팀 노션 전체 기록 ↗', ghost: true },
    ],
  },
};

const scrim = document.getElementById('scrim');
const panel = document.getElementById('panel');
const panelBody = document.getElementById('panelBody');
let panelOpen = false;

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}

function openPanel(key) {
  const p = PANELS[key];
  if (!p) return;
  let html = `<p class="p-label${p.gold ? ' gold' : ''}">${esc(p.label)}</p>
    <h3>${esc(p.title)}</h3>
    <p class="p-meta">${esc(p.meta)}</p>
    <div class="p-hero" style="background:${p.heroClass}">
      ${p.img ? `<img src="${encodeURI(p.img)}" alt="" onerror="this.remove()">` : ''}
      <span>\uB300\uD45C \uC774\uBBF8\uC9C0 / \uC2DC\uC5F0 GIF \uC601\uC5ED</span>
    </div>`;
  if (p.oneLine) html += `<div class="p-oneline"><span>PROJECT IN ONE LINE</span>${esc(p.oneLine)}</div>`;
  html += `<h4>\uBC30\uACBD \u00B7 \uBB38\uC81C</h4><p class="p-text">${esc(p.overview)}</p>
    <h4>${esc(p.roleTitle)}</h4><ul>${p.roles.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`;
  if (p.metrics) html += `<h4>\uC131\uACFC \u00B7 \uC218\uCE58</h4><div class="metrics">${p.metrics.map((m) => `<div class="metric"><strong>${esc(m[0])}</strong><span>${esc(m[1])}</span></div>`).join('')}</div>`;
  if (p.proof) html += `<h4>\uD83C\uDFC6 \uC218\uC0C1 \uC778\uC99D</h4>
    <figure class="p-proof">
      <a href="${encodeURI(p.proof.img)}" target="_blank" rel="noopener" aria-label="\uC6D0\uBCF8 \uD06C\uAE30\uB85C \uBCF4\uAE30">
        <img src="${encodeURI(p.proof.img)}" alt="${esc(p.proof.alt)}" onerror="var f=this.closest('figure'); if(f) f.remove()">
      </a>
      <figcaption><b>${esc(p.proof.title)}</b><span>${esc(p.proof.sub)}</span></figcaption>
    </figure>`;
  html += `<h4>\uAE30\uC220 \uC2A4\uD0DD</h4><div class="tags">${p.tags.map((t) => `<i>${esc(t)}</i>`).join('')}</div>`;
  if (p.honest) html += `<div class="p-honest"><b>\uC815\uC9C1\uD55C \uD55C\uACC4</b>${esc(p.honest)}</div>`;
  if (p.embed) {
    html += `<h4>📽 발표자료</h4>
      <a class="ppt-poster" href="${p.embed.src}" target="_blank" rel="noopener">
        ${p.embed.poster ? `<img src="${encodeURI(p.embed.poster)}" alt="" onerror="this.remove()">` : ''}
        <span class="ppt-play">▶ 발표자료 열기<em>${esc(p.embed.label)}</em></span>
      </a>`;
  }
  if (p.files) {
    const extOf = (f) => f.split('.').pop().toUpperCase();
    html += `<h4>\uD83D\uDCC2 \uC790\uB8CC \uBCF4\uAE30</h4><div class="files">${p.files.map((f) =>
      `<a class="file-btn" href="${encodeURI(f.file)}" target="_blank" rel="noopener">
        <i class="${f.icon}">${extOf(f.file)}</i>
        <div><h6>${esc(f.name)}</h6><p>${esc(f.file)}</p></div>
      </a>`).join('')}</div>`;
  }
  if (p.teamDocs) {
    html += `<h4>\uD83D\uDCD1 \uD300 \uC0B0\uCD9C\uBB3C \uBB38\uC11C</h4><div class="files">${p.teamDocs.map((d) =>
      `<a class="file-btn" href="${encodeURI(d.url)}" target="_blank" rel="noopener">
        <i class="doc">MD</i>
        <div><h6>${esc(d.name)}</h6><p>github.com \u00B7 \uD300 \uACF5\uD1B5 \uBB38\uC11C</p></div>
      </a>`).join('')}</div>`;
  }
  if (p.links) html += `<div class="links-row">` + p.links.map((l) => `<a class="gh-btn${l.ghost ? ' ghost' : ''}" href="${l.href}" target="_blank" rel="noopener">${esc(l.text)}</a>`).join('') + `</div>`;
  if (p.link) html += `<a class="gh-btn" href="${p.link.href}" target="_blank" rel="noopener">${esc(p.link.text)}</a>`;
  panelBody.innerHTML = html;
  panel.scrollTop = 0;
  scrim.classList.add('open');
  panel.classList.add('open');
  panelOpen = true;
}
function closePanel() {
  scrim.classList.remove('open');
  panel.classList.remove('open');
  panelOpen = false;
}
document.querySelectorAll('[data-panel]').forEach((card) => {
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', (card.querySelector('h4') ? card.querySelector('h4').textContent : '프로젝트') + ' 상세 보기');
  card.addEventListener('click', () => openPanel(card.dataset.panel));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(card.dataset.panel); }
  });
});
scrim.addEventListener('click', closePanel);
document.getElementById('panelClose').addEventListener('click', closePanel);


/* ---------- 로딩 화면 숨김 ----------
   해제 로직은 파일 최상단(섹션 0)으로 이동했다. 여기서 호출하면 window 'load'
   보다 먼저 로더가 걷혀 이미지가 덜 뜬 화면이 보이므로, 일부러 호출하지 않는다. */


/* ---------- 생동감: 매달린 프로필 물리 ---------- */
(function hangingProfile(){
  var el = document.getElementById('swingCard');
  if(!el) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var ang = 0, vel = 0, mouseF = 0, t = 0;
  window.addEventListener('pointermove', function(e){
    var r = el.getBoundingClientRect();
    var cx = r.left + r.width/2;
    var dx = (e.clientX - cx) / innerWidth;         // -0.5 ~ 0.5
    var near = Math.max(0, 1 - Math.abs(e.clientX - cx) / 520) *
               Math.max(0, 1 - Math.abs(e.clientY - (r.top + r.height/2)) / 520);
    mouseF = dx * 22 * near;                         // 가까울수록 세게 민다
  }, {passive:true});
  (function loop(){
    t += 0.016;
    var idle = Math.sin(t * 0.9) * 0.9; // 은은한 상시 스윙
    var target = mouseF + idle;
    var acc = (target - ang) * 0.045 - vel * 0.06;   // 스프링 + 감쇠
    vel += acc; ang += vel;
    if(ang > 14) ang = 14; if(ang < -14) ang = -14;
    el.style.transform = 'rotate(' + ang.toFixed(3) + 'deg)';
    mouseF *= 0.965;                                  // 힘 자연 소멸
    requestAnimationFrame(loop);
  })();
})();

/* ---------- 생동감: 카드 3D 틸트 + 스포트라이트 ---------- */
(function cardTilt(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  document.querySelectorAll('.pcard, .ccard').forEach(function(card){
    card.addEventListener('pointermove', function(e){
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;       // 0~1
      var py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (px*100).toFixed(1) + '%');
      card.style.setProperty('--my', (py*100).toFixed(1) + '%');
      var ry = (px - 0.5) * 9, rx = (0.5 - py) * 7;
      card.style.transform = 'perspective(1000px) rotateX(' + rx.toFixed(2) +
        'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-10px) scale(1.025)';
    });
    card.addEventListener('pointerleave', function(){
      card.style.transform = '';
    });
  });
})();

/* ---------- 생동감: Contact 카드 자석 호버 ---------- */
(function magneticCards(){
  document.querySelectorAll('.link-card').forEach(function(card){
    card.addEventListener('pointermove', function(e){
      var r = card.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width/2);
      var dy = e.clientY - (r.top + r.height/2);
      card.style.transform = 'translate(' + (dx*0.12).toFixed(1) + 'px,' + (dy*0.16).toFixed(1) + 'px)';
    });
    card.addEventListener('pointerleave', function(){ card.style.transform = ''; });
  });
})();


/* ---------- Hero 키워드 로테이션 (페이드+슬라이드, hover 정지) ---------- */
(function heroRotate(){
  var el = document.getElementById('heroRotate');
  if(!el) return;
  var heroRotatePhrases = [
    'Problem Solver',
    'Backend Developer',
    'Data-Driven Planner',
    'From Idea to Deployment',
    'Award-Winning Builder'
  ];
  var i = 0, paused = false;
  var host = el.closest('.hero-inner') || el.parentElement;
  host.addEventListener('mouseenter', function(){ paused = true; });
  host.addEventListener('mouseleave', function(){ paused = false; });
  setInterval(function(){
    if(paused) return;
    el.classList.add('out');
    setTimeout(function(){
      i = (i + 1) % heroRotatePhrases.length;
      el.textContent = heroRotatePhrases[i];
      el.classList.remove('out');
    }, 520);
  }, 2800);
})();

/* ---------- [확장 대비 훅] 배경 씬 전환 아키텍처
   현재는 'galaxy'(별밭+블랙홀) 단일 씬. 향후:
     data-scene="galaxy"  -> 은하 (현재)
     data-scene="solar"   -> 태양계
     data-scene="planet"  -> 행성 근접
   #space[data-scene] 값에 따라 별도 씬 렌더러를 분기하도록 설계.
   지금은 구현하지 않음 (구조만 준비). --------------------------- */
