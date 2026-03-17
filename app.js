const chapters = [
  {
    id: "chapter-001",
    title: "บทที่ 1: ดีบักเกอร์ผู้ไร้ค่า",
    subtitle: "The Null Debugger",
    file: "chapters/chapter_001.md",
  },
  {
    id: "chapter-002",
    title: "บทที่ 2: กับดักในเขต D-13",
    subtitle: "The Trap in D-13",
    file: "chapters/chapter_002.md",
  },
];

const chapterList = document.querySelector("#chapter-list");
const readerTitle = document.querySelector("#reader-title");
const readerSubtitle = document.querySelector("#reader-subtitle");
const readerContent = document.querySelector("#reader-content");
const activeChapterLabel = document.querySelector("#active-chapter-label");
const prevButton = document.querySelector("#prev-button");
const nextButton = document.querySelector("#next-button");
const scrollToReaderButton = document.querySelector("#scroll-to-reader");
const readerPanel = document.querySelector("#reader-panel");

let activeIndex = 0;

function markdownToHtml(markdown) {
  return markdown
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block === "---") {
        return "<hr>";
      }

      if (block.startsWith("# ")) {
        return `<h1>${escapeHtml(block.slice(2))}</h1>`;
      }

      if (block.startsWith("## ")) {
        return `<h2>${escapeHtml(block.slice(3))}</h2>`;
      }

      if (block.startsWith("### ")) {
        return `<h3>${escapeHtml(block.slice(4))}</h3>`;
      }

      const inlineHtml = escapeHtml(block)
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\n/g, "<br>");

      return `<p>${inlineHtml}</p>`;
    })
    .join("\n");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderChapterList() {
  chapterList.innerHTML = "";

  chapters.forEach((chapter, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chapter-button";
    button.dataset.index = String(index);
    button.innerHTML = `
      <span class="chapter-button-title">${chapter.title}</span>
      <span class="chapter-button-meta">${chapter.subtitle}</span>
    `;

    button.addEventListener("click", () => {
      void loadChapter(index, true);
    });

    chapterList.append(button);
  });
}

function updateChapterListState() {
  const buttons = chapterList.querySelectorAll(".chapter-button");
  buttons.forEach((button, index) => {
    button.classList.toggle("active", index === activeIndex);
  });
}

function updateNavigation() {
  prevButton.disabled = activeIndex === 0;
  nextButton.disabled = activeIndex === chapters.length - 1;
}

async function loadChapter(index, shouldScroll = false) {
  activeIndex = index;
  const chapter = chapters[index];

  updateChapterListState();
  updateNavigation();

  readerTitle.textContent = chapter.title;
  readerSubtitle.textContent = chapter.subtitle;
  activeChapterLabel.textContent = chapter.title;
  readerContent.innerHTML = "<p>กำลังโหลดเนื้อหา...</p>";

  const response = await fetch(chapter.file, { cache: "no-store" });
  if (!response.ok) {
    readerContent.innerHTML = "<p>ไม่สามารถโหลดบทนี้ได้</p>";
    return;
  }

  const markdown = await response.text();
  readerContent.innerHTML = markdownToHtml(markdown);
  localStorage.setItem("glitch-reality-active-chapter", chapter.id);

  if (shouldScroll) {
    readerPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function restoreLastChapter() {
  const savedId = localStorage.getItem("glitch-reality-active-chapter");
  const savedIndex = chapters.findIndex((chapter) => chapter.id === savedId);
  return savedIndex >= 0 ? savedIndex : 0;
}

prevButton.addEventListener("click", () => {
  if (activeIndex > 0) {
    void loadChapter(activeIndex - 1, true);
  }
});

nextButton.addEventListener("click", () => {
  if (activeIndex < chapters.length - 1) {
    void loadChapter(activeIndex + 1, true);
  }
});

scrollToReaderButton.addEventListener("click", () => {
  readerPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

renderChapterList();
void loadChapter(restoreLastChapter());