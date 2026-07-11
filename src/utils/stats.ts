import type { StatBlock } from "../data/types";

export function totalStat(stats: StatBlock): number {
	return stats.hp + stats.attack + stats.defense + stats.specialAttack + stats.specialDefense + stats.speed;
}
