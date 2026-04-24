import React, { useState, useEffect } from 'react';
import { VideoPlayer } from './VideoPlayer';

interface Video {
  uid: string;
  title: string;
  creator?: string;
  thumbnail: string;
  duration: number;
  allowedOrigins: string[];
}

function hostMatches(host: string, pattern: string): boolean {
  const p = pattern.trim().toLowerCase();
  const h = host.toLowerCase();
  if (p === '*' || p === h) return true;
  if (p.startsWith('*.')) return h.endsWith(p.slice(1)) && h !== p.slice(2);
  return false;
}

function canPlay(video: Video): boolean {
  if (!video.allowedOrigins || video.allowedOrigins.length === 0) return true;
  const host = window.location.hostname;
  return video.allowedOrigins.some((o) => hostMatches(host, o));
}

export const VideoList: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = (uid: string) => {
    setTokenLoading(true);
    setActiveToken(null);
    fetch(`/api/token/${uid}`)
      .then((res) => res.json() as Promise<{ token: string }>)
      .then((data) => setActiveToken(data.token))
      .catch(() => setError('Could not load video token. Please try again.'))
      .finally(() => setTokenLoading(false));
  };

  const selectVideo = (video: Video) => {
    setActiveUid(video.uid);
    if (canPlay(video)) {
      fetchToken(video.uid);
    } else {
      setActiveToken(null);
      setTokenLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/videos')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load videos');
        return res.json() as Promise<Video[]>;
      })
      .then((data) => {
        setVideos(data);
        const firstPlayable = data.find(canPlay) ?? data[0];
        if (firstPlayable) selectVideo(firstPlayable);
      })
      .catch(() => setError('Could not load video list. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const activeVideo = videos.find((v) => v.uid === activeUid);
  const activeAllowed = activeVideo ? canPlay(activeVideo) : false;
  const allowedVideos = videos.filter(canPlay);
  const restrictedVideos = videos.filter((v) => !canPlay(v));

  const renderItem = (video: Video) => {
    const playable = canPlay(video);
    return (
      <button
        key={video.uid}
        className={`video-list-item ${activeUid === video.uid ? 'active' : ''} ${playable ? '' : 'restricted'}`}
        onClick={() => selectVideo(video)}
        title={playable ? undefined : "You don't have access to this video"}
      >
        <div className="video-item-icon">
          {playable ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          )}
        </div>
        <div className="video-item-details">
          <span className="video-item-title">{video.title}</span>
          {video.creator && <span className="video-item-creator">{video.creator}</span>}
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="video-layout">
        <div className="empty-state"><p>Loading videos...</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-layout">
        <div className="empty-state"><p>{error}</p></div>
      </div>
    );
  }

  return (
    <div className="video-layout">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>ReAngle Video Library</h2>
        </div>
        <div className="video-list">
          {allowedVideos.length > 0 && (
            <div className="video-group">
              <h3 className="video-group-header">Available</h3>
              {allowedVideos.map(renderItem)}
            </div>
          )}
          {restrictedVideos.length > 0 && (
            <div className="video-group">
              <h3 className="video-group-header">Restricted</h3>
              {restrictedVideos.map(renderItem)}
            </div>
          )}
        </div>
      </div>
      <div className="main-content">
        {!activeVideo ? (
          <div className="empty-state"><p>No videos found</p></div>
        ) : !activeAllowed ? (
          <div className="video-player-wrapper">
            <div className="video-player-header"><h2>{activeVideo.title}</h2></div>
            <div className="video-player-container video-placeholder">
              <div className="placeholder-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <p>You don't have access to this video</p>
              </div>
            </div>
          </div>
        ) : tokenLoading || !activeToken ? (
          <div className="video-player-wrapper">
            <div className="video-player-header"><h2>{activeVideo.title}</h2></div>
            <div className="video-player-container video-placeholder">
              <div className="placeholder-content">
                <div className="spinner" />
              </div>
            </div>
          </div>
        ) : (
          <VideoPlayer key={activeUid} token={activeToken} title={activeVideo.title} />
        )}
      </div>
    </div>
  );
};
