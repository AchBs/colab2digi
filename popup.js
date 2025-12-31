const EXECUTIONS_PER_EVOLUTION = 3;

async function getGameState() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'getState' }, (response) => {
    if (response) {
      renderDigimonList(response.gameState, response.allDigimon);
    }
  });
}

function renderDigimonList(gameState, allDigimon) {
  const container = document.getElementById('digimon-list');
  container.innerHTML = '';
  
  // Show eggs first
  if (gameState.eggs.length > 0) {
    gameState.eggs.forEach((egg, index) => {
      const progress = (egg.hatchProgress / egg.hatchAt) * 100;
      
      const card = document.createElement('div');
      card.className = 'digimon-card';
      card.style.background = 'linear-gradient(135deg, rgba(236, 72, 153, 0.3), rgba(139, 92, 246, 0.3))';
      
      card.innerHTML = `
        <div class="digimon-header">
          <span class="digimon-name">Digi-Egg</span>
          <span class="digimon-stage">Hatching...</span>
        </div>
        <div class="progress-bar">
          <div class="progress-text">${egg.hatchProgress}/${egg.hatchAt}</div>
          <div class="progress-fill" style="width: ${progress}%; background: linear-gradient(90deg, #ec4899, #8b5cf6);"></div>
        </div>
        <div style="text-align: center; font-size: 12px; opacity: 0.9; margin-top: 4px;">
          Run ${egg.hatchAt - egg.hatchProgress} more cells to hatch!
        </div>
      `;
      
      container.appendChild(card);
    });
  }
  
  // Show owned Digimon
  gameState.ownedDigimon.forEach((digimon, index) => {
    const evolutionChain = allDigimon[digimon.key];
    const currentName = evolutionChain[digimon.stage];
    const nextName = digimon.stage < evolutionChain.length - 1 ? evolutionChain[digimon.stage + 1] : null;
    const prevName = digimon.stage > 0 ? evolutionChain[digimon.stage - 1] : null;
    
    const progress = (digimon.exp / EXECUTIONS_PER_EVOLUTION) * 100;
    const canEvolve = digimon.exp >= EXECUTIONS_PER_EVOLUTION && nextName;
    const isMaxLevel = digimon.stage >= evolutionChain.length - 1;
    const isActive = gameState.activeDigimon.includes(index);
    
    const card = document.createElement('div');
    card.className = 'digimon-card';
    if (isActive) {
      card.style.border = '2px solid #fbbf24';
      card.style.boxShadow = '0 0 20px rgba(251, 191, 36, 0.3)';
    }
    
    card.innerHTML = `
      <div class="digimon-header">
        <span class="digimon-name">${currentName} ${isActive ? '★' : ''}</span>
        <span class="digimon-stage">Lv ${digimon.stage + 1}/${evolutionChain.length}</span>
      </div>
      
      ${!isMaxLevel ? `
        <div class="progress-bar">
          <div class="progress-text">${digimon.exp}/${EXECUTIONS_PER_EVOLUTION}</div>
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
        
        <button class="evolve-btn" ${!canEvolve ? 'disabled' : ''} data-evolve="${index}">
          ${canEvolve ? `Evolve to ${nextName}!` : `Run ${EXECUTIONS_PER_EVOLUTION - digimon.exp} more cells`}
        </button>
      ` : `
        <div class="max-level">Max Level Reached!</div>
      `}
      
      ${prevName ? `
        <button class="evolve-btn" style="margin-top: 8px; background: linear-gradient(135deg, #6366f1, #8b5cf6);" 
                data-devolve="${index}">
          De-digivolve to ${prevName}
        </button>
      ` : ''}
      
      <button class="evolve-btn" style="margin-top: 8px; background: linear-gradient(135deg, #667eea, #764ba2);" 
              data-toggle="${index}">
        ${isActive ? 'Remove from Team' : 'Add to Team'}
      </button>
    `;
    
    container.appendChild(card);
  });
  
  // Show next egg info
  const infoDiv = document.createElement('div');
  infoDiv.className = 'info';
  infoDiv.innerHTML = `
    Total Executions: ${gameState.totalExecutions}<br>
    Next egg in: ${gameState.nextEggAt - gameState.executionsSinceLastEgg} executions<br>
    Collection: ${gameState.ownedDigimon.length}/${Object.keys(allDigimon).length} Digimon<br>
    Active Team: ${gameState.activeDigimon.length}/∞
  `;
  container.appendChild(infoDiv);
  
  // Add click handlers
  document.querySelectorAll('.evolve-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.evolve !== undefined) {
        const index = parseInt(btn.dataset.evolve);
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        chrome.tabs.sendMessage(tab.id, { action: 'evolve', index: index }, () => {
          setTimeout(getGameState, 500);
        });
      } else if (btn.dataset.devolve !== undefined) {
        const index = parseInt(btn.dataset.devolve);
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        chrome.tabs.sendMessage(tab.id, { action: 'dedigivolve', index: index }, () => {
          setTimeout(getGameState, 500);
        });
      } else if (btn.dataset.toggle !== undefined) {
        const index = parseInt(btn.dataset.toggle);
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        chrome.tabs.sendMessage(tab.id, { action: 'getState' }, (response) => {
          const gameState = response.gameState;
          const activeIndex = gameState.activeDigimon.indexOf(index);
          
          if (activeIndex >= 0) {
            // Remove from active
            gameState.activeDigimon.splice(activeIndex, 1);
          } else {
            // Add to active (unlimited now)
            gameState.activeDigimon.push(index);
          }
          
          chrome.tabs.sendMessage(tab.id, { 
            action: 'setActive', 
            indices: gameState.activeDigimon 
          }, () => {
            setTimeout(getGameState, 300);
          });
        });
      }
    });
  });
}

getGameState();
setInterval(getGameState, 2000);