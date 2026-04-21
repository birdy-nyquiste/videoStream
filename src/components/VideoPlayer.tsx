import React from 'react';
import { Stream } from '@cloudflare/stream-react';

interface VideoPlayerProps {
  token: string;
  title: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ token, title }) => {
  return (
    <div className="video-player-wrapper">
      <div className="video-player-header">
        <h2>{title}</h2>
      </div>
      <div className="video-player-container">
        <Stream
          controls
          src={token}
          className="cloudflare-stream-player"
          responsive={true}
        />
      </div>
    </div>
  );
};
