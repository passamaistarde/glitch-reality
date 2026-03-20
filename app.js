/* ── GATE BREAK Chapter Loader ── */
(function () {
  "use strict";

  const CHAPTER_DIR = "chapters/";
  const MANIFEST = [
    { file: "chapter-01.html", title: "ตอนที่ 1: วันที่โลกเปลี่ยนไป", subtitle: "ยี่สิบสี่ปีก่อน — โลกใบนี้ยังเป็นโลกธรรมดา" },
    { file: "chapter-02.html", title: "ตอนที่ 2: ระบบตื่น", subtitle: "เสียงนั้นไม่เหมือนเสียงมนุษย์" },
    { file: "chapter-03.html", title: "ตอนที่ 3: สามวัน", subtitle: "เซ็นเปิดตาครั้งที่สอง" },
    { file: "chapter-04.html", title: "ตอนที่ 4: ดินแดนหมาป่า", subtitle: "เช้าวันรุ่งขึ้น เซ็นออกจากอพาร์ทเมนต์ตั้งแต่ฟ้ายังไม่สว่างดี" },
    { file: "chapter-05.html", title: "ตอนที่ 5: วันที่ประตูไม่มีเสียงเตือน", subtitle: "เช้าวันต่อมา เซ็นยืนอยู่หน้าอาคารสำนักงานใหญ่ JLA ชินจูกุ" },
    { file: "chapter-06.html", title: "ตอนที่ 6: มิติที่ไม่มีแสง", subtitle: "ความมืดกลืนทุกอย่าง" },
    { file: "chapter-07.html", title: "ตอนที่ 7: ราคาของความอ่อนแอ", subtitle: "เซ็นวิ่ง" },
    { file: "chapter-08.html", title: "ตอนที่ 8: หมากตัวแรก", subtitle: "เซ็นตื่นขึ้นมาบนพื้นห้อง หลังยังพิงกำแพงเดิมจากเมื่อคืน ค..." },
    { file: "chapter-09.html", title: "ตอนที่ 9: คนแปลกหน้าจากประตูมิติ", subtitle: "ร้านสะดวกซื้อ FamilyMart สาขาเซตากาย่า" },
    { file: "chapter-10.html", title: "ตอนที่ 10: คำท้า", subtitle: "กำปั้นเรืองแสงหยุดนิ่งห่างจากจมูกเซ็นไม่ถึงสิบเซนติเมตร" },
    { file: "chapter-11.html", title: "ตอนที่ 11: เงาที่ไม่ได้เรียก", subtitle: "สนามต่อสู้อย่างเป็นทางการของ JLA อยู่ชั้นใต้ดิน B5 ของอาค..." },
    { file: "chapter-12.html", title: "ตอนที่ 12: ก้าวเงา", subtitle: "เช้าวันถัดมา" },
    { file: "chapter-13.html", title: "ตอนที่ 13: ค่าที่ไม่ควรมีอยู่จริง", subtitle: "เช้าวันสุดท้ายของเดือนกุมภาพันธ์" },
    { file: "chapter-14.html", title: "ตอนที่ 14: คนดังไม่ได้อยากดัง", subtitle: "บ่ายโมง สถานีชินจูกุ" },
    { file: "chapter-15.html", title: "ตอนที่ 15: อัศวินแห่งเงา", subtitle: "สามวันถัดมา" },
    { file: "chapter-16.html", title: "ตอนที่ 16: ประตูที่ไม่เหมือนข้อมูล", subtitle: "ห้อง 204 อพาร์ทเมนต์เซตากาย่า กลางดึก" },
    { file: "chapter-17.html", title: "ตอนที่ 17: น้ำแข็งกับเงา", subtitle: "แสงสีม่วงจากแกนมอนสเตอร์ไหลลงสู่พื้นหินเหมือนหยดหมึกที่มี..." },
    { file: "chapter-18.html", title: "ตอนที่ 18: บอสที่ไม่ควรอยู่ที่นี่", subtitle: "ประตูหินขนาดมหึมาเลื่อนเปิดช้า ๆ พร้อมเสียงครูดลึกที่สะเท..." },
    { file: "chapter-19.html", title: "ตอนที่ 19: สิ่งที่ยังอยู่", subtitle: "กลิ่นน้ำยาฆ่าเชื้อในโรงพยาบาลคมจนเหมือนมันจะกรีดเข้าไปถึง..." }
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
