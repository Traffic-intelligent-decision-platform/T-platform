// three-scene.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';

class TrafficScene {
  constructor(canvas) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, canvas.width/canvas.height, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

    // 加载城市模型
    new GLTFLoader().load('city_model.glb', (gltf) => {
      this.city = gltf.scene;
      this.scene.add(this.city);
    });

    // 创建信号灯组
    this.trafficLights = [];
    const lightGeometry = new THREE.CylinderGeometry(0.3, 0.3, 2);
    const materials = [
      new THREE.MeshBasicMaterial({ color: 0xff0000 }),
      new THREE.MeshBasicMaterial({ color: 0xffff00 }),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    ];

    // 在十字路口四个方向创建信号灯
    const positions = [
      { x: 10, z: 0, rotation: Math.PI/2 },  // 东
      { x: -10, z: 0, rotation: -Math.PI/2 }, // 西
      { x: 0, z: 10, rotation: 0 },          // 北
      { x: 0, z: -10, rotation: Math.PI }     // 南
    ];

    positions.forEach(pos => {
      const light = new THREE.Mesh(lightGeometry, materials);
      light.position.set(pos.x, 2.5, pos.z);
      light.rotation.y = pos.rotation;
      this.trafficLights.push(light);
      this.scene.add(light);
    });
  }

  updateLights(phase) {
    this.trafficLights.forEach(light => {
      light.material.forEach(mat => mat.opacity = 0.3);
      light.material[phase].opacity = 1;
    });
  }
}