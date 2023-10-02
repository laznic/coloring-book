const canvas = document.getElementById("canvas");
const followingCanvas = document.getElementById("following-canvas");
const context = canvas.getContext("2d");
const followingContext = followingCanvas.getContext("2d");
followingCanvas?.setAttribute("width", `512px`);
followingCanvas?.setAttribute("height", `512px`);

let isDrawing = false;
let color = "black";
let size = 5;
let canvasSize = 512;

setCanvasSize();

canvas.addEventListener("mousedown", start);
canvas.addEventListener("mouseup", stop);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseout", stop);

window.addEventListener("mousemove", setFollowingCanvasPosition);

function setFollowingCanvasPosition(event) {
  const { clientX, clientY } = event;
  const x = clientX - canvasSize / 2;
  const y = clientY - canvasSize / 2;

  const { top, right, bottom, left } = canvas.getBoundingClientRect();

  const threshold = 40;
  const rightOffset = right - x - 1;
  const leftOffset = left - canvasSize - x + 1;
  const topOffset = top - canvasSize - y + 1;
  const bottomOffset = bottom - y - 1;

  const canSetX = rightOffset > threshold && leftOffset < threshold * -1;
  const canSetY = topOffset < threshold * -1 && bottomOffset > threshold;

  if (canSetX) {
    followingCanvas.style.left = `${x}px`;
  }

  if (canSetY) {
    followingCanvas.style.top = `${y}px`;
  }
}

// Change color
function changeColor(element) {
  color = element.style.backgroundColor;
}

// Change size
function changeSize(element) {
  size = element.value;
}

// Start drawing
function start(event) {
  isDrawing = true;
  draw(event);
}

// Stop drawing
function stop() {
  isDrawing = false;
  context.beginPath();
}

// Draw
function draw(event) {
  if (!isDrawing) return;

  const { clientX, clientY } = event;
  const { left, top } = canvas.getBoundingClientRect();
  const x = clientX - left;
  const y = clientY - top;

  context.lineWidth = size * 2;
  context.lineCap = "round";
  context.strokeStyle = color;
  context.lineTo(x, y);
  context.stroke();
  context.beginPath();
  context.moveTo(x, y);
}

function setCanvasSize() {
  canvas?.setAttribute("width", `512px`);
  canvas?.setAttribute("height", `512px`);
}
