import { describe, expect, it } from 'vitest';
import {
  COLUMNS, ROWS, SHAPES, clearLines, collision, createBoard, createPiece, dropDistance, dropInterval,
  levelForLines, mergePiece, rotate, scoreForLines, shuffledBag, tryRotate,
} from './game';
import type { Board, PieceType } from './game';

const ALL_TYPES = Object.keys(SHAPES) as PieceType[];

function fillRow(board: Board, y: number, skipColumn?: number): void {
  for (let x = 0; x < COLUMNS; x++) if (x !== skipColumn) board[y][x] = 'I';
}

describe('createBoard', () => {
  it('creates an empty ROWS x COLUMNS grid', () => {
    const board = createBoard();
    expect(board).toHaveLength(ROWS);
    board.forEach((row) => {
      expect(row).toHaveLength(COLUMNS);
      expect(row.every((cell) => cell === null)).toBe(true);
    });
  });

  it('returns independent rows', () => {
    const board = createBoard();
    board[0][0] = 'T';
    expect(board[1][0]).toBeNull();
  });
});

describe('createPiece', () => {
  it.each(ALL_TYPES)('spawns %s at the top, horizontally centered', (type) => {
    const piece = createPiece(type);
    expect(piece.type).toBe(type);
    expect(piece.y).toBe(0);
    expect(piece.x).toBe(Math.floor((COLUMNS - SHAPES[type][0].length) / 2));
  });

  it('copies the shape so mutating a piece does not change SHAPES', () => {
    const piece = createPiece('T');
    piece.matrix[0][0] = 9;
    expect(SHAPES.T[0][0]).toBe(0);
  });
});

describe('shuffledBag', () => {
  it('contains each piece type exactly once', () => {
    expect([...shuffledBag()].sort()).toEqual([...ALL_TYPES].sort());
  });

  it('is deterministic for a given random source', () => {
    expect(shuffledBag(() => 0)).toEqual(shuffledBag(() => 0));
  });

  it('actually shuffles depending on the random source', () => {
    expect(shuffledBag(() => 0)).not.toEqual(shuffledBag(() => 0.999));
  });
});

describe('rotate', () => {
  it('rotates a matrix 90 degrees clockwise', () => {
    expect(rotate([[1, 1, 1, 1]])).toEqual([[1], [1], [1], [1]]);
    expect(rotate(SHAPES.T)).toEqual([[1, 0], [1, 1], [1, 0]]);
  });

  it('returns to the original after four rotations', () => {
    ALL_TYPES.forEach((type) => {
      let matrix = SHAPES[type];
      for (let i = 0; i < 4; i++) matrix = rotate(matrix);
      expect(matrix).toEqual(SHAPES[type]);
    });
  });

  it('does not mutate its input', () => {
    const original = SHAPES.L.map((row) => [...row]);
    rotate(SHAPES.L);
    expect(SHAPES.L).toEqual(original);
  });

  it('keeps the O piece unchanged', () => {
    expect(rotate(SHAPES.O)).toEqual(SHAPES.O);
  });
});

describe('collision', () => {
  it('is false for a freshly spawned piece on an empty board', () => {
    expect(collision(createBoard(), createPiece('T'))).toBe(false);
  });

  it('detects the left and right walls', () => {
    const board = createBoard();
    const piece = createPiece('O');
    piece.x = 0;
    expect(collision(board, piece, -1, 0)).toBe(true);
    piece.x = COLUMNS - 2;
    expect(collision(board, piece, 1, 0)).toBe(true);
    expect(collision(board, piece, 0, 0)).toBe(false);
  });

  it('detects the floor', () => {
    const piece = createPiece('O');
    piece.y = ROWS - 2;
    expect(collision(createBoard(), piece, 0, 0)).toBe(false);
    expect(collision(createBoard(), piece, 0, 1)).toBe(true);
  });

  it('detects occupied cells', () => {
    const board = createBoard();
    const piece = createPiece('O');
    board[1][piece.x] = 'Z';
    expect(collision(board, piece)).toBe(true);
  });

  it('allows cells above the board (negative y)', () => {
    const piece = createPiece('I');
    piece.y = -1;
    expect(collision(createBoard(), piece)).toBe(false);
  });

  it('ignores empty cells of the matrix', () => {
    const board = createBoard();
    const piece = createPiece('T'); // top row is [0,1,0]
    board[0][piece.x] = 'I'; // sits under an empty matrix cell
    expect(collision(board, piece)).toBe(false);
  });
});

describe('tryRotate', () => {
  it('rotates in place when there is room', () => {
    const piece = createPiece('T');
    piece.y = 5;
    const result = tryRotate(createBoard(), piece);
    expect(result).toEqual({ matrix: rotate(piece.matrix), offset: 0 });
  });

  it('kicks the vertical I piece off the left wall', () => {
    const piece = createPiece('I');
    piece.matrix = rotate(piece.matrix); // vertical, width 1
    piece.x = 0;
    piece.y = 5;
    const result = tryRotate(createBoard(), piece); // back to horizontal width 4, needs x<=6
    expect(result).not.toBeNull();
    expect(result!.offset).toBe(0);
  });

  it('kicks a horizontal I piece away from the right wall', () => {
    const piece = createPiece('I');
    piece.x = COLUMNS - 4;
    piece.y = 5;
    const result = tryRotate(createBoard(), piece); // vertical width 1 fits at x=6
    expect(result).not.toBeNull();
    expect(piece.x + result!.offset + result!.matrix[0].length).toBeLessThanOrEqual(COLUMNS);
  });

  it('returns null when every kick collides', () => {
    const board = createBoard();
    for (let y = 0; y < ROWS; y++) fillRow(board, y);
    const piece = createPiece('T');
    piece.y = 5;
    expect(tryRotate(board, piece)).toBeNull();
  });
});

describe('dropDistance', () => {
  it('equals the distance to the floor on an empty board', () => {
    const piece = createPiece('O');
    expect(dropDistance(createBoard(), piece)).toBe(ROWS - 2);
  });

  it('stops on top of existing blocks', () => {
    const board = createBoard();
    const piece = createPiece('O');
    board[10][piece.x] = 'J';
    expect(dropDistance(board, piece)).toBe(8);
  });

  it('is zero when the piece is already resting', () => {
    const piece = createPiece('O');
    piece.y = ROWS - 2;
    expect(dropDistance(createBoard(), piece)).toBe(0);
  });
});

describe('mergePiece', () => {
  it('writes the piece type into the board cells it occupies', () => {
    const piece = createPiece('T');
    piece.y = 4;
    const merged = mergePiece(createBoard(), piece);
    expect(merged[4][piece.x + 1]).toBe('T');
    expect(merged[5][piece.x]).toBe('T');
    expect(merged[5][piece.x + 1]).toBe('T');
    expect(merged[5][piece.x + 2]).toBe('T');
    expect(merged[4][piece.x]).toBeNull();
  });

  it('does not mutate the original board', () => {
    const board = createBoard();
    mergePiece(board, createPiece('O'));
    expect(board.flat().every((cell) => cell === null)).toBe(true);
  });

  it('ignores cells above the visible board', () => {
    const piece = createPiece('O');
    piece.y = -1;
    const merged = mergePiece(createBoard(), piece);
    expect(merged.flat().filter((cell) => cell === 'O')).toHaveLength(2);
  });
});

describe('clearLines', () => {
  it('does nothing when no row is full', () => {
    const board = createBoard();
    fillRow(board, ROWS - 1, 3);
    const result = clearLines(board);
    expect(result.cleared).toBe(0);
    expect(result.board).toEqual(board);
  });

  it('clears a single full row and keeps the board size', () => {
    const board = createBoard();
    fillRow(board, ROWS - 1);
    const result = clearLines(board);
    expect(result.cleared).toBe(1);
    expect(result.board).toHaveLength(ROWS);
    expect(result.board[ROWS - 1].every((cell) => cell === null)).toBe(true);
  });

  it('shifts rows above the cleared row down', () => {
    const board = createBoard();
    board[ROWS - 2][0] = 'T';
    fillRow(board, ROWS - 1);
    const result = clearLines(board);
    expect(result.board[ROWS - 1][0]).toBe('T');
    expect(result.board[ROWS - 2][0]).toBeNull();
  });

  it('clears multiple non-adjacent rows at once', () => {
    const board = createBoard();
    fillRow(board, ROWS - 1);
    board[ROWS - 2][4] = 'S';
    fillRow(board, ROWS - 3);
    const result = clearLines(board);
    expect(result.cleared).toBe(2);
    expect(result.board[ROWS - 1][4]).toBe('S');
  });

  it('clears four rows (a tetris)', () => {
    const board = createBoard();
    for (let y = ROWS - 4; y < ROWS; y++) fillRow(board, y);
    expect(clearLines(board).cleared).toBe(4);
  });
});

describe('scoring and progression', () => {
  it('awards the classic line clear rewards multiplied by level', () => {
    expect(scoreForLines(0, 1)).toBe(0);
    expect(scoreForLines(1, 1)).toBe(100);
    expect(scoreForLines(2, 1)).toBe(300);
    expect(scoreForLines(3, 1)).toBe(500);
    expect(scoreForLines(4, 1)).toBe(800);
    expect(scoreForLines(4, 3)).toBe(2400);
  });

  it('caps rewards at the four-line value', () => {
    expect(scoreForLines(7, 1)).toBe(800);
  });

  it('increases the level every ten lines', () => {
    expect(levelForLines(0)).toBe(1);
    expect(levelForLines(9)).toBe(1);
    expect(levelForLines(10)).toBe(2);
    expect(levelForLines(25)).toBe(3);
  });

  it('speeds up with level but never below 90ms', () => {
    expect(dropInterval(1)).toBe(800);
    expect(dropInterval(2)).toBe(735);
    expect(dropInterval(2)).toBeLessThan(dropInterval(1));
    expect(dropInterval(50)).toBe(90);
  });
});
