import React, { useState, useEffect } from 'react';
import './Waves.css'; // Import the CSS file for styling

const Waves = ({ amplitude }) => {
    const [waveHeight1, setWaveHeight1] = useState(50);
    const [waveHeight2, setWaveHeight2] = useState(50);
    const [waveHeight3, setWaveHeight3] = useState(50);

    useEffect(() => {
        const newWaveHeight1 = Math.max(Math.min(amplitude * 100, 100), 0);
        setWaveHeight1(newWaveHeight1);
        const newWaveHeight2 = Math.max(Math.min(amplitude * 100, 100), 0);
        setWaveHeight2(newWaveHeight2);
        const newWaveHeight3 = Math.max(Math.min(amplitude * 100, 100), 0);
        setWaveHeight3(newWaveHeight3);
    }, [amplitude]);

    return (
        <div className="waves-container">
            <div className="wave" style={{ height: `${waveHeight1}%`, animationDuration: '1.2s', animationDelay: '0.1s', animationTimingFunction: 'ease-in-out' }}></div>
            <div className="wave" style={{ height: `${waveHeight2}%`, animationDuration: '1.5s', animationDelay: '0.3s', animationTimingFunction: 'cubic-bezier(0.42, 0, 0.58, 1)' }}></div>
            <div className="wave" style={{ height: `${waveHeight3}%`, animationDuration: '1.8s', animationDelay: '0.2s', animationTimingFunction: 'linear' }}></div>
        </div>
    );
};

export default Waves;
