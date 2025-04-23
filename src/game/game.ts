import { GameEngine, InputHandler, AssetLoader, Vector2D } from './engine';
import { Player, Zombie, Bullet, Pickup, Obstacle } from './entities';

export class ZombieShooterGame {
  private engine: GameEngine;
  private input: InputHandler;
  private assets: AssetLoader;
  private player: Player | null = null;
  private score: number = 0;
  private wave: number = 1;
  private zombiesRemaining: number = 0;
  private spawnCooldown: number = 0;
  private gameState: 'loading' | 'title' | 'playing' | 'paused' | 'gameOver' = 'loading';
  private waveDelay: number = 5; // seconds between waves
  private waveTimer: number = 0;
  private pickupSpawnTimer: number = 0;
  private pickupSpawnInterval: number = 15; // seconds
  private mapWidth: number;
  private mapHeight: number;
  private obstacles: Obstacle[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new GameEngine(canvas);
    this.input = new InputHandler(canvas);
    this.assets = new AssetLoader();
    this.mapWidth = canvas.width;
    this.mapHeight = canvas.height;
    
    // Initialize the game
    this.init();
  }

  private async init(): Promise<void> {
    // Load assets
    try {
      // Load player sprite
      await this.assets.loadImage('player', 'https://i.imgur.com/JFKxnqV.png');
      
      // Load zombie sprites
      await this.assets.loadImage('zombie_normal', 'https://i.imgur.com/8SQUHdA.png');
      await this.assets.loadImage('zombie_fast', 'https://i.imgur.com/YgXdLnm.png');
      await this.assets.loadImage('zombie_tank', 'https://i.imgur.com/Ggz9BvK.png');
      
      // Load pickup sprites
      await this.assets.loadImage('pickup_health', 'https://i.imgur.com/K3eUMhV.png');
      await this.assets.loadImage('pickup_ammo', 'https://i.imgur.com/wgGgG7I.png');
      
      // Load sound effects
      await this.assets.loadSound('shoot_pistol', 'https://assets.mixkit.co/active_storage/sfx/2014/2014-preview.mp3');
      await this.assets.loadSound('shoot_shotgun', 'https://assets.mixkit.co/active_storage/sfx/1662/1662-preview.mp3');
      await this.assets.loadSound('shoot_rifle', 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
      await this.assets.loadSound('zombie_hit', 'https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3');
      await this.assets.loadSound('player_hit', 'https://assets.mixkit.co/active_storage/sfx/2029/2029-preview.mp3');
      await this.assets.loadSound('pickup', 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
      
      // Set game state to title screen
      this.gameState = 'title';
      
      // Start the game loop
      this.engine.start();
      
      // Set up event listeners for the game loop
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to load assets:', error);
      this.gameState = 'title'; // Fall back to title screen even if assets fail to load
    }
  }

  private setupEventListeners(): void {
    // Main game loop
    const gameLoop = (deltaTime: number) => {
      switch (this.gameState) {
        case 'loading':
          this.renderLoadingScreen();
          break;
        case 'title':
          this.renderTitleScreen();
          this.handleTitleScreenInput();
          break;
        case 'playing':
          this.update(deltaTime);
          break;
        case 'paused':
          this.renderPauseScreen();
          this.handlePauseScreenInput();
          break;
        case 'gameOver':
          this.renderGameOverScreen();
          this.handleGameOverScreenInput();
          break;
      }
    };
    
    // Override the engine's update method to include our game loop
    const originalUpdate = this.engine['update'].bind(this.engine);
    this.engine['update'] = (deltaTime: number) => {
      originalUpdate(deltaTime);
      gameLoop(deltaTime);
    };
  }

  private startGame(): void {
    // Reset game state
    this.score = 0;
    this.wave = 1;
    this.waveTimer = 0;
    this.pickupSpawnTimer = 0;
    
    // Clear any existing entities
    this.engine['entities'] = [];
    
    // Create player
    this.player = new Player(
      this.mapWidth / 2 - 20,
      this.mapHeight / 2 - 20,
      this.assets.getImage('player')
    );
    this.engine.addEntity(this.player);
    
    // Create obstacles
    this.createObstacles();
    
    // Start first wave
    this.startWave();
    
    // Set game state to playing
    this.gameState = 'playing';
  }

  private createObstacles(): void {
    // Clear existing obstacles
    this.obstacles = [];
    
    // Create some obstacles around the map
    // Top and bottom walls
    const wallThickness = 20;
    
    // Top wall
    const topWall = new Obstacle(0, 0, this.mapWidth, wallThickness, null);
    this.engine.addEntity(topWall);
    this.obstacles.push(topWall);
    
    // Bottom wall
    const bottomWall = new Obstacle(0, this.mapHeight - wallThickness, this.mapWidth, wallThickness, null);
    this.engine.addEntity(bottomWall);
    this.obstacles.push(bottomWall);
    
    // Left wall
    const leftWall = new Obstacle(0, 0, wallThickness, this.mapHeight, null);
    this.engine.addEntity(leftWall);
    this.obstacles.push(leftWall);
    
    // Right wall
    const rightWall = new Obstacle(this.mapWidth - wallThickness, 0, wallThickness, this.mapHeight, null);
    this.engine.addEntity(rightWall);
    this.obstacles.push(rightWall);
    
    // Add some random obstacles in the map
    for (let i = 0; i < 5; i++) {
      const width = Math.random() * 80 + 40;
      const height = Math.random() * 80 + 40;
      const x = Math.random() * (this.mapWidth - width - 2 * wallThickness) + wallThickness;
      const y = Math.random() * (this.mapHeight - height - 2 * wallThickness) + wallThickness;
      
      // Ensure obstacles don't spawn on top of the player
      const playerBuffer = 100;
      const playerCenterX = this.mapWidth / 2;
      const playerCenterY = this.mapHeight / 2;
      
      if (
        x > playerCenterX - playerBuffer &&
        x < playerCenterX + playerBuffer &&
        y > playerCenterY - playerBuffer &&
        y < playerCenterY + playerBuffer
      ) {
        // Skip this obstacle if it's too close to the player spawn
        continue;
      }
      
      const obstacle = new Obstacle(x, y, width, height, null);
      this.engine.addEntity(obstacle);
      this.obstacles.push(obstacle);
    }
  }

  private startWave(): void {
    // Calculate number of zombies based on wave
    const baseZombies = 5;
    const zombiesPerWave = Math.floor(baseZombies + this.wave * 2);
    this.zombiesRemaining = zombiesPerWave;
    
    // Reset spawn cooldown
    this.spawnCooldown = 0;
  }

  private update(deltaTime: number): void {
    if (!this.player) return;
    
    // Handle player input
    this.handlePlayerInput(deltaTime);
    
    // Update wave timer if no zombies remaining
    if (this.zombiesRemaining <= 0) {
      this.waveTimer += deltaTime;
      if (this.waveTimer >= this.waveDelay) {
        this.wave++;
        this.startWave();
        this.waveTimer = 0;
      }
    } else {
      // Spawn zombies
      this.updateZombieSpawning(deltaTime);
    }
    
    // Update pickup spawning
    this.updatePickupSpawning(deltaTime);
    
    // Check if player is dead
    if (this.player.isMarkedForDeletion()) {
      this.gameState = 'gameOver';
    }
    
    // Check for pause
    if (this.input.isKeyDown('Escape')) {
      this.gameState = 'paused';
      this.engine.pause();
    }
    
    // Render UI
    this.renderUI();
  }

  private handlePlayerInput(deltaTime: number): void {
    if (!this.player) return;
    
    // Movement
    const moveDirection = new Vector2D();
    
    if (this.input.isKeyDown('w') || this.input.isKeyDown('ArrowUp')) {
      moveDirection.y = -1;
    }
    if (this.input.isKeyDown('s') || this.input.isKeyDown('ArrowDown')) {
      moveDirection.y = 1;
    }
    if (this.input.isKeyDown('a') || this.input.isKeyDown('ArrowLeft')) {
      moveDirection.x = -1;
    }
    if (this.input.isKeyDown('d') || this.input.isKeyDown('ArrowRight')) {
      moveDirection.x = 1;
    }
    
    if (moveDirection.x !== 0 || moveDirection.y !== 0) {
      this.player.move(moveDirection, deltaTime);
    }
    
    // Aiming
    const mousePos = this.input.getMousePosition();
    const playerCenterX = this.player.x + this.player.width / 2;
    const playerCenterY = this.player.y + this.player.height / 2;
    const aimDirection = new Vector2D(
      mousePos.x - playerCenterX,
      mousePos.y - playerCenterY
    );
    
    this.player.setDirection(aimDirection);
    
    // Shooting
    if (this.input.isMouseButtonDown(0) && this.player.canShoot()) {
      const bullets = this.player.shoot();
      
      // Add bullets to the game
      for (const bullet of bullets) {
        this.engine.addEntity(bullet);
      }
      
      // Play sound based on weapon type
      const weaponType = this.player.getWeaponType();
      switch (weaponType) {
        case 'pistol':
          this.assets.playSound('shoot_pistol', 0.3);
          break;
        case 'shotgun':
          this.assets.playSound('shoot_shotgun', 0.3);
          break;
        case 'rifle':
          this.assets.playSound('shoot_rifle', 0.3);
          break;
      }
      
      // Reset mouse button to prevent continuous firing
      this.input.resetMouseButton(0);
    }
    
    // Weapon switching
    if (this.input.isKeyDown('1')) {
      this.player.switchWeapon('pistol');
    } else if (this.input.isKeyDown('2')) {
      this.player.switchWeapon('shotgun');
    } else if (this.input.isKeyDown('3')) {
      this.player.switchWeapon('rifle');
    }
  }

  private updateZombieSpawning(deltaTime: number): void {
    // Update spawn cooldown
    if (this.spawnCooldown > 0) {
      this.spawnCooldown -= deltaTime;
      return;
    }
    
    // Spawn a zombie if there are zombies remaining
    if (this.zombiesRemaining > 0) {
      this.spawnZombie();
      this.zombiesRemaining--;
      
      // Set cooldown for next spawn
      this.spawnCooldown = 1.5 - Math.min(1.3, this.wave * 0.1); // Spawn faster in later waves
    }
  }

  private spawnZombie(): void {
    if (!this.player) return;
    
    // Determine zombie type based on wave and randomness
    let zombieType = 'normal';
    const rand = Math.random();
    
    if (this.wave >= 3 && rand < 0.2) {
      zombieType = 'fast';
    } else if (this.wave >= 5 && rand < 0.1) {
      zombieType = 'tank';
    }
    
    // Determine spawn position (outside the screen)
    const spawnSide = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
    let x = 0;
    let y = 0;
    
    const buffer = 50; // Distance outside the screen
    
    switch (spawnSide) {
      case 0: // Top
        x = Math.random() * this.mapWidth;
        y = -buffer;
        break;
      case 1: // Right
        x = this.mapWidth + buffer;
        y = Math.random() * this.mapHeight;
        break;
      case 2: // Bottom
        x = Math.random() * this.mapWidth;
        y = this.mapHeight + buffer;
        break;
      case 3: // Left
        x = -buffer;
        y = Math.random() * this.mapHeight;
        break;
    }
    
    // Create zombie
    let zombieSprite = null;
    switch (zombieType) {
      case 'normal':
        zombieSprite = this.assets.getImage('zombie_normal');
        break;
      case 'fast':
        zombieSprite = this.assets.getImage('zombie_fast');
        break;
      case 'tank':
        zombieSprite = this.assets.getImage('zombie_tank');
        break;
    }
    
    const zombie = new Zombie(x, y, zombieType, zombieSprite);
    zombie.setTarget(this.player);
    
    // Add zombie to the game
    this.engine.addEntity(zombie);
  }

  private updatePickupSpawning(deltaTime: number): void {
    // Update pickup spawn timer
    this.pickupSpawnTimer += deltaTime;
    
    if (this.pickupSpawnTimer >= this.pickupSpawnInterval) {
      this.spawnPickup();
      this.pickupSpawnTimer = 0;
    }
  }

  private spawnPickup(): void {
    // Determine pickup type
    const pickupTypes = ['health', 'ammo_pistol', 'ammo_shotgun', 'ammo_rifle'];
    const type = pickupTypes[Math.floor(Math.random() * pickupTypes.length)];
    
    // Determine value based on type
    let value = 0;
    switch (type) {
      case 'health':
        value = 25;
        break;
      case 'ammo_pistol':
        value = 15;
        break;
      case 'ammo_shotgun':
        value = 5;
        break;
      case 'ammo_rifle':
        value = 10;
        break;
    }
    
    // Determine position (random within the map)
    const wallBuffer = 40;
    let x = Math.random() * (this.mapWidth - 2 * wallBuffer) + wallBuffer;
    let y = Math.random() * (this.mapHeight - 2 * wallBuffer) + wallBuffer;
    
    // Ensure pickup doesn't spawn inside an obstacle
    let validPosition = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!validPosition && attempts < maxAttempts) {
      validPosition = true;
      
      for (const obstacle of this.obstacles) {
        if (
          x < obstacle.x + obstacle.width &&
          x + 20 > obstacle.x &&
          y < obstacle.y + obstacle.height &&
          y + 20 > obstacle.y
        ) {
          // Position overlaps with an obstacle, try again
          validPosition = false;
          x = Math.random() * (this.mapWidth - 2 * wallBuffer) + wallBuffer;
          y = Math.random() * (this.mapHeight - 2 * wallBuffer) + wallBuffer;
          break;
        }
      }
      
      attempts++;
    }
    
    // If we couldn't find a valid position after max attempts, don't spawn the pickup
    if (!validPosition) return;
    
    // Create pickup
    const sprite = type === 'health' 
      ? this.assets.getImage('pickup_health') 
      : this.assets.getImage('pickup_ammo');
    
    const pickup = new Pickup(x, y, type, value, sprite);
    
    // Add pickup to the game
    this.engine.addEntity(pickup);
  }

  private renderUI(): void {
    const ctx = this.engine.getContext();
    const canvas = this.engine.getCanvas();
    
    // Set font
    ctx.font = '16px Arial';
    ctx.fillStyle = '#fff';
    
    // Score and wave
    ctx.fillText(`Score: ${this.score}`, 20, 30);
    ctx.fillText(`Wave: ${this.wave}`, 20, 50);
    
    // Wave timer if waiting for next wave
    if (this.zombiesRemaining <= 0) {
      const timeRemaining = Math.ceil(this.waveDelay - this.waveTimer);
      ctx.fillText(`Next wave in: ${timeRemaining}`, canvas.width / 2 - 60, 30);
    } else {
      ctx.fillText(`Zombies remaining: ${this.zombiesRemaining}`, canvas.width / 2 - 80, 30);
    }
    
    // Player info
    if (this.player) {
      // Weapon and ammo
      const weaponType = this.player.getWeaponType();
      const ammo = this.player.getAmmo()[weaponType];
      const ammoText = ammo === Infinity ? '∞' : ammo.toString();
      ctx.fillText(`Weapon: ${weaponType} (${ammoText})`, canvas.width - 200, 30);
      
      // Health
      const health = this.player.getHealth();
      const maxHealth = this.player.getMaxHealth();
      ctx.fillText(`Health: ${health}/${maxHealth}`, canvas.width - 200, 50);
    }
  }

  private renderLoadingScreen(): void {
    const ctx = this.engine.getContext();
    const canvas = this.engine.getCanvas();
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Loading text
    ctx.font = '30px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('Loading...', canvas.width / 2, canvas.height / 2 - 50);
    
    // Loading bar
    const progress = this.assets.getLoadingProgress();
    const barWidth = 300;
    const barHeight = 20;
    
    // Border
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(
      canvas.width / 2 - barWidth / 2,
      canvas.height / 2,
      barWidth,
      barHeight
    );
    
    // Fill
    ctx.fillStyle = '#3498db';
    ctx.fillRect(
      canvas.width / 2 - barWidth / 2,
      canvas.height / 2,
      barWidth * progress,
      barHeight
    );
    
    // Reset text align
    ctx.textAlign = 'left';
  }

  private renderTitleScreen(): void {
    const ctx = this.engine.getContext();
    const canvas = this.engine.getCanvas();
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Title
    ctx.font = '50px Arial';
    ctx.fillStyle = '#e74c3c';
    ctx.textAlign = 'center';
    ctx.fillText('ZOMBIE SHOOTER', canvas.width / 2, canvas.height / 3);
    
    // Instructions
    ctx.font = '20px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('Click to Start', canvas.width / 2, canvas.height / 2);
    
    ctx.font = '16px Arial';
    ctx.fillText('Controls:', canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText('WASD or Arrow Keys - Move', canvas.width / 2, canvas.height / 2 + 80);
    ctx.fillText('Mouse - Aim and Shoot', canvas.width / 2, canvas.height / 2 + 110);
    ctx.fillText('1, 2, 3 - Switch Weapons', canvas.width / 2, canvas.height / 2 + 140);
    ctx.fillText('ESC - Pause', canvas.width / 2, canvas.height / 2 + 170);
    
    // Reset text align
    ctx.textAlign = 'left';
  }

  private handleTitleScreenInput(): void {
    if (this.input.isMouseButtonDown(0)) {
      this.startGame();
      this.input.resetMouseButton(0);
    }
  }

  private renderPauseScreen(): void {
    const ctx = this.engine.getContext();
    const canvas = this.engine.getCanvas();
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Pause text
    ctx.font = '40px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 50);
    
    // Instructions
    ctx.font = '20px Arial';
    ctx.fillText('Press ESC to Resume', canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText('Click to Restart', canvas.width / 2, canvas.height / 2 + 60);
    
    // Reset text align
    ctx.textAlign = 'left';
  }

  private handlePauseScreenInput(): void {
    if (this.input.isKeyDown('Escape')) {
      this.gameState = 'playing';
      this.engine.resume();
    } else if (this.input.isMouseButtonDown(0)) {
      this.startGame();
      this.engine.resume();
      this.input.resetMouseButton(0);
    }
  }

  private renderGameOverScreen(): void {
    const ctx = this.engine.getContext();
    const canvas = this.engine.getCanvas();
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Game over text
    ctx.font = '50px Arial';
    ctx.fillStyle = '#e74c3c';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 50);
    
    // Score
    ctx.font = '30px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Score: ${this.score}`, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText(`Wave: ${this.wave}`, canvas.width / 2, canvas.height / 2 + 60);
    
    // Restart instruction
    ctx.font = '20px Arial';
    ctx.fillText('Click to Restart', canvas.width / 2, canvas.height / 2 + 120);
    
    // Reset text align
    ctx.textAlign = 'left';
  }

  private handleGameOverScreenInput(): void {
    if (this.input.isMouseButtonDown(0)) {
      this.startGame();
      this.input.resetMouseButton(0);
    }
  }

  // Method to add score when a zombie is killed
  public addScore(points: number): void {
    this.score += points;
  }
}