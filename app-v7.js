function libretroPlaylistNameV7(repository) {
  return String(repository || "").replace(/_-_/g, " - ").replace(/_/g, " ");
}

function libretroCandidatesV7(game, platform) {
  const repository = libretroRepoV6(platform?.label);
  if (!repository) return [];
  const playlist = libretroPlaylistNameV7(repository);
  const rawTitle = String(game.title || "").replace(/[™®©]/g, "").trim();
  const alternate = rawTitle.replace(/:\s*/g, " - ");
  const names = unique([rawTitle, alternate]).flatMap(title => [
    title,
    `${title} (USA)`,
    `${title} (World)`,
    `${title} (Europe)`,
    `${title} (Japan)`,
    `${title} (USA, Europe)`
  ]);
  return names.flatMap(name => {
    const filename = `${encodeURIComponent(invalidThumbnailNameV6(name))}.png`;
    return [
      {
        url: `https://thumbnails.libretro.com/${encodeURIComponent(playlist)}/Named_Boxarts/${filename}`,
        source: "Libretro CDN",
        platform: platform.label,
        platformSpecific: true
      },
      {
        url: `https://raw.githubusercontent.com/libretro-thumbnails/${repository}/master/Named_Boxarts/${filename}`,
        source: "Libretro GitHub",
        platform: platform.label,
        platformSpecific: true
      }
    ];
  });
}

libretroCandidatesV6 = libretroCandidatesV7;

coverCandidatesForGameV6 = function coverCandidatesForGameV7(game, requestedPlatform) {
  const platform = preferredPlatformV6(game, requestedPlatform);
  const selectedSpecific = requestedPlatform && requestedPlatform !== "all";
  const pcLike = /windows|linux|macos|mac os|\bpc\b/i.test(platform.label || "");
  const libretro = libretroCandidatesV7(game, platform);
  const steam = game.steamId ? [{
    url: steamCover(game.steamId),
    source: "Steam",
    platform: platform.label,
    platformSpecific: pcLike
  }] : [];
  const existing = unique([...(game.coverCandidates || []), game.cover, game.fallbackCover])
    .filter(Boolean)
    .map(url => ({
      url,
      source: /steamstatic/.test(url) ? "Steam" : /wikimedia|wikipedia/.test(url) ? "Wikimedia" : "Відкрите джерело",
      platform: platform.label,
      platformSpecific: game.platforms.length === 1 && game.platforms[0] === platform.label
    }));

  let candidates;
  if (selectedSpecific) {
    candidates = [
      ...libretro,
      ...(pcLike ? steam : []),
      ...existing.filter(candidate => candidate.platformSpecific)
    ];
  } else {
    candidates = [
      ...libretro,
      ...(pcLike ? steam : []),
      ...existing,
      ...(!pcLike ? steam.map(candidate => ({ ...candidate, source: "Steam (резерв)" })) : [])
    ];
  }

  return [...new Map(candidates.map(item => [item.url, item])).values()].slice(0, 24);
};
