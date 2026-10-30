(function () {
  "use strict";

  const defaultPuzzle = window.NonogramPuzzle.buildPuzzle();
  let puzzle = window.NonogramStorage.loadActivePuzzle(defaultPuzzle);
  const app = document.querySelector("#app");
  const modalRoot = document.querySelector("#modal-root");
  const toast = document.querySelector("#toast");
  const puzzleFileInput = document.querySelector("#puzzle-file");
  const symbols = { 0: "", 1: "", 2: "×", 3: "·" };
  let session = window.NonogramStorage.loadSession(puzzle);
  let screen = session.completedAt ? "result" : "home";
  let activeTool = 1;
  let activeDrag = null;
  let makerState = createMakerState();
  let makerDrag = null;
  let archiveReturnScreen = "home";
  let hintLine = null;
  let hintCell = null;
  let timerInterval = null;
  let toastTimeout = null;

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function createMakerState(width = 10, height = 10) {
    return {
      width,
      height,
      title: "새 진도",
      solution: Array.from({ length: height }, () =>
        Array.from({ length: width }, () => false)
      ),
      tool: "fill",
      validationMessage: "칸을 그린 뒤 해답 유일성을 검사하세요.",
      validationStatus: "idle"
    };
  }

  function getTitle(regressionCount = session.regressionCount) {
    if (regressionCount === 0) return "일념통천";
    if (regressionCount <= 2) return "진법사";
    if (regressionCount <= 5) return "구도자";
    return "불굴의 수행자";
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function save() {
    window.NonogramStorage.saveSession(session);
  }

  function homeMarkup() {
    const isComplete = Boolean(session.completedAt);
    const activeCount = session.cells.flat().filter((state) => state !== 0).length;
    const hasProgress = activeCount > 0 || session.elapsedSeconds > 0;
    const progress = isComplete ? 100 : window.NonogramPuzzle.getCompletionRate(session, puzzle);

    return `
      <section class="home-page">
        <div class="hero">
          <div class="hero-orb" aria-hidden="true"></div>
          <div class="hero-copy">
            <div class="eyebrow"><span class="eyebrow-dot"></span>${escapeHtml(puzzle.realm)}</div>
            <h1>흩어진 인과를,<br>논리로 잇다.</h1>
            <p>한 칸씩 살피고 진도를 완성하세요.<br>실패의 흔적도 다음 수행의 길잡이가 됩니다.</p>
          </div>
          <span class="hero-decoration" aria-hidden="true">天 · 地 · 人</span>
        </div>

        <div class="home-grid">
          <section class="panel continue-card">
            <div class="section-caption">${isComplete ? "수행을 마쳤습니다" : hasProgress ? "이어 수행하기" : "첫 수행을 시작하세요"}</div>
            <div class="puzzle-preview">
              <div class="preview-art" style="grid-template-columns:repeat(${puzzle.width},1fr)" aria-hidden="true">${previewMarkup()}</div>
              <div class="puzzle-meta">
                <h2>${escapeHtml(puzzle.title)}</h2>
                <p>${puzzle.width}×${puzzle.height} · ${session.regressionCount}회 회귀 · ${formatTime(session.elapsedSeconds)}</p>
              </div>
            </div>
            <button class="primary-button wide-button" type="button" data-action="${isComplete ? "result" : "play"}">
              ${isComplete ? "수행 결산 보기" : hasProgress ? "이어서 수행하기" : "첫 퍼즐 시작"}
              <span aria-hidden="true">　→</span>
            </button>
            <div class="home-tool-actions">
              <button class="secondary-button" type="button" data-action="maker">퍼즐 만들기</button>
              <button class="secondary-button" type="button" data-action="import">JSON 가져오기</button>
            </div>
          </section>

          <section class="panel progress-card">
            <div class="progress-heading">
              <h2>수행 기록</h2>
              <span>${session.regressionCount ? getTitle() : "수행자"}</span>
            </div>
            <div class="progress-stats">
              <div class="stat"><strong>${isComplete ? "1" : "0"}</strong><span>완성한 진도</span></div>
              <div class="stat"><strong>${session.regressionCount}</strong><span>회귀 기록</span></div>
            </div>
            <div class="progress-track" aria-label="퍼즐 진행도">
              <div class="progress-fill" style="width:${progress}%"></div>
            </div>
          </section>
        </div>

        <section class="path-section">
          <div class="path-heading"><h2>수행로</h2><span>첫 번째 여정</span></div>
          <div class="path-list">
            <article class="path-card active">
              <span class="path-order">01 · 입문</span>
              <span class="path-status">${isComplete ? "완성" : "수행 중"}</span>
              <h3>범인</h3>
              <p>기본 단서와 칸의 의미</p>
            </article>
            <article class="path-card locked">
              <span class="path-order">02 · 기초</span>
              <span class="path-status" aria-label="잠김">잠김</span>
              <h3>단수기</h3>
              <p>퍼즐 8개를 마치면 해금</p>
            </article>
            <article class="path-card locked">
              <span class="path-order">03 · 초중급</span>
              <span class="path-status" aria-label="잠김">잠김</span>
              <h3>연기기 1성</h3>
              <p>회귀의 흔적을 익히는 수행</p>
            </article>
          </div>
        </section>
      </section>
    `;
  }

  function previewMarkup() {
    return puzzle.solution
      .flatMap((row) => row.map((filled) =>
        `<span class="preview-pixel${filled ? " on" : ""}"></span>`
      ))
      .join("");
  }

  function completedLines() {
    const rows = session.cells.map((row, rowIndex) =>
      row.every((state, columnIndex) =>
        puzzle.solution[rowIndex][columnIndex] ? state === 1 : state !== 1
      )
    );
    const columns = puzzle.solution[0].map((_, columnIndex) =>
      session.cells.every((row, rowIndex) =>
        puzzle.solution[rowIndex][columnIndex] ? row[columnIndex] === 1 : row[columnIndex] !== 1
      )
    );
    return { rows, columns };
  }

  function puzzleMarkup() {
    const completion = completedLines();
    const rowClues = puzzle.rowHints.map((clues, rowIndex) => `
      <div class="row-clue${completion.rows[rowIndex] ? " is-complete" : ""}">
        ${clues.map((clue) => `<span>${clue}</span>`).join("") || "<span>–</span>"}
      </div>
    `).join("");
    const columnClues = puzzle.columnHints.map((clues, columnIndex) => `
      <div class="column-clue${completion.columns[columnIndex] ? " is-complete" : ""}">
        ${clues.map((clue) => `<span>${clue}</span>`).join("") || "<span>–</span>"}
      </div>
    `).join("");
    const cells = session.cells.flatMap((row, rowIndex) =>
      row.map((state, columnIndex) => {
        const highlightedLine = hintLine &&
          (hintLine.axis === "row" ? hintLine.index === rowIndex : hintLine.index === columnIndex);
        const highlightedCell = hintCell &&
          hintCell.row === rowIndex &&
          hintCell.column === columnIndex;
        const stateClass = state === 1 ? " filled" : state === 2 ? " crossed" : state === 3 ? " noted" : "";
        const hintClass = highlightedCell ? " hint-cell" : highlightedLine ? " hint-highlight" : "";
        const label = state === 1 ? "채움" : state === 2 ? "제외" : state === 3 ? "가표시" : "미정";
        return `<button class="cell${stateClass}${hintClass}" type="button"
          data-row="${rowIndex}" data-column="${columnIndex}"
          data-row-boundary="${(rowIndex + 1) % 5 === 0 && rowIndex < puzzle.height - 1}"
          data-column-boundary="${(columnIndex + 1) % 5 === 0 && columnIndex < puzzle.width - 1}"
          data-row-last="${rowIndex === puzzle.height - 1}"
          data-column-last="${columnIndex === puzzle.width - 1}"
          aria-label="${rowIndex + 1}행 ${columnIndex + 1}열, ${label}"></button>`;
      })
    ).join("");

    return `
      <section class="puzzle-page">
        <div class="puzzle-topline">
          <button class="back-link" type="button" data-action="home"><span aria-hidden="true">←</span> 수행로</button>
          <div class="puzzle-status">
            <span><span class="status-glyph" aria-hidden="true">◷</span><span data-timer>${formatTime(session.elapsedSeconds)}</span></span>
            <span><span class="status-glyph" aria-hidden="true">↶</span>${session.regressionCount}회</span>
          </div>
        </div>
        <div class="puzzle-title-row">
          <div>
            <div class="eyebrow"><span class="eyebrow-dot"></span>${escapeHtml(puzzle.realm)}</div>
            <h1>${escapeHtml(puzzle.title)}</h1>
            <p>${escapeHtml(puzzle.subtitle)}</p>
          </div>
          <span class="section-caption">${puzzle.width} × ${puzzle.height}</span>
        </div>

        <div class="board-card">
          <div class="board-scroll">
            <div class="puzzle-layout">
              <div class="corner-label">열 ↓</div>
              <div class="column-clues" style="--puzzle-width:${puzzle.width};--puzzle-height:${puzzle.height}" aria-label="열 단서">${columnClues}</div>
              <div class="row-clues" style="--puzzle-width:${puzzle.width};--puzzle-height:${puzzle.height}" aria-label="행 단서">${rowClues}</div>
              <div class="cell-grid" style="--puzzle-width:${puzzle.width};--puzzle-height:${puzzle.height}" role="group" aria-label="네모네모 로직 퍼즐 보드">${cells}</div>
            </div>
          </div>
          <div class="board-legend">
            <span class="legend-item"><i class="legend-square filled"></i> 채움</span>
            <span class="legend-item"><i class="legend-square unknown"></i> 미정</span>
            <span class="legend-item">× 제외　· 가표시</span>
          </div>
          <div class="tool-row">
            <div class="tool-group" role="group" aria-label="입력 도구">
              <button class="tool-button" type="button" data-tool="1" aria-pressed="${activeTool === 1}">
                <span class="tool-glyph" aria-hidden="true">■</span>채우기
              </button>
              <button class="tool-button" type="button" data-tool="2" aria-pressed="${activeTool === 2}">
                <span class="tool-glyph" aria-hidden="true">×</span>제외
              </button>
              <button class="tool-button" type="button" data-tool="3" aria-pressed="${activeTool === 3}">
                <span class="tool-glyph" aria-hidden="true">·</span>가표시
              </button>
            </div>
            <div class="action-group">
              <button class="icon-button" type="button" data-action="undo" aria-label="실행 취소" title="실행 취소 (Ctrl+Z)" ${session.undoStack.length ? "" : "disabled"}>↶</button>
              <button class="icon-button" type="button" data-action="redo" aria-label="다시 실행" title="다시 실행 (Ctrl+Y)" ${session.redoStack.length ? "" : "disabled"}>↷</button>
              <button class="icon-button hint-button" type="button" data-action="hint" aria-label="논리 힌트">✧ 힌트</button>
              <button class="icon-button regress-button" type="button" data-action="regress">회귀</button>
            </div>
          </div>
          <p class="hint-message" aria-live="polite">${hintMessageMarkup()}</p>
          <div class="regression-callout">
            <p>틀린 칸도 다음 회차의 단서가 됩니다.<br>회귀하면 보드는 비워지고 수행 기록은 남습니다.</p>
            <button class="text-button" type="button" data-action="archive">회귀록 보기 →</button>
          </div>
        </div>
      </section>
    `;
  }

  function makerMarkup() {
    const rowHints = makerState.solution.map(window.NonogramPuzzle.getLineHints);
    const columnHints = makerState.solution[0].map((_, column) =>
      window.NonogramPuzzle.getLineHints(makerState.solution.map((row) => row[column]))
    );
    const filledCount = makerState.solution.flat().filter(Boolean).length;
    const dimensionOptions = Array.from({ length: 16 }, (_, index) => index + 5)
      .map((size) => `<option value="${size}"${size === makerState.width ? " selected" : ""}>${size}</option>`)
      .join("");
    const heightOptions = Array.from({ length: 16 }, (_, index) => index + 5)
      .map((size) => `<option value="${size}"${size === makerState.height ? " selected" : ""}>${size}</option>`)
      .join("");
    const cells = makerState.solution.flatMap((row, rowIndex) =>
      row.map((filled, columnIndex) => `
        <button class="cell maker-cell${filled ? " filled" : ""}" type="button"
          data-maker-row="${rowIndex}" data-maker-column="${columnIndex}"
          data-row-boundary="${(rowIndex + 1) % 5 === 0 && rowIndex < makerState.height - 1}"
          data-column-boundary="${(columnIndex + 1) % 5 === 0 && columnIndex < makerState.width - 1}"
          data-row-last="${rowIndex === makerState.height - 1}"
          data-column-last="${columnIndex === makerState.width - 1}"
          aria-label="${rowIndex + 1}행 ${columnIndex + 1}열, ${filled ? "채움" : "빈칸"}"></button>
      `)
    ).join("");

    return `
      <section class="maker-page">
        <div class="puzzle-topline">
          <button class="back-link" type="button" data-action="home"><span aria-hidden="true">←</span> 수행로</button>
          <button class="back-link" type="button" data-action="import">JSON 가져오기</button>
        </div>
        <div class="page-heading maker-heading">
          <div class="eyebrow"><span class="eyebrow-dot"></span>퍼즐 제작 도구</div>
          <h1>맵메이커</h1>
          <p>칸을 그리면 행·열 단서가 자동으로 만들어집니다.<br>해답이 하나인지 검사한 뒤 JSON으로 내보내거나 바로 플레이할 수 있습니다.</p>
        </div>

        <div class="maker-controls panel">
          <label class="maker-title-field">퍼즐 이름
            <input id="maker-title" type="text" maxlength="50" value="${escapeHtml(makerState.title)}">
          </label>
          <label>가로
            <select id="maker-width">${dimensionOptions}</select>
          </label>
          <label>세로
            <select id="maker-height">${heightOptions}</select>
          </label>
          <div class="maker-cell-count">${filledCount}칸 채움</div>
        </div>

        <div class="maker-workspace">
          <section class="board-card maker-board-card">
            <div class="maker-tools" role="group" aria-label="그리기 도구">
              <button class="tool-button" type="button" data-maker-tool="fill" aria-pressed="${makerState.tool === "fill"}">■ 채우기</button>
              <button class="tool-button" type="button" data-maker-tool="erase" aria-pressed="${makerState.tool === "erase"}">□ 지우기</button>
              <button class="secondary-button maker-clear" type="button" data-action="maker-clear">전체 지우기</button>
            </div>
            <div class="board-scroll maker-board-scroll">
              <div class="maker-grid" style="--puzzle-width:${makerState.width};--puzzle-height:${makerState.height}" role="group" aria-label="퍼즐 정답 편집 보드">
                ${cells}
              </div>
            </div>
            <p class="maker-instruction">마우스나 손가락으로 드래그해 여러 칸을 한 번에 그릴 수 있습니다.</p>
          </section>

          <aside class="maker-side">
            <section class="panel maker-validation">
              <div class="section-caption">해답 검증</div>
              <p class="maker-validation-message" data-validation-status="${makerState.validationStatus}" aria-live="polite">${escapeHtml(makerState.validationMessage)}</p>
              <button class="secondary-button wide-button" type="button" data-action="maker-validate">유일해 검사</button>
              <div class="maker-export-actions">
                <button class="secondary-button" type="button" data-action="maker-export">JSON 내보내기</button>
                <button class="primary-button" type="button" data-action="maker-play">게임에서 풀기</button>
              </div>
            </section>
            <section class="panel maker-clues">
              <div class="section-caption">자동 생성 단서</div>
              <div class="maker-clue-groups">
                <div><strong>행</strong>${rowHints.map((clues, index) => `<p>${index + 1}. ${clues.join(" · ") || "—"}</p>`).join("")}</div>
                <div><strong>열</strong>${columnHints.map((clues, index) => `<p>${index + 1}. ${clues.join(" · ") || "—"}</p>`).join("")}</div>
              </div>
            </section>
          </aside>
        </div>
      </section>
    `;
  }

  function hintMessageMarkup() {
    if (hintCell) {
      const label = hintCell.state === 1 ? "채움" : "제외";
      return `${hintCell.row + 1}행 ${hintCell.column + 1}열은 논리적으로 ${label}할 수 있습니다.`;
    }
    if (hintLine) {
      const label = hintLine.axis === "row" ? `${hintLine.index + 1}행` : `${hintLine.index + 1}열`;
      return `${label}의 가능한 배치 ${hintLine.candidateCount}개를 살펴보세요.`;
    }
    return "단서를 따라 확정할 수 있는 줄을 찾아보세요.";
  }

  function archiveMarkup() {
    const snapshots = [...session.snapshots].reverse();
    const entries = snapshots.length
      ? snapshots.map((snapshot) => {
        const difficultLines = [
          ...snapshot.difficultRows.map((row) => `${row + 1}행`),
          ...snapshot.difficultColumns.map((column) => `${column + 1}열`)
        ];
        return `
          <article class="archive-entry">
            <div class="archive-entry-heading">
              <span>${snapshot.cycle}회차 · ${snapshot.title}</span>
              <time>${new Date(snapshot.createdAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })}</time>
            </div>
            <p>완성률 ${snapshot.completionRate}% · 수행 ${formatTime(snapshot.elapsedSeconds)} · 힌트 ${snapshot.hintCount}회<br>
              실수 흔적 ${snapshot.mistakeCells.length}칸 · 오래 살핀 곳 ${difficultLines.join(", ") || "기록 없음"}</p>
          </article>
        `;
      }).join("")
      : `<div class="archive-empty">아직 회귀 기록이 없습니다.<br>첫 수행을 마친 뒤 회귀하면 사고의 흔적이 이곳에 쌓입니다.</div>`;

    return `
      <section class="archive-page">
        <button class="back-link" type="button" data-action="back"><span aria-hidden="true">←</span> 돌아가기</button>
        <div class="page-heading">
          <div class="eyebrow"><span class="eyebrow-dot"></span>수행의 흔적</div>
          <h1>회귀록</h1>
          <p>돌아간 횟수가 아니라, 다시 살펴본 과정이 기록됩니다.</p>
        </div>
        <div class="archive-summary">
          <div><strong>${session.regressionCount}</strong><span>누적 회귀</span></div>
          <div><strong>${snapshots.length}</strong><span>남겨진 기록</span></div>
          <div><strong>${session.snapshots.reduce((total, snapshot) => total + snapshot.mistakeCells.length, session.wrongCells.length)}</strong><span>실수 흔적</span></div>
        </div>
        <div class="archive-list">${entries}</div>
      </section>
    `;
  }

  function resultMarkup() {
    return `
      <section class="result-page">
        <div class="result-card">
          <div class="result-emblem" aria-hidden="true">成</div>
          <div class="eyebrow" style="justify-content:center"><span class="eyebrow-dot"></span>${escapeHtml(puzzle.title)} 완성</div>
          <h1>한 걸음, 온전히 밝혔습니다.</h1>
          <p>반복한 시간과 생각이 수행의 기록으로 남았습니다.</p>
          <div class="result-stats">
            <div class="result-stat"><strong>${formatTime(session.elapsedSeconds)}</strong><span>수행 시간</span></div>
            <div class="result-stat"><strong>${session.regressionCount}</strong><span>회귀</span></div>
            <div class="result-stat"><strong>${session.hintCount}</strong><span>힌트</span></div>
          </div>
          <div class="result-actions">
            <button class="secondary-button" type="button" data-action="archive">회귀록 보기</button>
            <button class="primary-button" type="button" data-action="home">수행로로</button>
          </div>
        </div>
      </section>
    `;
  }

  function render() {
    app.innerHTML = screen === "puzzle" ? puzzleMarkup()
      : screen === "maker" ? makerMarkup()
      : screen === "archive" ? archiveMarkup()
      : screen === "result" ? resultMarkup()
      : homeMarkup();
    app.focus({ preventScroll: true });

    if (screen === "puzzle") {
      startTimer();
    } else {
      stopTimer();
    }
  }

  function startTimer() {
    if (timerInterval) return;
    timerInterval = window.setInterval(() => {
      if (screen !== "puzzle") return;
      session.elapsedSeconds += 1;
      const timer = app.querySelector("[data-timer]");
      if (timer) timer.textContent = formatTime(session.elapsedSeconds);
      save();
    }, 1000);
  }

  function stopTimer() {
    if (!timerInterval) return;
    window.clearInterval(timerInterval);
    timerInterval = null;
  }

  function cloneCells(cells) {
    return cells.map((row) => [...row]);
  }

  function applyCell(row, column, value) {
    const previous = session.cells[row][column];
    if (previous === value) return;

    session.cells[row][column] = value;
    session.rowTouches[row] += 1;
    session.columnTouches[column] += 1;

    if (value === 1 && !puzzle.solution[row][column]) {
      session.mistakeCount += 1;
      const key = `${row}:${column}`;
      if (!session.wrongCells.includes(key)) session.wrongCells.push(key);
    }
  }

  function cellValueForTool(row, column, tool) {
    const current = session.cells[row][column];
    if (tool === 1 || tool === 2) {
      return current === tool ? 0 : tool;
    }
    return current === 3 ? 0 : 3;
  }

  function beginCellInput(cell, event) {
    if (session.completedAt || event.button > 0) return;
    event.preventDefault();
    const row = Number(cell.dataset.row);
    const column = Number(cell.dataset.column);
    const before = cloneCells(session.cells);
    const nextValue = cellValueForTool(row, column, activeTool);
    activeDrag = {
      pointerId: event.pointerId,
      before,
      value: nextValue,
      visited: new Set()
    };
    applyDragCell(cell);
    cell.setPointerCapture(event.pointerId);
  }

  function applyDragCell(cell) {
    if (!activeDrag || !cell) return;
    const row = Number(cell.dataset.row);
    const column = Number(cell.dataset.column);
    const key = `${row}:${column}`;
    if (activeDrag.visited.has(key)) return;
    activeDrag.visited.add(key);
    applyCell(row, column, activeDrag.value);
    updateBoardCells();
  }

  function updateBoardCells() {
    const grid = app.querySelector(".cell-grid");
    if (!grid) return;
    const currentCells = grid.querySelectorAll(".cell");
    currentCells.forEach((cell) => {
      const row = Number(cell.dataset.row);
      const column = Number(cell.dataset.column);
      const state = session.cells[row][column];
      cell.classList.toggle("filled", state === 1);
      cell.classList.toggle("crossed", state === 2);
      cell.classList.toggle("noted", state === 3);
      cell.textContent = symbols[state];
      const label = state === 1 ? "채움" : state === 2 ? "제외" : state === 3 ? "가표시" : "미정";
      cell.setAttribute("aria-label", `${row + 1}행 ${column + 1}열, ${label}`);
    });
  }

  function finishCellInput() {
    if (!activeDrag) return;
    const before = activeDrag.before;
    const after = cloneCells(session.cells);
    activeDrag = null;

    if (JSON.stringify(before) !== JSON.stringify(after)) {
      session.undoStack.push({ before, after });
      session.undoStack = session.undoStack.slice(-100);
      session.redoStack = [];
      save();

      if (window.NonogramPuzzle.isSolved(session, puzzle)) {
        session.completedAt = new Date().toISOString();
        save();
        screen = "result";
        render();
        return;
      }
    }

    render();
  }

  function applyHistory(stack, targetStack, key) {
    const action = stack.pop();
    if (!action) return;
    targetStack.push(action);
    session.cells = cloneCells(action[key]);
    hintCell = null;
    hintLine = null;
    save();
    render();
  }

  function createRegressionModal() {
    const completionRate = window.NonogramPuzzle.getCompletionRate(session, puzzle);
    modalRoot.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="regress-title" aria-describedby="regress-description">
          <h2 id="regress-title">이번 수행을 회귀할까요?</h2>
          <p id="regress-description">보드는 비워지지만 지금까지의 흔적은 회귀록에 남습니다. 다음 회차에는 위험했던 구역을 다시 살필 수 있습니다.</p>
          <div class="modal-summary">완성률 ${completionRate}% · 실수 흔적 ${session.wrongCells.length}칸<br>이번 기록 칭호: ${getTitle(session.regressionCount + 1)}</div>
          <div class="modal-actions">
            <button class="secondary-button" type="button" data-modal-action="cancel">계속 수행</button>
            <button class="primary-button" type="button" data-modal-action="confirm">회귀 기록 남기기</button>
          </div>
        </section>
      </div>
    `;
    modalRoot.querySelector('[data-modal-action="cancel"]').focus();
  }

  function confirmRegression() {
    const touchedRows = session.rowTouches
      .map((count, index) => ({ count, index }))
      .filter((entry) => entry.count > 0)
      .sort((left, right) => right.count - left.count)
      .slice(0, 3)
      .map((entry) => entry.index);
    const touchedColumns = session.columnTouches
      .map((count, index) => ({ count, index }))
      .filter((entry) => entry.count > 0)
      .sort((left, right) => right.count - left.count)
      .slice(0, 3)
      .map((entry) => entry.index);

    session.snapshots.push({
      cycle: session.regressionCount + 1,
      title: getTitle(session.regressionCount + 1),
      createdAt: new Date().toISOString(),
      completionRate: window.NonogramPuzzle.getCompletionRate(session, puzzle),
      elapsedSeconds: session.elapsedSeconds,
      hintCount: session.hintCount,
      mistakeCount: session.mistakeCount,
      mistakeCells: [...session.wrongCells],
      difficultRows: touchedRows,
      difficultColumns: touchedColumns
    });
    session.regressionCount += 1;
    session.cells = window.NonogramStorage.createEmptySession(puzzle).cells;
    session.elapsedSeconds = 0;
    session.hintCount = 0;
    session.mistakeCount = 0;
    session.wrongCells = [];
    session.rowTouches = Array.from({ length: puzzle.height }, () => 0);
    session.columnTouches = Array.from({ length: puzzle.width }, () => 0);
    session.undoStack = [];
    session.redoStack = [];
    hintLine = null;
    hintCell = null;
    modalRoot.innerHTML = "";
    screen = "puzzle";
    save();
    render();
    showToast("회귀록에 이번 수행의 흔적을 남겼습니다.");
  }

  function useHint() {
    const forcedLine = window.NonogramPuzzle.findForcedLine(session, puzzle);
    if (!forcedLine) {
      hintLine = null;
      hintCell = null;
      showToast("현재 표시한 칸만으로 확정할 수 있는 줄이 없습니다.");
      render();
      return;
    }

    if (!hintLine || hintLine.axis !== forcedLine.axis || hintLine.index !== forcedLine.index) {
      hintLine = {
        axis: forcedLine.axis,
        index: forcedLine.index,
        candidateCount: forcedLine.candidates.length
      };
      hintCell = null;
      render();
      return;
    }

    const safeCell = forcedLine.forcedCells[0];
    hintCell = { ...safeCell };
    hintLine = null;
    if (session.cells[safeCell.row][safeCell.column] === 0) {
      session.cells[safeCell.row][safeCell.column] = safeCell.state;
      session.hintCount += 1;
      session.undoStack.push({
        before: cloneCells(session.cells).map((row, rowIndex) =>
          row.map((state, columnIndex) =>
            rowIndex === safeCell.row && columnIndex === safeCell.column ? 0 : state
          )
        ),
        after: cloneCells(session.cells)
      });
      session.redoStack = [];
      save();
    }

    if (window.NonogramPuzzle.isSolved(session, puzzle)) {
      session.completedAt = new Date().toISOString();
      save();
      screen = "result";
    }
    render();
  }

  function resetMakerValidation() {
    makerState.validationStatus = "idle";
    makerState.validationMessage = "보드가 바뀌었습니다. 다시 해답 유일성을 검사하세요.";
  }

  function resizeMaker(width, height) {
    const solution = Array.from({ length: height }, (_, row) =>
      Array.from({ length: width }, (_, column) =>
        makerState.solution[row]?.[column] ?? false
      )
    );
    makerState.width = width;
    makerState.height = height;
    makerState.solution = solution;
    resetMakerValidation();
    render();
  }

  function createMakerDefinition() {
    if (!makerState.solution.flat().some(Boolean)) {
      throw new Error("정답 보드에 채운 칸을 하나 이상 그려주세요.");
    }

    return window.NonogramPuzzle.createDefinition({
      title: makerState.title,
      width: makerState.width,
      height: makerState.height,
      solution: makerState.solution,
      realm: "맵메이커 · 사용자 퍼즐"
    });
  }

  function validatePuzzle(puzzle) {
    const result = window.NonogramPuzzle.countSolutions(puzzle);
    if (result.status === "unique") {
      return { puzzle, message: "검증 완료 · 해답이 하나입니다.", status: "unique" };
    }
    if (result.status === "multiple") {
      throw new Error("해답이 둘 이상입니다. 그림을 수정해 단서가 더 구분되도록 해주세요.");
    }
    if (result.status === "none") {
      throw new Error("행·열 단서에 맞는 해답이 없습니다.");
    }
    throw new Error("유일해 검사 한도를 넘었습니다. 보드를 작게 하거나 더 단순한 그림으로 나눠주세요.");
  }

  function checkMakerSolution() {
    try {
      const result = validatePuzzle(createMakerDefinition());
      makerState.validationStatus = result.status;
      makerState.validationMessage = result.message;
      return result.puzzle;
    } catch (error) {
      makerState.validationStatus = "invalid";
      makerState.validationMessage = error.message;
      return null;
    }
  }

  function activatePuzzle(nextPuzzle) {
    const nextSession = window.NonogramStorage.loadSession(nextPuzzle);
    window.NonogramStorage.saveActivePuzzle(nextPuzzle);
    puzzle = nextPuzzle;
    session = nextSession;
    hintLine = null;
    hintCell = null;
    screen = session.completedAt ? "result" : "puzzle";
    save();
    render();
  }

  function downloadPuzzle(puzzleToExport) {
    const serialized = JSON.stringify(
      window.NonogramPuzzle.serializeDefinition(puzzleToExport),
      null,
      2
    );
    const blob = new Blob([serialized], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = puzzleToExport.title.replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-|-$/g, "");
    link.href = url;
    link.download = `${safeTitle || "nonogram-puzzle"}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("게임에서 가져올 수 있는 JSON 파일을 내보냈습니다.");
  }

  async function importPuzzleFile(file) {
    try {
      const serialized = await file.text();
      let rawDefinition;
      try {
        rawDefinition = JSON.parse(serialized);
      } catch (error) {
        throw new Error("파일이 올바른 JSON 형식이 아닙니다.");
      }

      const importedPuzzle = window.NonogramPuzzle.parseDefinition(rawDefinition);
      validatePuzzle(importedPuzzle);
      activatePuzzle(importedPuzzle);
      showToast("퍼즐을 불러왔습니다. 새 진도를 시작합니다.");
    } catch (error) {
      console.error("퍼즐 파일을 불러오지 못했습니다.", error);
      showToast(error.message || "퍼즐 파일을 불러오지 못했습니다.");
    } finally {
      puzzleFileInput.value = "";
    }
  }

  function applyMakerCell(cell) {
    if (!makerDrag || !cell) return;
    const row = Number(cell.dataset.makerRow);
    const column = Number(cell.dataset.makerColumn);
    const key = `${row}:${column}`;
    if (makerDrag.visited.has(key)) return;
    makerDrag.visited.add(key);

    const value = makerDrag.value;
    if (makerState.solution[row][column] !== value) {
      makerState.solution[row][column] = value;
      makerDrag.changed = true;
      cell.classList.toggle("filled", value);
      cell.setAttribute("aria-label", `${row + 1}행 ${column + 1}열, ${value ? "채움" : "빈칸"}`);
    }
  }

  function beginMakerInput(cell, event) {
    if (event.button > 0) return;
    event.preventDefault();
    const row = Number(cell.dataset.makerRow);
    const column = Number(cell.dataset.makerColumn);
    makerDrag = {
      pointerId: event.pointerId,
      value: makerState.tool === "fill",
      changed: false,
      visited: new Set()
    };
    applyMakerCell(cell);
    cell.setPointerCapture(event.pointerId);
  }

  function finishMakerInput() {
    if (!makerDrag) return;
    const changed = makerDrag.changed;
    makerDrag = null;
    if (changed) {
      resetMakerValidation();
      render();
    }
  }

  function routeToArchive() {
    archiveReturnScreen = screen;
    screen = "archive";
    render();
  }

  function handleAction(action) {
    if (action === "home") {
      screen = "home";
      render();
    } else if (action === "play") {
      screen = "puzzle";
      hintLine = null;
      hintCell = null;
      render();
    } else if (action === "result") {
      screen = "result";
      render();
    } else if (action === "archive") {
      routeToArchive();
    } else if (action === "back") {
      screen = archiveReturnScreen;
      render();
    } else if (action === "maker") {
      screen = "maker";
      render();
    } else if (action === "import") {
      puzzleFileInput.click();
    } else if (action === "maker-clear") {
      makerState.solution = Array.from({ length: makerState.height }, () =>
        Array.from({ length: makerState.width }, () => false)
      );
      resetMakerValidation();
      render();
    } else if (action === "maker-validate") {
      const verified = checkMakerSolution();
      render();
      showToast(verified ? "해답이 하나인 퍼즐입니다." : makerState.validationMessage);
    } else if (action === "maker-export") {
      const verified = checkMakerSolution();
      render();
      if (verified) downloadPuzzle(verified);
      else showToast(makerState.validationMessage);
    } else if (action === "maker-play") {
      const verified = checkMakerSolution();
      render();
      if (verified) activatePuzzle(verified);
      else showToast(makerState.validationMessage);
    } else if (action === "undo") {
      applyHistory(session.undoStack, session.redoStack, "before");
    } else if (action === "redo") {
      applyHistory(session.redoStack, session.undoStack, "after");
    } else if (action === "hint") {
      useHint();
    } else if (action === "regress") {
      createRegressionModal();
    }
  }

  document.addEventListener("click", (event) => {
    const toolButton = event.target.closest("[data-tool]");
    if (toolButton) {
      activeTool = Number(toolButton.dataset.tool);
      render();
      return;
    }

    const makerToolButton = event.target.closest("[data-maker-tool]");
    if (makerToolButton) {
      makerState.tool = makerToolButton.dataset.makerTool;
      render();
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      handleAction(actionButton.dataset.action);
      return;
    }

    const modalAction = event.target.closest("[data-modal-action]");
    if (modalAction?.dataset.modalAction === "cancel") {
      modalRoot.innerHTML = "";
    } else if (modalAction?.dataset.modalAction === "confirm") {
      confirmRegression();
    } else if (event.target.classList.contains("modal-backdrop")) {
      modalRoot.innerHTML = "";
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "maker-title") {
      makerState.title = event.target.value;
      resetMakerValidation();
      const message = app.querySelector(".maker-validation-message");
      if (message) {
        message.dataset.validationStatus = makerState.validationStatus;
        message.textContent = makerState.validationMessage;
      }
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "maker-width") {
      resizeMaker(Number(event.target.value), makerState.height);
    } else if (event.target.id === "maker-height") {
      resizeMaker(makerState.width, Number(event.target.value));
    } else if (event.target === puzzleFileInput && event.target.files?.[0]) {
      importPuzzleFile(event.target.files[0]);
    }
  });

  document.addEventListener("pointerdown", (event) => {
    const makerCell = event.target.closest(".maker-cell");
    if (makerCell && screen === "maker") {
      beginMakerInput(makerCell, event);
      return;
    }

    const cell = event.target.closest(".cell:not(.maker-cell)");
    if (cell) beginCellInput(cell, event);
  });

  document.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse") return;
    if (makerDrag && screen === "maker") {
      const makerCell = event.target.closest(".maker-cell");
      if (makerCell) applyMakerCell(makerCell);
      return;
    }
    if (!activeDrag || screen !== "puzzle") return;
    const cell = event.target.closest(".cell");
    if (cell) applyDragCell(cell);
  });

  document.addEventListener("pointermove", (event) => {
    if (makerDrag && makerDrag.pointerId === event.pointerId) {
      const makerCell = document.elementFromPoint(event.clientX, event.clientY)?.closest(".maker-cell");
      if (makerCell) applyMakerCell(makerCell);
      return;
    }
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest(".cell:not(.maker-cell)");
    if (cell) applyDragCell(cell);
  });

  document.addEventListener("pointerup", (event) => {
    if (makerDrag && makerDrag.pointerId === event.pointerId) finishMakerInput();
    if (activeDrag && activeDrag.pointerId === event.pointerId) finishCellInput();
  });

  document.addEventListener("pointercancel", (event) => {
    if (makerDrag && makerDrag.pointerId === event.pointerId) finishMakerInput();
    if (activeDrag && activeDrag.pointerId === event.pointerId) finishCellInput();
  });

  document.addEventListener("keydown", (event) => {
    if (screen === "puzzle" && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        applyHistory(session.redoStack, session.undoStack, "after");
      } else {
        applyHistory(session.undoStack, session.redoStack, "before");
      }
    } else if (screen === "puzzle" && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      applyHistory(session.redoStack, session.undoStack, "after");
    } else if (screen === "puzzle" && ["1", "2", "3"].includes(event.key)) {
      activeTool = Number(event.key);
      render();
    } else if (event.key === "Escape" && modalRoot.childElementCount > 0) {
      modalRoot.innerHTML = "";
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });

  window.addEventListener("beforeunload", () => {
    save();
    stopTimer();
  });

  render();
})();
