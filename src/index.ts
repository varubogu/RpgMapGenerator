// ライブラリとしての公開API。ここから import できるものだけを互換性維持の対象とする。
// domain / application / exporters は Node.js 固有のAPIに依存しないので、ブラウザでも動く。
export type { DungeonExporter } from "./application/exporter.js";
export {
	type GenerateOptions,
	type GenerationResult,
	generateDungeon,
	MAX_MAP_SIZE,
	MIN_MAP_SIZE,
} from "./application/generateDungeon.js";
export {
	createDefaultRegistry,
	GeneratorRegistry,
} from "./application/registry.js";
export type {
	Chest,
	ChestContents,
	ChestRequest,
	Dungeon,
	DungeonRequest,
	Portal,
	PortalRequest,
	Transfer,
} from "./domain/dungeon.js";
export { GenerationError, RequestError } from "./domain/errors.js";
export type {
	Layout,
	LayoutGenerator,
	LayoutInput,
} from "./domain/generator.js";
export {
	type RoomsOptions,
	roomsGenerator,
} from "./domain/generators/rooms.js";
export type { Point, Rect } from "./domain/geometry.js";
export { Cell, Grid } from "./domain/grid.js";
export { createRng, type Rng } from "./domain/rng.js";
export {
	type Features,
	type Issue,
	validateLayout,
} from "./domain/validation.js";
export {
	ConfigError,
	type OutputFormat,
	type ResolvedConfig,
	resolveConfig,
} from "./infrastructure/config/schema.js";
export {
	asciiExporter,
	renderAscii,
} from "./infrastructure/exporters/ascii.js";
export {
	jsonExporter,
	toIntermediate,
} from "./infrastructure/exporters/json.js";
export {
	buildRpgMakerMap,
	type RpgMakerMap,
	rpgMakerExporter,
	serializeRpgMakerMap,
} from "./infrastructure/rpgmaker/map.js";
export {
	DEFAULT_RPGMAKER_OPTIONS,
	type RpgMakerOptions,
	type RpgMakerTiles,
} from "./infrastructure/rpgmaker/options.js";
export {
	resolveTileRef,
	type TileRef,
} from "./infrastructure/rpgmaker/tileId.js";
