const quadVS = `
    attribute vec2 aPos;

    void main(){
        gl_Position = vec4(aPos, 0.0, 1.0);
    }
`;

const quadFS = `
    precision mediump float;
    uniform vec2 uResolution;

    void main(){
        vec3 purple = vec3(0.2, 0.0, 0.3);
        vec3 blue   = vec3(0.0, 0.05, 0.15);

        float gradient = gl_FragCoord.y / uResolution.y;

        vec3 color = mix(blue, purple, gradient);

        gl_FragColor = vec4(color, 1.0);
    }
`;

//shader das estrelas
const starVS = `
    attribute vec2 aPosition;

    void main(){
        gl_Position = vec4(aPosition, 0.0, 1.0);
        gl_PointSize = 2.5;
    }
`;

const starFS = `
    precision mediump float;
    uniform float uTime;

    void main(){
        float t = uTime * 4.0;
        float twinkle = 0.5 + 0.5 * sin(t + gl_FragCoord.x * 0.1 + gl_FragCoord.y * 0.1);

        gl_FragColor = vec4(vec3(twinkle), 1.0);
    }
`;

function loadShader(gl, type, source){
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
        console.error("Erro ao compilar shader:", gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function createProgram(gl, vs, fs){
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)){
        console.error("Erro ao linkar:", gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

function main(){
    const canvas = document.getElementById("glCanvas");
    const gl = canvas.getContext("webgl");

    if (!gl){
        alert("WebGL não suportado");
        return;
    }

    const quadProgram = createProgram(
        gl,
        loadShader(gl, gl.VERTEX_SHADER, quadVS),
        loadShader(gl, gl.FRAGMENT_SHADER, quadFS)
    );

    const quadVertices = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1
    ]);

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    const quadPos = gl.getAttribLocation(quadProgram, "aPos");
    const uResQuad = gl.getUniformLocation(quadProgram, "uResolution");

    //programa para estrelas
    const starProgram = createProgram(
        gl,
        loadShader(gl, gl.VERTEX_SHADER, starVS),
        loadShader(gl, gl.FRAGMENT_SHADER, starFS)
    );

    //criar estrelas aleatórias
    const starCount = 200;
    const stars = [];
    for (let i = 0; i < starCount; i++){
        stars.push(Math.random() * 2 - 1, Math.random() * 2 - 1);
    }

    const starBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(stars), gl.STATIC_DRAW);

    const starPos = gl.getAttribLocation(starProgram, "aPosition");
    const uTimeStar = gl.getUniformLocation(starProgram, "uTime");

    //loop de render
    function render(time){
        time *= 0.001;

        gl.clear(gl.COLOR_BUFFER_BIT);

        //desenhar o fundo
        gl.useProgram(quadProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);

        gl.enableVertexAttribArray(quadPos);
        gl.vertexAttribPointer(quadPos, 2, gl.FLOAT, false, 0, 0);

        gl.uniform2f(uResQuad, canvas.width, canvas.height);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        //desenhar estrelas
        gl.useProgram(starProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);

        gl.enableVertexAttribArray(starPos);
        gl.vertexAttribPointer(starPos, 2, gl.FLOAT, false, 0, 0);

        gl.uniform1f(uTimeStar, time);

        gl.drawArrays(gl.POINTS, 0, starCount);

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

window.onload = main;
