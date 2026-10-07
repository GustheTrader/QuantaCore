import React from 'react';
import { createRoot } from 'react-dom/client';
import HybridCloud from './components/HybridCloud';
const local = ['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname);
createRoot(document.getElementById('hybrid-root')!).render(local ? <HybridCloud /> : <p>Open Hybrid Cloud from the local Quanta server on this computer.</p>);
