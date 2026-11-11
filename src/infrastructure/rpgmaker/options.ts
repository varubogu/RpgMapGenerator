import { TILE_ID_A2, TILE_ID_A4, type TileRef } from "./tileId.js";

export interface RpgMakerTiles {
	/** 床。 */
	readonly floor: TileRef;
	/** 壁の上面(天井)。 */
	readonly wallTop: TileRef;
	/** 壁の側面。床のすぐ上の壁セルに描かれる。 */
	readonly wallSide: TileRef;
	/** 入口・出口のマスに重ねる装飾タイル(階段など)。省略可。 */
	readonly entrance?: TileRef;
	readonly exit?: TileRef;
}

export interface RpgMakerOptions {
	/** 出力対象。イベントコマンドの細かな差を吸収する。 */
	readonly target: "mv" | "mz";
	readonly tilesetId: number;
	readonly displayName: string;
	readonly tiles: RpgMakerTiles;
	/** 壁の右隣の床に影を付ける(エディタの自動影に相当)。 */
	readonly autoShadow: boolean;
	/** リージョンIDを書き込む場合に指定する。プラグインでの通行制御などに使える。 */
	readonly regions: { readonly floor?: number; readonly wall?: number };
	/** 宝箱を開けたときの既定メッセージ。{amount} は個数・金額に置き換わる。 */
	readonly messages: { readonly gold: string; readonly item: string };
}

/** 標準の「ダンジョン」タイルセット(ID 4)を想定した既定値。 */
export const DEFAULT_RPGMAKER_OPTIONS: RpgMakerOptions = {
	target: "mz",
	tilesetId: 4,
	displayName: "",
	tiles: {
		floor: TILE_ID_A2,
		wallTop: TILE_ID_A4,
		wallSide: TILE_ID_A4 + 8 * 48,
	},
	autoShadow: true,
	regions: {},
	messages: {
		gold: "{amount}\\Gを手に入れた！",
		item: "アイテムを手に入れた！",
	},
};
