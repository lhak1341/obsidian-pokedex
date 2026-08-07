// FilterBar's Ability dropdown: narrows the option list to the current
// search text, then bubbles already-selected abilities to the front so a
// user picking a 2nd/3rd ability doesn't have to re-scroll past their first
// pick. The search filter applies BEFORE the selected-first partition — a
// selected ability that no longer matches the search text is still excluded,
// not exempted, same as every other match-then-partition step here.
export function filterAndOrderAbilityOptions(options: string[], search: string, selected: string[]): string[] {
	const matches = options.filter((a) => a.toLowerCase().includes(search.toLowerCase()));
	const selectedMatches = matches.filter((a) => selected.includes(a));
	const rest = matches.filter((a) => !selected.includes(a));
	return [...selectedMatches, ...rest];
}
