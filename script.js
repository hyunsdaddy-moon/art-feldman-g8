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

// 첫 화면: 내가 고른 반의 평가 날짜를 강조
const mine = localStorage.getItem("myClass");
document.querySelectorAll(".dates tr").forEach((tr) => {
  if (mine && tr.firstElementChild.textContent === mine) tr.classList.add("mine");
});
