// Port of app/main.cpp: application entry point. Qt tooltips are suppressed
// application-wide in the C++ app, so no element sets a title tooltip.

import { createRoot } from 'react-dom/client';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(<App />);
