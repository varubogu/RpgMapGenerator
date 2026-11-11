/** ユーザーの指定そのものが成立しない場合のエラー。 */
export class RequestError extends Error {
	constructor(readonly problems: readonly string[]) {
		super(
			`指定内容に問題があります:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
		);
		this.name = "RequestError";
	}
}

/** 規定回数試しても破綻のないダンジョンを作れなかった場合のエラー。 */
export class GenerationError extends Error {
	constructor(
		message: string,
		readonly problems: readonly string[] = [],
	) {
		super(
			problems.length > 0
				? `${message}\n${problems.map((p) => `  - ${p}`).join("\n")}`
				: message,
		);
		this.name = "GenerationError";
	}
}
