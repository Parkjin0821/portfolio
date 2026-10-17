/* Portfolio Concept Dive: scroll takes you into the computer.
   Every chapter is a full-viewport scene. Moving between two scenes is one continuous zoom
   through a portal: an element of the outer scene (the laptop screen, a desktop icon) grows
   until it becomes the landing element of the inner scene (the whole desktop, a window).
   Both scenes share one similarity transform, so the inner scene really sits inside the portal
   the whole way through instead of cross-fading. */

/* ---------- Content data (same facts as portfolio-concept-blue) ---------- */
const projectData = {
  ax: {label:'LG DX School · AX', title:'실시간 HR 인력 대시보드', file:'ax-hr-dashboard.pdf',
    summary:'신사업 TF를 구성할 때 흩어진 인력 현황과 역량 부족을 실시간으로 확인하기 위한 HR 의사결정 대시보드입니다.',
    role:'수기로 관리되던 HR 현황의 지연 문제를 정의하고, 자동 최신화 방식 3안을 비교했습니다. 5축 역량 레이더와 역량 갭·SNA·예측 분석을 포함한 데이터 구성을 설계했습니다.',
    decision:'경영진의 전략 수립과 현장 운영은 필요한 정보가 다르다고 판단해 화면을 전략용과 운영용 두 가지 뷰로 나눴습니다.',
    result:'6인 팀의 기획 프로젝트로 신사업 컨셉, 잉여인력, 차출 후보와 역량 부족을 하나의 의사결정 흐름으로 정리했습니다. 구현보다 문제 정의와 데이터 전략에 집중한 결과물입니다.'},
  bx: {label:'LG DX School · BX · 우수상', title:'ThinQ 클로이드 홈 매니저', file:'bx-family-care.pdf',
    summary:'자녀 양육과 부모 부양을 함께 맡는 40~50대가 가족의 일상을 관리하도록 ThinQ와 AI 캐릭터를 결합한 브랜드 경험입니다.',
    role:'초고령사회와 샌드위치 세대의 부양 부담을 보여주는 통계를 조사하고, 시장·고객 반응을 크롤링했습니다. 발표 자료의 근거와 핵심 경험 스토리 구성을 맡았습니다.',
    decision:'사람이 가족에게 반복해서 지시하는 경험을 AI가 상황을 이해하고 중재하는 경험으로 바꾸고, LG와 고객의 관계를 가족 케어 파트너로 확장했습니다.',
    result:'5인 팀으로 BX 부문 우수상을 수상했습니다. 제 기여는 컨셉을 뒷받침하는 배경 데이터 조사, 고객 반응 수집과 발표 구성입니다.'},
  cx: {label:'LG DX School · CX · 우수상', title:'ARTE-MIS', file:'cx-arte-mis.jpg',
    summary:'신발 관리에서 현관 공간 전체로 문제를 넓혀, 반복되는 물리 행동을 자동화하는 AI 현관 종합 솔루션입니다.',
    role:'네이버 카페·블로그·지식iN 등에서 20만+ 건을 수집·전처리하고, SBERT 군집화·KoELECTRA 감성분석·LDA 토픽모델링과 IPA 분석을 수행했습니다.',
    decision:'기술 아이디어에서 출발하지 않고 실제 사용자의 불편을 먼저 찾았습니다. 고중요도·저만족도 영역인 정리·청소·신발 관리를 핵심 기회로 정의했습니다.',
    result:'5인 팀으로 CX 부문 우수상을 수상했습니다. 데이터 분석을 통해 IoT를 넘어 Physical AI가 필요한 이유와 기회영역을 제시했습니다.'},
  sentinel: {label:'LG DX School · DX · 장려상', title:'ThinQ Workspace Sentinel', file:'thinq-sentinel.app',
    summary:'요양병원의 환경·행동 데이터를 조합해 집단감염 위험을 조기 감지하고, 위험 단계에 따라 ThinQ 가전을 자동 제어하는 IoT 사전대응 시스템입니다.',
    role:'FastAPI 기반 상태머신, 디바이스 어댑터, SSE 이벤트 스트림, 인증과 예외 흐름을 담당했습니다.',
    decision:'각 센서를 직접 결합하는 대신 공통 어댑터와 상태 전이 규칙을 두어 장치가 늘어나도 제어 로직이 흔들리지 않게 설계했습니다.',
    result:'6주 동안 5인 팀으로 AWS에 실배포했고 LG DX School DX 부문 장려상을 수상했습니다.'},
  gyeotnun: {label:'KDT 해커톤 · 아이디어상', title:'곁눈', file:'gyeotnun.app',
    summary:'AI가 진위를 대신 판정하지 않고, 사용자가 받은 정보에 공식 근거와 확인 질문을 붙여 스스로 판단하도록 돕는 시니어 정보판단 코치입니다.',
    role:'PM으로 문제 정의, 공식 데이터 수집 범위와 태깅 규칙, 평가 지표, 최종 10페이지 기획서의 정합성을 맡았습니다.',
    decision:'RRF와 질의 재작성은 성공률을 높였지만 증가분이 모두 오답 근거였습니다. 숫자를 높이는 대신 안전성을 택해 기각했습니다.',
    result:'팀은 KDT 해커톤 아이디어상을 수상했습니다. 공식 문서는 1,052건이며, 재라벨링한 평가에서 근거 문서가 존재하는 18건 중 15건을 검색했습니다(83.3%). 평가 조건이 달라 초기 63.6%와 직접 비교하지 않습니다.'},
  ailagro: {label:'AI 아이디어 공모전 · 우수상', title:'AILAGro', file:'ailagro-proposal.pdf',
    summary:'카페 소상공인이 SNS 트렌드를 감지하는 데서 그치지 않고, 자동 발주·마케팅 문구 생성·레시피 개선까지 실행하도록 돕는 AI 에이전트 제안입니다. 개인 카페는 하루 61개씩 문을 닫는데(폐업률 22.65%), F&B 유행 주기가 12~18개월에서 3~6개월로 짧아진 「트렌드 지체」를 원인으로 보았습니다.',
    role:'아이디어 디벨롭과 발표자료(21장) 공동 제작을 맡았습니다. 하루 61개 폐업·폐업률 22.65%·커피전문점 10만 개 돌파 같은 시장 지표와 두쫀쿠 확산 경로(틱톡·X → 네이버 → 인스타)를 조사했고, 소상공인마당·나이스비즈맵·썸트렌드·네이버 데이터랩의 공백을 정리했습니다.',
    decision:'트렌드 수치를 보여주는 데서 끝나던 초기 아이디어를 「감지」에서 「실행」으로 전환해, 에이전트가 발주·마케팅·레시피 개선을 수행하고 점주는 승인만 하는 구조로 차별점을 만들었습니다. 조리·응대 중에도 쓸 수 있도록 음성(STT/TTS) 흐름을 제안했습니다.',
    result:'팀 카페인(4인)으로 우수상을 받았습니다. 아이디어 공모전 출품작이라 구현은 하지 않았습니다. GPT-4o·LangGraph 등은 제안 서비스의 구상 기술이고, 신규고객·폐기율 같은 수치는 KPI 목표치이지 실측값이 아닙니다.'},
  futurecar: {label:'미래차 AX 공모전', title:'미래차 AX 추천 플랫폼', file:'futurecar-ax.api',
    summary:'기업의 역량과 지원사업·실증 인프라를 연결해 다음 AX 전환 단계를 추천하는 근거 기반 플랫폼의 2차 MVP입니다.',
    role:'11종 공공데이터 파이프라인, LightGBM 랭킹, evidence_id 근거 연결, FastAPI 추천·로드맵 API를 직접 구현했습니다.',
    decision:'설명 없는 점수 대신 모든 추천 결과에 근거 ID와 로드맵 단계를 연결해 사용자가 추천 이유를 추적할 수 있게 했습니다.',
    result:'기존 1차 MVP를 대체할 백엔드를 완성했고 API 테스트 31건을 모두 통과했습니다.'},
  weather: {label:'날씨 빅데이터 콘테스트', title:'전력설비 화재위험 예측', file:'fire-risk-map.qgz',
    summary:'라벨이 공개되지 않은 상황에서 강원 전주 138만 개를 대상으로 발화원과 연소조건을 분리해 위험을 계산한 공간 분석 프로젝트입니다.',
    role:'공공데이터 수집, QGIS 공간조인, IDW 보간, 발화원 조사와 논문 리서치를 담당했습니다.',
    decision:'단일 분류모델 대신 설명 가능한 「발화원 × 연소조건」 곱 구조를 택하고, 한전 정전통계와 산림청 DWI로 각 축의 근거를 만들었습니다.',
    result:'8종 이상의 데이터를 융합해 위험구역 20.8만 개를 도출하고 실화재 664건과 낙뢰 데이터로 외부 검증했습니다.'}
};
const caseAssets = {
  ax: {image:'assets/ax-dashboard.webp', caption:'LG DX School AX HR 대시보드 발표 화면', links:[['AX 발표자료 PDF','../LG DX SCHOOL/ax-presentation.pdf']]},
  bx: {image:'assets/bx-family-care.webp', caption:'LG DX School BX ThinQ 가족 케어 서비스 발표 화면', links:[['BX 발표자료 PDF','../LG DX SCHOOL/bx-presentation.pdf']]},
  cx: {image:'assets/cx-arte-mis.webp', caption:'LG DX School CX ARTE-MIS 발표 표지', links:[['CX 결과 이미지','../LG DX SCHOOL/CX.jpg']]},
  sentinel: {image:'assets/dx-sentinel-demo.webp', caption:'ThinQ Workspace Sentinel 통합 시연 화면', links:[['시스템 아키텍처','../LG DX SCHOOL/dx-architecture-flow.png'],['GitHub 저장소','https://github.com/zln02/thinq-workspace-sentinel'],['내 기여 PR','https://github.com/zln02/thinq-workspace-sentinel/pulls?q=is%3Apr+author%3AParkjin0821']]},
  gyeotnun: {image:'assets/gyeotnun.webp', caption:'곁눈 서비스 폼보드 · 팀 제출 자료', links:[['최종 기획서 PDF','../KDT 해커톤/web/gyeotnun-proposal-final.pdf'],['내 데이터 분석 리포트','reports/gyeotnun-data-report.html'],['아이디어상 수상','../KDT 해커톤/web/kdt-award-idea.png']]},
  ailagro: {image:'assets/ailagro.webp', caption:'AILAGro 발표자료 표지 · 팀 카페인(CAFE-IN)', links:[['기획서 PDF (15p)','../공모전/ailagro-proposal.pdf'],['발표자료 PDF (21p)','../공모전/ailagro-presentation.pdf']]},
  futurecar: {image:'assets/futurecar.webp', caption:'미래차 AX 추천 플랫폼 소개 자료', links:[['팀 1차 MVP 라이브 데모 (비교 참고용)','https://futurecar-ax-rag.vercel.app/'],['GitHub','https://github.com/Parkjin0821']]},
  weather: {image:'assets/weather.webp', caption:'QGIS 전력설비 위험도 분석 지도', links:[['분석 보고서 PDF','../공모전/weather-report.pdf'],['분석 코드 R','../공모전/260356_program_code.R']]}
};

/* ---------- Elements ---------- */
const root = document.documentElement;
const bar = document.querySelector('.bar');
const barPath = document.getElementById('barPath');
const barClock = document.getElementById('barClock');
const track = document.querySelector('.track');
const scenes = [...document.querySelectorAll('.scene')];
const navLinks = [...document.querySelectorAll('.bar-nav a')];
const deskBg = document.querySelector('.desk-bg');
const deskVeil = document.querySelector('.desk-veil');

/* ---------- Desktop icons: the same column in every desktop scene ---------- */
const ICONS = [
  {go:2, label:'about', icon:'ph-user', kind:'app'},
  {go:3, label:'skills', icon:'ph-terminal-window', kind:'term'},
  {go:4, label:'LG DX School', icon:'ph-folder-simple', kind:'folder'},
  {go:5, label:'공모전', icon:'ph-trophy', kind:'folder'},
  {go:6, label:'연락처', icon:'ph-envelope-simple', kind:'mail'}
];
document.querySelectorAll('[data-icons]').forEach(column => {
  const here = Number(column.closest('.scene').dataset.scene);
  ICONS.forEach(item => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'icon'; b.dataset.go = item.go; b.dataset.kind = item.kind;
    if (item.go === here) b.classList.add('is-here');
    b.setAttribute('aria-label', `${item.label} 열기`);
    b.innerHTML = `<span class="icon-tile"><i class="ph-fill ${item.icon}"></i></span><span class="icon-label">${item.label}</span>`;
    column.append(b);
  });
});

/* ---------- Timeline (in viewport heights) ----------
   hold[i]: how long scene i rests; trans[i]: the dive from scene i to i+1. */
const HOLD  = [.12, .3, .3, .3, .3, .3, .3];
const TRANS = [1.35, 1.1, 1.1, 1.1, 1.1, 1.35];
// Portals: outer scene, the element in it you dive into, inner scene, the element you land on.
// 'screen' lands on the whole inner viewport; 'icon' grows into a window. The last one reverses.
const PAIRS = [
  {outer:0, inner:1, portal:'#hero [data-portal]', landing:null, kind:'screen'},
  {outer:1, inner:2, portal:'#desktop .icon[data-go="2"] .icon-tile', landing:'#about [data-landing]', kind:'icon'},
  {outer:2, inner:3, portal:'#about .icon[data-go="3"] .icon-tile', landing:'#skills [data-landing]', kind:'icon'},
  {outer:3, inner:4, portal:'#skills .icon[data-go="4"] .icon-tile', landing:'#projects [data-landing]', kind:'icon'},
  {outer:4, inner:5, portal:'#projects .icon[data-go="5"] .icon-tile', landing:'#competitions [data-landing]', kind:'icon'},
  {outer:6, inner:5, portal:'#contact [data-portal]', landing:null, kind:'screen', reverse:true}
];
let W = innerWidth, H = innerHeight, dive = false;
let holdStart = [], holdEnd = [], snapAt = [], rects = [];
let shown = 0, target = 0, lastFrame = 0, arrived = -1;
let booted = false, bootFade = 0, offT = 0;

// The dive is scrubbed by the visitor's own scroll, so it stays on under reduced motion (many Windows
// PCs report "reduce" simply because animation effects are off); only looping decoration is dropped.
function wantsDive(){ return innerWidth >= 1024 && innerHeight >= 640; }

function buildTimeline(){
  let y = 0; holdStart = []; holdEnd = []; snapAt = [];
  HOLD.forEach((h, i) => {
    holdStart[i] = y; y += h * H; holdEnd[i] = y;
    snapAt[i] = i === 0 ? 0 : Math.round((holdStart[i] + holdEnd[i]) / 2);
    if (i < TRANS.length) y += TRANS[i] * H;
  });
  track.style.height = `${Math.round(snapAt.at(-1) + H)}px`;
}

/* Settling. CSS mandatory snap is not used: with chapters more than two screens apart, Chrome
   snaps a small wheel move straight back. Instead, when scrolling stops inside a dive, finish the
   dive in the direction the visitor was going (or fall back if they barely started it). */
let lastY = 0, lastDir = 0, settleTimer = 0;
function onScroll(){
  if (!dive) return;
  const y = scrollY;
  if (y !== lastY) lastDir = Math.sign(y - lastY);
  lastY = y;
  clearTimeout(settleTimer);
  settleTimer = setTimeout(settle, 170);
}
function settle(){
  const at = locate(scrollY);
  if (tween || at.hold !== undefined || look.open) return;
  const i = at.pair;
  const next = lastDir >= 0 ? (at.t > .045 ? i + 1 : i) : (at.t < .955 ? i : i + 1);
  scrollTo({top:snapAt[next], behavior:'smooth'});
}
addEventListener('scroll', onScroll, {passive:true});

// Every element the dive moves. Scenes, the shared wallpaper and tint, and the parts of each desktop
// scene that are not its landing window (icon column, side windows, widgets): those fade in on arrival.
/* Desktop scenes fade part by part (each child is its own GPU layer), never as a whole: group
   opacity on a scene with several layers forces a full-viewport offscreen surface to be allocated
   the moment the fade starts, which was the one slow frame left in each dive. The lowest opacity is
   0.001, not 0, so the parts stay rasterised and appearing never costs a first paint. */
const GHOST = '0.001';
scenes.forEach(s => {
  s.__kids = s.classList.contains('scene--desk') ? [...s.children] : [];
  s.__rest = s.__kids.filter(c => !c.matches('[data-landing]'));
});
const layers = [...scenes, deskBg, deskVeil, ...scenes.flatMap(s => s.__kids)];
const fade = v => (v <= .001 ? GHOST : String(+v.toFixed(4)));
const veilOf = s => s.classList.contains('scene--desk') && !s.classList.contains('scene--home') ? 1 : 0;

// Measure every portal and landing with the scenes at rest.
let measureVersion = 0;
function measure(){
  document.querySelector('#contact .laptop').classList.remove('is-off', 'is-closed');  // the portal is the open screen
  layers.forEach(el => { el.style.transform = 'none'; el.style.clipPath = 'none'; el.style.opacity = ''; el.__st = null; });
  scenes.forEach(s => s.classList.add('is-on'));
  const box = el => { const r = el.getBoundingClientRect(); return {x:r.left, y:r.top, w:r.width, h:r.height, cx:r.left + r.width/2, cy:r.top + r.height/2}; };
  const screenRadius = el => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  rects = PAIRS.map(p => {
    const portalEl = document.querySelector(p.portal);
    const P = box(portalEl);
    const L = p.landing ? box(document.querySelector(p.landing)) : {x:0, y:0, w:W, h:H, cx:W/2, cy:H/2};
    return {P, L, radius: p.kind === 'screen' ? screenRadius(portalEl) : 16};
  });
  scenes.forEach(s => s.classList.remove('is-on'));
  measureVersion++;
}

const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Where we are: a resting scene, or a dive between two scenes with local progress t.
function locate(y){
  for (let i = 0; i < HOLD.length; i++){
    if (y <= holdEnd[i]) return {hold:i};
    if (i < TRANS.length && y < holdStart[i + 1]) return {pair:i, t:(y - holdEnd[i]) / (holdStart[i + 1] - holdEnd[i])};
  }
  return {hold:HOLD.length - 1};
}

/* Styles are planned for every layer each frame, then only the ones that changed are written.
   During a dive only transform and opacity change, never clip-path: clip changes repaint a whole
   scene (photos, shadows) on the main thread every frame, while transform/opacity stay on the GPU. */
let plan = new Map();
const DEFAULTS = {transform:'none', clipPath:'none', opacity:'', zIndex:''};
const S = el => { if (!plan.has(el)) plan.set(el, {...DEFAULTS}); return plan.get(el); };
function commit(el){
  const want = plan.get(el) || DEFAULTS, had = el.__st || (el.__st = {});
  for (const k in want){ if (had[k] !== want[k]){ had[k] = want[k]; el.style[k] = want[k]; } }
}
const T = (tx, ty, sc) => `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${sc.toFixed(5)})`;

/* The zoom. Inner scene point x goes to c + (σ/s)(x − L.c), with σ = s^e and the centre c sliding
   from the portal centre to the landing centre in step with σ: at e=0 the landing sits exactly on
   the portal, at e=1 the inner scene is untouched.
   'screen': the desktop, wallpaper and tint fill the laptop screen. s is a cover fit, so a viewport
   of any shape fills the 16:10 screen; the clip is the screen rectangle in the inner scene's own
   coordinates, which is constant for the whole dive (set once, never animated).
   'icon': a window grows out of the icon with no clip at all; the rest of the inner scene fades in
   late, the outer desktop zooms gently (σ^0.3) and fades, and the wallpaper never moves. */
function zoom(pairIndex, t, opts = {}){
  const p = PAIRS[pairIndex], {P, L, radius} = rects[pairIndex];
  const outer = scenes[p.outer], inner = scenes[p.inner];
  const e = easeInOut(clamp01(t));
  // Screen dives fit the viewport's width into the screen and pin the tops together, so the desktop
  // inside the laptop is laid out exactly as it is once you are in (widgets top-left, icons
  // top-right); any extra screen height below is wallpaper. Icon dives pin centre to centre.
  const screen = p.kind === 'screen', s = L.w / P.w;
  const pa = {x:P.cx, y: screen ? P.y : P.cy}, la = {x:L.cx, y: screen ? L.y : L.cy};
  const sigma = Math.pow(s, e), k = Math.abs(s - 1) < 1e-4 ? e : (sigma - 1) / (s - 1);
  const cx = pa.x + (la.x - pa.x) * k, cy = pa.y + (la.y - pa.y) * k, si = sigma / s;
  const innerT = e >= 1 ? 'none' : T(cx - si * la.x, cy - si * la.y, si);

  if (p.kind === 'screen'){
    S(outer).transform = e <= 0 ? 'none' : T(cx - sigma * pa.x, cy - sigma * pa.y, sigma);
    // The screen in the inner scene's coordinates: full width, from the top, P.h*s tall. On a viewport
    // narrower than 16:10 that stops short of the bottom, so the last 20% of the dive opens it fully.
    let bottom = H - (la.y + P.h * s);
    if (bottom > 0) bottom *= 1 - smooth(.8, 1, t);
    const clip = e >= 1 ? 'none' : `inset(${la.y.toFixed(1)}px 0px ${bottom.toFixed(1)}px 0px round ${(radius * s).toFixed(1)}px)`;
    const alpha = opts.innerAlpha ?? 1;
    for (const el of [inner, deskBg, deskVeil]) Object.assign(S(el), {transform:innerT, clipPath:clip, opacity:String(alpha)});
    S(deskVeil).opacity = String(alpha * veilOf(inner));
    S(outer).zIndex = '1'; S(deskBg).zIndex = '2'; S(deskVeil).zIndex = '2'; S(inner).zIndex = '3';
  } else {
    const so = Math.pow(sigma, .3);
    Object.assign(S(outer), {transform: e <= 0 ? 'none' : T(cx - so * P.cx, cy - so * P.cy, so), zIndex:'1'});
    Object.assign(S(inner), {transform:innerT, zIndex:'2'});
    const out = fade(1 - smooth(.3, .75, t)), rest = fade(smooth(.55, 1, t)), land = fade(smooth(0, .08, t));
    outer.__kids.forEach(el => { S(el).opacity = out; });
    inner.__kids.forEach(el => { S(el).opacity = el.matches('[data-landing]') ? land : rest; });
    const v = veilOf(outer) + (veilOf(inner) - veilOf(outer)) * smooth(.2, .8, t);
    S(deskVeil).opacity = String(v);
  }
}

let lastKey = '';
function render(y){
  const key = `${y.toFixed(1)}|${bootFade.toFixed(3)}|${offT.toFixed(3)}|${measureVersion}`;
  if (key === lastKey) return;
  lastKey = key;
  plan = new Map();
  const at = locate(y);
  const on = new Set(), live = new Set(), preview = new Set();
  let bgOn = false;
  if (at.hold !== undefined){
    const i = at.hold; on.add(i); live.add(i);
    if (scenes[i].classList.contains('scene--desk')){
      bgOn = true; S(deskVeil).opacity = String(veilOf(scenes[i]));
      for (const n of [i - 1, i + 1]){
        const sc = scenes[n];
        if (sc && sc.classList.contains('scene--desk')){ on.add(n); sc.__kids.forEach(el => { S(el).opacity = GHOST; }); }
      }
    }
    // At rest on the laptop, its screen already shows the live desktop.
    if (i === 0 && booted){ zoom(0, 0, {innerAlpha:bootFade}); on.add(1); preview.add(1); bgOn = true; }
    // At the end, the last window sits in the screen and the screen powers off.
    if (i === HOLD.length - 1){ const last = PAIRS.length - 1; zoom(last, 0, {innerAlpha: leavingEnd ? 0 : 1 - smooth(.25, .55, offT)}); on.add(PAIRS[last].inner); preview.add(PAIRS[last].inner); bgOn = true; }
  } else {
    const p = PAIRS[at.pair], t = p.reverse ? 1 - at.t : at.t;
    const alpha = at.pair === 0 ? Math.max(bootFade, smooth(0, .08, t)) : (p.reverse && leavingEnd ? 1 - smooth(.88, 1, at.t) : 1);
    zoom(at.pair, t, {innerAlpha: alpha});
    on.add(p.outer); on.add(p.inner); bgOn = true;
    // Hand over interaction only near the ends of a dive.
    if (at.t < .04) live.add(p.reverse ? p.inner : p.outer);
    if (at.t > .96) live.add(p.reverse ? p.outer : p.inner);
  }
  layers.forEach(commit);
  deskBg.classList.toggle('is-on', bgOn);
  deskVeil.classList.toggle('is-on', bgOn);
  scenes.forEach((s, i) => {
    s.classList.toggle('is-on', on.has(i));
    s.classList.toggle('is-live', live.has(i));
    s.classList.toggle('is-preview', preview.has(i));
    if (s.inert !== !live.has(i)) s.inert = !live.has(i);
  });

  // Which chapter "owns" the moment: drives the menu bar, the nav and arrival animations.
  const owner = at.hold !== undefined ? at.hold : (at.t < .5 ? at.pair : at.pair + 1);
  setOwner(owner, at.hold !== undefined);
}

let ownerNow = -1;
function setOwner(i, resting){
  if (i !== ownerNow){
    ownerNow = i;
    bar.classList.toggle('is-inside', !!scenes[i].dataset.path);
    barPath.textContent = scenes[i].dataset.path || '~/';
    navLinks.forEach(a => a.classList.toggle('is-on', Number(a.dataset.go) === i));
  }
  if (resting && arrived !== i){ arrive(i); }
  if (!resting && arrived !== -1 && arrived !== i){ scenes[arrived]?.classList.remove('is-arrived'); arrived = -1; }
}

function arrive(i){
  if (arrived >= 0) scenes[arrived].classList.remove('is-arrived');
  arrived = i;
  const s = scenes[i];
  void s.offsetWidth; // restart the arrival animations
  s.classList.add('is-arrived');
  if (s.id === 'skills') typeOnce();
  if (s.id === 'competitions') runCounts(document.querySelector('.case.is-active'));
  if (i === HOLD.length - 1) offT = 0;
}

/* ---------- Frame loop: smooths the scroll position so dives ease rather than step ---------- */
const endLaptop = document.querySelector('#contact .laptop');
function frame(now){
  const dt = Math.min(50, now - (lastFrame || now)); lastFrame = now;
  if (dive){
    if (tween){
      // The dive plays on its own value; the document scroll is set once, at the end. Scrolling the
      // page on every frame made each frame wait for the compositor to commit the previous one.
      const p = clamp01((now - tween.start) / tween.ms);
      shown = target = tween.from + (tween.to - tween.from) * easeInOut(p);
      if (p >= 1){ tween = null; leavingEnd = false; scrollTo(0, target); lastY = scrollY; }
    } else {
      target = scrollY;
      shown += (target - shown) * (1 - Math.exp(-dt / 70));
    }
    if (Math.abs(target - shown) < .5) shown = target;
    if (booted && bootFade < 1) bootFade = Math.min(1, bootFade + dt / 600);
    const atEnd = locate(shown).hold === HOLD.length - 1 && !leavingEnd;
    offT = atEnd ? Math.min(1, offT + dt / 1600) : 0;
    endLaptop.classList.toggle('is-off', atEnd && offT > .45);
    endLaptop.classList.toggle('is-closed', atEnd && offT > .58);
    render(shown);
  }
  requestAnimationFrame(frame);
}

/* ---------- Mode switching ---------- */
function setMode(){
  W = innerWidth; H = innerHeight;
  const next = wantsDive();
  if (next !== dive){
    dive = next;
    root.classList.toggle('dive', dive);
    if (!dive){
      layers.forEach(el => { el.removeAttribute('style'); el.__st = null; });
      scenes.forEach(s => { s.inert = false; s.classList.remove('is-on','is-live','is-preview'); });
      track.style.height = '';
      bar.classList.remove('is-inside'); ownerNow = -1;
    }
  }
  if (dive){ buildTimeline(); measure(); shown = target = scrollY; lastKey = ''; render(shown); }
}

/* ---------- Navigation ---------- */
/* Scene-by-scene navigation. One wheel notch, trackpad swipe or arrow key plays one whole dive as a
   single eased motion. Following each notch and finishing only after an idle pause read as lag
   (move, stall, move). Input arriving during a dive, trackpad momentum included, is absorbed:
   one gesture, one dive. Dragging the scrollbar still scrubs freely (settle() finishes it). */
let tween = null, lastWheelAt = 0;
const DIVE_MS = 900;
let leavingEnd = false;
function animateTo(y, ms){
  // From a closed laptop, the lid reopens (0.3s, CSS) before the dive back in starts.
  const closed = endLaptop.classList.contains('is-closed');
  leavingEnd = locate(shown).hold === HOLD.length - 1 && y < shown;
  tween = {from:shown, to:y, start:performance.now() + (closed && leavingEnd ? 320 : 0), ms};
}
function sceneAt(y, dir){ const at = locate(y); return at.hold !== undefined ? at.hold : (dir > 0 ? at.pair : at.pair + 1); }
function stepScene(dir){
  const cur = sceneAt(shown, dir), next = Math.max(0, Math.min(HOLD.length - 1, cur + dir));
  if (next !== cur || locate(shown).hold === undefined) animateTo(snapAt[next], DIVE_MS);
}
addEventListener('wheel', e => {
  if (!dive || look.open || e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  e.preventDefault();
  const now = performance.now(), gap = now - lastWheelAt; lastWheelAt = now;
  if (tween || gap < 160) return;
  stepScene(Math.sign(e.deltaY));
}, {passive:false});
addEventListener('keydown', e => {
  if (!dive || look.open || e.altKey || e.ctrlKey || e.metaKey) return;
  const el = e.target;
  if (el.closest && el.closest('input,textarea,select,[contenteditable],.vtab')) return;
  if (e.key === ' ' && el.closest && el.closest('button,a')) return;
  if (e.key === 'Home' || e.key === 'End'){ e.preventDefault(); animateTo(e.key === 'Home' ? 0 : snapAt.at(-1), DIVE_MS * 1.8); return; }
  const dir = {ArrowDown:1, PageDown:1, ArrowUp:-1, PageUp:-1}[e.key] ?? (e.key === ' ' ? (e.shiftKey ? -1 : 1) : 0);
  if (!dir) return;
  e.preventDefault();
  if (!tween) stepScene(dir);
});
function go(i){
  if (dive){ const from = sceneAt(shown, 1); animateTo(snapAt[i], DIVE_MS * Math.min(2.2, 1 + Math.abs(i - from) * .3)); }
  else scenes[i].scrollIntoView({behavior:'smooth'});
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-go]'); if (!el) return;
  e.preventDefault(); go(Number(el.dataset.go));
});

/* ---------- Boot ---------- */
root.classList.add('is-booting');
setTimeout(() => { booted = true; root.classList.add('is-booted'); root.classList.remove('is-booting'); if (dive) measure(); }, 1650);

/* ---------- Terminal typing ---------- */
let typed = false;
function typeOnce(){
  if (typed) return; typed = true;
  const el = document.querySelector('.type'), text = el.dataset.type;
  let n = 0; const timer = setInterval(() => { el.textContent = text.slice(0, ++n); if (n >= text.length) clearInterval(timer); }, 55);
}

/* ---------- Counters ---------- */
function runCounts(scope){
  if (!scope) return;
  scope.querySelectorAll('.count').forEach(el => {
    const value = Number(el.dataset.count), dec = Number(el.dataset.decimal || 0), start = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - start) / 1100), v = value * (1 - Math.pow(1 - p, 4));
      el.textContent = dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* ---------- Competitions viewer ---------- */
const cases = [...document.querySelectorAll('.case')];
const tabs = document.querySelector('.viewer-tabs');
function selectCase(index, focus){
  cases.forEach((c, i) => { const on = i === index; c.hidden = !on; c.classList.toggle('is-active', on); });
  [...tabs.children].forEach((b, i) => { const on = i === index; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('casePage').textContent = `${pad(index + 1)} / ${pad(cases.length)}`;
  document.getElementById('caseFoot').textContent = cases[index].querySelector('.case-label').textContent;
  runCounts(cases[index]);
}
cases.forEach((c, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'vtab'; b.setAttribute('role', 'tab');
  b.setAttribute('aria-label', `${String(i + 1).padStart(2, '0')} ${c.querySelector('h3').textContent}`);
  b.append(c.querySelector('.case-art img').cloneNode());
  const n = document.createElement('span'); n.textContent = String(i + 1).padStart(2, '0'); b.append(n);
  b.addEventListener('click', () => selectCase(i));
  b.addEventListener('keydown', e => {
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const d = ['ArrowDown','ArrowRight'].includes(e.key) ? 1 : -1;
    selectCase((i + d + cases.length) % cases.length, true);
  });
  tabs.append(b);
});
selectCase(0);

/* ---------- Project page ----------
   Opening a project grows a document window out of the card that was clicked (FLIP on the dialog
   box), and closing shrinks it back into that card. */
const look = document.getElementById('look');
let lookFrom = null;
function rectOf(el){ const r = el.getBoundingClientRect(); return {x:r.left, y:r.top, w:r.width, h:r.height}; }
function lookFlip(from, reverse){
  const to = rectOf(look);
  const k = `translate(${from.x - to.x}px,${from.y - to.y}px) scale(${from.w / to.w},${from.h / to.h})`;
  const frames = reverse ? [{transform:'none', opacity:1}, {transform:k, opacity:.2}] : [{transform:k, opacity:.25}, {transform:'none', opacity:1}];
  return look.animate(frames, {duration: reverse ? 240 : 380, easing: 'cubic-bezier(.22,1,.36,1)'});
}
function openLook(key, source){
  const p = projectData[key], a = caseAssets[key]; if (!p) return;
  document.getElementById('lookFile').textContent = p.file;
  document.getElementById('lookLabel').textContent = p.label;
  document.getElementById('lookTitle').textContent = p.title;
  document.getElementById('lookSummary').textContent = p.summary;
  document.getElementById('lookRole').textContent = p.role;
  document.getElementById('lookDecision').textContent = p.decision;
  document.getElementById('lookResult').textContent = p.result;
  document.getElementById('lookFoot').textContent = p.label;
  const img = document.getElementById('lookImage'); img.src = a.image; img.alt = a.caption;
  document.getElementById('lookCaption').textContent = a.caption;
  const links = document.getElementById('lookLinks'); links.replaceChildren();
  a.links.forEach(([label, url]) => {
    const l = document.createElement('a'); l.href = url; l.target = '_blank'; l.rel = 'noopener';
    l.innerHTML = `${label} <i class="ph ph-arrow-up-right"></i>`; links.append(l);
  });
  lookFrom = source || null;
  look.showModal(); document.body.classList.add('has-look');
  look.querySelector('.look-scroll').scrollTop = 0;
  if (lookFrom) lookFlip(rectOf(lookFrom));
}
let closing = false;
function closeLook(){
  if (!look.open || closing) return;
  if (!lookFrom){ look.close(); return; }
  closing = true;
  lookFlip(rectOf(lookFrom), true).finished.finally(() => { closing = false; look.close(); });
}
document.querySelectorAll('.file[data-project]').forEach(b => b.addEventListener('click', () => openLook(b.dataset.project, b.querySelector('.file-art') || b)));
document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openLook(b.dataset.open, b.closest('.case')?.querySelector('.case-art') || b)));
look.querySelector('.look-close').addEventListener('click', closeLook);
look.addEventListener('cancel', e => { e.preventDefault(); closeLook(); });
look.addEventListener('close', () => document.body.classList.remove('has-look'));
look.addEventListener('click', e => { if (e.target === look){ const r = look.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeLook(); } });

/* ---------- Menu bar clock ---------- */
const clock = () => {
  const now = new Date(), time = now.toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit', hour12:false});
  barClock.textContent = time;
  document.getElementById('widgetTime').textContent = time;
  document.getElementById('widgetDate').textContent = now.toLocaleDateString('ko-KR', {month:'long', day:'numeric', weekday:'long'});
};
clock(); setInterval(clock, 20000);

/* ---------- Flow mode reveals ---------- */
const revealTargets = document.querySelectorAll('.scene--desk .win, .contact-copy, .scene--contact .laptop');
revealTargets.forEach(el => el.classList.add('reveal'));
const io = new IntersectionObserver(entries => entries.forEach(en => {
  if (!en.isIntersecting) return;
  en.target.classList.add('is-in');
  if (!dive){
    if (en.target.closest('#skills')) typeOnce();
    if (en.target.closest('#competitions')) runCounts(document.querySelector('.case.is-active'));
  }
  io.unobserve(en.target);
}), {threshold:.18});
revealTargets.forEach(el => io.observe(el));

/* ---------- Decode every image up front so no dive stalls on a first decode ---------- */
addEventListener('load', () => document.querySelectorAll('img').forEach(img => img.decode?.().catch(() => {})));

/* ---------- Start ---------- */
let resizeTimer = 0;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(setMode, 120); });
if (document.fonts) document.fonts.ready.then(() => { if (dive) measure(); });
addEventListener('load', () => { if (dive) measure(); });
setMode();
requestAnimationFrame(frame);
// Deep links (#projects …) point at fixed scenes in dive mode, so translate them to scroll positions.
const startAt = scenes.findIndex(s => '#' + s.id === location.hash);
if (startAt > 0) requestAnimationFrame(() => { if (dive){ scrollTo(0, snapAt[startAt]); shown = target = snapAt[startAt]; } else scenes[startAt].scrollIntoView(); });
