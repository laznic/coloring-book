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
let followingStopped = false;

setCanvasSize();

canvas.addEventListener("mousedown", start(canvas, context));
canvas.addEventListener("mouseup", stop(context));
canvas.addEventListener("mousemove", draw(canvas, context));
canvas.addEventListener("mouseout", stop(context));

followingCanvas.addEventListener(
  "mousedown",
  start(followingCanvas, followingContext)
);
followingCanvas.addEventListener("mouseup", stop(followingContext));
followingCanvas.addEventListener(
  "mousemove",
  draw(followingCanvas, followingContext)
);
followingCanvas.addEventListener("mouseout", stop(followingContext));
followingCanvas.addEventListener("click", freezeCanvas);

window.addEventListener("mousemove", setFollowingCanvasPosition);

function setFollowingCanvasPosition(event) {
  if (followingStopped) return;

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
function start(canvasEl, ctx) {
  return function (event) {
    isDrawing = true;
    draw(canvasEl, ctx)(event);
  };
}

// Stop drawing
function stop(ctx) {
  return function () {
    isDrawing = false;
    ctx.beginPath();
  };
}

// Draw
function draw(canvasEl, ctx) {
  return function (event) {
    if (!isDrawing) return;
    if (!followingStopped) return;

    const { clientX, clientY } = event;
    const { left, top } = canvasEl.getBoundingClientRect();
    const x = clientX - left;
    const y = clientY - top;

    ctx.lineWidth = size * 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
}

function setCanvasSize() {
  canvas?.setAttribute("width", `512px`);
  canvas?.setAttribute("height", `512px`);
}

function freezeCanvas() {
  followingStopped = true;
}
