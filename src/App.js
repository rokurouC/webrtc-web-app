import React from 'react';
import { Room } from './components/room';
import { FirebaseRepo } from './repo';

FirebaseRepo.init();

function App() {
  return <Room />
}

export default App;