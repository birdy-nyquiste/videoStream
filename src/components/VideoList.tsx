import React, { useState } from 'react';
import { config } from '../config';
import { VideoPlayer } from './VideoPlayer';

export const VideoList: React.FC = () => {
  const { videos } = config;
  const [activeVideoId, setActiveVideoId] = useState<string | null>(videos[0]?.id || null);

  const activeVideo = videos.find(v => v.id === activeVideoId);

  return (
    <div className="video-layout">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Video Library</h2>
        </div>
        <div className="video-list">
          {videos.map((video) => (
            <button
              key={video.id}
              className={`video-list-item ${activeVideoId === video.id ? 'active' : ''}`}
              onClick={() => setActiveVideoId(video.id)}
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
        {activeVideo ? (
          <VideoPlayer videoId={activeVideo.videoId} title={activeVideo.title} />
        ) : (
          <div className="empty-state">
            <p>Select a video to play</p>
          </div>
        )}
      </div>
    </div>
  );
};
