import React, { useEffect, useRef, useState } from 'react';
import { Button, Space, Slider, Select } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  SoundOutlined,
  ZoomInOutlined,
  ZoomOutOutlined
} from '@ant-design/icons';
import WaveSurfer from 'wavesurfer.js';

interface Props {
  audioBlob: Blob | null;
}

export const AudioPlayer: React.FC<Props> = ({ audioBlob }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(100);
  const [zoom, setZoom] = useState(50);

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

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current || !audioUrl) return;

    // Destroy existing instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    // Create WaveSurfer instance
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#4a9eff',
      progressColor: '#1890ff',
      cursorColor: '#ff4d4f',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 100,
      normalize: true,
      interact: true,
      dragToSeek: true,
      hideScrollbar: false,
    });

    // Load audio
    wavesurfer.load(audioUrl);

    // Event listeners
    wavesurfer.on('ready', () => {
      setDuration(wavesurfer.getDuration());
    });

    wavesurfer.on('timeupdate', (time) => {
      setCurrentTime(time);
    });

    wavesurfer.on('play', () => {
      setIsPlaying(true);
    });

    wavesurfer.on('pause', () => {
      setIsPlaying(false);
    });

    wavesurfer.on('finish', () => {
      setIsPlaying(false);
    });

    wavesurferRef.current = wavesurfer;

    return () => {
      wavesurfer.destroy();
    };
  }, [audioUrl]);

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

  // Update WaveSurfer playback rate
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(playbackRate);
    }
  }, [playbackRate]);

  // Update WaveSurfer volume
  useEffect(() => {
    if (wavesurferRef.current) {
      const volumeLevel = Math.min(volume / 100, 1);
      wavesurferRef.current.setVolume(volumeLevel);
    }
  }, [volume]);

  // Update WaveSurfer zoom
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.zoom(zoom);
    }
  }, [zoom]);

  // Listen for seek events from NotesEditor
  useEffect(() => {
    const handleSeek = (e: Event) => {
      const customEvent = e as CustomEvent;
      const time = customEvent.detail.time;
      if (wavesurferRef.current) {
        wavesurferRef.current.setTime(time);
        if (!isPlaying) {
          handlePlay();
        }
      }
    };

    window.addEventListener('seek-audio', handleSeek);
    return () => window.removeEventListener('seek-audio', handleSeek);
  }, [isPlaying]);

  const handlePlay = async () => {
    if (!wavesurferRef.current) return;

    try {
      await wavesurferRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  };

  const handlePause = () => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.pause();
    setIsPlaying(false);
  };

  const handleSeek = (value: number) => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.setTime(value);
    setCurrentTime(value);
  };

  const handleSkipBackward = () => {
    if (!wavesurferRef.current) return;
    const newTime = Math.max(0, currentTime - 10);
    wavesurferRef.current.setTime(newTime);
  };

  const handleSkipForward = () => {
    if (!wavesurferRef.current) return;
    const newTime = Math.min(duration, currentTime + 10);
    wavesurferRef.current.setTime(newTime);
  };

  const handlePlaybackRateChange = (rate: number) => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.setPlaybackRate(rate);
    setPlaybackRate(rate);
  };

  const handleVolumeChange = (value: number) => {
    if (!wavesurferRef.current) return;
    // Volume range is 0-1 for wavesurfer, but we use 0-200 for UI (allowing 2x amplification)
    const volumeLevel = Math.min(value / 100, 1);
    wavesurferRef.current.setVolume(volumeLevel);
    setVolume(value);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 10, 10));
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
      {/* Waveform Container */}
      <div className="waveform-container">
        <div ref={waveformRef} className="waveform" />
      </div>

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

        <Space size="middle" style={{ marginLeft: '20px' }}>
          <Select
            value={playbackRate}
            onChange={handlePlaybackRateChange}
            style={{ width: 100 }}
            options={[
              { value: 0.5, label: '0.5x' },
              { value: 0.75, label: '0.75x' },
              { value: 1.0, label: '1.0x' },
              { value: 1.25, label: '1.25x' },
              { value: 1.5, label: '1.5x' },
              { value: 1.75, label: '1.75x' },
              { value: 2.0, label: '2.0x' },
            ]}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
            <SoundOutlined />
            <Slider
              min={0}
              max={200}
              value={volume}
              onChange={handleVolumeChange}
              tooltip={{ formatter: (value: number | undefined) => `${value}%` }}
              style={{ flex: 1, margin: 0 }}
            />
            <span style={{ minWidth: '45px', textAlign: 'right' }}>{volume}%</span>
          </div>

          <Space size="small">
            <Button
              icon={<ZoomOutOutlined />}
              onClick={handleZoomOut}
              title="Zoom out"
              disabled={zoom <= 10}
            />
            <Button
              icon={<ZoomInOutlined />}
              onClick={handleZoomIn}
              title="Zoom in"
              disabled={zoom >= 200}
            />
          </Space>
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
