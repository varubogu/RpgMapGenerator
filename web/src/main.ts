import { stringify } from "yaml";
import {
	buildRpgMakerMap,
	ConfigError,
	type Dungeon,
	generateDungeon,
	jsonExporter,
	type Point,
	RequestError,
	type ResolvedConfig,
	resolveConfig,
	serializeRpgMakerMap,
} from "../../src/index.js";
import { cellSizeFor, drawDungeon } from "./render.js";
import {
	decodeState,
	dropOutOfRangePins,
	encodeState,
	randomSeed,
	type State,
	toConfig,
} from "./state.js";

function element<T extends HTMLElement>(selector: string): T {
	const found = document.querySelector<T>(selector);
	if (!found) throw new Error(`要素が見つかりません: ${selector}`);
	return found;
}

const form = element<HTMLFormElement>("#settings");
const canvas = element<HTMLCanvasElement>("#map");
const canvasWrap = element<HTMLDivElement>(".canvas-wrap");
const status = element<HTMLParagraphElement>("#status");
const hover = element<HTMLOutputElement>("#hover");
const downloadButtons = [
	"#download-map",
	"#download-config",
	"#download-json",
].map((id) => element<HTMLButtonElement>(id));

const field = (name: string): HTMLInputElement | HTMLSelectElement => {
	const control = form.elements.namedItem(name);
	if (
		!(
			control instanceof HTMLInputElement ||
			control instanceof HTMLSelectElement
		)
	) {
		throw new Error(`入力欄が見つかりません: ${name}`);
	}
	return control;
};

const state: State = decodeState(location.hash);
let current:
	| { dungeon: Dungeon; config: ResolvedConfig; cell: number }
	| undefined;

// ---- フォームと状態の同期 ----

function writeForm(): void {
	const set = (name: string, value: string | number | null): void => {
		field(name).value = value === null ? "" : String(value);
	};
	set("seed", state.seed);
	set("width", state.width);
	set("height", state.height);
	set("roomCount", state.roomCount);
	set("loopChance", state.loopChance);
	set("minSize", state.minSize);
	set("maxSize", state.maxSize);
	set("autoChests", state.autoChests);
	set("target", state.target);
	set("tilesetId", state.tilesetId);
	set("mapId", state.mapId);
	set("displayName", state.displayName);
	(field("hasExit") as HTMLInputElement).checked = state.hasExit;
}

function readForm(): void {
	const text = (name: string): string => field(name).value.trim();
	const number = (name: string, fallback: number): number => {
		const value = Number(text(name));
		return text(name) !== "" && Number.isFinite(value) ? value : fallback;
	};
	const optional = (name: string): number | null => {
		const value = Number(text(name));
		return text(name) !== "" && Number.isInteger(value) ? value : null;
	};
	state.seed = text("seed");
	state.width = number("width", state.width);
	state.height = number("height", state.height);
	state.roomCount = optional("roomCount");
	state.loopChance = number("loopChance", state.loopChance);
	state.minSize = number("minSize", state.minSize);
	state.maxSize = number("maxSize", state.maxSize);
	state.autoChests = optional("autoChests");
	state.target = text("target") === "mv" ? "mv" : "mz";
	state.tilesetId = number("tilesetId", state.tilesetId);
	state.mapId = number("mapId", state.mapId);
	state.displayName = text("displayName");
	state.hasExit = (field("hasExit") as HTMLInputElement).checked;
	if (!state.hasExit) state.exit = null;
	dropOutOfRangePins(state);
}

// ---- 生成と描画 ----

function redraw(): void {
	if (!current) return;
	const maxWidth = canvasWrap.clientWidth || 640;
	const maxHeight = Math.max(320, window.innerHeight * 0.7);
	current.cell = cellSizeFor(current.dungeon, maxWidth, maxHeight);
	drawDungeon(canvas, current.dungeon, state, current.cell);
}

function regenerate(): void {
	history.replaceState(null, "", encodeState(state));
	try {
		if (!state.seed) throw new Error("シードを入力してください");
		const config = resolveConfig(toConfig(state));
		const { dungeon, attempts } = generateDungeon({
			...config.request,
			seed: state.seed,
		});
		current = { dungeon, config, cell: current?.cell ?? 12 };
		redraw();
		const gold = dungeon.chests.length;
		status.textContent = [
			`${dungeon.grid.width}×${dungeon.grid.height} / 部屋 ${dungeon.rooms.length} / 宝箱 ${gold} / 試行 ${attempts} 回`,
			"入口から出口とすべての宝箱に到達できることを検証済みです。",
		].join("\n");
		status.classList.remove("error");
		canvas.style.opacity = "1";
		for (const button of downloadButtons) button.disabled = false;
	} catch (error) {
		// 直前の結果は薄く残し、何が問題かを伝える
		status.textContent =
			error instanceof ConfigError || error instanceof RequestError
				? `入力内容に問題があります:\n${error.problems.map((p) => `・${p}`).join("\n")}`
				: error instanceof Error
					? error.message
					: String(error);
		status.classList.add("error");
		canvas.style.opacity = "0.35";
		for (const button of downloadButtons) button.disabled = true;
	}
}

// ---- マップ上での位置指定 ----

function cellAt(event: MouseEvent): Point | undefined {
	if (!current) return undefined;
	const rect = canvas.getBoundingClientRect();
	const x = Math.floor((event.clientX - rect.left) / current.cell);
	const y = Math.floor((event.clientY - rect.top) / current.cell);
	const { grid } = current.dungeon;
	return grid.inBounds(x, y) ? { x, y } : undefined;
}

const same = (a: Point | null, b: Point): boolean =>
	a !== null && a.x === b.x && a.y === b.y;

function unpin(p: Point): boolean {
	const before = state.chests.length;
	state.chests = state.chests.filter((c) => !same(c, p));
	let changed = state.chests.length !== before;
	if (same(state.entrance, p)) {
		state.entrance = null;
		changed = true;
	}
	if (same(state.exit, p)) {
		state.exit = null;
		changed = true;
	}
	return changed;
}

canvas.addEventListener("click", (event) => {
	const p = cellAt(event);
	if (!p || !current) return;
	if (!current.dungeon.grid.isInterior(p.x, p.y)) {
		status.textContent = "外周のマスには置けません。";
		status.classList.add("error");
		return;
	}
	const tool = new FormData(element<HTMLFormElement>("#tools")).get("tool");
	const wasChest = state.chests.some((c) => same(c, p));
	const removed = unpin(p);
	if (tool === "entrance") state.entrance = p;
	else if (tool === "exit") {
		state.exit = p;
		state.hasExit = true;
		writeForm();
	} else if (tool === "chest") {
		// 固定済みの宝箱をもう一度クリックしたら解除する
		if (!wasChest) state.chests.push(p);
	} else if (!removed) return;
	regenerate();
});

canvas.addEventListener("mousemove", (event) => {
	const p = cellAt(event);
	hover.textContent = p ? `(${p.x}, ${p.y})` : "";
});
canvas.addEventListener("mouseleave", () => {
	hover.textContent = "";
});

// ---- 操作 ----

form.addEventListener("input", () => {
	readForm();
	regenerate();
});
form.addEventListener("submit", (event) => event.preventDefault());

element("#reroll").addEventListener("click", () => {
	state.seed = randomSeed();
	writeForm();
	regenerate();
});

element("#clear-pins").addEventListener("click", () => {
	state.entrance = null;
	state.exit = null;
	state.chests = [];
	regenerate();
});

function download(filename: string, content: string, type: string): void {
	const url = URL.createObjectURL(new Blob([content], { type }));
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

element("#download-map").addEventListener("click", () => {
	if (!current) return;
	const map = buildRpgMakerMap(current.dungeon, current.config.output.rpgmaker);
	const id = String(state.mapId).padStart(3, "0");
	download(`Map${id}.json`, serializeRpgMakerMap(map), "application/json");
});

element("#download-config").addEventListener("click", () => {
	download("dungeon.yaml", stringify(toConfig(state)), "application/yaml");
});

element("#download-json").addEventListener("click", () => {
	if (!current) return;
	download(
		"dungeon.json",
		jsonExporter.export(current.dungeon),
		"application/json",
	);
});

element<HTMLButtonElement>("#copy-link").addEventListener(
	"click",
	async (event) => {
		const button = event.currentTarget as HTMLButtonElement;
		const label = button.textContent;
		try {
			await navigator.clipboard.writeText(location.href);
			button.textContent = "コピーしました";
		} catch {
			button.textContent = "コピーできません(URL欄からコピーしてください)";
		}
		setTimeout(() => {
			button.textContent = label;
		}, 2000);
	},
);

window.addEventListener("resize", redraw);
window.addEventListener("hashchange", () => {
	Object.assign(state, decodeState(location.hash));
	writeForm();
	regenerate();
});

writeForm();
regenerate();
