import { useEffect, useRef } from 'react';
import { ZombieShooterGame } from '../game/game';

const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<ZombieShooterGame | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Set canvas size to fill the screen
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Initialize the game
    const game = new ZombieShooterGame(canvas);
    gameRef.current = game;

    // Handle window resize
    const handleResize = () => {
      if (!canvasRef.current) return;
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="w-full h-screen overflow-hidden bg-black">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block"
      />
    </div>
  );
};

export default Index;