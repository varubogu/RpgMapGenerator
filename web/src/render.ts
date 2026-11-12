import type { Dungeon, Point } from "../../src/index.js";

export interface Pins {
	readonly entrance: Point | null;
	readonly exit: Point | null;
	readonly chests: readonly Point[];
}

const COLORS = {
	wallTop: "#22242a",
	wallSide: "#54483a",
	floor: "#b9ae99",
	entrance: "#4fbf7a",
	exit: "#5b9df0",
	chest: "#e8b53a",
	pin: "#ffffff",
};

const MIN_CELL = 3;
const MAX_CELL = 22;

/** 表示領域に収まる1マスの大きさ(CSSピクセル)を決める。 */
export function cellSizeFor(
	dungeon: Dungeon,
	maxWidth: number,
	maxHeight: number,
): number {
	const fit = Math.floor(
		Math.min(maxWidth / dungeon.grid.width, maxHeight / dungeon.grid.height),
	);
	return Math.max(MIN_CELL, Math.min(MAX_CELL, fit));
}

export function drawDungeon(
	canvas: HTMLCanvasElement,
	dungeon: Dungeon,
	pins: Pins,
	cell: number,
): void {
	const { grid } = dungeon;
	const ratio = window.devicePixelRatio || 1;
	canvas.width = Math.round(grid.width * cell * ratio);
	canvas.height = Math.round(grid.height * cell * ratio);
	canvas.style.width = `${grid.width * cell}px`;
	canvas.style.height = `${grid.height * cell}px`;

	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

	for (let y = 0; y < grid.height; y++) {
		for (let x = 0; x < grid.width; x++) {
			// 床のすぐ上の壁は、ツクール上では壁の側面として描かれる
			ctx.fillStyle = grid.isFloor(x, y)
				? COLORS.floor
				: grid.isFloor(x, y + 1)
					? COLORS.wallSide
					: COLORS.wallTop;
			ctx.fillRect(x * cell, y * cell, cell, cell);
		}
	}

	const samePoint = (a: Point | null, b: Point): boolean =>
		a !== null && a.x === b.x && a.y === b.y;
	const inset = Math.max(0.5, cell * 0.12);
	const marker = (p: Point, color: string, pinned: boolean): void => {
		ctx.fillStyle = color;
		ctx.fillRect(
			p.x * cell + inset,
			p.y * cell + inset,
			cell - inset * 2,
			cell - inset * 2,
		);
		if (pinned) {
			ctx.strokeStyle = COLORS.pin;
			ctx.lineWidth = Math.max(1, cell * 0.12);
			ctx.strokeRect(p.x * cell + 0.5, p.y * cell + 0.5, cell - 1, cell - 1);
		}
	};

	for (const chest of dungeon.chests) {
		marker(
			chest.position,
			COLORS.chest,
			pins.chests.some((p) => samePoint(p, chest.position)),
		);
	}
	if (dungeon.exit) {
		marker(
			dungeon.exit.position,
			COLORS.exit,
			samePoint(pins.exit, dungeon.exit.position),
		);
	}
	marker(
		dungeon.entrance.position,
		COLORS.entrance,
		samePoint(pins.entrance, dungeon.entrance.position),
	);
}
