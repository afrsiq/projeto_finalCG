// main.js
// Buraco frontal animado + fundo gradiente estrelado

const vertexSrc = `
attribute vec2 aPos;
void main(){
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const fragmentSrc = `
precision mediump float;

uniform vec2 uResolution;
uniform float uTime;

// ---------------------------
// GRADIENTE + ESTRELAS
// ---------------------------
float rand(vec2 p){
    return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);
}

float star(vec2 uv, float t){
    float density = 220.0;
    vec2 gv = uv * density;
    vec2 id = floor(gv);
    vec2 f  = fract(gv);

    vec2 pos = vec2(rand(id), rand(id+22.0));
    float d = length(f - pos);

    float size = 0.002 + 0.004 * rand(id+88.0);
    float tw = 0.5 + 0.5*sin(t * (1.0 + 3.0 * rand(id+55.0)));

    return smoothstep(size, size*0.2, d) * tw;
}

float stars(vec2 uv, float t){
    float s = 0.0;
    for(int ox=-1; ox<=1; ox++){
        for(int oy=-1; oy<=1; oy++){
            s += star(uv + vec2(ox,oy)/220.0, t);
        }
    }
    return s;
}

vec3 gradient(vec2 uv){
    vec3 purple = vec3(0.50, 0.20, 0.65);
    vec3 blue   = vec3(0.03, 0.07, 0.18);
    return mix(blue, purple, uv.y);
}

// ---------------------------
// BURACO ANIMADO VISTO DE FRENTE
// ---------------------------
float ellipseMask(vec2 p, float a, float b){
    return smoothstep(1.0, 0.97, (p.x*p.x)/(a*a) + (p.y*p.y)/(b*b));
}

float innerShade(vec2 p, float a, float b){
    float d = clamp(length(vec2(p.x/a, p.y/b)), 0.0, 1.0);
    float topLight = clamp((p.y/b + 1.0)*0.5, 0.0, 1.0);
    float shade = mix(0.0, topLight*0.35, (1.0 - d));
    return shade;
}

void main(){
    vec2 uv = gl_FragCoord.xy / uResolution.xy;

    // fundo
    vec3 bg = gradient(uv);
    bg += vec3(1.0, 0.95, 0.9) * stars(uv, uTime);

    // -------------------------------------------------
    // POSIÇÃO DO BURACO: mais perto da borda inferior
    // -------------------------------------------------
    vec2 p = uv - vec2(0.5, 0.25);   // antes era 0.5,0.5
    p.x *= uResolution.x / uResolution.y;

    // -------------------------------------------------
    // ANIMAÇÃO DO BURACO:
    // pulsação suave de tamanho
    // -------------------------------------------------
    float pulse = 0.02 * sin(uTime * 1.4);

    float a = 0.35 + pulse;   // raio horizontal
    float b = 0.12 + pulse*0.5; // raio vertical

    // máscara do buraco
    float m = ellipseMask(p, a, b);

    // sombra interna animada
    float sh = innerShade(p, a, b) + 0.05*sin(uTime*0.8);

    vec3 holeColor = vec3(sh);

    vec3 color = mix(bg, holeColor, m);

    // borda iluminada
    float edge = smoothstep(1.03, 1.00, (p.x*p.x)/(a*a) + (p.y*p.y)/(b*b));
    color += vec3(0.65, 0.55, 0.85) * edge * 0.4;

    gl_FragColor = vec4(color, 1.0);
}
`;

// ------------------------
// WebGL bootstrap
// ------------------------
function createShader(gl, type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
    console.error(gl.getShaderInfoLog(s));
  }
  return s;
}

function createProgram(gl, vs, fs){
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  return p;
}

function main(){
  const canvas = document.getElementById("glCanvas");
  const gl = canvas.getContext("webgl");

  function resize(){
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    gl.viewport(0,0,canvas.width,canvas.height);
  }
  resize();
  window.onresize = resize;

  const vs = createShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  const program = createProgram(gl, vs, fs);
  gl.useProgram(program);

  const quad = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, "uResolution");
  const uTime = gl.getUniformLocation(program, "uTime");

  let start = performance.now();
  function render(){
    const t = (performance.now() - start) * 0.001;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  render();
}

window.onload = main;
