const SAVE_SLOT_V11 = "0.6.1";
const resolveCoverBeforeV11 = resolveCoverV6;

async function additionalCoverSourcesV11(game, requestedPlatform) {
  if (game.additionalCoverSourcesV11) return game.additionalCoverSourcesV11;
  const platform = preferredPlatformV6(game, requestedPlatform);
  const label = platform?.label || "";
  const specific = requestedPlatform && requestedPlatform !== "all";
  const pcLike = /windows|linux|macos|mac os|\bpc\b/i.test(label);
  const storeMatches = !specific || game.platforms.length === 1 ||
    (/playstation/i.test(label) && game.playstationConceptId) ||
    (/xbox|windows/i.test(label) && game.microsoftStoreId) ||
    (/nintendo|switch|wii|3ds|\bds\b/i.test(label) && game.nintendoStoreId);

  const [official, steam, pcgw, wikipedia] = await Promise.all([
    storeMatches ? fetchOfficialStoreDetailsV10(game) : null,
    pcLike ? fetchSteamDetailsV10(game) : null,
    pcLike ? fetchPcGamingWikiV10(game) : null,
    !specific || game.platforms.length === 1 ? fetchWikipediaSummaryV10(game) : null
  ]);

  const candidates = [
    official?.cover ? { url: official.cover, source: "Офіційний магазин", platform: label } : null,
    steam?.cover ? { url: steam.cover, source: "Steam Box Art", platform: label } : null,
    pcgw?.cover ? { url: pcgw.cover, source: "PCGamingWiki", platform: label } : null,
    wikipedia?.cover ? { url: wikipedia.cover, source: "Wikipedia", platform: label } : null
  ].filter(Boolean);
  game.additionalCoverSourcesV11 = candidates;
  if (!game.officialDescription) {
    game.officialDescription = official?.description || steam?.description || wikipedia?.description || game.description;
  }
  return candidates;
}

resolveCoverV6 = async function resolveCoverV11(game, requestedPlatform, generation) {
  if (await resolveCoverBeforeV11(game, requestedPlatform, generation)) return true;
  if (generation !== coverGenerationV6) return false;
  const candidates = await additionalCoverSourcesV11(game, requestedPlatform);
  for (const candidate of candidates) {
    if (generation !== coverGenerationV6) return false;
    const dimensions = await inspectImageV8(candidate.url, 10000);
    if (!dimensions) continue;
    const ratio = dimensions.height / Math.max(1, dimensions.width);
    if (dimensions.width < 120 || dimensions.height < 180 || ratio < 1.15) continue;
    game.cover = candidate.url;
    game.coverCandidates = unique([candidate.url, ...(game.coverCandidates || [])]);
    game.coverReady = true;
    game.coverLoading = false;
    game.coverFailed = false;
    game.coverVerified = true;
    game.coverSource = candidate.source;
    game.coverPlatform = candidate.platform || preferredPlatformV6(game, requestedPlatform).label;
    return true;
  }
  game.coverLoading = false;
  game.coverFailed = true;
  return false;
};
