import React from 'react';
import AvatarCanva from './components/Avatar';

function App() {
  return (
    <div className="App relative">
      <div className="absolute top-4 left-4 flex items-center z-10">
        <img src='./images/logorobotics.png' alt='Logo' width="50px" className="mr-2"></img>
        <span className="text-white text-3xl font-semibold">LoudBrains</span>
      </div>
      <AvatarCanva />
    </div>
  );
}

export default App;
