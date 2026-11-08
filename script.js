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
let editing = false;
let currentClass = "8-3";

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function names(list) {
  return list && list.length ? list.map(esc).join(", ") : '<span class="empty">없음</span>';
}
function field(slot, list) {
  return `<input class="absent-input" data-slot="${slot}" value="${esc((list || []).join(", "))}" placeholder="이름을 쉼표(,)로 구분" aria-label="결석생 이름">`;
}

function renderSchedule(cls) {
  const body = document.getElementById("schedule-body");
  if (!body) return;
  currentClass = cls;
  const s = SCHEDULE[cls];
  const a = ABSENT[cls] || {};
  const cell = (slot) => (editing ? field(slot, a[slot]) : names(a[slot]));
  const rows = [
    ["", "수업 1", `${s.lessons[0]} ${s.day}`, "4단계 익히기, 올덴버그로 연습", cell("lesson1"), "공유 자료로 자율 학습"],
    ["", "수업 2", `${s.lessons[1]} ${s.day}`, "백남준으로 연습, 출제 작품 공부", cell("lesson2"), "공유 자료로 자율 학습"],
  ];
  if (s.off) rows.push(["off", "휴무", `${s.off} ${s.day}`, "학교 휴무일이라 수업이 없습니다", "", ""]);
  rows.push(["exam", "수행평가", `${s.exam} ${s.day}`, "감상문 쓰기 (제비뽑기)", cell("exam"), "평가 결석생은 점심시간 응시"]);
  rows.push(["makeup", "추가 응시", "추후 점심시간", "평가 결석생 개별 제비뽑기로 응시", names(a.exam), "선생님이 날짜 안내"]);

  const labels = ["", "날짜", "수업", "결석생", "보충"];
  body.innerHTML = rows
    .map(([rowCls, ...cells]) =>
      `<tr class="${rowCls}">${cells
        .map((c, i) => `<td${i && c ? ` data-label="${labels[i]}"` : ""}>${c}</td>`)
        .join("")}</tr>`)
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
  if (!res.ok) throw new Error(`supabase ${res.status}`);
  return res.json();
}

// 저장소 공통 창구: { ok, error, data } 모양으로 돌려줍니다.
const store = {
  async load() {
    if (!SUPABASE_URL) return (await callSheet()).data || {};
    const rows = await supa("absences?select=cls,slot,names");
    const data = {};
    rows.forEach((r) => ((data[r.cls] = data[r.cls] || {})[r.slot] = r.names || []));
    return data;
  },
  async check(password) {
    if (!SUPABASE_URL) return callSheet({ action: "check", password });
    return supa("rpc/check_teacher", { pw: password });
  },
  async save(password, cls, absent) {
    if (!SUPABASE_URL) return callSheet({ action: "save", password, cls, absent });
    const r = await supa("rpc/save_absences", { pw: password, p_cls: cls, p_absent: absent });
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

  function setEditing(on) {
    editing = on;
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

  document.getElementById("cancel-absent").addEventListener("click", () => { setEditing(false); say(""); });
  document.getElementById("save-absent").addEventListener("click", async () => {
    const absent = {};
    document.querySelectorAll(".absent-input").forEach((i) => {
      absent[i.dataset.slot] = i.value.split(",").map((n) => n.trim()).filter(Boolean);
    });
    say("저장하는 중…");
    try {
      const r = await store.save(sessionStorage.getItem("absentPw"), currentClass, absent);
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
