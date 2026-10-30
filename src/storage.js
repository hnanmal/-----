(function () {
  "use strict";

  const LEGACY_STORAGE_KEY = "suseon-logic-prototype-v1";
  const ACTIVE_PUZZLE_KEY = "suseon-logic-active-puzzle-v1";
  const SESSION_KEY_PREFIX = "suseon-logic-session-v1:";

  function createEmptySession(puzzle) {
    return {
      puzzleId: puzzle.id,
      cells: Array.from({ length: puzzle.height }, () =>
        Array.from({ length: puzzle.width }, () => 0)
      ),
      elapsedSeconds: 0,
      regressionCount: 0,
      hintCount: 0,
      mistakeCount: 0,
      wrongCells: [],
      rowTouches: Array.from({ length: puzzle.height }, () => 0),
      columnTouches: Array.from({ length: puzzle.width }, () => 0),
      snapshots: [],
      undoStack: [],
      redoStack: [],
      completedAt: null
    };
  }

  function isValidSession(session, puzzle) {
    return Boolean(
      session &&
      session.puzzleId === puzzle.id &&
      Array.isArray(session.cells) &&
      session.cells.length === puzzle.height &&
      session.cells.every((row) =>
        Array.isArray(row) &&
        row.length === puzzle.width &&
        row.every((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 3)
      ) &&
      Number.isFinite(session.elapsedSeconds) &&
      Number.isInteger(session.regressionCount) &&
      Array.isArray(session.snapshots) &&
      Array.isArray(session.undoStack) &&
      Array.isArray(session.redoStack)
    );
  }

  function readJson(key, description) {
    const serialized = window.localStorage.getItem(key);
    if (!serialized) return null;

    try {
      return JSON.parse(serialized);
    } catch (error) {
      console.error(`${description} JSON을 읽지 못했습니다.`, error);
      throw new Error(`${description} 파일 형식이 손상되어 불러올 수 없습니다.`);
    }
  }

  function loadActivePuzzle(defaultPuzzle) {
    const stored = readJson(ACTIVE_PUZZLE_KEY, "현재 퍼즐");
    if (!stored) return defaultPuzzle;
    return window.NonogramPuzzle.parseDefinition(stored);
  }

  function saveActivePuzzle(puzzle) {
    const serialized = JSON.stringify(window.NonogramPuzzle.serializeDefinition(puzzle));
    try {
      window.localStorage.setItem(ACTIVE_PUZZLE_KEY, serialized);
    } catch (error) {
      console.error("현재 퍼즐을 저장하지 못했습니다.", error);
      throw new Error("현재 퍼즐을 기기에 저장하지 못했습니다.");
    }
  }

  function loadSession(puzzle) {
    const sessionKey = `${SESSION_KEY_PREFIX}${puzzle.id}`;
    const parsed = readJson(sessionKey, "수행 기록") ||
      (puzzle.id === "first-light" ? readJson(LEGACY_STORAGE_KEY, "수행 기록") : null);
    if (!parsed) {
      return createEmptySession(puzzle);
    }

    if (!isValidSession(parsed, puzzle)) {
      console.error("저장 기록의 형식이 현재 퍼즐과 일치하지 않습니다.");
      throw new Error("저장된 수행 기록의 형식이 올바르지 않습니다.");
    }

    parsed.undoStack = parsed.undoStack.slice(-100);
    parsed.redoStack = parsed.redoStack.slice(-100);
    return parsed;
  }

  function saveSession(session) {
    const key = `${SESSION_KEY_PREFIX}${session.puzzleId}`;
    try {
      window.localStorage.setItem(key, JSON.stringify(session));
    } catch (error) {
      console.error("수행 기록을 저장하지 못했습니다.", error);
      throw new Error("기기 저장 공간에 수행 기록을 저장하지 못했습니다.");
    }
  }

  window.NonogramStorage = {
    createEmptySession,
    loadActivePuzzle,
    loadSession,
    saveActivePuzzle,
    saveSession
  };
})();
