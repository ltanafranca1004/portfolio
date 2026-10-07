// Records the real screen at 60 frames a second, at full resolution, with ffmpeg (hardware
// encoder). macOS's own `screencapture -v` stops after a second when it has no terminal.
// Needs Screen Recording permission for the app this runs in.
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

/** Start recording to `file`. Returns a function that stops it and waits for the file. */
export function record(file) {
  rmSync(file, { force: true });
  const ffmpeg = spawn(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'avfoundation', '-framerate', '60', '-capture_cursor', '1', '-pixel_format', 'nv12', '-i', 'Capture screen 0:none', '-c:v', 'h264_videotoolbox', '-b:v', '30M', '-pix_fmt', 'yuv420p', '-video_track_timescale', '60000', file],
    { stdio: ['pipe', 'ignore', 'pipe'] },
  );
  let complaint = '';
  ffmpeg.stderr.on('data', (d) => (complaint += d));
  return () =>
    new Promise((done) => {
      ffmpeg.on('close', () => {
        if (complaint.trim()) console.error(`ffmpeg: ${complaint.trim().split('\n').slice(-2).join(' | ')}`);
        done();
      });
      ffmpeg.stdin.write('q');
      ffmpeg.stdin.end();
    });
}
