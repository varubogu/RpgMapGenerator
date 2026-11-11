import { describe, expect, it } from "vitest";
import { generateDungeon } from "../src/application/generateDungeon.js";
import { GeneratorRegistry } from "../src/application/registry.js";
import { GenerationError, RequestError } from "../src/domain/errors.js";
import type { LayoutGenerator } from "../src/domain/generator.js";
import { Grid } from "../src/domain/grid.js";
import { validateLayout } from "../src/domain/validation.js";
import { renderAscii } from "../src/infrastructure/exporters/ascii.js";
import { request } from "./helpers.js";

const features = (d: ReturnType<typeof generateDungeon>["dungeon"]) => ({
	entrance: d.entrance.position,
	exit: d.exit?.position,
	chests: d.chests.map((c) => c.position),
});

describe("generateDungeon", () => {
	it("同じシードからは同じダンジョンができる", () => {
		const a = generateDungeon(request({ seed: "same" })).dungeon;
		const b = generateDungeon(request({ seed: "same" })).dungeon;
		const c = generateDungeon(request({ seed: "other" })).dungeon;
		expect(renderAscii(a)).toBe(renderAscii(b));
		expect(a.chests).toEqual(b.chests);
		expect(renderAscii(a)).not.toBe(renderAscii(c));
	});

	it("さまざまなシード・サイズで破綻しない", () => {
		const sizes = [
			[7, 7],
			[12, 9],
			[25, 20],
			[40, 30],
			[80, 60],
		] as const;
		for (const [width, height] of sizes) {
			for (let seed = 0; seed < 60; seed++) {
				const { dungeon } = generateDungeon(
					request({
						width,
						height,
						seed: `s${seed}`,
						algorithmOptions: { loopChance: 0.3 },
					}),
				);
				const issues = validateLayout(dungeon.grid, features(dungeon));
				expect(issues, `${width}x${height} seed=s${seed}`).toEqual([]);
				expect(dungeon.exit, "出口は自動で置かれる").toBeDefined();
				expect(dungeon.chests.length).toBeGreaterThan(0);
			}
		}
	});

	it("指定した位置をそのまま使い、破綻しない", () => {
		for (let seed = 0; seed < 100; seed++) {
			const { dungeon } = generateDungeon(
				request({
					seed: `fixed${seed}`,
					entrance: { position: { x: 1, y: 1 } },
					exit: { position: { x: 38, y: 28 } },
					chests: [
						{
							position: { x: 20, y: 15 },
							contents: { kind: "item", itemId: 3, amount: 2 },
						},
						{ position: { x: 1, y: 28 } },
						// 通路になりやすい入口と出口の間に並べる
						{ position: { x: 10, y: 1 } },
						{},
					],
				}),
			);
			expect(dungeon.entrance.position).toEqual({ x: 1, y: 1 });
			expect(dungeon.exit?.position).toEqual({ x: 38, y: 28 });
			expect(dungeon.chests[0]).toMatchObject({
				position: { x: 20, y: 15 },
				contents: { kind: "item", itemId: 3, amount: 2 },
			});
			expect(dungeon.chests[1]?.position).toEqual({ x: 1, y: 28 });
			expect(dungeon.chests[2]?.position).toEqual({ x: 10, y: 1 });
			expect(dungeon.chests).toHaveLength(4);
			expect(validateLayout(dungeon.grid, features(dungeon))).toEqual([]);
		}
	});

	it("exit: null なら出口を置かず、chests: [] なら宝箱を置かない", () => {
		const { dungeon } = generateDungeon(request({ exit: null, chests: [] }));
		expect(dungeon.exit).toBeUndefined();
		expect(dungeon.chests).toEqual([]);
	});

	it("自動配置の入口と出口は十分離れる", () => {
		const { dungeon } = generateDungeon(request({ width: 60, height: 40 }));
		const a = dungeon.entrance.position;
		const b = dungeon.exit?.position ?? a;
		expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeGreaterThan(20);
	});

	it("成立しない指定は生成前にまとめて報告する", () => {
		const bad = request({
			entrance: { position: { x: 0, y: 5 } },
			exit: { position: { x: 5, y: 5 } },
			chests: [{ position: { x: 5, y: 5 } }],
		});
		expect(() => generateDungeon(bad)).toThrow(RequestError);
		try {
			generateDungeon(bad);
		} catch (e) {
			expect((e as RequestError).problems).toHaveLength(2);
		}
		expect(() => generateDungeon(request({ width: 3 }))).toThrow(RequestError);
		expect(() => generateDungeon(request({ algorithm: "nope" }))).toThrow(
			/未知のアルゴリズム/,
		);
	});

	it("壊れたジェネレータの結果は検証で弾かれ、出力されない", () => {
		// 2つの部屋をつなぎ忘れるジェネレータ
		const broken: LayoutGenerator = {
			name: "broken",
			generate: ({ width, height }) => {
				const grid = new Grid(width, height);
				for (let y = 1; y <= 3; y++) {
					for (let x = 1; x <= 3; x++) grid.carve(x, y);
					for (let x = width - 4; x <= width - 2; x++) grid.carve(x, y);
				}
				return { grid, rooms: [] };
			},
		};
		const registry = new GeneratorRegistry([broken]);
		expect(() =>
			generateDungeon(request({ algorithm: "broken" }), {
				registry,
				maxAttempts: 3,
			}),
		).toThrow(GenerationError);
	});
});
