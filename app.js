/* ── GATE BREAK Chapter Loader ── */
(function () {
  "use strict";

  const CHAPTER_DIR = "chapters/";
  const MANIFEST = [
    { file: "chapter-01.html", title: "ตอนที่ 1: วันที่โลกเปลี่ยนไป", subtitle: "ยี่สิบสี่ปีก่อน — โลกใบนี้ยังเป็นโลกธรรมดา" },
    { file: "chapter-02.html", title: "ตอนที่ 2: ระบบตื่น", subtitle: "เสียงนั้นไม่เหมือนเสียงมนุษย์" }
  ];

  const $ = (sel) => document.querySelector(sel);
  const chapterListEl = $("#chapter-list");
  const readerTitle = $("#reader-title");
  const readerSubtitle = $("#reader-subtitle");
  const readerContent = $("#reader-content");
  const activeLabel = $("#active-chapter-label");
  const prevBtn = $("#prev-button");
  const nextBtn = $("#next-button");
  const scrollBtn = $("#scroll-to-reader");

  let currentIndex = -1;

  function init() {
    if (MANIFEST.length === 0) {
      chapterListEl.innerHTML =
        '<p style="color:var(--muted);padding:8px 0;">ยังไม่มีตอน — กำลังจะมาเร็ว ๆ นี้</p>';
      activeLabel.textContent = "ยังไม่มีตอน";
      updateNav();
      return;
    }

    MANIFEST.forEach(function (ch, i) {
      var btn = document.createElement("button");
      btn.className = "chapter-button";
      btn.type = "button";
      btn.innerHTML =
        '<span class="chapter-button-title">' + escapeHtml(ch.title) + "</span>" +
        '<span class="chapter-button-meta">' + escapeHtml(ch.subtitle || "") + "</span>";
      btn.addEventListener("click", function () { loadChapter(i); });
      chapterListEl.appendChild(btn);
    });

    loadChapter(0);
  }

  function loadChapter(index) {
    if (index < 0 || index >= MANIFEST.length) return;
    var ch = MANIFEST[index];
    currentIndex = index;

    readerTitle.textContent = ch.title;
    readerSubtitle.textContent = ch.subtitle || "";
    activeLabel.textContent = ch.title;
    readerContent.innerHTML = '<p style="color:var(--muted);">กำลังโหลด...</p>';

    highlightButton(index);

    fetch(CHAPTER_DIR + ch.file)
      .then(function (r) {
        if (!r.ok) throw new Error("ไม่พบไฟล์บท");
        return r.text();
      })
      .then(function (html) {
        readerContent.innerHTML = html;
      })
      .catch(function () {
        readerContent.innerHTML =
          '<p style="color:var(--danger);">ไม่สามารถโหลดบทนี้ได้</p>';
      });

    updateNav();
  }

  function highlightButton(index) {
    var buttons = chapterListEl.querySelectorAll(".chapter-button");
    buttons.forEach(function (b, i) {
      b.classList.toggle("active", i === index);
    });
  }

  function updateNav() {
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex < 0 || currentIndex >= MANIFEST.length - 1;
  }

  prevBtn.addEventListener("click", function () { loadChapter(currentIndex - 1); });
  nextBtn.addEventListener("click", function () { loadChapter(currentIndex + 1); });
  scrollBtn.addEventListener("click", function () {
    var panel = $("#reader-panel");
    if (panel) panel.scrollIntoView({ behavior: "smooth" });
  });

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  init();
})();
