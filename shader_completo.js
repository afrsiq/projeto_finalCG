// main.js
// Permite alternar entre dois shaders: visto de CIMA e visto de FRENTE

// ---------------------------------------------------------------------------
// SHADER — VISTO DE CIMA (versão anterior corrigida)
// ---------------------------------------------------------------------------
const fragmentTop = `
precision mediump float;
uniform vec2 uResolution;
uniform float uTime;

// ----- fundo -----
float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float star(vec2 uv, float time){
    float density = 220.0;
    vec2 g = uv * density;
    vec2 id = floor(g);
    vec2 f = fract(g);
    vec2 pos = vec2(rand(id), rand(id+23.7));
    float d = length(f - pos);
    float size = 0.003 + 0.006*rand(id+78.4);
    float tw = 0.5 + 0.5*sin(time*(1.0+3.0*rand(id+99.0)));
    return smoothstep(size, size*0.2, d) * tw;
}
float stars(vec2 uv, float t){
    float s=0.0;
    for(int ox=-1; ox<=1; ox++){
       for(int oy=-1; oy<=1; oy++){
         s += star(uv + vec2(ox,oy)/220.0, t);
       }
    }
    return s;
}
vec3 gradient(vec2 uv){
    vec3 purple = vec3(0.45, 0.15, 0.6);
    vec3 blue   = vec3(0.02, 0.06, 0.18);
    return mix(blue, purple, uv.y);
}

// ----- buraco -----
struct BH{ float mask; float photon; };
BH blackHole(vec2 p, float t){
    float r = length(p);
    float growth = 1.0 - exp(-t*0.1);
    float R = mix(0.08, 0.55, growth);
    float mask = step(R, r);
    float pr = smoothstep(R+0.01, R, r) - smoothstep(R, R-0.01, r);
    return BH(mask, pr);
}

void main(){
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec3 bg = gradient(uv);
    bg += vec3(1.0, 0.95, 0.9) * stars(uv, uTime);

    vec2 p = uv - 0.5;
    p.x *= uResolution.x/uResolution.y;

    BH bh = blackHole(p, uTime);
    vec3 col = bg + vec3(0.85, 0.75, 1.0)*bh.photon;
    col = mix(vec3(0.0), col, bh.mask);

    gl_FragColor = vec4(col, 1.0);
}
`;


// ---------------------------------------------------------------------------
// SHADER — VISTO DE FRENTE (nova versão animada)
// ---------------------------------------------------------------------------
const fragmentFront = `
precision mediump float;
uniform vec2 uResolution;
uniform float uTime;

// ----- estrelas -----
float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float star(vec2 uv, float t){
    float density=220.0;
    vec2 gv=uv*density;
    vec2 id=floor(gv);
    vec2 f=fract(gv);
    vec2 pos=vec2(rand(id), rand(id+22.0));
    float d=length(f-pos);
    float size=0.002+0.004*rand(id+88.0);
    float tw=0.5+0.5*sin(t*(1.0+3.0*rand(id+55.0)));
    return smoothstep(size,size*0.2,d)*tw;
}
float stars(vec2 uv,float t){
    float s=0.0;
    for(int ox=-1;ox<=1;ox++){
      for(int oy=-1;oy<=1;oy++){
        s+=star(uv+vec2(ox,oy)/220.0,t);
      }
    }
    return s;
}

vec3 gradient(vec2 uv){
    vec3 purple=vec3(0.50,0.20,0.65);
    vec3 blue=vec3(0.03,0.07,0.18);
    return mix(blue,purple,uv.y);
}

// ----- buraco frontal -----
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
    vec2 uv = gl_FragCoord.xy/uResolution.xy;
    vec3 bg = gradient(uv)+ vec3(1.0,0.95,0.9)*stars(uv,uTime);

    vec2 p = uv - vec2(0.5,0.25);
    p.x *= uResolution.x / uResolution.y;

    float pulse = 0.02*sin(uTime*1.4);
    float a = 0.35 + pulse;
    float b = 0.12 + pulse*0.5;

    float m = ellipseMask(p,a,b);
    float sh = innerShade(p,a,b) + 0.05*sin(uTime*0.8);
    vec3 hole = vec3(sh);

    vec3 color = mix(bg, hole, m);

    float edge = smoothstep(1.03,1.00,(p.x*p.x)/(a*a)+(p.y*p.y)/(b*b));
    color += vec3(0.65,0.55,0.85)*edge*0.4;

    gl_FragColor = vec4(color,1.0);
}
`;


// ---------------------------------------------------------------------------
// VERTEX SHADER (igual para ambos)
// ---------------------------------------------------------------------------
const vertexSrc = `
attribute vec2 aPos;
void main(){
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;


// ---------------------------------------------------------------------------
// WEBGL BOOTSTRAP — função para criar programa com um fragment shader
// ---------------------------------------------------------------------------
function createProgram(gl, vsSource, fsSource){
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSource);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSource);
  gl.compileShader(fs);

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  return prog;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
function main(){
  const canvas = document.getElementById("glCanvas");
  const gl = canvas.getContext("webgl");

  // Resize canvas
  function resize(){
    const dpr = devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    gl.viewport(0,0,canvas.width,canvas.height);
  }
  window.onresize = resize;
  resize();

  // Create buffers
  const quad = new Float32Array([ -1,-1, 1,-1, -1,1, 1,1 ]);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  // START IN "TOP VIEW"
  let program = createProgram(gl, vertexSrc, fragmentTop);

  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  let uRes = gl.getUniformLocation(program, "uResolution");
  let uTime = gl.getUniformLocation(program, "uTime");

  // BUTTON SWITCHES TO FRONT VIEW
  document.getElementById("startBtn").onclick = () => {
    program = createProgram(gl, vertexSrc, fragmentFront);
    gl.useProgram(program);

    const aPos2 = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos2);
    gl.vertexAttribPointer(aPos2, 2, gl.FLOAT, false, 0, 0);

    uRes = gl.getUniformLocation(program, "uResolution");
    uTime = gl.getUniformLocation(program, "uTime");
  };

  let start = performance.now();
  function render(){
    let t = (performance.now() - start) * 0.001;

    gl.useProgram(program);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  render();
}

window.onload = main;
