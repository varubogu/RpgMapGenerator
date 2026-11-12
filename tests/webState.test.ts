import { describe, expect, it } from "vitest";
import { generateDungeon } from "../src/application/generateDungeon.js";
import { resolveConfig } from "../src/infrastructure/config/schema.js";
import {
	decodeState,
	defaultState,
	encodeState,
	toConfig,
} from "../web/src/state.js";

describe("Web版の状態", () => {
	it("既定の状態から生成まで通る", () => {
		const state = { ...defaultState(), seed: "web" };
		const { request } = resolveConfig(toConfig(state));
		expect(request.chests).toBe("auto");
		expect(() => generateDungeon({ ...request, seed: "web" })).not.toThrow();
	});

	it("固定した位置と出口なしを設定に反映する", () => {
		const state = {
			...defaultState(),
			hasExit: false,
			autoChests: 2,
			entrance: { x: 2, y: 3 },
			chests: [{ x: 10, y: 10 }],
		};
		const { request } = resolveConfig(toConfig(state));
		expect(request.entrance.position).toEqual({ x: 2, y: 3 });
		expect(request.exit).toBeNull();
		expect(request.chests).toHaveLength(3);
		expect(request.chests[0]).toMatchObject({ position: { x: 10, y: 10 } });
	});

	it("URL に保存した状態を復元できる", () => {
		const state = {
			...defaultState(),
			seed: "共有",
			width: 50,
			chests: [{ x: 5, y: 6 }],
		};
		expect(decodeState(encodeState(state))).toEqual(state);
	});

	it("壊れた値や範囲外の固定位置は取り込まない", () => {
		expect(decodeState("#%7Bbroken").width).toBe(40);
		const hash = `#${encodeURIComponent(
			JSON.stringify({
				width: "x",
				target: "vx",
				entrance: { x: 0, y: 0 },
				chests: [{ x: 999, y: 1 }, "bad", { x: 3, y: 3 }],
			}),
		)}`;
		const state = decodeState(hash);
		expect(state.width).toBe(40);
		expect(state.target).toBe("mz");
		expect(state.entrance).toBeNull();
		expect(state.chests).toEqual([{ x: 3, y: 3 }]);
	});
});
