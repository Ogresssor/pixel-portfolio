import { useState } from 'react';
import Hero from './components/Hero/Hero';
import ProjectWorld from './components/ProjectWorld/ProjectWorld';
import ProjectModal from './components/ProjectModal/ProjectModal';
import { projects } from './data/projects';

export default function App() {
  const [openProject, setOpenProject] = useState(null);

  return (
    <>
      <Hero />
      <ProjectWorld projects={projects} onOpenProject={setOpenProject} />
      {openProject && (
        <ProjectModal project={openProject} onClose={() => setOpenProject(null)} />
      )}
    </>
  );
}
