import type {
	Chest,
	ChestContents,
	Dungeon,
	DungeonRequest,
} from "../domain/dungeon.js";
import { GenerationError, RequestError } from "../domain/errors.js";
import type { Point } from "../domain/geometry.js";
import { placeFeatures } from "../domain/placement.js";
import { openAround, removeThinWalls } from "../domain/postprocess.js";
import { createRng, type Rng } from "../domain/rng.js";
import { type Issue, validateLayout } from "../domain/validation.js";
import { createDefaultRegistry, type GeneratorRegistry } from "./registry.js";

export const MIN_MAP_SIZE = 7;
/** ツクールMV/MZのマップサイズ上限。 */
export const MAX_MAP_SIZE = 256;

export interface GenerateOptions {
	readonly registry?: GeneratorRegistry;
	/** 破綻のない結果が得られるまで作り直す回数の上限。 */
	readonly maxAttempts?: number;
}

export interface GenerationResult {
	readonly dungeon: Dungeon;
	/** 何回目の試行で成功したか(1始まり)。 */
	readonly attempts: number;
}

const GOLD_AMOUNTS = [50, 100, 150, 200, 300, 500] as const;

/**
 * 要求からダンジョンを生成する。
 * 生成 → 後処理 → 配置 → 検証 を行い、検証に通ったものだけを返す。
 */
export function generateDungeon(
	request: DungeonRequest,
	options: GenerateOptions = {},
): GenerationResult {
	const registry = options.registry ?? createDefaultRegistry();
	const maxAttempts = options.maxAttempts ?? 50;

	const generator = registry.get(request.algorithm);
	const problems = checkRequest(request);
	if (!generator) {
		problems.push(
			`未知のアルゴリズムです: ${request.algorithm}(利用可能: ${registry.names().join(", ")})`,
		);
	}
	if (problems.length > 0 || !generator) throw new RequestError(problems);

	const chestRequests = request.chests === "auto" ? undefined : request.chests;
	const fixedChests = (chestRequests ?? [])
		.map((c) => c.position)
		.filter((p): p is Point => p !== undefined);
	const anchors = [
		request.entrance.position,
		request.exit?.position,
		...fixedChests,
	].filter((p): p is Point => p !== undefined);

	let lastIssues: Issue[] = [];
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		// 試行ごとに独立した乱数列を使う。同じシードなら同じ試行で同じ結果になる。
		const rng = createRng(`${request.seed}#${attempt}`);
		const layout = generator.generate(
			{
				width: request.width,
				height: request.height,
				anchors,
				options: request.algorithmOptions,
			},
			rng,
		);
		const grid = layout.grid.clone();
		for (const chest of fixedChests) openAround(grid, chest);
		removeThinWalls(grid);

		const chestPositions =
			chestRequests?.map((c) => c.position) ??
			new Array<undefined>(
				Math.max(1, Math.round(layout.rooms.length / 2)),
			).fill(undefined);
		const features = placeFeatures(
			grid,
			layout.rooms,
			{
				entrance: request.entrance.position,
				exit:
					request.exit === null ? "none" : (request.exit.position ?? "auto"),
				chests: chestPositions,
			},
			rng,
		);
		if (!features) {
			lastIssues = [];
			continue;
		}

		lastIssues = validateLayout(grid, features).filter(
			(i) => i.severity === "error",
		);
		if (lastIssues.length > 0) continue;

		const chests: Chest[] = features.chests.map((position, i) => {
			const requested = chestRequests?.[i];
			return {
				position,
				contents: requested?.contents ?? defaultContents(rng),
				message: requested?.message,
			};
		});

		return {
			attempts: attempt,
			dungeon: {
				seed: request.seed,
				grid,
				rooms: layout.rooms,
				entrance: {
					position: features.entrance,
					transfer: request.entrance.transfer,
				},
				exit: features.exit
					? { position: features.exit, transfer: request.exit?.transfer }
					: undefined,
				chests,
			},
		};
	}

	throw new GenerationError(
		`${maxAttempts} 回試しましたが、破綻のないダンジョンを生成できませんでした。マップを広げるか、指定を減らしてみてください。`,
		lastIssues.map((i) => i.message),
	);
}

function defaultContents(rng: Rng): ChestContents {
	return { kind: "gold", amount: rng.pick(GOLD_AMOUNTS) };
}

/** 生成を試すまでもなく成立しない指定を洗い出す。 */
function checkRequest(request: DungeonRequest): string[] {
	const problems: string[] = [];
	const { width, height } = request;

	for (const [label, value] of [
		["幅", width],
		["高さ", height],
	] as const) {
		if (
			!Number.isInteger(value) ||
			value < MIN_MAP_SIZE ||
			value > MAX_MAP_SIZE
		) {
			problems.push(
				`${label}は ${MIN_MAP_SIZE}〜${MAX_MAP_SIZE} の整数で指定してください(指定値: ${value})`,
			);
		}
	}
	if (problems.length > 0) return problems;

	const fixed: Array<{ label: string; at: Point }> = [];
	if (request.entrance.position) {
		fixed.push({ label: "入口", at: request.entrance.position });
	}
	if (request.exit?.position) {
		fixed.push({ label: "出口", at: request.exit.position });
	}
	if (request.chests !== "auto") {
		request.chests.forEach((chest, i) => {
			if (chest.position)
				fixed.push({ label: `宝箱${i + 1}`, at: chest.position });
		});
	}

	const seen = new Map<string, string>();
	for (const { label, at } of fixed) {
		const inside =
			Number.isInteger(at.x) &&
			Number.isInteger(at.y) &&
			at.x >= 1 &&
			at.y >= 1 &&
			at.x <= width - 2 &&
			at.y <= height - 2;
		if (!inside) {
			problems.push(
				`${label} (${at.x}, ${at.y}) は外周を除いた範囲 x=1〜${width - 2}, y=1〜${height - 2} に置いてください`,
			);
			continue;
		}
		const key = `${at.x},${at.y}`;
		const other = seen.get(key);
		if (other) {
			problems.push(
				`${label} と ${other} が同じ位置 (${at.x}, ${at.y}) に指定されています`,
			);
		}
		seen.set(key, label);
	}
	return problems;
}
