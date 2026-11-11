import type { Point, Rect } from "./geometry.js";
import type { Grid } from "./grid.js";

/** 宝箱の中身。 */
export type ChestContents =
	| { readonly kind: "gold"; readonly amount: number }
	| { readonly kind: "item"; readonly itemId: number; readonly amount: number };

/** 場所移動先。direction は 0(そのまま)/2/4/6/8。 */
export interface Transfer {
	readonly mapId: number;
	readonly x: number;
	readonly y: number;
	readonly direction?: 0 | 2 | 4 | 6 | 8;
}

/** 入口・出口。 */
export interface Portal {
	readonly position: Point;
	readonly transfer?: Transfer;
}

export interface Chest {
	readonly position: Point;
	readonly contents: ChestContents;
	/** 開けたときのメッセージ。省略時はエクスポータの既定文言。 */
	readonly message?: string;
}

/** 生成結果。特定のゲームエンジンに依存しない中間表現。 */
export interface Dungeon {
	readonly seed: string;
	readonly grid: Grid;
	readonly rooms: readonly Rect[];
	readonly entrance: Portal;
	readonly exit?: Portal;
	readonly chests: readonly Chest[];
}

/** ユーザーの要求。位置などを省略した項目は自動で決める。 */
export interface DungeonRequest {
	readonly width: number;
	readonly height: number;
	readonly seed: string;
	/** レイアウト生成アルゴリズム名。 */
	readonly algorithm: string;
	/** アルゴリズム固有のオプション。解釈は各ジェネレータが行う。 */
	readonly algorithmOptions: Readonly<Record<string, unknown>>;
	readonly entrance: PortalRequest;
	/** null は「出口なし」。 */
	readonly exit: PortalRequest | null;
	/** "auto" は個数も位置もおまかせ。 */
	readonly chests: readonly ChestRequest[] | "auto";
}

export interface PortalRequest {
	readonly position?: Point;
	readonly transfer?: Transfer;
}

export interface ChestRequest {
	readonly position?: Point;
	readonly contents?: ChestContents;
	readonly message?: string;
}
