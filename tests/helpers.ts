import type { DungeonRequest } from "../src/domain/dungeon.js";
import { Cell, Grid } from "../src/domain/grid.js";

/** '#' を壁、それ以外を床としてグリッドを作る。 */
export function gridFrom(rows: string[]): Grid {
	const grid = new Grid(rows[0]?.length ?? 0, rows.length);
	rows.forEach((row, y) => {
		[...row].forEach((ch, x) => {
			grid.set(x, y, ch === "#" ? Cell.Wall : Cell.Floor);
		});
	});
	return grid;
}

export function request(
	overrides: Partial<DungeonRequest> = {},
): DungeonRequest {
	return {
		width: 40,
		height: 30,
		seed: "test",
		algorithm: "rooms",
		algorithmOptions: {},
		entrance: {},
		exit: {},
		chests: "auto",
		...overrides,
	};
}
