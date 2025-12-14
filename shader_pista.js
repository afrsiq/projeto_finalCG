//vista superior
const fragmentTop = `
precision mediump float;
uniform vec2 uResolution;
uniform float uTime;     

float rand(vec2 p){
  return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); 
}

float star(vec2 uv, float time){
    float density = 220.0;
    vec2 g = uv * density;
    vec2 id = floor(g);
    vec2 f = fract(g);
    vec2 pos = vec2(rand(id), rand(id+23.7));
    float d = length(f - pos);
    float size = 0.003 + 0.006*rand(id+78.4);
    // Cintilação da estrela
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


struct BH{ float mask; float photon; }; 

BH blackHole(vec2 p, float t){
    float r = length(p);
    float growth = 1.0 - exp(-t*0.02); 
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

//vista frontal
const fragmentFront = `
precision mediump float;
uniform vec2 uResolution;
uniform float uTime;

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
float ellipseMask(vec2 p, float a, float b){
    return smoothstep(1.0, 0.98, (p.x*p.x)/(a*a) + (p.y*p.y)/(b*b));
}
float innerShade(vec2 p, float a, float b){
    float d = clamp(length(vec2(p.x/a, p.y/b)), 0.0, 1.0);
    float topLight = clamp((p.y/b + 1.0)*0.5, 0.0, 1.0);
    return mix(0.0, topLight*0.35, (1.0 - d));
}
float floorTrack(vec2 p, float yStart, float yEnd, float wStart, float wEnd) {
    if (p.y < yStart || p.y > yEnd) return 0.0;
    float t = (p.y - yStart) / (yEnd - yStart);
    float currentWidth = mix(wStart, wEnd, t);
    float mask = step(abs(p.x), currentWidth * 0.5);
    float grid = step(0.95, fract(p.x * 15.0 / currentWidth)) * 0.2; 
    mask *= (1.0 - grid); 
    return mask;
}
void main(){
    vec2 uv = gl_FragCoord.xy/uResolution.xy;
    vec3 bg = gradient(uv) + vec3(1.0,0.95,0.9)*stars(uv,uTime);
    vec2 p = uv - vec2(0.5, 0.35); 
    p.x *= uResolution.x / uResolution.y;
    float pulse = 0.02*sin(uTime*1.4);
    float a = 0.40 + pulse; 
    float b = 0.12 + pulse*0.5; 
    float trackYStart = 0.0; 
    float trackYEnd = 0.5; 
    float track = floorTrack(p, trackYStart, trackYEnd, a*2.0, a*0.1);
    vec3 trackColor = vec3(0.05, 0.0, 0.1); 
    vec3 color = mix(bg, trackColor, track);
    float m = ellipseMask(p,a,b);
    float sh = innerShade(p,a,b) + 0.05*sin(uTime*0.8);
    vec3 holeColor = vec3(sh); 
    color = mix(color, holeColor, m);
    float dist = (p.x*p.x)/(a*a)+(p.y*p.y)/(b*b);
    float edge = smoothstep(1.05, 1.0, dist) * smoothstep(0.9, 1.0, dist);
    color += vec3(0.65,0.55,1.0)*edge;
    gl_FragColor = vec4(color,1.0);
}
`;
const vertexSrc = `
attribute vec2 aPos; // Posição do vértice (quadrado)
void main(){
  gl_Position = vec4(aPos, 0.0, 1.0); // Transforma em um quadrado 2D
}
`;

function createShader(gl, type, source){
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
        console.error((type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment') + ' Shader Error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}
function createProgram(gl, vsSource, fsSource){
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)){
        console.error('Program Link Error:', gl.getProgramInfoLog(prog));
        return null;
    }
    return prog;
}

function useCurrentProgram(gl, prog){
    gl.useProgram(prog);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    return {
        uRes: gl.getUniformLocation(prog, "uResolution"),
        uTime: gl.getUniformLocation(prog, "uTime")
    };
}
function main(){
    const canvas = document.getElementById("glCanvas");
    const gl = canvas.getContext("webgl");

    if (!gl) {
        alert("Seu navegador não suporta WebGL");
        return;
    }

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

    const quad = new Float32Array([ -1,-1, 1,-1, -1,1, 1,1 ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    let program = createProgram(gl, vertexSrc, fragmentTop);
    let startTime = performance.now(); 
    let uniforms = useCurrentProgram(gl, program);

    const btn = document.getElementById("startBtn");
    btn.onclick = () => {
        program = createProgram(gl, vertexSrc, fragmentFront);
        uniforms = useCurrentProgram(gl, program);
        startTime = performance.now(); 
        btn.classList.add("hidden");
    };

    function render(){
        let t = (performance.now() - startTime) * 0.001;

        gl.useProgram(program);
        gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
        gl.uniform1f(uniforms.uTime, t);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        requestAnimationFrame(render);
    }

    render();
}

window.onload = main;