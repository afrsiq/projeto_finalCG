
// Vertex shader do quad (fundo / buraco)
const quadVS = `
attribute vec2 aPos;
void main(){
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// Fragment shader do quad: desenha gradiente + buraco com tilt/espiral + interior preto
const quadFS = `
precision mediump float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uHoleCenter;    
uniform float uHoleSize;     
uniform float uCamera;       

void main(){
    vec2 frag = gl_FragCoord.xy;

    // fundo roxo + azul
    vec3 purple = vec3(0.15, 0.02, 0.25);
    vec3 blue   = vec3(0.02, 0.05, 0.12);
    float g = frag.y / uResolution.y;
    vec3 bg = mix(blue, purple, g);

    // UV de -1..1 (NDC). Mantemos espaço uniforme — sem escala de aspect aqui.
    vec2 uv = (frag / uResolution) * 2.0 - 1.0;

    // camera tilt aplicado GLOBALMENTE ao espaço (compressão vertical)
    float tilt = mix(1.0, 0.15, uCamera);
    uv.y *= tilt;

    // centro do buraco em NDC (após mesma convenção)
    vec2 centerUV = (uHoleCenter / uResolution) * 2.0 - 1.0;
    centerUV.y *= tilt;

    // deslocamento do pixel ao centro (já no espaço inclinado)
    vec2 d = uv - centerUV;

    // converte pixels -> NDC vertical como referência (1 pixel = 2/height)
    float pixelToUV = 2.0 / uResolution.y;
    float radius = uHoleSize * pixelToUV;

    // distância no espaço inclinado
    float r = length(d);

    // interior preto
    if (r < radius) {
        gl_FragColor = vec4(0.0);
        return;
    }

    // anel roxo inclinado
    float glowDist = r - radius;
    float glow = 0.03 / (abs(glowDist) + 0.001);
    glow = clamp(glow, 0.0, 1.0);

    // roxo brilhante diminuindo quando frontal
    vec3 glowColor = vec3(0.7, 0.1, 1.0) * (1.0 - 0.5 * uCamera);

    // fundo + anel
    vec3 color = bg + glow * glowColor;

    gl_FragColor = vec4(color, 1.0);
}

`;

// Vertex shader para pontos (estrelas e robô) com tamanho variável
const pointsVS = `
attribute vec2 aPosition;
attribute float aSize;
void main(){
  gl_Position = vec4(aPosition, 0.0, 1.0);
  gl_PointSize = aSize;
}
`;

// Fragment shader para pontos
const pointsFS = `
precision mediump float;
uniform float uTime;
uniform float uCamera; // 0..1 para ajustar brilho/visibilidade
uniform vec3 uColor; // cor do ponto (entrada)
void main(){
  // circular smooth point
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  float alpha = smoothstep(0.5, 0.44, d);
  float tw = 0.7 + 0.3 * sin(uTime * 5.0 + (gl_FragCoord.x + gl_FragCoord.y) * 0.01);
  vec3 col = uColor * tw * (1.0 - 0.45 * uCamera);
  gl_FragColor = vec4(col, alpha);
}
`;

function createShader(gl, type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
    console.error('Shader compile error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function createProgramFromSources(gl, vsSrc, fsSrc){
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)){
    console.error('Program link error:', gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

function main(){
  const canvas = document.getElementById('glCanvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const gl = canvas.getContext('webgl');
  if (!gl) { alert('WebGL não suportado'); return; }

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0,0,0,1);

  // programas
  const quadProgram = createProgramFromSources(gl, quadVS, quadFS);
  const pointsProgram = createProgramFromSources(gl, pointsVS, pointsFS);

  // quad (fundo) setup
  const quadVerts = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

  const quadPosLoc = gl.getAttribLocation(quadProgram, 'aPos');
  const uTimeQuad = gl.getUniformLocation(quadProgram, 'uTime');
  const uResQuad = gl.getUniformLocation(quadProgram, 'uResolution');
  const uHoleCenter = gl.getUniformLocation(quadProgram, 'uHoleCenter');
  const uHoleSize = gl.getUniformLocation(quadProgram, 'uHoleSize');
  const uCamera = gl.getUniformLocation(quadProgram, 'uCamera');

  // points (stars + robot)
  const starCount = 350;
  let stars = new Float32Array(starCount * 3);
  let starVel = new Float32Array(starCount * 2);
  for (let i=0;i<starCount;i++){
    const x = (Math.random()*2 - 1) * 0.95;
    const y = (Math.random()*2 - 1) * 0.95;
    const s = 1.2 + Math.random() * 2.5;
    stars[i*3 + 0] = x;
    stars[i*3 + 1] = y;
    stars[i*3 + 2] = s;
    starVel[i*2 + 0] = 0;
    starVel[i*2 + 1] = 0;
  }

  // robo (player) 
  let robot = { x: 0.0, y: -0.7, size: 10.0, speed: 0.9 };
  let leftDown = false, rightDown = false;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'a' || e.key === 'A') leftDown = true;
    if (e.key === 'd' || e.key === 'D') rightDown = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'a' || e.key === 'A') leftDown = false;
    if (e.key === 'd' || e.key === 'D') rightDown = false;
  });

  const starBuffer = gl.createBuffer();

  const aPosPoints = gl.getAttribLocation(pointsProgram, 'aPosition');
  const aSizePoints = gl.getAttribLocation(pointsProgram, 'aSize');
  const uTimePoints = gl.getUniformLocation(pointsProgram, 'uTime');
  const uCameraPoints = gl.getUniformLocation(pointsProgram, 'uCamera');
  const uColorPoints = gl.getUniformLocation(pointsProgram, 'uColor');

  let hole = {
    cx: canvas.width * 0.5,
    cy: canvas.height * 0.5,
    size: Math.min(canvas.width, canvas.height) * 0.06, // start smaller
    targetSize: Math.min(canvas.width, canvas.height) * 0.55
  };

  let cameraProgress = 0.0;
  const cameraStartDelay = 2.5; // wait seconds before camera moves
  const cameraMoveDuration = 12.0; // LONGER: seconds to reach front view (slower)

  let start = performance.now();

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0,0,canvas.width,canvas.height);
    hole.cx = canvas.width * 0.5;
    hole.cy = canvas.height * 0.5;
  });
  gl.viewport(0,0,canvas.width,canvas.height);

  function ndcToPixel(x,y){
    const px = (x * 0.5 + 0.5) * canvas.width;
    const py = (y * 0.5 + 0.5) * canvas.height;
    return [px, py];
  }

  function frame(now){
    const t = (now - start) * 0.001;

    const desired = hole.targetSize;
    hole.size += (desired - hole.size) * 0.0025; // much slower

    if (t > cameraStartDelay){
      const moveT = Math.min(1.0, (t - cameraStartDelay) / cameraMoveDuration);
      cameraProgress = moveT * moveT * (3 - 2*moveT); // smoothstep-like
    }

    if (leftDown) robot.x -= robot.speed * 0.016;
    if (rightDown) robot.x += robot.speed * 0.016;
    robot.x = Math.max(-0.95, Math.min(0.95, robot.x));

    let holeNdcX = (hole.cx / canvas.width) * 2.0 - 1.0;
    let holeNdcY = (hole.cy / canvas.height) * 2.0 - 1.0;
    const pxToNdc = 2.0 / canvas.height;
    const holeRadiusNdc = hole.size * pxToNdc;

    const influenceNdc = holeRadiusNdc * (1.5 + 2.0 * cameraProgress);

    const dt = 0.016;
    for (let i=0; i<starCount; i++){
      let sx = stars[i*3 + 0];
      let sy = stars[i*3 + 1];
      let dx = holeNdcX - sx;
      let dy = holeNdcY - sy;
      let dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < influenceNdc){
        let pull = (1.0 - dist / influenceNdc) * (0.35 + 2.2 * (hole.size / Math.max(canvas.width, canvas.height)));
        pull *= (0.6 + 1.4 * cameraProgress); // stronger as camera progresses
        starVel[i*2 + 0] += dx * pull * dt;
        starVel[i*2 + 1] += dy * pull * dt;
      }

      starVel[i*2 + 0] *= 0.994;
      starVel[i*2 + 1] *= 0.994;

      sx += starVel[i*2 + 0] * dt;
      sy += starVel[i*2 + 1] * dt;

      if (Math.hypot(holeNdcX - sx, holeNdcY - sy) < holeRadiusNdc * 0.22){
        const angle = Math.random() * Math.PI * 2;
        const r = 0.9 + Math.random() * 0.12;
        sx = Math.cos(angle) * r;
        sy = Math.sin(angle) * r;
        starVel[i*2 + 0] = 0;
        starVel[i*2 + 1] = 0;
      }

      const compress = 1.0 - 0.45 * cameraProgress;
      sy = sy * compress + (sy - holeNdcY) * (cameraProgress * 0.20);

      stars[i*3 + 0] = sx;
      stars[i*3 + 1] = sy;

      const baseSize = 1.2 + (Math.abs(sx) + Math.abs(sy)) * 0.4;
      stars[i*3 + 2] = baseSize * (0.7 + 1.2 * (1.0 - Math.min(1.0, dist / (influenceNdc + 0.0001))));
    }

    const rx = robot.x;
    const ry = robot.y;
    let dxr = holeNdcX - rx;
    let dyr = holeNdcY - ry;
    let dr = Math.hypot(dxr,dyr);
    if (dr < influenceNdc * 1.35){
      const pullr = (1.0 - dr / (influenceNdc*1.35)) * 0.45 * (0.8 + cameraProgress);
      robot.x -= (dxr * pullr) * dt * 0.6;
      robot.y -= (dyr * pullr) * dt * 0.6;
      robot.y += 0.22 * dt; 
    } else {
      robot.y += 0.18 * dt;
    }
    robot.x = Math.max(-0.98, Math.min(0.98, robot.x));
    robot.y = Math.max(-0.98, Math.min(0.98, robot.y));

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(quadProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(quadPosLoc);
    gl.vertexAttribPointer(quadPosLoc, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(uTimeQuad, t);
    gl.uniform2f(uResQuad, canvas.width, canvas.height);
    gl.uniform2f(uHoleCenter, hole.cx, hole.cy);
    const growth = 1.0 + 0.12 * Math.sin(t * 0.12);
    gl.uniform1f(uHoleSize, hole.size * growth);
    gl.uniform1f(uCamera, cameraProgress);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.useProgram(pointsProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, stars, gl.DYNAMIC_DRAW);

    gl.enableVertexAttribArray(aPosPoints);
    gl.vertexAttribPointer(aPosPoints, 2, gl.FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(aSizePoints);
    gl.vertexAttribPointer(aSizePoints, 1, gl.FLOAT, false, 12, 8);

    gl.uniform1f(uTimePoints, t);
    gl.uniform1f(uCameraPoints, cameraProgress);
    gl.uniform3f(uColorPoints, 0.95, 0.95, 1.0);

    gl.drawArrays(gl.POINTS, 0, starCount);

    const robotBuf = new Float32Array([robot.x, robot.y, robot.size]);
    gl.bufferData(gl.ARRAY_BUFFER, robotBuf, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aPosPoints, 2, gl.FLOAT, false, 12, 0);
    gl.vertexAttribPointer(aSizePoints, 1, gl.FLOAT, false, 12, 8);
    gl.uniform3f(uColorPoints, 1.0, 0.85, 0.2);
    gl.drawArrays(gl.POINTS, 0, 1);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

window.onload = main;

