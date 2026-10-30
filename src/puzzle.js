(function () {
  "use strict";

  const defaultSolution = [
    "....##....",
    "...####...",
    "..######..",
    ".##.##.##.",
    "##########",
    "..######..",
    "...####...",
    "..##..##..",
    ".##....##.",
    "##......##"
  ];

  class PatternLimitError extends Error {}

  function getLineHints(line) {
    const hints = [];
    let run = 0;

    for (const filled of line) {
      if (filled) {
        run += 1;
      } else if (run > 0) {
        hints.push(run);
        run = 0;
      }
    }

    if (run > 0) {
      hints.push(run);
    }

    return hints;
  }

  function getHints(solution) {
    const rowHints = solution.map(getLineHints);
    const columnHints = solution[0].map((_, column) =>
      getLineHints(solution.map((row) => row[column]))
    );
    return { rowHints, columnHints };
  }

  function validateDimensions(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width < 5 || width > 20 || height < 5 || height > 20) {
      throw new Error("퍼즐 가로·세로 크기는 각각 5~20이어야 합니다.");
    }
  }

  function hashSolution(width, height, rows) {
    let hash = 2166136261;
    const value = `${width}x${height}:${rows.join("|")}`;
    for (let index = 0; index < value.length; index += 1) {
      hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function createDefinition(options) {
    const { width, height, solution } = options;
    validateDimensions(width, height);

    if (!Array.isArray(solution) || solution.length !== height ||
      solution.some((row) => !Array.isArray(row) || row.length !== width ||
        row.some((cell) => typeof cell !== "boolean"))) {
      throw new Error("정답 보드의 크기나 셀 값이 올바르지 않습니다.");
    }

    const rows = solution.map((row) => row.map((cell) => cell ? "#" : ".").join(""));
    const normalizedSolution = solution.map((row) => [...row]);
    const { rowHints, columnHints } = getHints(normalizedSolution);
    const title = typeof options.title === "string" ? options.title.trim() : "";

    if (!title || title.length > 50) {
      throw new Error("퍼즐 이름은 1~50자여야 합니다.");
    }

    return {
      schemaVersion: 1,
      id: `map-${hashSolution(width, height, rows)}`,
      title,
      subtitle: typeof options.subtitle === "string" && options.subtitle.trim()
        ? options.subtitle.trim().slice(0, 100)
        : "흩어진 칸을 논리로 완성하세요",
      realm: typeof options.realm === "string" && options.realm.trim()
        ? options.realm.trim().slice(0, 40)
        : "맵메이커 · 사용자 퍼즐",
      width,
      height,
      solution: normalizedSolution,
      rowHints,
      columnHints
    };
  }

  function parseDefinition(definition) {
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      throw new Error("JSON 최상위 값은 퍼즐 객체여야 합니다.");
    }
    if (definition.schemaVersion !== 1) {
      throw new Error("지원하지 않는 퍼즐 형식입니다. schemaVersion 1 파일을 사용하세요.");
    }

    const { width, height } = definition;
    validateDimensions(width, height);

    if (!Array.isArray(definition.solution) || definition.solution.length !== height ||
      definition.solution.some((row) =>
        typeof row !== "string" || row.length !== width || !/^[.#]+$/.test(row)
      )) {
      throw new Error("solution은 가로·세로 크기와 일치하는 #/. 문자열 배열이어야 합니다.");
    }

    const solution = definition.solution.map((row) =>
      Array.from(row, (cell) => cell === "#")
    );
    const parsed = createDefinition({
      width,
      height,
      solution,
      title: definition.title,
      subtitle: definition.subtitle,
      realm: definition.realm
    });
    const suppliedHints = [
      ["rowHints", parsed.rowHints],
      ["columnHints", parsed.columnHints]
    ];

    for (const [field, expected] of suppliedHints) {
      if (definition[field] !== undefined &&
        JSON.stringify(definition[field]) !== JSON.stringify(expected)) {
        throw new Error(`${field}가 solution에서 계산한 단서와 일치하지 않습니다.`);
      }
    }

    return parsed;
  }

  function serializeDefinition(puzzle) {
    return {
      schemaVersion: 1,
      id: puzzle.id,
      title: puzzle.title,
      subtitle: puzzle.subtitle,
      realm: puzzle.realm,
      width: puzzle.width,
      height: puzzle.height,
      solution: puzzle.solution.map((row) =>
        row.map((filled) => filled ? "#" : ".").join("")
      ),
      rowHints: puzzle.rowHints,
      columnHints: puzzle.columnHints
    };
  }

  function buildPuzzle() {
    const puzzle = createDefinition({
      title: "첫 번째 진도",
      subtitle: "흩어진 빛을 모아 형상을 완성하세요",
      realm: "범인 · 첫 수행",
      width: defaultSolution[0].length,
      height: defaultSolution.length,
      solution: defaultSolution.map((row) => Array.from(row, (cell) => cell === "#"))
    });
    puzzle.id = "first-light";
    return puzzle;
  }

  function generateLinePatterns(length, clues, limit = 10000) {
    const runs = clues.length === 1 && clues[0] === 0 ? [] : clues;
    const patterns = [];

    function placeRun(runIndex, offset, current) {
      if (runIndex === runs.length) {
        patterns.push([
          ...current,
          ...Array.from({ length: length - current.length }, () => false)
        ]);
        if (patterns.length > limit) {
          throw new PatternLimitError("한 줄의 후보가 검사 한도를 넘었습니다.");
        }
        return;
      }

      const remainingRuns = runs.slice(runIndex);
      const remainingFilled = remainingRuns.reduce((sum, run) => sum + run, 0);
      const requiredSeparators = remainingRuns.length - 1;
      const latestStart = length - remainingFilled - requiredSeparators;

      for (let start = offset; start <= latestStart; start += 1) {
        const leadingGaps = Array.from({ length: start - current.length }, () => false);
        const filledRun = Array.from({ length: runs[runIndex] }, () => true);
        const next = [...current, ...leadingGaps, ...filledRun];

        if (runIndex < runs.length - 1) {
          placeRun(runIndex + 1, start + runs[runIndex] + 1, [...next, false]);
        } else {
          placeRun(runIndex + 1, start + runs[runIndex], next);
        }
      }
    }

    placeRun(0, 0, []);
    return patterns;
  }

  function countSolutions(puzzle) {
    const operationLimit = 1500000;
    let operations = 0;
    const solutions = [];

    try {
      const rowPatterns = puzzle.rowHints.map((clues) =>
        generateLinePatterns(puzzle.width, clues)
      );
      const columnPatterns = puzzle.columnHints.map((clues) =>
        generateLinePatterns(puzzle.height, clues)
      );
      if (rowPatterns.some((patterns) => patterns.length === 0) ||
        columnPatterns.some((patterns) => patterns.length === 0)) {
        return { status: "none", count: 0, solutions };
      }

      function search(rowIndex, candidatesByColumn, chosenRows) {
        if (solutions.length >= 2) return;
        if (rowIndex === puzzle.height) {
          solutions.push(chosenRows);
          return;
        }

        for (const row of rowPatterns[rowIndex]) {
          operations += candidatesByColumn.reduce((sum, patterns) => sum + patterns.length, 0);
          if (operations > operationLimit) {
            throw new PatternLimitError("유일해 검사 연산 한도를 넘었습니다.");
          }

          const nextColumns = candidatesByColumn.map((patterns, column) =>
            patterns.filter((pattern) => pattern[rowIndex] === row[column])
          );
          if (nextColumns.every((patterns) => patterns.length > 0)) {
            search(rowIndex + 1, nextColumns, [...chosenRows, row]);
          }
          if (solutions.length >= 2) return;
        }
      }

      search(0, columnPatterns, []);
      return {
        status: solutions.length === 1 ? "unique" : solutions.length > 1 ? "multiple" : "none",
        count: solutions.length,
        solutions
      };
    } catch (error) {
      if (error instanceof PatternLimitError) {
        return { status: "complex", count: solutions.length, solutions };
      }
      throw error;
    }
  }

  function getKnownLine(session, axis, index) {
    if (axis === "row") {
      return session.cells[index];
    }

    return session.cells.map((row) => row[index]);
  }

  function matchesKnownCells(pattern, knownCells) {
    return pattern.every((filled, index) => {
      const state = knownCells[index];
      if (state === 1 && !filled) return false;
      if (state === 2 && filled) return false;
      return true;
    });
  }

  function getLineCandidates(session, puzzle, axis, index) {
    const clues = axis === "row" ? puzzle.rowHints[index] : puzzle.columnHints[index];
    const length = axis === "row" ? puzzle.width : puzzle.height;
    const knownCells = getKnownLine(session, axis, index);

    try {
      return generateLinePatterns(length, clues).filter((pattern) =>
        matchesKnownCells(pattern, knownCells)
      );
    } catch (error) {
      if (error instanceof PatternLimitError) return [];
      throw error;
    }
  }

  function findForcedLine(session, puzzle) {
    let best = null;

    for (const axis of ["row", "column"]) {
      const lineCount = axis === "row" ? puzzle.height : puzzle.width;

      for (let index = 0; index < lineCount; index += 1) {
        const knownCells = getKnownLine(session, axis, index);
        const candidates = getLineCandidates(session, puzzle, axis, index);

        if (candidates.length === 0) {
          continue;
        }

        const forcedCells = [];
        for (let position = 0; position < candidates[0].length; position += 1) {
          if (knownCells[position] !== 0) {
            continue;
          }

          const value = candidates[0][position];
          if (candidates.every((candidate) => candidate[position] === value)) {
            const row = axis === "row" ? index : position;
            const column = axis === "row" ? position : index;
            forcedCells.push({
              row,
              column,
              state: value ? 1 : 2
            });
          }
        }

        if (forcedCells.length === 0) {
          continue;
        }

        const rank = forcedCells.length * 100 - candidates.length;
        if (!best || rank > best.rank) {
          best = { axis, index, candidates, forcedCells, rank };
        }
      }
    }

    return best;
  }

  function getCompletionRate(session, puzzle) {
    let confirmed = 0;
    const total = puzzle.width * puzzle.height;

    session.cells.forEach((row) => {
      row.forEach((state) => {
        if (state !== 0) {
          confirmed += 1;
        }
      });
    });

    return Math.round((confirmed / total) * 100);
  }

  function isSolved(session, puzzle) {
    return puzzle.solution.every((row, rowIndex) =>
      row.every((filled, columnIndex) =>
        filled ? session.cells[rowIndex][columnIndex] === 1 :
          session.cells[rowIndex][columnIndex] !== 1
      )
    );
  }

  window.NonogramPuzzle = {
    buildPuzzle,
    countSolutions,
    createDefinition,
    findForcedLine,
    getCompletionRate,
    getLineCandidates,
    getLineHints,
    isSolved,
    parseDefinition,
    serializeDefinition
  };
})();
