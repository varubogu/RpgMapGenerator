import { describe, expect, it } from "vitest";
import { validateLayout } from "../src/domain/validation.js";
import { gridFrom } from "./helpers.js";

const codes = (issues: ReturnType<typeof validateLayout>) =>
	issues.map((i) => i.code);

describe("validateLayout", () => {
	it("問題のない配置はエラーなし", () => {
		const grid = gridFrom([
			"#######",
			"#.....#",
			"#.....#",
			"#.....#",
			"#######",
		]);
		const issues = validateLayout(grid, {
			entrance: { x: 1, y: 1 },
			exit: { x: 5, y: 3 },
			chests: [{ x: 5, y: 1 }],
		});
		expect(issues).toEqual([]);
	});

	it("壁に囲まれた宝箱を検出する", () => {
		const grid = gridFrom([
			"#######",
			"#...#.#",
			"#...###",
			"#.....#",
			"#######",
		]);
		const issues = validateLayout(grid, {
			entrance: { x: 1, y: 1 },
			chests: [{ x: 5, y: 1 }],
		});
		expect(codes(issues)).toContain("chest-unreachable");
	});

	it("宝箱が一本道を塞いで出口に行けない配置を検出する", () => {
		const grid = gridFrom(["#######", "#.....#", "#######"]);
		const issues = validateLayout(grid, {
			entrance: { x: 1, y: 1 },
			exit: { x: 5, y: 1 },
			chests: [{ x: 3, y: 1 }],
		});
		expect(codes(issues)).toContain("exit-unreachable");
		expect(codes(issues)).toContain("isolated-floor");
	});

	it("宝箱同士が塞ぎ合って取れない宝箱を検出する", () => {
		const grid = gridFrom(["######", "#....#", "######"]);
		const issues = validateLayout(grid, {
			entrance: { x: 1, y: 1 },
			chests: [
				{ x: 3, y: 1 },
				{ x: 4, y: 1 },
			],
		});
		expect(issues.filter((i) => i.code === "chest-unreachable")).toHaveLength(
			1,
		);
	});

	it("孤立した床を検出する", () => {
		const grid = gridFrom(["#######", "#..#..#", "#######"]);
		const issues = validateLayout(grid, {
			entrance: { x: 1, y: 1 },
			chests: [],
		});
		expect(codes(issues)).toEqual(["isolated-floor"]);
	});

	it("外周の穴と、壁の上や重複した要素を検出する", () => {
		const open = gridFrom(["##.##", "#...#", "#####"]);
		expect(
			codes(validateLayout(open, { entrance: { x: 1, y: 1 }, chests: [] })),
		).toContain("open-border");

		const grid = gridFrom(["#####", "#...#", "#####"]);
		expect(
			codes(
				validateLayout(grid, {
					entrance: { x: 1, y: 1 },
					chests: [{ x: 0, y: 0 }],
				}),
			),
		).toEqual(["feature-out-of-place"]);
		expect(
			codes(
				validateLayout(grid, {
					entrance: { x: 1, y: 1 },
					chests: [{ x: 1, y: 1 }],
				}),
			),
		).toEqual(["feature-overlap"]);
	});
});
