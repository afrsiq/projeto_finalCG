import { ObstacleManager } from './obstaculos.js';

const vertexShaderSource = `
  attribute vec3 aPosition;
  attribute vec2 aTexCoord; 

  uniform mat4 uModelMatrix;
  uniform mat4 uViewMatrix;
  uniform mat4 uProjectionMatrix;

  varying vec2 vTexCoord;   

  void main() {
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
    vTexCoord = aTexCoord;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
            
  varying vec2 vTexCoord;
  uniform float uOffset;    
  uniform sampler2D uSampler; 

  void main() {
    // AJUSTE DE PROPORÇÃO
    vec2 uv = vTexCoord * vec2(3.0, 10.0); 
                    
    // MOVIMENTO
    uv.y += uOffset; 

    vec4 texColor = texture2D(uSampler, uv);

    // FOG SUAVE
    float fogDensity = 0.04; 
    float fogFactor = 1.0 / (gl_FragCoord.w * fogDensity);
    
    vec3 fogColor = vec3(0.05, 0.0, 0.1); 
    
    vec3 finalColor = mix(fogColor, texColor.rgb, clamp(fogFactor, 0.0, 1.0));

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = createProgramInternal(gl, vShader, fShader);
  return program;
}

// Helper para linkar programa
function createProgramInternal(gl, vShader, fShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

// Geometria do plano
function Vertices_Plano() {
  const vertices = new Float32Array([
    -10.0, -2.0, -200.0, 
     10.0, -2.0, -200.0, 
     10.0, -2.0,   10.0, 
    -10.0, -2.0,   10.0 
  ]);

  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

  const uvs = new Float32Array([
    0.0, 1.0, 
    1.0, 1.0, 
    1.0, 0.0, 
    0.0, 0.0
  ]);

  return { vertices, indices, uvs };
}

function createFloorBuffers(gl) {
  const geo = Vertices_Plano();
  
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, geo.vertices, gl.STATIC_DRAW);

  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);

  const tbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tbo);
  gl.bufferData(gl.ARRAY_BUFFER, geo.uvs, gl.STATIC_DRAW);

  return { vbo, ibo, tbo, count: geo.indices.length };
}

function carregar_textura(gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));

  const image = new Image();
  image.src = url;
  image.crossOrigin = "anonymous";
  
  image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const ext = gl.getExtension("EXT_texture_filter_anisotropic") || 
                gl.getExtension("MOZ_EXT_texture_filter_anisotropic") || 
                gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
    
    if (ext) {
        const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, max);
    }

    gl.generateMipmap(gl.TEXTURE_2D);
  };

  return texture;
}

function main() {
  const canvas = document.getElementById("glCanvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const gl = canvas.getContext("webgl");

  if (!gl) return;

  // Setup Pista
  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.05, 0.0, 0.1, 1.0);

  const loc = {
    aPos: gl.getAttribLocation(program, "aPosition"),
    aTex: gl.getAttribLocation(program, "aTexCoord"),
    uModel: gl.getUniformLocation(program, "uModelMatrix"),
    uView: gl.getUniformLocation(program, "uViewMatrix"),
    uProj: gl.getUniformLocation(program, "uProjectionMatrix"),
    uOffset: gl.getUniformLocation(program, "uOffset"),
    uSampler: gl.getUniformLocation(program, "uSampler")
  };

  const chao = createFloorBuffers(gl);
  const texture = carregar_textura(gl, "textura_pista.jpg");

  // Setup Obstáculos
  const obstaculos = new ObstacleManager(gl);

  // Variáveis de Câmera 
  let P0 = [0.0, 5.0, 15.0];
  let Pref = [0.0, 0.0, -50.0];
  let V = [0.0, 1.0, 0.0];


  // Variáveis jogo

  //Velocidade da textura
  let trackOffset = 0.0;
  const speed = 2.0; 
  
  // Velocidade obstáculos
  const gameSpeed = 21.5; 

  let then = 0;

  function drawScene(now) {
    now *= 0.001;
    const deltaTime = now - then;
    then = now;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Atualiza Pista
    trackOffset -= speed * deltaTime;
    
    // Atualiza Obstáculos
    obstaculos.update(deltaTime, gameSpeed);

    const aspect = gl.canvas.width / gl.canvas.height;
    
    // Calcula View e Proj uma vez para usar em todos os objetos
    let view = m4.setViewingMatrix(P0, Pref, V);
    
    const fov = 45 * Math.PI / 180;
    const zNear = 0.1;
    const zFar = 300.0;
    const f = 1.0 / Math.tan(fov / 2);
   
    let proj = [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (zFar + zNear) / (zNear - zFar), -1,
        0, 0, (2 * zFar * zNear) / (zNear - zFar), 0
    ];
    
    const projFloat = new Float32Array(proj);

    gl.useProgram(program); 
    
    gl.uniform1f(loc.uOffset, trackOffset);
    gl.uniformMatrix4fv(loc.uModel, false, m4.identity());
    gl.uniformMatrix4fv(loc.uView, false, view);
    gl.uniformMatrix4fv(loc.uProj, false, projFloat);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(loc.uSampler, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, chao.vbo);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, chao.tbo);
    gl.enableVertexAttribArray(loc.aTex);
    gl.vertexAttribPointer(loc.aTex, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, chao.ibo);
    gl.drawElements(gl.TRIANGLES, chao.count, gl.UNSIGNED_SHORT, 0);

    obstaculos.render(view, projFloat);

    requestAnimationFrame(drawScene);
  }
  requestAnimationFrame(drawScene);
}

window.onload = main;
window.onresize = () => {
    const c = document.getElementById("glCanvas");
    c.width = window.innerWidth; c.height = window.innerHeight;
};