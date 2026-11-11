import type { Dungeon } from "../domain/dungeon.js";

/**
 * ダンジョンを特定の形式の文字列に変換する。
 * 新しい出力先(他エンジン、Tiled など)はこれを実装して追加する。
 */
export interface DungeonExporter<Options = void> {
	readonly format: string;
	export(dungeon: Dungeon, options: Options): string;
}
