// Consume only the additions accepted by the shared Content Patcher reader.
export function addCatalogEntries(target, additions, diagnostics, domain) {
  for (const [id, value] of Object.entries(additions || {})) {
    if (Object.hasOwn(target, id)) {
      diagnostics.status = "uncertain";
      diagnostics.supportedDomains = (diagnostics.supportedDomains || []).filter((value) => value !== domain);
      diagnostics.uncertainDomains = [...new Set([...diagnostics.uncertainDomains, domain])];
    } else target[id] = value;
  }
}

export function npcMetadata(characters) {
  return Object.fromEntries(Object.entries(characters || {}).map(([id, entry]) => [id, {
    displayName: entry.DisplayName || id,
    birthSeason: ["spring", "summer", "fall", "winter"].includes(entry.BirthSeason) ? entry.BirthSeason : null,
    birthDay: Number.isInteger(entry.BirthDay) && entry.BirthDay >= 1 && entry.BirthDay <= 28 ? entry.BirthDay : null,
  }]));
}
