#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { generateDungeon } from "../application/generateDungeon.js";
import type { Dungeon } from "../domain/dungeon.js";
import { GenerationError, RequestError } from "../domain/errors.js";
import { loadConfigFile } from "../infrastructure/config/load.js";
import {
	ConfigError,
	OUTPUT_FORMATS,
	type OutputFormat,
} from "../infrastructure/config/schema.js";
import {
	ASCII_LEGEND,
	renderAscii,
} from "../infrastructure/exporters/ascii.js";
import { jsonExporter } from "../infrastructure/exporters/json.js";
import {
	buildRpgMakerMap,
	serializeRpgMakerMap,
} from "../infrastructure/rpgmaker/map.js";
import { writeMapToProject } from "../infrastructure/rpgmaker/project.js";

const USAGE = `使い方:
  rpgmapgen generate <設定ファイル> [オプション]

オプション:
  --seed <値>        シードを上書きする(同じシードなら同じマップになる)
  --format <形式>    出力形式: ${OUTPUT_FORMATS.join(" | ")}
  --out <ファイル>   出力先ファイル(省略時は標準出力)
  --project <フォルダ>  ツクールMV/MZのプロジェクトに直接書き込む
  --map-id <番号>    書き込むマップID(省略時は空いている最小のID)
  --preview          生成結果をテキストで表示する
  -h, --help         このヘルプを表示する
`;

const log = (message: string): void => {
	process.stderr.write(`${message}\n`);
};

class UsageError extends Error {}

async function main(argv: string[]): Promise<void> {
	const { values, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			seed: { type: "string" },
			format: { type: "string" },
			out: { type: "string" },
			project: { type: "string" },
			"map-id": { type: "string" },
			preview: { type: "boolean", default: false },
			help: { type: "boolean", short: "h", default: false },
		},
	});

	const [commandName, configPath] = positionals;
	if (values.help || !commandName) {
		process.stdout.write(USAGE);
		return;
	}
	if (commandName !== "generate") {
		throw new UsageError(`未知のコマンドです: ${commandName}`);
	}
	if (!configPath) throw new UsageError("設定ファイルを指定してください");

	if (
		values.format &&
		!OUTPUT_FORMATS.includes(values.format as OutputFormat)
	) {
		throw new UsageError(`未知の出力形式です: ${values.format}`);
	}
	let mapIdOverride: number | undefined;
	if (values["map-id"] !== undefined) {
		mapIdOverride = Number(values["map-id"]);
		if (!Number.isInteger(mapIdOverride) || mapIdOverride < 1) {
			throw new UsageError(
				`--map-id は1以上の整数で指定してください: ${values["map-id"]}`,
			);
		}
	}

	const config = await loadConfigFile(configPath);
	const format =
		(values.format as OutputFormat | undefined) ?? config.output.format;
	const outPath = values.out ? resolve(values.out) : config.output.path;
	const project = values.project
		? resolve(values.project)
		: config.output.project;
	const mapId = mapIdOverride ?? config.output.mapId;

	const givenSeed = values.seed ?? config.request.seed;
	const seed = givenSeed ?? String(Math.floor(Math.random() * 0xffffffff));
	const { dungeon, attempts } = generateDungeon({ ...config.request, seed });

	log(summarize(dungeon, attempts));
	if (givenSeed === undefined) {
		log(
			`シード未指定のためランダムに決めました。同じマップを再現するには seed: ${seed} を設定してください。`,
		);
	}
	if (values.preview) log(`\n${renderAscii(dungeon)}${ASCII_LEGEND}\n`);

	if (format === "rpgmaker" && project) {
		const map = buildRpgMakerMap(dungeon, config.output.rpgmaker);
		const result = await writeMapToProject(project, map, {
			mapId,
			mapName: config.output.mapName,
		});
		log(
			`${result.mapPath} に書き込みました(マップID ${result.mapId}${result.registered ? "、MapInfos.json に登録" : "、既存マップを上書き"})`,
		);
		return;
	}

	const content =
		format === "rpgmaker"
			? serializeRpgMakerMap(buildRpgMakerMap(dungeon, config.output.rpgmaker))
			: format === "json"
				? jsonExporter.export(dungeon)
				: renderAscii(dungeon);
	if (outPath) {
		await mkdir(dirname(outPath), { recursive: true });
		await writeFile(outPath, content, "utf8");
		log(`${outPath} に書き込みました`);
	} else {
		process.stdout.write(content);
	}
}

function summarize(dungeon: Dungeon, attempts: number): string {
	const at = (p: { x: number; y: number }): string => `(${p.x}, ${p.y})`;
	const lines = [
		`生成完了: ${dungeon.grid.width}x${dungeon.grid.height} / 部屋 ${dungeon.rooms.length} / シード ${dungeon.seed} / 試行 ${attempts} 回`,
		`  入口 ${at(dungeon.entrance.position)}`,
	];
	if (dungeon.exit) lines.push(`  出口 ${at(dungeon.exit.position)}`);
	dungeon.chests.forEach((chest, i) => {
		const c = chest.contents;
		const what =
			c.kind === "gold" ? `${c.amount}G` : `アイテム#${c.itemId} x${c.amount}`;
		lines.push(`  宝箱${i + 1} ${at(chest.position)} ${what}`);
	});
	return lines.join("\n");
}

main(process.argv.slice(2)).catch((error: unknown) => {
	const expected =
		error instanceof ConfigError ||
		error instanceof RequestError ||
		error instanceof GenerationError ||
		error instanceof UsageError;
	if (error instanceof UsageError) log(`${error.message}\n\n${USAGE}`);
	else if (error instanceof Error)
		log(expected ? error.message : (error.stack ?? error.message));
	else log(String(error));
	process.exitCode = expected ? 2 : 1;
});
