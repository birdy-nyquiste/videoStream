import React, { useState, useEffect } from 'react';
import { VideoPlayer } from './VideoPlayer';

interface Video {
  uid: string;
  title: string;
  thumbnail: string;
  duration: number;
}

export const VideoList: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = (uid: string) => {
    fetch(`/api/token/${uid}`)
      .then((res) => res.json() as Promise<{ token: string }>)
      .then((data) => setActiveToken(data.token))
      .catch(() => setError('Could not load video token. Please try again.'));
  };

  useEffect(() => {
    fetch('/api/videos')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load videos');
        return res.json() as Promise<Video[]>;
      })
      .then((data) => {
        setVideos(data);
        const firstUid = data[0]?.uid ?? null;
        setActiveUid(firstUid);
        if (firstUid) fetchToken(firstUid);
      })
      .catch(() => setError('Could not load video list. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const activeVideo = videos.find((v) => v.uid === activeUid);

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
          <h2>Video Library</h2>
        </div>
        <div className="video-list">
          {videos.map((video) => (
            <button
              key={video.uid}
              className={`video-list-item ${activeUid === video.uid ? 'active' : ''}`}
              onClick={() => { setActiveUid(video.uid); fetchToken(video.uid); }}
            >
              <div className="video-item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </div>
              <span className="video-item-title">{video.title}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="main-content">
        {activeVideo && activeToken ? (
          <VideoPlayer key={activeUid} token={activeToken} title={activeVideo.title} />
        ) : (
          <div className="empty-state">
            <p>No videos found</p>
          </div>
        )}
      </div>
    </div>
  );
};
