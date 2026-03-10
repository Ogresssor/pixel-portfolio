import { useEffect } from 'react';
import './ProjectModal.css';

export default function ProjectModal({ project, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>

        {/* title bar */}
        <div className="modal-bar" style={{ '--accent': project.color }}>
          <div className="bar-dots">
            <span /><span /><span />
          </div>
          <span className="bar-title">{project.title}</span>
          <button className="bar-close" onClick={onClose} aria-label="close">✕</button>
        </div>

        {/* iframe */}
        <div className="modal-body">
          <iframe
            src={project.url}
            title={project.title}
            className="modal-iframe"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        </div>

      </div>
    </div>
  );
}
