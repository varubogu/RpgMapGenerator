import type { DungeonExporter } from "../../application/exporter.js";
import type { Dungeon } from "../../domain/dungeon.js";

/** エンジン非依存の中間形式。他ツールへの橋渡しや差分確認に使う。 */
export function toIntermediate(dungeon: Dungeon) {
	const { grid } = dungeon;
	const cells: string[] = [];
	for (let y = 0; y < grid.height; y++) {
		let row = "";
		for (let x = 0; x < grid.width; x++) row += grid.isFloor(x, y) ? "." : "#";
		cells.push(row);
	}
	return {
		formatVersion: 1,
		seed: dungeon.seed,
		width: grid.width,
		height: grid.height,
		legend: { "#": "wall", ".": "floor" },
		cells,
		rooms: dungeon.rooms,
		entrance: dungeon.entrance,
		exit: dungeon.exit ?? null,
		chests: dungeon.chests,
	};
}

export const jsonExporter: DungeonExporter = {
	format: "json",
	export: (dungeon) => `${JSON.stringify(toIntermediate(dungeon), null, 2)}\n`,
};
