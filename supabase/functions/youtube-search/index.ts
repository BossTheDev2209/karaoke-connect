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
    const { query, type = 'video', channelId } = await req.json();
    
    if (!query && !channelId) {
      return new Response(
        JSON.stringify({ error: 'Query or channelId is required' }),
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

    // If channelId provided, fetch videos from that channel
    if (channelId) {
      console.log('Fetching videos from channel:', channelId);
      return await fetchChannelVideos(apiKey, channelId);
    }

    // Search for channels
    if (type === 'channel') {
      console.log('Searching YouTube channels for:', query);
      return await searchChannels(apiKey, query);
    }

    // Default: search for videos
    console.log('Searching YouTube videos for:', query);
    return await searchVideos(apiKey, query);

  } catch (err) {
    const error = err as Error;
    console.error('Error in youtube-search function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function searchVideos(apiKey: string, query: string) {
  // Search for videos - no longer appending "karaoke OR lyrics"
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('maxResults', '15');
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

  const results = detailsData.items?.map((item: any) => ({
    videoId: item.id,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    channelId: item.snippet.channelId,
    thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
    duration: formatDuration(item.contentDetails.duration),
  })) || [];

  console.log(`Found ${results.length} video results`);

  return new Response(
    JSON.stringify({ results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function searchChannels(apiKey: string, query: string) {
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('type', 'channel');
  searchUrl.searchParams.set('maxResults', '10');
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

  const channelIds = searchData.items?.map((item: any) => item.id.channelId).join(',');
  
  if (!channelIds) {
    return new Response(
      JSON.stringify({ channels: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get channel details including subscriber count
  const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
  detailsUrl.searchParams.set('part', 'snippet,statistics');
  detailsUrl.searchParams.set('id', channelIds);
  detailsUrl.searchParams.set('key', apiKey);

  const detailsResponse = await fetch(detailsUrl.toString());
  const detailsData = await detailsResponse.json();

  const channels = detailsData.items?.map((item: any) => ({
    channelId: item.id,
    title: item.snippet.title,
    description: item.snippet.description?.substring(0, 100) || '',
    thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
    subscriberCount: formatSubscriberCount(item.statistics.subscriberCount),
    videoCount: item.statistics.videoCount,
  })) || [];

  console.log(`Found ${channels.length} channel results`);

  return new Response(
    JSON.stringify({ channels }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function fetchChannelVideos(apiKey: string, channelId: string) {
  // Search for videos from this channel
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('channelId', channelId);
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('order', 'viewCount'); // Most popular first
  searchUrl.searchParams.set('maxResults', '20');
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

  const videoIds = searchData.items?.map((item: any) => item.id.videoId).join(',');
  
  if (!videoIds) {
    return new Response(
      JSON.stringify({ results: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get video details
  const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  detailsUrl.searchParams.set('part', 'contentDetails,snippet');
  detailsUrl.searchParams.set('id', videoIds);
  detailsUrl.searchParams.set('key', apiKey);

  const detailsResponse = await fetch(detailsUrl.toString());
  const detailsData = await detailsResponse.json();

  const results = detailsData.items?.map((item: any) => ({
    videoId: item.id,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    channelId: item.snippet.channelId,
    thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
    duration: formatDuration(item.contentDetails.duration),
  })) || [];

  console.log(`Found ${results.length} videos from channel`);

  return new Response(
    JSON.stringify({ results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

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

function formatSubscriberCount(count: string): string {
  const num = parseInt(count, 10);
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return count;
}
