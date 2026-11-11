import { distancesFrom } from "./connectivity.js";
import { DIRS4, type Point } from "./geometry.js";
import type { Grid } from "./grid.js";

export interface Issue {
	readonly severity: "error" | "warning";
	readonly code:
		| "open-border"
		| "feature-out-of-place"
		| "feature-overlap"
		| "exit-unreachable"
		| "chest-unreachable"
		| "isolated-floor";
	readonly message: string;
	readonly at?: Point;
}

/** 検証対象。宝箱は通行不可の障害物として扱う。 */
export interface Features {
	readonly entrance: Point;
	readonly exit?: Point;
	readonly chests: readonly Point[];
}

const fmt = (p: Point): string => `(${p.x}, ${p.y})`;

/**
 * ダンジョンがゲームとして破綻していないかを検証する。
 * 生成ロジックとは独立しているので、生成側にバグがあってもここで検出できる。
 */
export function validateLayout(grid: Grid, features: Features): Issue[] {
	const issues: Issue[] = [];
	const error = (code: Issue["code"], message: string, at?: Point): void => {
		issues.push({ severity: "error", code, message, at });
	};

	// 1. 外周が閉じていること
	for (let x = 0; x < grid.width; x++) {
		for (const y of [0, grid.height - 1]) {
			if (grid.isFloor(x, y)) {
				error("open-border", `外周 ${fmt({ x, y })} が床になっています`, {
					x,
					y,
				});
			}
		}
	}
	for (let y = 1; y < grid.height - 1; y++) {
		for (const x of [0, grid.width - 1]) {
			if (grid.isFloor(x, y)) {
				error("open-border", `外周 ${fmt({ x, y })} が床になっています`, {
					x,
					y,
				});
			}
		}
	}

	// 2. 各要素が床の上にあり、重なっていないこと
	const named: Array<{ label: string; at: Point }> = [
		{ label: "入口", at: features.entrance },
	];
	if (features.exit) named.push({ label: "出口", at: features.exit });
	features.chests.forEach((at, i) => {
		named.push({ label: `宝箱${i + 1}`, at });
	});

	const seen = new Map<number, string>();
	for (const { label, at } of named) {
		if (!grid.isInterior(at.x, at.y) || !grid.isFloor(at.x, at.y)) {
			error(
				"feature-out-of-place",
				`${label} ${fmt(at)} が床の上にありません`,
				at,
			);
			continue;
		}
		const index = grid.indexOf(at);
		const other = seen.get(index);
		if (other) {
			error(
				"feature-overlap",
				`${label} と ${other} が同じ位置 ${fmt(at)} にあります`,
				at,
			);
		}
		seen.set(index, label);
	}
	// 前提が崩れていると到達判定に意味がないので打ち切る
	if (issues.length > 0) return issues;

	// 3. 宝箱を障害物とみなした上での到達可能性
	const blocked = new Set(features.chests.map((c) => grid.indexOf(c)));
	const dist = distancesFrom(grid, features.entrance, blocked);
	const reachable = (p: Point): boolean =>
		grid.inBounds(p.x, p.y) && (dist[grid.indexOf(p)] as number) >= 0;

	if (features.exit && !reachable(features.exit)) {
		error(
			"exit-unreachable",
			`入口から出口 ${fmt(features.exit)} に到達できません`,
			features.exit,
		);
	}

	features.chests.forEach((chest, i) => {
		const accessible = DIRS4.some((d) =>
			reachable({ x: chest.x + d.x, y: chest.y + d.y }),
		);
		if (!accessible) {
			error(
				"chest-unreachable",
				`宝箱${i + 1} ${fmt(chest)} に隣接できるマスへ到達できません`,
				chest,
			);
		}
	});

	let isolated = 0;
	let firstIsolated: Point | undefined;
	for (const cell of grid.floorCells()) {
		const index = grid.indexOf(cell);
		if (blocked.has(index) || (dist[index] as number) >= 0) continue;
		isolated++;
		firstIsolated ??= cell;
	}
	if (isolated > 0 && firstIsolated) {
		error(
			"isolated-floor",
			`入口から到達できない床が ${isolated} マスあります(例: ${fmt(firstIsolated)})`,
			firstIsolated,
		);
	}

	return issues;
}

export function isPlayable(grid: Grid, features: Features): boolean {
	return validateLayout(grid, features).every((i) => i.severity !== "error");
}
