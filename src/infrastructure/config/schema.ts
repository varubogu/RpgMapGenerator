import { z } from "zod";
import type {
	ChestContents,
	ChestRequest,
	DungeonRequest,
	PortalRequest,
} from "../../domain/dungeon.js";
import {
	DEFAULT_RPGMAKER_OPTIONS,
	type RpgMakerOptions,
} from "../rpgmaker/options.js";

const coordinate = z.number().int().min(0);
const positive = z.number().int().min(1);

const transferSchema = z
	.object({
		mapId: positive,
		x: coordinate,
		y: coordinate,
		direction: z
			.union([
				z.literal(0),
				z.literal(2),
				z.literal(4),
				z.literal(6),
				z.literal(8),
			])
			.optional(),
	})
	.strict();

const bothOrNeither = (v: { x?: number; y?: number }): boolean =>
	(v.x === undefined) === (v.y === undefined);
const positionMessage = "x と y は両方指定するか、両方省略してください";

const portalSchema = z
	.object({
		x: coordinate.optional(),
		y: coordinate.optional(),
		transfer: transferSchema.optional(),
	})
	.strict()
	.refine(bothOrNeither, positionMessage);

const chestSchema = z
	.object({
		x: coordinate.optional(),
		y: coordinate.optional(),
		gold: positive.optional(),
		item: positive.optional(),
		amount: positive.optional(),
		message: z.string().optional(),
	})
	.strict()
	.refine(bothOrNeither, positionMessage)
	.refine(
		(v) => !(v.gold !== undefined && v.item !== undefined),
		"gold と item は同時に指定できません",
	)
	.refine(
		(v) => v.amount === undefined || v.item !== undefined,
		"amount は item と一緒に指定してください",
	);

const tileRefSchema = z.union([
	z.number().int().min(0),
	z
		.object({
			sheet: z.enum(["A1", "A2", "A3", "A4", "A5", "B", "C", "D", "E"]),
			index: z.number().int().min(0),
		})
		.strict(),
]);

const regionSchema = z.number().int().min(1).max(255);

const rpgmakerSchema = z
	.object({
		target: z.enum(["mv", "mz"]).optional(),
		project: z.string().optional(),
		mapId: z.number().int().min(1).max(999).optional(),
		mapName: z.string().optional(),
		displayName: z.string().optional(),
		tilesetId: positive.optional(),
		tiles: z
			.object({
				floor: tileRefSchema.optional(),
				wallTop: tileRefSchema.optional(),
				wallSide: tileRefSchema.optional(),
				entrance: tileRefSchema.optional(),
				exit: tileRefSchema.optional(),
			})
			.strict()
			.optional(),
		autoShadow: z.boolean().optional(),
		regions: z
			.object({ floor: regionSchema.optional(), wall: regionSchema.optional() })
			.strict()
			.optional(),
		messages: z
			.object({ gold: z.string().optional(), item: z.string().optional() })
			.strict()
			.optional(),
	})
	.strict();

export const OUTPUT_FORMATS = ["rpgmaker", "json", "ascii"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const configSchema = z
	.object({
		seed: z.union([z.string().min(1), z.number()]).optional(),
		size: z.object({ width: positive, height: positive }).strict(),
		algorithm: z.string().optional(),
		rooms: z
			.object({
				count: positive.optional(),
				minSize: z.number().int().min(3).optional(),
				maxSize: z.number().int().min(3).optional(),
				loopChance: z.number().min(0).max(1).optional(),
			})
			.strict()
			.refine(
				(v) =>
					v.minSize === undefined ||
					v.maxSize === undefined ||
					v.minSize <= v.maxSize,
				"minSize は maxSize 以下にしてください",
			)
			.optional(),
		entrance: portalSchema.optional(),
		exit: z.union([portalSchema, z.literal(false)]).optional(),
		chests: z.union([z.number().int().min(0), z.array(chestSchema)]).optional(),
		output: z
			.object({
				format: z.enum(OUTPUT_FORMATS).optional(),
				path: z.string().optional(),
				rpgmaker: rpgmakerSchema.optional(),
			})
			.strict()
			.optional(),
	})
	.strict();

export type RawConfig = z.infer<typeof configSchema>;

export interface OutputSettings {
	readonly format: OutputFormat;
	/** 出力先ファイル。 */
	readonly path?: string;
	/** ツクールのプロジェクトフォルダ。指定時は data/ に直接書き込む。 */
	readonly project?: string;
	readonly mapId?: number;
	readonly mapName: string;
	readonly rpgmaker: RpgMakerOptions;
}

export interface ResolvedConfig {
	/** seed が未指定の場合は undefined。呼び出し側で決める。 */
	readonly request: Omit<DungeonRequest, "seed"> & { readonly seed?: string };
	readonly output: OutputSettings;
}

export class ConfigError extends Error {
	constructor(readonly problems: readonly string[]) {
		super(
			`設定ファイルに問題があります:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
		);
		this.name = "ConfigError";
	}
}

function toPortalRequest(
	raw: z.infer<typeof portalSchema> | undefined,
): PortalRequest {
	return {
		position:
			raw?.x !== undefined && raw.y !== undefined
				? { x: raw.x, y: raw.y }
				: undefined,
		transfer: raw?.transfer,
	};
}

function toChestRequest(raw: z.infer<typeof chestSchema>): ChestRequest {
	let contents: ChestContents | undefined;
	if (raw.gold !== undefined) contents = { kind: "gold", amount: raw.gold };
	else if (raw.item !== undefined) {
		contents = { kind: "item", itemId: raw.item, amount: raw.amount ?? 1 };
	}
	return {
		position:
			raw.x !== undefined && raw.y !== undefined
				? { x: raw.x, y: raw.y }
				: undefined,
		contents,
		message: raw.message,
	};
}

/** 読み込んだ生の設定値を検証し、ドメインの要求と出力設定に変換する。 */
export function resolveConfig(input: unknown): ResolvedConfig {
	const parsed = configSchema.safeParse(input);
	if (!parsed.success) {
		throw new ConfigError(
			parsed.error.issues.map((issue) => {
				const path = issue.path.join(".");
				return path ? `${path}: ${issue.message}` : issue.message;
			}),
		);
	}
	const raw = parsed.data;

	const algorithmOptions: Record<string, unknown> = {};
	if (raw.rooms?.count !== undefined)
		algorithmOptions.roomCount = raw.rooms.count;
	if (raw.rooms?.minSize !== undefined)
		algorithmOptions.minRoomSize = raw.rooms.minSize;
	if (raw.rooms?.maxSize !== undefined)
		algorithmOptions.maxRoomSize = raw.rooms.maxSize;
	if (raw.rooms?.loopChance !== undefined)
		algorithmOptions.loopChance = raw.rooms.loopChance;

	let chests: DungeonRequest["chests"];
	if (raw.chests === undefined) chests = "auto";
	else if (typeof raw.chests === "number") {
		chests = Array.from({ length: raw.chests }, () => ({}));
	} else chests = raw.chests.map(toChestRequest);

	const rm = raw.output?.rpgmaker;
	const defaults = DEFAULT_RPGMAKER_OPTIONS;
	return {
		request: {
			seed: raw.seed === undefined ? undefined : String(raw.seed),
			width: raw.size.width,
			height: raw.size.height,
			algorithm: raw.algorithm ?? "rooms",
			algorithmOptions,
			entrance: toPortalRequest(raw.entrance),
			exit: raw.exit === false ? null : toPortalRequest(raw.exit),
			chests,
		},
		output: {
			format: raw.output?.format ?? "rpgmaker",
			path: raw.output?.path,
			project: rm?.project,
			mapId: rm?.mapId,
			mapName: rm?.mapName ?? "Generated Dungeon",
			rpgmaker: {
				target: rm?.target ?? defaults.target,
				tilesetId: rm?.tilesetId ?? defaults.tilesetId,
				displayName: rm?.displayName ?? defaults.displayName,
				tiles: { ...defaults.tiles, ...rm?.tiles },
				autoShadow: rm?.autoShadow ?? defaults.autoShadow,
				regions: { ...rm?.regions },
				messages: { ...defaults.messages, ...rm?.messages },
			},
		},
	};
}
