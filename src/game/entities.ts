import { GameEntity, Vector2D } from './engine';

// Player class
export class Player extends GameEntity {
  private speed: number = 200;
  private health: number = 100;
  private maxHealth: number = 100;
  private direction: Vector2D = new Vector2D(1, 0);
  private sprite: HTMLImageElement | null = null;
  private shootCooldown: number = 0;
  private shootCooldownMax: number = 0.2; // seconds
  private weaponType: string = 'pistol';
  private ammo: { [key: string]: number } = {
    pistol: Infinity,
    shotgun: 20,
    rifle: 30
  };
  private weaponDamage: { [key: string]: number } = {
    pistol: 25,
    shotgun: 15, // per pellet
    rifle: 40
  };

  constructor(x: number, y: number, sprite: HTMLImageElement | null = null) {
    super(x, y, 40, 40);
    this.sprite = sprite;
  }

  public update(deltaTime: number): void {
    // Update shoot cooldown
    if (this.shootCooldown > 0) {
      this.shootCooldown -= deltaTime;
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (this.sprite) {
      // Draw player sprite
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      
      // Calculate rotation angle based on direction
      const angle = Math.atan2(this.direction.y, this.direction.x);
      ctx.rotate(angle);
      
      ctx.drawImage(
        this.sprite,
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height
      );
      ctx.restore();
    } else {
      // Fallback if no sprite is available
      ctx.fillStyle = '#3498db';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      
      // Draw direction indicator
      ctx.strokeStyle = '#e74c3c';
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y + this.height / 2);
      ctx.lineTo(
        this.x + this.width / 2 + this.direction.x * 20,
        this.y + this.height / 2 + this.direction.y * 20
      );
      ctx.stroke();
    }
    
    // Draw health bar
    this.renderHealthBar(ctx);
  }

  private renderHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = 40;
    const barHeight = 5;
    const healthPercentage = this.health / this.maxHealth;
    
    // Background
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(this.x, this.y - 10, barWidth, barHeight);
    
    // Health
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(this.x, this.y - 10, barWidth * healthPercentage, barHeight);
  }

  public move(direction: Vector2D, deltaTime: number): void {
    const normalizedDir = direction.normalize();
    this.x += normalizedDir.x * this.speed * deltaTime;
    this.y += normalizedDir.y * this.speed * deltaTime;
  }

  public setDirection(direction: Vector2D): void {
    this.direction = direction.normalize();
  }

  public canShoot(): boolean {
    return this.shootCooldown <= 0 && this.ammo[this.weaponType] > 0;
  }

  public shoot(): Bullet[] {
    if (!this.canShoot()) return [];
    
    this.shootCooldown = this.shootCooldownMax;
    
    // Decrease ammo
    if (this.ammo[this.weaponType] !== Infinity) {
      this.ammo[this.weaponType]--;
    }
    
    // Create bullets based on weapon type
    const bullets: Bullet[] = [];
    const bulletSpeed = 500;
    
    switch (this.weaponType) {
      case 'pistol':
        bullets.push(new Bullet(
          this.x + this.width / 2,
          this.y + this.height / 2,
          this.direction,
          bulletSpeed,
          this.weaponDamage.pistol,
          'player'
        ));
        break;
        
      case 'shotgun':
        // Create multiple pellets with spread
        for (let i = 0; i < 5; i++) {
          const spreadAngle = (Math.random() - 0.5) * 0.5; // Random spread
          const spreadDirection = new Vector2D(
            this.direction.x * Math.cos(spreadAngle) - this.direction.y * Math.sin(spreadAngle),
            this.direction.x * Math.sin(spreadAngle) + this.direction.y * Math.cos(spreadAngle)
          );
          
          bullets.push(new Bullet(
            this.x + this.width / 2,
            this.y + this.height / 2,
            spreadDirection,
            bulletSpeed,
            this.weaponDamage.shotgun,
            'player'
          ));
        }
        break;
        
      case 'rifle':
        bullets.push(new Bullet(
          this.x + this.width / 2,
          this.y + this.height / 2,
          this.direction,
          bulletSpeed * 1.5,
          this.weaponDamage.rifle,
          'player'
        ));
        break;
    }
    
    return bullets;
  }

  public switchWeapon(weapon: string): void {
    if (this.ammo[weapon] !== undefined) {
      this.weaponType = weapon;
      
      // Adjust cooldown based on weapon
      switch (weapon) {
        case 'pistol':
          this.shootCooldownMax = 0.4;
          break;
        case 'shotgun':
          this.shootCooldownMax = 0.8;
          break;
        case 'rifle':
          this.shootCooldownMax = 0.15;
          break;
      }
    }
  }

  public takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.markForDeletion();
    }
  }

  public heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  public addAmmo(type: string, amount: number): void {
    if (this.ammo[type] !== undefined && this.ammo[type] !== Infinity) {
      this.ammo[type] += amount;
    }
  }

  public getHealth(): number {
    return this.health;
  }

  public getMaxHealth(): number {
    return this.maxHealth;
  }

  public getAmmo(): { [key: string]: number } {
    return this.ammo;
  }

  public getWeaponType(): string {
    return this.weaponType;
  }

  public onCollision(other: GameEntity): void {
    // Handle collisions with other entities
    if (other instanceof Zombie) {
      this.takeDamage(10);
    } else if (other instanceof Pickup) {
      // Pickups are handled by the pickup class
    }
  }
}

// Zombie class
export class Zombie extends GameEntity {
  private speed: number;
  private health: number;
  private damage: number;
  private target: Player | null = null;
  private sprite: HTMLImageElement | null = null;
  private attackCooldown: number = 0;
  private attackCooldownMax: number = 1; // seconds
  private type: string;

  constructor(
    x: number,
    y: number,
    type: string = 'normal',
    sprite: HTMLImageElement | null = null
  ) {
    super(x, y, 35, 35);
    this.sprite = sprite;
    this.type = type;
    
    // Set properties based on zombie type
    switch (type) {
      case 'fast':
        this.speed = 150;
        this.health = 50;
        this.damage = 5;
        break;
      case 'tank':
        this.speed = 60;
        this.health = 200;
        this.damage = 20;
        break;
      case 'normal':
      default:
        this.speed = 80;
        this.health = 100;
        this.damage = 10;
        break;
    }
  }

  public update(deltaTime: number): void {
    if (this.target) {
      // Move towards player
      const direction = new Vector2D(
        this.target.x - this.x,
        this.target.y - this.y
      ).normalize();
      
      this.x += direction.x * this.speed * deltaTime;
      this.y += direction.y * this.speed * deltaTime;
      
      // Update attack cooldown
      if (this.attackCooldown > 0) {
        this.attackCooldown -= deltaTime;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (this.sprite) {
      ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
    } else {
      // Fallback rendering based on zombie type
      switch (this.type) {
        case 'fast':
          ctx.fillStyle = '#e74c3c'; // Red
          break;
        case 'tank':
          ctx.fillStyle = '#8e44ad'; // Purple
          break;
        case 'normal':
        default:
          ctx.fillStyle = '#27ae60'; // Green
          break;
      }
      
      ctx.fillRect(this.x, this.y, this.width, this.height);
      
      // Draw simple face
      ctx.fillStyle = '#000';
      ctx.fillRect(this.x + 8, this.y + 10, 5, 5); // Left eye
      ctx.fillRect(this.x + 22, this.y + 10, 5, 5); // Right eye
      ctx.fillRect(this.x + 10, this.y + 22, 15, 3); // Mouth
    }
    
    // Draw health bar
    const barWidth = 35;
    const barHeight = 4;
    const maxHealth = this.getMaxHealth();
    const healthPercentage = this.health / maxHealth;
    
    // Background
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(this.x, this.y - 8, barWidth, barHeight);
    
    // Health
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(this.x, this.y - 8, barWidth * healthPercentage, barHeight);
  }

  public setTarget(player: Player): void {
    this.target = player;
  }

  public takeDamage(amount: number): void {
    this.health -= amount;
    if (this.health <= 0) {
      this.markForDeletion();
    }
  }

  public getMaxHealth(): number {
    switch (this.type) {
      case 'fast': return 50;
      case 'tank': return 200;
      default: return 100;
    }
  }

  public onCollision(other: GameEntity): void {
    if (other instanceof Player && this.attackCooldown <= 0) {
      // Attack player
      this.target?.takeDamage(this.damage);
      this.attackCooldown = this.attackCooldownMax;
    } else if (other instanceof Bullet && (other as Bullet).getSource() === 'player') {
      // Take damage from player bullets
      this.takeDamage((other as Bullet).getDamage());
    }
  }
}

// Bullet class
export class Bullet extends GameEntity {
  private velocity: Vector2D;
  private damage: number;
  private lifespan: number = 2; // seconds
  private source: string; // 'player' or 'enemy'

  constructor(
    x: number,
    y: number,
    direction: Vector2D,
    speed: number,
    damage: number,
    source: string
  ) {
    super(x, y, 5, 5);
    this.velocity = direction.normalize().multiply(speed);
    this.damage = damage;
    this.source = source;
  }

  public update(deltaTime: number): void {
    // Move bullet
    this.x += this.velocity.x * deltaTime;
    this.y += this.velocity.y * deltaTime;
    
    // Decrease lifespan
    this.lifespan -= deltaTime;
    if (this.lifespan <= 0) {
      this.markForDeletion();
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.source === 'player' ? '#f39c12' : '#e74c3c';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  public getDamage(): number {
    return this.damage;
  }

  public getSource(): string {
    return this.source;
  }

  public onCollision(other: GameEntity): void {
    if (this.source === 'player' && other instanceof Zombie) {
      this.markForDeletion();
    } else if (this.source === 'enemy' && other instanceof Player) {
      this.markForDeletion();
    }
  }
}

// Pickup class for health, ammo, etc.
export class Pickup extends GameEntity {
  private type: string; // 'health', 'ammo_pistol', 'ammo_shotgun', 'ammo_rifle'
  private value: number;
  private sprite: HTMLImageElement | null = null;

  constructor(
    x: number,
    y: number,
    type: string,
    value: number,
    sprite: HTMLImageElement | null = null
  ) {
    super(x, y, 20, 20);
    this.type = type;
    this.value = value;
    this.sprite = sprite;
  }

  public update(deltaTime: number): void {
    // Pickups don't need to update
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (this.sprite) {
      ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
    } else {
      // Fallback rendering based on pickup type
      switch (this.type) {
        case 'health':
          ctx.fillStyle = '#2ecc71'; // Green
          ctx.fillRect(this.x, this.y, this.width, this.height);
          ctx.fillStyle = '#fff';
          ctx.fillText('+', this.x + 7, this.y + 14);
          break;
        case 'ammo_pistol':
          ctx.fillStyle = '#3498db'; // Blue
          ctx.fillRect(this.x, this.y, this.width, this.height);
          ctx.fillStyle = '#fff';
          ctx.fillText('P', this.x + 7, this.y + 14);
          break;
        case 'ammo_shotgun':
          ctx.fillStyle = '#e67e22'; // Orange
          ctx.fillRect(this.x, this.y, this.width, this.height);
          ctx.fillStyle = '#fff';
          ctx.fillText('S', this.x + 7, this.y + 14);
          break;
        case 'ammo_rifle':
          ctx.fillStyle = '#9b59b6'; // Purple
          ctx.fillRect(this.x, this.y, this.width, this.height);
          ctx.fillStyle = '#fff';
          ctx.fillText('R', this.x + 7, this.y + 14);
          break;
      }
    }
  }

  public getType(): string {
    return this.type;
  }

  public getValue(): number {
    return this.value;
  }

  public onCollision(other: GameEntity): void {
    if (other instanceof Player) {
      // Apply pickup effect
      if (this.type === 'health') {
        (other as Player).heal(this.value);
      } else if (this.type.startsWith('ammo_')) {
        const weaponType = this.type.split('_')[1];
        (other as Player).addAmmo(weaponType, this.value);
      }
      
      // Remove pickup
      this.markForDeletion();
    }
  }
}

// Obstacle class for walls, barriers, etc.
export class Obstacle extends GameEntity {
  private sprite: HTMLImageElement | null = null;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    sprite: HTMLImageElement | null = null
  ) {
    super(x, y, width, height);
    this.sprite = sprite;
  }

  public update(deltaTime: number): void {
    // Obstacles don't need to update
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (this.sprite) {
      ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
    } else {
      // Fallback rendering
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }

  public onCollision(other: GameEntity): void {
    // Prevent entities from moving through obstacles
    if (other instanceof Player || other instanceof Zombie) {
      // Simple collision response - push back
      const overlapX = Math.min(
        this.x + this.width - other.x,
        other.x + other.width - this.x
      );
      const overlapY = Math.min(
        this.y + this.height - other.y,
        other.y + other.height - this.y
      );
      
      // Push in the direction of least overlap
      if (overlapX < overlapY) {
        if (other.x < this.x) {
          other.x -= overlapX;
        } else {
          other.x += overlapX;
        }
      } else {
        if (other.y < this.y) {
          other.y -= overlapY;
        } else {
          other.y += overlapY;
        }
      }
    } else if (other instanceof Bullet) {
      // Bullets are destroyed when hitting obstacles
      other.markForDeletion();
    }
  }
}