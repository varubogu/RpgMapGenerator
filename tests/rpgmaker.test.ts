import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Dungeon } from "../src/domain/dungeon.js";
import {
	floorAutotileShape,
	wallAutotileShape,
} from "../src/infrastructure/rpgmaker/autotile.js";
import { buildRpgMakerMap } from "../src/infrastructure/rpgmaker/map.js";
import { DEFAULT_RPGMAKER_OPTIONS } from "../src/infrastructure/rpgmaker/options.js";
import { writeMapToProject } from "../src/infrastructure/rpgmaker/project.js";
import {
	autotileType,
	resolveTileRef,
} from "../src/infrastructure/rpgmaker/tileId.js";
import { gridFrom } from "./helpers.js";

/** 同種の隣を方角の文字で指定する(n, ne, e, se, s, sw, w, nw)。 */
function same(...dirs: string[]) {
	const table: Record<string, string> = {
		"0,-1": "n",
		"1,-1": "ne",
		"1,0": "e",
		"1,1": "se",
		"0,1": "s",
		"-1,1": "sw",
		"-1,0": "w",
		"-1,-1": "nw",
	};
	return (dx: number, dy: number) =>
		dirs.includes(table[`${dx},${dy}`] as string);
}
const ALL = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

describe("オートタイルの形状", () => {
	it("床タイプ: FLOOR_AUTOTILE_TABLE の番号と一致する", () => {
		expect(floorAutotileShape(same(...ALL))).toBe(0);
		expect(floorAutotileShape(same(...ALL.filter((d) => d !== "nw")))).toBe(1);
		expect(floorAutotileShape(same("n", "e", "s", "w"))).toBe(15);
		expect(floorAutotileShape(same("n", "ne", "e", "se", "s"))).toBe(16);
		expect(floorAutotileShape(same("n", "e", "s"))).toBe(19);
		expect(floorAutotileShape(same("e", "se", "s", "sw", "w"))).toBe(20);
		expect(floorAutotileShape(same("n", "nw", "w", "sw", "s"))).toBe(24);
		expect(floorAutotileShape(same("n", "ne", "e", "w", "nw"))).toBe(28);
		expect(floorAutotileShape(same("n", "s"))).toBe(32);
		expect(floorAutotileShape(same("e", "w"))).toBe(33);
		expect(floorAutotileShape(same("e", "se", "s"))).toBe(34);
		expect(floorAutotileShape(same("e", "s"))).toBe(35);
		expect(floorAutotileShape(same("w", "sw", "s"))).toBe(36);
		expect(floorAutotileShape(same("n", "nw", "w"))).toBe(38);
		expect(floorAutotileShape(same("n", "ne", "e"))).toBe(40);
		expect(floorAutotileShape(same("s"))).toBe(42);
		expect(floorAutotileShape(same("e"))).toBe(43);
		expect(floorAutotileShape(same("n"))).toBe(44);
		expect(floorAutotileShape(same("w"))).toBe(45);
		expect(floorAutotileShape(same())).toBe(46);
		// 辺がある側の斜めは形状に影響しない
		expect(floorAutotileShape(same("n", "e", "se", "s", "nw", "sw"))).toBe(17);
	});

	it("壁タイプ: 左1・上2・右4・下8 のビット和", () => {
		expect(wallAutotileShape(same(...ALL))).toBe(0);
		expect(wallAutotileShape(same("e", "w"))).toBe(10);
		expect(wallAutotileShape(same())).toBe(15);
		expect(wallAutotileShape(same("n", "e", "s"))).toBe(1);
	});
});

describe("タイル指定", () => {
	it("シートと番号からタイルIDを求める", () => {
		expect(resolveTileRef({ sheet: "A2", index: 0 })).toBe(2816);
		expect(resolveTileRef({ sheet: "A4", index: 8 })).toBe(6272);
		expect(resolveTileRef({ sheet: "A5", index: 3 })).toBe(1539);
		expect(resolveTileRef({ sheet: "B", index: 10 })).toBe(10);
		expect(resolveTileRef(2816 + 20)).toBe(2816);
		expect(() => resolveTileRef({ sheet: "A2", index: 32 })).toThrow(
			RangeError,
		);
	});

	it("オートタイルの接続方式を判別する", () => {
		expect(autotileType(1536)).toBe("none");
		expect(autotileType(2816)).toBe("floor");
		expect(autotileType(4352)).toBe("wall");
		expect(autotileType(5888)).toBe("floor");
		expect(autotileType(6272)).toBe("wall");
		expect(autotileType(5888 + 16 * 48)).toBe("floor");
	});
});

function sampleDungeon(): Dungeon {
	return {
		seed: "sample",
		grid: gridFrom([
			"#######",
			"#######",
			"#.....#",
			"#.....#",
			"#.....#",
			"#######",
		]),
		rooms: [{ x: 1, y: 2, width: 5, height: 3 }],
		entrance: { position: { x: 1, y: 2 }, transfer: { mapId: 2, x: 4, y: 5 } },
		exit: { position: { x: 5, y: 4 } },
		chests: [
			{ position: { x: 5, y: 2 }, contents: { kind: "gold", amount: 300 } },
			{
				position: { x: 3, y: 4 },
				contents: { kind: "item", itemId: 7, amount: 2 },
			},
		],
	};
}

describe("buildRpgMakerMap", () => {
	const map = buildRpgMakerMap(sampleDungeon(), {
		...DEFAULT_RPGMAKER_OPTIONS,
		regions: { floor: 1, wall: 2 },
		tiles: {
			...DEFAULT_RPGMAKER_OPTIONS.tiles,
			exit: { sheet: "B", index: 20 },
		},
	});
	const tile = (x: number, y: number, z = 0) =>
		map.data[(z * map.height + y) * map.width + x];

	it("data は 幅×高さ×6層", () => {
		expect(map.data).toHaveLength(7 * 6 * 6);
		expect(map.width).toBe(7);
		expect(map.height).toBe(6);
		expect(map.note).toContain("sample");
	});

	it("床・壁上面・壁側面を正しいオートタイルで敷く", () => {
		expect(tile(3, 3)).toBe(2816); // 部屋の中央: 縁なし
		expect(tile(1, 2)).toBe(2816 + 34); // 左上の角
		expect(tile(5, 4)).toBe(2816 + 38); // 右下の角
		expect(tile(3, 2)).toBe(2816 + 20); // 上辺
		expect(tile(3, 1)).toBe(6272 + 10); // 床のすぐ上は壁側面(上下に縁)
		expect(tile(1, 1)).toBe(6272 + 11); // 壁側面の左端
		expect(tile(0, 0)).toBe(5888 + 4); // 壁上面: 右下の斜めだけ別種(内角)
		expect(tile(0, 3)).toBe(5888 + 24); // 壁上面: 右に床
	});

	it("影・リージョン・装飾タイルを書き込む", () => {
		expect(tile(1, 3, 4)).toBe(5); // 左と左上が壁
		expect(tile(2, 3, 4)).toBe(0);
		expect(tile(3, 3, 5)).toBe(1);
		expect(tile(0, 0, 5)).toBe(2);
		expect(tile(5, 4, 2)).toBe(20);
	});

	it("入口・出口・宝箱のイベントを作る", () => {
		expect(map.events[0]).toBeNull();
		expect(map.events.map((e) => e?.name)).toEqual([
			undefined,
			"Entrance",
			"Exit",
			"Chest1",
			"Chest2",
		]);
		expect(map.events.map((e) => e?.id)).toEqual([undefined, 1, 2, 3, 4]);

		const entrance = map.events[1]?.pages[0];
		expect(entrance?.trigger).toBe(1);
		expect(entrance?.list.find((c) => c.code === 201)?.parameters).toEqual([
			0, 2, 4, 5, 0, 0,
		]);
		// 移動先が未指定の出口は注釈だけ
		expect(map.events[2]?.pages[0]?.list.map((c) => c.code)).toEqual([108, 0]);

		const gold = map.events[3];
		expect(gold).toMatchObject({ x: 5, y: 2 });
		expect(gold?.pages).toHaveLength(2);
		expect(gold?.pages[0]?.priorityType).toBe(1);
		expect(
			gold?.pages[0]?.list.find((c) => c.code === 125)?.parameters,
		).toEqual([0, 0, 300]);
		expect(
			gold?.pages[0]?.list.find((c) => c.code === 401)?.parameters,
		).toEqual(["300\\Gを手に入れた！"]);
		expect(gold?.pages[0]?.list.at(-1)?.code).toBe(0);
		expect(gold?.pages[1]?.conditions.selfSwitchValid).toBe(true);

		const item = map.events[4]?.pages[0]?.list.find((c) => c.code === 126);
		expect(item?.parameters).toEqual([7, 0, 0, 2]);
	});

	it("MV向けは文章表示の引数が4つ", () => {
		const mv = buildRpgMakerMap(sampleDungeon(), {
			...DEFAULT_RPGMAKER_OPTIONS,
			target: "mv",
		});
		expect(
			mv.events[3]?.pages[0]?.list.find((c) => c.code === 101)?.parameters,
		).toHaveLength(4);
		expect(
			map.events[3]?.pages[0]?.list.find((c) => c.code === 101)?.parameters,
		).toHaveLength(5);
	});
});

describe("writeMapToProject", () => {
	async function project(): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), "rpgmapgen-"));
		await mkdir(join(dir, "data"));
		const infos = [
			null,
			{
				id: 1,
				expanded: false,
				name: "MAP001",
				order: 1,
				parentId: 0,
				scrollX: 0,
				scrollY: 0,
			},
		];
		await writeFile(join(dir, "data", "MapInfos.json"), JSON.stringify(infos));
		return dir;
	}
	const map = buildRpgMakerMap(sampleDungeon(), DEFAULT_RPGMAKER_OPTIONS);
	const readInfos = async (dir: string) =>
		JSON.parse(await readFile(join(dir, "data", "MapInfos.json"), "utf8"));

	it("空いているIDに書き込み、MapInfos.json に登録する", async () => {
		const dir = await project();
		const result = await writeMapToProject(dir, map, { mapName: "Dungeon" });
		expect(result).toMatchObject({ mapId: 2, registered: true });
		const infos = await readInfos(dir);
		expect(infos[2]).toMatchObject({
			id: 2,
			name: "Dungeon",
			order: 2,
			parentId: 0,
		});
		expect(infos[1].name).toBe("MAP001");
		const written = JSON.parse(
			await readFile(join(dir, "data", "Map002.json"), "utf8"),
		);
		expect(written.width).toBe(7);
	});

	it("既存IDを指定すると上書きし、マップ一覧は変えない", async () => {
		const dir = await project();
		const before = await readFile(join(dir, "data", "MapInfos.json"), "utf8");
		const result = await writeMapToProject(dir, map, {
			mapId: 1,
			mapName: "Dungeon",
		});
		expect(result).toMatchObject({ mapId: 1, registered: false });
		expect(await readFile(join(dir, "data", "MapInfos.json"), "utf8")).toBe(
			before,
		);
	});

	it("飛び番のIDを指定すると間を null で埋める", async () => {
		const dir = await project();
		await writeMapToProject(dir, map, { mapId: 4, mapName: "Dungeon" });
		const infos = await readInfos(dir);
		expect(infos).toHaveLength(5);
		expect(infos[2]).toBeNull();
		expect(infos[4].id).toBe(4);
	});

	it("プロジェクトでないフォルダはエラーにする", async () => {
		const dir = await mkdtemp(join(tmpdir(), "rpgmapgen-"));
		await expect(writeMapToProject(dir, map, { mapName: "x" })).rejects.toThrow(
			/MapInfos\.json/,
		);
	});
});
