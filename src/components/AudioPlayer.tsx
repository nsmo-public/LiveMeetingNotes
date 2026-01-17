import React, { useEffect, useRef, useState } from 'react';
import { Button, Space, Slider } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined
} from '@ant-design/icons';

interface Props {
  audioBlob: Blob | null;
}

export const AudioPlayer: React.FC<Props> = ({ audioBlob }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Update audio source when blob changes
  useEffect(() => {
    if (audioBlob) {
      // Revoke previous URL to free memory
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [audioBlob]);

  // Setup audio element event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  // Listen for seek events from NotesEditor
  useEffect(() => {
    const handleSeek = (e: Event) => {
      const customEvent = e as CustomEvent;
      const time = customEvent.detail.time;
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
        if (!isPlaying) {
          handlePlay();
        }
      }
    };

    window.addEventListener('seek-audio', handleSeek);
    return () => window.removeEventListener('seek-audio', handleSeek);
  }, [isPlaying]);

  const handlePlay = async () => {
    if (!audioRef.current) return;

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  };

  const handlePause = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  };

  const handleSeek = (value: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const handleSkipBackward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
  };

  const handleSkipForward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.min(
      duration,
      audioRef.current.currentTime + 10
    );
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '00:00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!audioBlob) {
    return (
      <div className="audio-player disabled">
        <div className="player-info">
          📢 No audio available. Record a meeting to see playback controls.
        </div>
      </div>
    );
  }

  return (
    <div className="audio-player">
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />

      <div className="player-controls">
        <Space size="middle">
          <Button
            icon={<StepBackwardOutlined />}
            onClick={handleSkipBackward}
            size="large"
            title="Skip backward 10 seconds"
          >
            -10s
          </Button>

          {!isPlaying ? (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handlePlay}
              size="large"
            >
              Play
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<PauseCircleOutlined />}
              onClick={handlePause}
              size="large"
            >
              Pause
            </Button>
          )}

          <Button
            icon={<StepForwardOutlined />}
            onClick={handleSkipForward}
            size="large"
            title="Skip forward 10 seconds"
          >
            +10s
          </Button>
        </Space>
      </div>

      <div className="player-progress">
        <span className="time-display">{formatTime(currentTime)}</span>
        <Slider
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          tooltip={{ formatter: (value: number | undefined) => formatTime(value || 0) }}
          className="audio-slider"
        />
        <span className="time-display">{formatTime(duration)}</span>
      </div>
    </div>
  );
};
