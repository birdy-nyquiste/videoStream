import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { EmailLogin } from './EmailLogin';
import { Paywall } from './Paywall';
import { PaymentReturn } from './PaymentReturn';
import { supabase } from '../lib/supabase';

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

type Gate = null | 'login' | 'paywall' | 'paymentReturn';

export const VideoList: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const [gate, setGate] = useState<Gate>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('paid') === '1' ? 'paymentReturn' : null;
  });
  const pendingPlayUidRef = useRef<string | null>(null);
  const videosRef = useRef<Video[]>([]);
  const requestPlayRef = useRef<(video: Video) => void>(() => {});

  const refreshEntitlement = useCallback(async (): Promise<boolean> => {
    const { data, error: entErr } = await supabase
      .from('entitlements')
      .select('user_id')
      .maybeSingle();
    if (entErr) return false;
    const ok = !!data;
    return ok;
  }, []);

  const tryResumePending = useCallback(() => {
    const uid = pendingPlayUidRef.current;
    if (!uid) return;
    const video = videosRef.current.find((v) => v.uid === uid);
    if (!video) return;
    pendingPlayUidRef.current = null;
    requestPlayRef.current(video);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const session = data.session;
      accessTokenRef.current = session?.access_token ?? null;
      setUserEmail(session?.user.email ?? null);
      if (session) await refreshEntitlement();
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      accessTokenRef.current = session?.access_token ?? null;
      setUserEmail(session?.user.email ?? null);
      if (session) {
        const ok = await refreshEntitlement();
        if (ok) tryResumePending();
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshEntitlement, tryResumePending]);

  const fetchToken = useCallback(async (uid: string) => {
    setTokenLoading(true);
    setActiveToken(null);
    try {
      const jwt = accessTokenRef.current;
      if (!jwt) {
        pendingPlayUidRef.current = uid;
        setGate('login');
        return;
      }
      const res = await fetch(`/api/token/${uid}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.status === 401) {
        pendingPlayUidRef.current = uid;
        setGate('login');
        return;
      }
      if (res.status === 402) {
        pendingPlayUidRef.current = uid;
        setGate('paywall');
        return;
      }
      if (!res.ok) {
        setError('Could not load video token. Please try again.');
        return;
      }
      const data = (await res.json()) as { token: string };
      setActiveToken(data.token);
    } catch {
      setError('Could not load video token. Please try again.');
    } finally {
      setTokenLoading(false);
    }
  }, []);

  const requestPlay = useCallback(
    async (video: Video) => {
      setActiveUid(video.uid);
      if (!canPlay(video)) {
        setActiveToken(null);
        setTokenLoading(false);
        return;
      }
      if (!userEmail) {
        pendingPlayUidRef.current = video.uid;
        setGate('login');
        return;
      }
      fetchToken(video.uid);
    },
    [userEmail, fetchToken]
  );

  const selectThumb = useCallback((video: Video) => {
    setActiveUid(video.uid);
    setActiveToken(null);
    setTokenLoading(false);
  }, []);

  useEffect(() => {
    videosRef.current = videos;
  }, [videos]);

  useEffect(() => {
    requestPlayRef.current = requestPlay;
  }, [requestPlay]);

  useEffect(() => {
    fetch('/api/videos')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load videos');
        return res.json() as Promise<Video[]>;
      })
      .then((data) => {
        setVideos(data);
        const first = data.find(canPlay) ?? data[0];
        if (first) selectThumb(first);
      })
      .catch(() => setError('Could not load video list. Please try again.'))
      .finally(() => setLoading(false));
  }, [selectThumb]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setGate(null);
    pendingPlayUidRef.current = null;
    setActiveToken(null);
  };

  const closeGate = () => {
    setGate(null);
    pendingPlayUidRef.current = null;
  };

  const handlePaymentActivated = async () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('paid');
    window.history.replaceState({}, '', url.pathname + url.search);
    await refreshEntitlement();
    setGate(null);
    tryResumePending();
  };

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
        onClick={() => requestPlay(video)}
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
          {userEmail && (
            <div className="sidebar-user">
              <span className="sidebar-user-email" title={userEmail}>{userEmail}</span>
              <button className="text-button" onClick={handleSignOut}>Sign out</button>
            </div>
          )}
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
        ) : tokenLoading ? (
          <div className="video-player-wrapper">
            <div className="video-player-header"><h2>{activeVideo.title}</h2></div>
            <div className="video-player-container video-placeholder">
              <div className="placeholder-content">
                <div className="spinner" />
              </div>
            </div>
          </div>
        ) : !activeToken ? (
          <div className="video-player-wrapper">
            <div className="video-player-header"><h2>{activeVideo.title}</h2></div>
            <div className="video-player-container video-placeholder">
              <div className="placeholder-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <p>Click play to start</p>
                <button className="submit-button" onClick={() => requestPlay(activeVideo)}>
                  Play
                </button>
              </div>
            </div>
          </div>
        ) : (
          <VideoPlayer key={activeUid} token={activeToken} title={activeVideo.title} />
        )}
      </div>

      {gate === 'login' && (
        <EmailLogin onCancel={closeGate} />
      )}
      {gate === 'paywall' && userEmail && (
        <Paywall
          email={userEmail}
          getAccessToken={() => accessTokenRef.current}
          onCancel={closeGate}
          onSignOut={handleSignOut}
        />
      )}
      {gate === 'paymentReturn' && (
        <PaymentReturn
          onActivated={handlePaymentActivated}
          onClose={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete('paid');
            window.history.replaceState({}, '', url.pathname);
            setGate(null);
          }}
        />
      )}
    </div>
  );
};
