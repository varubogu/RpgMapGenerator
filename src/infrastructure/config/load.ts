import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse } from "yaml";
import { ConfigError, type ResolvedConfig, resolveConfig } from "./schema.js";

/**
 * YAML または JSON の設定ファイルを読み込む。
 * ファイル内の相対パスは、設定ファイルのあるフォルダを基準に解決する。
 */
export async function loadConfigFile(path: string): Promise<ResolvedConfig> {
	let text: string;
	try {
		text = await readFile(path, "utf8");
	} catch (cause) {
		throw new ConfigError([
			`設定ファイル ${path} を読み込めません: ${cause instanceof Error ? cause.message : String(cause)}`,
		]);
	}
	let raw: unknown;
	try {
		raw = parse(text); // JSON は YAML のサブセットなので同じパーサで読める
	} catch (cause) {
		throw new ConfigError([
			`${path} を解析できません: ${cause instanceof Error ? cause.message : String(cause)}`,
		]);
	}
	const config = resolveConfig(raw);
	const base = dirname(resolve(path));
	const fromBase = (p: string | undefined): string | undefined =>
		p === undefined ? undefined : resolve(base, p);
	return {
		...config,
		output: {
			...config.output,
			path: fromBase(config.output.path),
			project: fromBase(config.output.project),
		},
	};
}
