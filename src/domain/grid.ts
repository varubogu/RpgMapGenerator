import type { Point } from "./geometry.js";

/** セル種別。将来 水・穴 などを足せるよう数値の列挙にしている。 */
export const Cell = { Wall: 0, Floor: 1 } as const;
export type Cell = (typeof Cell)[keyof typeof Cell];

/** ダンジョンの地形。外周1マスは必ず壁として扱う。 */
export class Grid {
	private readonly cells: Uint8Array;

	constructor(
		readonly width: number,
		readonly height: number,
		cells?: Uint8Array,
	) {
		if (!Number.isInteger(width) || !Number.isInteger(height)) {
			throw new RangeError("Grid のサイズは整数である必要があります");
		}
		if (width < 1 || height < 1) {
			throw new RangeError("Grid のサイズは1以上である必要があります");
		}
		this.cells = cells
			? Uint8Array.from(cells)
			: new Uint8Array(width * height);
		if (this.cells.length !== width * height) {
			throw new RangeError("セル配列の長さがサイズと一致しません");
		}
	}

	get size(): number {
		return this.width * this.height;
	}

	index(x: number, y: number): number {
		return y * this.width + x;
	}

	indexOf(p: Point): number {
		return this.index(p.x, p.y);
	}

	pointAt(index: number): Point {
		return { x: index % this.width, y: Math.floor(index / this.width) };
	}

	inBounds(x: number, y: number): boolean {
		return x >= 0 && y >= 0 && x < this.width && y < this.height;
	}

	/** 外周を除いた内側かどうか。床にできるのは内側だけ。 */
	isInterior(x: number, y: number): boolean {
		return x >= 1 && y >= 1 && x <= this.width - 2 && y <= this.height - 2;
	}

	/** 範囲外は壁として返す。 */
	get(x: number, y: number): Cell {
		if (!this.inBounds(x, y)) return Cell.Wall;
		return this.cells[this.index(x, y)] as Cell;
	}

	isFloor(x: number, y: number): boolean {
		return this.get(x, y) === Cell.Floor;
	}

	set(x: number, y: number, cell: Cell): void {
		if (!this.inBounds(x, y)) {
			throw new RangeError(`範囲外のセルです: (${x}, ${y})`);
		}
		this.cells[this.index(x, y)] = cell;
	}

	/** 内側のセルだけを床にする。外周や範囲外は無視する。 */
	carve(x: number, y: number): void {
		if (this.isInterior(x, y)) this.cells[this.index(x, y)] = Cell.Floor;
	}

	clone(): Grid {
		return new Grid(this.width, this.height, this.cells);
	}

	floorCells(): Point[] {
		const result: Point[] = [];
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				if (this.isFloor(x, y)) result.push({ x, y });
			}
		}
		return result;
	}
}
