const vertexSrc = `
attribute vec2 aPos;
void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const fragmentSrc = `precision mediump float;

uniform vec2 uResolution;
uniform float uTime;


// ===============================
// GRADIENTE + ESTRELAS
// ===============================

float rand(vec2 p){
    return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);
}

float star(vec2 uv, float time){
    float density = 220.0;
    vec2 g = uv * density;
    vec2 id = floor(g);
    vec2 f  = fract(g);

    float r1 = rand(id);
    vec2 pos = vec2(r1, rand(id+23.7));

    float d = length(f - pos);
    float size = 0.003 + 0.006 * rand(id+78.4);

    float tw = 0.5 + 0.5*sin(time*(1.0+3.0*rand(id+99.0)));

    return smoothstep(size, size*0.2, d) * tw;
}

float stars(vec2 uv, float t){
    float s = 0.0;
    for(int ox=-1; ox<=1; ox++){
        for(int oy=-1; oy<=1; oy++){
            vec2 offs = vec2(float(ox), float(oy)) / 220.0;
            s += star(uv + offs, t);
        }
    }
    return s;
}

vec3 gradient(vec2 uv){
    vec3 purple = vec3(0.45, 0.15, 0.6);
    vec3 blue   = vec3(0.02, 0.06, 0.18);
    return mix(blue, purple, uv.y);
}


// ===============================
// BURACO NEGRO — CORRETO (PRETO DENTRO)
// ===============================

struct BH {
    float mask;     // 0 = DENTRO (preto), 1 = FORA (mostrar fundo)
    float photon;   // anel
};

BH blackHole(vec2 p, float t){
    float r = length(p);

    float growth = 1.0 - exp(-t*0.1);
    float R = mix(0.08, 0.55, growth);

    // --- MÁSCARA CORRETA ---
    // Queremos:
    // r < R  =>  mask = 0 (preto)
    // r > R  =>  mask = 1 (normal)
    float mask = step(R, r);

    // photon ring
    float pr = smoothstep(R+0.01, R, r) - smoothstep(R, R-0.01, r);

    return BH(mask, pr);
}


// ===============================
// MAIN
// ===============================

void main(){
    vec2 uv = gl_FragCoord.xy / uResolution;

    vec3 bg = gradient(uv);
    bg += vec3(1.0, 0.95, 0.9) * stars(uv, uTime);

    vec2 p = uv - 0.5;
    p.x *= uResolution.x / uResolution.y;

    BH bh = blackHole(p, uTime);

    vec3 photonColor = vec3(0.85, 0.75, 1.0);

    vec3 color = bg;

    // anel do buraco negro
    color += photonColor * bh.photon;

    // APLICA O BURACO NEGRO:
    // mask = 1 fora → mostra cena
    // mask = 0 dentro → preto
    color = mix(vec3(0.0), color, bh.mask);

    gl_FragColor = vec4(color, 1.0);
}

`;


// =======================================
// WebGL Bootstrap
// =======================================
function createShader(gl, type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
        console.error(gl.getShaderInfoLog(s));
        console.log(src);
    }
    return s;
}

function createProgram(gl, vs, fs){
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)){
        console.error(gl.getProgramInfoLog(p));
    }
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
    window.addEventListener("resize", resize);
    resize();

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
