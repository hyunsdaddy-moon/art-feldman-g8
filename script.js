// 반별 일정 — 결석생 이름은 선생님이 absent 배열에 적습니다.
const SCHEDULE = {
  "8-1": { day: "수", lessons: ["11월 11일", "11월 18일"], exam: "11월 25일" },
  "8-2": { day: "목", lessons: ["11월 12일", "11월 19일"], exam: "11월 26일" },
  "8-3": { day: "화", lessons: ["11월 10일", "11월 17일"], off: "11월 24일", exam: "12월 1일" },
  "8-4": { day: "월", lessons: ["11월 9일", "11월 16일"], exam: "11월 23일" },
  "8-5": { day: "목", lessons: ["11월 12일", "11월 19일"], exam: "11월 26일" },
};
const ABSENT = {
  // 예: "8-3": { lesson1: ["학생 A"], lesson2: [], exam: [] },
};

function names(list) {
  return list && list.length ? list.join(", ") : '<span class="empty">없음</span>';
}

function renderSchedule(cls) {
  const body = document.getElementById("schedule-body");
  if (!body) return;
  const s = SCHEDULE[cls];
  const a = ABSENT[cls] || {};
  const rows = [
    ["", "수업 1", `${s.lessons[0]} ${s.day}`, "4단계 익히기, 올덴버그로 연습", names(a.lesson1), "공유 자료로 자율 학습"],
    ["", "수업 2", `${s.lessons[1]} ${s.day}`, "백남준으로 연습, 출제 작품 공부", names(a.lesson2), "공유 자료로 자율 학습"],
  ];
  if (s.off) rows.push(["off", "휴무", `${s.off} ${s.day}`, "학교 휴무일이라 수업이 없습니다", "", ""]);
  rows.push(["exam", "수행평가", `${s.exam} ${s.day}`, "감상문 쓰기 (제비뽑기)", names(a.exam), "평가 결석생은 점심시간 응시"]);
  rows.push(["makeup", "추가 응시", "추후 점심시간", "평가 결석생 개별 제비뽑기로 응시", names(a.exam), "선생님이 날짜 안내"]);

  const labels = ["", "날짜", "수업", "결석생", "보충"];
  body.innerHTML = rows
    .map(([cls, ...cells]) =>
      `<tr class="${cls}">${cells
        .map((c, i) => `<td${i && c ? ` data-label="${labels[i]}"` : ""}>${c}</td>`)
        .join("")}</tr>`)
    .join("");
  document.getElementById("class-title").textContent = `${cls}반`;
  document.querySelectorAll(".class-switch button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.class === cls)));
}

const sw = document.querySelector(".class-switch");
if (sw) {
  const saved = location.hash.slice(1) || localStorage.getItem("myClass");
  renderSchedule(SCHEDULE[saved] ? saved : "8-3");
  sw.addEventListener("click", (e) => {
    const cls = e.target.dataset && e.target.dataset.class;
    if (!cls) return;
    localStorage.setItem("myClass", cls);
    history.replaceState(null, "", `#${cls}`);
    renderSchedule(cls);
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
