/* game_full.js - Versão Final (Pernas Longas, Elevado e Faixas Largas) */

// ============================================================================
// 1. BIBLIOTECA MATEMÁTICA (Mat4)
// ============================================================================
const Mat4 = {
  identity: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
  
  perspective: (fov, aspect, near, far) => {
      const f = 1.0 / Math.tan(fov / 2);
      const nf = 1 / (near - far);
      return new Float32Array([
          f / aspect, 0, 0, 0,
          0, f, 0, 0,
          0, 0, (far + near) * nf, -1,
          0, 0, (2 * far * near) * nf, 0
      ]);
  },

  lookAt: (eye, center, up) => {
      const z = normalize([eye[0]-center[0], eye[1]-center[1], eye[2]-center[2]]);
      const x = normalize(cross(up, z));
      const y = cross(z, x);
      return new Float32Array([
          x[0], y[0], z[0], 0,
          x[1], y[1], z[1], 0,
          x[2], y[2], z[2], 0,
          -dot(x,eye), -dot(y,eye), -dot(z,eye), 1
      ]);
  },

  translate: (m, x, y, z) => {
      const out = new Float32Array(m);
      out[12] = m[0]*x + m[4]*y + m[8]*z + m[12];
      out[13] = m[1]*x + m[5]*y + m[9]*z + m[13];
      out[14] = m[2]*x + m[6]*y + m[10]*z + m[14];
      out[15] = m[3]*x + m[7]*y + m[11]*z + m[15];
      return out;
  },

  scale: (m, x, y, z) => {
      const out = new Float32Array(m);
      out[0] *= x; out[4] *= y; out[8] *= z;
      out[1] *= x; out[5] *= y; out[9] *= z;
      out[2] *= x; out[6] *= y; out[10] *= z;
      out[3] *= x; out[7] *= y; out[11] *= z;
      return out;
  },

  rotateX: (m, angle) => {
      const c = Math.cos(angle), s = Math.sin(angle);
      const out = new Float32Array(m);
      const m4=m[4], m5=m[5], m6=m[6], m7=m[7];
      const m8=m[8], m9=m[9], m10=m[10], m11=m[11];
      out[4] = m4*c + m8*s; out[5] = m5*c + m9*s; out[6] = m6*c + m10*s; out[7] = m7*c + m11*s;
      out[8] = m8*c - m4*s; out[9] = m9*c - m5*s; out[10] = m10*c - m6*s; out[11] = m11*c - m7*s;
      return out;
  },

  rotateZ: (m, angle) => {
      const c = Math.cos(angle), s = Math.sin(angle);
      const out = new Float32Array(m);
      const m0=m[0], m1=m[1], m2=m[2], m3=m[3];
      const m4=m[4], m5=m[5], m6=m[6], m7=m[7];
      out[0] = m0*c + m4*s; out[1] = m1*c + m5*s; out[2] = m2*c + m6*s; out[3] = m3*c + m7*s;
      out[4] = m4*c - m0*s; out[5] = m5*c - m1*s; out[6] = m6*c - m2*s; out[7] = m7*c - m3*s;
      return out;
  },
  
  copy: (m) => new Float32Array(m)
};

function normalize(v) {
  const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  return len > 0 ? [v[0]/len, v[1]/len, v[2]/len] : v;
}
function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

// ============================================================================
// 2. GERENCIADOR DE OBSTÁCULOS
// ============================================================================

const vsObs = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  uniform mat4 uModel;
  uniform mat4 uView;
  uniform mat4 uProj;
  varying vec3 vNormal;
  void main() {
      gl_Position = uProj * uView * uModel * vec4(aPosition, 1.0);
      vNormal = aNormal;
  }
`;

const fsObs = `
  precision mediump float;
  varying vec3 vNormal;
  uniform vec3 uColor;
  void main() {
      vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
      float diff = max(dot(normalize(vNormal), lightDir), 0.0);
      float ambient = 0.6;
      float light = min(ambient + diff, 1.0);
      gl_FragColor = vec4(uColor * light, 1.0);
  }
`;

class ObstacleManager {
  constructor(gl) {
      this.gl = gl;
      this.program = createProgram(gl, vsObs, fsObs);
      this.loc = {
          aPos: gl.getAttribLocation(this.program, "aPosition"),
          aNorm: gl.getAttribLocation(this.program, "aNormal"),
          uModel: gl.getUniformLocation(this.program, "uModel"),
          uView: gl.getUniformLocation(this.program, "uView"),
          uProj: gl.getUniformLocation(this.program, "uProj"),
          uColor: gl.getUniformLocation(this.program, "uColor"),
      };

      this.meshes = {
          box: this.createBox(gl),
          pyramid: this.createPyramid(gl),
      };

      this.list = [];
      this.spawnTimer = 0;
      this.spawnInterval = 1.0; 
  }

  reset() {
      this.list = [];
      this.spawnTimer = 0;
  }

  update(dt, speed) {
      this.spawnTimer += dt;
      if (this.spawnTimer > this.spawnInterval) {
          this.spawn();
          this.spawnTimer = 0;
      }
      
      this.list.forEach((obs) => {
          obs.z += speed * dt; 
      });

      this.list = this.list.filter((obs) => obs.z < 20.0);
  }

  checkCollisions(robo) {
      for (const obs of this.list) {
          if (obs.z > -1.0 && obs.z < 1.0) {
              // Margem lateral
              if (Math.abs(obs.x - robo.x) < 1.0) {
                  if (obs.type === "laser") {
                      // Se não estiver pulando alto, bate
                      if (robo.y < -0.5) return true; 
                  } else {
                      return true; 
                  }
              }
          }
      }
      return false;
  }

  render(viewMatrix, projMatrix) {
      const gl = this.gl;
      gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.loc.uView, false, viewMatrix);
      gl.uniformMatrix4fv(this.loc.uProj, false, projMatrix);

      for (const obs of this.list) {
          if (obs.type === "laser") {
              this.renderLaserBarrier(obs);
          } else {
              const meshName = obs.type === "piramide" ? "pyramid" : "box";
              const mesh = this.meshes[meshName];
              this.bindMesh(mesh);

              let model = Mat4.identity();
              model = Mat4.translate(model, obs.x, obs.y, obs.z);
              model = Mat4.scale(model, obs.scale[0], obs.scale[1], obs.scale[2]);

              gl.uniformMatrix4fv(this.loc.uModel, false, model);
              gl.uniform3fv(this.loc.uColor, obs.color);
              gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
          }
      }
  }

  renderLaserBarrier(obs) {
      const gl = this.gl;
      const mesh = this.meshes.box;
      this.bindMesh(mesh);

      const baseModel = Mat4.translate(Mat4.identity(), obs.x, obs.y, obs.z);

      // Suportes laterais
      let mLeft = Mat4.translate(baseModel, -1.8, 1.5, 0.0);
      mLeft = Mat4.scale(mLeft, 0.5, 3.0, 0.5);
      gl.uniformMatrix4fv(this.loc.uModel, false, mLeft);
      gl.uniform3fv(this.loc.uColor, obs.color);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);

      let mRight = Mat4.translate(baseModel, 1.8, 1.5, 0.0);
      mRight = Mat4.scale(mRight, 0.5, 3.0, 0.5);
      gl.uniformMatrix4fv(this.loc.uModel, false, mRight);
      gl.uniform3fv(this.loc.uColor, obs.color);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);

      // Laser
      let mLaser = Mat4.translate(baseModel, 0.0, 2.0, 0.0);
      mLaser = Mat4.scale(mLaser, 3.6, 0.15, 0.15);
      gl.uniformMatrix4fv(this.loc.uModel, false, mLaser);
      gl.uniform3fv(this.loc.uColor, [1.0, 0.0, 0.2]); 
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }

  bindMesh(mesh) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
      gl.enableVertexAttribArray(this.loc.aPos);
      gl.vertexAttribPointer(this.loc.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nbo);
      gl.enableVertexAttribArray(this.loc.aNorm);
      gl.vertexAttribPointer(this.loc.aNorm, 3, gl.FLOAT, false, 0, 0);
  }

  spawn() {
      // AJUSTE: FAIXAS AINDA MAIS AFASTADAS (6.0)
      const lanes = [-6.0, 0.0, 6.0];
      const laneX = lanes[Math.floor(Math.random() * lanes.length)];
      const types = ["cubo", "piramide", "paralelepipedo", "laser"];
      const type = types[Math.floor(Math.random() * types.length)];

      let obs = {
          x: laneX,
          y: -0.5,
          z: -150.0, 
          type: type,
          color: [Math.random(), Math.random(), Math.random()],
          scale: [1.0, 1.0, 1.0],
      };

      if (type === "cubo") obs.scale = [2.0, 2.0, 2.0];
      else if (type === "piramide") obs.scale = [2.0, 2.0, 2.0];
      else if (type === "paralelepipedo") obs.scale = [2.0, 2.0, 10.0];
      else if (type === "laser") {
          obs.y = -2.0;
          obs.color = [0.3, 0.3, 0.3];
      }
      this.list.push(obs);
  }

  createBox(gl) {
      const vertices = new Float32Array([
          -0.5,-0.5,0.5, 0.5,-0.5,0.5, 0.5,0.5,0.5, -0.5,-0.5,0.5, 0.5,0.5,0.5, -0.5,0.5,0.5,
          -0.5,-0.5,-0.5, -0.5,0.5,-0.5, 0.5,0.5,-0.5, -0.5,-0.5,-0.5, 0.5,0.5,-0.5, 0.5,-0.5,-0.5,
          -0.5,0.5,-0.5, -0.5,0.5,0.5, 0.5,0.5,0.5, -0.5,0.5,-0.5, 0.5,0.5,0.5, 0.5,0.5,-0.5,
          -0.5,-0.5,-0.5, 0.5,-0.5,-0.5, 0.5,-0.5,0.5, -0.5,-0.5,-0.5, 0.5,-0.5,0.5, -0.5,-0.5,0.5,
          0.5,-0.5,-0.5, 0.5,0.5,-0.5, 0.5,0.5,0.5, 0.5,-0.5,-0.5, 0.5,0.5,0.5, 0.5,-0.5,0.5,
          -0.5,-0.5,-0.5, -0.5,-0.5,0.5, -0.5,0.5,0.5, -0.5,-0.5,-0.5, -0.5,0.5,0.5, -0.5,0.5,-0.5
      ]);
      const normals = new Float32Array([
          0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1, 0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,
          0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0, 0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,
          1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0, -1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0
      ]);
      const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      const nbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nbo); gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
      return { vbo, nbo, count: vertices.length / 3 };
  }

  createPyramid(gl) {
      const vertices = new Float32Array([
          0.0,0.5,0.0, -0.5,-0.5,0.5, 0.5,-0.5,0.5, 0.0,0.5,0.0, 0.5,-0.5,0.5, 0.5,-0.5,-0.5,
          0.0,0.5,0.0, 0.5,-0.5,-0.5, -0.5,-0.5,-0.5, 0.0,0.5,0.0, -0.5,-0.5,-0.5, -0.5,-0.5,0.5,
          -0.5,-0.5,-0.5, 0.5,-0.5,-0.5, 0.5,-0.5,0.5, -0.5,-0.5,-0.5, 0.5,-0.5,0.5, -0.5,-0.5,0.5
      ]);
      const normals = new Float32Array(vertices.length); 
      for(let i=0; i<normals.length; i+=3) { normals[i]=0; normals[i+1]=1; normals[i+2]=0; }
      const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      const nbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nbo); gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
      return { vbo, nbo, count: vertices.length / 3 };
  }
}

// ============================================================================
// 3. MAIN GAME
// ============================================================================

const vsCommon = `
  attribute vec3 aPosition;
  attribute vec2 aTexCoord; 
  attribute vec3 aNormal;
  uniform mat4 uModel;
  uniform mat4 uView;
  uniform mat4 uProj;
  varying vec2 vTexCoord;
  varying vec3 vNormal;
  void main() {
      gl_Position = uProj * uView * uModel * vec4(aPosition, 1.0);
      vTexCoord = aTexCoord;
      vNormal = (uModel * vec4(aNormal, 0.0)).xyz; 
  }
`;

const fsPista = `
  precision mediump float;
  varying vec2 vTexCoord;
  uniform sampler2D uSampler;
  uniform float uOffset;
  void main() {
      // AJUSTE NA PROPORÇÃO PARA O CHÃO CORRER MAIS RÁPIDO VISUALMENTE
      vec2 uv = vTexCoord * vec2(3.0, 10.0);
      uv.y += uOffset; 
      vec4 color = texture2D(uSampler, uv);
      float dist = gl_FragCoord.w;
      float fog = 1.0 / exp(dist * 0.03); 
      vec3 fogColor = vec3(0.05, 0.05, 0.15);
      gl_FragColor = vec4(mix(fogColor, color.rgb, clamp(fog, 0.0, 1.0)), 1.0);
  }
`;

const fsRobo = `
  precision mediump float;
  varying vec3 vNormal;
  uniform vec3 uColor;
  uniform float uEmissive;
  void main() {
      vec3 normal = normalize(vNormal);
      vec3 light = normalize(vec3(0.5, 1.0, 0.5));
      float diff = max(dot(normal, light), 0.3);
      vec3 finalColor = uColor * diff;
      if (uEmissive > 0.5) finalColor = uColor * 1.8; 
      gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const input = { x: 0, jump: false };
window.addEventListener('keydown', e => {
  if(e.key==='a' || e.key==='ArrowLeft') input.x = -1;
  if(e.key==='d' || e.key==='ArrowRight') input.x = 1;
  if(e.key===' ' || e.key==='w' || e.key==='ArrowUp') input.jump = true;
});
window.addEventListener('keyup', e => {
  if(e.key==='a' || e.key==='ArrowLeft' || e.key==='d' || e.key==='ArrowRight') input.x = 0;
  if(e.key===' ' || e.key==='w' || e.key==='ArrowUp') input.jump = false;
});

async function main() {
  const canvas = document.getElementById("glCanvas");
  const gl = canvas.getContext("webgl");
  if (!gl) return alert("WebGL erro");

  const gameOverScreen = document.getElementById("gameOverScreen");
  const restartBtn = document.getElementById("restartBtn");

  function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.05, 0.05, 0.15, 1.0);

  const obstacleManager = new ObstacleManager(gl); 
  const progPista = createProgram(gl, vsCommon, fsPista);
  const progRobo = createProgram(gl, vsCommon, fsRobo);

  const pistaGeo = createPlane(gl, 20, 200);
  const cilGeo   = createCylinder(gl);
  const sphereGeo= createSphere(gl);
  const pyrGeo   = createPyramid(gl);

  const texPista = loadTexture(gl, "textura_pista.jpg");

  const neonGreen = [0.2, 1.0, 0.2];
  const lightCyan = [0.0, 1.0, 1.0];
  const emerald   = [0.0, 0.8, 0.4];

  const GAME_SPEED = 20.0;
  
  // RESTAURADO PARA A VELOCIDADE ORIGINAL QUE VOCÊ GOSTAVA
  const TEXTURE_SPEED = GAME_SPEED / 22.0;

  let trackOffset = 0;
  let robo = {
      x: 0,
      y: -2.0,
      velY: 0,
      isJumping: false,
      gravity: 0.03,
      jumpPower: 0.45
  };
  
  let isGameOver = false;
  let then = 0;

  function resetGame() {
      isGameOver = false;
      gameOverScreen.style.display = "none";
      robo.x = 0;
      robo.y = -2.0;
      robo.velY = 0;
      trackOffset = 0;
      obstacleManager.reset();
      then = performance.now() * 0.001;
      requestAnimationFrame(render);
  }

  restartBtn.addEventListener("click", resetGame);

  function render(now) {
      if (isGameOver) return;

      now *= 0.001;
      const dt = now - then;
      then = now;

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Física Robô
      robo.x += input.x * 20.0 * dt; 
      robo.x = Math.max(-8, Math.min(8, robo.x));

      if (input.jump && !robo.isJumping) {
          robo.velY = robo.jumpPower;
          robo.isJumping = true;
      }
      
      robo.velY -= robo.gravity; 
      robo.y += robo.velY;

      if (robo.y <= -2.0) {
          robo.y = -2.0;
          robo.velY = 0;
          robo.isJumping = false;
      }

      trackOffset += TEXTURE_SPEED * dt;

      obstacleManager.update(dt, GAME_SPEED);

      if (obstacleManager.checkCollisions(robo)) {
          isGameOver = true;
          gameOverScreen.style.display = "block";
          return; 
      }

      const aspect = canvas.width / canvas.height;
      const proj = Mat4.perspective(45 * Math.PI/180, aspect, 0.1, 400);
      
      const camPos = [robo.x * 0.3, 6, 15]; 
      const target = [0, 0, -10];
      const view = Mat4.lookAt(camPos, target, [0,1,0]);

      // PISTA
      gl.useProgram(progPista);
      setUniforms(gl, progPista, view, proj);
      gl.uniform1f(gl.getUniformLocation(progPista, "uOffset"), trackOffset);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texPista);
      gl.uniform1i(gl.getUniformLocation(progPista, "uSampler"), 0);
      
      drawMesh(gl, progPista, pistaGeo, Mat4.identity());

      // OBSTÁCULOS
      obstacleManager.render(view, proj);

      // ROBÔ
      gl.useProgram(progRobo);
      setUniforms(gl, progRobo, view, proj); 
      
      let armAngle = 0;
      let legAngle = 0;
      if (!robo.isJumping) {
          armAngle = Math.sin(now * 15) * 0.6;
          legAngle = Math.sin(now * 15) * 0.6;
      } else {
          armAngle = -0.5; 
          legAngle = 0.5;
      }

      // --- ELEVAÇÃO DO ROBÔ (Pernas Longas) ---
      // Elevamos o centro de gravidade (baseY) para 3.2 acima do chão (robo.y)
      // Isso permite pernas de tamanho ~3.0 sem afundar.
      const baseY = robo.y + 3.2; 

      // Corpo
      let m = Mat4.identity();
      m = Mat4.translate(m, robo.x, baseY, 0);
      m = Mat4.scale(m, 0.8, 2.2, 0.8);
      setColor(gl, progRobo, neonGreen, false);
      drawMesh(gl, progRobo, cilGeo, m);

      // Peito
      m = Mat4.identity();
      m = Mat4.translate(m, robo.x, baseY + 0.1, -0.41);
      m = Mat4.scale(m, 0.5, 1.0, 0.1);
      setColor(gl, progRobo, lightCyan, true);
      drawMesh(gl, progRobo, cilGeo, m);

      // Costas
      m = Mat4.identity();
      m = Mat4.translate(m, robo.x, baseY + 0.2, 0.42);
      m = Mat4.rotateZ(m, Math.PI); 
      m = Mat4.scale(m, 2.0, 1.7, 0.1);
      setColor(gl, progRobo, lightCyan, true);
      drawMesh(gl, progRobo, pyrGeo, m);

      // Anel
      m = Mat4.identity();
      m = Mat4.translate(m, robo.x, baseY + 0.2, 0.42);
      m = Mat4.rotateX(m, Math.PI / 2);
      m = Mat4.scale(m, 1.0, 0.15, 1.0);
      setColor(gl, progRobo, neonGreen, true);
      drawMesh(gl, progRobo, cilGeo, m);

      // Tampa
      m = Mat4.identity();
      m = Mat4.translate(m, robo.x, baseY + 0.2, 0.48);
      m = Mat4.scale(m, 1.0, 1.0, 0.05);
      setColor(gl, progRobo, neonGreen, true);
      drawMesh(gl, progRobo, sphereGeo, m);

      // Cabeça
      const headY = baseY + 1.5;
      m = Mat4.identity();
      m = Mat4.translate(m, robo.x, headY, 0);
      m = Mat4.scale(m, 0.8, 0.8, 0.8);
      setColor(gl, progRobo, neonGreen, false);
      drawMesh(gl, progRobo, sphereGeo, m);

      // Espinhos
      for(let i=0; i<3; i++) {
          let sm = Mat4.identity();
          sm = Mat4.translate(sm, robo.x, headY + 0.3, 0); 
          sm = Mat4.rotateX(sm, (i-1) * 0.7); 
          sm = Mat4.translate(sm, 0, 0.23, 0); 
          sm = Mat4.scale(sm, 0.1, 0.25, 0.1); 
          setColor(gl, progRobo, neonGreen, false);
          drawMesh(gl, progRobo, pyrGeo, sm);
      }

      // Olhos
      m = Mat4.identity();
      m = Mat4.translate(m, robo.x - 0.2, headY + 0.1, -0.35);
      m = Mat4.scale(m, 0.15, 0.15, 0.15);
      setColor(gl, progRobo, emerald, true);
      drawMesh(gl, progRobo, sphereGeo, m);

      m = Mat4.identity();
      m = Mat4.translate(m, robo.x + 0.2, headY + 0.1, -0.35);
      m = Mat4.scale(m, 0.15, 0.15, 0.15);
      setColor(gl, progRobo, emerald, true);
      drawMesh(gl, progRobo, sphereGeo, m);

      // Braços
      const drawArm = (side) => {
          let sm = Mat4.identity();
          sm = Mat4.translate(sm, robo.x + (side * 0.54), baseY + 0.9, 0);
          sm = Mat4.rotateX(sm, side * -armAngle);
          let shoulderM = Mat4.copy(sm);
          let drawM = Mat4.scale(sm, 0.3, 0.3, 0.3);
          setColor(gl, progRobo, lightCyan, false);
          drawMesh(gl, progRobo, sphereGeo, drawM);
          shoulderM = Mat4.translate(shoulderM, 0, -0.9, 0);
          shoulderM = Mat4.scale(shoulderM, 0.2, 1.9, 0.2);
          setColor(gl, progRobo, neonGreen, false);
          drawMesh(gl, progRobo, cilGeo, shoulderM);
      };
      drawArm(-1); drawArm(1);

      // --- CORREÇÃO DAS PERNAS LONGAS ---
      const drawLeg = (side) => {
          let lm = Mat4.identity();
          // Quadril (baseY - 0.8)
          lm = Mat4.translate(lm, robo.x + (side * 0.3), baseY - 0.8, 0); 
          lm = Mat4.rotateX(lm, side * legAngle);
          let kneeM = Mat4.copy(lm);
          
          // Perna Longa (Escala 3.0)
          // Se a perna tem tamanho 3.0, metade é 1.5. 
          // Transladamos -1.5 para o pivô ficar no topo.
          lm = Mat4.translate(lm, 0, -1.5, 0); 
          let legScale = Mat4.scale(lm, 0.25, 3.0, 0.25); 
          setColor(gl, progRobo, neonGreen, false);
          drawMesh(gl, progRobo, cilGeo, legScale);
          
          // Joelho
          kneeM = Mat4.translate(kneeM, 0, -1.5, -0.15);
          kneeM = Mat4.scale(kneeM, 0.26, 0.3, 0.1);
          setColor(gl, progRobo, lightCyan, true);
          drawMesh(gl, progRobo, cilGeo, kneeM);
      };
      drawLeg(-1); drawLeg(1);

      requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

// ============================================================================
// HELPERS
// ============================================================================

function createProgram(gl, vs, fs) {
  const p = gl.createProgram();
  const v = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(v, vs); gl.compileShader(v);
  if (!gl.getShaderParameter(v, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(v));
  const f = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(f, fs); gl.compileShader(f);
  if (!gl.getShaderParameter(f, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(f));
  gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
  return p;
}

function setUniforms(gl, prog, view, proj) {
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uView"), false, view);
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uProj"), false, proj);
}

function setColor(gl, prog, color, emissive) {
  gl.uniform3fv(gl.getUniformLocation(prog, "uColor"), color);
  gl.uniform1f(gl.getUniformLocation(prog, "uEmissive"), emissive ? 1.0 : 0.0);
}

function drawMesh(gl, prog, geo, model) {
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uModel"), false, model);
  gl.bindBuffer(gl.ARRAY_BUFFER, geo.vbo);
  const posLoc = gl.getAttribLocation(prog, "aPosition");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

  const normLoc = gl.getAttribLocation(prog, "aNormal");
  if (normLoc !== -1 && geo.nbo) {
      gl.bindBuffer(gl.ARRAY_BUFFER, geo.nbo);
      gl.enableVertexAttribArray(normLoc);
      gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);
  }
  
  const texLoc = gl.getAttribLocation(prog, "aTexCoord");
  if (texLoc !== -1) {
      if (geo.tbo) {
          gl.bindBuffer(gl.ARRAY_BUFFER, geo.tbo);
          gl.enableVertexAttribArray(texLoc);
          gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);
      } else {
          gl.disableVertexAttribArray(texLoc); 
      }
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.ibo);
  gl.drawElements(gl.TRIANGLES, geo.count, gl.UNSIGNED_SHORT, 0);
}

function loadTexture(gl, url) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,255,255]));
  const img = new Image();
  img.src = url;
  img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      if ((img.width & (img.width - 1)) === 0 && (img.height & (img.height - 1)) === 0) {
          gl.generateMipmap(gl.TEXTURE_2D);
      } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
  };
  return tex;
}

// --- CRIADORES DE GEOMETRIA ---

function createPlane(gl, w, d) {
  const v = new Float32Array([-w,-2,-d, w,-2,-d, w,-2,10, -w,-2,10]);
  const t = new Float32Array([0,1, 1,1, 1,0, 0,0]);
  const i = new Uint16Array([0,1,2, 0,2,3]);
  return createBuffer(gl, v, null, t, i);
}

function createCylinder(gl) {
  const v=[], n=[], i=[];
  for(let j=0; j<=16; j++){
      const ang = (j/16)*Math.PI*2, x=Math.cos(ang)*0.5, z=Math.sin(ang)*0.5;
      v.push(x,-0.5,z, x,0.5,z); n.push(x,0,z, x,0,z);
  }
  for(let j=0; j<16; j++) i.push(j*2, j*2+1, j*2+2, j*2+1, j*2+3, j*2+2);
  return createBuffer(gl, new Float32Array(v), new Float32Array(n), null, new Uint16Array(i));
}

function createPyramid(gl) {
  const v = new Float32Array([
      0, 0.5, 0, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, // F
      0, 0.5, 0, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, // R
      0, 0.5, 0, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5, // B
      0, 0.5, 0, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5,  // L
      -0.5,-0.5,-0.5, 0.5,-0.5,-0.5, 0.5,-0.5,0.5, -0.5,-0.5,0.5, 0.5,-0.5,0.5, -0.5,-0.5,0.5 // Base
  ]);
  const n = new Float32Array(v.length);
  for(let k=0; k<n.length; k+=3) { n[k]=0; n[k+1]=1; n[k+2]=0; }
  const i = new Uint16Array([0,1,2, 3,4,5, 6,7,8, 9,10,11, 12,13,14, 15,16,17]);
  return createBuffer(gl, v, n, null, i);
}

function createSphere(gl) {
  const v=[], n=[], i=[];
  const seg = 16;
  for (let lat=0; lat<=seg; lat++) {
      const theta = lat*Math.PI/seg, sinTheta=Math.sin(theta), cosTheta=Math.cos(theta);
      for (let lon=0; lon<=seg; lon++) {
          const phi=lon*2*Math.PI/seg, x=Math.cos(phi)*sinTheta*0.5, y=cosTheta*0.5, z=Math.sin(phi)*sinTheta*0.5;
          v.push(x,y,z); n.push(x*2,y*2,z*2);
      }
  }
  for (let lat=0; lat<seg; lat++) {
      for (let lon=0; lon<seg; lon++) {
          const a=lat*(seg+1)+lon, b=a+seg+1;
          i.push(a,b,a+1, a+1,b,b+1);
      }
  }
  return createBuffer(gl, new Float32Array(v), new Float32Array(n), null, new Uint16Array(i));
}

function createBox(gl) {
  const v = new Float32Array([
      -0.5,-0.5,0.5, 0.5,-0.5,0.5, 0.5,0.5,0.5, -0.5,-0.5,0.5, 0.5,0.5,0.5, -0.5,0.5,0.5,
      -0.5,-0.5,-0.5, -0.5,0.5,-0.5, 0.5,0.5,-0.5, -0.5,-0.5,-0.5, 0.5,0.5,-0.5, 0.5,-0.5,-0.5,
      -0.5,0.5,-0.5, -0.5,0.5,0.5, 0.5,0.5,0.5, -0.5,0.5,-0.5, 0.5,0.5,0.5, 0.5,0.5,-0.5,
      -0.5,-0.5,-0.5, 0.5,-0.5,-0.5, 0.5,-0.5,0.5, -0.5,-0.5,-0.5, 0.5,-0.5,0.5, -0.5,-0.5,0.5,
      0.5,-0.5,-0.5, 0.5,0.5,-0.5, 0.5,0.5,0.5, 0.5,-0.5,-0.5, 0.5,0.5,0.5, 0.5,-0.5,0.5,
      -0.5,-0.5,-0.5, -0.5,-0.5,0.5, -0.5,0.5,0.5, -0.5,-0.5,-0.5, -0.5,0.5,0.5, -0.5,0.5,-0.5
  ]);
  const n = new Float32Array(v.length);
  for(let k=0; k<n.length; k+=3) { n[k]=0; n[k+1]=1; n[k+2]=0; } 
  const i = new Uint16Array([
      0,1,2,0,2,3, 4,5,6,4,6,7, 8,9,10,8,10,11, 12,13,14,12,14,15, 16,17,18,16,18,19, 20,21,22,20,22,23
  ]);
  return createBuffer(gl, v, n, null, i);
}

function createBuffer(gl, v, n, t, i) {
  const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
  const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, i, gl.STATIC_DRAW);
  let nbo=null, tbo=null;
  if(n) { nbo=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nbo); gl.bufferData(gl.ARRAY_BUFFER, n, gl.STATIC_DRAW); }
  if(t) { tbo=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, tbo); gl.bufferData(gl.ARRAY_BUFFER, t, gl.STATIC_DRAW); }
  return { vbo, nbo, tbo, ibo, count: i.length };
}

main();