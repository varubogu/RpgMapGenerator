import type { Dungeon } from "../../domain/dungeon.js";
import type { Grid } from "../../domain/grid.js";
import {
	floorAutotileShape,
	type SameFn,
	wallAutotileShape,
} from "./autotile.js";
import type { RpgMakerOptions } from "./options.js";
import { autotileType, resolveTileRef } from "./tileId.js";

/** マップデータのレイヤー数(下層2・上層2・影・リージョン)。 */
export const LAYER_COUNT = 6;
const LAYER_GROUND = 0;
const LAYER_UPPER = 2;
const LAYER_SHADOW = 4;
const LAYER_REGION = 5;
/** 影のビット(左上1・右上2・左下4・右下8)。左半分に影を落とす。 */
const SHADOW_LEFT_HALF = 5;

export type TileClass = "floor" | "wallSide" | "wallTop";

/** セルを見た目上の種類に分類する。床のすぐ上の壁は「壁の側面」になる。 */
export function classifyCell(grid: Grid, x: number, y: number): TileClass {
	if (grid.isFloor(x, y)) return "floor";
	return grid.isFloor(x, y + 1) ? "wallSide" : "wallTop";
}

/** MapXXX.json の data 配列を組み立てる。添字は (z * height + y) * width + x。 */
export function buildMapData(
	dungeon: Dungeon,
	options: RpgMakerOptions,
): number[] {
	const { grid } = dungeon;
	const { width, height } = grid;
	const data = new Array<number>(width * height * LAYER_COUNT).fill(0);
	const at = (x: number, y: number, z: number): number =>
		(z * height + y) * width + x;

	const baseTiles: Record<TileClass, number> = {
		floor: resolveTileRef(options.tiles.floor),
		wallSide: resolveTileRef(options.tiles.wallSide),
		wallTop: resolveTileRef(options.tiles.wallTop),
	};

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const tileClass = classifyCell(grid, x, y);
			const base = baseTiles[tileClass];
			// マップ外は同種とみなす(エディタと同じ挙動で、端に縁取りが出ない)
			const same: SameFn = (dx, dy) =>
				!grid.inBounds(x + dx, y + dy) ||
				classifyCell(grid, x + dx, y + dy) === tileClass;

			const type = autotileType(base);
			data[at(x, y, LAYER_GROUND)] =
				type === "floor"
					? base + floorAutotileShape(same)
					: type === "wall"
						? base + wallAutotileShape(same)
						: base;

			const isFloor = tileClass === "floor";
			if (
				options.autoShadow &&
				isFloor &&
				x > 0 &&
				!grid.isFloor(x - 1, y) &&
				!grid.isFloor(x - 1, y - 1)
			) {
				data[at(x, y, LAYER_SHADOW)] = SHADOW_LEFT_HALF;
			}

			const region = isFloor ? options.regions.floor : options.regions.wall;
			if (region !== undefined) data[at(x, y, LAYER_REGION)] = region;
		}
	}

	const decorate = (
		position: { x: number; y: number } | undefined,
		tile: RpgMakerOptions["tiles"]["entrance"],
	): void => {
		if (!position || tile === undefined) return;
		data[at(position.x, position.y, LAYER_UPPER)] = resolveTileRef(tile);
	};
	decorate(dungeon.entrance.position, options.tiles.entrance);
	decorate(dungeon.exit?.position, options.tiles.exit);

	return data;
}
