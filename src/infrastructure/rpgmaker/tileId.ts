/** ツクールMV/MZのタイルID体系(rpg_core.js の Tilemap と同じ値)。 */
export const TILE_ID_B = 0;
export const TILE_ID_C = 256;
export const TILE_ID_D = 512;
export const TILE_ID_E = 768;
export const TILE_ID_A5 = 1536;
export const TILE_ID_A1 = 2048;
export const TILE_ID_A2 = 2816;
export const TILE_ID_A3 = 4352;
export const TILE_ID_A4 = 5888;
export const TILE_ID_MAX = 8192;

/** オートタイル1種類あたりの形状数。 */
const SHAPES_PER_KIND = 48;

export type TileSheet =
	| "A1"
	| "A2"
	| "A3"
	| "A4"
	| "A5"
	| "B"
	| "C"
	| "D"
	| "E";

/**
 * タイルの指定方法。
 * - 数値: タイルIDそのもの
 * - { sheet, index }: タイルセット画像と、その中での左上からの通し番号(0始まり)
 */
export type TileRef =
	| number
	| { readonly sheet: TileSheet; readonly index: number };

const SHEETS: Record<TileSheet, { base: number; count: number; step: number }> =
	{
		A1: { base: TILE_ID_A1, count: 16, step: SHAPES_PER_KIND },
		A2: { base: TILE_ID_A2, count: 32, step: SHAPES_PER_KIND },
		A3: { base: TILE_ID_A3, count: 32, step: SHAPES_PER_KIND },
		A4: { base: TILE_ID_A4, count: 48, step: SHAPES_PER_KIND },
		A5: { base: TILE_ID_A5, count: 128, step: 1 },
		B: { base: TILE_ID_B, count: 256, step: 1 },
		C: { base: TILE_ID_C, count: 256, step: 1 },
		D: { base: TILE_ID_D, count: 256, step: 1 },
		E: { base: TILE_ID_E, count: 256, step: 1 },
	};

export function isAutotile(tileId: number): boolean {
	return tileId >= TILE_ID_A1;
}

/** タイル指定をタイルIDに解決する。オートタイルは形状0の基準IDを返す。 */
export function resolveTileRef(ref: TileRef): number {
	if (typeof ref === "number") {
		if (!Number.isInteger(ref) || ref < 0 || ref >= TILE_ID_MAX) {
			throw new RangeError(
				`タイルIDは 0〜${TILE_ID_MAX - 1} の整数です: ${ref}`,
			);
		}
		return isAutotile(ref) ? ref - ((ref - TILE_ID_A1) % SHAPES_PER_KIND) : ref;
	}
	const sheet = SHEETS[ref.sheet];
	if (
		!Number.isInteger(ref.index) ||
		ref.index < 0 ||
		ref.index >= sheet.count
	) {
		throw new RangeError(
			`${ref.sheet} の index は 0〜${sheet.count - 1} です: ${ref.index}`,
		);
	}
	return sheet.base + ref.index * sheet.step;
}

export type AutotileType = "none" | "floor" | "wall";

/**
 * オートタイルの接続方式。
 * - floor: 8方向を見る48形状(地面・壁の上面)
 * - wall: 4方向を見る16形状(A3 の建物、A4 の壁側面)
 */
export function autotileType(tileId: number): AutotileType {
	if (!isAutotile(tileId)) return "none";
	if (tileId >= TILE_ID_A4) {
		const row = Math.floor((tileId - TILE_ID_A4) / SHAPES_PER_KIND / 8);
		return row % 2 === 1 ? "wall" : "floor";
	}
	if (tileId >= TILE_ID_A3) return "wall";
	return "floor";
}
