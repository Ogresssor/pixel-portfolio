import PixelSnow from '../PixelSnow/PixelSnow';
import './Hero.css';

export default function Hero() {
  const scrollToProjects = () => {
    document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero">
      <div className="hero-bg">
        <PixelSnow
          color="#00aaff"
          pixelResolution={270}
          flakeSize={0.01}
          minFlakeSize={1.25}
          speed={1.25}
          density={0.3}
          direction={125}
          brightness={1}
          depthFade={8}
          farPlane={20}
          gamma={0.4545}
          variant="square"
        />
      </div>

      <div className="hero-content">
        <div className="hero-tag">[ PIXEL PORTFOLIO ]</div>
        <h1 className="hero-title">
          <span className="title-line">HI,</span>
          <span className="title-line accent">I BUILD</span>
          <span className="title-line">THINGS.</span>
        </h1>
        <p className="hero-sub">Frontend Developer</p>
        <button className="hero-btn" onClick={scrollToProjects}>
          <span>МОИ ПРОЕКТЫ</span>
          <span className="btn-arrow">↓</span>
        </button>
      </div>

      <div className="hero-scroll-hint">
        <span className="scroll-text">SCROLL</span>
        <div className="scroll-line" />
      </div>
    </section>
  );
}
