//! Playing a folder of music, decoded here rather than in the WebView.
//!
//! The decision this file exists to enforce: **nothing about playback goes
//! through the WebView.** WebKitGTK routes all web audio through gstreamer,
//! and FLAC lives in a plugin package the machine may or may not have — which
//! is the exact failure that made Gloam's AppImage ship silent. Decoding with
//! symphonia and writing to the device with cpal means the only thing between
//! a file and the speakers is code that shipped inside the binary.
//!
//! ## Why a thread
//!
//! `rodio::OutputStream` owns a `cpal::Stream`, which is `!Send`: it cannot be
//! moved between threads, so it cannot live in Tauri's managed state and be
//! touched from whichever thread happens to service a command. So one thread
//! owns the stream and everything else talks to it down a channel. That also
//! means playback cannot be blocked by anything happening in the UI, which for
//! an app whose whole job is to be ignorable is worth more than the simplicity
//! it costs.
//!
//! The thread polls rather than blocking on `sleep_until_end`, because it has
//! to be able to hear a command while a track is playing. A hundred
//! milliseconds is the same beat the timer runs at and costs nothing.
//!
//! ## What the WebView was doing for us
//!
//! A stream is bound to the device it was opened against and stays there. The
//! browser used to follow the system's default output on our behalf, so taking
//! audio out of the WebView meant inheriting that job: the thread checks every
//! couple of seconds whether the speakers have changed underneath it, and
//! carries the music across when they have.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

/// Emitted when the track changes, for any reason — finished, skipped, or a
/// folder being opened. Carries the whole snapshot rather than an index,
/// because a listener that has to ask a second question to understand the
/// first answer is a race waiting to happen.
const TRACK_EVENT: &str = "gloam://music-track";

/// How often the thread looks up from playing to see whether it has been
/// spoken to, or whether the current track has run out.
const POLL: Duration = Duration::from_millis(100);

/// How long between asking the operating system which speakers it would hand a
/// new stream today.
///
/// Enumerating devices is cheap but not free, and nobody plugs in headphones
/// and expects the change inside a frame — a beat late reads as the hardware
/// settling, which is what it is. Measured in time rather than in polls
/// because the poll rate is not constant: it quickens while the music is
/// ducked, and counting wakes would make this fire five times as often for no
/// reason.
const DEVICE_EVERY: Duration = Duration::from_secs(2);

/// How often the thread wakes while a duck is in progress.
///
/// A fade stepped at the ordinary hundred milliseconds is heard as a staircase
/// rather than a fade — the ear is far better at spotting steps in loudness
/// than the eye is at spotting them in brightness. Twenty milliseconds puts
/// thirty steps in the release, which is below where anybody hears the joins,
/// and it lasts only as long as the duck does.
const DUCK_POLL: Duration = Duration::from_millis(20);

/// How far down the music goes while Gloam is talking.
///
/// Down, not out. Silence draws more attention than a dip does, and the point
/// is for the phrase to be heard over the music rather than instead of it —
/// somebody should be able to tell the album never stopped.
const DUCK_FLOOR: f32 = 0.22;

/// Quick enough to be out of the way before the first note lands, and not so
/// quick that the drop is itself an event.
const DUCK_FADE_IN: Duration = Duration::from_millis(140);

/// Slower coming back than going down, which is the asymmetry every compressor
/// has for the same reason: a fast recovery sounds like a mistake being undone.
const DUCK_FADE_OUT: Duration = Duration::from_millis(900);

/// What symphonia can actually decode, and nothing aspirational.
///
/// Opus is deliberately absent: symphonia does not decode it, and listing an
/// extension the player will then refuse is worse than not listing it, because
/// the file appears in the folder and then does nothing.
const AUDIO: &[&str] = &["flac", "mp3", "ogg", "wav", "m4a", "aac"];

#[derive(Clone, Serialize)]
pub struct Snapshot {
    /// How many playable files the folder held.
    pub count: usize,
    /// Which one is current, or null when the folder is empty.
    pub index: Option<usize>,
    /// The current file's name, without its path or extension.
    pub name: Option<String>,
    pub playing: bool,
}

/// What the audio thread is told to do. Deliberately small: this is the whole
/// surface between the rest of the app and the only thread that can make noise.
enum Cmd {
    Play,
    Pause,
    /// Move by a step through the queue — +1 for next, -1 for previous — and
    /// start playing there. Wraps, because a folder on loop has no ends.
    Step(i32),
    /// Start at an index, playing or not.
    At(usize, bool),
    Volume(f32),
    /// Hold the music down for this long, with fades either side of it.
    Duck(Duration),
    Stop,
}

/// A duck in progress.
///
/// Held as two instants rather than a phase, so that a second phrase arriving
/// while the first is still ringing extends the hold instead of restarting the
/// fade — which would be heard as the music jumping up and ducking again.
struct Duck {
    started: std::time::Instant,
    hold_until: std::time::Instant,
}

impl Duck {
    /// How loud the music should be right now, as a fraction of its own level.
    ///
    /// Returns `None` once the whole gesture is over, which is what tells the
    /// caller to stop asking and go back to the slow poll.
    fn gain(&self, now: std::time::Instant) -> Option<f32> {
        let since = now.duration_since(self.started);

        if since < DUCK_FADE_IN {
            let t = since.as_secs_f32() / DUCK_FADE_IN.as_secs_f32();
            return Some(1.0 - (1.0 - DUCK_FLOOR) * t);
        }

        if now < self.hold_until {
            return Some(DUCK_FLOOR);
        }

        let released = now.duration_since(self.hold_until);
        if released < DUCK_FADE_OUT {
            let t = released.as_secs_f32() / DUCK_FADE_OUT.as_secs_f32();
            return Some(DUCK_FLOOR + (1.0 - DUCK_FLOOR) * t);
        }

        None
    }
}

struct Queue {
    tracks: Vec<PathBuf>,
    index: usize,
    playing: bool,
}

impl Queue {
    fn snapshot(&self) -> Snapshot {
        Snapshot {
            count: self.tracks.len(),
            index: (!self.tracks.is_empty()).then_some(self.index),
            name: self.tracks.get(self.index).map(|p| display_name(p)),
            playing: self.playing,
        }
    }
}

/// The handle the rest of the app holds.
///
/// The sender is behind a mutex because Tauri's managed state has to be `Sync`
/// and `mpsc::Sender` is only `Send` — one owner may move it between threads,
/// but two may not hold it at once. The lock is never contended in practice:
/// what it guards is a channel write that returns immediately.
pub struct Music {
    tx: Mutex<Sender<Cmd>>,
    queue: Arc<Mutex<Queue>>,
}

/// A file's name as a person would say it: no directory, no extension.
///
/// Good enough until tags arrive. A track called `03 - Ashes.flac` reads as
/// `03 - Ashes`, which is what the folder already told you it was.
fn display_name(path: &Path) -> String {
    path.file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

/// Everything playable directly inside one folder, in the order a file manager
/// would show it.
///
/// Flat on purpose. Descending into subfolders turns "the album I picked" into
/// a library, and a library needs more than three buttons to navigate. Sorted
/// by file name because that is how albums are numbered, so track order comes
/// out of the sort for free rather than out of a tag nobody may have written.
///
/// Anything unreadable is skipped rather than reported. A folder with a
/// permission problem on one file should still play the other forty.
fn scan(folder: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(folder) else {
        return Vec::new();
    };

    let mut tracks: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.is_file())
        .filter(|path| {
            path.extension()
                .and_then(|e| e.to_str())
                .map(|e| AUDIO.contains(&e.to_ascii_lowercase().as_str()))
                .unwrap_or(false)
        })
        .collect();

    tracks.sort_by_key(|path| display_name(path).to_lowercase());
    tracks
}

impl Music {
    /// Starts the audio thread. Called once, at setup.
    pub fn start(app: AppHandle) -> Self {
        let (tx, rx) = mpsc::channel();
        let queue = Arc::new(Mutex::new(Queue {
            tracks: Vec::new(),
            index: 0,
            playing: false,
        }));

        let worker = Arc::clone(&queue);
        std::thread::spawn(move || run(app, rx, worker));

        Self {
            tx: Mutex::new(tx),
            queue,
        }
    }

    fn send(&self, cmd: Cmd) {
        // A dead audio thread must not take the widget with it. Gloam is a
        // timer that can play music, not a music player that keeps time.
        if let Ok(tx) = self.tx.lock() {
            let _ = tx.send(cmd);
        }
    }

    pub fn open(&self, folder: &Path) -> Snapshot {
        let tracks = scan(folder);

        {
            let mut queue = self.queue.lock().unwrap();
            queue.tracks = tracks;
            queue.index = 0;
            queue.playing = false;
        }

        self.send(Cmd::Stop);
        self.snapshot()
    }

    pub fn snapshot(&self) -> Snapshot {
        self.queue.lock().unwrap().snapshot()
    }
}

/// The output device, and everything bound to it.
///
/// Grouped because they can only be replaced together: the sink plays into the
/// stream's mixer, so a stream that goes away takes its sink with it.
struct Audio {
    /// Never read. Held because dropping it ends playback.
    _stream: rodio::OutputStream,
    sink: rodio::Sink,
    /// Which speakers this was opened against, to notice when they change.
    device: Option<String>,
}

impl Audio {
    fn open() -> Option<Self> {
        // --- the whole of the rodio surface, on purpose -------------------
        //
        // If the crate's API has moved, it has moved here and nowhere else.
        let stream = rodio::OutputStreamBuilder::open_default_stream().ok()?;
        let sink = rodio::Sink::connect_new(stream.mixer());
        // ------------------------------------------------------------------
        Some(Self {
            _stream: stream,
            sink,
            device: default_output_name(),
        })
    }
}

/// The name of the device the system would give a new stream right now.
///
/// A name rather than the device itself, because a name is the only thing here
/// that survives being compared: two handles to the same speakers are separate
/// values with no equality between them.
fn default_output_name() -> Option<String> {
    use rodio::cpal::traits::{DeviceTrait, HostTrait};

    rodio::cpal::default_host()
        .default_output_device()
        .and_then(|device| device.name().ok())
}

/// Moves playback onto whatever the system now calls the default output.
///
/// An open stream is bound to the device it was opened against and stays there
/// for as long as it lives. Every other sound on the machine follows the
/// default when it changes — including Gloam's own, which the WebView routes —
/// so plugging in headphones used to leave the music alone in the speakers,
/// which looks less like a limitation than like the app being broken.
///
/// This is the cost of having taken audio out of the WebView. Decoding in Rust
/// is what made FLAC play on a machine with no gstreamer plugin for it, and the
/// same move handed us the housekeeping the browser had been doing quietly.
///
/// The position is carried over rather than the track restarted, which is the
/// difference between a seam and an interruption.
fn follow_device(audio: &mut Audio, queue: &Arc<Mutex<Queue>>, volume: f32) {
    let position = audio.sink.get_pos();
    let carrying = !audio.sink.empty();
    let playing = carrying && !audio.sink.is_paused();

    // If the new default will not open, the old stream keeps the music going
    // on the old speakers. That is the wrong device but it is not silence, and
    // silence is the worse of the two.
    let Some(mut next) = Audio::open() else {
        eprintln!("gloam: the new default output would not open; staying put");
        return;
    };

    next.sink.set_volume(volume);

    if carrying {
        // Paused before anything is appended, because a fresh sink plays what
        // it is given the moment it has it.
        next.sink.pause();

        let index = queue.lock().unwrap().index;
        load(&next.sink, queue, index);

        // Seeking is the decoder's to support and some formats do not. Falling
        // back to the top of the track is worse than a seam and much better
        // than a player that stopped.
        if next.sink.try_seek(position).is_err() {
            eprintln!("gloam: could not resume at {position:?}; from the top instead");
        }

        if playing {
            next.sink.play();
        }
    }

    // Replacing it here is what closes the old stream, and so what stops the
    // sound still coming out of the device nobody is listening to.
    *audio = next;
}

/// The audio thread.
///
/// Owns the output stream and the sink, and is the only place in the app that
/// touches either.
///
/// Two levels are kept apart here. `volume` is what the person set and is the
/// only one they ever change; what reaches the sink is that multiplied by
/// whatever a duck is currently asking for. Storing only the product would
/// mean a phrase arriving mid-drag either loses the new setting or restores an
/// old one when it lets go.
fn run(app: AppHandle, rx: Receiver<Cmd>, queue: Arc<Mutex<Queue>>) {
    let Some(mut audio) = Audio::open() else {
        eprintln!("gloam: no audio output device; music is unavailable");
        return;
    };

    let mut volume: f32 = 1.0;
    let mut duck: Option<Duck> = None;
    let mut device_checked = std::time::Instant::now();

    loop {
        // Quicker while a fade is running, and only then.
        let wait = if duck.is_some() { DUCK_POLL } else { POLL };

        match rx.recv_timeout(wait) {
            Ok(Cmd::Play) => {
                if audio.sink.empty() {
                    let index = queue.lock().unwrap().index;
                    load(&audio.sink, &queue, index);
                }
                // Still empty means there was nothing to load — an empty
                // folder, or a file that would not decode. Saying "playing"
                // then would be a transport control lying about silence.
                if !audio.sink.empty() {
                    audio.sink.play();
                    set_playing(&app, &queue, true);
                }
            }
            Ok(Cmd::Pause) => {
                audio.sink.pause();
                set_playing(&app, &queue, false);
            }
            Ok(Cmd::Step(by)) => {
                let next = step(&queue, by);
                audio.sink.stop();
                load(&audio.sink, &queue, next);
                audio.sink.play();
                set_playing(&app, &queue, true);
                announce(&app, &queue);
            }
            Ok(Cmd::At(index, play)) => {
                audio.sink.stop();
                load(&audio.sink, &queue, index);
                if play {
                    audio.sink.play();
                }
                set_playing(&app, &queue, play);
                announce(&app, &queue);
            }
            Ok(Cmd::Volume(v)) => volume = v.clamp(0.0, 1.0),
            Ok(Cmd::Duck(hold)) => {
                let now = std::time::Instant::now();
                duck = Some(match duck {
                    // Already down: extend the hold rather than start again.
                    // Restarting would run the fade from full a second time,
                    // and a phrase would be preceded by the music bouncing up.
                    Some(active) => Duck {
                        started: active.started,
                        hold_until: active.hold_until.max(now + hold),
                    },
                    None => Duck {
                        started: now,
                        hold_until: now + DUCK_FADE_IN + hold,
                    },
                });
            }
            Ok(Cmd::Stop) => {
                audio.sink.stop();
                set_playing(&app, &queue, false);
                announce(&app, &queue);
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                // Nothing said, so the only questions left are the ones the
                // world answers rather than the user: whether the track ran
                // out, and whether the speakers moved.
                let playing = queue.lock().unwrap().playing;
                if playing && audio.sink.empty() {
                    let next = step(&queue, 1);
                    load(&audio.sink, &queue, next);
                    audio.sink.play();
                    announce(&app, &queue);
                }

                if device_checked.elapsed() >= DEVICE_EVERY {
                    device_checked = std::time::Instant::now();
                    // Both sides have to be known before a difference means
                    // anything: a name that could not be read this time is not
                    // evidence that the speakers changed.
                    if let (Some(now), Some(then)) = (default_output_name(), &audio.device) {
                        if &now != then {
                            follow_device(&mut audio, &queue, volume);
                        }
                    }
                }
            }
            // The app is going away and took the sender with it.
            Err(mpsc::RecvTimeoutError::Disconnected) => return,
        }

        // After every wake, whatever woke it. A command that changes the
        // volume mid-duck has to land through the same multiplication as a
        // fade step, or the two take turns overwriting each other.
        let gain = match &duck {
            Some(active) => match active.gain(std::time::Instant::now()) {
                Some(gain) => gain,
                None => {
                    duck = None;
                    1.0
                }
            },
            None => 1.0,
        };
        audio.sink.set_volume(volume * gain);
    }
}

/// Moves the cursor and returns where it landed. Wraps in both directions.
fn step(queue: &Arc<Mutex<Queue>>, by: i32) -> usize {
    let mut queue = queue.lock().unwrap();
    let len = queue.tracks.len();
    if len == 0 {
        return 0;
    }

    let len = len as i32;
    queue.index = (((queue.index as i32 + by) % len + len) % len) as usize;
    queue.index
}

/// Puts one track into the sink, stopped.
///
/// A file that will not open or will not decode is skipped silently rather
/// than thrown: half a folder of FLAC and one corrupt MP3 should be a folder
/// that plays, not a player that stops.
fn load(sink: &rodio::Sink, queue: &Arc<Mutex<Queue>>, index: usize) {
    let path = {
        let mut queue = queue.lock().unwrap();
        if queue.tracks.is_empty() {
            return;
        }
        queue.index = index.min(queue.tracks.len() - 1);
        queue.tracks[queue.index].clone()
    };

    match std::fs::File::open(&path)
        .map_err(|e| e.to_string())
        .and_then(|file| {
            rodio::Decoder::new(std::io::BufReader::new(file)).map_err(|e| e.to_string())
        }) {
        Ok(source) => sink.append(source),
        Err(error) => eprintln!("gloam: could not play {}: {error}", path.display()),
    }
}

fn set_playing(app: &AppHandle, queue: &Arc<Mutex<Queue>>, playing: bool) {
    queue.lock().unwrap().playing = playing;
    announce(app, queue);
}

fn announce(app: &AppHandle, queue: &Arc<Mutex<Queue>>) {
    let snapshot = queue.lock().unwrap().snapshot();
    let _ = app.emit(TRACK_EVENT, snapshot);
}

// --- what the frontend may ask for ---------------------------------------

#[tauri::command]
pub fn music_open(app: AppHandle, folder: String) -> Snapshot {
    app.state::<Music>().open(Path::new(&folder))
}

#[tauri::command]
pub fn music_play(app: AppHandle) {
    app.state::<Music>().send(Cmd::Play);
}

#[tauri::command]
pub fn music_pause(app: AppHandle) {
    app.state::<Music>().send(Cmd::Pause);
}

#[tauri::command]
pub fn music_next(app: AppHandle) {
    app.state::<Music>().send(Cmd::Step(1));
}

#[tauri::command]
pub fn music_prev(app: AppHandle) {
    app.state::<Music>().send(Cmd::Step(-1));
}

#[tauri::command]
pub fn music_at(app: AppHandle, index: usize, play: bool) {
    app.state::<Music>().send(Cmd::At(index, play));
}

#[tauri::command]
pub fn music_volume(app: AppHandle, volume: f32) {
    app.state::<Music>().send(Cmd::Volume(volume));
}

/// Seconds rather than milliseconds, because the caller measures this in notes
/// and a note is most of a second.
#[tauri::command]
pub fn music_duck(app: AppHandle, seconds: f32) {
    if !seconds.is_finite() || seconds <= 0.0 {
        return;
    }
    app.state::<Music>()
        .send(Cmd::Duck(Duration::from_secs_f32(seconds.min(30.0))));
}

#[tauri::command]
pub fn music_status(app: AppHandle) -> Snapshot {
    app.state::<Music>().snapshot()
}
