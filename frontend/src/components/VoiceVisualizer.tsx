import { useEffect, useRef } from 'react';

interface VoiceVisualizerProps {
  isActive: boolean;
  isProcessing: boolean;
}

export default function VoiceVisualizer({ isActive, isProcessing }: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationId: number;
    let time = 0;
    
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    
    resize();
    window.addEventListener('resize', resize);
    
    const draw = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      
      ctx.clearRect(0, 0, width, height);
      
      if (!isActive && !isProcessing) {
        // Idle state - gentle breathing circle
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = 40 + Math.sin(time * 0.05) * 5;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (isProcessing) {
        // Processing state - spinning loader
        const centerX = width / 2;
        const centerY = height / 2;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(time * 0.1);
        
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, 40 + i * 10, i * 2, i * 2 + 1.5);
          ctx.strokeStyle = `hsla(${260 + i * 40}, 80%, 70%, 0.6)`;
          ctx.lineWidth = 4;
          ctx.stroke();
        }
        
        ctx.restore();
      } else {
        // Active listening state - waveform
        const centerY = height / 2;
        const points = 50;
        const spacing = width / points;
        
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        
        for (let i = 0; i <= points; i++) {
          const x = i * spacing;
          // Create a wave that moves and varies in amplitude
          const amplitude = 30 * (Math.sin(time * 0.1 + i * 0.2) * Math.sin(time * 0.05) + 1.5);
          // Taper the ends
          const envelope = Math.sin((i / points) * Math.PI);
          const y = centerY + Math.sin(time * 0.2 + i * 0.5) * amplitude * envelope;
          
          ctx.lineTo(x, y);
        }
        
        ctx.strokeStyle = '#a78bfa'; // Violet-400
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#8b5cf6';
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      
      time++;
      animationId = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, [isActive, isProcessing]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full absolute inset-0 pointer-events-none"
    />
  );
}
