// Wait for the page to load and inject Digimon sprites
console.log("Digimon Colab Mode: Extension loaded!");

// All available Digimon with their evolution chains
const ALL_DIGIMON = {
  // Baby -> In-Training -> Rookie -> Champion -> Ultimate -> Mega
  koromon: ['koromon', 'agumon', 'greymon', 'metalgreymon', 'wargreymon'],
  tsunomon: ['tsunomon', 'gabumon', 'garurumon', 'weregarurumon', 'metalgarurumon'],
  yokomon: ['yokomon', 'biyomon', 'birdramon', 'garudamon', 'phoenixmon'],
  motimon: ['motimon', 'tentomon', 'kabuterimon', 'megakabuterimon', 'herculeskabuterimon'],
  nyaromon: ['nyaromon', 'salamon', 'gatomon', 'angewomon', 'ophanimon'],
  tokomon: ['tokomon', 'patamon', 'angemon', 'magnaangemon', 'seraphimon'],
  tanemon: ['tenamon', 'palmon', 'togemon', 'lillymon', 'rosemon'],
  bukamon: ['bukamon', 'gomamon', 'ikkakumon', 'zudomon', 'plesiomon']
};

// Game state - will be loaded from storage
let gameState = {
  ownedDigimon: [], // List of Digimon chains the player owns
  activeDigimon: [], // Currently displayed Digimon (max 3)
  eggs: [], // Eggs waiting to hatch {type: 'digimonKey', hatchProgress: 0}
  totalExecutions: 0,
  executionsSinceLastEgg: 0,
  nextEggAt: null // Will be set randomly between 10-50
};

let spriteElements = [];
let notificationTimeout = null;
const EXECUTIONS_PER_EVOLUTION = 3;
const MAX_HATCH_EXECUTIONS = 20;

// Initialize game state
async function initializeGameState() {
  const stored = await chrome.storage.local.get(['digimonGameState']);
  
  if (stored.digimonGameState) {
    gameState = stored.digimonGameState;
    console.log("Loaded saved game state:", gameState);
  } else {
    // First time - give player 2 random Digimon
    const digimonKeys = Object.keys(ALL_DIGIMON);
    const starter1 = digimonKeys[Math.floor(Math.random() * digimonKeys.length)];
    let starter2 = digimonKeys[Math.floor(Math.random() * digimonKeys.length)];
    
    // Make sure starter2 is different
    while (starter2 === starter1) {
      starter2 = digimonKeys[Math.floor(Math.random() * digimonKeys.length)];
    }
    
    gameState.ownedDigimon = [
      { key: starter1, stage: 0, exp: 0 },
      { key: starter2, stage: 0, exp: 0 }
    ];
    
    gameState.activeDigimon = [0, 1]; // Show both starters
    gameState.nextEggAt = randomBetween(10, 50);
    
    await saveGameState();
    console.log("New game started! Starters:", starter1, starter2);
    showNotification(`Welcome! Your starter Digimon are ${starter1.toUpperCase()} and ${starter2.toUpperCase()}!`, 'info');
  }
}

async function saveGameState() {
  await chrome.storage.local.set({ digimonGameState: gameState });
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function replaceWithDigimon() {
  const headerBg = document.getElementById('header-background');
  
  if (headerBg) {
    headerBg.style.backgroundImage = 'none';
    headerBg.style.overflow = 'hidden'; // Prevent scrolling from sprites going off-screen
    
    // Remove old eggs only
    document.querySelectorAll('[class^="digimon-egg-"]').forEach(el => el.remove());
    
    // Only create new sprites if they don't exist
    gameState.activeDigimon.forEach((digimonIndex, displayIndex) => {
      if (digimonIndex >= gameState.ownedDigimon.length) return;
      
      const digimon = gameState.ownedDigimon[digimonIndex];
      const evolutionChain = ALL_DIGIMON[digimon.key];
      const currentForm = evolutionChain[digimon.stage];
      const digimonUrl = chrome.runtime.getURL(`assets/${currentForm}.gif`);
      
      let sprite = spriteElements[displayIndex];
      
      if (!sprite || !sprite.parentElement) {
        // Create new sprite
        sprite = document.createElement('div');
        sprite.className = `digimon-sprite-${displayIndex}`;
        sprite.style.position = 'absolute';
        sprite.style.width = '70px';
        sprite.style.height = '70px';
        sprite.style.backgroundImage = `url(${digimonUrl})`;
        sprite.style.backgroundSize = 'contain';
        sprite.style.backgroundRepeat = 'no-repeat';
        sprite.style.backgroundPosition = 'center';
        sprite.style.top = '50%';
        sprite.style.transform = 'translateY(-50%)';
        sprite.style.pointerEvents = 'none';
        sprite.style.imageRendering = 'pixelated';
        sprite.style.imageRendering = '-moz-crisp-edges';
        sprite.style.imageRendering = 'crisp-edges';
        sprite.style.transition = 'all 0.5s ease';
        headerBg.appendChild(sprite);
        
        spriteElements[displayIndex] = sprite;
        animateSprite(sprite, displayIndex);
      }
    });
    
    // Remove sprites that are no longer active
    spriteElements.forEach((sprite, index) => {
      if (sprite && !gameState.activeDigimon.includes(index) && sprite.parentElement) {
        sprite.remove();
        spriteElements[index] = null;
      }
    });
    
    // Show eggs
    gameState.eggs.forEach((egg, index) => {
      const eggSprite = document.createElement('div');
      const eggUrl = chrome.runtime.getURL('assets/egg.gif');
      eggSprite.className = `digimon-egg-${index}`;
      eggSprite.style.position = 'absolute';
      eggSprite.style.width = '50px';
      eggSprite.style.height = '50px';
      eggSprite.style.backgroundImage = `url(${eggUrl})`;
      eggSprite.style.backgroundSize = 'contain';
      eggSprite.style.backgroundRepeat = 'no-repeat';
      eggSprite.style.top = '10px';
      eggSprite.style.right = `${60 + (index * 60)}px`;
      eggSprite.style.pointerEvents = 'none';
      eggSprite.style.imageRendering = 'pixelated';
      eggSprite.style.filter = 'drop-shadow(0 0 10px rgba(255,255,255,0.5))';
      headerBg.appendChild(eggSprite);
    });
    
    const kitties = document.querySelectorAll('.kitty-canvas');
    const crabs = document.querySelectorAll('.crab-mode');
    kitties.forEach(k => k.style.display = 'none');
    crabs.forEach(c => c.style.display = 'none');
  }
}

function showNotification(message, type = 'info') {
  const existing = document.getElementById('digimon-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.id = 'digimon-notification';
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${type === 'evolution' ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : 
                  type === 'egg' ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' :
                  'linear-gradient(135deg, #667eea, #764ba2)'};
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    font-family: 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: bold;
    max-width: 300px;
    animation: slideIn 0.3s ease;
    cursor: pointer;
  `;
  notification.innerHTML = message;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
  `;
  if (!document.head.querySelector('style[data-digimon]')) {
    style.setAttribute('data-digimon', 'true');
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  notification.addEventListener('click', () => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  });
  
  clearTimeout(notificationTimeout);
  notificationTimeout = setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

async function digivolve(digimonIndex) {
  const digimon = gameState.ownedDigimon[digimonIndex];
  const evolutionChain = ALL_DIGIMON[digimon.key];
  
  if (digimon.stage < evolutionChain.length - 1) {
    const oldForm = evolutionChain[digimon.stage];
    digimon.stage++;
    digimon.exp = 0;
    const newForm = evolutionChain[digimon.stage];
    
    await saveGameState();
    
    // Find which display index this is
    const displayIndex = gameState.activeDigimon.indexOf(digimonIndex);
    if (displayIndex >= 0 && spriteElements[displayIndex]) {
      const sprite = spriteElements[displayIndex];
      const digimonUrl = chrome.runtime.getURL(`assets/${newForm}.gif`);
      
      sprite.style.filter = 'brightness(2) contrast(2)';
      const currentTransform = sprite.style.transform;
      sprite.style.transform = currentTransform + ' scale(1.5)';
      
      setTimeout(() => {
        sprite.style.backgroundImage = `url(${digimonUrl})`;
        setTimeout(() => {
          sprite.style.filter = 'none';
          sprite.style.transform = currentTransform;
        }, 500);
      }, 300);
    }
    
    console.log(`Digivolution! ${oldForm} -> ${newForm}`);
    showNotification(`${oldForm.toUpperCase()} digivolved to ${newForm.toUpperCase()}!`, 'evolution');
  }
}

async function dedigivolve(digimonIndex) {
  const digimon = gameState.ownedDigimon[digimonIndex];
  const evolutionChain = ALL_DIGIMON[digimon.key];
  
  if (digimon.stage > 0) {
    const oldForm = evolutionChain[digimon.stage];
    digimon.stage--;
    const newForm = evolutionChain[digimon.stage];
    
    await saveGameState();
    
    // Find which display index this is
    const displayIndex = gameState.activeDigimon.indexOf(digimonIndex);
    if (displayIndex >= 0 && spriteElements[displayIndex]) {
      const sprite = spriteElements[displayIndex];
      const digimonUrl = chrome.runtime.getURL(`assets/${newForm}.gif`);
      
      sprite.style.filter = 'brightness(0.5)';
      const currentTransform = sprite.style.transform;
      sprite.style.transform = currentTransform + ' scale(0.8)';
      
      setTimeout(() => {
        sprite.style.backgroundImage = `url(${digimonUrl})`;
        setTimeout(() => {
          sprite.style.filter = 'none';
          sprite.style.transform = currentTransform;
        }, 500);
      }, 300);
    }
    
    console.log(`De-digivolution! ${oldForm} -> ${newForm}`);
    showNotification(`${oldForm.toUpperCase()} de-digivolved to ${newForm.toUpperCase()}!`, 'info');
  }
}

async function findEgg() {
  // Get list of Digimon player doesn't have
  const ownedKeys = gameState.ownedDigimon.map(d => d.key);
  const availableDigimon = Object.keys(ALL_DIGIMON).filter(key => !ownedKeys.includes(key));
  
  if (availableDigimon.length === 0) {
    showNotification("You've collected all Digimon!", 'info');
    return;
  }
  
  const newDigimon = availableDigimon[Math.floor(Math.random() * availableDigimon.length)];
  gameState.eggs.push({ key: newDigimon, hatchProgress: 0, hatchAt: randomBetween(10, MAX_HATCH_EXECUTIONS) });
  
  await saveGameState();
  replaceWithDigimon();
  
  showNotification(`You found a Digi-Egg! Keep coding to hatch it!`, 'egg');
}

async function updateEggs() {
  for (let i = gameState.eggs.length - 1; i >= 0; i--) {
    const egg = gameState.eggs[i];
    egg.hatchProgress++;
    
    if (egg.hatchProgress >= egg.hatchAt) {
      // Hatch the egg!
      const newDigimon = { key: egg.key, stage: 0, exp: 0 };
      gameState.ownedDigimon.push(newDigimon);
      gameState.eggs.splice(i, 1);
      
      const digimonName = ALL_DIGIMON[egg.key][0];
      showNotification(`Your egg hatched into ${digimonName.toUpperCase()}!`, 'egg');
      
      // Automatically add to active team
      gameState.activeDigimon.push(gameState.ownedDigimon.length - 1);
    }
  }
  
  await saveGameState();
  replaceWithDigimon();
}

async function onCodeExecuted() {
  console.log("Code executed! Training Digimon...");
  
  gameState.totalExecutions++;
  gameState.executionsSinceLastEgg++;
  
  // Give EXP to active Digimon
  gameState.activeDigimon.forEach(digimonIndex => {
    if (digimonIndex < gameState.ownedDigimon.length) {
      gameState.ownedDigimon[digimonIndex].exp++;
    }
  });
  
  // Update eggs
  await updateEggs();
  
  // Check for egg spawn
  if (gameState.executionsSinceLastEgg >= gameState.nextEggAt) {
    gameState.executionsSinceLastEgg = 0;
    gameState.nextEggAt = randomBetween(10, 50);
    await findEgg();
  }
  
  await saveGameState();
}

function animateSprite(sprite, index) {
  const speeds = [35000, 40000, 42000];
  const directions = [-1, 1, -1];
  const startPositions = ['-5%', '105%', '-5%'];
  const endPositions = ['105%', '-5%', '105%'];
  
  const speed = speeds[index % speeds.length];
  const direction = directions[index % directions.length];
  const startDelay = index * 5000;
  
  const baseTransform = direction === 1 ? 'translateY(-50%) scaleX(-1)' : 'translateY(-50%) scaleX(1)';
  sprite.style.transform = baseTransform;
  sprite.style.transition = 'none';
  sprite.style.willChange = 'left'; // Optimize animation performance
  
  let animationState = { startTime: null, cycleStartTime: null };
  
  function updatePosition(timestamp) {
    if (!animationState.startTime) {
      animationState.startTime = timestamp;
      animationState.cycleStartTime = timestamp + startDelay;
    }
    
    const elapsed = timestamp - animationState.cycleStartTime;
    
    if (elapsed < 0) {
      sprite.style.left = startPositions[index % startPositions.length];
      requestAnimationFrame(updatePosition);
      return;
    }
    
    const cycleTime = speed + 100;
    const progress = (elapsed % cycleTime) / cycleTime;
    
    if (progress < (speed / cycleTime)) {
      const moveProgress = (elapsed % cycleTime) / speed;
      const start = parseFloat(startPositions[index % startPositions.length]);
      const end = parseFloat(endPositions[index % endPositions.length]);
      const currentPos = start + (end - start) * moveProgress;
      // Clamp position to prevent overflow
      const clampedPos = Math.max(-10, Math.min(110, currentPos));
      sprite.style.left = clampedPos + '%';
    } else {
      sprite.style.left = startPositions[index % startPositions.length];
    }
    
    requestAnimationFrame(updatePosition);
  }
  
  requestAnimationFrame(updatePosition);
}

function monitorCodeExecution() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.target.classList) {
        const classList = Array.from(mutation.target.classList);
        
        if (classList.includes('running') || classList.includes('executed') ||
            mutation.target.getAttribute('execution-count')) {
          clearTimeout(window.digimonExecutionTimeout);
          window.digimonExecutionTimeout = setTimeout(() => {
            onCodeExecuted();
          }, 500);
        }
      }
      
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.classList && (node.classList.contains('output') ||
              node.classList.contains('output-content'))) {
            clearTimeout(window.digimonExecutionTimeout);
            window.digimonExecutionTimeout = setTimeout(() => {
              onCodeExecuted();
            }, 500);
          }
        });
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'execution-count']
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getState') {
    sendResponse({ gameState: gameState, allDigimon: ALL_DIGIMON });
  } else if (request.action === 'evolve') {
    digivolve(request.index).then(() => sendResponse({ success: true }));
    return true;
  } else if (request.action === 'dedigivolve') {
    dedigivolve(request.index).then(() => sendResponse({ success: true }));
    return true;
  } else if (request.action === 'setActive') {
    gameState.activeDigimon = request.indices;
    saveGameState().then(() => {
      replaceWithDigimon();
      sendResponse({ success: true });
    });
    return true;
  }
});

// Initialize
initializeGameState().then(() => {
  replaceWithDigimon();
  monitorCodeExecution();
});

const observer = new MutationObserver(() => {
  const headerBg = document.getElementById('header-background');
  if (headerBg && !headerBg.querySelector('[class^="digimon-sprite-"]')) {
    replaceWithDigimon();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
setTimeout(() => replaceWithDigimon(), 2000);