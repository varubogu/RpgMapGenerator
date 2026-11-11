import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateDungeon } from "../src/application/generateDungeon.js";
import { loadConfigFile } from "../src/infrastructure/config/load.js";
import {
	ConfigError,
	resolveConfig,
} from "../src/infrastructure/config/schema.js";

describe("resolveConfig", () => {
	it("最小構成では残りを既定値で補う", () => {
		const { request, output } = resolveConfig({
			size: { width: 30, height: 20 },
		});
		expect(request).toMatchObject({
			width: 30,
			height: 20,
			algorithm: "rooms",
			entrance: {},
			exit: {},
			chests: "auto",
		});
		expect(request.seed).toBeUndefined();
		expect(output.format).toBe("rpgmaker");
		expect(output.rpgmaker).toMatchObject({
			target: "mz",
			tilesetId: 4,
			autoShadow: true,
		});
	});

	it("各指定をドメインの要求に変換する", () => {
		const { request, output } = resolveConfig({
			seed: 42,
			size: { width: 30, height: 20 },
			rooms: { count: 5, loopChance: 0.5 },
			entrance: {
				x: 2,
				y: 3,
				transfer: { mapId: 1, x: 4, y: 5, direction: 8 },
			},
			exit: false,
			chests: [{ x: 5, y: 6, item: 9, amount: 3 }, { gold: 100 }, {}],
			output: {
				format: "json",
				rpgmaker: { target: "mv", tiles: { floor: { sheet: "A5", index: 1 } } },
			},
		});
		expect(request.seed).toBe("42");
		expect(request.algorithmOptions).toEqual({ roomCount: 5, loopChance: 0.5 });
		expect(request.entrance).toEqual({
			position: { x: 2, y: 3 },
			transfer: { mapId: 1, x: 4, y: 5, direction: 8 },
		});
		expect(request.exit).toBeNull();
		expect(request.chests).toEqual([
			{
				position: { x: 5, y: 6 },
				contents: { kind: "item", itemId: 9, amount: 3 },
				message: undefined,
			},
			{
				position: undefined,
				contents: { kind: "gold", amount: 100 },
				message: undefined,
			},
			{ position: undefined, contents: undefined, message: undefined },
		]);
		expect(output.format).toBe("json");
		expect(output.rpgmaker.target).toBe("mv");
		expect(output.rpgmaker.tiles.floor).toEqual({ sheet: "A5", index: 1 });
		expect(output.rpgmaker.tiles.wallTop).toBe(5888);
	});

	it("chests に数値を渡すと、その個数だけおまかせで置く", () => {
		expect(
			resolveConfig({ size: { width: 30, height: 20 }, chests: 3 }).request
				.chests,
		).toHaveLength(3);
	});

	it("不正な設定は場所付きで報告する", () => {
		const bad = {
			size: { width: 30 },
			entrance: { x: 1 },
			chests: [{ gold: 1, item: 2 }],
			typo: true,
		};
		expect(() => resolveConfig(bad)).toThrow(ConfigError);
		try {
			resolveConfig(bad);
		} catch (e) {
			const text = (e as ConfigError).problems.join("\n");
			expect(text).toContain("size.height");
			expect(text).toContain("entrance");
			expect(text).toContain("chests.0");
			expect(text).toContain("typo");
		}
	});
});

describe("examples/", () => {
	it("同梱のサンプル設定はすべて生成まで通る", async () => {
		const dir = join(import.meta.dirname, "..", "examples");
		const files = (await readdir(dir)).filter((f) => f.endsWith(".yaml"));
		expect(files.length).toBeGreaterThan(0);
		for (const file of files) {
			const config = await loadConfigFile(join(dir, file));
			const { dungeon } = generateDungeon({
				...config.request,
				seed: config.request.seed ?? "x",
			});
			expect(dungeon.grid.width, file).toBe(config.request.width);
		}
	});
});
