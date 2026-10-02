// Name-based suggestions are starting points, never evidence of actual product usage.
const RULES = [
 ['Navigation/Arrows', /(^|-)arrow|chevron/],
 ['Status & feedback', /alert|warning|error|check|success|info|question|help/],
 ['Files & documents', /file|folder|document|clipboard|attachment/],
 ['People & accounts', /user|person|people|account|profile|team|contact/],
 ['Communication', /mail|message|chat|comment|phone|bell|notification/],
 ['Media', /play|pause|music|volume|sound|video|camera|image|photo|microphone/],
 ['Data & infrastructure', /cloud|server|database|network|chart|graph|analytics|rack/],
 ['Security', /lock|shield|key|security|password/],
 ['Time & scheduling', /clock|calendar|time|hour|history/],
 ['Places & transport', /map|location|pin|globe|world|car|truck|plane|building|home/],
 ['Editing & actions', /edit|pen|pencil|trash|delete|cut|copy|paste|plus|minus|add|remove|search|zoom|refresh|download|upload|save/],
 ['Layout & controls', /menu|grid|list|table|filter|sort|setting|cog|gear|toggle|slider|expand|resize|align/],
];
export function suggestedGroup(name) { return RULES.find(([,pattern])=>pattern.test(name.toLowerCase()))?.[0] || 'Other'; }
export function iconGroup(glyph) { return glyph.group?.trim() || 'Ungrouped'; }
