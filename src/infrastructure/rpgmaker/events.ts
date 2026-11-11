import type { Chest, Dungeon, Portal } from "../../domain/dungeon.js";
import type { RpgMakerOptions } from "./options.js";

export interface EventCommand {
	code: number;
	indent: number;
	parameters: unknown[];
}

interface MoveCommand {
	code: number;
	parameters?: unknown[];
	indent?: null;
}

export interface EventPage {
	conditions: Record<string, unknown>;
	directionFix: boolean;
	image: {
		characterIndex: number;
		characterName: string;
		direction: number;
		pattern: number;
		tileId: number;
	};
	list: EventCommand[];
	moveFrequency: number;
	moveRoute: {
		list: MoveCommand[];
		repeat: boolean;
		skippable: boolean;
		wait: boolean;
	};
	moveSpeed: number;
	moveType: number;
	priorityType: number;
	stepAnime: boolean;
	through: boolean;
	trigger: number;
	walkAnime: boolean;
}

export interface MapEvent {
	id: number;
	name: string;
	note: string;
	pages: EventPage[];
	x: number;
	y: number;
}

// イベントコマンドのコード
const CMD_END = 0;
const CMD_SHOW_TEXT = 101;
const CMD_COMMENT = 108;
const CMD_SELF_SWITCH = 123;
const CMD_CHANGE_GOLD = 125;
const CMD_CHANGE_ITEMS = 126;
const CMD_TRANSFER = 201;
const CMD_MOVE_ROUTE = 205;
const CMD_PLAY_SE = 250;
const CMD_TEXT_LINE = 401;
const CMD_MOVE_ROUTE_LINE = 505;
// 移動ルートのコード
const ROUTE_END = 0;
const ROUTE_WAIT = 15;
const ROUTE_TURN_LEFT = 17;
const ROUTE_TURN_RIGHT = 18;
const ROUTE_DIR_FIX_OFF = 36;

const TRIGGER_ACTION = 0;
const TRIGGER_PLAYER_TOUCH = 1;
const PRIORITY_BELOW = 0;
const PRIORITY_SAME = 1;

const command = (code: number, parameters: unknown[] = []): EventCommand => ({
	code,
	indent: 0,
	parameters,
});

const se = (name: string) => ({ name, volume: 90, pitch: 100, pan: 0 });

function page(overrides: Partial<EventPage>): EventPage {
	return {
		conditions: {
			actorId: 1,
			actorValid: false,
			itemId: 1,
			itemValid: false,
			selfSwitchCh: "A",
			selfSwitchValid: false,
			switch1Id: 1,
			switch1Valid: false,
			switch2Id: 1,
			switch2Valid: false,
			variableId: 1,
			variableValid: false,
			variableValue: 0,
		},
		directionFix: false,
		image: {
			characterIndex: 0,
			characterName: "",
			direction: 2,
			pattern: 0,
			tileId: 0,
		},
		list: [command(CMD_END)],
		moveFrequency: 3,
		moveRoute: {
			list: [{ code: ROUTE_END, parameters: [] }],
			repeat: true,
			skippable: false,
			wait: false,
		},
		moveSpeed: 3,
		moveType: 0,
		priorityType: PRIORITY_BELOW,
		stepAnime: false,
		through: false,
		trigger: TRIGGER_ACTION,
		walkAnime: true,
		...overrides,
	};
}

function showText(
	text: string,
	target: RpgMakerOptions["target"],
): EventCommand[] {
	// MZ では5番目に話者名が入る。MV は余分な引数を無視する。
	const head = target === "mz" ? ["", 0, 0, 2, ""] : ["", 0, 0, 2];
	return [command(CMD_SHOW_TEXT, head), command(CMD_TEXT_LINE, [text])];
}

/** エディタの「簡単作成: 宝箱」と同じ構成のイベント。 */
function chestEvent(
	id: number,
	index: number,
	chest: Chest,
	options: RpgMakerOptions,
): MapEvent {
	const openAnimation: MoveCommand[] = [
		{ code: ROUTE_DIR_FIX_OFF, indent: null },
		{ code: ROUTE_TURN_LEFT, indent: null },
		{ code: ROUTE_WAIT, parameters: [3], indent: null },
		{ code: ROUTE_TURN_RIGHT, indent: null },
		{ code: ROUTE_WAIT, parameters: [3], indent: null },
	];
	const { contents } = chest;
	const reward =
		contents.kind === "gold"
			? command(CMD_CHANGE_GOLD, [0, 0, contents.amount])
			: command(CMD_CHANGE_ITEMS, [contents.itemId, 0, 0, contents.amount]);
	const template =
		chest.message ??
		(contents.kind === "gold" ? options.messages.gold : options.messages.item);
	const text = template.replaceAll("{amount}", String(contents.amount));

	const chestImage = (direction: number) => ({
		characterIndex: 0,
		characterName: "!Chest",
		direction,
		pattern: 1,
		tileId: 0,
	});

	return {
		id,
		name: `Chest${index + 1}`,
		note: "",
		x: chest.position.x,
		y: chest.position.y,
		pages: [
			page({
				image: chestImage(2),
				directionFix: true,
				priorityType: PRIORITY_SAME,
				walkAnime: false,
				list: [
					command(CMD_PLAY_SE, [se("Chest1")]),
					command(CMD_MOVE_ROUTE, [
						0,
						{
							list: [...openAnimation, { code: ROUTE_END }],
							repeat: false,
							skippable: false,
							wait: true,
						},
					]),
					...openAnimation.map((move) => command(CMD_MOVE_ROUTE_LINE, [move])),
					command(CMD_SELF_SWITCH, ["A", 0]),
					reward,
					...(text ? showText(text, options.target) : []),
					command(CMD_END),
				],
			}),
			page({
				conditions: { ...page({}).conditions, selfSwitchValid: true },
				image: chestImage(8),
				directionFix: true,
				priorityType: PRIORITY_SAME,
				walkAnime: false,
			}),
		],
	};
}

/** 入口・出口のイベント。移動先が未指定なら設定を促す注釈だけを置く。 */
function portalEvent(id: number, name: string, portal: Portal): MapEvent {
	const { transfer } = portal;
	const list = transfer
		? [
				command(CMD_PLAY_SE, [se("Move1")]),
				command(CMD_TRANSFER, [
					0,
					transfer.mapId,
					transfer.x,
					transfer.y,
					transfer.direction ?? 0,
					0,
				]),
				command(CMD_END),
			]
		: [
				command(CMD_COMMENT, [`TODO: ${name} の場所移動先を設定してください`]),
				command(CMD_END),
			];
	return {
		id,
		name,
		note: "",
		x: portal.position.x,
		y: portal.position.y,
		pages: [page({ trigger: TRIGGER_PLAYER_TOUCH, list })],
	};
}

/** events 配列を組み立てる。ツクールの仕様で先頭(ID 0)は null。 */
export function buildEvents(
	dungeon: Dungeon,
	options: RpgMakerOptions,
): Array<MapEvent | null> {
	const events: Array<MapEvent | null> = [null];
	const nextId = (): number => events.length;
	events.push(portalEvent(nextId(), "Entrance", dungeon.entrance));
	if (dungeon.exit) events.push(portalEvent(nextId(), "Exit", dungeon.exit));
	dungeon.chests.forEach((chest, i) => {
		events.push(chestEvent(nextId(), i, chest, options));
	});
	return events;
}
