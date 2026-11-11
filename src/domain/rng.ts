/** シード付き乱数。同じシードからは常に同じ列が得られる。 */
export interface Rng {
	/** [0, 1) の一様乱数。 */
	next(): number;
	/** min 以上 max 以下の整数。 */
	int(min: number, max: number): number;
	chance(probability: number): boolean;
	pick<T>(items: readonly T[]): T;
	shuffle<T>(items: readonly T[]): T[];
}

function hashSeed(seed: string): number {
	// FNV-1a 32bit
	let h = 0x811c9dc5;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

export function createRng(seed: string): Rng {
	let state = hashSeed(seed);
	// mulberry32
	const next = (): number => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const int = (min: number, max: number): number => {
		if (max < min) throw new RangeError(`int(${min}, ${max}) は不正な範囲です`);
		return min + Math.floor(next() * (max - min + 1));
	};
	return {
		next,
		int,
		chance: (probability) => next() < probability,
		pick: <T>(items: readonly T[]): T => {
			if (items.length === 0) throw new RangeError("空の配列からは選べません");
			return items[int(0, items.length - 1)] as T;
		},
		shuffle: <T>(items: readonly T[]): T[] => {
			const result = [...items];
			for (let i = result.length - 1; i > 0; i--) {
				const j = int(0, i);
				const tmp = result[i] as T;
				result[i] = result[j] as T;
				result[j] = tmp;
			}
			return result;
		},
	};
}
