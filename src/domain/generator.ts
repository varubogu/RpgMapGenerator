import type { Point, Rect } from "./geometry.js";
import type { Grid } from "./grid.js";
import type { Rng } from "./rng.js";

export interface LayoutInput {
	readonly width: number;
	readonly height: number;
	/** 必ず床にしなければならない地点(ユーザーが位置指定した入口・出口・宝箱)。 */
	readonly anchors: readonly Point[];
	/** アルゴリズム固有のオプション。 */
	readonly options: Readonly<Record<string, unknown>>;
}

export interface Layout {
	readonly grid: Grid;
	/** 部屋とみなせる矩形。宝箱の自動配置の手がかりに使う。無ければ空でよい。 */
	readonly rooms: readonly Rect[];
}

/**
 * 地形レイアウトの生成アルゴリズム。新しいアルゴリズムはこれを実装して登録する。
 *
 * 契約:
 * - 外周1マスは壁のままにする
 * - anchors はすべて床にする
 * - すべての床は互いに到達可能にする
 * - 乱数は渡された rng だけを使う(再現性のため)
 */
export interface LayoutGenerator {
	readonly name: string;
	generate(input: LayoutInput, rng: Rng): Layout;
}
