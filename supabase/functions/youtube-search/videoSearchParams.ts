export function applyPlayableVideoFilters(searchUrl: URL): URL {
  searchUrl.searchParams.set('videoEmbeddable', 'true');
  searchUrl.searchParams.set('videoSyndicated', 'true');
  return searchUrl;
}
