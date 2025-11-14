import React, { useState, useEffect, useRef } from 'react';
import { useGameWindow } from './useGameWindow'; // Impor hook responsif

// ==========================================================
// ## 📝 KONFIGURASI & KONSTANTA
// ==========================================================

const TEXTS = {
  title: ["Wave Rider Nusantara", "Penunggang Gelombang Nusantara"],
  score: ["Score: ", "Skor: "],
  lives: ["Lives: ", "Nyawa: "],
  gameOver: ["Game Over! Press R to Restart", "Permainan Berakhir! Tekan R untuk Mulai Ulang"],
  pause: ["Paused - Press P to Resume", "Jeda - Tekan P untuk Lanjut"],
  lang_select: ["Please select a language", "Silakan pilih bahasa"],
  instructions_menu: ["Help Gatotkaca catch Batik Patterns, Avoid BOMBS!", "Bantu Gatotkaca menangkap Pola Batik, Hindari BOM!"],
  start_instructions: ["Press SPACE to Start. Use ARROW KEYS to move. Press the P key to Pause", "Tekan SPASI untuk Mulai. Gunakan TOMBOL PANAH untuk bergerak. Tekan Tombol P untuk Jeda"]
};

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const BASE_GAME_SPEED = 200;
const PLAYER_BASE_SPEED = 300;
const PLAYER_TARGET_SIZE = 70;
const STATE_DURATION = 0.3;
const MIN_SPAWN_DISTANCE = 100;

// ==========================================================
// ## ⚛️ KOMPONEN UTAMA
// ==========================================================

const WaveRiderGame = () => {
  const windowSize = useGameWindow(); // Gunakan hook responsif

  // --- State UI ---
  const [gameState, setGameState] = useState('MENU');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [language, setLanguage] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // --- Refs Game Logic ---
  const canvasRef = useRef(null);
  const requestRef = useRef(0);
  const lastTimeRef = useRef(0);

  const playerRef = useRef({
    x: 100, y: 300,
    width: PLAYER_TARGET_SIZE, height: PLAYER_TARGET_SIZE,
    isChangingState: false, stateTimer: 0.0, spriteKey: 'idle1', animationTimer: 0.0
  });

  const obstaclesRef = useRef([]);
  const collectiblesRef = useRef([]);
  const keysPressed = useRef({});
  const speedMultiplier = useRef(1.0);

  // --- Refs untuk menyimpan Objek Gambar ---
  const imagesRef = useRef({
    bg: null, bomb: null, collect: [], 'gatot-1': null, 'gatot-2': null, 'gatot-hit': null, 'gatot-collect': null
  });

  // ==========================================================
  // ## 🏞️ LOADING ASSETS (ASPEK RASIO & INIT)
  // ==========================================================

  useEffect(() => {
    const imageSources = {
      'gatot-1': '/assets/images/gatot-1.png', 'gatot-2': '/assets/images/gatot-2.png',
      'gatot-hit': '/assets/images/gatot-hit.png', 'gatot-collect': '/assets/images/gatot-collect.png',
      bomb: '/assets/images/bomb.png', bg: '/assets/images/bg.png',
    };
    for (let i = 1; i <= 4; i++) {
      imageSources[`collect-${i}`] = `/assets/images/collect-${i}.png`;
    }

    let loadedCount = 0;
    const totalImages = Object.keys(imageSources).length;

    Object.keys(imageSources).forEach(key => {
      const img = new Image();
      img.src = imageSources[key];
      img.onload = () => {
        if (key.startsWith('collect-')) {
          const index = parseInt(key.split('-')[1]) - 1;
          imagesRef.current.collect[index] = img;
        } else {
          imagesRef.current[key] = img;
        }
        loadedCount++;

        if (loadedCount === totalImages) {
          // Hitung Aspect Ratio Player
          const gatotImage = imagesRef.current['gatot-1'];
          if (gatotImage) {
            const originalWidth = gatotImage.width;
            const originalHeight = gatotImage.height;

            const scale_x = PLAYER_TARGET_SIZE / originalWidth;
            const scale_y = PLAYER_TARGET_SIZE / originalHeight;
            const scale = Math.min(scale_x, scale_y);

            playerRef.current.width = originalWidth * scale;
            playerRef.current.height = originalHeight * scale;
          }
          setImagesLoaded(true);
        }
      };
      img.onerror = () => {
        console.error(`Gagal memuat: ${imageSources[key]}`);
        loadedCount++;
        if (loadedCount === totalImages) setImagesLoaded(true);
      };
    });

    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  // ==========================================================
  // ## ⌨️ INPUT & STATE LOGIC
  // ==========================================================

  useEffect(() => {
    const handleKeyDown = (e) => {
      // FIX BUG SPASI: Mencegah scroll browser
      if (e.code === 'Space' && gameState === 'MENU') {
        e.preventDefault();
      }

      keysPressed.current[e.code] = true;

      if (e.code === 'Space' && gameState === 'MENU' && imagesLoaded) startGame();
      if (e.code === 'KeyP') {
        if (gameState === 'PLAYING') setGameState('PAUSED');
        else if (gameState === 'PAUSED') {
          lastTimeRef.current = performance.now();
          setGameState('PLAYING');
        }
      }
      if (e.code === 'KeyR' && gameState === 'GAMEOVER') resetGame();
    };

    const handleKeyUp = (e) => keysPressed.current[e.code] = false;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, imagesLoaded]);

  const startGame = () => {
    setGameState('PLAYING');
    lastTimeRef.current = performance.now();
  };

  const resetGame = () => {
    const { width, height } = playerRef.current;
    playerRef.current = {
      x: 100, y: 300, width, height,
      isChangingState: false, stateTimer: 0.0, spriteKey: 'idle1', animationTimer: 0.0
    };
    obstaclesRef.current = [];
    collectiblesRef.current = [];
    speedMultiplier.current = 1.0;
    setScore(0);
    setLives(3);
    setGameState('MENU');
  };

  // --- Collision Helper (Pure AABB) ---
  const checkCollision = (rect1, rect2) => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  };

  const changePlayerState = (p, type) => {
    if (p.isChangingState) return;
    p.isChangingState = true;
    p.stateTimer = STATE_DURATION;
    p.spriteKey = type === 'hit' ? 'hit' : 'collect';
  }

  // Helper functions untuk Spawn Logic (Anti Tumpuk)
  const getItemBBox = (item) => { const padding = 10; return { x: item.x - padding, y: item.y - padding, width: item.width + 2 * padding, height: item.height + 2 * padding, }; };
  const isOverlapping = (newBox, existingItems) => { return existingItems.some(existingItem => { const centerNewX = newBox.x + newBox.width / 2; const centerExistingX = existingItem.x + existingItem.width / 2; const distance = Math.abs(centerNewX - centerExistingX); if (distance < MIN_SPAWN_DISTANCE) return true; return false; }); };


  // ==========================================================
  // ## 🔄 GAME LOOP CORE (RANDOM SIZE)
  // ==========================================================

  const update = (time) => {
    if (gameState !== 'PLAYING') return;

    const deltaTime = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;
    if (deltaTime > 0.1) return;

    speedMultiplier.current += 0.04 * deltaTime;
    const currentSpeed = BASE_GAME_SPEED * speedMultiplier.current;
    const p = playerRef.current;
    const moveAmt = PLAYER_BASE_SPEED * speedMultiplier.current * deltaTime;

    // Movement Logic
    if (keysPressed.current['ArrowLeft']) p.x -= moveAmt;
    if (keysPressed.current['ArrowRight']) p.x += moveAmt;
    if (keysPressed.current['ArrowUp']) p.y -= moveAmt;
    if (keysPressed.current['ArrowDown']) p.y += moveAmt;
    p.x = Math.max(0, Math.min(GAME_WIDTH - p.width, p.x));
    p.y = Math.max(0, Math.min(GAME_HEIGHT - p.height, p.y));

    // State Timer / Idle Animation Logic
    if (p.isChangingState) {
      p.stateTimer -= deltaTime;
      if (p.stateTimer <= 0) {
        p.isChangingState = false;
        p.spriteKey = 'idle1';
      }
    } else {
      p.animationTimer += deltaTime;
      if (p.animationTimer >= 0.1) {
        p.spriteKey = p.spriteKey === 'idle1' ? 'idle2' : 'idle1';
        p.animationTimer = 0;
      }
    }

    // Collision Logic
    const playerBox = p;
    obstaclesRef.current.forEach(obs => obs.x -= currentSpeed * deltaTime);
    obstaclesRef.current = obstaclesRef.current.filter(obs => {
      if (obs.x < -100) return false;
      if (checkCollision(playerBox, obs)) {
        if (p.spriteKey !== 'hit') {
          setLives(prev => { const newLives = prev - 1; if (newLives <= 0) setGameState('GAMEOVER'); return newLives; });
          changePlayerState(p, 'hit');
        } return false;
      } return true;
    });
    collectiblesRef.current.forEach(col => col.x -= currentSpeed * deltaTime);
    collectiblesRef.current = collectiblesRef.current.filter(col => {
      if (col.x < -100) return false;
      if (checkCollision(playerBox, col)) {
        setScore(prev => prev + 10);
        changePlayerState(p, 'collect');
        return false;
      } return true;
    });

    // 4. Spawning Logic (RANDOM SIZE)
    const allItems = [...obstaclesRef.current, ...collectiblesRef.current];

    // Obstacle Size: 40 to 85
    if (Math.random() < 0.02) {
      const obsSize = Math.floor(Math.random() * (85 - 40 + 1)) + 40;
      const newObs = { x: GAME_WIDTH + 50, y: Math.random() * (GAME_HEIGHT - 100) + 50, width: obsSize, height: obsSize, type: 'bomb' };
      if (!isOverlapping(getItemBBox(newObs), allItems)) {
        obstaclesRef.current.push(newObs);
      }
    }

    // Collectible Size: 35 to 70
    if (Math.random() < 0.015) {
      const colSize = Math.floor(Math.random() * (70 - 35 + 1)) + 35;
      const newCol = { x: GAME_WIDTH + 50, y: Math.random() * (GAME_HEIGHT - 100) + 50, width: colSize, height: colSize, type: `collect-${Math.floor(Math.random() * imagesRef.current.collect.length)}` };
      if (!isOverlapping(getItemBBox(newCol), allItems)) {
        collectiblesRef.current.push(newCol);
      }
    }
  };

  // ==========================================================
  // ## 🎨 DRAW LOOP CORE
  // ==========================================================

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgs = imagesRef.current;
    const p = playerRef.current;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (imgs.bg) ctx.drawImage(imgs.bg, 0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Hanya gambar entitas dan player jika TIDAK di MENU
    if (gameState !== 'MENU') {
      // 2. Draw Entities
      obstaclesRef.current.forEach(obs => { if (imgs.bomb) ctx.drawImage(imgs.bomb, obs.x, obs.y, obs.width, obs.height); });
      collectiblesRef.current.forEach(col => {
        const index = parseInt(col.type.split('-')[1]);
        const imgToDraw = imgs.collect[index];
        if (imgToDraw) ctx.drawImage(imgToDraw, col.x, col.y, col.width, col.height);
      });

      // 3. Draw Player (Gatotkaca)
      let gatotImage = imgs[p.spriteKey === 'idle1' ? 'gatot-1' : p.spriteKey === 'idle2' ? 'gatot-2' : p.spriteKey === 'hit' ? 'gatot-hit' : 'gatot-collect'];
      if (gatotImage) {
        ctx.drawImage(gatotImage, p.x, p.y, p.width, p.height);
      }
    }
  };

  // Game Loop Initialization
  const loop = (time) => {
    if (gameState === 'PLAYING') update(time);
    draw();
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, imagesLoaded]);

  // --- Button Component for Menu ---
  const Button = ({ onClick, label, active }) => (
    <button
      onClick={onClick}
      style={{
        padding: '8px 15px', fontSize: '14px', margin: '0 5px',
        backgroundColor: active ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)',
        border: '1px solid #333', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold',
        color: 'black'
      }}
    >
      {label}
    </button>
  );

  if (!imagesLoaded) return <div style={{ textAlign: 'center', marginTop: 50 }}>Loading Assets...</div>;

  // ==========================================================
  // ## 💻 RENDER (JSX) (RESPONSIVE)
  // ==========================================================

  return (
    <div
      // Kontainer luar (Full Layar)
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: '#111', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        fontFamily: 'sans-serif'
      }}
    >
      <div
        // Kontainer Game (Area 800x600 yang di-scale)
        style={{
          position: 'relative', width: GAME_WIDTH, height: GAME_HEIGHT,
          boxShadow: '0 0 20px rgba(0,0,0,0.8)',
          border: '2px solid #555',

          // Kunci Responsiveness: Menerapkan skala dari hook useGameWindow
          transform: `scale(${windowSize.scale})`,
          transformOrigin: 'center center',
        }}
      >

        <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} />

        {/* HUD Layer (Score & Lives) */}
        <div style={{
          position: 'absolute', top: 10, left: 10, color: 'black', fontSize: '24px', fontWeight: 'bold',
          backgroundColor: 'rgba(255,255,255,0.7)', padding: '5px', borderRadius: '5px'
        }}>
          <div>{TEXTS.score[language]} {score}</div>
          <div>{TEXTS.lives[language]} {lives}</div>
        </div>

        {/* Menu Overlay */}
        {gameState === 'MENU' && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'flex-start', alignItems: 'center', textAlign: 'center'
          }}>
            {/* Judul Utama */}
            <h1 style={{
              fontSize: '36px', color: 'black', marginTop: '10px',
              backgroundColor: 'rgba(255,255,255,0.7)', padding: '5px 15px', borderRadius: '8px',
              border: '1px solid #333'
            }}>
              {TEXTS.title[language]}
            </h1>

            {/* Seleksi Bahasa */}
            <div style={{
              marginTop: '10px'

            }}>
              <p style={{
                backgroundColor: 'rgba(255,255,255,0.85)', padding: '10px 20px', borderRadius: '8px',
                border: '1px solid #333', color: 'black'
              }}>{TEXTS.lang_select[language]}</p>
              <Button onClick={() => setLanguage(0)} label="English" active={language === 0} />
              <Button onClick={() => setLanguage(1)} label="Indonesia" active={language === 1} />
            </div>

            {/* Instruksi Besar */}
            <div style={{
              position: 'absolute', bottom: 60, width: '90%',
              backgroundColor: 'rgba(255,255,255,0.7)', padding: '10px', borderRadius: '8px',
              color: 'black', fontSize: '16px', border: '1px solid #333'
            }}>
              {language === 0 ? TEXTS.instructions_menu[0] : TEXTS.instructions_menu[1]}
            </div>

            {/* Press Space to Start */}
            <div style={{
              position: 'absolute', bottom: 15, width: '90%',
              backgroundColor: 'rgba(255,255,255,0.85)', padding: '5px', borderRadius: '5px',
              color: 'black', fontSize: '16px', border: '1px solid #333'
            }}>
              {TEXTS.start_instructions[language]}
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === 'GAMEOVER' && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(255,255,255,0.8)', color: 'black', display: 'flex',
            flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
          }}>
            <h2 style={{ fontSize: '50px', color: 'black', textShadow: 'none' }}>GAME OVER</h2>
            <p style={{ fontSize: '30px', margin: '20px 0' }}>{TEXTS.score[language]} {score}</p>
            <p style={{ color: 'black' }}>{TEXTS.gameOver[language]}</p>
          </div>
        )}

        {/* Pause Overlay */}
        {gameState === 'PAUSED' && (
          <div style={{
            position: 'absolute', top: '45%', left: 0, width: '100%', textAlign: 'center',
            color: 'black', fontSize: '30px', fontWeight: 'bold',
            backgroundColor: 'rgba(255,255,255,0.7)',
            padding: '10px 0',
            textShadow: 'none'
          }}>
            {TEXTS.pause[language]}
          </div>
        )}
      </div>
    </div>
  );
};

export default WaveRiderGame;