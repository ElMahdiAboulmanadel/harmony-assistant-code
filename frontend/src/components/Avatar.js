import React, { Suspense, useEffect, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, useTexture, Loader, Environment, useFBX, useAnimations, OrthographicCamera, OrbitControls } from '@react-three/drei';
import { MeshStandardMaterial } from 'three/src/materials/MeshStandardMaterial';

import { LinearSRGBColorSpace, SRGBColorSpace } from 'three/src/constants';
import { LineBasicMaterial, MeshPhysicalMaterial, Vector2 } from 'three';

import createAnimation from '../converter';
import blinkData from '../blendDataBlink.json';

import * as THREE from 'three';
import io from 'socket.io-client';
import './Avatar.css';
import { motion } from "framer-motion"
import Waves from './Waves';
import { Bloom, DepthOfField, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'

export const FadeComponent = ({ children }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
    >
        {children}
    </motion.div>
)

const _ = require('lodash');

function Avatar({ avatar_url, setConnected, setPlaying, playing }) {

    let gltf = useGLTF(avatar_url);
    let morphTargetDictionaryBody = null;
    let morphTargetDictionaryLowerTeeth = null;

    const [
        bodyTexture,
        eyesTexture,
        teethTexture,
        bodySpecularTexture,
        bodyRoughnessTexture,
        bodyNormalTexture,
        teethNormalTexture,
        hairTexture,
        tshirtDiffuseTexture,
        tshirtNormalTexture,
        tshirtRoughnessTexture,
        hairAlphaTexture,
        hairNormalTexture,
        hairRoughnessTexture,
    ] = useTexture([
        "/images/body.webp",
        "/images/eyes.webp",
        "/images/teeth_diffuse.webp",
        "/images/body_specular.webp",
        "/images/body_roughness.webp",
        "/images/body_normal.webp",
        "/images/teeth_normal.webp",
        "/images/h_color.webp",
        "/images/tshirt_diffuse.webp",
        "/images/tshirt_normal.webp",
        "/images/tshirt_roughness.webp",
        "/images/h_alpha.webp",
        "/images/h_normal.webp",
        "/images/h_roughness.webp",
    ]);

    _.each([
        bodyTexture,
        eyesTexture,
        teethTexture,
        teethNormalTexture,
        bodySpecularTexture,
        bodyRoughnessTexture,
        bodyNormalTexture,
        tshirtDiffuseTexture,
        tshirtNormalTexture,
        tshirtRoughnessTexture,
        hairAlphaTexture,
        hairNormalTexture,
        hairRoughnessTexture
    ], t => {
        t.encoding = SRGBColorSpace;
        t.flipY = false;
    });

    bodyNormalTexture.encoding = LinearSRGBColorSpace;
    tshirtNormalTexture.encoding = LinearSRGBColorSpace;
    teethNormalTexture.encoding = LinearSRGBColorSpace;
    hairNormalTexture.encoding = LinearSRGBColorSpace;

    gltf.scene.traverse(node => {

        if (node.type === 'Mesh' || node.type === 'LineSegments' || node.type === 'SkinnedMesh') {

            node.castShadow = true;
            node.receiveShadow = true;
            node.frustumCulled = false;


            if (node.name.includes("Body")) {

                node.castShadow = true;
                node.receiveShadow = true;

                node.material = new MeshPhysicalMaterial();
                node.material.map = bodyTexture;
                node.material.shininess = 1;
                node.material.roughness = 10;

                node.material.roughnessMap = bodyRoughnessTexture;
                node.material.normalMap = bodyNormalTexture;
                node.material.normalScale = new Vector2(.8, .8);

                morphTargetDictionaryBody = node.morphTargetDictionary;

                node.material.envMapIntensity = .8;
                node.material.visible = true;

            }

            if (node.name.includes("Eyes")) {
                node.material = new MeshStandardMaterial();
                node.material.map = eyesTexture;
                node.material.shininess = 100;
                node.material.roughness = 0.4;
                node.material.envMapIntensity = 0.7;
            }

            if (node.name.includes("Brows")) {
                node.material = new LineBasicMaterial({ color: 0x000000 });
                node.material.linewidth = 5;
                node.material.opacity = 9;
                node.material.transparent = false;
                node.visible = true;
            }

            if (node.name.includes("Teeth")) {

                node.receiveShadow = true;
                node.castShadow = true;
                node.material = new MeshStandardMaterial();
                node.material.roughness = 0.1;
                node.material.map = teethTexture;
                node.material.normalMap = teethNormalTexture;

                node.material.envMapIntensity = 0.7;


            }

            if (node.name.includes("Hair")) {
                node.material = new MeshStandardMaterial();
                node.material.map = hairTexture;
                node.material.alphaMap = hairAlphaTexture;
                node.material.normalMap = hairNormalTexture;
                node.material.roughnessMap = hairRoughnessTexture;

                node.material.transparent = true;
                node.material.depthWrite = false;
                node.material.side = 2;
                node.material.color.setHex(0xEF9000);

                node.material.envMapIntensity = 0.3;

            }

            if (node.name.includes("TSHIRT")) {
                node.material = new MeshStandardMaterial();

                node.material.map = tshirtDiffuseTexture;
                node.material.roughnessMap = tshirtRoughnessTexture;
                node.material.normalMap = tshirtNormalTexture;
                node.material.color.setHex(0x000);

                node.material.envMapIntensity = 0.35;


            }

            if (node.name.includes("TeethLower")) {
                morphTargetDictionaryLowerTeeth = node.morphTargetDictionary;
            }

        }

    });
    const [clips, setClips] = useState([]);
    const [recData, setRecData] = useState(null);

    const mixer = useMemo(() => new THREE.AnimationMixer(gltf.scene), [gltf.scene]);

    useEffect(() => {
        const socket = io('http://localhost:5050');

        socket.on('connect', () => {
            socket.emit('join', 'Hello World from client');
            setConnected(true);
        });

        socket.on('blend_data_from_server', (blendData) => {
            const data = blendData;

            if (data) {
                setPlaying(true);
                setRecData(data);

                let newClips = [
                    createAnimation(data, morphTargetDictionaryBody, 'HG_Body'),
                    createAnimation(data, morphTargetDictionaryLowerTeeth, 'HG_TeethLower')
                ];
                setClips(newClips);
            } else {
                console.log('No audio_and_animation data found in the message');
            }
        });
        socket.on("disconnect", (reason, details) => {
            // the reason of the disconnection, for example "transport error"
            console.log(reason);
            setConnected(false);
        });
    }, [morphTargetDictionaryBody, morphTargetDictionaryLowerTeeth, recData, setConnected, setPlaying, setClips]);


    let idleFbx = useFBX('/idle.fbx');
    let { clips: idleClips } = useAnimations(idleFbx.animations);

    idleClips[0].tracks = _.filter(idleClips[0].tracks, track => {
        return track.name.includes("Head") || track.name.includes("Neck") || track.name.includes("Spine2");
    });

    idleClips[0].tracks = _.map(idleClips[0].tracks, track => {

        if (track.name.includes("Head")) {
            track.name = "head.quaternion";
        }

        if (track.name.includes("Neck")) {
            track.name = "neck.quaternion";
        }

        if (track.name.includes("Spine")) {
            track.name = "spine2.quaternion";
        }

        return track;

    });

    useEffect(() => {

        let idleClipAction = mixer.clipAction(idleClips[0]);
        idleClipAction.play();

        let blinkClip = createAnimation(blinkData, morphTargetDictionaryBody, 'HG_Body');
        let blinkAction = mixer.clipAction(blinkClip);
        blinkAction.play();


    }, [idleClips, mixer, morphTargetDictionaryBody]);

    // Play animation clips when available
    useEffect(() => {

        if (playing === false)
            return;

        _.each(clips, clip => {
            let clipAction = mixer.clipAction(clip);
            clipAction.setLoop(THREE.LoopOnce);
            clipAction.clampWhenFinished = false;
            clipAction.play();
        })

    }, [clips, mixer, playing, setPlaying]);


    useFrame((state, delta) => {
        mixer.update(delta);
        mixer.addEventListener('finished', () => {
            setPlaying(false);
        })
    });


    return (
        <group name="avatar">
            <primitive object={gltf.scene} dispose={null} />
        </group>
    );
}

function AvatarCanva() {
    const [connected, setConnected] = useState(false); // State lifted up to parent component
    const [playing, setPlaying] = useState(false);
    return (
        <div className="full">
            <Canvas dpr={2} onCreated={(ctx) => {
                ctx.gl.physicallyCorrectLights = true;
            }}>

                <OrthographicCamera
                    makeDefault
                    zoom={2000}
                    position={[0, 1.65, 1]}
                />

                <OrbitControls
                    target={[0, 1.65, 0]}
                />

                <Suspense fallback={null}>
                    <Environment background files="/images/neon_photostudio_8k.hdr" />
                </Suspense>

                <Suspense fallback={null}>
                    <mesh position={[0, 0, -1]} rotation={[0, 0, 0]}>
                        <planeGeometry args={[window.innerWidth, window.innerHeight]} />
                        {/*  */}
                        <meshBasicMaterial attach="material" map={null} color="black" opacity={0.5} transparent />
                    </mesh>
                </Suspense>

                <Suspense fallback={null}>
                    <Avatar
                        avatar_url="/model.glb"
                        setConnected={setConnected}
                        setPlaying={setPlaying}
                        playing={playing}
                    />
                </Suspense>
                <EffectComposer>
                    <DepthOfField focusDistance={.03} focalLength={0.2} bokehScale={5} height={480} />
                    <Bloom luminanceThreshold={10} luminanceSmoothing={0.9} height={300} />
                    <Noise opacity={0.05} />
                    <Vignette eskil={false} offset={0.1} darkness={1.1} />
                </EffectComposer>

            </Canvas>
            <Loader dataInterpolation={(p) => `Loading... please wait`} />

            <div style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                // add glowing effect
                boxShadow: connected ? '0 0 10px 5px lime' : '0 0 10px 5px red',
                zIndex: 1000,
                backgroundColor: connected ? 'lime' : 'red',
                // make the transition smooth
                transition: 'box-shadow 0.5s ease-in-out 0s, background-color 0.5s ease-in-out 0s'
            }}></div>
            {playing &&
                <FadeComponent>
                        <Waves amplitude={playing ? .2 : 0.2} />
                </FadeComponent>
            }
        </div>
    )
}

export default AvatarCanva;
