export function applyPlayableVideoFilters(searchUrl: URL): URL {
  searchUrl.searchParams.set('videoEmbeddable', 'true');
  searchUrl.searchParams.set('videoSyndicated', 'true');
  return searchUrl;
}

interface VideoDetailsWithStatus {
  status?: {
    embeddable?: boolean;
  };
}

export function filterEmbeddableVideoDetails<T extends VideoDetailsWithStatus>(items: T[]): T[] {
  return items.filter((item) => item.status?.embeddable === true);
}
