import type { DungeonExporter } from "../../application/exporter.js";
import type { Dungeon } from "../../domain/dungeon.js";
import { buildEvents, type MapEvent } from "./events.js";
import { buildMapData } from "./mapData.js";
import type { RpgMakerOptions } from "./options.js";

const audio = () => ({ name: "", pan: 0, pitch: 100, volume: 90 });

/** MapXXX.json の構造(MV/MZ共通)。 */
export interface RpgMakerMap {
	autoplayBgm: boolean;
	autoplayBgs: boolean;
	battleback1Name: string;
	battleback2Name: string;
	bgm: ReturnType<typeof audio>;
	bgs: ReturnType<typeof audio>;
	disableDashing: boolean;
	displayName: string;
	encounterList: unknown[];
	encounterStep: number;
	note: string;
	parallaxLoopX: boolean;
	parallaxLoopY: boolean;
	parallaxName: string;
	parallaxShow: boolean;
	parallaxSx: number;
	parallaxSy: number;
	scrollType: number;
	specifyBattleback: boolean;
	tilesetId: number;
	width: number;
	height: number;
	data: number[];
	events: Array<MapEvent | null>;
}

export function buildRpgMakerMap(
	dungeon: Dungeon,
	options: RpgMakerOptions,
): RpgMakerMap {
	return {
		autoplayBgm: false,
		autoplayBgs: false,
		battleback1Name: "",
		battleback2Name: "",
		bgm: audio(),
		bgs: audio(),
		disableDashing: false,
		displayName: options.displayName,
		encounterList: [],
		encounterStep: 30,
		// 同じマップを再生成できるよう、シードをメモ欄に残す
		note: `<rpgmapgen seed="${dungeon.seed}">`,
		parallaxLoopX: false,
		parallaxLoopY: false,
		parallaxName: "",
		parallaxShow: true,
		parallaxSx: 0,
		parallaxSy: 0,
		scrollType: 0,
		specifyBattleback: false,
		tilesetId: options.tilesetId,
		width: dungeon.grid.width,
		height: dungeon.grid.height,
		data: buildMapData(dungeon, options),
		events: buildEvents(dungeon, options),
	};
}

export function serializeRpgMakerMap(map: RpgMakerMap): string {
	return `${JSON.stringify(map)}\n`;
}

export const rpgMakerExporter: DungeonExporter<RpgMakerOptions> = {
	format: "rpgmaker",
	export: (dungeon, options) =>
		serializeRpgMakerMap(buildRpgMakerMap(dungeon, options)),
};
