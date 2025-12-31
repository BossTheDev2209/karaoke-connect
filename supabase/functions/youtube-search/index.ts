import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!apiKey) {
      console.error('YOUTUBE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'YouTube API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching YouTube for:', query);

    // Search for videos
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('q', `${query} karaoke OR lyrics`);
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', '10');
    searchUrl.searchParams.set('videoCategoryId', '10'); // Music category
    searchUrl.searchParams.set('key', apiKey);

    const searchResponse = await fetch(searchUrl.toString());
    const searchData = await searchResponse.json();

    if (searchData.error) {
      console.error('YouTube API error:', searchData.error);
      return new Response(
        JSON.stringify({ error: searchData.error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoIds = searchData.items?.map((item: any) => item.id.videoId).join(',');
    
    if (!videoIds) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get video details including duration
    const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    detailsUrl.searchParams.set('part', 'contentDetails,snippet');
    detailsUrl.searchParams.set('id', videoIds);
    detailsUrl.searchParams.set('key', apiKey);

    const detailsResponse = await fetch(detailsUrl.toString());
    const detailsData = await detailsResponse.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = detailsData.items?.map((item: any) => ({
      videoId: item.id,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      duration: formatDuration(item.contentDetails.duration),
    })) || [];

    console.log(`Found ${results.length} results`);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error in youtube-search function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Convert ISO 8601 duration to mm:ss format
function formatDuration(isoDuration: string): string {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '0:00';

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
