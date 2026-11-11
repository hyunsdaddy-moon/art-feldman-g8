// 학년별 반 일정 — 페이지의 <body data-grade="9">로 학년을 고릅니다(없으면 8학년).
const GRADES = {
  8: {
    first: "8-3",
    lessons: ["4단계 익히기, 올덴버그로 연습", "백남준으로 연습, 출제 작품 공부"],
    exam: "감상문 쓰기 (제비뽑기)",
    makeup: "평가 결석생 개별 제비뽑기로 응시",
    classes: {
      "8-1": { lessons: ["11월 11일 수", "11월 18일 수"], exam: "11월 25일 수" },
      "8-2": { lessons: ["11월 12일 목", "11월 19일 목"], exam: "11월 26일 목" },
      "8-3": { lessons: ["11월 10일 화", "11월 17일 화"], off: "11월 24일 화", exam: "12월 1일 화" },
      "8-4": { lessons: ["11월 16일 월", "11월 23일 월"], exam: "11월 30일 월" },
      "8-5": { lessons: ["11월 12일 목", "11월 19일 목"], exam: "11월 26일 목" },
    },
  },
  // 8학년 화론육법 — 반과 날짜는 8학년(펠드먼)과 같고, 결석생 기록도 함께 씁니다.
  "8h": {
    first: "8-3",
    lessons: ["화론육법 익히기, 윤두서 「자화상」 영상 보고 김홍도 「씨름」 써 보기", "신윤복 「단오풍정」 감상문 써 보기"],
    exam: "감상문 쓰기 (제비뽑기)",
    makeup: "평가 결석생 개별 제비뽑기로 응시",
    classes: null, // 아래에서 8학년 반 일정을 그대로 씁니다
  },
  9: {
    first: "9-5",
    lessons: ["4가지 관점 익히기, 론 뮤익 「소년」 써 보기", "고흐 「별이 빛나는 밤」 써 보기", "백남준 「TV 부처」 써 보기"],
    exam: "감상문 쓰기 (제비뽑기)",
    makeup: "평가 결석생 개별 제비뽑기로 응시",
    classes: {
      "9-1": { lessons: ["11월 9일 월", "11월 11일 수", "11월 16일 월"], exam: "11월 18일 수" },
      "9-2": { lessons: ["11월 9일 월", "11월 13일 금", "11월 16일 월"], exam: "11월 20일 금" },
      "9-3": { lessons: ["11월 13일 금", "11월 17일 화", "11월 20일 금"], off: "11월 24일 화", exam: "11월 27일 금" },
      "9-4": { lessons: ["11월 11일 수", "11월 13일 금", "11월 18일 수"], exam: "11월 20일 금" },
      "9-5": { lessons: ["11월 9일 월", "11월 11일 수", "11월 16일 월"], exam: "11월 18일 수" },
    },
  },
};
GRADES["8h"].classes = GRADES[8].classes;
// 반별 미술부장 — [1학기, 2학기]
const MONITORS = {
  "8-1": ["김은채", "정예성"], "8-2": ["유호린", "김지원"], "8-3": ["김예성", "김채이"], "8-4": ["김이룸", "석시우"], "8-5": ["박시현", "김지원"],
  "9-1": ["임상현", "김민준"], "9-2": ["김민준", "김민희"], "9-3": ["문선우", "차유나"], "9-4": ["박민호", "전익환"], "9-5": ["김지호", "이서우"],
};
const GRADE_NO = document.body.dataset.grade || "8";
const GRADE = GRADES[GRADE_NO];
const SCHEDULE = GRADE.classes;
const CLASS_KEY = GRADE_NO.startsWith("8") ? "myClass" : `myClass${GRADE_NO}`;

// 결석생 기록 저장소 — Supabase 주소와 공개 키(anon)를 넣으면 Supabase, 비어 있으면 구글 시트를 씁니다. 공개 키라 올려도 됩니다(쓰기는 비밀번호 함수로만).
const SUPABASE_URL = "https://axbgotxrdkaoavpyeofb.supabase.co";
const SUPABASE_KEY = "sb_publishable_m5zIAEEBiT5uYIGaix_LVQ_Voonpw1Y";
const SHEET_API = "https://script.google.com/macros/s/AKfycbzjCyl99vijnnGBfy2cmDAFUqKzoydR8gvpsoUPN8nxUsoOlhTQuZgNNjdTC0mMd4q4/exec";
const STORE_READY = Boolean(SUPABASE_URL || SHEET_API);
let ABSENT = {};
let EXTRA = {};     // 반별 { notes: { lesson1: "…" }, rows: [{ id, title, date, content, absent, makeup, note }] }
let EXTRA_READY = false; // Supabase 에 schedule_extra 표가 있으면 true
let editing = false;
let draft = null;   // 고치는 중인 { notes, rows }
let currentClass = GRADE.first;
const ROW_FIELDS = ["title", "date", "content", "absent", "makeup", "note"];
const ROW_HINTS = { title: "회차", date: "날짜", content: "수업 내용", absent: "결석생", makeup: "보충", note: "메모" };

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function names(list) {
  return list && list.length ? list.map(esc).join(", ") : '<span class="empty">없음</span>';
}
function field(slot, list) {
  return `<input class="absent-input" data-slot="${slot}" value="${esc((list || []).join(", "))}" placeholder="이름을 쉼표(,)로 구분" aria-label="결석생 이름">`;
}
function noteField(row, value) {
  return `<input class="absent-input note-input" data-row="${row}" value="${esc(value || "")}" placeholder="메모" aria-label="비고">`;
}
function rowField(id, key, value) {
  return `<input class="absent-input row-input" data-row="${id}" data-key="${key}" value="${esc(value || "")}" placeholder="${ROW_HINTS[key]}" aria-label="${ROW_HINTS[key]}">`;
}

function renderSchedule(cls) {
  const body = document.getElementById("schedule-body");
  if (!body) return;
  currentClass = cls;
  const s = SCHEDULE[cls];
  const a = ABSENT[cls] || {};
  const ex = editing ? draft : EXTRA[cls] || {};
  const notes = ex.notes || {};
  const cell = (slot) => (editing ? field(slot, a[slot]) : names(a[slot]));
  const note = (key) => (editing ? noteField(key, notes[key]) : esc(notes[key] || ""));
  const rows = s.lessons.map((date, i) =>
    ["", `수업 ${i + 1}`, date, GRADE.lessons[i], cell(`lesson${i + 1}`), "공유 자료로 자율 학습", note(`lesson${i + 1}`)]);
  if (s.off) rows.push(["off", "휴무", s.off, "학교 휴무일이라 수업이 없습니다", "", "", note("off")]);
  rows.push(["exam", "수행평가", s.exam, GRADE.exam, cell("exam"), "평가 결석생은 점심시간 응시", note("exam")]);
  rows.push(["makeup", "추가 응시", "추후 점심시간", GRADE.makeup, names(a.exam), "선생님이 날짜 안내", note("makeup")]);
  (ex.rows || []).forEach((r) => rows.push(["custom", ...ROW_FIELDS.map((k, i) =>
    editing
      ? (i === 0 ? `<button type="button" class="row-del" data-row="${r.id}" aria-label="이 행 지우기" title="행 지우기">✕</button>` : "") + rowField(r.id, k, r[k])
      : esc(r[k] || ""))]));

  const labels = ["", "날짜", "수업", "결석생", "보충", "비고"];
  body.innerHTML = rows
    .map(([rowCls, ...cells]) =>
      `<tr class="${rowCls}">${cells
        .map((c, i) => `<td${i && c ? ` data-label="${labels[i]}"` : ""}>${c}</td>`)
        .join("")}</tr>`)
    .join("");
  document.getElementById("class-title").textContent = `${cls}반`;
  const mon = document.getElementById("class-monitors");
  if (mon) {
    const m = MONITORS[cls];
    mon.innerHTML = m ? `<b>미술부장</b><span><em>1학기</em> ${esc(m[0])}</span><span><em>2학기</em> ${esc(m[1])}</span>` : "";
    mon.hidden = !m;
  }
  document.querySelectorAll(".class-switch button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.class === cls)));
}

async function callSheet(payload) {
  const res = await fetch(SHEET_API, payload ? { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) } : undefined);
  return res.json();
}

async function supa(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw Object.assign(new Error(`supabase ${res.status}`), { status: res.status });
  return res.json();
}

// 추가 행·비고 (schedule_extra 표가 없으면 조용히 건너뜀)
async function loadExtra() {
  try {
    const rows = await supa("schedule_extra?select=cls,data");
    EXTRA_READY = true;
    EXTRA = {};
    rows.forEach((r) => (EXTRA[r.cls] = { notes: r.data.notes || {}, rows: r.data.rows || [] }));
  } catch (e) {
    if (e.status !== 404) throw e;
  }
}

// 저장소 공통 창구: { ok, error, data } 모양으로 돌려줍니다.
const store = {
  async load() {
    if (!SUPABASE_URL) return (await callSheet()).data || {};
    const [rows] = await Promise.all([supa("absences?select=cls,slot,names"), loadExtra()]);
    const data = {};
    rows.forEach((r) => ((data[r.cls] = data[r.cls] || {})[r.slot] = r.names || []));
    return data;
  },
  async check(password) {
    if (!SUPABASE_URL) return callSheet({ action: "check", password });
    return supa("rpc/check_teacher", { pw: password });
  },
  async save(password, cls, absent, extra) {
    if (!SUPABASE_URL) return callSheet({ action: "save", password, cls, absent });
    let r;
    try {
      r = await supa("rpc/save_schedule", { pw: password, p_cls: cls, p_absent: absent, p_notes: extra.notes, p_rows: extra.rows });
    } catch (e) {
      if (e.status !== 404) throw e; // 03-행추가-비고.sql 실행 전: 결석생만 저장
      r = await supa("rpc/save_absences", { pw: password, p_cls: cls, p_absent: absent });
      if (r.ok) r.partial = true;
    }
    return r.ok ? { ok: true, partial: r.partial, data: await store.load() } : r;
  },
};

const sw = document.querySelector(".class-switch");
if (sw) {
  const saved = location.hash.slice(1) || localStorage.getItem(CLASS_KEY);
  renderSchedule(SCHEDULE[saved] ? saved : GRADE.first);
  sw.addEventListener("click", (e) => {
    const cls = e.target.dataset && e.target.dataset.class;
    if (!cls || editing) return;
    localStorage.setItem(CLASS_KEY, cls);
    history.replaceState(null, "", `#${cls}`);
    renderSchedule(cls);
  });

  const status = document.getElementById("absent-status");
  const editBtn = document.getElementById("edit-absent");
  const saveBar = document.getElementById("save-bar");
  const dialog = document.getElementById("pw-dialog");
  const pwInput = document.getElementById("pw-input");
  const pwMsg = document.getElementById("pw-msg");
  const say = (t) => (status.textContent = t);

  if (STORE_READY) {
    say("결석생 기록을 불러오는 중…");
    store.load().then((data) => { ABSENT = data; renderSchedule(currentClass); say(""); })
      .catch(() => say("결석생 기록을 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요."));
  }

  const table = document.querySelector(".schedule");
  const addRow = document.getElementById("add-row");

  // 화면의 입력칸 내용을 옮겨 둡니다(행을 넣고 뺄 때 다시 그려도 지워지지 않게).
  function collect() {
    if (!draft) return;
    document.querySelectorAll(".note-input").forEach((i) => (draft.notes[i.dataset.row] = i.value.trim()));
    document.querySelectorAll(".row-input").forEach((i) => {
      const r = draft.rows.find((r) => r.id === i.dataset.row);
      if (r) r[i.dataset.key] = i.value.trim();
    });
    const a = (ABSENT[currentClass] = ABSENT[currentClass] || {});
    document.querySelectorAll(".absent-input[data-slot]").forEach((i) => {
      a[i.dataset.slot] = i.value.split(",").map((n) => n.trim()).filter(Boolean);
    });
  }

  addRow.addEventListener("click", () => {
    collect();
    if (draft.rows.length >= 10) return say("행은 10개까지 추가할 수 있습니다.");
    const id = `r${Date.now().toString(36)}`;
    draft.rows.push({ id });
    renderSchedule(currentClass);
    document.querySelector(`.row-input[data-row="${id}"]`)?.focus();
  });
  table.addEventListener("click", (e) => {
    const btn = e.target.closest(".row-del");
    if (!btn) return;
    collect();
    const row = draft.rows.find((r) => r.id === btn.dataset.row);
    if (!row || !confirm(`'${row.title || "새 행"}' 행을 지울까요?`)) return;
    draft.rows = draft.rows.filter((r) => r !== row);
    renderSchedule(currentClass);
  });

  function setEditing(on) {
    editing = on;
    const ex = EXTRA[currentClass] || {};
    draft = on ? { notes: { ...ex.notes }, rows: (ex.rows || []).map((r) => ({ ...r })) } : null;
    addRow.hidden = !EXTRA_READY;
    saveBar.hidden = !on;
    editBtn.hidden = on;
    sw.classList.toggle("locked", on);
    renderSchedule(currentClass);
    if (on) document.querySelector(".absent-input")?.focus();
  }

  editBtn.addEventListener("click", () => {
    if (!STORE_READY) return say("아직 저장소가 연결되지 않았습니다. (script.js 위쪽 설정)");
    if (sessionStorage.getItem("absentPw")) return setEditing(true);
    pwInput.value = ""; pwMsg.textContent = "";
    dialog.showModal();
  });
  document.getElementById("pw-cancel").addEventListener("click", () => dialog.close());
  document.getElementById("pw-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    pwMsg.textContent = "확인 중…";
    try {
      const r = await store.check(pwInput.value);
      if (r.ok) { sessionStorage.setItem("absentPw", pwInput.value); dialog.close(); setEditing(true); }
      else pwMsg.textContent = r.error === "locked" ? "여러 번 틀려서 10분 동안 잠겼습니다." : "비밀번호가 맞지 않습니다.";
    } catch { pwMsg.textContent = "연결에 실패했습니다. 다시 시도해 주세요."; }
  });

  document.getElementById("cancel-absent").addEventListener("click", async () => {
    setEditing(false);
    say("되돌리는 중…");
    try { ABSENT = await store.load(); renderSchedule(currentClass); say(""); } catch { say(""); }
  });
  document.getElementById("save-absent").addEventListener("click", async () => {
    collect();
    const absent = ABSENT[currentClass] || {};
    say("저장하는 중…");
    try {
      const r = await store.save(sessionStorage.getItem("absentPw"), currentClass, absent, draft);
      if (r.ok) { ABSENT = r.data || ABSENT; setEditing(false); say(r.partial ? "결석생만 저장했습니다. 행·비고는 Supabase 설정(03-행추가-비고.sql)을 마친 뒤 저장됩니다." : `${currentClass}반 기록을 저장했습니다.`); }
      else {
        if (r.error === "wrong-password") sessionStorage.removeItem("absentPw");
        say(r.error === "locked" ? "여러 번 틀려서 10분 동안 잠겼습니다."
          : r.error === "bad-class" ? "이 반은 아직 저장할 수 없습니다. Supabase 설정(04-9학년.sql)을 먼저 실행해 주세요."
          : "저장하지 못했습니다. 비밀번호를 다시 입력해 주세요.");
      }
    } catch { say("저장하지 못했습니다. 인터넷 연결을 확인해 주세요."); }
  });
}

// ── 머리 그림: 자동 넘김(첫 화면) · 누르면 돋보기 ──
const art = document.querySelector(".hero-art");
if (art) {
  const slides = [...art.querySelectorAll(".hero-slide")];
  const loupe = art.querySelector(".loupe");
  const hint = art.querySelector(".hero-hint");
  const credit = document.querySelector(".credit");
  const dots = [...art.querySelectorAll(".hero-dots button")];
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ZOOM = 2.5;
  const natural = new Map();
  slides.forEach((s) => {
    const img = new Image();
    img.onload = () => natural.set(s, [img.naturalWidth, img.naturalHeight]);
    img.src = s.dataset.img;
  });

  let current = 0, hovering = false, timer = null;
  function show(i) {
    slides[current].classList.remove("is-active");
    current = (i + slides.length) % slides.length;
    const s = slides[current];
    s.classList.remove("is-active"); void s.offsetWidth; // 확대 애니메이션 처음부터
    s.classList.add("is-active");
    dots.forEach((d, k) => d.setAttribute("aria-current", String(k === current)));
    art.setAttribute("aria-label", s.dataset.credit);
    if (credit) credit.textContent = `배경: ${s.dataset.credit}`;
  }
  if (slides.length > 1) {
    dots.forEach((d, k) => d.addEventListener("click", (e) => { e.stopPropagation(); show(k); }));
    show(0);
    if (!calm) timer = setInterval(() => {
      if (!hovering && !art.classList.contains("is-loupe")) show(current + 1);
    }, 7000);
  }
  art.addEventListener("pointerenter", () => (hovering = true));
  art.addEventListener("pointerleave", () => { hovering = false; loupe.classList.remove("on"); });

  function moveLoupe(e) {
    const r = art.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const s = slides[current], size = natural.get(s);
    if (!size) return;
    const [iw, ih] = size;
    const k = Math.max(r.width / iw, r.height / ih);
    const dw = iw * k, dh = ih * k;
    const [px, py] = s.dataset.pos.split(" ").map((v) => parseFloat(v) / 100);
    const ix = (x - (r.width - dw) * px) / dw, iy = (y - (r.height - dh) * py) / dh;
    loupe.classList.add("on");
    const R = loupe.offsetWidth / 2;
    loupe.style.left = `${x - R}px`;
    loupe.style.top = `${y - R}px`;
    loupe.style.backgroundImage = `url('${s.dataset.img}')`;
    loupe.style.backgroundSize = `${dw * ZOOM}px ${dh * ZOOM}px`;
    loupe.style.backgroundPosition = `${-(ix * dw * ZOOM - R)}px ${-(iy * dh * ZOOM - R)}px`;
  }
  function setLoupe(on, e) {
    art.classList.toggle("is-loupe", on);
    hint.textContent = on ? "다시 누르면 돋보기 끄기" : "그림을 누르면 돋보기";
    if (on && e) moveLoupe(e); else loupe.classList.remove("on");
  }
  art.addEventListener("click", (e) => setLoupe(!art.classList.contains("is-loupe"), e));
  art.addEventListener("pointermove", (e) => { if (art.classList.contains("is-loupe")) moveLoupe(e); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setLoupe(false); });
}

// ── 꼬리말 방문 수: 한 브라우저는 하루(호치민 시간)에 한 번만 셉니다 (Supabase 05·06 SQL) ──
const visits = document.getElementById("visits");
if (visits && SUPABASE_URL) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  const counted = localStorage.getItem("visitDay") === today;
  supa("rpc/visit", { p_add: !counted })
    .then((r) => {
      localStorage.setItem("visitDay", today);
      visits.textContent = `방문  오늘 ${r.today.toLocaleString()}명 · 전체 ${r.total.toLocaleString()}명`;
      visits.hidden = false;
    })
    .catch(() => {});
}
