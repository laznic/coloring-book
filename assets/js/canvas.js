import { fabric } from "fabric";

export default {
  mounted() {
    let currentMask = null;
    let firstGeneration = true;
    // Because we cannot export tainted canvas so just convert to Base64 for now
    async function getBase64ImageFromUrl(imageUrl) {
      const res = await fetch(imageUrl);
      const blob = await res.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener(
          "load",
          function () {
            resolve(reader.result);
          },
          false
        );

        reader.onerror = () => {
          return reject(this);
        };
        reader.readAsDataURL(blob);
      });
    }

    this.handleEvent("generated_image_prompt", ({ prompt, coords }) => {
      const baseImage = canvas.toDataURL({
        height: 512,
        width: 512,
        top: coords.top,
        left: coords.left,
      });

      const eventName = firstGeneration
        ? "start_initial_image_generation"
        : "start_inpainting";

      this.pushEvent(eventName, {
        prompt,
        image: baseImage,
        mask: currentMask,
        coords: {
          top: coords.top,
          left: coords.left,
        },
      });
    });

    this.handleEvent("generated_image", ({ image, coords }) => {
      getBase64ImageFromUrl(image)
        .then((result) => {
          fabric.Image.fromURL(result, function (oImg) {
            // The first generation is 1024x1024 while inpainting produces 512x512 images
            if (firstGeneration) {
              oImg.scale(0.5);
            }

            canvas.add(
              oImg.set({
                top: coords.top,
                left: coords.left,
              })
            );

            const rectangles = canvas.getObjects("rect");
            canvas.remove(rectangles);

            firstGeneration = false;
          });
        })
        .catch((err) => console.error(err));
    });

    const canvas = new fabric.Canvas("canvas", {
      centeredScaling: true,
      selection: false,
      backgroundColor: "#808080",
    });

    canvas.setWidth(window.innerWidth);
    canvas.setHeight(window.innerHeight);
    canvas.freeDrawingBrush.width = 10;

    let lastPosX = null;
    let lastPosY = null;

    canvas.on("mouse:down", function (opt) {
      const evt = opt.e;

      if (evt.altKey) {
        canvas.isDragging = true;

        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
      }
    });
    canvas.on("mouse:move", function (opt) {
      if (canvas.isDragging) {
        const e = opt.e;
        const vpt = canvas.viewportTransform;
        vpt[4] += e.clientX - lastPosX;
        vpt[5] += e.clientY - lastPosY;
        canvas.requestRenderAll();
        lastPosX = e.clientX;
        lastPosY = e.clientY;
      }
    });
    canvas.on("mouse:up", function (opt) {
      if (canvas.isDragging) {
        // on mouse up we want to recalculate new interaction
        // for all objects, so we call setViewportTransform
        canvas.isDragging = !canvas.isDragging;
        canvas.setViewportTransform(canvas.viewportTransform);
      }
    });

    let isDrawing = false;
    let color = "black";
    let size = 5;
    let canvasSize = 512;
    let followingStopped = false;

    const followingCanvas = new fabric.Canvas("following-canvas");

    followingCanvas.setWidth(canvasSize);
    followingCanvas.setHeight(canvasSize);
    followingCanvas.freeDrawingBrush.width = 10;
    followingCanvas.freeDrawingBrush.limitToCanvasSize = true;
    followingCanvas.getElement().parentElement.style.position = "absolute";

    followingCanvas.on("mouse:down", freezeCanvas);

    followingCanvas.on("path:created", () => {
      const dataURL = followingCanvas.toDataURL();

      followingCanvas.setBackgroundColor("#ffcc00");
      const canvasEl = followingCanvas.getElement();
      const coords = canvasEl.parentElement.getBoundingClientRect();
      const canvasCoords = canvas.calcViewportBoundaries();

      const originalDrawing = followingCanvas.toDataURL();

      this.pushEvent("send_drawing", {
        drawing: originalDrawing,
        coords: {
          top: coords.top + canvasCoords.tl.y,
          left: coords.left + canvasCoords.tl.x,
        },
      });

      followingCanvas.setBackgroundColor("transparent");

      fabric.Image.fromURL(dataURL, function (oImg) {
        canvas.add(
          oImg.set({
            top: coords.top + canvasCoords.tl.y,
            left: coords.left + canvasCoords.tl.x,
            selectable: false,
          })
        );

        const allImages = canvas.getObjects("image");
        let intersectingObjects = [];

        for (let i = 0; i < allImages.length; i++) {
          if (allImages[i].cacheKey === oImg.cacheKey) continue;

          if (oImg.intersectsWithObject(allImages[i])) {
            intersectingObjects.push(allImages[i]);
          }
        }

        const background = new fabric.Rect({
          height: 512,
          width: 512,
          top: coords.top + canvasCoords.tl.y + 1,
          left: coords.left + canvasCoords.tl.x + 1,
          fill: "white",
          selectable: false,
        });

        canvas.add(background);

        intersectingObjects.forEach((obj) => {
          const { bl, tl, br, tr } = obj.lineCoords;

          const isTopLeftInside = oImg.containsPoint(tl);
          const isTopRightInside = oImg.containsPoint(tr);
          const isBottomLeftInside = oImg.containsPoint(bl);
          const isBottomRightInside = oImg.containsPoint(br);

          const bottomLeftInside = {
            top: oImg.lineCoords.tr.y,
            left: oImg.lineCoords.tr.x - Math.abs(oImg.lineCoords.tr.x - bl.x),
            width: Math.abs(oImg.lineCoords.tr.x - bl.x),
            height: Math.abs(oImg.lineCoords.tr.y - bl.y),
          };

          const bottomRightInside = {
            top: oImg.lineCoords.tl.y,
            left: oImg.lineCoords.tl.x,
            width: Math.abs(oImg.lineCoords.tl.x - br.x),
            height: Math.abs(oImg.lineCoords.tl.y - br.y),
          };

          const topLeftInside = {
            top: oImg.lineCoords.br.y - Math.abs(oImg.lineCoords.br.y - tl.y),
            left: oImg.lineCoords.br.x - Math.abs(oImg.lineCoords.br.x - tl.x),
            width: Math.abs(oImg.lineCoords.br.x - tl.x),
            height: Math.abs(oImg.lineCoords.br.y - tl.y),
          };

          const topRightInside = {
            top: oImg.lineCoords.bl.y - Math.abs(oImg.lineCoords.bl.y - tr.y),
            left: oImg.lineCoords.bl.x,
            width: Math.abs(oImg.lineCoords.bl.x - tr.x),
            height: Math.abs(oImg.lineCoords.bl.y - tr.y),
          };

          const rectPosition = isTopLeftInside
            ? topLeftInside
            : isTopRightInside
            ? topRightInside
            : isBottomLeftInside
            ? bottomLeftInside
            : isBottomRightInside
            ? bottomRightInside
            : {};

          const rect = new fabric.Rect({
            ...rectPosition,
            fill: "black",
            selectable: false,
          });

          canvas.add(rect);
        });

        //Get source image
        const mask = canvas.toDataURL({
          height: 512,
          width: 512,
          top: coords.top + canvasCoords.tl.y,
          left: coords.left + canvasCoords.tl.x,
        });

        currentMask = mask;

        canvas.remove(mask);
        canvas.remove(background);
        const rectangles = canvas.getObjects("rect");
        canvas.remove(...rectangles);
        canvas.remove(oImg);
      });

      followingCanvas.clear();
      followingStopped = false;
      followingCanvas.isDrawingMode = false;

      // const testing = canvas.toDataURL({
      //   height: 512,
      //   width: 512,
      //   top: coords.top + canvasCoords.tl.y,
      //   left: coords.left + canvasCoords.tl.x,
      // });
      // console.log(testing);
    });

    // setCanvasSize();

    // canvas.addEventListener("mousedown", start(canvas, context));
    // canvas.addEventListener("mouseup", stop(context));
    // canvas.addEventListener("mousemove", draw(canvas, context));
    // canvas.addEventListener("mouseout", stop(context));

    // followingCanvas.addEventListener(
    //   "mousedown",
    //   start(followingCanvas, followingContext)
    // );
    // followingCanvas.addEventListener("mouseup", stop(followingContext));
    // followingCanvas.addEventListener(
    //   "mousemove",
    //   draw(followingCanvas, followingContext)
    // );
    // followingCanvas.addEventListener("mouseout", stop(followingContext));
    // followingCanvas.addEventListener("click", freezeCanvas);

    window.addEventListener("mousemove", setFollowingCanvasPosition);

    function setFollowingCanvasPosition(event) {
      if (followingStopped) return;

      const { clientX, clientY } = event;
      const x = clientX - canvasSize / 2;
      const y = clientY - canvasSize / 2;
      const canvasElement = followingCanvas.getElement();

      canvasElement.parentElement.style.left = `${x}px`;
      canvasElement.parentElement.style.top = `${y}px`;
    }

    function freezeCanvas() {
      followingStopped = true;
      followingCanvas.isDrawingMode = true;
    }
  },
};

// get an area with one color from image
