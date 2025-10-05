use enigo::{Enigo, Key, Keyboard, Settings, Direction};
use rdev::{listen, Event, EventType, Key as RKey};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;

#[derive(Clone)]
pub struct SnippetMap {
    snippets: Arc<Mutex<HashMap<String, String>>>,
}

impl SnippetMap {
    pub fn new() -> Self {
        Self {
            snippets: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn update(&self, snippets: Vec<(String, String)>) {
        let mut map = self.snippets.lock().unwrap();
        map.clear();
        for (keyword, text) in snippets {
            map.insert(keyword, text);
        }
        tracing::info!("Updated snippet map with {} snippets", map.len());
    }

    pub fn get(&self, keyword: &str) -> Option<String> {
        self.snippets.lock().unwrap().get(keyword).cloned()
    }
}

#[derive(Clone)]
pub struct AutoExpander {
    buffer: Arc<Mutex<String>>,
    snippet_map: SnippetMap,
    enabled: Arc<Mutex<bool>>,
}

impl AutoExpander {
    pub fn new(snippet_map: SnippetMap) -> Self {
        Self {
            buffer: Arc::new(Mutex::new(String::new())),
            snippet_map,
            enabled: Arc::new(Mutex::new(false)),
        }
    }

    pub fn set_enabled(&self, enabled: bool) {
        *self.enabled.lock().unwrap() = enabled;
        tracing::info!("Auto-expansion {}", if enabled { "enabled" } else { "disabled" });
    }

    pub fn is_enabled(&self) -> bool {
        *self.enabled.lock().unwrap()
    }

    pub fn start(self) {
        let buffer = Arc::clone(&self.buffer);
        let snippet_map = self.snippet_map.clone();
        let enabled = Arc::clone(&self.enabled);

        thread::spawn(move || {
            tracing::info!("Starting keyboard listener thread");

            let callback = move |event: Event| {
                if !*enabled.lock().unwrap() {
                    return;
                }

                match event.event_type {
                    EventType::KeyPress(key) => {
                        let mut buf = buffer.lock().unwrap();

                        match key {
                            RKey::Space | RKey::Return | RKey::Tab => {
                                // Check if buffer matches any keyword
                                let keyword = buf.trim().to_string();
                                tracing::debug!("Checking keyword: '{}'", keyword);

                                if let Some(expansion) = snippet_map.get(&keyword) {
                                    tracing::info!("Expanding keyword '{}' to: '{}'", keyword, expansion);

                                    // Create enigo with default settings
                                    let settings = Settings::default();
                                    let mut enigo = match Enigo::new(&settings) {
                                        Ok(enigo) => enigo,
                                        Err(e) => {
                                            tracing::error!("Failed to create Enigo: {:?}", e);
                                            return;
                                        }
                                    };

                                    // Erase the keyword (backspace n times)
                                    for _ in 0..keyword.len() {
                                        enigo.key(Key::Backspace, Direction::Click).ok();
                                    }

                                    // Type the expansion
                                    enigo.text(&expansion).ok();

                                    tracing::info!("Expansion complete");
                                }

                                buf.clear();
                            }
                            RKey::Backspace => {
                                buf.pop();
                            }
                            _ => {
                                // Try to convert key to char
                                if let Some(ch) = key_to_char(key) {
                                    buf.push(ch);

                                    // Limit buffer size to prevent memory issues
                                    if buf.len() > 100 {
                                        buf.remove(0);
                                    }
                                }
                            }
                        }
                    }
                    _ => {}
                }
            };

            if let Err(e) = listen(callback) {
                tracing::error!("Failed to listen to keyboard events: {:?}", e);
                tracing::error!("On macOS, you need to grant Accessibility permissions in System Settings > Privacy & Security > Accessibility");
            }
        });
    }
}

fn key_to_char(key: RKey) -> Option<char> {
    match key {
        RKey::KeyA => Some('a'),
        RKey::KeyB => Some('b'),
        RKey::KeyC => Some('c'),
        RKey::KeyD => Some('d'),
        RKey::KeyE => Some('e'),
        RKey::KeyF => Some('f'),
        RKey::KeyG => Some('g'),
        RKey::KeyH => Some('h'),
        RKey::KeyI => Some('i'),
        RKey::KeyJ => Some('j'),
        RKey::KeyK => Some('k'),
        RKey::KeyL => Some('l'),
        RKey::KeyM => Some('m'),
        RKey::KeyN => Some('n'),
        RKey::KeyO => Some('o'),
        RKey::KeyP => Some('p'),
        RKey::KeyQ => Some('q'),
        RKey::KeyR => Some('r'),
        RKey::KeyS => Some('s'),
        RKey::KeyT => Some('t'),
        RKey::KeyU => Some('u'),
        RKey::KeyV => Some('v'),
        RKey::KeyW => Some('w'),
        RKey::KeyX => Some('x'),
        RKey::KeyY => Some('y'),
        RKey::KeyZ => Some('z'),
        RKey::Num0 => Some('0'),
        RKey::Num1 => Some('1'),
        RKey::Num2 => Some('2'),
        RKey::Num3 => Some('3'),
        RKey::Num4 => Some('4'),
        RKey::Num5 => Some('5'),
        RKey::Num6 => Some('6'),
        RKey::Num7 => Some('7'),
        RKey::Num8 => Some('8'),
        RKey::Num9 => Some('9'),
        RKey::Minus => Some('-'),
        RKey::Equal => Some('='),
        _ => None,
    }
}
