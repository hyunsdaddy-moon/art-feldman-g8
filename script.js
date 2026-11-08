// 반별 일정
const SCHEDULE = {
  "8-1": { day: "수", lessons: ["11월 11일", "11월 18일"], exam: "11월 25일" },
  "8-2": { day: "목", lessons: ["11월 12일", "11월 19일"], exam: "11월 26일" },
  "8-3": { day: "화", lessons: ["11월 10일", "11월 17일"], off: "11월 24일", exam: "12월 1일" },
  "8-4": { day: "월", lessons: ["11월 9일", "11월 16일"], exam: "11월 23일" },
  "8-5": { day: "목", lessons: ["11월 12일", "11월 19일"], exam: "11월 26일" },
};

// 결석생 기록 저장소 — Supabase 주소와 공개 키(anon)를 넣으면 Supabase, 비어 있으면 구글 시트를 씁니다. 공개 키라 올려도 됩니다(쓰기는 비밀번호 함수로만).
const SUPABASE_URL = "https://axbgotxrdkaoavpyeofb.supabase.co";
const SUPABASE_KEY = "sb_publishable_m5zIAEEBiT5uYIGaix_LVQ_Voonpw1Y";
const SHEET_API = "https://script.google.com/macros/s/AKfycbzjCyl99vijnnGBfy2cmDAFUqKzoydR8gvpsoUPN8nxUsoOlhTQuZgNNjdTC0mMd4q4/exec";
const STORE_READY = Boolean(SUPABASE_URL || SHEET_API);
let ABSENT = {};
let COLUMNS = [];   // 선생님이 추가한 열 [{ id, title }] — 모든 반 공통
let EXTRA = {};     // 반별 칸 내용 { "8-5": { lesson1: { c…: "…", note: "…" } } }
let EXTRA_READY = false; // Supabase 에 schedule_extra 표가 있으면 true
let editing = false;
let draft = null;   // 고치는 중인 { cols, cells }
let currentClass = "8-3";

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function names(list) {
  return list && list.length ? list.map(esc).join(", ") : '<span class="empty">없음</span>';
}
function field(slot, list) {
  return `<input class="absent-input" data-slot="${slot}" value="${esc((list || []).join(", "))}" placeholder="이름을 쉼표(,)로 구분" aria-label="결석생 이름">`;
}
function extraField(row, col, value, label) {
  return `<input class="absent-input extra-input" data-row="${row}" data-col="${col}" value="${esc(value || "")}" placeholder="${col === "note" ? "메모" : ""}" aria-label="${esc(label)}">`;
}

function renderSchedule(cls) {
  const body = document.getElementById("schedule-body");
  if (!body) return;
  currentClass = cls;
  const s = SCHEDULE[cls];
  const a = ABSENT[cls] || {};
  const cols = EXTRA_READY ? (editing ? draft.cols : COLUMNS) : [];
  const cells = editing ? draft.cells : EXTRA[cls] || {};
  const extraCols = EXTRA_READY ? [...cols, { id: "note", title: "비고" }] : [];
  const cell = (slot) => (editing ? field(slot, a[slot]) : names(a[slot]));
  const rows = [
    ["lesson1", "", "수업 1", `${s.lessons[0]} ${s.day}`, "4단계 익히기, 올덴버그로 연습", cell("lesson1"), "공유 자료로 자율 학습"],
    ["lesson2", "", "수업 2", `${s.lessons[1]} ${s.day}`, "백남준으로 연습, 출제 작품 공부", cell("lesson2"), "공유 자료로 자율 학습"],
  ];
  if (s.off) rows.push(["off", "off", "휴무", `${s.off} ${s.day}`, "학교 휴무일이라 수업이 없습니다", "", ""]);
  rows.push(["exam", "exam", "수행평가", `${s.exam} ${s.day}`, "감상문 쓰기 (제비뽑기)", cell("exam"), "평가 결석생은 점심시간 응시"]);
  rows.push(["makeup", "makeup", "추가 응시", "추후 점심시간", "평가 결석생 개별 제비뽑기로 응시", names(a.exam), "선생님이 날짜 안내"]);

  const head = ["회차", "날짜", "수업 내용", "결석생", "보충과 추가 응시"].map((t) => `<th>${t}</th>`);
  extraCols.forEach((c) => head.push(editing && c.id !== "note"
    ? `<th class="col-edit"><input class="col-title" data-col="${c.id}" value="${esc(c.title)}" maxlength="20" aria-label="열 이름"><button type="button" class="col-del" data-col="${c.id}" aria-label="${esc(c.title)} 열 지우기" title="열 지우기">✕</button></th>`
    : `<th>${esc(c.title)}</th>`));
  document.getElementById("schedule-head").innerHTML = `<tr>${head.join("")}</tr>`;

  const labels = ["", "날짜", "수업", "결석생", "보충", ...extraCols.map((c) => c.title)];
  body.innerHTML = rows
    .map(([key, rowCls, ...base]) => {
      const extra = extraCols.map((c) => {
        const v = (cells[key] || {})[c.id];
        return editing ? extraField(key, c.id, v, `${base[0]} ${c.title}`) : v ? esc(v) : "";
      });
      return `<tr class="${rowCls}">${[...base, ...extra]
        .map((c, i) => `<td${i && c ? ` data-label="${esc(labels[i])}"` : ""}>${c}</td>`)
        .join("")}</tr>`;
    })
    .join("");
  document.getElementById("class-title").textContent = `${cls}반`;
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

// 추가 열·비고 (02-표열-비고.sql 을 실행하기 전이면 조용히 건너뜀)
async function loadExtra() {
  try {
    const rows = await supa("schedule_extra?select=cls,data");
    EXTRA_READY = true;
    EXTRA = {};
    rows.forEach((r) => (r.cls === "_columns" ? (COLUMNS = r.data.columns || []) : (EXTRA[r.cls] = r.data.cells || {})));
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
    const r = EXTRA_READY
      ? await supa("rpc/save_schedule", { pw: password, p_cls: cls, p_absent: absent, p_columns: extra.cols, p_cells: extra.cells })
      : await supa("rpc/save_absences", { pw: password, p_cls: cls, p_absent: absent });
    return r.ok ? { ok: true, data: await store.load() } : r;
  },
};

const sw = document.querySelector(".class-switch");
if (sw) {
  const saved = location.hash.slice(1) || localStorage.getItem("myClass");
  renderSchedule(SCHEDULE[saved] ? saved : "8-3");
  sw.addEventListener("click", (e) => {
    const cls = e.target.dataset && e.target.dataset.class;
    if (!cls || editing) return;
    localStorage.setItem("myClass", cls);
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
  const addCol = document.getElementById("add-column");

  // 화면의 입력칸 내용을 draft 에 옮겨 둡니다(열을 넣고 뺄 때 다시 그려도 지워지지 않게).
  function collect() {
    if (!draft) return;
    document.querySelectorAll(".col-title").forEach((i) => {
      const c = draft.cols.find((c) => c.id === i.dataset.col);
      if (c) c.title = i.value.trim() || "새 열";
    });
    document.querySelectorAll(".extra-input").forEach((i) => {
      (draft.cells[i.dataset.row] = draft.cells[i.dataset.row] || {})[i.dataset.col] = i.value.trim();
    });
    const a = (ABSENT[currentClass] = ABSENT[currentClass] || {});
    document.querySelectorAll(".absent-input[data-slot]").forEach((i) => {
      a[i.dataset.slot] = i.value.split(",").map((n) => n.trim()).filter(Boolean);
    });
  }

  addCol.addEventListener("click", () => {
    collect();
    if (draft.cols.length >= 8) return say("열은 8개까지 추가할 수 있습니다.");
    const id = `c${Date.now().toString(36)}`;
    draft.cols.push({ id, title: "새 열" });
    renderSchedule(currentClass);
    const input = document.querySelector(`.col-title[data-col="${id}"]`);
    input?.focus(); input?.select();
  });
  table.addEventListener("click", (e) => {
    const btn = e.target.closest(".col-del");
    if (!btn) return;
    collect();
    const col = draft.cols.find((c) => c.id === btn.dataset.col);
    if (!col || !confirm(`'${col.title}' 열을 지울까요?\n저장하면 모든 반에서 이 열의 내용이 지워집니다.`)) return;
    draft.cols = draft.cols.filter((c) => c !== col);
    renderSchedule(currentClass);
  });

  function setEditing(on) {
    editing = on;
    draft = on ? { cols: COLUMNS.map((c) => ({ ...c })), cells: JSON.parse(JSON.stringify(EXTRA[currentClass] || {})) } : null;
    addCol.hidden = !EXTRA_READY;
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
      if (r.ok) { ABSENT = r.data || ABSENT; setEditing(false); say(`${currentClass}반 결석생 기록을 저장했습니다.`); }
      else {
        if (r.error === "wrong-password") sessionStorage.removeItem("absentPw");
        say(r.error === "locked" ? "여러 번 틀려서 10분 동안 잠겼습니다." : "저장하지 못했습니다. 비밀번호를 다시 입력해 주세요.");
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
