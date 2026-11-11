/** (dx, dy) 方向の隣が自分と同じ種類のタイルなら true。 */
export type SameFn = (dx: number, dy: number) => boolean;

/**
 * 床タイプ(48形状)オートタイルの形状番号。
 * 番号の割り当ては rpg_core.js の FLOOR_AUTOTILE_TABLE に対応する。
 */
export function floorAutotileShape(same: SameFn): number {
	// 辺: その方向の隣が別種なら縁取りが付く
	const l = !same(-1, 0);
	const u = !same(0, -1);
	const r = !same(1, 0);
	const d = !same(0, 1);
	// 内側の角: 両隣は同種だが斜めだけ別種の場合に付く
	const tl = !u && !l && !same(-1, -1);
	const tr = !u && !r && !same(1, -1);
	const br = !d && !r && !same(1, 1);
	const bl = !d && !l && !same(-1, 1);
	const bit = (flag: boolean, value: number): number => (flag ? value : 0);

	const edges = bit(l, 1) + bit(u, 1) + bit(r, 1) + bit(d, 1);
	switch (edges) {
		case 0:
			return bit(tl, 1) | bit(tr, 2) | bit(br, 4) | bit(bl, 8);
		case 1:
			if (l) return 16 + bit(tr, 1) + bit(br, 2);
			if (u) return 20 + bit(br, 1) + bit(bl, 2);
			if (r) return 24 + bit(bl, 1) + bit(tl, 2);
			return 28 + bit(tl, 1) + bit(tr, 2);
		case 2:
			if (l && r) return 32;
			if (u && d) return 33;
			if (u && l) return 34 + bit(br, 1);
			if (u && r) return 36 + bit(bl, 1);
			if (r && d) return 38 + bit(tl, 1);
			return 40 + bit(tr, 1);
		case 3:
			if (!d) return 42;
			if (!r) return 43;
			if (!u) return 44;
			return 45;
		default:
			return 46;
	}
}

/**
 * 壁タイプ(16形状)オートタイルの形状番号。
 * 番号の割り当ては rpg_core.js の WALL_AUTOTILE_TABLE に対応する。
 */
export function wallAutotileShape(same: SameFn): number {
	return (
		(same(-1, 0) ? 0 : 1) |
		(same(0, -1) ? 0 : 2) |
		(same(1, 0) ? 0 : 4) |
		(same(0, 1) ? 0 : 8)
	);
}
