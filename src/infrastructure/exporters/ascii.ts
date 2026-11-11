import type { DungeonExporter } from "../../application/exporter.js";
import type { Dungeon } from "../../domain/dungeon.js";

export const ASCII_LEGEND = "# 壁  . 床  S 入口  G 出口  C 宝箱";

/** 確認用のテキスト表現に変換する。 */
export function renderAscii(dungeon: Dungeon): string {
	const { grid } = dungeon;
	const rows: string[][] = [];
	for (let y = 0; y < grid.height; y++) {
		const row: string[] = [];
		for (let x = 0; x < grid.width; x++)
			row.push(grid.isFloor(x, y) ? "." : "#");
		rows.push(row);
	}
	const mark = (p: { x: number; y: number }, ch: string): void => {
		const row = rows[p.y];
		if (row) row[p.x] = ch;
	};
	for (const chest of dungeon.chests) mark(chest.position, "C");
	if (dungeon.exit) mark(dungeon.exit.position, "G");
	mark(dungeon.entrance.position, "S");
	return `${rows.map((row) => row.join("")).join("\n")}\n`;
}

export const asciiExporter: DungeonExporter = {
	format: "ascii",
	export: (dungeon) => renderAscii(dungeon),
};
