import type {
  Game,
  LocalizedText,
  MediaAsset,
  ProviderId,
  Rating,
  Release,
  SearchResult,
  SourceRef,
} from '@save-slot/domain';
import { normalizePlatformIdentity } from '@save-slot/domain/platforms';

const providerPriority: Record<ProviderId, number> = {
  igdb: 100,
  mobygames: 95,
  'official-store': 94,
  wikidata: 90,
  steam: 88,
  pcgamingwiki: 84,
  wikipedia: 80,
  libretro: 78,
  rawg: 70,
  manual: 60,
};

function normalized(value: string): string {
  return value
    .toLocaleLowerCase('en-US')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bthe\b/g, ' ')
    .replace(/[^a-z0-9а-яіїєґ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function sourceKey(source: SourceRef): string {
  return `${source.provider}:${source.id}`;
}

function uniqueSources(values: SourceRef[]): SourceRef[] {
  return [...new Map(values.map((value) => [sourceKey(value), value])).values()];
}

function titleCandidates(result: SearchResult): Set<string> {
  return new Set(
    [result.game.title, ...result.game.aliases, ...result.releases.map((release) => release.title)]
      .map(normalized)
      .filter(Boolean),
  );
}

function developerKeys(result: SearchResult): Set<string> {
  return new Set(result.game.developers.map(normalized).filter(Boolean));
}

function years(result: SearchResult): number[] {
  return uniqueStrings(
    result.releases
      .map((release) => release.year?.toString() ?? release.releaseDate?.slice(0, 4) ?? '')
      .filter(Boolean),
  ).map(Number);
}

function platformIdentity(release: Release): string {
  return normalizePlatformIdentity(release.platform.name).id;
}

function platformKeys(result: SearchResult): Set<string> {
  return new Set(
    result.releases.flatMap((release) => [
      platformIdentity(release),
      normalized(release.platform.name),
    ]),
  );
}

function externalIdentityKeys(result: SearchResult): Set<string> {
  return new Set(
    [
      ...result.game.sourceRefs,
      ...result.releases.flatMap((release) => release.sourceRefs),
    ].map(sourceKey),
  );
}

function intersects<T>(left: Set<T>, right: Set<T>): boolean {
  for (const value of left) if (right.has(value)) return true;
  return false;
}

function closestYearDistance(left: SearchResult, right: SearchResult): number | undefined {
  const leftYears = years(left);
  const rightYears = years(right);
  if (!leftYears.length || !rightYears.length) return undefined;
  return Math.min(...leftYears.flatMap((a) => rightYears.map((b) => Math.abs(a - b))));
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalized(left).split(' ').filter(Boolean));
  const rightTokens = new Set(normalized(right).split(' ').filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const common = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union ? common / union : 0;
}

export interface IdentityAssessment {
  confidence: number;
  reason:
    | 'same-canonical-id'
    | 'shared-external-id'
    | 'title-year-platform'
    | 'title-year'
    | 'title-platform-developer'
    | 'fuzzy-title-year-platform'
    | 'insufficient';
}

export function assessIdentity(left: SearchResult, right: SearchResult): IdentityAssessment {
  if (left.game.id === right.game.id) {
    return { confidence: 1, reason: 'same-canonical-id' };
  }

  if (intersects(externalIdentityKeys(left), externalIdentityKeys(right))) {
    return { confidence: 1, reason: 'shared-external-id' };
  }

  const leftTitles = titleCandidates(left);
  const rightTitles = titleCandidates(right);
  const exactTitle = intersects(leftTitles, rightTitles);
  const yearDistance = closestYearDistance(left, right);
  const platformOverlap = intersects(platformKeys(left), platformKeys(right));
  const developerOverlap = intersects(developerKeys(left), developerKeys(right));

  if (exactTitle && platformOverlap && yearDistance !== undefined && yearDistance <= 1) {
    return { confidence: 0.96, reason: 'title-year-platform' };
  }
  if (exactTitle && yearDistance !== undefined && yearDistance <= 1) {
    return { confidence: 0.9, reason: 'title-year' };
  }
  if (exactTitle && platformOverlap && developerOverlap) {
    return { confidence: 0.9, reason: 'title-platform-developer' };
  }

  const similarity = Math.max(
    ...[...leftTitles].flatMap((leftTitle) =>
      [...rightTitles].map((rightTitle) => tokenSimilarity(leftTitle, rightTitle)),
    ),
    0,
  );
  if (similarity >= 0.9 && platformOverlap && yearDistance !== undefined && yearDistance <= 1) {
    return { confidence: 0.86, reason: 'fuzzy-title-year-platform' };
  }

  return { confidence: 0, reason: 'insufficient' };
}

function score(result: SearchResult): number {
  return Math.max(...result.providers.map((provider) => providerPriority[provider] ?? 0), 0);
}

function uniqueDescriptions(values: LocalizedText[]): LocalizedText[] {
  return [
    ...new Map(
      values.map((value) => [
        `${value.locale}:${sourceKey(value.source)}:${normalized(value.text)}`,
        value,
      ]),
    ).values(),
  ];
}

function uniqueMedia(values: MediaAsset[]): MediaAsset[] {
  return [
    ...new Map(
      [...values]
        .sort((left, right) => Number(right.verified) - Number(left.verified))
        .map((value) => [`${value.kind}:${value.url}`, value]),
    ).values(),
  ];
}

function uniqueRatings(values: Rating[]): Rating[] {
  return [
    ...new Map(
      values.map((value) => [
        `${value.kind}:${sourceKey(value.source)}:${value.releaseId ?? value.gameId}`,
        value,
      ]),
    ).values(),
  ];
}

function releaseIdentity(release: Release): string {
  return [
    platformIdentity(release),
    normalized(release.region),
    release.year ?? release.releaseDate?.slice(0, 4) ?? '',
    normalized(release.edition ?? ''),
  ].join('|');
}

function rebindRelease(release: Release, gameId: string): Release {
  const releaseId = release.id;
  return {
    ...release,
    gameId,
    media: release.media.map((asset) => ({
      ...asset,
      gameId,
      ...(asset.releaseId ? { releaseId } : {}),
    })),
    ratings: release.ratings.map((rating) => ({
      ...rating,
      gameId,
      ...(rating.releaseId ? { releaseId } : {}),
    })),
  };
}

function mergeRelease(primary: Release, secondary: Release, gameId: string): Release {
  const releaseId = primary.id;
  return {
    ...secondary,
    ...primary,
    id: releaseId,
    gameId,
    releaseDate: primary.releaseDate ?? secondary.releaseDate,
    year: primary.year ?? secondary.year,
    edition: primary.edition ?? secondary.edition,
    formats: uniqueStrings([...primary.formats, ...secondary.formats]) as Release['formats'],
    media: uniqueMedia([...primary.media, ...secondary.media]).map((asset) => ({
      ...asset,
      gameId,
      ...(asset.releaseId ? { releaseId } : {}),
    })),
    ratings: uniqueRatings([...primary.ratings, ...secondary.ratings]).map((rating) => ({
      ...rating,
      gameId,
      ...(rating.releaseId ? { releaseId } : {}),
    })),
    sourceRefs: uniqueSources([...primary.sourceRefs, ...secondary.sourceRefs]),
  };
}

function mergeGame(primary: Game, secondary: Game, releaseIds: string[]): Game {
  return {
    ...secondary,
    ...primary,
    aliases: uniqueStrings([
      ...primary.aliases,
      secondary.title,
      ...secondary.aliases,
    ]).filter((alias) => normalized(alias) !== normalized(primary.title)),
    descriptions: uniqueDescriptions([...primary.descriptions, ...secondary.descriptions]),
    genres: uniqueStrings([...primary.genres, ...secondary.genres]),
    developers: uniqueStrings([...primary.developers, ...secondary.developers]),
    publishers: uniqueStrings([...primary.publishers, ...secondary.publishers]),
    franchises: uniqueStrings([...primary.franchises, ...secondary.franchises]),
    releaseIds,
    sourceRefs: uniqueSources([...primary.sourceRefs, ...secondary.sourceRefs]),
  };
}

export function mergeSearchResults(left: SearchResult, right: SearchResult): SearchResult {
  const [primary, secondary] = score(left) >= score(right) ? [left, right] : [right, left];
  const releaseMap = new Map<string, Release>();

  for (const originalRelease of [...primary.releases, ...secondary.releases]) {
    const release = rebindRelease(originalRelease, primary.game.id);
    const key = releaseIdentity(release);
    const previous = releaseMap.get(key);
    releaseMap.set(
      key,
      previous ? mergeRelease(previous, release, primary.game.id) : release,
    );
  }

  const releases = [...releaseMap.values()];
  const game = mergeGame(primary.game, secondary.game, releases.map((release) => release.id));
  return {
    game,
    releases,
    relevance: Math.max(left.relevance, right.relevance),
    providers: [...new Set([...left.providers, ...right.providers])],
  };
}

export function reconcileSearchResults(
  results: SearchResult[],
  minimumConfidence = 0.85,
): SearchResult[] {
  const reconciled: SearchResult[] = [];

  for (const candidate of results) {
    let bestIndex = -1;
    let bestConfidence = minimumConfidence;
    for (const [index, existing] of reconciled.entries()) {
      const assessment = assessIdentity(existing, candidate);
      if (assessment.confidence >= bestConfidence) {
        bestConfidence = assessment.confidence;
        bestIndex = index;
      }
    }

    if (bestIndex < 0) {
      reconciled.push(candidate);
      continue;
    }
    reconciled[bestIndex] = mergeSearchResults(reconciled[bestIndex]!, candidate);
  }

  return reconciled;
}
