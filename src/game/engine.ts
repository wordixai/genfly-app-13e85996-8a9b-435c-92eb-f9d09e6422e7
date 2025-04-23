// Game engine core functionality
export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lastTimestamp: number = 0;
  private entities: GameEntity[] = [];
  private gameLoopId: number | null = null;
  private isPaused: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;
  }

  public addEntity(entity: GameEntity): void {
    this.entities.push(entity);
  }

  public removeEntity(entity: GameEntity): void {
    const index = this.entities.indexOf(entity);
    if (index !== -1) {
      this.entities.splice(index, 1);
    }
  }

  public start(): void {
    if (this.gameLoopId === null) {
      this.lastTimestamp = performance.now();
      this.gameLoop(this.lastTimestamp);
    }
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.lastTimestamp = performance.now();
    }
  }

  public stop(): void {
    if (this.gameLoopId !== null) {
      cancelAnimationFrame(this.gameLoopId);
      this.gameLoopId = null;
    }
  }

  private gameLoop(timestamp: number): void {
    this.gameLoopId = requestAnimationFrame(this.gameLoop.bind(this));
    
    if (this.isPaused) return;
    
    const deltaTime = (timestamp - this.lastTimestamp) / 1000; // Convert to seconds
    this.lastTimestamp = timestamp;
    
    this.update(deltaTime);
    this.render();
  }

  private update(deltaTime: number): void {
    // Check for collisions
    this.checkCollisions();
    
    // Update all entities
    for (const entity of this.entities) {
      entity.update(deltaTime);
    }
    
    // Remove dead entities
    this.entities = this.entities.filter(entity => !entity.isMarkedForDeletion());
  }

  private checkCollisions(): void {
    for (let i = 0; i < this.entities.length; i++) {
      for (let j = i + 1; j < this.entities.length; j++) {
        const entityA = this.entities[i];
        const entityB = this.entities[j];
        
        if (this.isColliding(entityA, entityB)) {
          entityA.onCollision(entityB);
          entityB.onCollision(entityA);
        }
      }
    }
  }

  private isColliding(entityA: GameEntity, entityB: GameEntity): boolean {
    // Simple rectangle collision detection
    return (
      entityA.x < entityB.x + entityB.width &&
      entityA.x + entityA.width > entityB.x &&
      entityA.y < entityB.y + entityB.height &&
      entityA.y + entityA.height > entityB.y
    );
  }

  private render(): void {
    // Clear the canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Render all entities
    for (const entity of this.entities) {
      entity.render(this.ctx);
    }
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  public getEntities(): GameEntity[] {
    return this.entities;
  }
}

// Base class for all game entities
export abstract class GameEntity {
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  protected markedForDeletion: boolean = false;
  
  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
  
  public abstract update(deltaTime: number): void;
  public abstract render(ctx: CanvasRenderingContext2D): void;
  
  public onCollision(other: GameEntity): void {
    // Default implementation does nothing
  }
  
  public isMarkedForDeletion(): boolean {
    return this.markedForDeletion;
  }
  
  public markForDeletion(): void {
    this.markedForDeletion = true;
  }
}

// Vector2D utility class for movement and physics
export class Vector2D {
  public x: number;
  public y: number;
  
  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }
  
  public add(other: Vector2D): Vector2D {
    return new Vector2D(this.x + other.x, this.y + other.y);
  }
  
  public subtract(other: Vector2D): Vector2D {
    return new Vector2D(this.x - other.x, this.y - other.y);
  }
  
  public multiply(scalar: number): Vector2D {
    return new Vector2D(this.x * scalar, this.y * scalar);
  }
  
  public magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  
  public normalize(): Vector2D {
    const mag = this.magnitude();
    if (mag === 0) return new Vector2D();
    return new Vector2D(this.x / mag, this.y / mag);
  }
  
  public static distance(a: Vector2D, b: Vector2D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

// Input handler for keyboard and mouse
export class InputHandler {
  private keys: { [key: string]: boolean } = {};
  private mousePosition: Vector2D = new Vector2D();
  private mouseButtons: { [button: number]: boolean } = {};
  
  constructor(canvas: HTMLCanvasElement) {
    // Keyboard event listeners
    window.addEventListener('keydown', (e) => {
      this.keys[e.key] = true;
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
    });
    
    // Mouse event listeners
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mousePosition.x = e.clientX - rect.left;
      this.mousePosition.y = e.clientY - rect.top;
    });
    
    canvas.addEventListener('mousedown', (e) => {
      this.mouseButtons[e.button] = true;
    });
    
    canvas.addEventListener('mouseup', (e) => {
      this.mouseButtons[e.button] = false;
    });
    
    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }
  
  public isKeyDown(key: string): boolean {
    return this.keys[key] === true;
  }
  
  public isMouseButtonDown(button: number): boolean {
    return this.mouseButtons[button] === true;
  }
  
  public getMousePosition(): Vector2D {
    return this.mousePosition;
  }
  
  public resetMouseButton(button: number): void {
    this.mouseButtons[button] = false;
  }
}

// Asset loader for images and sounds
export class AssetLoader {
  private images: { [key: string]: HTMLImageElement } = {};
  private sounds: { [key: string]: HTMLAudioElement } = {};
  private totalAssets: number = 0;
  private loadedAssets: number = 0;
  
  public loadImage(key: string, src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      this.totalAssets++;
      const img = new Image();
      img.onload = () => {
        this.images[key] = img;
        this.loadedAssets++;
        resolve(img);
      };
      img.onerror = () => {
        reject(new Error(`Failed to load image: ${src}`));
      };
      img.src = src;
    });
  }
  
  public loadSound(key: string, src: string): Promise<HTMLAudioElement> {
    return new Promise((resolve, reject) => {
      this.totalAssets++;
      const audio = new Audio();
      audio.oncanplaythrough = () => {
        this.sounds[key] = audio;
        this.loadedAssets++;
        resolve(audio);
      };
      audio.onerror = () => {
        reject(new Error(`Failed to load sound: ${src}`));
      };
      audio.src = src;
    });
  }
  
  public getImage(key: string): HTMLImageElement {
    return this.images[key];
  }
  
  public getSound(key: string): HTMLAudioElement {
    return this.sounds[key];
  }
  
  public playSound(key: string, volume: number = 1.0, loop: boolean = false): void {
    const sound = this.getSound(key);
    if (sound) {
      sound.volume = volume;
      sound.loop = loop;
      sound.currentTime = 0;
      sound.play().catch(e => console.error("Error playing sound:", e));
    }
  }
  
  public getLoadingProgress(): number {
    if (this.totalAssets === 0) return 1;
    return this.loadedAssets / this.totalAssets;
  }
}