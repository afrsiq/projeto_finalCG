// importa as partes do jogo
import { Background } from "./fundo_final.js";
import { Pista } from "./pista.js";
import { Robo1 } from "./robo1.js";
import { BlackHole } from "./void.js";     // buraco negro
// import { AlgoMais } from "./algomais.js"

// criar o canvas
const canvas = document.getElementById("glCanvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gl = canvas.getContext("webgl");
if (!gl){
    alert("WebGL não suportado");
}

// controle do jogador
const input = { left: false, right: false };

window.addEventListener("keydown", e => {
    if (e.key === "a") input.left = true;
    if (e.key === "d") input.right = true;
});
window.addEventListener("keyup", e => {
    if (e.key === "a") input.left = false;
    if (e.key === "d") input.right = false;
});

// cria os módulos do jogo
const background = new Background(gl);
const pista      = new Pista(gl);
const robo       = new Robo1(gl);
const blackHole  = new BlackHole(gl); 

let last = performance.now();

// loop principal
function loop(now){
    const dt = (now - last) / 1000;
    last = now;

    gl.clear(gl.COLOR_BUFFER_BIT);

    // UPDATE (lógica)
    pista.update(dt);
    robo.update(dt, input);
    blackHole.update(dt);   

    // RENDER (desenho)
    background.render(now * 0.001);
    pista.render();
    blackHole.render(now * 0.001);  
    robo.render();

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

