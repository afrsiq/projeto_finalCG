const canvas = document.getElementById('glCanvas');
        const gl = canvas.getContext('webgl');

        if (!gl) {
            alert('WebGL não suportado!');
        }

        // Ajustar canvas ao tamanho da janela
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            gl.viewport(0, 0, canvas.width, canvas.height);
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Vertex Shader
        const vsSource = `
            attribute vec3 aPosition;
            attribute vec3 aNormal;
            uniform mat4 uModelMatrix;
            uniform mat4 uViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uNormalMatrix;
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
                vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
                vPosition = worldPosition.xyz;
                vNormal = normalize((uNormalMatrix * vec4(aNormal, 0.0)).xyz);
                gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
            }
        `;

        // Fragment Shader com bevel para cantos arredondados
        const fsSource = `
            precision mediump float;
            uniform vec3 uColor;
            uniform vec3 uLightPos;
            uniform vec3 uCameraPos;
            uniform float uBevel;
            uniform bool uEmissive;
            varying vec3 vNormal;
            varying vec3 vPosition;
            
            void main() {
                vec3 normal = normalize(vNormal);
                
                // Aplicar bevel (arredondamento)
                if (uBevel > 0.0) {
                    float edgeDist = 1.0 - max(max(abs(normal.x), abs(normal.y)), abs(normal.z));
                    float bevelFactor = smoothstep(0.0, uBevel, edgeDist);
                    normal = mix(normal, normalize(vPosition), bevelFactor * 0.3);
                }
                
                vec3 lightDir = normalize(uLightPos - vPosition);
                vec3 viewDir = normalize(uCameraPos - vPosition);
                vec3 halfDir = normalize(lightDir + viewDir);
                
                // Iluminação
                float diffuse = max(dot(normal, lightDir), 0.0);
                float specular = pow(max(dot(normal, halfDir), 0.0), 32.0);
                
                vec3 ambient = uColor * 0.3;
                vec3 color = ambient + uColor * diffuse + vec3(1.0) * specular * 0.5;
                
                // Emissão para propulsores e olhos
                if (uEmissive) {
                    color = uColor * 1.5;
                }
                
                gl_FragColor = vec4(color, 1.0);
            }
        `;

        // Compilar shaders
        function compileShader(source, type) {
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

        const vertexShader = compileShader(vsSource, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(fsSource, gl.FRAGMENT_SHADER);

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(program));
        }

        gl.useProgram(program);

        // Localizações dos atributos e uniforms
        const locations = {
            aPosition: gl.getAttribLocation(program, 'aPosition'),
            aNormal: gl.getAttribLocation(program, 'aNormal'),
            uModelMatrix: gl.getUniformLocation(program, 'uModelMatrix'),
            uViewMatrix: gl.getUniformLocation(program, 'uViewMatrix'),
            uProjectionMatrix: gl.getUniformLocation(program, 'uProjectionMatrix'),
            uNormalMatrix: gl.getUniformLocation(program, 'uNormalMatrix'),
            uColor: gl.getUniformLocation(program, 'uColor'),
            uLightPos: gl.getUniformLocation(program, 'uLightPos'),
            uCameraPos: gl.getUniformLocation(program, 'uCameraPos'),
            uBevel: gl.getUniformLocation(program, 'uBevel'),
            uEmissive: gl.getUniformLocation(program, 'uEmissive')
        };

        // Funções de matriz
        function mat4Create() {
            return new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);
        }

        function mat4Perspective(fov, aspect, near, far) {
            const f = 1.0 / Math.tan(fov / 2);
            const nf = 1 / (near - far);
            return new Float32Array([
                f / aspect, 0, 0, 0,
                0, f, 0, 0,
                0, 0, (far + near) * nf, -1,
                0, 0, 2 * far * near * nf, 0
            ]);
        }

        function mat4LookAt(eye, center, up) {
            const z = normalize([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
            const x = normalize(cross(up, z));
            const y = cross(z, x);
            return new Float32Array([
                x[0], y[0], z[0], 0,
                x[1], y[1], z[1], 0,
                x[2], y[2], z[2], 0,
                -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
            ]);
        }

        function mat4Translate(m, v) {
            const out = new Float32Array(m);
            out[12] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
            out[13] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
            out[14] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
            return out;
        }

        function mat4RotateY(m, angle) {
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            const out = new Float32Array(m);
            const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
            const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
            out[0] = a00 * c + a20 * s;
            out[1] = a01 * c + a21 * s;
            out[2] = a02 * c + a22 * s;
            out[3] = a03 * c + a23 * s;
            out[8] = a20 * c - a00 * s;
            out[9] = a21 * c - a01 * s;
            out[10] = a22 * c - a02 * s;
            out[11] = a23 * c - a03 * s;
            return out;
        }

        function mat4RotateX(m, angle) {
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            const out = new Float32Array(m);
            const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
            const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
            out[4] = a10 * c + a20 * s;
            out[5] = a11 * c + a21 * s;
            out[6] = a12 * c + a22 * s;
            out[7] = a13 * c + a23 * s;
            out[8] = a20 * c - a10 * s;
            out[9] = a21 * c - a11 * s;
            out[10] = a22 * c - a12 * s;
            out[11] = a23 * c - a13 * s;
            return out;
        }

        function mat4Scale(m, v) {
            const out = new Float32Array(m);
            out[0] *= v[0]; out[1] *= v[0]; out[2] *= v[0]; out[3] *= v[0];
            out[4] *= v[1]; out[5] *= v[1]; out[6] *= v[1]; out[7] *= v[1];
            out[8] *= v[2]; out[9] *= v[2]; out[10] *= v[2]; out[11] *= v[2];
            return out;
        }

        function normalize(v) {
            const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
            return len > 0 ? [v[0]/len, v[1]/len, v[2]/len] : v;
        }

        function cross(a, b) {
            return [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
        }

        function dot(a, b) {
            return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
        }

        // Criar geometrias
        function createCube() {
            const vertices = new Float32Array([
                -0.5,-0.5,-0.5, 0.5,-0.5,-0.5, 0.5,0.5,-0.5, -0.5,0.5,-0.5,
                -0.5,-0.5,0.5, 0.5,-0.5,0.5, 0.5,0.5,0.5, -0.5,0.5,0.5
            ]);
            const normals = new Float32Array([
                0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
                0,0,1, 0,0,1, 0,0,1, 0,0,1
            ]);
            const indices = new Uint16Array([
                0,1,2, 0,2,3, 4,5,6, 4,6,7,
                0,4,7, 0,7,3, 1,5,6, 1,6,2,
                0,1,5, 0,5,4, 2,3,7, 2,7,6
            ]);
            
            // Calcular normais corretas
            const fullNormals = new Float32Array(vertices.length);
            for (let i = 0; i < indices.length; i += 3) {
                const i0 = indices[i] * 3, i1 = indices[i+1] * 3, i2 = indices[i+2] * 3;
                const v0 = [vertices[i0], vertices[i0+1], vertices[i0+2]];
                const v1 = [vertices[i1], vertices[i1+1], vertices[i1+2]];
                const v2 = [vertices[i2], vertices[i2+1], vertices[i2+2]];
                const e1 = [v1[0]-v0[0], v1[1]-v0[1], v1[2]-v0[2]];
                const e2 = [v2[0]-v0[0], v2[1]-v0[1], v2[2]-v0[2]];
                const n = normalize(cross(e1, e2));
                for (let j = 0; j < 3; j++) {
                    const idx = indices[i+j] * 3;
                    fullNormals[idx] += n[0];
                    fullNormals[idx+1] += n[1];
                    fullNormals[idx+2] += n[2];
                }
            }
            for (let i = 0; i < fullNormals.length; i += 3) {
                const n = normalize([fullNormals[i], fullNormals[i+1], fullNormals[i+2]]);
                fullNormals[i] = n[0]; fullNormals[i+1] = n[1]; fullNormals[i+2] = n[2];
            }
            
            return { vertices, normals: fullNormals, indices };
        }

        function createCylinder(segments = 16) {
            const vertices = [], normals = [], indices = [];
            for (let i = 0; i <= segments; i++) {
                const theta = (i / segments) * Math.PI * 2;
                const x = Math.cos(theta) * 0.5;
                const z = Math.sin(theta) * 0.5;
                vertices.push(x, -0.5, z, x, 0.5, z);
                normals.push(x, 0, z, x, 0, z);
            }
            for (let i = 0; i < segments; i++) {
                const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
                indices.push(a, c, b, b, c, d);
            }
            return { 
                vertices: new Float32Array(vertices), 
                normals: new Float32Array(normals), 
                indices: new Uint16Array(indices) 
            };
        }

        function createSphere(segments = 16) {
            const vertices = [], normals = [], indices = [];
            for (let lat = 0; lat <= segments; lat++) {
                const theta = (lat / segments) * Math.PI;
                const sinTheta = Math.sin(theta);
                const cosTheta = Math.cos(theta);
                for (let lon = 0; lon <= segments; lon++) {
                    const phi = (lon / segments) * Math.PI * 2;
                    const x = Math.cos(phi) * sinTheta * 0.5;
                    const y = cosTheta * 0.5;
                    const z = Math.sin(phi) * sinTheta * 0.5;
                    vertices.push(x, y, z);
                    normals.push(x*2, y*2, z*2);
                }
            }
            for (let lat = 0; lat < segments; lat++) {
                for (let lon = 0; lon < segments; lon++) {
                    const a = lat * (segments + 1) + lon;
                    const b = a + segments + 1;
                    indices.push(a, b, a+1, a+1, b, b+1);
                }
            }
            return { 
                vertices: new Float32Array(vertices), 
                normals: new Float32Array(normals), 
                indices: new Uint16Array(indices) 
            };
        }

        function createPyramid() {
            const vertices = new Float32Array([
                0, 0.5, 0,
                -0.5, -0.5, 0.5,
                0.5, -0.5, 0.5,
                0.5, -0.5, -0.5,
                -0.5, -0.5, -0.5
            ]);
            const indices = new Uint16Array([
                0,1,2, 0,2,3, 0,3,4, 0,4,1,
                1,4,3, 1,3,2
            ]);
            const normals = new Float32Array(vertices.length);
            for (let i = 0; i < indices.length; i += 3) {
                const i0 = indices[i] * 3, i1 = indices[i+1] * 3, i2 = indices[i+2] * 3;
                const v0 = [vertices[i0], vertices[i0+1], vertices[i0+2]];
                const v1 = [vertices[i1], vertices[i1+1], vertices[i1+2]];
                const v2 = [vertices[i2], vertices[i2+1], vertices[i2+2]];
                const e1 = [v1[0]-v0[0], v1[1]-v0[1], v1[2]-v0[2]];
                const e2 = [v2[0]-v0[0], v2[1]-v0[1], v2[2]-v0[2]];
                const n = normalize(cross(e1, e2));
                for (let j = 0; j < 3; j++) {
                    const idx = indices[i+j] * 3;
                    normals[idx] += n[0]; normals[idx+1] += n[1]; normals[idx+2] += n[2];
                }
            }
            for (let i = 0; i < normals.length; i += 3) {
                const n = normalize([normals[i], normals[i+1], normals[i+2]]);
                normals[i] = n[0]; normals[i+1] = n[1]; normals[i+2] = n[2];
            }
            return { vertices, normals, indices };
        }

        // Criar buffers
        function createBuffers(geometry) {
            const vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);

            const nbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, nbo);
            gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW);

            const ibo = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

            return { vbo, nbo, ibo, count: geometry.indices.length };
        }

        const cubeBuffers = createBuffers(createCube());
        const cylinderBuffers = createBuffers(createCylinder());
        const sphereBuffers = createBuffers(createSphere());
        const pyramidBuffers = createBuffers(createPyramid());

        // Função de desenho
        function drawMesh(buffers, modelMatrix, color, bevel = 0, emissive = false) {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vbo);
            gl.enableVertexAttribArray(locations.aPosition);
            gl.vertexAttribPointer(locations.aPosition, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.nbo);
            gl.enableVertexAttribArray(locations.aNormal);
            gl.vertexAttribPointer(locations.aNormal, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.ibo);

            gl.uniformMatrix4fv(locations.uModelMatrix, false, modelMatrix);
            gl.uniformMatrix4fv(locations.uNormalMatrix, false, modelMatrix);
            gl.uniform3fv(locations.uColor, color);
            gl.uniform1f(locations.uBevel, bevel);
            gl.uniform1i(locations.uEmissive, emissive ? 1 : 0);

            gl.drawElements(gl.TRIANGLES, buffers.count, gl.UNSIGNED_SHORT, 0);
        }

        // Controles de câmera
        let cameraAngleX = 0.3;
        let cameraAngleY = 0;
        let cameraDistance = 8;
        let isDragging = false;
        let lastMouseX = 0;
        let lastMouseY = 0;

        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - lastMouseX;
                const dy = e.clientY - lastMouseY;
                cameraAngleY += dx * 0.01;
                cameraAngleX += dy * 0.01;
                cameraAngleX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraAngleX));
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
            }
        });

        canvas.addEventListener('mouseup', () => isDragging = false);
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            cameraDistance += e.deltaY * 0.01;
            cameraDistance = Math.max(4, Math.min(15, cameraDistance));
        });

        // Cores
        const darkRed = [0.4, 0.05, 0.05];
        const glowOrange = [1.0, 0.4, 0.1];
        const redLED = [1.0, 0.0, 0.0];

        // Loop de animação
        let time = 0;
        function render() {
            time += 0.016;

            gl.clearColor(0.05, 0.05, 0.1, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);

            const aspect = canvas.width / canvas.height;
            const projectionMatrix = mat4Perspective(Math.PI / 4, aspect, 0.1, 100);
            
            const camX = Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
            const camY = Math.sin(cameraAngleX) * cameraDistance;
            const camZ = Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
            const viewMatrix = mat4LookAt([camX, camY, camZ], [0, 0, 0], [0, 1, 0]);

            gl.uniformMatrix4fv(locations.uProjectionMatrix, false, projectionMatrix);
            gl.uniformMatrix4fv(locations.uViewMatrix, false, viewMatrix);
            gl.uniform3fv(locations.uLightPos, [5, 10, 5]);
            gl.uniform3fv(locations.uCameraPos, [camX, camY, camZ]);

            const armAngle = Math.sin(time) * 0.3;
            const legAngle = Math.sin(time * 1.5) * 0.2;

            // Corpo
            let m = mat4Create();
            m = mat4Scale(m, [1.2, 1.5, 0.8]);
            drawMesh(cubeBuffers, m, darkRed);

            // Cabeça com bevel
            m = mat4Create();
            m = mat4Translate(m, [0, 1.3, 0]);
            m = mat4Scale(m, [0.8, 0.8, 0.8]);
            drawMesh(cubeBuffers, m, darkRed, 0.15);

            // Olhos LED
            m = mat4Create();
            m = mat4Translate(m, [-0.25, 1.4, 0.41]);
            m = mat4Scale(m, [0.15, 0.15, 0.1]);
            drawMesh(cylinderBuffers, m, redLED, 0, true);

            m = mat4Create();
            m = mat4Translate(m, [0.25, 1.4, 0.41]);
            m = mat4Scale(m, [0.15, 0.15, 0.1]);
            drawMesh(cylinderBuffers, m, redLED, 0, true);

            // Braço esquerdo
            m = mat4Create();
            m = mat4Translate(m, [-0.75, 0.6, 0]); // Posição do ombro
            m = mat4RotateX(m, armAngle); // Rotação no pivô do ombro
            m = mat4Translate(m, [0, -0.5, 0]); // Move para baixo após rotação
            m = mat4Scale(m, [0.25, 0.8, 0.25]);
            drawMesh(cylinderBuffers, m, darkRed);

            // Ombro esquerdo (pirâmide invertida)
            m = mat4Create();
            m = mat4Translate(m, [-0.75, 0.6, 0]);
            m = mat4RotateX(m, Math.PI); // Inverte a pirâmide
            m = mat4Scale(m, [0.5, 0.6, 0.5]);
            drawMesh(pyramidBuffers, m, glowOrange);

            // Braço direito
            m = mat4Create();
            m = mat4Translate(m, [0.75, 0.6, 0]); // Posição do ombro
            m = mat4RotateX(m, -armAngle); // Rotação no pivô do ombro
            m = mat4Translate(m, [0, -0.5, 0]); // Move para baixo após rotação
            m = mat4Scale(m, [0.25, 0.8, 0.25]);
            drawMesh(cylinderBuffers, m, darkRed);

            // Ombro direito (pirâmide invertida)
            m = mat4Create();
            m = mat4Translate(m, [0.75, 0.6, 0]);
            m = mat4RotateX(m, Math.PI); // Inverte a pirâmide
            m = mat4Scale(m, [0.5, 0.6, 0.5]);
            drawMesh(pyramidBuffers, m, glowOrange);

            // Perna esquerda
            m = mat4Create();
            m = mat4Translate(m, [-0.4, -1.3, 0]);
            m = mat4RotateX(m, legAngle);
            m = mat4Scale(m, [0.35, 1.0, 0.35]);
            drawMesh(cubeBuffers, m, darkRed);

            // Perna direita
            m = mat4Create();
            m = mat4Translate(m, [0.4, -1.3, 0]);
            m = mat4RotateX(m, -legAngle);
            m = mat4Scale(m, [0.35, 1.0, 0.35]);
            drawMesh(cubeBuffers, m, darkRed);

            // Escudo frontal (pirâmide invertida)
            m = mat4Create();
            m = mat4Translate(m, [0, 0, 0.6]);
            m = mat4RotateX(m, Math.PI); // Inverte a pirâmide
            m = mat4Scale(m, [0.8, 1.0, 0.5]);
            drawMesh(pyramidBuffers, m, glowOrange);

            // Propulsor esquerdo
            m = mat4Create();
            m = mat4Translate(m, [-0.5, -0.3, -0.5]);
            m = mat4Scale(m, [0.3, 0.3, 0.3]);
            const pulse = 0.8 + Math.sin(time * 5) * 0.2;
            drawMesh(sphereBuffers, m, [glowOrange[0]*pulse, glowOrange[1]*pulse, glowOrange[2]*pulse], 0, true);

            // Propulsor direito
            m = mat4Create();
            m = mat4Translate(m, [0.5, -0.3, -0.5]);
            m = mat4Scale(m, [0.3, 0.3, 0.3]);
            drawMesh(sphereBuffers, m, [glowOrange[0]*pulse, glowOrange[1]*pulse, glowOrange[2]*pulse], 0, true);

            requestAnimationFrame(render);
        }

        render();