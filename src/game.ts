export const COLUMNS = 10;
export const ROWS = 20;

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type Matrix = number[][];
export type Piece = { type: PieceType; matrix: Matrix; x: number; y: number };
export type Board = (PieceType | null)[][];

export const SHAPES: Record<PieceType, Matrix> = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};

const LINE_REWARDS = [0, 100, 300, 500, 800];

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<PieceType | null>(COLUMNS).fill(null));
}

export function createPiece(type: PieceType): Piece {
  const matrix = SHAPES[type].map((row) => [...row]);
  return { type, matrix, x: Math.floor((COLUMNS - matrix[0].length) / 2), y: 0 };
}

/** Returns a shuffled copy of all seven piece types (one "bag"). */
export function shuffledBag(random: () => number = Math.random): PieceType[] {
  const types = Object.keys(SHAPES) as PieceType[];
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

export function collision(board: Board, piece: Piece, dx = 0, dy = 0, matrix: Matrix = piece.matrix): boolean {
  return matrix.some((row, rowIndex) => row.some((value, columnIndex) => {
    if (!value) return false;
    const x = piece.x + columnIndex + dx;
    const y = piece.y + rowIndex + dy;
    return x < 0 || x >= COLUMNS || y >= ROWS || (y >= 0 && board[y][x] !== null);
  }));
}

/** Rotates a matrix 90 degrees clockwise. */
export function rotate(matrix: Matrix): Matrix {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]).reverse());
}

/**
 * Tries to rotate a piece, using simple horizontal wall kicks.
 * Returns the rotated matrix and x offset, or null if no kick fits.
 */
export function tryRotate(board: Board, piece: Piece): { matrix: Matrix; offset: number } | null {
  const rotated = rotate(piece.matrix);
  for (const offset of [0, -1, 1, -2, 2]) {
    if (!collision(board, piece, offset, 0, rotated)) return { matrix: rotated, offset };
  }
  return null;
}

/** Number of rows the piece can fall before it lands. */
export function dropDistance(board: Board, piece: Piece): number {
  let distance = 0;
  while (!collision(board, piece, 0, distance + 1)) distance++;
  return distance;
}

/** Returns a new board with the piece written into it (cells above the board are ignored). */
export function mergePiece(board: Board, piece: Piece): Board {
  const next = board.map((row) => [...row]);
  piece.matrix.forEach((row, y) => row.forEach((value, x) => {
    const boardY = piece.y + y;
    const boardX = piece.x + x;
    if (value && boardY >= 0) next[boardY][boardX] = piece.type;
  }));
  return next;
}

/** Removes full rows and pads the top with empty rows. */
export function clearLines(board: Board): { board: Board; cleared: number } {
  const remaining = board.filter((row) => !row.every((cell) => cell !== null));
  const cleared = board.length - remaining.length;
  const padding = Array.from({ length: cleared }, () => Array<PieceType | null>(COLUMNS).fill(null));
  return { board: [...padding, ...remaining], cleared };
}

export function scoreForLines(cleared: number, level: number): number {
  return cleared > 0 ? (LINE_REWARDS[cleared] ?? 800) * level : 0;
}

export function levelForLines(lines: number): number {
  return Math.floor(lines / 10) + 1;
}

/** Milliseconds between automatic drops. */
export function dropInterval(level: number): number {
  return Math.max(90, 800 - (level - 1) * 65);
}
