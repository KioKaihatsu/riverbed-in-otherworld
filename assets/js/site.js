/* Riverbed in Otherworld — site behaviour
   window.RIO は build.py が site.config.json から書き出す
   { hours: {lunch:[s,e], dinner:[s,e]}, closedWeekdays:[1], exceptions:[{date,closed,note,lunch,dinner}] } */
(() => {
  const cfg = window.RIO || {};
  const WD = ["日", "月", "火", "水", "木", "金", "土"];

  // ---- 計測（GA4）: data-track 属性のクリックをイベントとして送る ----
  const track = (name, params = {}) => {
    if (typeof window.gtag === "function") window.gtag("event", name, params);
  };
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-track]");
    if (a) track(a.dataset.track, { place: a.dataset.place || "", link_url: a.href || "" });
  });
  if ("IntersectionObserver" in window) {
    const seen = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { track(en.target.dataset.trackView); seen.unobserve(en.target); }
      });
    }, { threshold: 0.35 });
    document.querySelectorAll("[data-track-view]").forEach(el => seen.observe(el));
  }

  // ---- 今日の営業（日本時間で判定） ----
  const nowJST = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short"
    }).formatToParts(new Date()).map(x => [x.type, x.value]));
    const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
    return { date: `${p.year}-${p.month}-${p.day}`, wd, min: (+p.hour % 24) * 60 + +p.minute, month: +p.month };
  };
  const toMin = s => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  const fmt = r => `${r[0]}–${r[1]}`;

  const t = nowJST();
  const ex = (cfg.exceptions || []).find(x => x.date === t.date);
  const closedToday = ex ? !!ex.closed : (cfg.closedWeekdays || [1]).includes(t.wd);
  const lunch = (ex && ex.lunch) || (cfg.hours && cfg.hours.lunch) || ["11:00", "15:30"];
  const dinner = (ex && ex.dinner) || (cfg.hours && cfg.hours.dinner) || ["16:30", "20:00"];

  let state, label;
  if (closedToday) {
    state = "closed"; label = ex && ex.note ? `本日は${ex.note}` : "本日は定休日です";
  } else if (t.min >= toMin(lunch[0]) && t.min < toMin(lunch[1])) {
    state = "open"; label = `ただいまランチ営業中（${lunch[1]}まで）`;
  } else if (t.min >= toMin(dinner[0]) && t.min < toMin(dinner[1])) {
    state = "open"; label = `ただいまディナー営業中（${dinner[1]}まで）`;
  } else if (t.min < toMin(lunch[0])) {
    state = "soon"; label = `本日は${lunch[0]}から営業します`;
  } else if (t.min < toMin(dinner[0])) {
    state = "soon"; label = `準備中・ディナーは${dinner[0]}から`;
  } else {
    state = "closed"; label = "本日の営業は終了しました";
  }

  document.querySelectorAll("[data-status-dot]").forEach(d => {
    d.classList.toggle("is-open", state === "open");
    d.classList.toggle("is-closed", state === "closed");
  });
  const st = document.querySelector("[data-status-text]");
  if (st) st.textContent = label;
  const sh = document.querySelector("[data-status-short]");
  if (sh) sh.textContent = state === "open" ? "営業中" : "ご予約";
  const th = document.querySelector("[data-today-hours]");
  if (th) {
    th.textContent = closedToday
      ? `${t.month}月${+t.date.slice(8)}日（${WD[t.wd]}）はお休みです`
      : `${t.month}月${+t.date.slice(8)}日（${WD[t.wd]}） ランチ ${fmt(lunch)} ／ ディナー ${fmt(dinner)}`;
  }
  const row = document.querySelector(`[data-hours] tr[data-day="${t.wd}"]`);
  if (row) row.classList.add("is-today");

  // ---- 駒込さんぽ：いまの季節に印をつける ----
  document.querySelectorAll("[data-walk] li[data-months]").forEach(li => {
    const ms = li.dataset.months.split(",").filter(Boolean).map(Number);
    if (ms.includes(t.month)) {
      li.classList.add("is-now");
      const n = li.querySelector(".now"); if (n) n.hidden = false;
    }
  });

  // ---- 動画 ----
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hero = document.querySelector(".arch-video");
  const toggle = document.querySelector("[data-video-toggle]");
  const setIcon = playing => {
    toggle.setAttribute("aria-label", playing ? "動画を一時停止" : "動画を再生");
    toggle.innerHTML = playing
      ? '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="4" width="3.2" height="12" rx="1"/><rect x="11.8" y="4" width="3.2" height="12" rx="1"/></svg>'
      : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l10 6-10 6z"/></svg>';
  };
  if (hero && toggle) {
    if (reduce) { hero.removeAttribute("autoplay"); hero.pause(); setIcon(false); }
    toggle.addEventListener("click", () => {
      if (hero.paused) { hero.play(); setIcon(true); } else { hero.pause(); setIcon(false); }
    });
  }
  const lazyVids = document.querySelectorAll("video[data-autoplay-visible]");
  if ("IntersectionObserver" in window && !reduce) {
    const vo = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) en.target.play().catch(() => {});
        else en.target.pause();
      });
    }, { threshold: 0.4 });
    lazyVids.forEach(v => vo.observe(v));
  } else {
    lazyVids.forEach(v => v.setAttribute("controls", ""));
  }

  // ---- ヘッダーの線と、スマホの電話ボタン ----
  const bar = document.getElementById("bar");
  const call = document.querySelector(".float-call");
  const heroEl = document.querySelector(".hero");
  const onScroll = () => {
    const y = window.scrollY;
    bar.classList.toggle("scrolled", y > 8);
    if (call && heroEl) call.classList.toggle("show", y > heroEl.offsetHeight * 0.7);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
