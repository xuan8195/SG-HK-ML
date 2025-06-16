// Global variables
let isPlaying = false;
let currentMood = 'happy';
let currentTrackIndex = 0;
let progressInterval;
let currentAudio = null;

// ML Model variables
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/89kVl1mPB/"; // Make sure this is your latest model link
let model, webcam, maxPredictions;
let isWebcamRunning = false;
let lastDetectedMood = ''; // Changed back from lastPromptedMood

// Music data (keep existing playlists object)
const playlists = {
    happy: {
        name: "Happy Vibes",
        tracks: [
            { title: "Everen Maxwell - Hinterlands", artist: "NCS Release", duration: "3:24", file: "songs/Everen Maxwell - Hinterlands [NCS Release].mp3" },
            { title: "NIVIRO - The Riot", artist: "NCS Release", duration: "2:45", file: "songs/NIVIRO - The Riot [NCS Release].mp3" },
            { title: "Sayfro, BAYZY - On and On", artist: "NCS Release", duration: "4:12", file: "songs/Sayfro, BAYZY - On and On [NCS Release].mp3" },
            { title: "Happy Barks Symphony", artist: "Pet Orchestra", duration: "3:56", file: null }
        ]
    },
    sad: {
        name: "Comfort Zone",
        tracks: [
            { title: "Everen Maxwell - Hinterlands", artist: "Calm Version", duration: "3:24", file: "songs/Everen Maxwell - Hinterlands [NCS Release].mp3" },
            { title: "Peaceful Nap Time", artist: "Relaxation", duration: "5:15", file: null },
            { title: "Soft Whiskers Dream", artist: "Soothing Sounds", duration: "3:48", file: null },
            { title: "Cuddle Time Melody", artist: "Comfort Music", duration: "4:02", file: null }
        ]
    },
    angry: {
        name: "Energy Release",
        tracks: [
            { title: "NIVIRO - The Riot", artist: "Intense Mix", duration: "2:58", file: "songs/NIVIRO - The Riot [NCS Release].mp3" },
            { title: "Thunder Paw Strike", artist: "Epic Sounds", duration: "2:58", file: null },
            { title: "Wild Energy Burst", artist: "Power Music", duration: "3:33", file: null },
            { title: "Fierce Spirit Song", artist: "Strong Beats", duration: "4:07", file: null }
        ]
    }
};

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupNavigation();
    loadMLModel();
    updatePlaylistDisplay();
    setupGameAnimations();
    
    // Set initial mood description
    const moodStatusDescription = document.getElementById('mood-status-description');
    if (moodStatusDescription) {
        moodStatusDescription.textContent = "Start webcam to detect pet's mood...";
    }
});

// Load ML Model
async function loadMLModel() {
    try {
        const modelURL = MODEL_URL + "model.json";
        const metadataURL = MODEL_URL + "metadata.json";
        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();
        console.log("ML Model loaded successfully");
    } catch (error) {
        console.error("Failed to load ML model:", error);
    }
}

// Webcam Functions
async function startWebcam() {
    try {
        const flip = true;
        webcam = new tmImage.Webcam(400, 400, flip);
        await webcam.setup();
        await webcam.play();
        
        // Update UI
        document.getElementById('start-webcam-btn').style.display = 'none';
        document.getElementById('stop-webcam-btn').style.display = 'flex';
        
        // Clear placeholder and add webcam
        const webcamContainer = document.getElementById('webcam-container');
        webcamContainer.innerHTML = '';
        webcamContainer.appendChild(webcam.canvas);
        
        // Add live status indicator
        const statusDiv = document.createElement('div');
        statusDiv.innerHTML = '<p style="margin-top: 10px; color: #48bb78;"><i class="fas fa-circle" style="animation: pulse 1s infinite;"></i> Live Detection Active</p>';
        webcamContainer.appendChild(statusDiv);
        
        isWebcamRunning = true;
        loop();
    } catch (error) {
        console.error("Webcam setup failed:", error);
        alert("Unable to access webcam. Please check permissions.");
    }
}

function stopWebcam() {
    if (webcam) {
        webcam.stop();
        isWebcamRunning = false;
    }
    
    // Update UI
    document.getElementById('start-webcam-btn').style.display = 'flex';
    document.getElementById('stop-webcam-btn').style.display = 'none';
    
    // Reset placeholder
    const webcamContainer = document.getElementById('webcam-container');
    webcamContainer.innerHTML = `
        <i class="fas fa-video"></i>
        <p>Click to start webcam and detect your pet's mood</p>
        <small>Live mood detection using your camera</small>
    `;
}

async function loop() {
    if (isWebcamRunning && webcam) {
        webcam.update();
        await predict(); // Predict on every frame if webcam is running
        window.requestAnimationFrame(loop);
    }
}

// Enhanced prediction function
async function predict() {
    if (!model || !webcam) return; 
    
    try {
        const prediction = await model.predict(webcam.canvas);
        
        let highestPrediction = prediction[0];
        for (let i = 1; i < prediction.length; i++) {
            if (prediction[i].probability > highestPrediction.probability) {
                highestPrediction = prediction[i];
            }
        }
        
        const moodMapping = {
            'happy': 'happy', 
            'sad': 'sad', 
            'angry': 'angry',
            // IMPORTANT: Ensure your Teachable Machine class names (lowercased)
            // are correctly mapped here. For example, if your model outputs "Class_Happy",
            // you might need: 'class_happy': 'happy'
        };
        
        const modelClassName = highestPrediction.className.toLowerCase();
        const detectedMood = moodMapping[modelClassName] || 'happy'; // Defaults to 'happy' if mapping fails
        const confidence = Math.round(highestPrediction.probability * 100);
        
        const predictionContainer = document.getElementById('prediction-container');
        if (predictionContainer) {
            predictionContainer.innerHTML = prediction.map(pred => 
                `<div style="display: flex; justify-content: space-between; margin: 2px 0;">
                    <span>${pred.className}:</span>
                    <span>${(pred.probability * 100).toFixed(1)}%</span>
                </div>`
            ).join('');
        }
        
        // Update mood display and auto-play music if confidence is high AND mood is new
        if (confidence > 60 && detectedMood !== lastDetectedMood) {
            lastDetectedMood = detectedMood; // Update last detected mood
            updateMoodResultDisplay(detectedMood, confidence); // Update UI elements (emoji, name, description)
            autoPlayMoodMusic(detectedMood); // This triggers the music for the specific mood
        } else if (confidence <= 60 && lastDetectedMood !== '') {
            // Optional: If confidence drops, you might want to reset lastDetectedMood
            // so that if the mood becomes clear again, it re-triggers.
            // lastDetectedMood = ''; 
        }
        
    } catch (error) {
        console.error("Prediction error:", error);
    }
}

// Updates the main mood display elements (emoji, name, confidence, description)
function updateMoodResultDisplay(mood, confidence) {
    currentMood = mood; // Update global currentMood

    const moodEmojis = { happy: '😺', sad: '😢', angry: '😾' };
    const moodNames = { happy: 'Happy', sad: 'Sad', angry: 'Angry' };
    const moodDescriptions = {
        happy: 'Your pet is feeling joyful and playful!',
        sad: 'Your pet seems to need some comfort and care.',
        angry: 'Your pet appears agitated and needs to release energy.'
    };
    
    document.querySelector('.mood-emoji').textContent = moodEmojis[mood] || '❓';
    document.querySelector('.mood-name').textContent = moodNames[mood] || 'Unknown';
    document.querySelector('.confidence').textContent = `Confidence: ${confidence}%`;
    
    const moodStatusDescription = document.getElementById('mood-status-description');
    if (moodStatusDescription) {
        moodStatusDescription.textContent = moodDescriptions[mood] || "Analyzing mood...";
    }
    
    updateAllMoodBadges(mood);
    updateFeaturedGame(mood);
}

// Auto-play music function (called directly after detection)
function autoPlayMoodMusic(mood) {
    console.log(`Auto-playing music for ${mood} mood (no confirmation)`);

    if (isPlaying) {
        togglePlay(); 
    }
    switchPlaylist(mood); // This selects the correct playlist (happy, sad, etc.)
    setTimeout(() => {
        if (!isPlaying) { 
            togglePlay(); 
        }
    }, 200); 

    showMusicNotification(mood);
}

// Remove the following functions as they are no longer needed:
// - promptForMusicConfirmation
// - handleMusicConfirmation
// - clearMoodConfirmationPrompt

// Navigation functionality
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.section');

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetSection = button.getAttribute('data-section');
            switchToSection(targetSection);
        });
    });
}

function switchToSection(sectionName) {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.section');
    
    navButtons.forEach(btn => btn.classList.remove('active'));
    sections.forEach(section => section.classList.remove('active'));
    
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
    document.getElementById(sectionName).classList.add('active');
}

// Music Player Functions
function togglePlay() {
    const playBtn = document.querySelector('.play-btn i');
    
    if (!isPlaying) {
        playBtn.className = 'fas fa-pause';
        isPlaying = true;
        playCurrentTrack();
        startProgress();
    } else {
        playBtn.className = 'fas fa-play';
        isPlaying = false;
        pauseCurrentTrack();
        stopProgress();
    }
}

function playCurrentTrack() {
    const playlist = playlists[currentMood];
    const track = playlist.tracks[currentTrackIndex];
    
    // Stop current audio if playing
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    // Play new track if it has an audio file
    if (track.file) {
        currentAudio = new Audio(track.file);
        currentAudio.play().catch(e => {
            console.log('Audio playback failed:', e);
            // Fallback to simulated playback
        });
        
        currentAudio.addEventListener('ended', () => {
            nextTrack();
        });
        
        currentAudio.addEventListener('timeupdate', () => {
            if (currentAudio) {
                const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
                document.getElementById('progress').style.width = progress + '%';
                updateRealTimeDisplay(currentAudio.currentTime, currentAudio.duration);
            }
        });
    }
}

function pauseCurrentTrack() {
    if (currentAudio) {
        currentAudio.pause();
    }
}

function updateRealTimeDisplay(currentTime, duration) {
    const currentMinutes = Math.floor(currentTime / 60);
    const currentSeconds = Math.floor(currentTime % 60);
    const totalMinutes = Math.floor(duration / 60);
    const totalSeconds = Math.floor(duration % 60);
    
    document.getElementById('current-time').textContent = 
        `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')}`;
    document.getElementById('total-time').textContent = 
        `${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`;
}

function startProgress() {
    // Only use simulated progress if no real audio is playing
    if (!currentAudio) {
        let width = 35;
        progressInterval = setInterval(() => {
            width += 0.5;
            if (width >= 100) {
                width = 0;
                nextTrack();
            }
            document.getElementById('progress').style.width = width + '%';
            updateTimeDisplay(width);
        }, 100);
    }
}

function stopProgress() {
    clearInterval(progressInterval);
}

function updateTimeDisplay(progress) {
    const totalSeconds = 204; // 3:24 in seconds
    const currentSeconds = Math.floor((progress / 100) * totalSeconds);
    const minutes = Math.floor(currentSeconds / 60);
    const seconds = currentSeconds % 60;
    document.getElementById('current-time').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function previousTrack() {
    currentTrackIndex = Math.max(0, currentTrackIndex - 1);
    updateCurrentTrack();
}

function nextTrack() {
    const playlist = playlists[currentMood];
    currentTrackIndex = (currentTrackIndex + 1) % playlist.tracks.length;
    updateCurrentTrack();
}

function updateCurrentTrack() {
    const playlist = playlists[currentMood];
    const track = playlist.tracks[currentTrackIndex];
    
    document.getElementById('current-song').textContent = track.title;
    document.getElementById('current-artist').textContent = track.artist;
    document.getElementById('total-time').textContent = track.duration;
    
    // Reset progress
    document.getElementById('progress').style.width = '0%';
    document.getElementById('current-time').textContent = '0:00';
}

function switchPlaylist(mood) {
    currentMood = mood; // This 'mood' variable (e.g., "happy", "sad") determines the playlist
    currentTrackIndex = 0;
    updateCurrentTrack(); // Loads track details from playlists[currentMood]
    updatePlaylistDisplay(); // Shows tracks from playlists[currentMood]
    updateAllMoodBadges(mood);
}

function updatePlaylistDisplay() {
    const playlist = playlists[currentMood];
    document.getElementById('playlist-name').textContent = playlist.name;
    
    const tracksContainer = document.getElementById('playlist-tracks');
    tracksContainer.innerHTML = playlist.tracks.map((track, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-radius: 8px; ${index === currentTrackIndex ? 'background: #667eea; color: white;' : 'background: #f7fafc;'} margin-bottom: 8px; cursor: pointer;" onclick="playTrack(${index})">
            <div>
                <div style="font-weight: 600;">${track.title}</div>
                <div style="font-size: 0.9rem; opacity: 0.8;">${track.artist}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <span>${track.duration}</span>
                ${index === currentTrackIndex && isPlaying ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-play" style="opacity: 0.6;"></i>'}
            </div>
        </div>
    `).join('');
}

function playTrack(index) {
    currentTrackIndex = index;
    updateCurrentTrack();
    updatePlaylistDisplay();
    if (!isPlaying) togglePlay();
}

function seekTrack(event) {
    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    document.getElementById('progress').style.width = percent + '%';
    updateTimeDisplay(percent);
}

// Game Functions
function updateFeaturedGame(mood) {
    const gameData = {
        happy: {
            title: "Treat Dash Activity",
            description: "Perfect for your happy pet! Hide treats around the house and encourage your pet to find them. Create obstacle courses with pillows and furniture for an energetic treasure hunt experience.",
            icon: "🏃‍♂️"
        },
        sad: {
            title: "Cuddle Comfort Time",
            description: "Your pet needs some gentle comfort. Try soft brushing, quiet cuddle sessions, or gentle massage. Create a cozy space with their favorite blanket and spend quality bonding time together.",
            icon: "🤗"
        },
        angry: {
            title: "Energy Release Activities",
            description: "Help your pet release pent-up energy! Try vigorous play with toys, tug-of-war games, or active fetch sessions. Physical exercise will help them calm down and feel better.",
            icon: "🔨"
        }
    };
    
    const game = gameData[mood];
    if (document.getElementById('featured-game-title')) {
        document.getElementById('featured-game-title').textContent = game.title;
        document.getElementById('featured-game-desc').textContent = game.description;
        document.querySelector('.game-card.featured .game-icon').textContent = game.icon;
    }
}

function startFeaturedGame() {
    const gameName = document.getElementById('featured-game-title').textContent;
    showGameLaunch(gameName);
}

function startGame(gameId) {
    const gameNames = {
        'whack-toy': 'Whack-a-Bath Toy',
        'cuddle-catcher': 'Cuddle Catcher',
        'treat-dash': 'Treat Dash',
        'ball-bounce': 'Ball Bounce Bonanza',
        'peaceful-garden': 'Peaceful Garden',
        'thunder-strike': 'Thunder Strike'
    };
    
    showGameLaunch(gameNames[gameId]);
}

function showGameLaunch(gameName) {
    const activitySuggestions = {
        'Whack-a-Bath Toy': {
            title: 'Energy Release Activities',
            activities: [
                '🎾 Play vigorous fetch with a ball',
                '🪢 Engage in tug-of-war with rope toys',
                '🏃‍♂️ Take your pet for a brisk walk or run',
                '🎯 Set up agility courses with household items',
                '💪 Try wrestling play (if appropriate for your pet)'
            ]
        },
        'Cuddle Catcher': {
            title: 'Comfort & Bonding Activities',
            activities: [
                '🤗 Extended cuddle and petting sessions',
                '🪥 Gentle brushing and grooming',
                '💆‍♀️ Soft massage and belly rubs',
                '📚 Quiet time together reading or watching TV',
                '🛏️ Create a cozy blanket fort for nap time'
            ]
        },
        'Treat Dash': {
            title: 'Fun & Energetic Activities',
            activities: [
                '🍖 Hide treats around the house for treasure hunting',
                '🏠 Create indoor obstacle courses',
                '🎾 Play interactive ball games',
                '🎪 Teach new tricks with positive reinforcement',
                '🎵 Dance or move to music together'
            ]
        },
        'Ball Bounce Bonanza': {
            title: 'Active Play Suggestions',
            activities: [
                '🎾 Bounce balls for your pet to catch',
                '🏀 Try different sized balls for variety',
                '🎯 Set up targets for ball games',
                '🤹‍♀️ Practice coordination games',
                '🏃‍♂️ Combine with running exercises'
            ]
        },
        'Peaceful Garden': {
            title: 'Calming Activities',
            activities: [
                '🌱 Spend quiet time in the garden or by windows',
                '🧘‍♀️ Practice calm breathing together',
                '🌸 Gentle exploration of outdoor spaces',
                '☀️ Enjoy peaceful sunbathing sessions',
                '🦋 Watch birds or nature together'
            ]
        },
        'Thunder Strike': {
            title: 'High-Energy Release',
            activities: [
                '⚡ Fast-paced play sessions',
                '🏃‍♂️ Sprint exercises in the yard',
                '🥏 Frisbee or disc throwing games',
                '🎪 Intense training sessions',
                '💨 Quick reaction games'
            ]
        }
    };
    
    const suggestions = activitySuggestions[gameName] || {
        title: 'Pet Activity Suggestions',
        activities: ['🎾 Play with favorite toys', '🚶‍♀️ Go for a walk', '🤗 Spend quality time together']
    };
    
    // Create modal overlay
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.8); display: flex; align-items: center; 
        justify-content: center; z-index: 1000; animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 40px; border-radius: 20px; text-align: left; max-width: 600px; margin: 20px; max-height: 80vh; overflow-y: auto;">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 4rem; margin-bottom: 15px;">🎯</div>
                <h3 style="color: #2d3748; margin-bottom: 10px;">${suggestions.title}</h3>
                <p style="color: #718096;">Try these activities with your pet based on their current mood!</p>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h4 style="color: #2d3748; margin-bottom: 15px;">Recommended Activities:</h4>
                <div style="space-y: 10px;">
                    ${suggestions.activities.map(activity => 
                        `<div style="display: flex; align-items: center; padding: 12px; background: #f7fafc; border-radius: 8px; margin-bottom: 8px;">
                            <span style="margin-right: 10px; font-size: 1.2rem;">${activity.split(' ')[0]}</span>
                            <span style="color: #2d3748;">${activity.substring(activity.indexOf(' ') + 1)}</span>
                        </div>`
                    ).join('')}
                </div>
            </div>
            
            <div style="text-align: center; padding: 20px; background: #edf2f7; border-radius: 10px; margin-bottom: 20px;">
                <p style="color: #718096; font-size: 0.9rem; line-height: 1.5;">
                    💡 <strong>Tip:</strong> Always supervise your pet during activities and adjust intensity based on their energy level and physical capabilities.
                </p>
            </div>
            
            <div style="text-align: center;">
                <button onclick="closeGameModal()" style="background: #667eea; color: white; border: none; padding: 15px 40px; border-radius: 25px; cursor: pointer; font-weight: 600; font-size: 1rem;">
                    Got It!
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    window.closeGameModal = () => {
        document.body.removeChild(modal);
        delete window.closeGameModal;
    };
}

// Utility Functions
function showMusicRecommendation() {
    switchToSection('music');
    switchPlaylist(currentMood);
}

function showGameRecommendation() {
    switchToSection('games');
}

function setupGameAnimations() {
    const gameCards = document.querySelectorAll('.game-card');
    gameCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-8px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0) scale(1)';
        });
    });
}

function toggleShuffle() {
    const btn = event.currentTarget;
    btn.style.background = btn.style.background === 'rgba(255, 255, 255, 0.9)' ? 
        'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.9)';
    btn.style.color = btn.style.color === 'rgb(102, 126, 234)' ? 'white' : '#667eea';
}

function toggleRepeat() {
    const btn = event.currentTarget;
    btn.style.background = btn.style.background === 'rgba(255, 255, 255, 0.9)' ? 
        'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.9)';
    btn.style.color = btn.style.color === 'rgb(102, 126, 234)' ? 'white' : '#667eea';
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .section { animation: fadeInUp 0.5s ease-out; }
    
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
    
    .mood-result { animation: pulse 2s infinite; }
`;
document.head.appendChild(style);