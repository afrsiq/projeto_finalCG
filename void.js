const vsSource = `
attribute vec4 aVertexPosition;
void main(){
    gl_Position = aVertexPosition;
}
`;

const fsSource = `
precision mediump float;

uniform float uTime;
uniform vec2 uResolution;

void main(){
    vec2 uv = gl_FragCoord.xy / uResolution.xy;  
    uv = uv * 2.0 - 1.0;          
    uv.x *= uResolution.x / uResolution.y;  

    float r = length(uv);

    float blackHoleSize = 0.2 + 0.15 * sin(uTime * 0.2);

    float ring = smoothstep(blackHoleSize + 0.05, blackHoleSize, r);

    float dist = 0.03 / (abs(r - blackHoleSize) + 0.01);
    vec3 glow = vec3(0.4, 0.1, 0.6) * dist;

    vec3 color = mix(glow, vec3(0.0), ring);

    gl_FragColor = vec4(color, 1.0);
}
`;

function loadShader(gl, type, source){
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
        console.error("Shader error:", gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function main(){
    const canvas = document.getElementById("glCanvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const gl = canvas.getContext("webgl");

    const vShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vShader);
    gl.attachShader(shaderProgram, fShader);
    gl.linkProgram(shaderProgram);

    gl.useProgram(shaderProgram);

    const positions = [
        -1,-1, 1,-1, -1,1, 1,1
    ];

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const timeLoc = gl.getUniformLocation(shaderProgram, "uTime");
    const resLoc = gl.getUniformLocation(shaderProgram, "uResolution");

    let start = performance.now();

    function draw(){
        const t = (performance.now() - start) * 0.001;

        gl.uniform1f(timeLoc, t);
        gl.uniform2f(resLoc, canvas.width, canvas.height);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        requestAnimationFrame(draw);
    }

    draw();
}

window.onload = main;

