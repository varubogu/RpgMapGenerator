import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type RpgMakerMap, serializeRpgMakerMap } from "./map.js";

interface MapInfo {
	id: number;
	expanded: boolean;
	name: string;
	order: number;
	parentId: number;
	scrollX: number;
	scrollY: number;
}

export interface ProjectWriteOptions {
	/** 上書きするマップID。省略時は空いている最小のIDを使う。 */
	readonly mapId?: number;
	/** 新しくマップ一覧に登録するときの名前。 */
	readonly mapName: string;
}

export interface ProjectWriteResult {
	readonly mapId: number;
	readonly mapPath: string;
	/** MapInfos.json に新しく登録したかどうか。 */
	readonly registered: boolean;
}

const MAX_MAP_ID = 999;

/**
 * ツクールのプロジェクトにマップを書き込み、必要なら MapInfos.json に登録する。
 * エディタを開いたままだと保存時に上書きされるため、閉じた状態で実行すること。
 */
export async function writeMapToProject(
	projectDir: string,
	map: RpgMakerMap,
	options: ProjectWriteOptions,
): Promise<ProjectWriteResult> {
	const dataDir = join(projectDir, "data");
	const infosPath = join(dataDir, "MapInfos.json");

	let infos: Array<MapInfo | null>;
	try {
		infos = JSON.parse(await readFile(infosPath, "utf8"));
	} catch (cause) {
		throw new Error(
			`${infosPath} を読み込めません。ツクールMV/MZのプロジェクトフォルダを指定してください。`,
			{ cause },
		);
	}
	if (!Array.isArray(infos)) {
		throw new Error(
			`${infosPath} の形式が想定と異なります(配列ではありません)`,
		);
	}

	let mapId = options.mapId;
	if (mapId === undefined) {
		mapId = 1;
		while (infos[mapId]) mapId++;
	}
	if (!Number.isInteger(mapId) || mapId < 1 || mapId > MAX_MAP_ID) {
		throw new RangeError(`マップIDは 1〜${MAX_MAP_ID} の整数です: ${mapId}`);
	}

	const registered = !infos[mapId];
	if (registered) {
		while (infos.length <= mapId) infos.push(null);
		const maxOrder = infos.reduce(
			(max, info) => Math.max(max, info?.order ?? 0),
			0,
		);
		infos[mapId] = {
			id: mapId,
			expanded: false,
			name: options.mapName,
			order: maxOrder + 1,
			parentId: 0,
			scrollX: 0,
			scrollY: 0,
		};
	}

	const mapPath = join(dataDir, `Map${String(mapId).padStart(3, "0")}.json`);
	await writeFile(mapPath, serializeRpgMakerMap(map), "utf8");
	if (registered) {
		// エディタの出力に合わせ、1要素1行で書き出す
		const lines = infos.map((info) => JSON.stringify(info)).join(",\n");
		await writeFile(infosPath, `[\n${lines}\n]\n`, "utf8");
	}
	return { mapId, mapPath, registered };
}
