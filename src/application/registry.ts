import type { LayoutGenerator } from "../domain/generator.js";
import { roomsGenerator } from "../domain/generators/rooms.js";

/** 名前からレイアウト生成アルゴリズムを引く表。独自アルゴリズムはここに足す。 */
export class GeneratorRegistry {
	private readonly generators = new Map<string, LayoutGenerator>();

	constructor(generators: readonly LayoutGenerator[] = []) {
		for (const generator of generators) this.register(generator);
	}

	register(generator: LayoutGenerator): this {
		this.generators.set(generator.name, generator);
		return this;
	}

	get(name: string): LayoutGenerator | undefined {
		return this.generators.get(name);
	}

	names(): string[] {
		return [...this.generators.keys()];
	}
}

export function createDefaultRegistry(): GeneratorRegistry {
	return new GeneratorRegistry([roomsGenerator]);
}
