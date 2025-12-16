const m4 = window.m4;

const vsSource = `

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

const fsSource = `

    precision mediump float;

    varying vec3 vNormal;

    uniform vec3 uColor;

    void main() {

        // Luz simples e cores vibrantes (sujeito a alteração)

        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));

        float diff = max(dot(normalize(vNormal), lightDir), 0.0);

        float ambient = 0.6;

        float light = min(ambient + diff, 1.0);

        gl_FragColor = vec4(uColor * light, 1.0);

    }

`;

export class ObstacleManager {
  constructor(gl) {
    this.gl = gl;

    this.program = this.createProgram(gl, vsSource, fsSource);

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

    // Intervalo de spawn dos obstáculos

    this.spawnInterval = 1.5;
  }

  update(dt, speed) {
    // Spawning

    this.spawnTimer += dt;

    if (this.spawnTimer > this.spawnInterval) {
      this.spawn();

      this.spawnTimer = 0;
    }

    // Movimento

    this.list.forEach((obs) => {
      obs.z += speed * dt;
    });

    // Remove obstáculos que já passaram da câmera

    this.list = this.list.filter((obs) => obs.z < 10.0);
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

        let model = m4.identity();

        model = m4.translate(model, obs.x, obs.y, obs.z);

        model = m4.scale(model, 3.0, 3.0, 3.0);

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

    const baseModel = m4.translate(m4.identity(), obs.x, obs.y, obs.z);

    // modelagem

    // suporte esquerdo

    let mLeft = m4.translate(baseModel, -1.8, 1.5, 0.0);

    mLeft = m4.scale(mLeft, 0.5, 3.0, 0.5);

    gl.uniformMatrix4fv(this.loc.uModel, false, mLeft);

    gl.uniform3fv(this.loc.uColor, obs.color);

    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);

    //suporte direito

    let mRight = m4.translate(baseModel, 1.8, 1.5, 0.0);

    mRight = m4.scale(mRight, 0.5, 3.0, 0.5);

    gl.uniformMatrix4fv(this.loc.uModel, false, mRight);

    gl.uniform3fv(this.loc.uColor, obs.color);

    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);

    //laser

    let mLaser = m4.translate(baseModel, 0.0, 2.0, 0.0);

    mLaser = m4.scale(mLaser, 3.6, 0.15, 0.15);

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
    const lanes = [-2.5, 0.0, 2.5];

    const laneX = lanes[Math.floor(Math.random() * lanes.length)];

    const types = ["cubo", "piramide", "paralelepipedo"];

    const type = types[Math.floor(Math.random() * types.length)];

    let obs = {
      x: laneX,

      y: -0.5,

      z: -65.0,

      type: type,

      color: [Math.random(), Math.random(), Math.random()],

      scale: [1.0, 1.0, 1.0],
    };

    if (type === "cubo") {
      obs.scale = [2.0, 2.0, 2.0];
    } else if (type === "piramide") {
      obs.scale = [2.0, 2.0, 2.0];
    } else if (type === "paralelepipedo") {
      obs.scale = [2.0, 2.0, 10.0]; // 10 unidades de comprimento no Z!
    } else if (type === "laser") {
      obs.y = 0.0;
      obs.color = [0.3, 0.3, 0.3];
    }

    this.list.push(obs);
  }

  createBox(gl) {
    // Cubo unitário 1x1x1 centrado na origem

    // Usamos isso para criar cubos, retângulos e lasers via escala

    const vertices = new Float32Array([
      // Frente

      -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5,

      -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,

      // Trás

      -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5,

      -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,

      // Topo

      -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5,

      -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,

      // Baixo

      -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,

      -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,

      // Dir

      0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5,

      0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,

      // Esq

      -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5,

      -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
    ]);

    // Normais simples (para cada face, todos os vertices apontam pro mesmo lado)

    const normals = new Float32Array([
      // Frente (Z+)

      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,

      // Trás (Z-)

      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,

      // Topo (Y+)

      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,

      // Baixo (Y-)

      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,

      // Dir (X+)

      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,

      // Esq (X-)

      -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
    ]);

    const vbo = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const nbo = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, nbo);

    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

    return { vbo, nbo, count: vertices.length / 3 };
  }

  createPyramid(gl) {
    // Pirâmide base quadrada

    const vertices = new Float32Array([
      // Frente

      0.0, 0.5, 0.0, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5,

      // Direita

      0.0, 0.5, 0.0, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5,

      // Trás

      0.0, 0.5, 0.0, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5,

      // Esquerda

      0.0, 0.5, 0.0, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5,

      // Base (quadrada feita de 2 triangulos)

      -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,

      -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    ]);

    // Normais simplificadas (apontando pra cima/lados)

    const normals = new Float32Array(vertices.length);

    for (let i = 0; i < vertices.length; i += 3) {
      // Vetor normalizado da posição

      let len = Math.sqrt(
        vertices[i] ** 2 + vertices[i + 1] ** 2 + vertices[i + 2] ** 2
      );

      normals[i] = vertices[i] / len;

      normals[i + 1] = vertices[i + 1] / len;

      normals[i + 2] = vertices[i + 2] / len;
    }

    const vbo = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const nbo = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, nbo);

    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

    return { vbo, nbo, count: vertices.length / 3 };
  }

  createProgram(gl, vs, fs) {
    const createShader = (type, source) => {
      const s = gl.createShader(type);

      gl.shaderSource(s, source);

      gl.compileShader(s);

      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;

      return s;
    };

    const p = gl.createProgram();

    gl.attachShader(p, createShader(gl.VERTEX_SHADER, vs));

    gl.attachShader(p, createShader(gl.FRAGMENT_SHADER, fs));

    gl.linkProgram(p);

    return p;
  }
}
