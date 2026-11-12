import type { Point } from "../../src/index.js";

/** 画面の入力状態。URL のハッシュに保存して、リンクで共有できるようにする。 */
export interface State {
	seed: string;
	width: number;
	height: number;
	roomCount: number | null;
	loopChance: number;
	minSize: number;
	maxSize: number;
	hasExit: boolean;
	/** null は個数もおまかせ。 */
	autoChests: number | null;
	target: "mv" | "mz";
	tilesetId: number;
	mapId: number;
	displayName: string;
	/** 位置を固定した入口・出口・宝箱。 */
	entrance: Point | null;
	exit: Point | null;
	chests: Point[];
}

export function randomSeed(): string {
	return Math.floor(Math.random() * 0xffffffff).toString(36);
}

export function defaultState(): State {
	return {
		seed: randomSeed(),
		width: 40,
		height: 30,
		roomCount: null,
		loopChance: 0.15,
		minSize: 4,
		maxSize: 8,
		hasExit: true,
		autoChests: null,
		target: "mz",
		tilesetId: 4,
		mapId: 1,
		displayName: "",
		entrance: null,
		exit: null,
		chests: [],
	};
}

const isPoint = (value: unknown): value is Point =>
	typeof value === "object" &&
	value !== null &&
	Number.isInteger((value as Point).x) &&
	Number.isInteger((value as Point).y);

/** 外周を除いた内側に収まらない固定位置を取り除く。 */
export function dropOutOfRangePins(state: State): void {
	const inside = (p: Point): boolean =>
		p.x >= 1 && p.y >= 1 && p.x <= state.width - 2 && p.y <= state.height - 2;
	if (state.entrance && !inside(state.entrance)) state.entrance = null;
	if (state.exit && !inside(state.exit)) state.exit = null;
	state.chests = state.chests.filter(inside);
}

/** URL のハッシュは外部入力なので、型の合う値だけを取り込む。 */
export function decodeState(hash: string): State {
	const state = defaultState();
	const encoded = hash.replace(/^#/, "");
	if (!encoded) return state;
	let raw: Record<string, unknown>;
	try {
		const parsed: unknown = JSON.parse(decodeURIComponent(encoded));
		if (typeof parsed !== "object" || parsed === null) return state;
		raw = parsed as Record<string, unknown>;
	} catch {
		return state;
	}

	const str = (key: "seed" | "displayName"): void => {
		const value = raw[key];
		if (typeof value === "string" && value.length <= 200) state[key] = value;
	};
	const num = (
		key:
			| "width"
			| "height"
			| "loopChance"
			| "minSize"
			| "maxSize"
			| "tilesetId"
			| "mapId",
	): void => {
		const value = raw[key];
		if (typeof value === "number" && Number.isFinite(value)) state[key] = value;
	};
	const optionalInt = (key: "roomCount" | "autoChests"): void => {
		const value = raw[key];
		if (
			value === null ||
			(typeof value === "number" && Number.isInteger(value))
		) {
			state[key] = value;
		}
	};
	str("seed");
	str("displayName");
	num("width");
	num("height");
	num("loopChance");
	num("minSize");
	num("maxSize");
	num("tilesetId");
	num("mapId");
	optionalInt("roomCount");
	optionalInt("autoChests");
	if (typeof raw.hasExit === "boolean") state.hasExit = raw.hasExit;
	if (raw.target === "mv" || raw.target === "mz") state.target = raw.target;
	if (isPoint(raw.entrance))
		state.entrance = { x: raw.entrance.x, y: raw.entrance.y };
	if (isPoint(raw.exit)) state.exit = { x: raw.exit.x, y: raw.exit.y };
	if (Array.isArray(raw.chests)) {
		state.chests = raw.chests
			.filter(isPoint)
			.slice(0, 100)
			.map((p) => ({ x: p.x, y: p.y }));
	}
	if (!state.seed) state.seed = randomSeed();
	dropOutOfRangePins(state);
	return state;
}

export function encodeState(state: State): string {
	return `#${encodeURIComponent(JSON.stringify(state))}`;
}

/** CLI と同じ書式の設定オブジェクトに変換する。 */
export function toConfig(state: State): Record<string, unknown> {
	const at = (p: Point) => ({ x: p.x, y: p.y });
	const rooms: Record<string, unknown> = {
		minSize: state.minSize,
		maxSize: state.maxSize,
		loopChance: state.loopChance,
	};
	if (state.roomCount !== null) rooms.count = state.roomCount;

	const config: Record<string, unknown> = {
		seed: state.seed,
		size: { width: state.width, height: state.height },
		rooms,
	};
	if (state.entrance) config.entrance = at(state.entrance);
	if (!state.hasExit) config.exit = false;
	else if (state.exit) config.exit = at(state.exit);

	if (state.chests.length > 0) {
		const auto = Array.from({ length: state.autoChests ?? 0 }, () => ({}));
		config.chests = [...state.chests.map(at), ...auto];
	} else if (state.autoChests !== null) {
		config.chests = state.autoChests;
	}

	const rpgmaker: Record<string, unknown> = {
		target: state.target,
		tilesetId: state.tilesetId,
		mapId: state.mapId,
	};
	if (state.displayName) rpgmaker.displayName = state.displayName;
	config.output = { format: "rpgmaker", rpgmaker };
	return config;
}
